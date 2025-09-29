import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateEnhanced, requirePermission } from '../middleware/authEnhanced.js';
import { asyncHandler } from '../middleware/validate.js';
import logger from '../utils/logger.js';

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Dashboard route configuration
const DASHBOARD_CONFIG = {
  executive: {
    title: 'Executive Dashboard',
    description: 'Business intelligence and real-time analytics',
    roles: ['admin', 'super_admin', 'manager'],
    template: 'executive-dashboard.ejs'
  },
  customer: {
    title: 'Customer Portal',
    description: 'Order tracking and account management',
    roles: ['customer', 'admin', 'super_admin'],
    template: 'customer-portal.ejs'
  },
  driver: {
    title: 'Driver Dashboard',
    description: 'Delivery management and performance tracking',
    roles: ['staff', 'admin', 'super_admin', 'manager'],
    template: 'driver-dashboard.ejs'
  },
  financial: {
    title: 'Financial Analytics',
    description: 'Financial reporting and business analysis',
    roles: ['admin', 'super_admin', 'manager'],
    template: 'financial-dashboard.ejs'
  },
  predictive: {
    title: 'Predictive Analytics',
    description: 'AI-powered forecasting and insights',
    roles: ['admin', 'super_admin', 'manager'],
    template: 'predictive-dashboard.ejs'
  }
};

// Middleware to validate dashboard access
const validateDashboardAccess = (dashboardType) => {
  return asyncHandler(async (req, res, next) => {
    const config = DASHBOARD_CONFIG[dashboardType];
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found'
      });
    }

    // Check if user has required role
    const userRole = req.user.role;
    if (!config.roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Insufficient permissions for this dashboard'
      });
    }

    req.dashboardConfig = config;
    next();
  });
};

// GET /api/dashboards - Dashboard portal (HTML) or JSON list
router.get('/', authenticateEnhanced, asyncHandler(async (req, res) => {
  const userRole = req.user.role;
  
  // Filter dashboards based on user role
  const availableDashboards = Object.entries(DASHBOARD_CONFIG)
    .filter(([key, config]) => config.roles.includes(userRole))
    .map(([key, config]) => ({
      id: key,
      title: config.title,
      description: config.description,
      url: `/api/dashboards/${key}`
    }));

  logger.info('Dashboard list requested', {
    userId: req.user.id,
    userRole,
    availableDashboards: availableDashboards.length
  });

  // Check if request wants HTML (from browser) or JSON (from API)
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    // Render dashboard portal page
    res.render('dashboard-portal', {
      dashboards: availableDashboards,
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role
      }
    });
  } else {
    // Return JSON for API calls
    res.json({
      success: true,
      data: {
        dashboards: availableDashboards,
        user: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role
        }
      }
    });
  }
}));

// GET /api/dashboards/:type - Render specific dashboard
router.get('/:type', 
  authenticateEnhanced, 
  validateDashboardAccess(req => req.params.type),
  asyncHandler(async (req, res) => {
    const { type } = req.params;
    const config = req.dashboardConfig;
    const user = req.user;

    logger.info('Dashboard accessed', {
      userId: user.id,
      userRole: user.role,
      dashboardType: type
    });

    // Prepare dashboard data based on type
    let dashboardData = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      config,
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001/api',
      socketUrl: process.env.SOCKET_URL || 'http://localhost:3001'
    };

    // Add type-specific data
    switch (type) {
      case 'executive':
        dashboardData.executiveData = await getExecutiveDashboardData(user);
        break;
      case 'customer':
        dashboardData.customerData = await getCustomerDashboardData(user);
        break;
      case 'driver':
        dashboardData.driverData = await getDriverDashboardData(user);
        break;
      case 'financial':
        dashboardData.financialData = await getFinancialDashboardData(user);
        break;
      case 'predictive':
        dashboardData.predictiveData = await getPredictiveDashboardData(user);
        break;
    }

    // Render dashboard template
    res.render(config.template, dashboardData);
  })
);

