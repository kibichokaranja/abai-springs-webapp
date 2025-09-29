import EnhancedOrder from '../../models/Order.enhanced.js';
import Outlet from '../../models/Outlet.js';
import User from '../../models/User.js';
import cacheManager from '../../utils/cache.js';
import logger from '../../utils/logger.js';

class DeliverySchedulingService {
  constructor() {
    this.timeSlots = this.generateTimeSlots();
    this.maxOrdersPerSlot = 10; // Maximum orders per time slot
    this.bufferTime = 15; // Minutes between deliveries
    this.workingHours = {
      start: '08:00',
      end: '18:00'
    };
  }

  // Generate available time slots for a given date
  generateTimeSlots(date = new Date()) {
    const slots = [];
    const startHour = 8; // 8 AM
    const endHour = 18; // 6 PM
    const slotDuration = 2; // 2-hour slots

    for (let hour = startHour; hour < endHour; hour += slotDuration) {
      const startTime = `${hour.toString().padStart(2, '0')}:00`;
      const endTime = `${(hour + slotDuration).toString().padStart(2, '0')}:00`;
      
      slots.push({
        id: `slot_${hour}_${hour + slotDuration}`,
        start: startTime,
        end: endTime,
        label: `${this.formatTime(startTime)} - ${this.formatTime(endTime)}`,
        available: true,
        capacity: this.maxOrdersPerSlot,
        booked: 0
      });
    }

    return slots;
  }

  // Get available delivery slots for a specific date and location
  async getAvailableSlots(date, coordinates = null, outletId = null) {
    try {
      const targetDate = new Date(date);
      const today = new Date();
      
      // Don't allow scheduling for past dates
      if (targetDate < today.setHours(0, 0, 0, 0)) {
        throw new Error('Cannot schedule for past dates');
      }

      // Generate base time slots
      const slots = this.generateTimeSlots(targetDate);
      
      // Get existing bookings for this date
      const existingOrders = await this.getExistingOrdersForDate(targetDate, outletId);
      
      // Calculate availability for each slot
      for (const slot of slots) {
        const slotStart = this.parseTime(slot.start);
        const slotEnd = this.parseTime(slot.end);
        
        // Count orders in this time slot
        const ordersInSlot = existingOrders.filter(order => {
          if (!order.delivery.scheduledFor) return false;
          
          const orderTime = new Date(order.delivery.scheduledFor);
          const orderHour = orderTime.getHours();
          const orderMinute = orderTime.getMinutes();
          const orderTimeMinutes = orderHour * 60 + orderMinute;
          
          return orderTimeMinutes >= slotStart && orderTimeMinutes < slotEnd;
        });

        slot.booked = ordersInSlot.length;
        slot.available = slot.booked < slot.capacity;
        
        // Check outlet capacity if specified
        if (outletId) {
          const outletCapacity = await this.getOutletCapacity(outletId, targetDate, slot);
          slot.available = slot.available && slot.booked < outletCapacity;
        }

        // Add pricing information (peak hours cost more)
        slot.pricing = this.calculateSlotPricing(slot, targetDate);
      }

      // Filter out unavailable slots if same day and time has passed
      if (this.isSameDay(targetDate, today)) {
        const currentHour = today.getHours();
        return slots.filter(slot => {
          const slotStartHour = parseInt(slot.start.split(':')[0]);
          return slotStartHour > currentHour + 1; // At least 1 hour advance booking
        });
      }

      return slots;
    } catch (error) {
      logger.error('Error getting available slots:', error);
      throw error;
    }
  }

