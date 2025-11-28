# 🧪 Email Notification Testing Guide

## **Overview**
This guide shows you how to test the staff email notification system for Abai Springs. The system sends beautiful, role-specific emails to owners, drivers, sales team, and warehouse staff.

## **📧 Email Types Available**

### 1. **👑 Owner Daily Insights**
- **Purpose**: Daily business intelligence reports
- **Recipients**: Business owners and administrators
- **Content**: Revenue, orders, top products, inventory alerts, performance metrics
- **Frequency**: Daily (8:00 AM) or on-demand

### 2. **🚚 Driver Delivery Assignment**
- **Purpose**: New delivery assignments with route optimization
- **Recipients**: Delivery drivers
- **Content**: Customer details, delivery address, items, special instructions
- **Trigger**: When new orders are assigned to drivers

### 3. **🎯 Sales Lead Notification**
- **Purpose**: High-quality sales leads requiring immediate attention
- **Recipients**: Sales team members
- **Content**: Lead details, contact info, interest level, recommended actions
- **Trigger**: When new leads are generated or assigned

### 4. **🏭 Warehouse Inventory Alert**
- **Purpose**: Inventory management and stock alerts
- **Recipients**: Warehouse staff
- **Content**: Stock levels, affected items, supplier info, action recommendations
- **Trigger**: When inventory levels are low or critical

## **🧪 Testing Methods**

### **Method 1: Command Line Testing**

#### Simple Test (Single Email)
```bash
cd backend
node test-email-notifications-simple.js
```

#### Complete Test Suite (All Email Types)
```bash
cd backend
node test-all-email-types.js
```

#### API Testing
```bash
cd backend
node test-email-api.js
```

### **Method 2: Web Interface Testing**

1. **Start your server**:
   ```bash
   cd backend
   npm start
   ```

2. **Open the test page**:
   ```
   http://localhost:3001/test-email-web.html
   ```

3. **Click the test buttons** to send different email types

### **Method 3: API Testing (Postman/curl)**

#### Check System Status
```bash
curl -X GET http://localhost:3001/api/staff-notifications/status
```

#### Send Owner Daily Insights
```bash
curl -X POST http://localhost:3001/api/staff-notifications/owner/daily-insights \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Send Driver Assignment
```bash
curl -X POST http://localhost:3001/api/staff-notifications/driver/delivery-assignment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "driverId": "507f1f77bcf86cd799439011",
    "orderData": {
      "orderNumber": "AS-2024-001238",
      "customerName": "Test Customer",
      "deliveryAddress": "123 Test Street, Nairobi",
      "items": [{"name": "20L Water", "quantity": 2}]
    }
  }'
```

#### Send Sales Lead Notification
```bash
curl -X POST http://localhost:3001/api/staff-notifications/sales/lead-notification \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "salespersonId": "507f1f77bcf86cd799439012",
    "leadData": {
      "name": "Test Company",
      "email": "contact@test.com",
      "phone": "+254700123456",
      "source": "Website",
      "score": 85,
      "estimatedValue": 100000
    }
  }'
```

#### Send Warehouse Alert
```bash
curl -X POST http://localhost:3001/api/staff-notifications/warehouse/inventory-alert \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "alertType": "Low Stock Alert",
    "priority": "high",
    "items": [{
      "name": "500ml Bottles",
      "currentStock": 15,
      "minimumRequired": 100,
      "status": "Critical"
    }]
  }'
```

## **📧 Test Email Addresses**

The test emails are sent to these addresses (you can change them in the test files):

- **owner@abaisprings.com** - Daily Business Insights
- **driver@abaisprings.com** - Delivery Assignment
- **sales@abaisprings.com** - Sales Lead Notification
- **warehouse@abaisprings.com** - Inventory Alert

## **🔧 Configuration**

### Environment Variables Required
Make sure these are set in your `config.env` file:

```env
GMAIL_EMAIL=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
```

### Gmail Setup
1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password for the application
3. Use the App Password in `GMAIL_APP_PASSWORD`

## **📊 Expected Test Results**

### Successful Test Output
```
🎉 All email notifications working perfectly!

📧 Check these email addresses for the test emails:
   • owner@abaisprings.com - Daily Business Insights
   • driver@abaisprings.com - Delivery Assignment
   • sales@abaisprings.com - Sales Lead Notification
   • warehouse@abaisprings.com - Inventory Alert
```

### Email Content Features
- **Beautiful HTML Templates**: Modern, responsive designs
- **Role-Specific Branding**: Different colors and styles for each role
- **Actionable Content**: Clear next steps and recommendations
- **Priority Indicators**: Color-coded alerts based on urgency
- **Mobile Responsive**: Looks great on all devices

## **🚨 Troubleshooting**

### Common Issues

1. **"Email credentials not configured"**
   - Check your `GMAIL_EMAIL` and `GMAIL_APP_PASSWORD` in config.env

2. **"No owners/drivers/sales found"**
   - Make sure you have staff records in your database
   - Check the Staff, Driver, and Salesperson models

3. **"Failed to send email"**
   - Verify Gmail SMTP settings
   - Check internet connection
   - Ensure Gmail App Password is correct

4. **"Module not found"**
   - Make sure you're in the correct directory (`backend/`)
   - Run `npm install` to install dependencies

### Debug Mode
Enable debug logging by setting:
```env
NODE_ENV=development
LOG_LEVEL=debug
```

## **🎯 Production Usage**

### Automatic Triggers
The system can automatically send emails based on business events:

```javascript
// Trigger notifications in your application
import staffNotificationService from './services/staffNotificationService.js';

// Send daily owner insights
await staffNotificationService.sendDailyOwnerInsights();

// Send delivery assignment
await staffNotificationService.sendDeliveryAssignment(order, driverId);

// Send sales lead notification
await staffNotificationService.sendSalesLeadNotification(lead, salespersonId);

// Send warehouse alert
await staffNotificationService.sendWarehouseInventoryAlert(
  'Low Stock Alert', 
  items, 
  'high'
);
```

### Scheduled Notifications
```javascript
// Schedule daily owner insights at 8:00 AM
staffNotificationService.scheduleDailyOwnerInsights();
```

## **📈 Monitoring**

Check email delivery status in your application logs:
```bash
tail -f backend/logs/app.log | grep "Email sent successfully"
```

## **🎉 Success!**

Your email notification system is now fully functional and tested! Each staff role will receive beautiful, actionable emails to help them perform their jobs more effectively.

---

*For support, check the logs or contact the development team.*




































