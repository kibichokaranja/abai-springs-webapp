import EnhancedOrder from '../../models/Order.enhanced.js';
import User from '../../models/User.js';
import Outlet from '../../models/Outlet.js';
import cacheManager from '../../utils/cache.js';
import logger from '../../utils/logger.js';

class SmartRoutingService {
  constructor() {
    this.routingAlgorithms = {
      distance: this.routeByDistance.bind(this),
      availability: this.routeByAvailability.bind(this),
      load_balancing: this.routeByLoadBalancing.bind(this),
      cost_optimization: this.routeByCostOptimization.bind(this),
      customer_preference: this.routeByCustomerPreference.bind(this)
    };
    
    this.defaultAlgorithm = 'distance';
  }

  // Main routing function
  async routeOrder(orderId, algorithm = null) {
    try {
      const order = await EnhancedOrder.findById(orderId)
        .populate('customer outlet');
      
      if (!order) {
        throw new Error('Order not found');
      }

      const routingAlgorithm = algorithm || this.defaultAlgorithm;
      const routingFunction = this.routingAlgorithms[routingAlgorithm];
      
      if (!routingFunction) {
        throw new Error(`Unknown routing algorithm: ${routingAlgorithm}`);
      }

      logger.info('Starting order routing', {
        orderId: orderId,
        algorithm: routingAlgorithm,
        customerLocation: order.delivery.coordinates
      });

      const routingResult = await routingFunction(order);
      
      // Store routing decision
      await this.storeRoutingDecision(orderId, routingResult, routingAlgorithm);
      
      logger.info('Order routing completed', {
        orderId: orderId,
        selectedOutlet: routingResult.outlet?._id,
        selectedDriver: routingResult.driver?._id,
        estimatedDeliveryTime: routingResult.estimatedDeliveryTime,
        algorithm: routingAlgorithm
      });

      return routingResult;
    } catch (error) {
      logger.error('Order routing failed:', error);
      throw error;
    }
  }

  // Route by distance (nearest outlet and driver)
  async routeByDistance(order) {
    const customerCoords = order.delivery.coordinates;
    
    if (!customerCoords) {
      throw new Error('Customer coordinates not available');
    }

    // Find nearest outlet
    const outlets = await this.getAvailableOutlets();
    const nearestOutlet = this.findNearestLocation(customerCoords, outlets);
    
    if (!nearestOutlet) {
      throw new Error('No available outlets found');
    }

    // Find nearest available driver to customer location
    const availableDrivers = await this.getAvailableDrivers(nearestOutlet._id);
    const nearestDriver = this.findNearestDriver(customerCoords, availableDrivers);

    const distanceToOutlet = this.calculateDistance(customerCoords, nearestOutlet.coordinates);
    const distanceToDriver = nearestDriver ? 
      this.calculateDistance(customerCoords, nearestDriver.currentLocation) : null;

    const estimatedDeliveryTime = this.calculateEstimatedDeliveryTime(
      distanceToOutlet,
      distanceToDriver,
      order.business.preparationTime || 30
    );

    return {
      outlet: nearestOutlet,
      driver: nearestDriver,
      algorithm: 'distance',
      metrics: {
        distanceToOutlet: distanceToOutlet,
        distanceToDriver: distanceToDriver,
        estimatedDeliveryTime: estimatedDeliveryTime
      },
      confidence: this.calculateConfidence(distanceToOutlet, distanceToDriver)
    };
  }