  // Schedule order for specific time slot
  async scheduleOrder(orderId, scheduledDate, timeSlot, preferences = {}) {
    try {
      const order = await EnhancedOrder.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      const targetDate = new Date(scheduledDate);
      const slot = this.timeSlots.find(s => s.id === timeSlot);
      
      if (!slot) {
        throw new Error('Invalid time slot');
      }

      // Verify slot is still available
      const availableSlots = await this.getAvailableSlots(targetDate, order.delivery.coordinates, order.outlet);
      const availableSlot = availableSlots.find(s => s.id === timeSlot);
      
      if (!availableSlot || !availableSlot.available) {
        throw new Error('Time slot is no longer available');
      }

      // Calculate exact delivery time within the slot
      const deliveryTime = this.calculateOptimalDeliveryTime(targetDate, slot, order, preferences);

      // Update order with scheduling information
      order.delivery.scheduledFor = deliveryTime;
      order.delivery.preferredTimeSlot = {
        start: slot.start,
        end: slot.end
      };
      order.business.estimatedDeliveryTime = this.calculateTravelTime(order);

      await order.save();

      // Update order status
      await order.updateStatus('confirmed', `Order scheduled for ${deliveryTime.toLocaleString()}`);

      // Cache the scheduling for quick lookup
      await this.cacheScheduling(orderId, deliveryTime, slot);

      logger.info('Order scheduled successfully', {
        orderId: orderId,
        scheduledFor: deliveryTime,
        timeSlot: timeSlot
      });

      return {
        success: true,
        scheduledFor: deliveryTime,
        timeSlot: slot,
        estimatedDeliveryTime: order.business.estimatedDeliveryTime
      };
    } catch (error) {
      logger.error('Error scheduling order:', error);
      throw error;
    }
  }

  // Reschedule existing order
  async rescheduleOrder(orderId, newDate, newTimeSlot, reason = 'Customer request') {
    try {
      const order = await EnhancedOrder.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      const oldSchedule = {
        date: order.delivery.scheduledFor,
        slot: order.delivery.preferredTimeSlot
      };

      // Schedule for new time
      const result = await this.scheduleOrder(orderId, newDate, newTimeSlot);

      // Log the rescheduling
      await order.updateStatus(order.status.current, `Order rescheduled: ${reason}`);

      logger.info('Order rescheduled', {
        orderId: orderId,
        oldSchedule: oldSchedule,
        newSchedule: {
          date: result.scheduledFor,
          slot: result.timeSlot
        },
        reason: reason
      });

      return result;
    } catch (error) {
      logger.error('Error rescheduling order:', error);
      throw error;
    }
  }

  // Get optimal delivery routes for a time period
  async getDeliveryRoutes(date, timeSlot = null, outletId = null) {
    try {
      const targetDate = new Date(date);
      
      const query = {
        'delivery.scheduledFor': {
          $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
          $lt: new Date(targetDate.setHours(23, 59, 59, 999))
        },
        'status.current': { $in: ['confirmed', 'preparing', 'ready_for_pickup'] }
      };

      if (outletId) {
        query.outlet = outletId;
      }

      if (timeSlot) {
        const slot = this.timeSlots.find(s => s.id === timeSlot);
        if (slot) {
          const slotStart = this.parseTime(slot.start);
          const slotEnd = this.parseTime(slot.end);
          
          query['delivery.scheduledFor'] = {
            $gte: new Date(targetDate.setHours(Math.floor(slotStart / 60), slotStart % 60, 0, 0)),
            $lt: new Date(targetDate.setHours(Math.floor(slotEnd / 60), slotEnd % 60, 0, 0))
          };
        }
      }

      const orders = await EnhancedOrder.find(query)
        .populate('customer outlet driverAssignment.driver')
        .sort({ 'delivery.scheduledFor': 1 });

      // Group orders by outlet and optimize routes
      const routesByOutlet = {};
      
      for (const order of orders) {
        const outletKey = order.outlet._id.toString();
        
        if (!routesByOutlet[outletKey]) {
          routesByOutlet[outletKey] = {
            outlet: order.outlet,
            orders: [],
            totalDistance: 0,
            estimatedDuration: 0
          };
        }
        
        routesByOutlet[outletKey].orders.push(order);
      }

      // Optimize delivery sequence for each outlet
      for (const outletKey in routesByOutlet) {
        const route = routesByOutlet[outletKey];
        route.optimizedOrders = await this.optimizeDeliverySequence(route.orders, route.outlet);
        route.totalDistance = this.calculateRouteDistance(route.optimizedOrders, route.outlet);
        route.estimatedDuration = this.calculateRouteDuration(route.optimizedOrders, route.outlet);
      }

      return {
        success: true,
        routes: Object.values(routesByOutlet),
        totalOrders: orders.length,
        date: targetDate
      };
    } catch (error) {
      logger.error('Error getting delivery routes:', error);
      throw error;
    }
  }

