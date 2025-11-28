import express from 'express';
import mongoose from 'mongoose';
import Staff from '../models/Staff.js';

const router = express.Router();

// GET all staff members
router.get('/', async (req, res) => {
  try {
    const staff = await Staff.find().populate('outlet', 'name address').sort({ createdAt: -1 });
    res.json({
      success: true,
      data: staff,
      count: staff.length
    });
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff members',
      error: error.message
    });
  }
});

// GET staff member by ID
router.get('/:id', async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id).populate('outlet', 'name address');
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }
    res.json({
      success: true,
      data: staff
    });
  } catch (error) {
    console.error('Error fetching staff member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff member',
      error: error.message
    });
  }
});

// POST create new staff member
router.post('/', async (req, res) => {
  try {
    const staffData = req.body;
    
    // Normalize email to lowercase
    if (staffData.email) {
      staffData.email = staffData.email.toLowerCase().trim();
    }
    
    // Check if email already exists
    const existingStaff = await Staff.findOne({ email: staffData.email });
    if (existingStaff) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Ensure password is provided
    if (!staffData.password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    console.log('Creating staff member:', { 
      name: staffData.name, 
      email: staffData.email, 
      role: staffData.role,
      hasPassword: !!staffData.password,
      passwordLength: staffData.password ? staffData.password.length : 0
    });

    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB not connected. ReadyState:', mongoose.connection.readyState);
      return res.status(503).json({
        success: false,
        message: 'Database connection not available. Please try again later.'
      });
    }

    const newStaff = new Staff(staffData);
    const savedStaff = await newStaff.save();
    
    console.log('Staff member saved successfully:', {
      id: savedStaff._id,
      email: savedStaff.email,
      role: savedStaff.role,
      hasPassword: !!savedStaff.password
    });

    // Remove password from response
    const staffResponse = savedStaff.toObject();
    delete staffResponse.password;

    res.status(201).json({
      success: true,
      message: 'Staff member created successfully',
      data: staffResponse
    });
  } catch (error) {
    console.error('Error creating staff member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create staff member',
      error: error.message
    });
  }
});

// PUT update staff member
router.put('/:id', async (req, res) => {
  try {
    const staffData = req.body;
    const staffId = req.params.id;

    // Check if email is being changed and if it already exists
    if (staffData.email) {
      const existingStaff = await Staff.findOne({ 
        email: staffData.email, 
        _id: { $ne: staffId } 
      });
      if (existingStaff) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    const updatedStaff = await Staff.findByIdAndUpdate(
      staffId,
      staffData,
      { new: true, runValidators: true }
    );

    if (!updatedStaff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    res.json({
      success: true,
      message: 'Staff member updated successfully',
      data: updatedStaff
    });
  } catch (error) {
    console.error('Error updating staff member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update staff member',
      error: error.message
    });
  }
});

// DELETE staff member
router.delete('/:id', async (req, res) => {
  try {
    const staffId = req.params.id;
    const deletedStaff = await Staff.findByIdAndDelete(staffId);

    if (!deletedStaff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    res.json({
      success: true,
      message: 'Staff member deleted successfully',
      data: deletedStaff
    });
  } catch (error) {
    console.error('Error deleting staff member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete staff member',
      error: error.message
    });
  }
});

// GET staff statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const totalStaff = await Staff.countDocuments();
    const activeStaff = await Staff.countDocuments({ status: 'active' });
    const inactiveStaff = await Staff.countDocuments({ status: 'inactive' });
    const pendingStaff = await Staff.countDocuments({ status: 'pending' });

    // Get staff by role
    const staffByRole = await Staff.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get staff by department
    const staffByDepartment = await Staff.aggregate([
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        totalStaff,
        activeStaff,
        inactiveStaff,
        pendingStaff,
        staffByRole,
        staffByDepartment
      }
    });
  } catch (error) {
    console.error('Error fetching staff statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff statistics',
      error: error.message
    });
  }
});

// GET staff by role
router.get('/role/:role', async (req, res) => {
  try {
    const role = req.params.role;
    const staff = await Staff.find({ role: role }).sort({ name: 1 });
    
    res.json({
      success: true,
      data: staff,
      count: staff.length
    });
  } catch (error) {
    console.error('Error fetching staff by role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff by role',
      error: error.message
    });
  }
});

// GET staff by department
router.get('/department/:department', async (req, res) => {
  try {
    const department = req.params.department;
    const staff = await Staff.find({ department: department }).sort({ name: 1 });
    
    res.json({
      success: true,
      data: staff,
      count: staff.length
    });
  } catch (error) {
    console.error('Error fetching staff by department:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff by department',
      error: error.message
    });
  }
});

export default router;













































































