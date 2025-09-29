import express from 'express';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Outlet from '../models/Outlet.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import { cacheAnalytics, invalidateAnalytics } from '../middleware/cache.js';

const router = express.Router();

// @desc    Get analytics overview
// @route   GET /api/analytics
// @access  Public
router.get('/', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Analytics API is working',
      endpoints: {
        revenue: '/api/analytics/revenue',
        products: '/api/analytics/products',
        outlets: '/api/analytics/outlets',
        summary: '/api/analytics/summary'
      }
    });
  } catch (error) {
    console.error('Error in analytics route:', error);
    res.status(500).json({
      success: false,
      message: 'Analytics API error'
    });
  }
});

// @desc    Get revenue analytics
// @route   GET /api/analytics/revenue
// @access  Public (temporarily for dashboard testing)
router.get('/revenue', cacheAnalytics, async (req, res) => {
  try {
    // Get orders from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const orders = await Order.find({
      createdAt: { $gte: thirtyDaysAgo }
    }).populate('items.product');
    
    // Calculate daily revenue
    const dailyRevenue = {};
    const today = new Date();
    
    // Initialize last 30 days with 0 revenue
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyRevenue[dateStr] = 0;
    }
    
    // Calculate actual revenue
    orders.forEach(order => {
      const orderDate = order.createdAt.toISOString().split('T')[0];
      if (dailyRevenue[orderDate] !== undefined) {
        dailyRevenue[orderDate] += order.totalAmount || 0;
      }
    });
    
    // Convert to array format for charts
    const revenueData = Object.entries(dailyRevenue).map(([date, revenue]) => ({
      date,
      revenue
    }));
    
    // Calculate totals
    const totalRevenue = Object.values(dailyRevenue).reduce((sum, revenue) => sum + revenue, 0);
    const averageDailyRevenue = totalRevenue / 30;
    
    return sendSuccess(res, {
      message: 'Revenue analytics retrieved successfully',
      data: {
        dailyRevenue: revenueData,
        totalRevenue,
        averageDailyRevenue,
        orderCount: orders.length
      }
    });
  } catch (error) {
    console.error('Error fetching revenue analytics:', error);
    return sendError(res, {
      statusCode: 500,
      message: 'Error fetching revenue analytics',
      code: 'ANALYTICS_ERROR'
    });
  }
});

// @desc    Get product performance analytics
// @route   GET /api/analytics/products
// @access  Public (temporarily for dashboard testing)
router.get('/products', cacheAnalytics, async (req, res) => {
  try {
    const products = await Product.find({});
    
    // Get orders to calculate product performance
    const orders = await Order.find({}).populate('items.product');
    
    // Calculate product performance
    const productPerformance = products.map(product => {
      const productOrders = orders.filter(order => 
        order.items.some(item => item.product._id.toString() === product._id.toString())
      );
      
      const totalSold = productOrders.reduce((sum, order) => {
        const item = order.items.find(item => item.product._id.toString() === product._id.toString());
        return sum + (item ? item.quantity : 0);
      }, 0);
      
      const totalRevenue = productOrders.reduce((sum, order) => {
        const item = order.items.find(item => item.product._id.toString() === product._id.toString());
        return sum + (item ? item.price * item.quantity : 0);
      }, 0);
      
      return {
        _id: product._id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: product.price,
        stockLevel: product.stockLevel,
        totalSold,
        totalRevenue,
        averageRating: 4.5, // Placeholder
        image: product.image
      };
    });
    
    // Sort by revenue (best performing first)
    productPerformance.sort((a, b) => b.totalRevenue - a.totalRevenue);
    
    return sendSuccess(res, {
      message: 'Product analytics retrieved successfully',
      data: productPerformance
    });
  } catch (error) {
    console.error('Error fetching product analytics:', error);
    return sendError(res, {
      statusCode: 500,
      message: 'Error fetching product analytics',
      code: 'ANALYTICS_ERROR'
    });
  }
});

// @desc    Get outlet performance analytics
// @route   GET /api/analytics/outlets
// @access  Public (temporarily for dashboard testing)
router.get('/outlets', cacheAnalytics, async (req, res) => {
  try {
    const outlets = await Outlet.find({});
    const orders = await Order.find({}).populate('outlet');
    
    const outletPerformance = outlets.map(outlet => {
      const outletOrders = orders.filter(order => 
        order.outlet && order.outlet._id.toString() === outlet._id.toString()
      );
      
      const totalOrders = outletOrders.length;
      const totalRevenue = outletOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      
      return {
        _id: outlet._id,
        name: outlet.name,
        address: outlet.address,
        phone: outlet.phone,
        email: outlet.email,
        isActive: outlet.isActive,
        totalOrders,
        totalRevenue,
        averageOrderValue
      };
    });
    
    // Sort by revenue (best performing first)
    outletPerformance.sort((a, b) => b.totalRevenue - a.totalRevenue);
    
    return sendSuccess(res, {
      message: 'Outlet analytics retrieved successfully',
      data: outletPerformance
    });
  } catch (error) {
    console.error('Error fetching outlet analytics:', error);
    return sendError(res, {
      statusCode: 500,
      message: 'Error fetching outlet analytics',
      code: 'ANALYTICS_ERROR'
    });
  }
});

// @desc    Get dashboard summary analytics
// @route   GET /api/analytics/summary
// @access  Public (temporarily for dashboard testing)
router.get('/summary', cacheAnalytics, async (req, res) => {
  try {
    const [products, outlets, orders] = await Promise.all([
      Product.find({}),
      Outlet.find({}),
      Order.find({})
    ]);
    
    // Calculate summary metrics
    const totalProducts = products.length;
    const totalOutlets = outlets.length;
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // Low stock products (less than 20 units)
    const lowStockProducts = products.filter(product => product.stockLevel < 20);
    
    // Recent orders (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentOrders = orders.filter(order => order.createdAt >= sevenDaysAgo);
    
    return sendSuccess(res, {
      message: 'Summary analytics retrieved successfully',
      data: {
        totalProducts,
        totalOutlets,
        totalOrders,
        totalRevenue,
        averageOrderValue,
        lowStockProducts: lowStockProducts.length,
        recentOrders: recentOrders.length,
        topPerformingProduct: products[0]?.name || 'N/A',
        topPerformingOutlet: outlets[0]?.name || 'N/A'
      }
    });
  } catch (error) {
    console.error('Error fetching summary analytics:', error);
    return sendError(res, {
      statusCode: 500,
      message: 'Error fetching summary analytics',
      code: 'ANALYTICS_ERROR'
    });
  }
});

export default router; 