  // Optimize delivery sequence using simple nearest-neighbor algorithm
  async optimizeDeliverySequence(orders, outlet) {
    if (orders.length <= 1) return orders;

    const optimized = [];
    const remaining = [...orders];
    let currentLocation = outlet.coordinates;

    while (remaining.length > 0) {
      let nearestIndex = 0;
      let minDistance = Infinity;

      // Find nearest order
      for (let i = 0; i < remaining.length; i++) {
        const order = remaining[i];
        if (order.delivery.coordinates) {
          const distance = this.calculateDistance(currentLocation, order.delivery.coordinates);
          if (distance < minDistance) {
            minDistance = distance;
            nearestIndex = i;
          }
        }
      }

      // Add nearest order to optimized sequence
      const nearestOrder = remaining.splice(nearestIndex, 1)[0];
      optimized.push(nearestOrder);
      
      if (nearestOrder.delivery.coordinates) {
        currentLocation = nearestOrder.delivery.coordinates;
      }
    }

    return optimized;
  }

  // Get scheduling analytics
  async getSchedulingAnalytics(startDate, endDate) {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      const analytics = await EnhancedOrder.aggregate([
        {
          $match: {
            'delivery.scheduledFor': { $gte: start, $lte: end },
            'status.current': { $ne: 'cancelled' }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$delivery.scheduledFor' } },
              hour: { $hour: '$delivery.scheduledFor' }
            },
            count: { $sum: 1 },
            totalRevenue: { $sum: '$pricing.totalAmount' },
            avgDeliveryTime: { $avg: '$business.actualDeliveryTime' }
          }
        },
        {
          $sort: { '_id.date': 1, '_id.hour': 1 }
        }
      ]);

      // Calculate slot utilization
      const slotUtilization = {};
      const timeSlotStats = {};

      for (const slot of this.timeSlots) {
        timeSlotStats[slot.id] = {
          slot: slot,
          totalOrders: 0,
          totalRevenue: 0,
          averageDeliveryTime: 0,
          utilizationRate: 0
        };
      }

      analytics.forEach(item => {
        const hour = item._id.hour;
        const slotId = this.getSlotIdForHour(hour);
        
        if (timeSlotStats[slotId]) {
          timeSlotStats[slotId].totalOrders += item.count;
          timeSlotStats[slotId].totalRevenue += item.totalRevenue;
          timeSlotStats[slotId].averageDeliveryTime = item.avgDeliveryTime || 0;
          timeSlotStats[slotId].utilizationRate = (item.count / this.maxOrdersPerSlot) * 100;
        }
      });