// Helper functions to get dashboard-specific data
async function getExecutiveDashboardData(user) {
  try {
    // Import necessary models and services
    const Order = (await import('../models/Order.js')).default;
    const User = (await import('../models/User.js')).default;
    const Payment = (await import('../models/Payment.js')).default;

    // Get today's date range
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Get yesterday's date range for comparison
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    const endOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate() + 1);

    // Fetch real data
    const [
      todayOrders,
      yesterdayOrders,
      todayRevenue,
      yesterdayRevenue,
      newCustomersToday,
      newCustomersYesterday,
      totalCustomers,
      recentOrders
    ] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: startOfDay, $lt: endOfDay } }),
      Order.countDocuments({ createdAt: { $gte: startOfYesterday, $lt: endOfYesterday } }),
      Order.aggregate([
        { $match: { createdAt: { $gte: startOfDay, $lt: endOfDay }, status: { $in: ['delivered', 'completed'] } } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: startOfYesterday, $lt: endOfYesterday }, status: { $in: ['delivered', 'completed'] } } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]),
      User.countDocuments({ createdAt: { $gte: startOfDay, $lt: endOfDay } }),
      User.countDocuments({ createdAt: { $gte: startOfYesterday, $lt: endOfYesterday } }),
      User.countDocuments(),
      Order.find()
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('userId', 'name email')
    ]);

    // Calculate metrics
    const todayRevenueTotal = todayRevenue[0]?.total || 0;
    const yesterdayRevenueTotal = yesterdayRevenue[0]?.total || 0;
    const revenueGrowth = yesterdayRevenueTotal > 0 ? 
      ((todayRevenueTotal - yesterdayRevenueTotal) / yesterdayRevenueTotal) * 100 : 0;

    const ordersGrowth = yesterdayOrders > 0 ? 
      ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100 : 0;

    const customersGrowth = newCustomersYesterday > 0 ? 
      ((newCustomersToday - newCustomersYesterday) / newCustomersYesterday) * 100 : 0;

    // Generate revenue chart data (last 7 days)
    const revenueChart = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      
      const dayRevenue = await Order.aggregate([
        { $match: { createdAt: { $gte: startDate, $lt: endDate }, status: { $in: ['delivered', 'completed'] } } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]);
      
      revenueChart.push({
        date: date.toISOString().split('T')[0],
        value: dayRevenue[0]?.total || 0
      });
    }

    // Get order status distribution
    const orderStatusCounts = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const statusMap = { pending: 0, preparing: 1, out_for_delivery: 2, delivered: 3 };
    const orderStatusData = [0, 0, 0, 0];
    orderStatusCounts.forEach(status => {
      const index = statusMap[status._id];
      if (index !== undefined) {
        orderStatusData[index] = status.count;
      }
    });

    return {
      lastUpdated: new Date().toISOString(),
      metrics: {
        revenue: {
          total: todayRevenueTotal,
          growth: revenueGrowth,
          trend: revenueGrowth >= 0 ? 'up' : 'down'
        },
        orders: {
          total: todayOrders,
          pending: orderStatusData[0],
          completed: orderStatusData[3],
          growth: ordersGrowth
        },
        customers: {
          total: totalCustomers,
          new: newCustomersToday,
          active: totalCustomers, // This could be refined with login activity
          growth: customersGrowth
        },
        growth: revenueGrowth
      },
      charts: {
        revenue: revenueChart,
        orders: orderStatusData,
        customers: []
      },
      recentActivity: recentOrders.slice(0, 10).map(order => ({
        id: order._id,
        customer: order.userId?.name || 'Unknown',
        amount: order.total,
        status: order.status,
        date: order.createdAt
      }))
    };
  } catch (error) {
    logger.error('Error fetching executive dashboard data', error);
    return { 
      error: 'Failed to load dashboard data',
      metrics: {
        revenue: { total: 0, growth: 0, trend: 'up' },
        orders: { total: 0, pending: 0, completed: 0, growth: 0 },
        customers: { total: 0, new: 0, active: 0, growth: 0 },
        growth: 0
      },
      charts: {
        revenue: [],
        orders: [0, 0, 0, 0],
        customers: []
      }
    };
  }
}

async function getCustomerDashboardData(user) {
  try {
    // This will integrate with your existing order and wallet endpoints
    return {
      orders: [],
      wallet: {
        balance: 0,
        transactions: []
      },
      subscriptions: [],
      preferences: {}
    };
  } catch (error) {
    logger.error('Error fetching customer dashboard data', error);
    return { error: 'Failed to load customer data' };
  }
}

async function getDriverDashboardData(user) {
  try {
    // This will integrate with your existing delivery endpoints
    return {
      todayStats: {
        deliveries: 0,
        earnings: 0,
        rating: 0,
        efficiency: 0
      },
      activeOrders: [],
      route: {
        current: null,
        optimized: []
      },
      schedule: []
    };
  } catch (error) {
    logger.error('Error fetching driver dashboard data', error);
    return { error: 'Failed to load driver data' };
  }
}

async function getFinancialDashboardData(user) {
  try {
    // This will integrate with your existing financial endpoints
    return {
      summary: {
        revenue: 0,
        expenses: 0,
        profit: 0,
        margin: 0
      },
      trends: {
        revenue: [],
        expenses: [],
        profit: []
      },
      reports: [],
      kpis: {}
    };
  } catch (error) {
    logger.error('Error fetching financial dashboard data', error);
    return { error: 'Failed to load financial data' };
  }
}

async function getPredictiveDashboardData(user) {
  try {
    // This will integrate with your existing predictive analytics endpoints
    return {
      predictions: {
        demand: {
          value: 0,
          confidence: 0,
          trend: 'up'
        },
        revenue: {
          value: 0,
          confidence: 0,
          timeline: '30d'
        },
        churn: {
          risk: 'low',
          customers: 0,
          actions: []
        }
      },
      insights: [],
      scenarios: {
        optimistic: 0,
        realistic: 0,
        pessimistic: 0
      }
    };
  } catch (error) {
    logger.error('Error fetching predictive dashboard data', error);
    return { error: 'Failed to load predictive data' };
  }
}

// API endpoint to get dashboard data as JSON (for AJAX updates)
router.get('/:type/data', 
  authenticateEnhanced, 
  validateDashboardAccess(req => req.params.type),
  asyncHandler(async (req, res) => {
    const { type } = req.params;
    const user = req.user;

    let data = {};

    switch (type) {
      case 'executive':
        data = await getExecutiveDashboardData(user);
        break;
      case 'customer':
        data = await getCustomerDashboardData(user);
        break;
      case 'driver':
        data = await getDriverDashboardData(user);
        break;
      case 'financial':
        data = await getFinancialDashboardData(user);
        break;
      case 'predictive':
        data = await getPredictiveDashboardData(user);
        break;
      default:
        return res.status(404).json({
          success: false,
          message: 'Dashboard type not found'
        });
    }

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  })
);

export default router;
