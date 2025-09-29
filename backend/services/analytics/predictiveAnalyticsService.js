import EnhancedOrder from '../../models/Order.enhanced.js';
import Subscription from '../../models/Subscription.js';
import User from '../../models/User.js';
import cacheManager from '../../utils/cache.js';
import logger from '../../utils/logger.js';

class PredictiveAnalyticsService {
  constructor() {
    this.models = {
      demand: new DemandForecastModel(),
      churn: new ChurnPredictionModel(),
      ltv: new LifetimeValueModel(),
      inventory: new InventoryOptimizationModel(),
      pricing: new DynamicPricingModel()
    };
  }

  // DEMAND FORECASTING
  async forecastDemand(horizon = '7d', location = null) {
    try {
      const historicalData = await this.getHistoricalDemand(horizon, location);
      const externalFactors = await this.getExternalFactors();
      
      const forecast = this.models.demand.predict(historicalData, externalFactors);
      
      return {
        forecast: forecast,
        confidence: this.calculateConfidence(forecast, historicalData),
        factors: externalFactors,
        recommendations: this.generateDemandRecommendations(forecast)
      };
    } catch (error) {
      logger.error('Demand forecasting failed:', error);
      throw error;
    }
  }

  async getHistoricalDemand(horizon, location) {
    const days = this.parseDays(horizon);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const query = {
      createdAt: { $gte: startDate },
      'status.current': { $ne: 'cancelled' }
    };
    
    if (location) {
      query['delivery.coordinates'] = {
        $near: {
          $geometry: { type: 'Point', coordinates: [location.lng, location.lat] },
          $maxDistance: location.radius || 5000 // 5km default
        }
      };
    }

    const orders = await EnhancedOrder.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            hour: { $hour: '$createdAt' }
          },
          count: { $sum: 1 },
          revenue: { $sum: '$pricing.totalAmount' },
          avgOrderValue: { $avg: '$pricing.totalAmount' }
        }
      },
      { $sort: { '_id.date': 1, '_id.hour': 1 } }
    ]);

    return this.processTimeSeriesData(orders);
  }

  async getExternalFactors() {
    return {
      weather: await this.getWeatherData(),
      events: await this.getLocalEvents(),
      seasonality: this.getSeasonalityFactor(),
      economy: await this.getEconomicIndicators(),
      competition: await this.getCompetitionData()
    };
  }

  // CHURN PREDICTION
  async predictCustomerChurn(customerId = null, segment = null) {
    try {
      let customers;
      
      if (customerId) {
        customers = await User.find({ _id: customerId, role: 'customer' });
      } else if (segment) {
        customers = await this.getCustomersBySegment(segment);
      } else {
        customers = await User.find({ role: 'customer' }).limit(1000);
      }

      const predictions = [];
      
      for (const customer of customers) {
        const features = await this.extractChurnFeatures(customer);
        const churnProbability = this.models.churn.predict(features);
        const riskLevel = this.categorizeChurnRisk(churnProbability);
        
        predictions.push({
          customerId: customer._id,
          churnProbability: churnProbability,
          riskLevel: riskLevel,
          features: features,
          recommendations: this.generateRetentionRecommendations(churnProbability, features)
        });
      }

      return {
        predictions: predictions.sort((a, b) => b.churnProbability - a.churnProbability),
        summary: this.summarizeChurnPredictions(predictions),
        retentionStrategies: this.getRetentionStrategies(predictions)
      };
    } catch (error) {
      logger.error('Churn prediction failed:', error);
      throw error;
    }
  }

  async extractChurnFeatures(customer) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Get customer order history
    const orders = await EnhancedOrder.find({ customer: customer._id });
    const recentOrders = orders.filter(o => o.createdAt >= thirtyDaysAgo);
    const previousOrders = orders.filter(o => o.createdAt >= sixtyDaysAgo && o.createdAt < thirtyDaysAgo);

    // Get subscription data
    const subscriptions = await Subscription.find({ customer: customer._id });
    
    return {
      // Recency features
      daysSinceLastOrder: this.daysSince(this.getLastOrderDate(orders)),
      orderFrequencyDecline: this.calculateFrequencyDecline(recentOrders, previousOrders),
      
      // Frequency features
      totalOrders: orders.length,
      ordersLast30Days: recentOrders.length,
      averageOrderInterval: this.calculateAverageInterval(orders),
      
      // Monetary features
      totalSpent: orders.reduce((sum, o) => sum + (o.pricing?.totalAmount || 0), 0),
      spentLast30Days: recentOrders.reduce((sum, o) => sum + (o.pricing?.totalAmount || 0), 0),
      averageOrderValue: orders.length > 0 ? orders.reduce((sum, o) => sum + (o.pricing?.totalAmount || 0), 0) / orders.length : 0,
      
      // Engagement features
      feedbackScore: this.getAverageFeedback(orders),
      supportTickets: this.getSupportTicketCount(customer._id),
      appUsage: this.getAppUsageMetrics(customer._id),
      
      // Subscription features
      hasActiveSubscription: subscriptions.some(s => s.status === 'active'),
      subscriptionCount: subscriptions.length,
      subscriptionPauses: subscriptions.filter(s => s.status === 'paused').length,
      
      // Demographic features
      customerAge: this.calculateCustomerAge(customer.createdAt),
      location: customer.address,
      preferredPaymentMethod: this.getPreferredPaymentMethod(orders),
      
      // Behavioral features
      complaintRate: this.getComplaintRate(orders),
      returnRate: this.getReturnRate(orders),
      promotionSensitivity: this.getPromotionSensitivity(orders)
    };
  }

  // LIFETIME VALUE PREDICTION
  async predictLifetimeValue(customerId = null, segment = null) {
    try {
      let customers;
      
      if (customerId) {
        customers = await User.find({ _id: customerId, role: 'customer' });
      } else if (segment) {
        customers = await this.getCustomersBySegment(segment);
      } else {
        customers = await User.find({ role: 'customer' }).limit(1000);
      }

      const predictions = [];
      
      for (const customer of customers) {
        const features = await this.extractLTVFeatures(customer);
        const predictedLTV = this.models.ltv.predict(features);
        const valueSegment = this.categorizeLTVSegment(predictedLTV);
        
        predictions.push({
          customerId: customer._id,
          currentLTV: features.currentLTV,
          predictedLTV: predictedLTV,
          valueSegment: valueSegment,
          growth: predictedLTV - features.currentLTV,
          features: features,
          recommendations: this.generateLTVRecommendations(predictedLTV, features)
        });
      }

      return {
        predictions: predictions.sort((a, b) => b.predictedLTV - a.predictedLTV),
        summary: this.summarizeLTVPredictions(predictions),
        optimizationStrategies: this.getLTVOptimizationStrategies(predictions)
      };
    } catch (error) {
      logger.error('LTV prediction failed:', error);
      throw error;
    }
  }

  // INVENTORY OPTIMIZATION
  async optimizeInventory(locationId = null, horizon = '7d') {
    try {
      const demandForecast = await this.forecastDemand(horizon, locationId);
      const currentInventory = await this.getCurrentInventory(locationId);
      const supplierData = await this.getSupplierData();
      
      const optimization = this.models.inventory.optimize({
        forecast: demandForecast,
        current: currentInventory,
        suppliers: supplierData,
        constraints: this.getInventoryConstraints()
      });

      return {
        recommendations: optimization.recommendations,
        reorderPoints: optimization.reorderPoints,
        safetyStock: optimization.safetyStock,
        costAnalysis: optimization.costAnalysis,
        riskAssessment: optimization.riskAssessment
      };
    } catch (error) {
      logger.error('Inventory optimization failed:', error);
      throw error;
    }
  }

  // DYNAMIC PRICING
  async optimizePricing(productId = null, location = null) {
    try {
      const marketData = await this.getMarketData(productId, location);
      const demandElasticity = await this.calculateDemandElasticity(productId);
      const competitorPricing = await this.getCompetitorPricing(productId, location);
      const costStructure = await this.getCostStructure(productId);
      
      const pricingOptimization = this.models.pricing.optimize({
        market: marketData,
        elasticity: demandElasticity,
        competition: competitorPricing,
        costs: costStructure
      });

      return {
        currentPrice: marketData.currentPrice,
        recommendedPrice: pricingOptimization.optimalPrice,
        priceChange: pricingOptimization.optimalPrice - marketData.currentPrice,
        expectedImpact: pricingOptimization.expectedImpact,
        confidence: pricingOptimization.confidence,
        testingRecommendations: pricingOptimization.testingPlan
      };
    } catch (error) {
      logger.error('Pricing optimization failed:', error);
      throw error;
    }
  }

  // BUSINESS INTELLIGENCE INSIGHTS
  async generateBusinessInsights(timeRange = '30d') {
    try {
      const insights = {
        customerInsights: await this.generateCustomerInsights(timeRange),
        operationalInsights: await this.generateOperationalInsights(timeRange),
        financialInsights: await this.generateFinancialInsights(timeRange),
        marketInsights: await this.generateMarketInsights(timeRange),
        competitiveInsights: await this.generateCompetitiveInsights(timeRange)
      };

      return {
        insights: insights,
        actionableRecommendations: this.generateActionableRecommendations(insights),
        kpiAlerts: this.generateKPIAlerts(insights),
        opportunityIdentification: this.identifyOpportunities(insights)
      };
    } catch (error) {
      logger.error('Business insights generation failed:', error);
      throw error;
    }
  }

  // HELPER METHODS
  parseDays(horizon) {
    const map = { '1d': 1, '7d': 7, '30d': 30, '90d': 90 };
    return map[horizon] || 7;
  }

  processTimeSeriesData(rawData) {
    // Convert aggregated data into time series format
    return rawData.map(item => ({
      timestamp: new Date(`${item._id.date}T${item._id.hour.toString().padStart(2, '0')}:00:00`),
      orders: item.count,
      revenue: item.revenue,
      avgOrderValue: item.avgOrderValue
    }));
  }

  calculateConfidence(forecast, historical) {
    // Simple confidence calculation based on data quality and variance
    const dataQuality = Math.min(historical.length / 168, 1); // Prefer 1 week of hourly data
    const variance = this.calculateVariance(historical.map(h => h.orders));
    const stability = Math.max(0, 1 - variance / 100);
    
    return Math.round((dataQuality * 0.6 + stability * 0.4) * 100);
  }

  calculateVariance(values) {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  // External data methods (would integrate with real APIs)
  async getWeatherData() {
    return {
      temperature: 25,
      rainfall: 0,
      humidity: 65,
      forecast: 'sunny'
    };
  }

  async getLocalEvents() {
    return [
      { name: 'Local Festival', date: new Date(), impact: 'high' },
      { name: 'School Holiday', date: new Date(), impact: 'medium' }
    ];
  }

  getSeasonalityFactor() {
    const month = new Date().getMonth();
    const factors = [0.9, 0.95, 1.0, 1.1, 1.15, 1.2, 1.25, 1.2, 1.1, 1.0, 0.95, 1.3];
    return factors[month];
  }

  async getEconomicIndicators() {
    return {
      gdpGrowth: 2.5,
      inflation: 5.2,
      unemployment: 7.8,
      consumerConfidence: 75
    };
  }

  async getCompetitionData() {
    return {
      competitors: 3,
      marketShare: 25,
      pricingPressure: 'medium'
    };
  }

  // Additional helper methods for churn prediction
  daysSince(date) {
    if (!date) return 999;
    return Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
  }

  getLastOrderDate(orders) {
    if (orders.length === 0) return null;
    return orders.reduce((latest, order) => 
      order.createdAt > latest ? order.createdAt : latest, orders[0].createdAt);
  }

  calculateFrequencyDecline(recent, previous) {
    const recentFreq = recent.length / 30; // Orders per day
    const previousFreq = previous.length / 30;
    return previousFreq > 0 ? (previousFreq - recentFreq) / previousFreq : 0;
  }

  calculateAverageInterval(orders) {
    if (orders.length < 2) return 0;
    
    const sortedOrders = orders.sort((a, b) => a.createdAt - b.createdAt);
    const intervals = [];
    
    for (let i = 1; i < sortedOrders.length; i++) {
      const interval = (sortedOrders[i].createdAt - sortedOrders[i-1].createdAt) / (1000 * 60 * 60 * 24);
      intervals.push(interval);
    }
    
    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  }

  getAverageFeedback(orders) {
    const ordersWithFeedback = orders.filter(o => o.feedback?.rating);
    if (ordersWithFeedback.length === 0) return 0;
    
    return ordersWithFeedback.reduce((sum, o) => sum + o.feedback.rating, 0) / ordersWithFeedback.length;
  }

  // Placeholder methods (would integrate with real systems)
  getSupportTicketCount(customerId) { return Math.floor(Math.random() * 5); }
  getAppUsageMetrics(customerId) { return Math.floor(Math.random() * 100); }
  calculateCustomerAge(createdAt) { return Math.floor((new Date() - createdAt) / (1000 * 60 * 60 * 24)); }
  getPreferredPaymentMethod(orders) { return 'mpesa'; }
  getComplaintRate(orders) { return Math.random() * 0.1; }
  getReturnRate(orders) { return Math.random() * 0.05; }
  getPromotionSensitivity(orders) { return Math.random(); }

  categorizeChurnRisk(probability) {
    if (probability > 0.7) return 'high';
    if (probability > 0.4) return 'medium';
    return 'low';
  }

  generateRetentionRecommendations(probability, features) {
    const recommendations = [];
    
    if (probability > 0.7) {
      recommendations.push('Immediate intervention required');
      recommendations.push('Offer personalized discount');
      recommendations.push('Direct customer outreach');
    }
    
    if (features.daysSinceLastOrder > 30) {
      recommendations.push('Win-back campaign');
    }
    
    if (features.feedbackScore < 3) {
      recommendations.push('Address service quality issues');
    }
    
    return recommendations;
  }

  // More placeholder methods for completeness
  summarizeChurnPredictions(predictions) { return { highRisk: 0, mediumRisk: 0, lowRisk: 0 }; }
  getRetentionStrategies(predictions) { return []; }
  extractLTVFeatures(customer) { return {}; }
  categorizeLTVSegment(ltv) { return 'medium'; }
  generateLTVRecommendations(ltv, features) { return []; }
  summarizeLTVPredictions(predictions) { return {}; }
  getLTVOptimizationStrategies(predictions) { return []; }
  getCurrentInventory(locationId) { return {}; }
  getSupplierData() { return {}; }
  getInventoryConstraints() { return {}; }
  getMarketData(productId, location) { return {}; }
  calculateDemandElasticity(productId) { return {}; }
  getCompetitorPricing(productId, location) { return {}; }
  getCostStructure(productId) { return {}; }
  generateCustomerInsights(timeRange) { return {}; }
  generateOperationalInsights(timeRange) { return {}; }
  generateFinancialInsights(timeRange) { return {}; }
  generateMarketInsights(timeRange) { return {}; }
  generateCompetitiveInsights(timeRange) { return {}; }
  generateActionableRecommendations(insights) { return []; }
  generateKPIAlerts(insights) { return []; }
  identifyOpportunities(insights) { return []; }
}