      return {
        success: true,
        analytics: analytics,
        slotUtilization: Object.values(timeSlotStats),
        summary: {
          totalOrders: analytics.reduce((sum, item) => sum + item.count, 0),
          totalRevenue: analytics.reduce((sum, item) => sum + item.totalRevenue, 0),
          averageOrdersPerDay: analytics.length > 0 ? analytics.reduce((sum, item) => sum + item.count, 0) / analytics.length : 0,
          peakHour: analytics.reduce((max, item) => item.count > max.count ? item : max, { count: 0 })
        }
      };
    } catch (error) {
      logger.error('Error getting scheduling analytics:', error);
      throw error;
    }
  }

  // Helper methods
  async getExistingOrdersForDate(date, outletId = null) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const query = {
      'delivery.scheduledFor': { $gte: startOfDay, $lte: endOfDay },
      'status.current': { $ne: 'cancelled' }
    };

    if (outletId) {
      query.outlet = outletId;
    }

    return await EnhancedOrder.find(query);
  }

  async getOutletCapacity(outletId, date, slot) {
    // In a real implementation, this would check outlet-specific capacity
    // For now, return default capacity
    return this.maxOrdersPerSlot;
  }

  calculateSlotPricing(slot, date) {
    const baseDeliveryFee = 50; // KES
    let multiplier = 1;

    // Peak hours (lunch and evening) cost more
    const startHour = parseInt(slot.start.split(':')[0]);
    if ((startHour >= 12 && startHour < 14) || (startHour >= 17 && startHour < 19)) {
      multiplier = 1.2; // 20% surcharge
    }

    // Weekend surcharge
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      multiplier *= 1.1; // Additional 10% for weekends
    }

    return {
      basePrice: baseDeliveryFee,
      multiplier: multiplier,
      finalPrice: Math.round(baseDeliveryFee * multiplier),
      isPeakHour: multiplier > 1,
      surcharges: {
        peakHour: multiplier > 1.1,
        weekend: dayOfWeek === 0 || dayOfWeek === 6
      }
    };
  }

  calculateOptimalDeliveryTime(date, slot, order, preferences = {}) {
    const slotStart = this.parseTime(slot.start);
    const slotEnd = this.parseTime(slot.end);
    const slotDurationMinutes = slotEnd - slotStart;

    // Try to schedule in the first half of the slot unless customer prefers later
    let targetMinutes = slotStart;
    
    if (preferences.preferLater) {
      targetMinutes = slotStart + (slotDurationMinutes * 0.75);
    } else if (preferences.preferEarlier) {
      targetMinutes = slotStart + (slotDurationMinutes * 0.25);
    } else {
      targetMinutes = slotStart + (slotDurationMinutes * 0.5);
    }

    const deliveryTime = new Date(date);
    deliveryTime.setHours(Math.floor(targetMinutes / 60), targetMinutes % 60, 0, 0);

    return deliveryTime;
  }

  calculateTravelTime(order) {
    // Simple travel time calculation
    // In production, this would use real routing APIs
    if (!order.outlet.coordinates || !order.delivery.coordinates) {
      return 30; // Default 30 minutes
    }

    const distance = this.calculateDistance(order.outlet.coordinates, order.delivery.coordinates);
    const avgSpeed = 25; // km/h in city traffic
    const travelTimeHours = distance / avgSpeed;
    
    return Math.round(travelTimeHours * 60); // Convert to minutes
  }

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

  calculateRouteDistance(orders, outlet) {
    let totalDistance = 0;
    let currentLocation = outlet.coordinates;

    for (const order of orders) {
      if (order.delivery.coordinates) {
        totalDistance += this.calculateDistance(currentLocation, order.delivery.coordinates);
        currentLocation = order.delivery.coordinates;
      }
    }

    // Return to outlet
    totalDistance += this.calculateDistance(currentLocation, outlet.coordinates);

    return totalDistance;
  }

  calculateRouteDuration(orders, outlet) {
    const totalDistance = this.calculateRouteDistance(orders, outlet);
    const avgSpeed = 25; // km/h
    const travelTime = (totalDistance / avgSpeed) * 60; // minutes
    const deliveryTime = orders.length * 5; // 5 minutes per delivery
    
    return Math.round(travelTime + deliveryTime);
  }

  async cacheScheduling(orderId, deliveryTime, slot) {
    const cacheKey = `scheduling:${orderId}`;
    const data = {
      orderId: orderId,
      deliveryTime: deliveryTime,
      slot: slot,
      cachedAt: new Date()
    };
    
    await cacheManager.set(cacheKey, data, 24 * 60 * 60); // Cache for 24 hours
  }

  // Utility methods
  parseTime(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  formatTime(timeStr) {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  }

  isSameDay(date1, date2) {
    return date1.toDateString() === date2.toDateString();
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  getSlotIdForHour(hour) {
    for (const slot of this.timeSlots) {
      const startHour = parseInt(slot.start.split(':')[0]);
      const endHour = parseInt(slot.end.split(':')[0]);
      
      if (hour >= startHour && hour < endHour) {
        return slot.id;
      }
    }
    return this.timeSlots[0].id; // Default to first slot
  }

  // Public API methods
  async getAvailableDates(daysAhead = 7) {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < daysAhead; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      // Skip Sundays (assuming outlet is closed)
      if (date.getDay() !== 0) {
        dates.push({
          date: date.toISOString().split('T')[0],
          dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
          available: true
        });
      }
    }
    
    return dates;
  }

  async getDeliveryCapacity(date, outletId = null) {
    const slots = await this.getAvailableSlots(date, null, outletId);
    
    return {
      totalSlots: slots.length,
      availableSlots: slots.filter(s => s.available).length,
      totalCapacity: slots.reduce((sum, slot) => sum + slot.capacity, 0),
      bookedCapacity: slots.reduce((sum, slot) => sum + slot.booked, 0),
      utilizationRate: slots.length > 0 ? 
        (slots.reduce((sum, slot) => sum + slot.booked, 0) / slots.reduce((sum, slot) => sum + slot.capacity, 0)) * 100 : 0
    };
  }
}

export default new DeliverySchedulingService();












