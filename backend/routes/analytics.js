import express from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Outlet from '../models/Outlet.js';
import StockMovement from '../models/StockMovement.js';
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

// @desc    Get theft detection - money theft
// @route   GET /api/analytics/theft/money
// @access  Public (temporarily for dashboard testing)
router.get('/theft/money', async (req, res) => {
  try {
    const orders = await Order.find({}).populate('items.product');
    
    // Cash register discrepancies - find orders with unusual patterns
    const cashDiscrepancies = [];
    const paymentAnomalies = [];
    const transactionMonitoring = [];
    
    // Check for cancelled orders that were delivered
    const cancelledOrders = await Order.find({ status: 'cancelled' });
    cancelledOrders.forEach(order => {
      if (order.deliveryStatus === 'delivered') {
        cashDiscrepancies.push({
          type: 'Cancelled but Delivered',
          orderId: order._id,
          amount: order.totalAmount,
          date: order.createdAt,
          severity: 'high'
        });
      }
    });
    
    // Check for large cash transactions
    const largeCashOrders = await Order.find({
      paymentMethod: 'cash',
      totalAmount: { $gt: 10000 }
    }).sort({ totalAmount: -1 }).limit(10);
    
    largeCashOrders.forEach(order => {
      paymentAnomalies.push({
        type: 'Large Cash Transaction',
        orderId: order._id,
        amount: order.totalAmount,
        date: order.createdAt,
        severity: 'medium'
      });
    });
    
    // Check for multiple refunds
    const refundOrders = await Order.find({ status: 'refunded' });
    if (refundOrders.length > 0) {
      const refundCount = refundOrders.length;
      if (refundCount > 5) {
        transactionMonitoring.push({
          type: 'High Refund Rate',
          count: refundCount,
          severity: 'high',
          message: `${refundCount} refunded orders detected`
        });
      }
    }
    
    // Check for orders outside business hours (8 AM - 8 PM)
    const suspiciousTimeOrders = await Order.find({}).then(orders => {
      return orders.filter(order => {
        const orderHour = new Date(order.createdAt).getHours();
        return orderHour < 8 || orderHour > 20;
      });
    });
    
    if (suspiciousTimeOrders.length > 0) {
      transactionMonitoring.push({
        type: 'Orders Outside Business Hours',
        count: suspiciousTimeOrders.length,
        severity: 'medium',
        message: `${suspiciousTimeOrders.length} orders placed outside normal hours`
      });
    }
    
    return sendSuccess(res, {
      message: 'Money theft detection data retrieved successfully',
      data: {
        cashDiscrepancies,
        paymentAnomalies,
        transactionMonitoring,
        totalAlerts: cashDiscrepancies.length + paymentAnomalies.length + transactionMonitoring.length
      }
    });
  } catch (error) {
    console.error('Error fetching money theft data:', error);
    return sendError(res, {
      statusCode: 500,
      message: 'Error fetching money theft data',
      code: 'THEFT_DETECTION_ERROR'
    });
  }
});

// @desc    Get theft detection - stock theft
// @route   GET /api/analytics/theft/stock
// @access  Public (temporarily for dashboard testing)
router.get('/theft/stock', async (req, res) => {
  try {
    const products = await Product.find({});
    const orders = await Order.find({}).populate('items.product');
    const stockMovements = await StockMovement.find({}).catch(() => []);
    
    const inventoryDiscrepancies = [];
    const deliveryMonitoring = [];
    const warehouseAlerts = [];
    
    // Check for negative stock levels
    products.forEach(product => {
      if (product.stockLevel < 0) {
        inventoryDiscrepancies.push({
          type: 'Negative Stock',
          productId: product._id,
          productName: product.name,
          stockLevel: product.stockLevel,
          severity: 'high'
        });
      }
    });
    
    // Check for products sold more than available
    orders.forEach(order => {
      order.items.forEach(item => {
        const product = products.find(p => p._id.toString() === item.product._id.toString());
        if (product && item.quantity > product.stockLevel) {
          inventoryDiscrepancies.push({
            type: 'Over-sold Product',
            productId: product._id,
            productName: product.name,
            sold: item.quantity,
            available: product.stockLevel,
            orderId: order._id,
            severity: 'high'
          });
        }
      });
    });
    
    // Check for orders marked delivered but not confirmed
    const unconfirmedDeliveries = await Order.find({
      deliveryStatus: 'delivered',
      status: { $ne: 'completed' }
    });
    
    unconfirmedDeliveries.forEach(order => {
      deliveryMonitoring.push({
        type: 'Unconfirmed Delivery',
        orderId: order._id,
        amount: order.totalAmount,
        date: order.createdAt,
        severity: 'medium'
      });
    });
    
    // Check for missing stock movements
    if (stockMovements && stockMovements.length > 0) {
      const unauthorizedMovements = stockMovements.filter(movement => 
        !movement.authorizedBy || movement.status === 'pending'
      );
      
      unauthorizedMovements.forEach(movement => {
        warehouseAlerts.push({
          type: 'Unauthorized Stock Movement',
          movementId: movement._id,
          product: movement.product,
          quantity: movement.quantity,
          date: movement.date,
          severity: 'high'
        });
      });
    }
    
    return sendSuccess(res, {
      message: 'Stock theft detection data retrieved successfully',
      data: {
        inventoryDiscrepancies,
        deliveryMonitoring,
        warehouseAlerts,
        totalAlerts: inventoryDiscrepancies.length + deliveryMonitoring.length + warehouseAlerts.length
      }
    });
  } catch (error) {
    console.error('Error fetching stock theft data:', error);
    return sendError(res, {
      statusCode: 500,
      message: 'Error fetching stock theft data',
      code: 'THEFT_DETECTION_ERROR'
    });
  }
});