// Mock ML Models (in production, these would be real ML models)
class DemandForecastModel {
  predict(historical, factors) {
    // Simple linear trend + seasonality
    const trend = this.calculateTrend(historical);
    const seasonal = factors.seasonality;
    const weather = factors.weather.temperature > 30 ? 1.2 : 1.0;
    
    return historical.map((point, i) => ({
      timestamp: new Date(point.timestamp.getTime() + 24 * 60 * 60 * 1000),
      predictedOrders: Math.max(0, Math.round(point.orders * trend * seasonal * weather)),
      confidence: 0.8
    }));
  }
  
  calculateTrend(data) {
    if (data.length < 2) return 1;
    const first = data[0].orders;
    const last = data[data.length - 1].orders;
    return first > 0 ? last / first : 1;
  }
}

class ChurnPredictionModel {
  predict(features) {
    // Simple heuristic model
    let score = 0;
    
    if (features.daysSinceLastOrder > 30) score += 0.3;
    if (features.orderFrequencyDecline > 0.5) score += 0.25;
    if (features.feedbackScore < 3) score += 0.2;
    if (features.ordersLast30Days === 0) score += 0.25;
    
    return Math.min(score, 1);
  }
}

class LifetimeValueModel {
  predict(features) {
    // Simple LTV calculation
    const avgOrderValue = features.averageOrderValue || 0;
    const frequency = features.totalOrders / Math.max(features.customerAge / 30, 1);
    const lifespan = 24; // Assume 24 months average lifespan
    
    return avgOrderValue * frequency * lifespan;
  }
}

class InventoryOptimizationModel {
  optimize(data) {
    return {
      recommendations: [],
      reorderPoints: {},
      safetyStock: {},
      costAnalysis: {},
      riskAssessment: {}
    };
  }
}

class DynamicPricingModel {
  optimize(data) {
    return {
      optimalPrice: data.market?.currentPrice || 0,
      expectedImpact: {},
      confidence: 0.7,
      testingPlan: {}
    };
  }
}

export default new PredictiveAnalyticsService();













