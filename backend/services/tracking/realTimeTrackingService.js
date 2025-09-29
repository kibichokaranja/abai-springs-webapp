import { Server } from 'socket.io';
import EnhancedOrder from '../../models/Order.enhanced.js';
import User from '../../models/User.js';
import notificationService from '../notificationService.js';
import cacheManager from '../../utils/cache.js';
import logger from '../../utils/logger.js';

class RealTimeTrackingService {
  constructor() {
    this.io = null;
    this.trackingIntervals = new Map();
    this.geoFences = new Map();
    this.deliveryEstimates = new Map();
  }

  // Initialize Socket.IO server
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    this.setupSocketHandlers();
    this.startTrackingServices();
    
    logger.info('Real-time tracking service initialized');
  }

  // Setup Socket.IO event handlers
  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      logger.info('Client connected to tracking service', { socketId: socket.id });

      // Customer joins order tracking room
      socket.on('track_order', async (data) => {
        try {
          const { orderId, userId } = data;
          
          // Verify user has permission to track this order
          const order = await EnhancedOrder.findById(orderId);
          if (!order) {
            socket.emit('tracking_error', { message: 'Order not found' });
            return;
          }

          if (order.customer.toString() !== userId) {
            socket.emit('tracking_error', { message: 'Unauthorized to track this order' });
            return;
          }

          // Join order tracking room
          socket.join(`order_${orderId}`);
          
          // Send current order status
          const trackingData = await this.getOrderTrackingData(orderId);
          socket.emit('order_status_update', trackingData);
          
          logger.info('Customer joined order tracking', { orderId, userId, socketId: socket.id });
        } catch (error) {
          logger.error('Error in track_order handler:', error);
          socket.emit('tracking_error', { message: 'Failed to start tracking' });
        }
      });

      // Driver location updates
      socket.on('driver_location_update', async (data) => {
        try {
          const { orderId, location, driverId } = data;
          
          // Verify driver is assigned to this order
          const order = await EnhancedOrder.findById(orderId);
          if (!order || order.driverAssignment?.driver?.toString() !== driverId) {
            socket.emit('tracking_error', { message: 'Unauthorized location update' });
            return;
          }

          await this.updateDriverLocation(orderId, location, driverId);
          
        } catch (error) {
          logger.error('Error in driver_location_update handler:', error);
          socket.emit('tracking_error', { message: 'Failed to update location' });
        }
      });

      // Driver status updates
      socket.on('driver_status_update', async (data) => {
        try {
          const { orderId, status, driverId, notes } = data;
          
          const order = await EnhancedOrder.findById(orderId);
          if (!order || order.driverAssignment?.driver?.toString() !== driverId) {
            socket.emit('tracking_error', { message: 'Unauthorized status update' });
            return;
          }

          await this.updateOrderStatus(orderId, status, notes, driverId);
          
        } catch (error) {
          logger.error('Error in driver_status_update handler:', error);
          socket.emit('tracking_error', { message: 'Failed to update status' });
        }
      });

      // Driver joins order room for real-time communication
      socket.on('driver_join_order', async (data) => {
        try {
          const { orderId, driverId } = data;
          
          const order = await EnhancedOrder.findById(orderId);
          if (!order || order.driverAssignment?.driver?.toString() !== driverId) {
            socket.emit('tracking_error', { message: 'Unauthorized to join order' });
            return;
          }

          socket.join(`order_${orderId}`);
          socket.join(`driver_${driverId}`);
          
          logger.info('Driver joined order tracking', { orderId, driverId, socketId: socket.id });
        } catch (error) {
          logger.error('Error in driver_join_order handler:', error);
        }
      });

      socket.on('disconnect', () => {
        logger.info('Client disconnected from tracking service', { socketId: socket.id });
      });
    });
  }

  // Start background tracking services
  startTrackingServices() {
    // Update delivery estimates every 2 minutes
    setInterval(() => {
      this.updateAllDeliveryEstimates();
    }, 2 * 60 * 1000);

    // Check for overdue deliveries every 5 minutes
    setInterval(() => {
      this.checkOverdueDeliveries();
    }, 5 * 60 * 1000);

    // Clean up old tracking data every hour
    setInterval(() => {
      this.cleanupOldTrackingData();
    }, 60 * 60 * 1000);
  }

  // Update driver location and broadcast to customers
  async updateDriverLocation(orderId, location, driverId) {
    try {
      const order = await EnhancedOrder.findById(orderId);
      if (!order) return;

      // Update driver location in order
      await order.updateDriverLocation(location.lat, location.lng);

      // Check geo-fences
      await this.checkGeoFences(orderId, location);

      // Update ETA
      const newETA = await this.calculateUpdatedETA(orderId, location);
      
      // Prepare tracking update
      const trackingUpdate = {
        orderId: orderId,
        driverLocation: {
          lat: location.lat,
          lng: location.lng,
          heading: location.heading || null,
          speed: location.speed || null,
          accuracy: location.accuracy || null,
          timestamp: new Date()
        },
        estimatedArrival: newETA,
        status: order.status.current
      };

      // Broadcast to all clients tracking this order
      this.io.to(`order_${orderId}`).emit('driver_location_update', trackingUpdate);

      // Store in cache for quick retrieval
      await cacheManager.set(`driver_location:${orderId}`, trackingUpdate, 10 * 60);

      logger.debug('Driver location updated', {
        orderId,
        driverId,
        location: { lat: location.lat, lng: location.lng }
      });

    } catch (error) {
      logger.error('Error updating driver location:', error);
    }
  }

  // Update order status and notify all stakeholders
  async updateOrderStatus(orderId, newStatus, notes = '', updatedBy = null) {
    try {
      const order = await EnhancedOrder.findById(orderId)
        .populate('customer driverAssignment.driver');
      
      if (!order) return;

      const previousStatus = order.status.current;
      
      // Update order status
      await order.updateStatus(newStatus, notes, updatedBy);

      // Prepare status update
      const statusUpdate = {
        orderId: orderId,
        previousStatus: previousStatus,
        currentStatus: newStatus,
        notes: notes,
        timestamp: new Date(),
        estimatedArrival: order.delivery.estimatedArrival
      };

      // Broadcast to all clients
      this.io.to(`order_${orderId}`).emit('order_status_update', statusUpdate);

      // Send notifications based on status
      await this.sendStatusNotifications(order, newStatus, previousStatus);

      // Handle specific status transitions
      await this.handleStatusTransition(order, newStatus, previousStatus);

      logger.info('Order status updated', {
        orderId,
        previousStatus,
        currentStatus: newStatus,
        updatedBy
      });

    } catch (error) {
      logger.error('Error updating order status:', error);
    }
  }

  // Get comprehensive tracking data for an order
  async getOrderTrackingData(orderId) {
    try {
      const order = await EnhancedOrder.findById(orderId)
        .populate('customer outlet driverAssignment.driver items.product');

      if (!order) {
        throw new Error('Order not found');
      }

      // Get current driver location from cache
      const driverLocationData = await cacheManager.get(`driver_location:${orderId}`);

      const trackingData = {
        orderId: orderId,
        orderNumber: order.orderNumber,
        status: {
          current: order.status.current,
          history: order.status.history
        },
        customer: {
          name: order.customer.name,
          phone: order.customer.phone
        },
        outlet: {
          name: order.outlet.name,
          address: order.outlet.address,
          coordinates: order.outlet.coordinates,
          phone: order.outlet.phone
        },
        driver: order.driverAssignment?.driver ? {
          name: order.driverAssignment.driver.name,
          phone: order.driverAssignment.driver.phone,
          currentLocation: driverLocationData?.driverLocation || order.driverAssignment.currentLocation,
          assignedAt: order.driverAssignment.assignedAt
        } : null,
        delivery: {
          address: order.delivery.address,
          coordinates: order.delivery.coordinates,
          instructions: order.delivery.instructions,
          scheduledFor: order.delivery.scheduledFor,
          estimatedArrival: order.delivery.estimatedArrival,
          timeSlot: order.delivery.preferredTimeSlot
        },
        items: order.items.map(item => ({
          product: {
            name: item.product.name,
            image: item.product.images?.[0]
          },
          quantity: item.quantity,
          unitPrice: item.unitPrice
        })),
        pricing: {
          subtotal: order.pricing.subtotal,
          totalAmount: order.pricing.totalAmount
        },
        timeline: this.generateOrderTimeline(order),
        estimatedDeliveryTime: await this.calculateUpdatedETA(orderId, driverLocationData?.driverLocation)
      };

      return trackingData;
    } catch (error) {
      logger.error('Error getting order tracking data:', error);
      throw error;
    }
  }

  // Generate order timeline with estimated and actual times
  generateOrderTimeline(order) {
    const timeline = [];
    const currentTime = new Date();

    // Order placed
    timeline.push({
      status: 'order_placed',
      title: 'Order Placed',
      description: 'Your order has been received',
      timestamp: order.createdAt,
      completed: true,
      icon: 'order'
    });

    // Order confirmed
    const confirmedEvent = order.status.history.find(h => h.status === 'confirmed');
    timeline.push({
      status: 'confirmed',
      title: 'Order Confirmed',
      description: 'Your order has been confirmed and is being prepared',
      timestamp: confirmedEvent?.timestamp,
      completed: !!confirmedEvent,
      estimated: !confirmedEvent ? new Date(order.createdAt.getTime() + 5 * 60000) : null,
      icon: 'confirmed'
    });

    // Preparing
    const preparingEvent = order.status.history.find(h => h.status === 'preparing');
    timeline.push({
      status: 'preparing',
      title: 'Preparing Order',
      description: 'Your water is being prepared for delivery',
      timestamp: preparingEvent?.timestamp,
      completed: !!preparingEvent,
      estimated: !preparingEvent && confirmedEvent ? 
        new Date(confirmedEvent.timestamp.getTime() + (order.business.preparationTime || 30) * 60000) : null,
      icon: 'preparing'
    });

    // Out for delivery
    const outForDeliveryEvent = order.status.history.find(h => h.status === 'out_for_delivery');
    timeline.push({
      status: 'out_for_delivery',
      title: 'Out for Delivery',
      description: 'Your order is on the way',
      timestamp: outForDeliveryEvent?.timestamp,
      completed: !!outForDeliveryEvent,
      estimated: !outForDeliveryEvent && preparingEvent ? 
        new Date(preparingEvent.timestamp.getTime() + 10 * 60000) : null,
      icon: 'delivery'
    });

    // Delivered
    const deliveredEvent = order.status.history.find(h => h.status === 'delivered');
    timeline.push({
      status: 'delivered',
      title: 'Delivered',
      description: 'Your order has been successfully delivered',
      timestamp: deliveredEvent?.timestamp,
      completed: !!deliveredEvent,
      estimated: order.delivery.estimatedArrival,
      icon: 'delivered'
    });

    return timeline;
  }

  // Calculate updated ETA based on current driver location
  async calculateUpdatedETA(orderId, driverLocation) {
    try {
      const order = await EnhancedOrder.findById(orderId);
      if (!order || !order.delivery.coordinates || !driverLocation) {
        return order?.delivery.estimatedArrival || null;
      }

      const distance = this.calculateDistance(
        driverLocation,
        order.delivery.coordinates
      );

      // Average city speed: 25 km/h, considering traffic
      const avgSpeed = 25;
      const travelTimeHours = distance / avgSpeed;
      const travelTimeMinutes = travelTimeHours * 60;

      // Add buffer time based on current traffic conditions
      const bufferMinutes = await this.getTrafficBuffer(driverLocation, order.delivery.coordinates);
      
      const totalTravelTime = travelTimeMinutes + bufferMinutes;
      const newETA = new Date(Date.now() + totalTravelTime * 60000);

      // Update order if ETA changed significantly (>5 minutes difference)
      if (order.delivery.estimatedArrival) {
        const timeDifference = Math.abs(newETA - order.delivery.estimatedArrival) / 60000;
        if (timeDifference > 5) {
          order.delivery.estimatedArrival = newETA;
          await order.save();
          
          // Notify customer of ETA change
          this.io.to(`order_${orderId}`).emit('eta_update', {
            orderId: orderId,
            newETA: newETA,
            estimatedMinutes: Math.round(totalTravelTime)
          });
        }
      }

      return newETA;
    } catch (error) {
      logger.error('Error calculating updated ETA:', error);
      return null;
    }
  }

  // Check if driver has entered specific geo-fences
  async checkGeoFences(orderId, driverLocation) {
    try {
      const order = await EnhancedOrder.findById(orderId);
      if (!order || !order.delivery.coordinates) return;

      const customerLocation = order.delivery.coordinates;
      const distanceToCustomer = this.calculateDistance(driverLocation, customerLocation);

      // Check if driver is approaching (within 1km)
      if (distanceToCustomer <= 1 && !this.geoFences.has(`approaching_${orderId}`)) {
        this.geoFences.set(`approaching_${orderId}`, true);
        
        await this.updateOrderStatus(orderId, 'at_location', 'Driver approaching customer location');
        
        // Send approaching notification
        await this.sendCustomerNotification(order, 'approaching', {
          estimatedArrival: '5-10 minutes'
        });
      }

      // Check if driver has arrived (within 100m)
      if (distanceToCustomer <= 0.1 && !this.geoFences.has(`arrived_${orderId}`)) {
        this.geoFences.set(`arrived_${orderId}`, true);
        
        // Send arrival notification
        await this.sendCustomerNotification(order, 'arrived', {
          driverLocation: driverLocation
        });
      }

    } catch (error) {
      logger.error('Error checking geo-fences:', error);
    }
  }

  // Send status-based notifications
  async sendStatusNotifications(order, newStatus, previousStatus) {
    try {
      const customer = order.customer;
      
      switch (newStatus) {
        case 'confirmed':
          await this.sendCustomerNotification(order, 'confirmed', {
            preparationTime: order.business.preparationTime || 30
          });
          break;
          
        case 'preparing':
          await this.sendCustomerNotification(order, 'preparing', {
            estimatedCompletion: new Date(Date.now() + (order.business.preparationTime || 30) * 60000)
          });
          break;
          
        case 'out_for_delivery':
          await this.sendCustomerNotification(order, 'out_for_delivery', {
            driverName: order.driverAssignment?.driver?.name,
            driverPhone: order.driverAssignment?.driver?.phone,
            estimatedArrival: order.delivery.estimatedArrival
          });
          break;
          
        case 'delivered':
          await this.sendCustomerNotification(order, 'delivered', {
            deliveryTime: new Date()
          });
          
          // Request feedback after 10 minutes
          setTimeout(async () => {
            await this.sendFeedbackRequest(order);
          }, 10 * 60000);
          break;
          
        case 'failed_delivery':
          await this.sendCustomerNotification(order, 'failed_delivery', {
            reason: order.status.history[order.status.history.length - 1]?.notes,
            nextAttempt: 'We will contact you to reschedule'
          });
          break;
      }
    } catch (error) {
      logger.error('Error sending status notifications:', error);
    }
  }

  // Handle specific status transitions
  async handleStatusTransition(order, newStatus, previousStatus) {
    try {
      switch (newStatus) {
        case 'confirmed':
          // Start preparation timer
          this.startPreparationTimer(order._id);
          break;
          
        case 'out_for_delivery':
          // Start delivery tracking
          this.startDeliveryTracking(order._id);
          break;
          
        case 'delivered':
          // Stop tracking and cleanup
          this.stopOrderTracking(order._id);
          break;
          
        case 'cancelled':
          // Stop tracking and notify stakeholders
          this.stopOrderTracking(order._id);
          break;
      }
    } catch (error) {
      logger.error('Error handling status transition:', error);
    }
  }

  // Send customer notifications via multiple channels
  async sendCustomerNotification(order, type, data = {}) {
    try {
      const customer = order.customer;
      const templates = this.getNotificationTemplates();
      const template = templates[type];
      
      if (!template) return;

      // Prepare notification content
      const content = {
        title: this.interpolateTemplate(template.title, { order, data }),
        message: this.interpolateTemplate(template.message, { order, data }),
        type: type,
        orderId: order._id,
        orderNumber: order.orderNumber
      };

      // Send push notification via Socket.IO
      this.io.to(`order_${order._id}`).emit('notification', content);

      // Send SMS if customer has opted in
      if (customer.preferences?.notifications?.sms?.orderUpdates) {
        await notificationService.sendSMS(customer.phone, content.message);
      }

      // Send email if customer has opted in
      if (customer.preferences?.notifications?.email?.orderUpdates) {
        await notificationService.sendEmail(
          customer.email,
          content.title,
          this.generateEmailTemplate(content, order, data)
        );
      }

      // Add to order communications log
      await order.addCommunication('push', content.title, content.message, true);

      logger.info('Customer notification sent', {
        orderId: order._id,
        customerId: customer._id,
        type: type
      });

    } catch (error) {
      logger.error('Error sending customer notification:', error);
    }
  }

  // Utility methods
  calculateDistance(coords1, coords2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(coords2.lat - coords1.lat);
    const dLon = this.toRadians(coords2.lng - coords1.lng);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(coords1.lat)) * Math.cos(this.toRadians(coords2.lat)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  async getTrafficBuffer(origin, destination) {
    // In a real implementation, this would integrate with Google Maps Traffic API
    // For now, return a simple time-based buffer
    const hour = new Date().getHours();
    
    // Rush hour traffic
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
      return 15; // 15 minutes additional buffer
    }
    
    return 5; // 5 minutes normal buffer
  }

  startPreparationTimer(orderId) {
    // This could trigger automatic status updates or alerts
    logger.info('Preparation timer started', { orderId });
  }

  startDeliveryTracking(orderId) {
    // Enhanced tracking when order is out for delivery
    logger.info('Delivery tracking started', { orderId });
  }

  stopOrderTracking(orderId) {
    // Cleanup tracking resources
    this.geoFences.delete(`approaching_${orderId}`);
    this.geoFences.delete(`arrived_${orderId}`);
    this.deliveryEstimates.delete(orderId);
    
    logger.info('Order tracking stopped', { orderId });
  }

  async updateAllDeliveryEstimates() {
    try {
      const activeOrders = await EnhancedOrder.findActiveDeliveries();
      
      for (const order of activeOrders) {
        if (order.driverAssignment?.currentLocation) {
          await this.calculateUpdatedETA(order._id, order.driverAssignment.currentLocation);
        }
      }
    } catch (error) {
      logger.error('Error updating delivery estimates:', error);
    }
  }

  async checkOverdueDeliveries() {
    try {
      const overdueOrders = await EnhancedOrder.findOverdueOrders();
      
      for (const order of overdueOrders) {
        // Send overdue alert
        this.io.to(`order_${order._id}`).emit('delivery_overdue', {
          orderId: order._id,
          orderNumber: order.orderNumber,
          originalETA: order.delivery.estimatedArrival,
          minutesOverdue: Math.floor((new Date() - order.delivery.estimatedArrival) / 60000)
        });
        
        logger.warn('Overdue delivery detected', {
          orderId: order._id,
          originalETA: order.delivery.estimatedArrival
        });
      }
    } catch (error) {
      logger.error('Error checking overdue deliveries:', error);
    }
  }

  async cleanupOldTrackingData() {
    try {
      // Remove tracking data for orders older than 24 hours
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // This would typically clean up cache entries and database records
      logger.info('Cleaning up old tracking data', { cutoffTime });
    } catch (error) {
      logger.error('Error cleaning up tracking data:', error);
    }
  }

  // Notification templates
  getNotificationTemplates() {
    return {
      confirmed: {
        title: 'Order Confirmed',
        message: 'Your order #{{orderNumber}} has been confirmed and will be ready in {{preparationTime}} minutes.'
      },
      preparing: {
        title: 'Order Being Prepared',
        message: 'Your fresh water is being prepared for delivery. Estimated completion at {{estimatedCompletion}}.'
      },
      out_for_delivery: {
        title: 'Order Out for Delivery',
        message: 'Your order is on the way! {{driverName}} will deliver your water. ETA: {{estimatedArrival}}.'
      },
      approaching: {
        title: 'Driver Approaching',
        message: 'Your driver is nearby and will arrive in {{estimatedArrival}}.'
      },
      arrived: {
        title: 'Driver Arrived',
        message: 'Your driver has arrived at your location. Please be ready to receive your delivery.'
      },
      delivered: {
        title: 'Order Delivered',
        message: 'Your order has been successfully delivered. Thank you for choosing Abai Springs!'
      },
      failed_delivery: {
        title: 'Delivery Attempt Failed',
        message: 'We were unable to deliver your order. Reason: {{reason}}. {{nextAttempt}}'
      }
    };
  }

  interpolateTemplate(template, context) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return context.data?.[key] || context.order?.[key] || match;
    });
  }

  generateEmailTemplate(content, order, data) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #007bff; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">${content.title}</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <p style="color: #333; font-size: 16px;">${content.message}</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Order Details</h3>
            <p><strong>Order Number:</strong> ${order.orderNumber}</p>
            <p><strong>Status:</strong> ${order.status.current}</p>
            <p><strong>Delivery Address:</strong> ${order.delivery.address}</p>
          </div>
          <p style="color: #666; font-size: 14px;">
            Track your order in real-time at: 
            <a href="${process.env.FRONTEND_URL}/track/${order._id}">Track Order</a>
          </p>
        </div>
      </div>
    `;
  }

  async sendFeedbackRequest(order) {
    try {
      const feedbackContent = {
        title: 'How was your delivery?',
        message: 'We hope you enjoyed your Abai Springs water! Please take a moment to rate your experience.',
        type: 'feedback_request',
        orderId: order._id,
        orderNumber: order.orderNumber,
        feedbackUrl: `${process.env.FRONTEND_URL}/feedback/${order._id}`
      };

      this.io.to(`order_${order._id}`).emit('feedback_request', feedbackContent);

      logger.info('Feedback request sent', { orderId: order._id });
    } catch (error) {
      logger.error('Error sending feedback request:', error);
    }
  }

  // Public API methods
  async getOrderTracking(orderId) {
    return await this.getOrderTrackingData(orderId);
  }

  async broadcastToOrder(orderId, event, data) {
    this.io.to(`order_${orderId}`).emit(event, data);
  }

  async broadcastToDriver(driverId, event, data) {
    this.io.to(`driver_${driverId}`).emit(event, data);
  }

  getConnectedClients() {
    return this.io.engine.clientsCount;
  }
}

export default new RealTimeTrackingService();