  // Route by availability (outlet and driver with least load)
  async routeByAvailability(order) {
    const outlets = await this.getAvailableOutlets();
    const outletLoads = await this.calculateOutletLoads(outlets);
    
    // Select outlet with lowest load
    const selectedOutlet = outletLoads.reduce((min, current) => 
      current.load < min.load ? current : min
    );

    const availableDrivers = await this.getAvailableDrivers(selectedOutlet.outlet._id);
    const driverLoads = await this.calculateDriverLoads(availableDrivers);
    
    // Select driver with lowest load
    const selectedDriver = driverLoads.length > 0 ? 
      driverLoads.reduce((min, current) => 
        current.load < min.load ? current : min
      ) : null;

    const customerCoords = order.delivery.coordinates;
    const distanceToOutlet = customerCoords ? 
      this.calculateDistance(customerCoords, selectedOutlet.outlet.coordinates) : null;
    
    const estimatedDeliveryTime = this.calculateEstimatedDeliveryTime(
      distanceToOutlet,
      null,
      order.business.preparationTime || 30,
      selectedOutlet.load
    );

    return {
      outlet: selectedOutlet.outlet,
      driver: selectedDriver?.driver || null,
      algorithm: 'availability',
      metrics: {
        outletLoad: selectedOutlet.load,
        driverLoad: selectedDriver?.load || 0,
        distanceToOutlet: distanceToOutlet,
        estimatedDeliveryTime: estimatedDeliveryTime
      },
      confidence: this.calculateAvailabilityConfidence(selectedOutlet.load, selectedDriver?.load)
    };
  }

  // Route by load balancing
  async routeByLoadBalancing(order) {
    const outlets = await this.getAvailableOutlets();
    const outletLoads = await this.calculateOutletLoads(outlets);
    
    // Calculate standard deviation of loads
    const loads = outletLoads.map(o => o.load);
    const avgLoad = loads.reduce((sum, load) => sum + load, 0) / loads.length;
    const variance = loads.reduce((sum, load) => sum + Math.pow(load - avgLoad, 2), 0) / loads.length;
    const stdDev = Math.sqrt(variance);
    
    // Select outlet that would minimize load variance
    let bestOutlet = null;
    let minVarianceAfterAssignment = Infinity;
    
    for (const outletLoad of outletLoads) {
      const newLoads = loads.map(load => 
        load === outletLoad.load ? load + 1 : load
      );
      const newAvg = newLoads.reduce((sum, load) => sum + load, 0) / newLoads.length;
      const newVariance = newLoads.reduce((sum, load) => sum + Math.pow(load - newAvg, 2), 0) / newLoads.length;
      
      if (newVariance < minVarianceAfterAssignment) {
        minVarianceAfterAssignment = newVariance;
        bestOutlet = outletLoad;
      }
    }

    const availableDrivers = await this.getAvailableDrivers(bestOutlet.outlet._id);
    const selectedDriver = availableDrivers.length > 0 ? availableDrivers[0] : null;

    const customerCoords = order.delivery.coordinates;
    const distanceToOutlet = customerCoords ? 
      this.calculateDistance(customerCoords, bestOutlet.outlet.coordinates) : null;

    const estimatedDeliveryTime = this.calculateEstimatedDeliveryTime(
      distanceToOutlet,
      null,
      order.business.preparationTime || 30,
      bestOutlet.load
    );

    return {
      outlet: bestOutlet.outlet,
      driver: selectedDriver,
      algorithm: 'load_balancing',
      metrics: {
        currentVariance: variance,
        projectedVariance: minVarianceAfterAssignment,
        outletLoad: bestOutlet.load,
        distanceToOutlet: distanceToOutlet,
        estimatedDeliveryTime: estimatedDeliveryTime
      },
      confidence: this.calculateLoadBalanceConfidence(variance, minVarianceAfterAssignment)
    };
  }

  // Route by cost optimization
  async routeByCostOptimization(order) {
    const outlets = await this.getAvailableOutlets();
    const costAnalyses = [];

    for (const outlet of outlets) {
      const availableDrivers = await this.getAvailableDrivers(outlet._id);
      
      for (const driver of availableDrivers) {
        const cost = await this.calculateDeliveryCost(order, outlet, driver);
        costAnalyses.push({
          outlet: outlet,
          driver: driver,
          cost: cost
        });
      }
    }

    // Select combination with lowest cost
    const bestCombination = costAnalyses.reduce((min, current) => 
      current.cost.total < min.cost.total ? current : min
    );

    const customerCoords = order.delivery.coordinates;
    const distanceToOutlet = customerCoords ? 
      this.calculateDistance(customerCoords, bestCombination.outlet.coordinates) : null;

    const estimatedDeliveryTime = this.calculateEstimatedDeliveryTime(
      distanceToOutlet,
      bestCombination.cost.driverDistance,
      order.business.preparationTime || 30
    );

    return {
      outlet: bestCombination.outlet,
      driver: bestCombination.driver,
      algorithm: 'cost_optimization',
      metrics: {
        deliveryCost: bestCombination.cost.total,
        distanceToOutlet: distanceToOutlet,
        estimatedDeliveryTime: estimatedDeliveryTime,
        costBreakdown: bestCombination.cost
      },
      confidence: this.calculateCostConfidence(bestCombination.cost)
    };
  }

