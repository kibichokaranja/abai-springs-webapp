import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import winston from 'winston';

// Load environment variables
dotenv.config({ path: './config.env' });

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Email configuration using Gmail SMTP
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// Verify email configuration (temporarily disabled to prevent blocking)
// if (process.env.GMAIL_EMAIL && process.env.GMAIL_APP_PASSWORD) {
//   // Use setTimeout to make this non-blocking
//   setTimeout(() => {
//     emailTransporter.verify((error, success) => {
//       if (error) {
//         logger.error('Gmail SMTP configuration failed', { error: error.message });
//       } else {
//         logger.info('Gmail SMTP configured successfully');
//       }
//     });
//   }, 0);
// } else {
//   logger.warn('Gmail email credentials not configured');
// }

// Twilio SMS configuration
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_SMS_FROM = process.env.TWILIO_SMS_FROM || '+1234567890'; // Your Twilio phone number

// Initialize Twilio client
let twilioClient = null;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_ACCOUNT_SID.startsWith('AC')) {
  try {
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    logger.info('Twilio SMS client initialized successfully');
  } catch (error) {
    logger.warn('Twilio initialization failed - SMS will be simulated', { error: error.message });
    twilioClient = null;
  }
} else {
  logger.warn('Twilio credentials not configured - SMS will be simulated');
}

class NotificationService {
  constructor() {
    this.emailQueue = [];
    this.whatsappQueue = [];
  }

