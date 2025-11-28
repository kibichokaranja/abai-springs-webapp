import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Staff from '../models/Staff.js';

const router = express.Router();

// Staff Login
router.post('/staff-login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Normalize email
        const normalizedEmail = email.toLowerCase().trim();

        console.log('Staff login attempt:', { email: normalizedEmail, hasPassword: !!password });

        // Check MongoDB connection
        if (mongoose.connection.readyState !== 1) {
            console.error('MongoDB not connected. ReadyState:', mongoose.connection.readyState);
            return res.status(503).json({
                success: false,
                message: 'Database connection not available. Please try again later.'
            });
        }

        // Find staff user in database (include password field and populate outlet)
        const staffUser = await Staff.findOne({ email: normalizedEmail }).select('+password').populate('outlet', 'name address');

        if (!staffUser) {
            console.log('Staff not found for email:', normalizedEmail);
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        console.log('Staff found:', { 
            name: staffUser.name, 
            email: staffUser.email, 
            role: staffUser.role, 
            status: staffUser.status,
            hasPassword: !!staffUser.password 
        });

        // Check if staff is active
        if (staffUser.status !== 'active') {
            return res.status(401).json({
                success: false,
                message: 'Account is not active. Please contact administrator.'
            });
        }

        // Check if password exists
        if (!staffUser.password) {
            console.error('Staff user found but password field is missing');
            return res.status(500).json({
                success: false,
                message: 'Account configuration error. Please contact administrator.'
            });
        }

        // Verify password using the model method
        let isValidPassword;
        try {
            isValidPassword = await staffUser.comparePassword(password);
            console.log('Password validation result:', isValidPassword);
        } catch (compareError) {
            console.error('Password comparison error:', compareError);
            return res.status(500).json({
                success: false,
                message: 'Authentication error. Please try again.'
            });
        }
        
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Update last login
        staffUser.lastLogin = new Date();
        await staffUser.save({ validateBeforeSave: false });

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: staffUser._id.toString(), 
                email: staffUser.email, 
                role: staffUser.role 
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        // Populate outlet if exists
        await staffUser.populate('outlet', 'name address');
        
        // Return success response
        res.json({
            success: true,
            message: 'Staff login successful',
            token,
            user: {
                id: staffUser._id.toString(),
                name: staffUser.name,
                email: staffUser.email,
                role: staffUser.role,
                department: staffUser.department,
                outlet: staffUser.outlet ? {
                    id: staffUser.outlet._id.toString(),
                    name: staffUser.outlet.name,
                    address: staffUser.outlet.address
                } : null
            }
        });

    } catch (error) {
        console.error('Staff login error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Verify Staff Token
router.get('/verify-staff', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        // Find staff user in database
        const staffUser = await Staff.findById(decoded.userId);
        
        if (!staffUser || staffUser.status !== 'active') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token or account not active'
            });
        }

        res.json({
            success: true,
            user: {
                id: staffUser._id.toString(),
                name: staffUser.name,
                email: staffUser.email,
                role: staffUser.role,
                department: staffUser.department
            }
        });

    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
});

// Get Staff Profile
router.get('/staff-profile', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const staffUser = await Staff.findById(decoded.userId);
        
        if (!staffUser) {
            return res.status(404).json({
                success: false,
                message: 'Staff user not found'
            });
        }

        res.json({
            success: true,
            user: {
                id: staffUser._id.toString(),
                name: staffUser.name,
                email: staffUser.email,
                role: staffUser.role,
                department: staffUser.department,
                phone: staffUser.phone,
                status: staffUser.status
            }
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Staff Logout
router.post('/staff-logout', (req, res) => {
    // In a real application, you might want to blacklist the token
    res.json({
        success: true,
        message: 'Staff logout successful'
    });
});

export default router;



















































