  // Route by customer preference
  async routeByCustomerPreference(order) {
    const customer = order.customer;
    const customerPrefs = await this.getCustomerPreferences(customer._id);

    // Find preferred outlet if available
    let selectedOutlet = null;
    if (customerPrefs.preferredOutlet) {
      const preferredOutlet = await Outlet.findById(customerPrefs.preferredOutlet);
      if (preferredOutlet && await this.isOutletAvailable(preferredOutlet._id)) {
        selectedOutlet = preferredOutlet;
      }
    }

    // Fallback to distance-based routing if no preference or unavailable
    if (!selectedOutlet) {
      const distanceResult = await this.routeByDistance(order);
      selectedOutlet = distanceResult.outlet;
    }

    // Find preferred driver if available
    let selectedDriver = null;
    const availableDrivers = await this.getAvailableDrivers(selectedOutlet._id);
    
    if (customerPrefs.preferredDriver && availableDrivers.length > 0) {
      selectedDriver = availableDrivers.find(d => 
        d._id.toString() === customerPrefs.preferredDriver.toString()
      );
    }

    // Fallback to best available driver
    if (!selectedDriver && availableDrivers.length > 0) {
      selectedDriver = availableDrivers[0];
    }

    const customerCoords = order.delivery.coordinates;
    const distanceToOutlet = customerCoords ? 
      this.calculateDistance(customerCoords, selectedOutlet.coordinates) : null;

    const estimatedDeliveryTime = this.calculateEstimatedDeliveryTime(
      distanceToOutlet,
      null,
      order.business.preparationTime || 30
    );

    return {
      outlet: selectedOutlet,
      driver: selectedDriver,
      algorithm: 'customer_preference',
      metrics: {
        usedPreferredOutlet: !!customerPrefs.preferredOutlet,
        usedPreferredDriver: !!customerPrefs.preferredDriver,
        distanceToOutlet: distanceToOutlet,
        estimatedDeliveryTime: estimatedDeliveryTime
      },
      confidence: this.calculatePreferenceConfidence(customerPrefs)
    };
  }

  // Helper methods
  async getAvailableOutlets() {
    const cacheKey = 'available_outlets';
    let outlets = await cacheManager.get(cacheKey);
    
    if (!outlets) {
      outlets = await Outlet.find({ 
        isActive: true,
        operatingHours: { $exists: true }
      });
      
      // Filter by current operating hours
      const now = new Date();
      outlets = outlets.filter(outlet => this.isOutletOpenNow(outlet, now));
      
      await cacheManager.set(cacheKey, outlets, 5 * 60); // Cache for 5 minutes
    }
    
    return outlets;
  }

  async getAvailableDrivers(outletId) {
    const drivers = await User.find({
      role: 'driver',
      'driverProfile.isActive': true,
      'driverProfile.currentOutlet': outletId,
      'driverProfile.status': { $in: ['available', 'busy'] }
    });

    // Filter out drivers who are already on delivery
    const availableDrivers = [];
    for (const driver of drivers) {
      const activeDeliveries = await EnhancedOrder.countDocuments({
        'driverAssignment.driver': driver._id,
        'status.current': { $in: ['out_for_delivery', 'at_location'] }
      });
      
      if (activeDeliveries === 0 || driver.driverProfile.status === 'available') {
        availableDrivers.push(driver);
      }
    }

    return availableDrivers;
  }

  async calculateOutletLoads(outlets) {
    const loads = [];
    
    for (const outlet of outlets) {
      const activeOrders = await EnhancedOrder.countDocuments({
        outlet: outlet._id,
        'status.current': { $in: ['confirmed', 'preparing', 'ready_for_pickup'] }
      });
      
      loads.push({
        outlet: outlet,
        load: activeOrders
      });
    }
    
    return loads;
  }