  // Send email notification using Gmail SMTP
  async sendEmail(to, subject, htmlContent, textContent = '') {
    try {
      if (!process.env.GMAIL_EMAIL || !process.env.GMAIL_APP_PASSWORD) {
        throw new Error('Gmail email credentials not configured');
      }

      const mailOptions = {
        from: `"Abai Springs" <${process.env.GMAIL_EMAIL}>`,
        to: to,
        subject: subject,
        html: htmlContent,
        text: textContent || htmlContent.replace(/<[^>]*>/g, '') // Strip HTML for text version
      };

      const info = await emailTransporter.sendMail(mailOptions);
      
      logger.info('Email sent successfully via Gmail', { 
        to, 
        subject, 
        messageId: info.messageId 
      });
      
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error('Email sending failed', { 
        to, 
        subject, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }

  // Send SMS notification using Twilio
  async sendSMS(to, message) {
    try {
      // If Twilio is not configured, simulate the message
      if (!twilioClient) {
        logger.warn('Twilio not configured - simulating SMS message', { to });
        console.log(`📱 SMS to ${to}: ${message}`);
        return { success: true, simulated: true };
      }

      // Format phone number for SMS (ensure it starts with +)
      const formattedTo = to.startsWith('+') ? to : `+${to}`;
      
      // Send message via Twilio SMS API
      const messageResponse = await twilioClient.messages.create({
        from: TWILIO_SMS_FROM,
        to: formattedTo,
        body: message
      });

      logger.info('SMS message sent successfully via Twilio', { 
        to: formattedTo, 
        messageSid: messageResponse.sid 
      });
      
      return { 
        success: true, 
        messageSid: messageResponse.sid,
        simulated: false 
      };
    } catch (error) {
      logger.error('WhatsApp sending failed', { to, error: error.message });
      
      // Fallback to simulation if Twilio fails
      console.log(`📱 WhatsApp to ${to}: ${message}`);
      return { success: true, simulated: true, error: error.message };
    }
  }

  // Generate stock alert email template
  generateStockAlertEmail(customerName, productName, outletName, daysLeft, currentStock) {
    const subject = `🚰 Low Stock Alert - ${productName}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1976d2 0%, #4fc3f7 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px; }
          .alert-box { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 15px 0; }
          .cta-button { display: inline-block; background: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💧 Abai Springs</h1>
            <p>Smart Stock Alert</p>
          </div>
          <div class="content">
            <h2>Hello ${customerName}!</h2>
            <p>We noticed your <strong>${productName}</strong> stock is running low.</p>
            
            <div class="alert-box">
              <h3>📊 Your Stock Status:</h3>
              <ul>
                <li><strong>Current Stock:</strong> ${currentStock} bottles</li>
                <li><strong>Estimated Days Left:</strong> ${daysLeft} days</li>
                <li><strong>Nearest Outlet:</strong> ${outletName}</li>
              </ul>
            </div>
            
            <p>Don't run out of your premium drinking water! Order now to ensure uninterrupted supply.</p>
            
            <a href="http://localhost:3001" class="cta-button">🛒 Order Now</a>
            
            <p><small>This alert was sent based on your consumption patterns. You can manage your alert preferences in your account settings.</small></p>
          </div>
          <div class="footer">
            <p>© 2024 Abai Springs. Premium Drinking Water.</p>
            <p>Questions? Contact us at support@abaisprings.com</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Hello ${customerName}!
      
      We noticed your ${productName} stock is running low.
      
      Your Stock Status:
      - Current Stock: ${currentStock} bottles
      - Estimated Days Left: ${daysLeft} days
      - Nearest Outlet: ${outletName}
      
      Don't run out of your premium drinking water! Order now at http://localhost:3001
      
      This alert was sent based on your consumption patterns.
      
      © 2024 Abai Springs. Premium Drinking Water.
    `;

    return { subject, htmlContent, textContent };
  }

  // Generate WhatsApp message template
  generateStockAlertWhatsApp(customerName, productName, outletName, daysLeft, currentStock) {
    return `💧 *Abai Springs - Smart Stock Alert*

Hello ${customerName}!

We noticed your *${productName}* stock is running low.

📊 *Your Stock Status:*
• Current Stock: ${currentStock} bottles
• Estimated Days Left: ${daysLeft} days
• Nearest Outlet: ${outletName}

Don't run out of your premium drinking water! 

🛒 Order now: http://localhost:3001

This alert was sent based on your consumption patterns.

© 2024 Abai Springs. Premium Drinking Water.`;
  }

  // Send customer thank you notification
  async sendCustomerThankYou(order) {
    try {
      // Extract contact information from order data
      // Check both direct properties and Mongoose _doc property
      let customerEmail = order.customerEmail || order.customer?.email || order.email || order._doc?.customerEmail || order._doc?.email;
      let customerPhone = order.customerPhone || order.customer?.phone || order.phone || order._doc?.customerPhone || order._doc?.phone;
      let customerName = order.customerName || order.customer?.name || order.customer?.customerName || order._doc?.customerName || 'Valued Customer';
      
      // Debug: Log the order structure to see what fields are available
      console.log('🔍 Order structure debug:', {
        orderId: order._id,
        hasCustomerName: !!order.customerName,
        customerNameValue: order.customerName,
        hasCustomer: !!order.customer,
        customerKeys: order.customer ? Object.keys(order.customer) : 'no customer object',
        allOrderKeys: Object.keys(order),
        hasDoc: !!order._doc,
        docKeys: order._doc ? Object.keys(order._doc) : 'no _doc',
        docCustomerName: order._doc?.customerName
      });

      // If not found in direct fields, try to extract from notes
      if (!customerEmail && order.notes) {
        const emailMatch = order.notes.match(/Email:\s*([^\s,]+)/i);
        if (emailMatch && emailMatch[1] !== 'Not provided') {
          customerEmail = emailMatch[1];
        }
      }

      if (!customerPhone && order.notes) {
        const phoneMatch = order.notes.match(/Phone:\s*([^\s,]+)/i);
        if (phoneMatch) {
          customerPhone = phoneMatch[1];
        }
      }

      if (!customerName && order.notes) {
        const nameMatch = order.notes.match(/Customer:\s*([^,]+)/i);
        if (nameMatch) {
          customerName = nameMatch[1].trim();
        }
      }

      // Debug logging to see what we're working with
      logger.info('Extracting contact info from order', {
        orderId: order._id,
        customerEmail: customerEmail ? 'found' : 'not found',
        customerPhone: customerPhone ? 'found' : 'not found',
        customerName: customerName,
        notes: order.notes,
        orderKeys: Object.keys(order)
      });

      if (!customerEmail && !customerPhone) {
        logger.warn('No contact information found for order', { 
          orderId: order._id,
          availableFields: Object.keys(order),
          customer: order.customer ? Object.keys(order.customer) : 'no customer object',
          notes: order.notes
        });
        return { success: false, error: 'No contact information' };
      }

      const results = {};

      // Generate order confirmation email
      if (customerEmail) {
        const emailContent = this.generateOrderConfirmationEmail(order, customerName);
        results.email = await this.sendEmail(
          customerEmail,
          emailContent.subject,
          emailContent.htmlContent,
          emailContent.textContent
        );
      }

      // Generate order confirmation WhatsApp message
      if (customerPhone) {
        const whatsappMessage = this.generateOrderConfirmationWhatsApp(order, customerName);
        results.sms = await this.sendSMS(customerPhone, whatsappMessage);
      }

      logger.info('Customer thank you notification sent', {
        orderId: order._id,
        customerEmail: customerEmail ? 'sent' : 'not available',
        customerPhone: customerPhone ? 'sent' : 'not available',
        results
      });

      return results;
    } catch (error) {
      logger.error('Error sending customer thank you notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send staff low stock notification
  async sendStaffLowStock(outlet, product, inventory) {
    try {
      // For now, just log the low stock alert
      // In a real implementation, you would send to staff email/WhatsApp
      logger.warn('Low stock alert', {
        outlet: outlet.name,
        product: product.name,
        currentStock: inventory.availableStock,
        lowStockThreshold: inventory.lowStockThreshold
      });

      console.log(`🚨 LOW STOCK ALERT: ${product.name} at ${outlet.name} - Only ${inventory.availableStock} units left!`);

      return { success: true, simulated: true };
    } catch (error) {
      logger.error('Error sending staff low stock notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Generate order confirmation email template
  generateOrderConfirmationEmail(order, customerName) {
    const subject = `✅ Order Confirmed - ${order.orderNumber || order._id}`;
    
    // Get product icon based on size
    const getProductIcon = (itemName) => {
      const name = (itemName || '').toLowerCase();
      if (name.includes('500ml')) return '💧';
      if (name.includes('1l') || name.includes('1 litre')) return '💧';
      if (name.includes('5l') || name.includes('5 litre')) return '💧';
      if (name.includes('10l') || name.includes('10 litre')) return '💧';
      if (name.includes('20l') || name.includes('20 litre')) return '💧';
      return '💧';
    };

    const itemsList = order.items.map(item => {
      const productName = item.name || item.product?.name || 'Product';
      const quantity = item.quantity || item.qty || 1;
      const price = item.price || item.product?.price || 0;
      const total = price * quantity;
      
      return `
        <div class="order-item">
          <div class="item-details">
            <div class="item-name">• ${productName}</div>
            <div class="item-meta">Qty: ${quantity} × Ksh ${price}</div>
          </div>
          <div class="item-total">Ksh ${total}</div>
        </div>
      `;
    }).join('');

    // Extract delivery information
    const deliveryAddress = order.deliveryAddress || order.address || 'Not specified';
    const outletName = order.outlet?.name || order.outletName || 'Not specified';
    const estimatedDelivery = order.estimatedDelivery || '2-3 business days';
    const deliveryInstructions = order.deliveryInstructions || 'Standard delivery';
    const orderStatus = order.status || 'Pending';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Confirmation - Abai Springs</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            margin: 0;
            padding: 20px;
          }
          .email-container { 
            max-width: 650px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 20px; 
            overflow: hidden; 
            box-shadow: 0 20px 60px rgba(0,0,0,0.1);
          }
          .header { 
            background: linear-gradient(135deg, #1976d2 0%, #4fc3f7 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center; 
            position: relative;
            overflow: hidden;
          }
          .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="water" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="2" fill="rgba(255,255,255,0.1)"/></pattern></defs><rect width="100" height="100" fill="url(%23water)"/></svg>');
            opacity: 0.3;
          }
          .header-content { position: relative; z-index: 1; }
          .logo { 
            font-size: 36px; 
            font-weight: 700; 
            margin-bottom: 10px; 
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header-subtitle { 
            font-size: 18px; 
            opacity: 0.9; 
            margin-bottom: 20px;
          }
          .success-icon {
            width: 80px;
            height: 80px;
            background: rgba(255,255,255,0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            font-size: 40px;
            backdrop-filter: blur(10px);
            border: 2px solid rgba(255,255,255,0.3);
          }
          .content { 
            padding: 40px 30px; 
            background: #f8f9fa;
          }
          .greeting {
            font-size: 24px;
            font-weight: 600;
            color: #1976d2;
            margin-bottom: 15px;
          }
          .intro-text {
            font-size: 16px;
            color: #666;
            margin-bottom: 30px;
            line-height: 1.8;
          }
          .order-card { 
            background: white; 
            border-radius: 16px; 
            padding: 30px; 
            margin: 25px 0; 
            box-shadow: 0 8px 32px rgba(0,0,0,0.08);
            border: 1px solid #e3f2fd;
          }
          .order-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e3f2fd;
          }
          .order-title {
            font-size: 20px;
            font-weight: 600;
            color: #1976d2;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .status-badge { 
            display: inline-block; 
            background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%); 
            color: white; 
            padding: 8px 16px; 
            border-radius: 25px; 
            font-size: 14px; 
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
          }
          .order-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 25px;
            margin-bottom: 35px;
          }
          .info-item {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 15px 0;
          }
          .info-label { 
            font-weight: 600; 
            color: #666; 
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
          }
          .info-value { 
            color: #333; 
            font-size: 16px;
            font-weight: 500;
            line-height: 1.4;
          }
          .items-section {
            margin: 30px 0;
          }
          .section-title {
            font-size: 18px;
            font-weight: 600;
            color: #1976d2;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .order-item { 
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 20px 0;
            border-bottom: 1px solid #f0f0f0;
          }
          .order-item:last-child { 
            border-bottom: none; 
          }
          .item-image {
            flex-shrink: 0;
          }
          .item-details {
            flex: 1;
          }
          .item-name {
            font-weight: 600;
            color: #333;
            font-size: 16px;
            margin-bottom: 5px;
          }
          .item-meta {
            color: #666;
            font-size: 14px;
          }
          .item-total {
            font-weight: 600;
            color: #1976d2;
            font-size: 16px;
          }
          .delivery-section {
            background: #e3f2fd;
            border-radius: 12px;
            padding: 20px;
            margin: 25px 0;
          }
          .delivery-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: 20px;
          }
          .total-section { 
            background: linear-gradient(135deg, #1976d2 0%, #4fc3f7 100%); 
            color: white;
            padding: 25px; 
            border-radius: 16px; 
            text-align: center; 
            margin: 25px 0;
            box-shadow: 0 8px 32px rgba(25, 118, 210, 0.3);
          }
          .total-amount {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 5px;
          }
          .total-label {
            font-size: 16px;
            opacity: 0.9;
          }
          .cta-section {
            text-align: center;
            margin: 30px 0;
          }
          .cta-button { 
            display: inline-block; 
            background: linear-gradient(135deg, #1976d2 0%, #4fc3f7 100%); 
            color: white; 
            padding: 16px 32px; 
            text-decoration: none; 
            border-radius: 50px; 
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 8px 24px rgba(25, 118, 210, 0.3);
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 32px rgba(25, 118, 210, 0.4);
          }
          .contact-info {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 20px;
            margin: 25px 0;
            text-align: center;
          }
          .contact-title {
            font-weight: 600;
            color: #1976d2;
            margin-bottom: 10px;
          }
          .contact-details {
            color: #666;
            font-size: 14px;
            line-height: 1.6;
          }
          .footer { 
            text-align: center; 
            margin-top: 30px; 
            color: #666; 
            font-size: 14px;
            padding: 20px;
            background: #f8f9fa;
            border-top: 1px solid #e0e0e0;
          }
          .footer-logo {
            font-size: 20px;
            font-weight: 700;
            color: #1976d2;
            margin-bottom: 10px;
          }
          .social-links {
            margin: 15px 0;
          }
          .social-link {
            display: inline-block;
            margin: 0 10px;
            color: #1976d2;
            text-decoration: none;
            font-weight: 500;
          }
          @media (max-width: 600px) {
            .order-info, .delivery-grid {
              grid-template-columns: 1fr;
            }
            .order-item {
              flex-direction: column;
              text-align: center;
            }
            .item-image {
              margin-bottom: 10px;
            }
            .content {
              padding: 20px;
            }
            .order-card {
              padding: 20px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <div class="header-content">
              <div class="logo">💧 Abai Springs</div>
              <div class="header-subtitle">Order Confirmation</div>
            </div>
          </div>
          <div class="content">
            <div class="greeting">Hello ${customerName || 'Valued Customer'}!</div>
            <div class="intro-text">Thank you for your order! We're excited to deliver premium drinking water to you. Your order is being prepared with care.</div>
            
            <div class="order-card">
              <div class="order-header">
                <div class="order-title">Order Details</div>
                <div class="status-badge">${orderStatus}</div>
              </div>
              
              <div class="order-info">
                <div class="info-item">
                  <div class="info-label">Order Number:</div>
                  <div class="info-value">${order.orderNumber || order._id}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Order Date:</div>
                  <div class="info-value">${new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Payment Method:</div>
                  <div class="info-value">${order.paymentMethod === 'cash_on_delivery' ? 'Cash on Delivery' : order.paymentMethod?.toUpperCase() || 'Not specified'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Estimated Delivery:</div>
                  <div class="info-value">${estimatedDelivery}</div>
                </div>
              </div>
              
              <div class="items-section">
                <div class="section-title">Items Ordered</div>
                ${itemsList}
              </div>
              
              <div class="delivery-section">
                <div class="section-title">Delivery Information</div>
                <div class="delivery-grid">
                  <div class="info-item">
                    <div class="info-label">Address:</div>
                    <div class="info-value">${deliveryAddress}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Outlet:</div>
                    <div class="info-value">${outletName}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Instructions:</div>
                    <div class="info-value">${deliveryInstructions}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Delivery Time:</div>
                    <div class="info-value">${estimatedDelivery}</div>
                  </div>
                </div>
              </div>
              
              <div class="total-section">
                <div class="total-label">Total Amount</div>
                <div class="total-amount">Ksh ${order.totalAmount || order.total || 0}</div>
              </div>
            </div>
            
            <div class="cta-section">
              <a href="http://localhost:3001/track-order.html?orderId=${order._id}" class="cta-button">Track Your Order</a>
            </div>
          </div>
          <div class="footer">
            <div class="footer-logo">Abai Springs</div>
            <p>Premium Drinking Water</p>
            <p>© 2024 Abai Springs. All rights reserved.</p>
            <p>Thank you for choosing Abai Springs!</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Hello ${customerName}!
      
      Thank you for your order! We're excited to deliver premium drinking water to you.
      
      ORDER DETAILS:
      - Order Number: ${order.orderNumber || order._id}
      - Order Date: ${new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
      - Payment Method: ${order.paymentMethod === 'cash_on_delivery' ? 'Cash on Delivery' : order.paymentMethod?.toUpperCase() || 'Not specified'}
      - Order Status: ${orderStatus}
      
      ITEMS ORDERED:
      ${order.items.map(item => `- ${item.name || item.product?.name || 'Product'} - Qty: ${item.quantity || item.qty} - Ksh ${item.price || item.product?.price || 0}`).join('\n')}
      
      DELIVERY INFORMATION:
      - Delivery Address: ${deliveryAddress}
      - Outlet: ${outletName}
      - Estimated Delivery: ${estimatedDelivery}
      - Delivery Instructions: ${deliveryInstructions}
      
      Total Amount: Ksh ${order.totalAmount || order.total || 0}
      
      Your order is being prepared and will be delivered to you soon.
      
      Track your order: http://localhost:3001/track-order.html?orderId=${order._id}
      
      Questions? Contact us at support@abaisprings.com or call +254 700 000 000
      
      © 2024 Abai Springs. Premium Drinking Water.
    `;

    return { subject, htmlContent, textContent };
  }

  // Generate order confirmation WhatsApp message
  generateOrderConfirmationWhatsApp(order, customerName) {
    const itemsList = order.items.map(item => 
      `• ${item.name || item.product?.name || 'Product'} - Qty: ${item.quantity || item.qty} - Ksh ${item.price || item.product?.price || 0}`
    ).join('\n');

    return `💧 *Abai Springs - Order Confirmation*

Hello ${customerName}! 👋

✅ *Your order has been confirmed!*

📋 *Order Details:*
• Order Number: ${order.orderNumber || order._id}
• Order Date: ${new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
• Payment Method: ${order.paymentMethod === 'cash_on_delivery' ? 'Cash on Delivery' : order.paymentMethod?.toUpperCase() || 'Not specified'}

🛒 *Items Ordered:*
${itemsList}

💰 *Total Amount: Ksh ${order.totalAmount || order.total || 0}*

🚚 Your order is being prepared and will be delivered to you soon!

📦 Track your order: http://localhost:3001/track-order.html?orderId=${order._id}

❓ Questions? Contact us at support@abaisprings.com or call +254 700 000 000

Thank you for choosing Abai Springs! 💧

© 2024 Abai Springs. Premium Drinking Water.`;
  }

  // Send stock alert notifications
  async sendStockAlert(customer, stockAlert, product, outlet) {
    const daysLeft = Math.ceil((stockAlert.predictedRunOutDate - new Date()) / (1000 * 60 * 60 * 24));
    const currentStock = stockAlert.currentStockLevel;

    // Generate messages
    const emailContent = this.generateStockAlertEmail(
      customer.name,
      product.name,
      outlet.name,
      daysLeft,
      currentStock
    );

    const whatsappMessage = this.generateStockAlertWhatsApp(
      customer.name,
      product.name,
      outlet.name,
      daysLeft,
      currentStock
    );

    const results = {};

    // Send email if enabled
    if (stockAlert.preferredChannels.email && customer.email) {
      results.email = await this.sendEmail(
        customer.email,
        emailContent.subject,
        emailContent.htmlContent,
        emailContent.textContent
      );
    }

    // Send WhatsApp if enabled
    if (stockAlert.preferredChannels.whatsapp && customer.phone) {
      results.sms = await this.sendSMS(
        customer.phone,
        whatsappMessage
      );
    }

    logger.info('Stock alert notifications sent', {
      customerId: customer._id,
      productId: product._id,
      results
    });

    return results;
  }

  // 🚨 REAL SMART STOCK ALERT SYSTEM - Personalized customer consumption tracking
  async checkStockLevels(order) {
    try {
      console.log('🧠 Processing order with REAL Smart Stock Alert System:', order._id);
      
      // Import consumption tracker dynamically to avoid circular imports
      const { default: consumptionTracker } = await import('./consumptionTracker.js');
      
      // Process the order for consumption tracking
      await consumptionTracker.processNewOrder(order);
      
      console.log('✅ REAL Smart Stock Alert System processing completed for order:', order._id);
      
    } catch (error) {
      logger.error('Error in REAL smart stock alert system:', error);
      console.log('❌ Error in REAL stock level check:', error.message);
    }
  }

  // Send personalized stock alert based on customer consumption patterns
  async sendPersonalizedStockAlert(alertData) {
    try {
      const {
        customerName,
        customerEmail,
        customerPhone,
        productName,
        currentStock,
        alertLevel,
        daysUntilRunOut,
        consumptionRate,
        averageOrderSize
      } = alertData;

      // Generate personalized alert message
      const emailContent = this.generatePersonalizedStockAlertEmail(
        customerName,
        productName,
        currentStock,
        alertLevel,
        daysUntilRunOut,
        consumptionRate,
        averageOrderSize
      );

      const whatsappMessage = this.generatePersonalizedStockAlertWhatsApp(
        customerName,
        productName,
        currentStock,
        alertLevel,
        daysUntilRunOut,
        consumptionRate,
        averageOrderSize
      );

      const results = {};

      // Send email alert
      if (customerEmail) {
        results.email = await this.sendEmail(
          customerEmail,
          emailContent.subject,
          emailContent.htmlContent,
          emailContent.textContent
        );
      }

      // Send WhatsApp alert (simulated for now)
      if (customerPhone) {
        results.sms = await this.sendSMS(customerPhone, whatsappMessage);
      }

      logger.info('Personalized stock alert sent', {
        customerEmail,
        customerPhone,
        productName,
        currentStock,
        alertLevel,
        results
      });

      return { success: true, results };

    } catch (error) {
      logger.error('Error sending personalized stock alert:', error);
      return { success: false, error: error.message };
    }
  }

  // Generate personalized stock alert email
  generatePersonalizedStockAlertEmail(customerName, productName, currentStock, alertLevel, daysUntilRunOut, consumptionRate, averageOrderSize) {
    const urgencyEmoji = {
      'warning': '⚠️',
      'urgent': '🚨',
      'critical': '🔥'
    };

    const urgencyColor = {
      'warning': '#ff9800',
      'urgent': '#f44336',
      'critical': '#d32f2f'
    };

    const subject = `${urgencyEmoji[alertLevel]} Time to Reorder ${productName} - ${currentStock} bottles left`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1976d2 0%, #4fc3f7 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px; }
          .alert-box { background: ${urgencyColor[alertLevel]}; color: white; border-radius: 8px; padding: 15px; margin: 15px 0; }
          .insight-box { background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin: 15px 0; }
          .cta-button { display: inline-block; background: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💧 Abai Springs</h1>
            <p>Smart Consumption Alert</p>
          </div>
          <div class="content">
            <h2>Hello ${customerName}!</h2>
            
            <div class="alert-box">
              <h3>${urgencyEmoji[alertLevel]} ${alertLevel.toUpperCase()} ALERT</h3>
              <p>Your ${productName} stock is running low!</p>
              <p><strong>Current Stock:</strong> ${currentStock} bottles</p>
              ${daysUntilRunOut ? `<p><strong>Estimated Days Left:</strong> ${daysUntilRunOut} days</p>` : ''}
            </div>
            
            <div class="insight-box">
              <h3>📊 Your Consumption Insights:</h3>
              <ul>
                <li><strong>Consumption Rate:</strong> ${consumptionRate.toFixed(1)} bottles per day</li>
                <li><strong>Average Order Size:</strong> ${averageOrderSize} bottles</li>
                <li><strong>Recommended Order:</strong> ${Math.ceil(consumptionRate * 14)} bottles (2 weeks supply)</li>
              </ul>
            </div>
            
            <p>Based on your consumption patterns, we recommend ordering now to ensure uninterrupted supply.</p>
            
            <a href="http://localhost:3001" class="cta-button">🛒 Reorder Now</a>
            
            <p><small>This alert was sent based on your personal consumption patterns. You can manage your alert preferences in your account settings.</small></p>
          </div>
          <div class="footer">
            <p>© 2024 Abai Springs. Premium Drinking Water.</p>
            <p>Questions? Contact us at support@abaisprings.com</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Hello ${customerName}!
      
      ${urgencyEmoji[alertLevel]} ${alertLevel.toUpperCase()} ALERT
      Your ${productName} stock is running low!
      
      Current Stock: ${currentStock} bottles
      ${daysUntilRunOut ? `Estimated Days Left: ${daysUntilRunOut} days` : ''}
      
      Your Consumption Insights:
      - Consumption Rate: ${consumptionRate.toFixed(1)} bottles per day
      - Average Order Size: ${averageOrderSize} bottles
      - Recommended Order: ${Math.ceil(consumptionRate * 14)} bottles (2 weeks supply)
      
      Based on your consumption patterns, we recommend ordering now.
      
      Reorder now: http://localhost:3001
      
      This alert was sent based on your personal consumption patterns.
      
      © 2024 Abai Springs. Premium Drinking Water.
    `;

    return { subject, htmlContent, textContent };
  }

  // Generate personalized stock alert WhatsApp message
  generatePersonalizedStockAlertWhatsApp(customerName, productName, currentStock, alertLevel, daysUntilRunOut, consumptionRate, averageOrderSize) {
    const urgencyEmoji = {
      'warning': '⚠️',
      'urgent': '🚨',
      'critical': '🔥'
    };

    return `💧 *Abai Springs - Smart Consumption Alert*

Hello ${customerName}!

${urgencyEmoji[alertLevel]} *${alertLevel.toUpperCase()} ALERT*
Your *${productName}* stock is running low!

📊 *Your Stock Status:*
• Current Stock: ${currentStock} bottles
${daysUntilRunOut ? `• Estimated Days Left: ${daysUntilRunOut} days` : ''}

🧠 *Your Consumption Insights:*
• Consumption Rate: ${consumptionRate.toFixed(1)} bottles per day
• Average Order Size: ${averageOrderSize} bottles
• Recommended Order: ${Math.ceil(consumptionRate * 14)} bottles (2 weeks supply)

Based on your consumption patterns, we recommend ordering now to ensure uninterrupted supply.

🛒 Reorder now: http://localhost:3001

This alert was sent based on your personal consumption patterns.

© 2024 Abai Springs. Premium Drinking Water.`;
  }
}

export default new NotificationService();






