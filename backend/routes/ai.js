import express from 'express';
import aiStockMonitor from '../services/aiStockMonitor.js';
import notificationService from '../services/notificationService.js';
import { asyncHandler } from '../middleware/validate.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Chatbot API endpoint
router.post('/chatbot', asyncHandler(async (req, res) => {
  const { message, userId, context = {} } = req.body;

  if (!message) {
    return sendError(res, 'Message is required', 400);
  }

  try {
    // Process message with AI logic
    const response = await processChatbotMessage(message, userId, context);
    
    return sendSuccess(res, {
      message: 'Chatbot response generated successfully',
      data: response
    });
  } catch (error) {
    logger.error('Chatbot error:', error);
    return sendError(res, 'Error processing chatbot message', 500);
  }
}));

// Smart alerts API endpoint
router.post('/smart-alerts/send', authenticate, asyncHandler(async (req, res) => {
  try {
    const alerts = await aiStockMonitor.sendSmartAlerts();
    
    return sendSuccess(res, {
      message: 'Smart alerts sent successfully',
      data: {
        totalAlerts: alerts.length,
        alerts: alerts.slice(0, 10) // Return first 10 for preview
      }
    });
  } catch (error) {
    logger.error('Smart alerts error:', error);
    return sendError(res, 'Error sending smart alerts', 500);
  }
}));

// Get consumption patterns analysis
router.get('/analytics/consumption-patterns', authenticate, asyncHandler(async (req, res) => {
  try {
    const patterns = await aiStockMonitor.analyzeConsumptionPatterns();
    
    return sendSuccess(res, {
      message: 'Consumption patterns analyzed successfully',
      data: {
        totalCustomers: Object.keys(patterns).length,
        patterns: patterns
      }
    });
  } catch (error) {
    logger.error('Consumption patterns error:', error);
    return sendError(res, 'Error analyzing consumption patterns', 500);
  }
}));

// Get reorder predictions
router.get('/analytics/reorder-predictions', authenticate, asyncHandler(async (req, res) => {
  try {
    const predictions = await aiStockMonitor.predictReorderNeeds();
    
    return sendSuccess(res, {
      message: 'Reorder predictions generated successfully',
      data: {
        totalPredictions: predictions.length,
        highUrgency: predictions.filter(p => p.urgency === 'high').length,
        mediumUrgency: predictions.filter(p => p.urgency === 'medium').length,
        lowUrgency: predictions.filter(p => p.urgency === 'low').length,
        predictions: predictions
      }
    });
  } catch (error) {
    logger.error('Reorder predictions error:', error);
    return sendError(res, 'Error generating reorder predictions', 500);
  }
}));

// Get stock alerts
router.get('/analytics/stock-alerts', authenticate, asyncHandler(async (req, res) => {
  try {
    const alerts = await aiStockMonitor.checkStockLevels();
    
    return sendSuccess(res, {
      message: 'Stock alerts generated successfully',
      data: {
        totalAlerts: alerts.length,
        criticalAlerts: alerts.filter(a => a.type === 'critical').length,
        lowAlerts: alerts.filter(a => a.type === 'low').length,
        alerts: alerts
      }
    });
  } catch (error) {
    logger.error('Stock alerts error:', error);
    return sendError(res, 'Error generating stock alerts', 500);
  }
}));

// Send test notification
router.post('/notifications/test', authenticate, asyncHandler(async (req, res) => {
  const { email, phone, message } = req.body;

  try {
    const results = [];

    // Send test email
    if (email) {
      const emailResult = await notificationService.sendEmail(
        email,
        'Test Notification - Abai Springs AI',
        message || 'This is a test notification from Abai Springs AI system.',
        { ctaText: 'Visit Website', ctaUrl: process.env.FRONTEND_URL }
      );
      results.push({ channel: 'email', success: true, result: emailResult });
    }

    // Send test WhatsApp
    if (phone) {
      const whatsappResult = await notificationService.sendWhatsApp(
        phone,
        message || 'This is a test WhatsApp notification from Abai Springs AI system. 💧'
      );
      results.push({ channel: 'whatsapp', success: true, result: whatsappResult });
    }

    return sendSuccess(res, {
      message: 'Test notifications sent successfully',
      data: results
    });
  } catch (error) {
    logger.error('Test notification error:', error);
    return sendError(res, 'Error sending test notifications', 500);
  }
}));

