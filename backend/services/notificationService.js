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

    // Extract delivery information - parse address object properly
    let deliveryAddressText = 'Not specified';
    let deliveryCity = '';
    let deliveryPostalCode = '';
    let hasCoordinates = false;
    let mapLink = '';
    
    // Check delivery.formattedAddress first (from checkout)
    if (order.delivery?.formattedAddress) {
      deliveryAddressText = order.delivery.formattedAddress;
      deliveryCity = order.delivery.city || '';
    } else if (order.deliveryAddress) {
      if (typeof order.deliveryAddress === 'string') {
        deliveryAddressText = order.deliveryAddress;
      } else if (order.deliveryAddress.address) {
        deliveryAddressText = order.deliveryAddress.address;
        // Extract city and postal code if address contains them
        const addressParts = deliveryAddressText.split(',').map(s => s.trim());
        if (addressParts.length >= 2) {
          deliveryAddressText = addressParts[0]; // Street address
          deliveryCity = addressParts[1] || '';
          deliveryPostalCode = addressParts[2] || '';
        }
      }
    } else if (order.address) {
      deliveryAddressText = order.address;
    }
    
    // Check for coordinates in delivery object or deliveryAddress
    const coords = order.delivery?.lat && order.delivery?.lng 
      ? { lat: order.delivery.lat, lng: order.delivery.lng }
      : order.deliveryAddress?.coordinates;
    
    if (coords && coords.lat && coords.lng) {
      hasCoordinates = true;
      mapLink = `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
    }
    
    // Format full address nicely
    const formattedAddress = [
      deliveryAddressText,
      deliveryCity,
      deliveryPostalCode
    ].filter(Boolean).join(', ') || 'Not specified';
    
    // Only show outlet if it exists and is a valid name (not null, undefined, empty, or "Not specified")
    const rawOutletName = order.outlet?.name || order.outletName;
    const outletName = rawOutletName && 
                       rawOutletName !== 'Not specified' && 
                       rawOutletName !== 'not specified' &&
                       rawOutletName.trim() !== '' 
                       ? rawOutletName 
                       : null;
    // Use the selected delivery slot if available, otherwise fall back to ETA or default
    const estimatedDelivery = order.deliverySlot 
      ? order.deliverySlot
      : (order.delivery?.etaMin 
        ? `~${order.delivery.etaMin} minutes` 
        : order.estimatedDelivery || '2-3 business days');
    const deliveryInstructions = order.deliveryInstructions || order.orderNotes || 'Standard delivery';
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
                <div class="section-title">🚚 Delivery Information</div>
                <div class="delivery-grid">
                  <div class="info-item" style="grid-column: 1 / -1;">
                    <div class="info-label">📍 Address:</div>
                    <div class="info-value">${formattedAddress}</div>
                    ${hasCoordinates ? `<div style="margin-top: 8px;"><a href="${mapLink}" target="_blank" style="color: #1976d2; text-decoration: none; font-size: 14px; font-weight: 500;">🗺️ View on Google Maps</a></div>` : ''}
                  </div>
                  ${outletName ? `
                  <div class="info-item">
                    <div class="info-label">🏪 Outlet:</div>
                    <div class="info-value">${outletName}</div>
                  </div>
                  ` : ''}
                  ${deliveryInstructions && deliveryInstructions !== 'Standard delivery' ? `
                  <div class="info-item">
                    <div class="info-label">📝 Instructions:</div>
                    <div class="info-value">${deliveryInstructions}</div>
                  </div>
                  ` : ''}
                  <div class="info-item">
                    <div class="info-label">⏱️ Delivery Time:</div>
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
      - Delivery Address: ${formattedAddress}
      ${outletName ? `- Outlet: ${outletName}\n` : ''}${hasCoordinates ? `- Map: ${mapLink}\n` : ''}- Estimated Delivery: ${estimatedDelivery}
      ${deliveryInstructions && deliveryInstructions !== 'Standard delivery' ? `- Delivery Instructions: ${deliveryInstructions}\n` : ''}
      
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

  // ============== STAFF ROLE EMAIL NOTIFICATIONS ==============

  // Send daily business insights to Owner
  async sendOwnerDailyInsights(insights) {
    try {
      const { ownerEmail } = insights;
      if (!ownerEmail) {
        logger.warn('Owner email not provided for daily insights');
        return { success: false, error: 'Owner email not provided' };
      }

      const emailContent = this.generateOwnerDailyInsightsEmail(insights);
      const result = await this.sendEmail(
        ownerEmail,
        emailContent.subject,
        emailContent.htmlContent,
        emailContent.textContent
      );

      logger.info('Owner daily insights email sent', { ownerEmail, result });
      return result;
    } catch (error) {
      logger.error('Error sending owner daily insights:', error);
      return { success: false, error: error.message };
    }
  }

  // Send delivery assignment to Driver
  async sendDriverDeliveryAssignment(deliveryData) {
    try {
      const { driverEmail, driverName } = deliveryData;
      if (!driverEmail) {
        logger.warn('Driver email not provided for delivery assignment');
        return { success: false, error: 'Driver email not provided' };
      }

      const emailContent = this.generateDriverDeliveryAssignmentEmail(deliveryData);
      const result = await this.sendEmail(
        driverEmail,
        emailContent.subject,
        emailContent.htmlContent,
        emailContent.textContent
      );

      logger.info('Driver delivery assignment email sent', { driverEmail, driverName, result });
      return result;
    } catch (error) {
      logger.error('Error sending driver delivery assignment:', error);
      return { success: false, error: error.message };
    }
  }

  // Send sales lead notification to Salesperson
  async sendSalesLeadNotification(leadData) {
    try {
      const { salespersonEmail, salespersonName } = leadData;
      if (!salespersonEmail) {
        logger.warn('Salesperson email not provided for lead notification');
        return { success: false, error: 'Salesperson email not provided' };
      }

      const emailContent = this.generateSalesLeadNotificationEmail(leadData);
      const result = await this.sendEmail(
        salespersonEmail,
        emailContent.subject,
        emailContent.htmlContent,
        emailContent.textContent
      );

      logger.info('Sales lead notification email sent', { salespersonEmail, salespersonName, result });
      return result;
    } catch (error) {
      logger.error('Error sending sales lead notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send warehouse inventory alert
  async sendWarehouseInventoryAlert(alertData) {
    try {
      const { warehouseEmail, warehouseStaff } = alertData;
      if (!warehouseEmail) {
        logger.warn('Warehouse email not provided for inventory alert');
        return { success: false, error: 'Warehouse email not provided' };
      }

      const emailContent = this.generateWarehouseInventoryAlertEmail(alertData);
      const result = await this.sendEmail(
        warehouseEmail,
        emailContent.subject,
        emailContent.htmlContent,
        emailContent.textContent
      );

      logger.info('Warehouse inventory alert email sent', { warehouseEmail, warehouseStaff, result });
      return result;
    } catch (error) {
      logger.error('Error sending warehouse inventory alert:', error);
      return { success: false, error: error.message };
    }
  }

  // Generate Owner Daily Insights Email
  generateOwnerDailyInsightsEmail(insights) {
    const {
      ownerName = 'Business Owner',
      totalRevenue,
      totalOrders,
      topProducts,
      lowStockItems,
      customerGrowth,
      driverPerformance,
      salesPerformance,
      warehouseEfficiency,
      date = new Date().toLocaleDateString()
    } = insights;

    const subject = `📊 Daily Business Insights - ${date}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background: #f5f7fa; }
          .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%); color: white; padding: 40px; text-align: center; }
          .header h1 { margin: 0; font-size: 32px; font-weight: 700; }
          .header p { margin: 10px 0 0; opacity: 0.9; font-size: 18px; }
          .content { padding: 40px; }
          .greeting { font-size: 24px; font-weight: 600; color: #2c3e50; margin-bottom: 30px; }
          .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
          .metric-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 15px; text-align: center; }
          .metric-value { font-size: 28px; font-weight: 700; margin-bottom: 5px; }
          .metric-label { font-size: 14px; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px; }
          .section { margin: 30px 0; padding: 25px; background: #f8f9fa; border-radius: 15px; border-left: 5px solid #3498db; }
          .section h3 { color: #2c3e50; margin-bottom: 20px; font-size: 20px; }
          .alert-item { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 10px 0; }
          .alert-urgent { background: #f8d7da; border-color: #f5c6cb; }
          .performance-item { display: flex; justify-content: space-between; align-items: center; padding: 15px; background: white; border-radius: 8px; margin: 10px 0; }
          .performance-name { font-weight: 600; color: #2c3e50; }
          .performance-value { color: #27ae60; font-weight: 600; }
          .cta-section { text-align: center; margin: 30px 0; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; }
          .footer { background: #2c3e50; color: white; padding: 30px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💧 Abai Springs</h1>
            <p>Daily Business Intelligence Report</p>
          </div>
          <div class="content">
            <div class="greeting">Hello ${ownerName}! 👋</div>
            <p>Here's your comprehensive daily business insights for ${date}. Key metrics and actionable insights to drive your business forward.</p>
            
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-value">Ksh ${totalRevenue?.toLocaleString() || '0'}</div>
                <div class="metric-label">Total Revenue</div>
              </div>
              <div class="metric-card">
                <div class="metric-value">${totalOrders || '0'}</div>
                <div class="metric-label">Orders Processed</div>
              </div>
              <div class="metric-card">
                <div class="metric-value">+${customerGrowth || '0'}%</div>
                <div class="metric-label">Customer Growth</div>
              </div>
              <div class="metric-card">
                <div class="metric-value">${warehouseEfficiency || '0'}%</div>
                <div class="metric-label">Warehouse Efficiency</div>
              </div>
            </div>

            <div class="section">
              <h3>🔥 Top Performing Products</h3>
              ${topProducts?.map(product => `
                <div class="performance-item">
                  <span class="performance-name">${product.name}</span>
                  <span class="performance-value">${product.sales} units sold</span>
                </div>
              `).join('') || '<p>No product data available</p>'}
            </div>

            <div class="section">
              <h3>⚠️ Inventory Alerts</h3>
              ${lowStockItems?.map(item => `
                <div class="alert-item ${item.urgency === 'critical' ? 'alert-urgent' : ''}">
                  <strong>${item.name}</strong> - Only ${item.quantity} units left (${item.urgency} alert)
                </div>
              `).join('') || '<p>All inventory levels are healthy</p>'}
            </div>

            <div class="section">
              <h3>🚚 Driver Performance Summary</h3>
              ${driverPerformance?.map(driver => `
                <div class="performance-item">
                  <span class="performance-name">${driver.name}</span>
                  <span class="performance-value">${driver.deliveries} deliveries | ${driver.rating}⭐</span>
                </div>
              `).join('') || '<p>No driver data available</p>'}
            </div>

            <div class="section">
              <h3>💰 Sales Performance Overview</h3>
              ${salesPerformance?.map(sales => `
                <div class="performance-item">
                  <span class="performance-name">${sales.name}</span>
                  <span class="performance-value">${sales.achievement}% of target</span>
                </div>
              `).join('') || '<p>No sales data available</p>'}
            </div>

            <div class="cta-section">
              <a href="http://localhost:3001/owner-dashboard.html" class="cta-button">View Full Dashboard</a>
            </div>
          </div>
          <div class="footer">
            <p>© 2024 Abai Springs. Premium Drinking Water.</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Daily Business Insights - ${date}
      
      Hello ${ownerName}!
      
      Here's your comprehensive daily business insights for ${date}:
      
      KEY METRICS:
      - Total Revenue: Ksh ${totalRevenue?.toLocaleString() || '0'}
      - Total Orders: ${totalOrders || '0'}
      - Customer Growth: +${customerGrowth || '0'}%
      - Warehouse Efficiency: ${warehouseEfficiency || '0'}%
      
      TOP PERFORMING PRODUCTS:
      ${topProducts?.map(product => `- ${product.name}: ${product.sales} units sold`).join('\n') || 'No product data available'}
      
      INVENTORY ALERTS:
      ${lowStockItems?.map(item => `- ${item.name}: Only ${item.quantity} units left (${item.urgency} alert)`).join('\n') || 'All inventory levels are healthy'}
      
      DRIVER PERFORMANCE:
      ${driverPerformance?.map(driver => `- ${driver.name}: ${driver.deliveries} deliveries | ${driver.rating}⭐`).join('\n') || 'No driver data available'}
      
      SALES PERFORMANCE:
      ${salesPerformance?.map(sales => `- ${sales.name}: ${sales.achievement}% of target`).join('\n') || 'No sales data available'}
      
      View full dashboard: http://localhost:3001/owner-dashboard.html
      
      © 2024 Abai Springs. Premium Drinking Water.
    `;

    return { subject, htmlContent, textContent };
  }

  // Generate Driver Delivery Assignment Email
  generateDriverDeliveryAssignmentEmail(deliveryData) {
    const {
      driverName = 'Driver',
      orderNumber,
      customerName,
      deliveryAddress,
      deliveryTime,
      items,
      specialInstructions,
      estimatedDuration,
      routeOptimization
    } = deliveryData;

    const subject = `🚚 New Delivery Assignment - Order #${orderNumber}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background: #f5f7fa; }
          .container { max-width: 700px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); color: white; padding: 40px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
          .header p { margin: 10px 0 0; opacity: 0.9; }
          .content { padding: 40px; }
          .greeting { font-size: 24px; font-weight: 600; color: #27ae60; margin-bottom: 20px; }
          .delivery-card { background: #f8f9fa; border-radius: 15px; padding: 25px; margin: 20px 0; border-left: 5px solid #27ae60; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
          .info-item { padding: 15px; background: white; border-radius: 10px; }
          .info-label { font-weight: 600; color: #666; font-size: 14px; text-transform: uppercase; margin-bottom: 5px; }
          .info-value { color: #333; font-size: 16px; }
          .items-list { background: #e8f5e8; border-radius: 10px; padding: 20px; margin: 20px 0; }
          .item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #d4edda; }
          .instructions { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 10px; padding: 20px; margin: 20px 0; }
          .route-info { background: #e3f2fd; border-radius: 10px; padding: 20px; margin: 20px 0; }
          .cta-section { text-align: center; margin: 30px 0; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; }
          .footer { background: #27ae60; color: white; padding: 30px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚚 Delivery Assignment</h1>
            <p>Order #${orderNumber}</p>
          </div>
          <div class="content">
            <div class="greeting">Hello ${driverName}! 👋</div>
            <p>You have a new delivery assignment. Please review the details below and confirm receipt.</p>
            
            <div class="delivery-card">
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Customer</div>
                  <div class="info-value">${customerName}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Order Number</div>
                  <div class="info-value">#${orderNumber}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Delivery Time</div>
                  <div class="info-value">${deliveryTime}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Estimated Duration</div>
                  <div class="info-value">${estimatedDuration || '30-45 minutes'}</div>
                </div>
              </div>
            </div>

            <div class="delivery-card">
              <h3 style="color: #27ae60; margin-top: 0;">📍 Delivery Address</h3>
              <p style="font-size: 16px; line-height: 1.8;">${deliveryAddress}</p>
            </div>

            <div class="items-list">
              <h3 style="color: #27ae60; margin-top: 0;">📦 Items to Deliver</h3>
              ${items?.map(item => `
                <div class="item">
                  <span>${item.name}</span>
                  <span><strong>Qty: ${item.quantity}</strong></span>
                </div>
              `).join('') || '<p>No items specified</p>'}
            </div>

            ${specialInstructions ? `
            <div class="instructions">
              <h3 style="color: #856404; margin-top: 0;">📝 Special Instructions</h3>
              <p>${specialInstructions}</p>
            </div>
            ` : ''}

            <div class="route-info">
              <h3 style="color: #1976d2; margin-top: 0;">🗺️ Route Information</h3>
              <p><strong>Optimization:</strong> ${routeOptimization || 'Standard route'}</p>
              <p><strong>Traffic Alert:</strong> Check real-time traffic updates before departure</p>
              <p><strong>Weather:</strong> Sunny, good driving conditions</p>
            </div>

            <div class="cta-section">
              <a href="http://localhost:3001/driver-dashboard.html" class="cta-button">View Delivery Details</a>
            </div>
          </div>
          <div class="footer">
            <p>© 2024 Abai Springs. Safe driving! 🚗</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      New Delivery Assignment - Order #${orderNumber}
      
      Hello ${driverName}!
      
      You have a new delivery assignment:
      
      DELIVERY DETAILS:
      - Customer: ${customerName}
      - Order Number: #${orderNumber}
      - Delivery Time: ${deliveryTime}
      - Estimated Duration: ${estimatedDuration || '30-45 minutes'}
      
      DELIVERY ADDRESS:
      ${deliveryAddress}
      
      ITEMS TO DELIVER:
      ${items?.map(item => `- ${item.name} - Qty: ${item.quantity}`).join('\n') || 'No items specified'}
      
      ${specialInstructions ? `SPECIAL INSTRUCTIONS:\n${specialInstructions}\n` : ''}
      
      ROUTE INFORMATION:
      - Optimization: ${routeOptimization || 'Standard route'}
      - Traffic Alert: Check real-time traffic updates before departure
      - Weather: Sunny, good driving conditions
      
      View delivery details: http://localhost:3001/driver-dashboard.html
      
      Safe driving! 🚗
      © 2024 Abai Springs.
    `;

    return { subject, htmlContent, textContent };
  }

  // Generate Sales Lead Notification Email
  generateSalesLeadNotificationEmail(leadData) {
    const {
      salespersonName = 'Sales Team Member',
      leadName,
      leadEmail,
      leadPhone,
      leadSource,
      leadScore,
      interestLevel,
      estimatedValue,
      territory,
      followUpDate,
      notes
    } = leadData;

    const subject = `🎯 New Sales Lead - ${leadName} (${leadScore}% match)`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background: #f5f7fa; }
          .container { max-width: 700px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 40px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
          .header p { margin: 10px 0 0; opacity: 0.9; }
          .content { padding: 40px; }
          .greeting { font-size: 24px; font-weight: 600; color: #e74c3c; margin-bottom: 20px; }
          .lead-card { background: #f8f9fa; border-radius: 15px; padding: 25px; margin: 20px 0; border-left: 5px solid #e74c3c; }
          .lead-score { display: inline-block; background: ${leadScore >= 80 ? '#27ae60' : leadScore >= 60 ? '#f39c12' : '#e74c3c'}; color: white; padding: 10px 20px; border-radius: 25px; font-weight: 600; margin: 10px 0; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
          .info-item { padding: 15px; background: white; border-radius: 10px; }
          .info-label { font-weight: 600; color: #666; font-size: 14px; text-transform: uppercase; margin-bottom: 5px; }
          .info-value { color: #333; font-size: 16px; }
          .contact-info { background: #e8f4fd; border-radius: 10px; padding: 20px; margin: 20px 0; }
          .interest-indicator { display: flex; align-items: center; gap: 10px; margin: 15px 0; }
          .interest-bar { flex: 1; height: 20px; background: #ecf0f1; border-radius: 10px; overflow: hidden; }
          .interest-fill { height: 100%; background: linear-gradient(90deg, #e74c3c 0%, #f39c12 50%, #27ae60 100%); border-radius: 10px; }
          .action-items { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 10px; padding: 20px; margin: 20px 0; }
          .cta-section { text-align: center; margin: 30px 0; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; }
          .footer { background: #e74c3c; color: white; padding: 30px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎯 New Sales Lead</h1>
            <p>High-Quality Prospect Alert</p>
          </div>
          <div class="content">
            <div class="greeting">Hello ${salespersonName}! 👋</div>
            <p>Great news! You have a new high-quality sales lead in your territory. This prospect shows strong potential for conversion.</p>
            
            <div class="lead-card">
              <h2 style="color: #e74c3c; margin-top: 0;">${leadName}</h2>
              <div class="lead-score">Lead Score: ${leadScore}%</div>
              
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Lead Source</div>
                  <div class="info-value">${leadSource}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Territory</div>
                  <div class="info-value">${territory}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Estimated Value</div>
                  <div class="info-value">Ksh ${estimatedValue?.toLocaleString() || 'Not specified'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Follow-up Date</div>
                  <div class="info-value">${followUpDate}</div>
                </div>
              </div>
            </div>

            <div class="contact-info">
              <h3 style="color: #1976d2; margin-top: 0;">📞 Contact Information</h3>
              <p><strong>Email:</strong> ${leadEmail}</p>
              <p><strong>Phone:</strong> ${leadPhone}</p>
            </div>

            <div class="interest-indicator">
              <span style="font-weight: 600;">Interest Level:</span>
              <div class="interest-bar">
                <div class="interest-fill" style="width: ${interestLevel || 75}%;"></div>
              </div>
              <span style="font-weight: 600;">${interestLevel || 75}%</span>
            </div>

            ${notes ? `
            <div class="action-items">
              <h3 style="color: #856404; margin-top: 0;">📝 Lead Notes</h3>
              <p>${notes}</p>
            </div>
            ` : ''}

            <div class="action-items">
              <h3 style="color: #856404; margin-top: 0;">🎯 Recommended Actions</h3>
              <ul style="margin: 15px 0; padding-left: 20px;">
                <li>Contact within 24 hours for maximum conversion rate</li>
                <li>Prepare personalized product recommendations</li>
                <li>Schedule a product demonstration if interested</li>
                <li>Follow up with email sequence</li>
                <li>Update CRM with interaction notes</li>
              </ul>
            </div>

            <div class="cta-section">
              <a href="http://localhost:3001/sales-dashboard.html" class="cta-button">View Lead Details</a>
            </div>
          </div>
          <div class="footer">
            <p>© 2024 Abai Springs. Close that deal! 💰</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      New Sales Lead - ${leadName} (${leadScore}% match)
      
      Hello ${salespersonName}!
      
      Great news! You have a new high-quality sales lead in your territory.
      
      LEAD DETAILS:
      - Name: ${leadName}
      - Lead Score: ${leadScore}%
      - Lead Source: ${leadSource}
      - Territory: ${territory}
      - Estimated Value: Ksh ${estimatedValue?.toLocaleString() || 'Not specified'}
      - Follow-up Date: ${followUpDate}
      
      CONTACT INFORMATION:
      - Email: ${leadEmail}
      - Phone: ${leadPhone}
      
      INTEREST LEVEL: ${interestLevel || 75}%
      
      ${notes ? `LEAD NOTES:\n${notes}\n` : ''}
      
      RECOMMENDED ACTIONS:
      - Contact within 24 hours for maximum conversion rate
      - Prepare personalized product recommendations
      - Schedule a product demonstration if interested
      - Follow up with email sequence
      - Update CRM with interaction notes
      
      View lead details: http://localhost:3001/sales-dashboard.html
      
      Close that deal! 💰
      © 2024 Abai Springs.
    `;

    return { subject, htmlContent, textContent };
  }

  // Generate Warehouse Inventory Alert Email
  generateWarehouseInventoryAlertEmail(alertData) {
    const {
      warehouseStaff = 'Warehouse Team',
      alertType,
      items,
      priority,
      actionRequired,
      estimatedImpact,
      recommendations,
      supplierInfo
    } = alertData;

    const priorityColors = {
      'low': '#f39c12',
      'medium': '#e67e22',
      'high': '#e74c3c',
      'critical': '#c0392b'
    };

    const priorityEmojis = {
      'low': '📢',
      'medium': '⚠️',
      'high': '🚨',
      'critical': '🔥'
    };

    const subject = `${priorityEmojis[priority]} Warehouse Alert - ${alertType}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background: #f5f7fa; }
          .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, ${priorityColors[priority]} 0%, ${priorityColors[priority]}dd 100%); color: white; padding: 40px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
          .header p { margin: 10px 0 0; opacity: 0.9; }
          .content { padding: 40px; }
          .greeting { font-size: 24px; font-weight: 600; color: ${priorityColors[priority]}; margin-bottom: 20px; }
          .priority-badge { display: inline-block; background: ${priorityColors[priority]}; color: white; padding: 10px 20px; border-radius: 25px; font-weight: 600; margin: 10px 0; text-transform: uppercase; }
          .alert-summary { background: #f8f9fa; border-radius: 15px; padding: 25px; margin: 20px 0; border-left: 5px solid ${priorityColors[priority]}; }
          .items-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
          .item-card { background: white; border-radius: 10px; padding: 20px; border: 1px solid #e0e0e0; }
          .item-name { font-weight: 600; color: #333; font-size: 16px; margin-bottom: 10px; }
          .item-details { color: #666; font-size: 14px; }
          .critical-item { border-color: #e74c3c; background: #fdf2f2; }
          .action-section { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 10px; padding: 20px; margin: 20px 0; }
          .recommendation { background: #e8f5e8; border-radius: 10px; padding: 20px; margin: 20px 0; }
          .supplier-info { background: #e3f2fd; border-radius: 10px; padding: 20px; margin: 20px 0; }
          .cta-section { text-align: center; margin: 30px 0; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, ${priorityColors[priority]} 0%, ${priorityColors[priority]}dd 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; }
          .footer { background: ${priorityColors[priority]}; color: white; padding: 30px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏭 Warehouse Alert</h1>
            <p>${alertType}</p>
          </div>
          <div class="content">
            <div class="greeting">Hello ${warehouseStaff}! 👋</div>
            <div class="priority-badge">${priority} Priority</div>
            <p>Attention required for warehouse operations. Please review the details below and take appropriate action.</p>
            
            <div class="alert-summary">
              <h3 style="color: ${priorityColors[priority]}; margin-top: 0;">Alert Summary</h3>
              <p><strong>Type:</strong> ${alertType}</p>
              <p><strong>Priority:</strong> ${priority.toUpperCase()}</p>
              <p><strong>Action Required:</strong> ${actionRequired}</p>
              <p><strong>Estimated Impact:</strong> ${estimatedImpact}</p>
            </div>

            <div class="items-grid">
              <h3 style="color: #333; width: 100%;">📦 Affected Items</h3>
              ${items?.map(item => `
                <div class="item-card ${item.critical ? 'critical-item' : ''}">
                  <div class="item-name">${item.name}</div>
                  <div class="item-details">
                    <p><strong>Current Stock:</strong> ${item.currentStock}</p>
                    <p><strong>Minimum Required:</strong> ${item.minimumRequired}</p>
                    <p><strong>Status:</strong> ${item.status}</p>
                    ${item.estimatedDaysLeft ? `<p><strong>Days Left:</strong> ${item.estimatedDaysLeft}</p>` : ''}
                  </div>
                </div>
              `).join('') || '<p>No specific items affected</p>'}
            </div>

            <div class="action-section">
              <h3 style="color: #856404; margin-top: 0;">⚡ Immediate Actions Required</h3>
              <ul style="margin: 15px 0; padding-left: 20px;">
                <li>Review current inventory levels</li>
                <li>Contact suppliers for urgent restocking</li>
                <li>Update inventory management system</li>
                <li>Notify sales team of potential shortages</li>
                <li>Prepare alternative product recommendations</li>
              </ul>
            </div>

            <div class="recommendation">
              <h3 style="color: #27ae60; margin-top: 0;">💡 Recommendations</h3>
              <p>${recommendations || 'Monitor inventory levels closely and maintain safety stock for critical items.'}</p>
            </div>

            ${supplierInfo ? `
            <div class="supplier-info">
              <h3 style="color: #1976d2; margin-top: 0;">🏢 Supplier Information</h3>
              <p><strong>Primary Supplier:</strong> ${supplierInfo.name}</p>
              <p><strong>Contact:</strong> ${supplierInfo.contact}</p>
              <p><strong>Lead Time:</strong> ${supplierInfo.leadTime}</p>
              <p><strong>Minimum Order:</strong> ${supplierInfo.minimumOrder}</p>
            </div>
            ` : ''}

            <div class="cta-section">
              <a href="http://localhost:3001/warehouse-dashboard.html" class="cta-button">View Warehouse Dashboard</a>
            </div>
          </div>
          <div class="footer">
            <p>© 2024 Abai Springs. Keep the supply flowing! 📦</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Warehouse Alert - ${alertType}
      
      Hello ${warehouseStaff}!
      
      ${priorityEmojis[priority]} ${priority.toUpperCase()} PRIORITY ALERT
      
      ALERT SUMMARY:
      - Type: ${alertType}
      - Priority: ${priority.toUpperCase()}
      - Action Required: ${actionRequired}
      - Estimated Impact: ${estimatedImpact}
      
      AFFECTED ITEMS:
      ${items?.map(item => `
      - ${item.name}
        Current Stock: ${item.currentStock}
        Minimum Required: ${item.minimumRequired}
        Status: ${item.status}
        ${item.estimatedDaysLeft ? `Days Left: ${item.estimatedDaysLeft}` : ''}
      `).join('\n') || 'No specific items affected'}
      
      IMMEDIATE ACTIONS REQUIRED:
      - Review current inventory levels
      - Contact suppliers for urgent restocking
      - Update inventory management system
      - Notify sales team of potential shortages
      - Prepare alternative product recommendations
      
      RECOMMENDATIONS:
      ${recommendations || 'Monitor inventory levels closely and maintain safety stock for critical items.'}
      
      ${supplierInfo ? `
      SUPPLIER INFORMATION:
      - Primary Supplier: ${supplierInfo.name}
      - Contact: ${supplierInfo.contact}
      - Lead Time: ${supplierInfo.leadTime}
      - Minimum Order: ${supplierInfo.minimumOrder}
      ` : ''}
      
      View warehouse dashboard: http://localhost:3001/warehouse-dashboard.html
      
      Keep the supply flowing! 📦
      © 2024 Abai Springs.
    `;

    return { subject, htmlContent, textContent };
  }
}

export default new NotificationService();






