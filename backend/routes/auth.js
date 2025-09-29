import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { body } from 'express-validator';
import User from '../models/User.js';
import { 
  authenticate, 
  requireAdmin, 
  requireCustomer,
  validatePasswordStrength,
  validateEmail,
  sanitizeInput,
  logAuthAttempt
} from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/validate.js';
import { 
  sendCreated, 
  sendSuccess, 
  sendError, 
  sendUnauthorized, 
  sendConflict,
  sendValidationError
} from '../utils/responseHandler.js';
import { authRateLimit, passwordResetRateLimit } from '../middleware/rateLimiting.js';

const router = express.Router();

// @desc    Get auth overview
// @route   GET /api/auth
// @access  Public
router.get('/', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Auth API is working',
      endpoints: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        profile: 'GET /api/auth/profile',
        logout: 'POST /api/auth/logout',
        refresh: 'POST /api/auth/refresh',
        'forgot-password': 'POST /api/auth/forgot-password',
        'reset-password': 'POST /api/auth/reset-password',
        users: 'GET /api/auth/users'
      }
    });
  } catch (error) {
    console.error('Error in auth route:', error);
    res.status(500).json({
      success: false,
      message: 'Auth API error'
    });
  }
});

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', 
  authRateLimit,
  sanitizeInput,
  validateEmail,
  validatePasswordStrength,
  logAuthAttempt,
  [
    body('name')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters'),
    body('phone')
      .matches(/^(\+254|0)[1-9]\d{8}$/)
      .withMessage('Please enter a valid Kenyan phone number')
  ],
  asyncHandler(async (req, res) => {
    const { name, email, password, phone } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      throw new ApiError('User already exists with this email', 409);
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      phone
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    return sendCreated(res, {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      },
      token,
      refreshToken
    }, 'User registered successfully');
  })
);

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', 
  authRateLimit,
  sanitizeInput,
  validateEmail,
  logAuthAttempt,
  [
    body('password')
      .isLength({ min: 1 })
      .withMessage('Password is required')
  ],
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Find user by email and include password for comparison
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      throw new ApiError('Invalid email or password', 401);
    }

    // Check if account is locked
    if (user.isLocked()) {
      throw new ApiError('Account is temporarily locked due to multiple failed login attempts. Please try again later.', 423);
    }

    // Check if user is active
    if (!user.isActive) {
      throw new ApiError('Account is deactivated. Please contact support.', 401);
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Increment login attempts
      await user.incLoginAttempts();
      
      throw new ApiError('Invalid email or password', 401);
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    return sendSuccess(res, {
      message: 'Login successful',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          addresses: user.addresses
        },
        token,
        refreshToken
      }
    });
  })
);

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
router.get('/profile', 
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    
    return sendSuccess(res, {
      message: 'Profile retrieved successfully',
      data: user
    });
  })
);

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', 
  authenticate,
  sanitizeInput,
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters'),
    body('phone')
      .optional()
      .matches(/^(\+254|0)[17]\d{8}$/)
      .withMessage('Please enter a valid Kenyan phone number')
  ],
  asyncHandler(async (req, res) => {
    const { name, phone, addresses } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      throw new ApiError('User not found', 404);
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (addresses) user.addresses = addresses;

    const updatedUser = await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  })
);

// @desc    Add address to user profile
// @route   POST /api/auth/addresses
// @access  Private
router.post('/addresses', 
  authenticate,
  sanitizeInput,
  [
    body('type')
      .isIn(['home', 'office', 'other'])
      .withMessage('Address type must be home, office, or other'),
    body('address')
      .trim()
      .isLength({ min: 10, max: 200 })
      .withMessage('Address must be between 10 and 200 characters'),
    body('coordinates.lat')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('Invalid latitude'),
    body('coordinates.lng')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Invalid longitude')
  ],
  asyncHandler(async (req, res) => {
    const { type, address, coordinates, isDefault } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      throw new ApiError('User not found', 404);
    }

    // If this is default address, remove default from others
    if (isDefault) {
      user.addresses.forEach(addr => {
        addr.isDefault = false;
      });
    }

    // Add new address
    user.addresses.push({
      type,
      address,
      coordinates,
      isDefault: isDefault || false
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      data: user.addresses
    });
  })
);

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', 
  authenticate,
  asyncHandler(async (req, res) => {
    // In a more advanced implementation, you might want to:
    // 1. Add the token to a blacklist
    // 2. Update user's last logout time
    // 3. Clear any server-side sessions
    
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      // Optional: Add token to blacklist (requires Redis or database)
      // await TokenBlacklist.create({ token, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
      
      console.log(`User ${req.user.email} logged out`);
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  })
);

// @desc    Refresh token
// @route   POST /api/auth/refresh
// @access  Public
router.post('/refresh', 
  sanitizeInput,
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw new ApiError('Refresh token is required', 400);
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    
    // Check if user exists
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user || !user.isActive) {
      throw new ApiError('Invalid refresh token', 401);
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Generate new refresh token
    const newRefreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      }
    });
  })
);

// @desc    Request password reset
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', 
  passwordResetRateLimit,
  sanitizeInput,
  validateEmail,
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });
    
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Generate password reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // In production, send email with reset link
    // await sendPasswordResetEmail(user.email, resetToken);

    console.log(`Password reset token for ${email}: ${resetToken}`);

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  })
);

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
router.post('/reset-password', 
  authRateLimit,
  sanitizeInput,
  validatePasswordStrength,
  asyncHandler(async (req, res) => {
    const { token, password } = req.body;

    if (!token) {
      throw new ApiError('Reset token is required', 400);
    }

    // Hash the token to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      throw new ApiError('Invalid or expired reset token', 400);
    }

    // Set new password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  })
);

// @desc    Get all users (Admin only)
// @route   GET /api/auth/users
// @access  Private (Admin)
router.get('/users', 
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const users = await User.find({}).select('-password -passwordHistory -mfaBackupCodes -apiKeys -activeSessions');
    
    return sendSuccess(res, {
      message: 'Users retrieved successfully',
      data: users
    });
  })
);

export default router; 