// AI system status
router.get('/status', asyncHandler(async (req, res) => {
  try {
    const status = {
      chatbot: {
        status: 'active',
        features: ['order_assistance', 'stock_inquiry', 'delivery_tracking', 'customer_support']
      },
      smartAlerts: {
        status: 'active',
        features: ['consumption_analysis', 'reorder_predictions', 'stock_monitoring', 'personalized_messages']
      },
      notifications: {
        status: notificationService.emailTransporter ? 'active' : 'limited',
        channels: ['email', 'whatsapp'],
        emailConfigured: !!notificationService.emailTransporter
      },
      monitoring: {
        status: 'active',
        schedule: {
          consumptionAnalysis: 'Daily at 2 AM',
          stockChecks: 'Every 6 hours',
          smartAlerts: 'Daily at 2 AM'
        }
      }
    };

    return sendSuccess(res, {
      message: 'AI system status retrieved successfully',
      data: status
    });
  } catch (error) {
    logger.error('AI status error:', error);
    return sendError(res, 'Error retrieving AI system status', 500);
  }
}));

// Process chatbot message with AI logic
async function processChatbotMessage(message, userId, context) {
  const lowerMessage = message.toLowerCase();
  
  // Enhanced AI logic with context awareness
  if (lowerMessage.includes('order') || lowerMessage.includes('buy') || lowerMessage.includes('purchase')) {
    return {
      content: `Great! I can help you order water. Here are our available products:

• 500ml - Ksh 50 (Perfect for on-the-go)
• 1L - Ksh 80 (Great for daily use)
• 5L - Ksh 300 (Ideal for families)
• 10L - Ksh 500 (Perfect for gatherings)
• 20L - Ksh 800 (Best value for large families)

Would you like me to help you place an order?`,
      quickReplies: ['Place Order', 'Check Prices', 'View Products', 'Back to Menu'],
      intent: 'order_inquiry',
      confidence: 0.95
    };
  }
  
  else if (lowerMessage.includes('stock') || lowerMessage.includes('available') || lowerMessage.includes('check')) {
    return {
      content: `I'll check the current stock levels for you. Let me fetch the latest information...`,
      quickReplies: ['Check Specific Product', 'View All Products', 'Back to Menu'],
      intent: 'stock_inquiry',
      confidence: 0.90
    };
  }
  
  else if (lowerMessage.includes('delivery') || lowerMessage.includes('track') || lowerMessage.includes('status')) {
    return {
      content: `I can help you track your delivery! Do you have an order number, or would you like me to check your recent orders?`,
      quickReplies: ['Enter Order Number', 'Check Recent Orders', 'Delivery Info', 'Back to Menu'],
      intent: 'delivery_tracking',
      confidence: 0.88
    };
  }
  
  else if (lowerMessage.includes('product') || lowerMessage.includes('info') || lowerMessage.includes('details')) {
    return {
      content: `Here's information about our premium water products:

🌊 **Abai Springs Water**
- Source: Pristine springs at Mt. Kenya foothills
- Natural filtration through volcanic rock
- Rich in essential minerals
- Eco-friendly packaging

💧 **Sprinkle Water**
- Premium purified water
- Advanced filtration technology
- Perfect for sensitive applications
- Available in multiple sizes

Which product would you like to know more about?`,
      quickReplies: ['Abai Springs Details', 'Sprinkle Details', 'Compare Products', 'Back to Menu'],
      intent: 'product_inquiry',
      confidence: 0.92
    };
  }
  
  else if (lowerMessage.includes('support') || lowerMessage.includes('help') || lowerMessage.includes('issue')) {
    return {
      content: `I'm here to help! What kind of support do you need?

• Order issues
• Delivery problems
• Product quality concerns
• Account management
• Payment issues
• General inquiries

Please describe your issue and I'll assist you.`,
      quickReplies: ['Order Issue', 'Delivery Problem', 'Quality Concern', 'Account Help', 'Back to Menu'],
      intent: 'customer_support',
      confidence: 0.85
    };
  }
  
  else if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('how much')) {
    return {
      content: `Here are our current prices:

**Abai Springs:**
• 500ml - Ksh 50
• 1L - Ksh 80
• 5L - Ksh 300
• 20L - Ksh 800

**Sprinkle:**
• 500ml - Ksh 60
• 1L - Ksh 90
• 5L - Ksh 350
• 10L - Ksh 600
• 20L - Ksh 900

*Prices include delivery within Nairobi. Additional charges may apply for other areas.*

Would you like to place an order?`,
      quickReplies: ['Place Order', 'Check Delivery Areas', 'View Promotions', 'Back to Menu'],
      intent: 'pricing_inquiry',
      confidence: 0.87
    };
  }
  
  else {
    return {
      content: `I understand you're asking about "${message}". Let me help you better. You can ask me about:

• Ordering water products
• Checking stock availability
• Tracking deliveries
• Product information
• Customer support
• Pricing and promotions

What would you like to know?`,
      quickReplies: ['Order Water', 'Check Stock', 'Track Delivery', 'Product Info', 'Customer Support'],
      intent: 'general_inquiry',
      confidence: 0.70
    };
  }
}

export default router;