// @desc    Get theft detection - anomalies
// @route   GET /api/analytics/theft/anomalies
// @access  Public (temporarily for dashboard testing)
router.get('/theft/anomalies', async (req, res) => {
  try {
    const orders = await Order.find({});
    const anomalies = [];
    
    // Check for duplicate transactions
    const orderGroups = {};
    orders.forEach(order => {
      const key = `${order.totalAmount}-${order.customerEmail || order.customerPhone}`;
      if (!orderGroups[key]) {
        orderGroups[key] = [];
      }
      orderGroups[key].push(order);
    });
    
    Object.values(orderGroups).forEach(group => {
      if (group.length > 1) {
        const timeDiff = Math.abs(new Date(group[1].createdAt) - new Date(group[0].createdAt));
        if (timeDiff < 60000) { // Within 1 minute
          anomalies.push({
            type: 'Duplicate Transaction',
            orders: group.map(o => o._id),
            amount: group[0].totalAmount,
            severity: 'high'
          });
        }
      }
    });
    
    // Check for unusual discount patterns
    const highDiscountOrders = orders.filter(order => {
      if (order.discount && order.totalAmount) {
        const discountPercent = (order.discount / (order.totalAmount + order.discount)) * 100;
        return discountPercent > 50;
      }
      return false;
    });
    
    if (highDiscountOrders.length > 0) {
      anomalies.push({
        type: 'High Discount Orders',
        count: highDiscountOrders.length,
        severity: 'medium',
        message: `${highDiscountOrders.length} orders with >50% discount`
      });
    }
    
    return sendSuccess(res, {
      message: 'Anomalies data retrieved successfully',
      data: {
        anomalies,
        totalAnomalies: anomalies.length
      }
    });
  } catch (error) {
    console.error('Error fetching anomalies:', error);
    return sendError(res, {
      statusCode: 500,
      message: 'Error fetching anomalies',
      code: 'THEFT_DETECTION_ERROR'
    });
  }
});

// @desc    Get business intelligence - sales analytics
// @route   GET /api/analytics/business/sales
// @access  Public (temporarily for dashboard testing)
router.get('/business/sales', async (req, res) => {
  try {
    const orders = await Order.find({});
    const products = await Product.find({});
    
    // Sales trends - last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentOrders = orders.filter(order => order.createdAt >= sevenDaysAgo);
    
    // Peak hours analysis
    const hourCounts = {};
    orders.forEach(order => {
      const hour = new Date(order.createdAt).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    const peakHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }));
    
    // Top products
    const productSales = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        const productId = item.product.toString();
        if (!productSales[productId]) {
          productSales[productId] = { quantity: 0, revenue: 0 };
        }
        productSales[productId].quantity += item.quantity;
        productSales[productId].revenue += item.price * item.quantity;
      });
    });
    
    const topProducts = Object.entries(productSales)
      .map(([productId, data]) => {
        const product = products.find(p => p._id.toString() === productId);
        return {
          productId,
          productName: product ? product.name : 'Unknown',
          quantity: data.quantity,
          revenue: data.revenue
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    
    return sendSuccess(res, {
      message: 'Sales analytics retrieved successfully',
      data: {
        salesTrends: {
          last7Days: recentOrders.length,
          totalRevenue: recentOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
        },
        peakHours,
        topProducts
      }
    });
  } catch (error) {
    console.error('Error fetching sales analytics:', error);
    return sendError(res, {
      statusCode: 500,
      message: 'Error fetching sales analytics',
      code: 'ANALYTICS_ERROR'
    });
  }
});

