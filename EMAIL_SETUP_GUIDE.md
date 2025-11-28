# 📧 Email & WhatsApp Notification Setup Guide

## 🚀 Quick Setup for Gmail

### Step 1: Enable 2-Factor Authentication on Gmail
1. Go to your Google Account settings
2. Navigate to Security → 2-Step Verification
3. Enable 2-Step Verification if not already enabled

### Step 2: Generate App Password
1. In Google Account settings, go to Security
2. Under "2-Step Verification", click "App passwords"
3. Select "Mail" and "Other (custom name)"
4. Enter "Abai Springs" as the name
5. Copy the generated 16-character password

### Step 3: Update Configuration
Edit `backend/config.env` and replace these values:

```env
# Replace with your actual Gmail address
EMAIL_USER=your-actual-email@gmail.com

# Replace with the 16-character app password from Step 2
EMAIL_PASS=ntpdzfmlfndttknh

# Optional: Customize the sender name
EMAIL_FROM=Abai Springs <your-actual-email@gmail.com>
```

### Step 4: Restart the Server
```bash
cd backend
# Stop the server (Ctrl+C)
node server.js
```

## 📱 WhatsApp Setup (Optional)

For WhatsApp notifications, you'll need:
1. WhatsApp Business API account
2. Phone number verification
3. API tokens

Currently, WhatsApp messages are simulated (logged to console).

## 🧪 Testing Notifications

### Test Email
1. Place a test order with your email address
2. Check your email inbox (and spam folder)
3. You should receive an order confirmation email

### Test WhatsApp
1. Place a test order with your phone number
2. Check the server console for WhatsApp message logs
3. Messages will be logged like: `📱 WhatsApp to +254700000000: [message]`

## 🔧 Troubleshooting

### Email Not Working?
1. **Check credentials**: Ensure EMAIL_USER and EMAIL_PASS are correct
2. **Check spam folder**: Emails might be filtered as spam
3. **Check server logs**: Look for email sending errors in console
4. **Verify app password**: Make sure you're using the app password, not your regular Gmail password

### Common Issues:
- **"Invalid login"**: Wrong email or password
- **"Less secure app access"**: Use app password instead of regular password
- **"Connection timeout"**: Check internet connection and firewall settings

## 📋 What You'll Receive

### Email Notifications:
- ✅ Order confirmation with details
- 📦 Order tracking information
- 🚨 Low stock alerts (if enabled)
- 🔄 Order status updates

### WhatsApp Notifications:
- ✅ Order confirmation messages
- 📦 Order tracking links
- 🚨 Stock alerts
- 🔄 Status updates

## 🎯 Next Steps

1. **Configure your email** using the steps above
2. **Test with a real order** to verify notifications work
3. **Set up WhatsApp Business API** for production use
4. **Customize email templates** in `backend/services/notificationService.js`

## 📞 Support

If you need help:
- Check server logs for error messages
- Verify your Gmail app password is correct
- Ensure your email address is properly formatted
- Test with a simple email first before placing orders

---

**Note**: This setup uses Gmail for simplicity. For production, consider using professional email services like SendGrid, Mailgun, or AWS SES for better deliverability and features.































