  async calculateDriverLoads(drivers) {
    const loads = [];
    
    for (const driver of drivers) {
      const activeDeliveries = await EnhancedOrder.countDocuments({
        'driverAssignment.driver': driver._id,
        'status.current': { $in: ['assigned_driver', 'out_for_delivery', 'at_location'] }
      });
      
      loads.push({
        driver: driver,
        load: activeDeliveries
      });
    }
    
    return loads;
  }

  async calculateDeliveryCost(order, outlet, driver) {
    const customerCoords = order.delivery.coordinates;
    const outletCoords = outlet.coordinates;
    const driverCoords = driver.driverProfile?.currentLocation;

    const distanceOutletToCustomer = customerCoords ? 
      this.calculateDistance(outletCoords, customerCoords) : 10; // Default 10km
    
    const distanceDriverToCustomer = (driverCoords && customerCoords) ? 
      this.calculateDistance(driverCoords, customerCoords) : 5; // Default 5km

    const fuelCostPerKm = 12; // KES per km
    const driverCostPerMinute = 2; // KES per minute
    const estimatedTravelTime = (distanceDriverToCustomer + distanceOutletToCustomer) * 2; // Round trip in minutes

    const cost = {
      fuelCost: (distanceDriverToCustomer + distanceOutletToCustomer) * fuelCostPerKm,
      driverCost: estimatedTravelTime * driverCostPerMinute,
      operationalCost: 50, // Fixed operational cost
      driverDistance: distanceDriverToCustomer,
      outletDistance: distanceOutletToCustomer
    };

    cost.total = cost.fuelCost + cost.driverCost + cost.operationalCost;

    return cost;
  }

  findNearestLocation(targetCoords, locations) {
    if (!locations.length) return null;
    
    return locations.reduce((nearest, location) => {
      const distance = this.calculateDistance(targetCoords, location.coordinates);
      const nearestDistance = this.calculateDistance(targetCoords, nearest.coordinates);
      return distance < nearestDistance ? location : nearest;
    });
  }

  findNearestDriver(targetCoords, drivers) {
    if (!drivers.length) return null;
    
    return drivers.reduce((nearest, driver) => {
      if (!driver.driverProfile?.currentLocation) return nearest;
      
      const distance = this.calculateDistance(targetCoords, driver.driverProfile.currentLocation);
      
      if (!nearest || !nearest.driverProfile?.currentLocation) return driver;
      
      const nearestDistance = this.calculateDistance(targetCoords, nearest.driverProfile.currentLocation);
      return distance < nearestDistance ? driver : nearest;
    }, null);
  }