// @desc    Get business intelligence - inventory management
// @route   GET /api/analytics/business/inventory
// @access  Public (temporarily for dashboard testing)
router.get('/business/inventory', async (req, res) => {
  try {
    const products = await Product.find({});
    const orders = await Order.find({}).populate('items.product');
    
    // Stock turnover calculation
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentOrders = orders.filter(order => order.createdAt >= thirtyDaysAgo);
    
    const productTurnover = products.map(product => {
      const sold = recentOrders.reduce((sum, order) => {
        const item = order.items.find(i => i.product._id.toString() === product._id.toString());
        return sum + (item ? item.quantity : 0);
      }, 0);
      
      const turnoverRate = product.stockLevel > 0 ? (sold / product.stockLevel) * 100 : 0;
      
      return {
        productId: product._id,
        productName: product.name,
        stockLevel: product.stockLevel,
        sold,
        turnoverRate: turnoverRate.toFixed(2)
      };
    }).sort((a, b) => b.turnoverRate - a.turnoverRate);
    
    // Reorder alerts
    const reorderAlerts = products.filter(p => p.stockLevel < 20).map(p => ({
      productId: p._id,
      productName: p.name,
      stockLevel: p.stockLevel,
      recommendedOrder: 50
    }));
    
    // Dead stock (no sales in 30 days)
    const deadStock = products.filter(product => {
      const hasSales = recentOrders.some(order =>
        order.items.some(item => item.product._id.toString() === product._id.toString())
      );
      return !hasSales && product.stockLevel > 0;
    }).map(p => ({
      productId: p._id,
      productName: p.name,
      stockLevel: p.stockLevel,
      lastSale: 'No sales in 30 days'
    }));
    
    return sendSuccess(res, {
      message: 'Inventory analytics retrieved successfully',
      data: {
        stockTurnover: productTurnover.slice(0, 10),
        reorderAlerts,
        deadStock
      }
    });
  } catch (error) {
    console.error('Error fetching inventory analytics:', error);
    return sendError(res, {
      statusCode: 500,
      message: 'Error fetching inventory analytics',
      code: 'ANALYTICS_ERROR'
    });
  }
});

// @desc    Get business intelligence - financial analytics
// @route   GET /api/analytics/business/financial
// @access  Public (temporarily for dashboard testing)
router.get('/business/financial', async (req, res) => {
  try {
    const orders = await Order.find({}).populate('items.product');
    const products = await Product.find({});
    
    // Profit margins by product
    const profitMargins = products.map(product => {
      const productOrders = orders.filter(order =>
        order.items.some(item => item.product._id.toString() === product._id.toString())
      );
      
      const totalRevenue = productOrders.reduce((sum, order) => {
        const item = order.items.find(i => i.product._id.toString() === product._id.toString());
        return sum + (item ? item.price * item.quantity : 0);
      }, 0);
      
      // Assume 30% cost (you can adjust this based on actual cost data)
      const estimatedCost = totalRevenue * 0.3;
      const profit = totalRevenue - estimatedCost;
      const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
      
      return {
        productId: product._id,
        productName: product.name,
        revenue: totalRevenue,
        estimatedCost,
        profit,
        margin: margin.toFixed(2)
      };
    }).sort((a, b) => b.margin - a.margin);
    
    // Revenue forecasting (simple trend)
    const last30Days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayOrders = orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate.toDateString() === date.toDateString();
      });
      last30Days.push({
        date: date.toISOString().split('T')[0],
        revenue: dayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
      });
    }
    
    const avgDailyRevenue = last30Days.reduce((sum, day) => sum + day.revenue, 0) / 30;
    const forecast30Days = avgDailyRevenue * 30;
    
    return sendSuccess(res, {
      message: 'Financial analytics retrieved successfully',
      data: {
        profitMargins: profitMargins.slice(0, 10),
        revenueForecast: {
          next30Days: forecast30Days,
          averageDaily: avgDailyRevenue
        },
        costAnalysis: {
          totalRevenue: orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
          estimatedCosts: orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0) * 0.3,
          estimatedProfit: orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0) * 0.7
        }
      }
    });
  } catch (error) {
    console.error('Error fetching financial analytics:', error);
    return sendError(res, {
      statusCode: 500,
      message: 'Error fetching financial analytics',
      code: 'ANALYTICS_ERROR'
    });
  }
});

