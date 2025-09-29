import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

// Sample staff users (in production, these would be in the database)
const STAFF_USERS = [
    {
        id: '1',
        name: 'Business Owner',
        email: 'admin@abaisprings.com',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password123
        role: 'owner',
        isActive: true
    },
    {
        id: '2',
        name: 'Sales Manager',
        email: 'sales@abaisprings.com',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password123
        role: 'sales',
        isActive: true
    },
    {
        id: '3',
        name: 'Delivery Driver',
        email: 'driver@abaisprings.com',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password123
        role: 'driver',
        isActive: true
    },
    {
        id: '4',
        name: 'Warehouse Manager',
        email: 'warehouse@abaisprings.com',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password123
        role: 'warehouse',
        isActive: true
    }
];

// Staff Login
router.post('/staff-login', async (req, res) => {
    try {
        const { email, password, role } = req.body;

        // Validate input
        if (!email || !password || !role) {
            return res.status(400).json({
                success: false,
                message: 'Email, password, and role are required'
            });
        }

        // Find staff user
        const staffUser = STAFF_USERS.find(user => 
            user.email === email && user.role === role && user.isActive
        );

        if (!staffUser) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials or role'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, staffUser.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: staffUser.id, 
                email: staffUser.email, 
                role: staffUser.role 
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        // Return success response
        res.json({
            success: true,
            message: 'Staff login successful',
            token,
            user: {
                id: staffUser.id,
                name: staffUser.name,
                email: staffUser.email,
                role: staffUser.role
            }
        });

    } catch (error) {
        console.error('Staff login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
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
        
        // Find staff user
        const staffUser = STAFF_USERS.find(user => user.id === decoded.userId);
        
        if (!staffUser || !staffUser.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }

        res.json({
            success: true,
            user: {
                id: staffUser.id,
                name: staffUser.name,
                email: staffUser.email,
                role: staffUser.role
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
        const staffUser = STAFF_USERS.find(user => user.id === decoded.userId);
        
        if (!staffUser) {
            return res.status(404).json({
                success: false,
                message: 'Staff user not found'
            });
        }

        res.json({
            success: true,
            user: {
                id: staffUser.id,
                name: staffUser.name,
                email: staffUser.email,
                role: staffUser.role
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

















