  calculateDistance(coords1, coords2) {
    if (!coords1 || !coords2) return Infinity;
    
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(coords2.lat - coords1.lat);
    const dLon = this.toRadians(coords2.lng - coords1.lng);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(coords1.lat)) * Math.cos(this.toRadians(coords2.lat)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  calculateEstimatedDeliveryTime(distanceKm, driverDistanceKm = 0, preparationTime = 30, outletLoad = 0) {
    const avgSpeedKmH = 25; // Average speed in city
    const travelTimeMinutes = ((distanceKm || 5) + (driverDistanceKm || 0)) / avgSpeedKmH * 60;
    const loadDelayMinutes = outletLoad * 5; // 5 minutes delay per order in queue
    
    return Math.round(preparationTime + travelTimeMinutes + loadDelayMinutes);
  }

  isOutletOpenNow(outlet, currentTime = new Date()) {
    if (!outlet.operatingHours) return true; // Assume 24/7 if no hours specified
    
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    
    const dayOfWeek = currentTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayHours = outlet.operatingHours[days[dayOfWeek]];
    
    if (!todayHours || !todayHours.isOpen) return false;
    
    const openTime = this.timeStringToMinutes(todayHours.open);
    const closeTime = this.timeStringToMinutes(todayHours.close);
    
    return currentTimeMinutes >= openTime && currentTimeMinutes <= closeTime;
  }

  timeStringToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  async isOutletAvailable(outletId) {
    const outlet = await Outlet.findById(outletId);
    return outlet && outlet.isActive && this.isOutletOpenNow(outlet);
  }

  async getCustomerPreferences(customerId) {
    const cacheKey = `customer_prefs:${customerId}`;
    let prefs = await cacheManager.get(cacheKey);
    
    if (!prefs) {
      const customer = await User.findById(customerId);
      prefs = customer?.preferences?.delivery || {};
      await cacheManager.set(cacheKey, prefs, 10 * 60); // Cache for 10 minutes
    }
    
    return prefs;
  }

  // Confidence calculation methods
  calculateConfidence(distanceToOutlet, distanceToDriver) {
    const maxDistance = 50; // km
    const outletScore = Math.max(0, 100 - (distanceToOutlet / maxDistance) * 100);
    const driverScore = distanceToDriver ? Math.max(0, 100 - (distanceToDriver / maxDistance) * 100) : 50;
    return Math.round((outletScore + driverScore) / 2);
  }

  calculateAvailabilityConfidence(outletLoad, driverLoad = 0) {
    const maxLoad = 10;
    const outletScore = Math.max(0, 100 - (outletLoad / maxLoad) * 100);
    const driverScore = Math.max(0, 100 - (driverLoad / maxLoad) * 100);
    return Math.round((outletScore + driverScore) / 2);
  }

  calculateLoadBalanceConfidence(currentVariance, projectedVariance) {
    const improvement = Math.max(0, currentVariance - projectedVariance);
    const maxImprovement = currentVariance;
    return maxImprovement > 0 ? Math.round((improvement / maxImprovement) * 100) : 50;
  }

  calculateCostConfidence(cost) {
    const maxCost = 1000; // KES
    const costScore = Math.max(0, 100 - (cost.total / maxCost) * 100);
    return Math.round(costScore);
  }

  calculatePreferenceConfidence(prefs) {
    let score = 50; // Base score
    if (prefs.preferredOutlet) score += 25;
    if (prefs.preferredDriver) score += 25;
    return Math.min(100, score);
  }

  async storeRoutingDecision(orderId, routingResult, algorithm) {
    const decision = {
      orderId: orderId,
      algorithm: algorithm,
      selectedOutlet: routingResult.outlet?._id,
      selectedDriver: routingResult.driver?._id,
      confidence: routingResult.confidence,
      metrics: routingResult.metrics,
      timestamp: new Date()
    };
    
    await cacheManager.set(`routing_decision:${orderId}`, decision, 24 * 60 * 60);
    
    logger.info('Routing decision stored', decision);
  }

  // Batch routing for multiple orders
  async batchRouteOrders(orderIds, algorithm = null) {
    const results = [];
    
    for (const orderId of orderIds) {
      try {
        const result = await this.routeOrder(orderId, algorithm);
        results.push({ orderId, success: true, result });
      } catch (error) {
        results.push({ orderId, success: false, error: error.message });
      }
    }
    
    return results;
  }

  // Get routing analytics
  async getRoutingAnalytics(timeRange = '24h') {
    const startDate = new Date();
    if (timeRange === '24h') {
      startDate.setHours(startDate.getHours() - 24);
    } else if (timeRange === '7d') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (timeRange === '30d') {
      startDate.setDate(startDate.getDate() - 30);
    }

    const orders = await EnhancedOrder.find({
      createdAt: { $gte: startDate },
      'status.current': { $ne: 'draft' }
    });

    const analytics = {
      totalOrders: orders.length,
      algorithmUsage: {},
      averageDeliveryTime: 0,
      successRate: 0,
      outletDistribution: {},
      driverUtilization: {}
    };

    // Calculate analytics
    for (const order of orders) {
      // Algorithm usage would be tracked from routing decisions
      // Outlet distribution
      const outletId = order.outlet.toString();
      analytics.outletDistribution[outletId] = (analytics.outletDistribution[outletId] || 0) + 1;
      
      // Driver utilization
      if (order.driverAssignment?.driver) {
        const driverId = order.driverAssignment.driver.toString();
        analytics.driverUtilization[driverId] = (analytics.driverUtilization[driverId] || 0) + 1;
      }
    }

    return analytics;
  }
}

export default new SmartRoutingService();