// @desc    Get business intelligence - operational metrics
// @route   GET /api/analytics/business/operational
// @access  Public (temporarily for dashboard testing)
router.get('/business/operational', async (req, res) => {
  try {
    const orders = await Order.find({});
    
    // Order fulfillment time
    const fulfilledOrders = orders.filter(o => o.deliveryStatus === 'delivered');
    const fulfillmentTimes = fulfilledOrders.map(order => {
      if (order.createdAt && order.deliveredAt) {
        return Math.abs(new Date(order.deliveredAt) - new Date(order.createdAt)) / (1000 * 60 * 60); // hours
      }
      return null;
    }).filter(time => time !== null);
    
    const avgFulfillmentTime = fulfillmentTimes.length > 0
      ? fulfillmentTimes.reduce((sum, time) => sum + time, 0) / fulfillmentTimes.length
      : 0;
    
    // Delivery performance
    const deliveryStats = {
      total: orders.length,
      delivered: orders.filter(o => o.deliveryStatus === 'delivered').length,
      pending: orders.filter(o => o.deliveryStatus === 'pending').length,
      failed: orders.filter(o => o.deliveryStatus === 'failed').length
    };
    
    const deliverySuccessRate = deliveryStats.total > 0
      ? (deliveryStats.delivered / deliveryStats.total) * 100
      : 0;
    
    // Staff productivity (placeholder - would need staff data)
    const staffProductivity = {
      message: 'Staff productivity data requires staff assignment tracking',
      ordersPerStaff: deliveryStats.delivered / 5 // Assuming 5 staff members
    };
    
    return sendSuccess(res, {
      message: 'Operational metrics retrieved successfully',
      data: {
        orderFulfillment: {
          averageTime: avgFulfillmentTime.toFixed(2),
          unit: 'hours'
        },
        deliveryPerformance: {
          ...deliveryStats,
          successRate: deliverySuccessRate.toFixed(2)
        },
        staffProductivity
      }
    });
  } catch (error) {
    console.error('Error fetching operational metrics:', error);
    return sendError(res, {
      statusCode: 500,
      message: 'Error fetching operational metrics',
      code: 'ANALYTICS_ERROR'
    });
  }
});

// @desc    Get business intelligence - customer insights
// @route   GET /api/analytics/business/customer
// @access  Public (temporarily for dashboard testing)
router.get('/business/customer', async (req, res) => {
  try {
    const orders = await Order.find({});
    
    // Customer segmentation
    const customerOrders = {};
    orders.forEach(order => {
      const customerId = order.customerEmail || order.customerPhone || 'anonymous';
      if (!customerOrders[customerId]) {
        customerOrders[customerId] = {
          orderCount: 0,
          totalSpent: 0,
          orders: []
        };
      }
      customerOrders[customerId].orderCount++;
      customerOrders[customerId].totalSpent += order.totalAmount || 0;
      customerOrders[customerId].orders.push(order);
    });
    
    const segments = {
      vip: Object.values(customerOrders).filter(c => c.totalSpent > 50000).length,
      regular: Object.values(customerOrders).filter(c => c.totalSpent > 10000 && c.totalSpent <= 50000).length,
      new: Object.values(customerOrders).filter(c => c.orderCount === 1).length
    };
    
    // Repeat purchase patterns
    const repeatCustomers = Object.values(customerOrders).filter(c => c.orderCount > 1);
    const repeatRate = orders.length > 0 ? (repeatCustomers.length / Object.keys(customerOrders).length) * 100 : 0;
    
    // Geographic sales (placeholder)
    const geographicSales = {
      message: 'Geographic data requires address/location tracking in orders'
    };
    
    return sendSuccess(res, {
      message: 'Customer insights retrieved successfully',
      data: {
        customerSegmentation: segments,
        repeatPurchases: {
          repeatCustomers: repeatCustomers.length,
          repeatRate: repeatRate.toFixed(2)
        },
        geographicSales
      }
    });
  } catch (error) {
    console.error('Error fetching customer insights:', error);
    return sendError(res, {
      statusCode: 500,
      message: 'Error fetching customer insights',
      code: 'ANALYTICS_ERROR'
    });
  }
});

export default router; 