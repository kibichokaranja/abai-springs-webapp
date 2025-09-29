# M-Pesa API Integration Setup Guide

This guide will help you set up real M-Pesa API integration for the Abai Springs Web App.

## Prerequisites

1. **Safaricom Developer Account**: Register at [Safaricom Developer Portal](https://developer.safaricom.co.ke/)
2. **M-Pesa Business Account**: You need an active M-Pesa business account
3. **SSL Certificate**: For production, you need HTTPS for webhook callbacks

## Step 1: Get M-Pesa API Credentials

### For Sandbox Testing:
1. Go to [Safaricom Developer Portal](https://developer.safaricom.co.ke/)
2. Create a new app or use existing one
3. Get your credentials from the dashboard:
   - Consumer Key
   - Consumer Secret
   - Passkey
   - Shortcode (Test Shortcode)

### For Production:
1. Contact Safaricom Business Support
2. Request M-Pesa API access
3. Get production credentials:
   - Consumer Key
   - Consumer Secret
   - Passkey
   - Shortcode (Business Shortcode)

## Step 2: Configure Environment Variables

Update your `backend/config.env` file with your M-Pesa credentials:

```env
# M-Pesa API Configuration
MPESA_BASE_URL=https://sandbox.safaricom.co.ke  # Use https://api.safaricom.co.ke for production
MPESA_CONSUMER_KEY=your_consumer_key_here
MPESA_CONSUMER_SECRET=your_consumer_secret_here
MPESA_PASSKEY=your_passkey_here
MPESA_SHORTCODE=your_shortcode_here
MPESA_ENVIRONMENT=sandbox  # Change to 'production' for live
MPESA_STK_CALLBACK_URL=https://your-domain.com/api/payments/mpesa/callback
```

## Step 3: Update Callback URLs

### For Development:
```env
MPESA_STK_CALLBACK_URL=http://localhost:3001/api/payments/mpesa/callback
```

### For Production:
```env
MPESA_STK_CALLBACK_URL=https://your-domain.com/api/payments/mpesa/callback
```

## Step 4: Test the Integration

### 1. Test M-Pesa Credentials
```bash
# Test if credentials are working
curl -X POST http://localhost:3001/api/payments/test-mpesa
```

### 2. Test STK Push
```bash
# Test STK push with sandbox phone number
curl -X POST http://localhost:3001/api/payments/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "orderId": "ORDER_ID",
    "paymentMethod": "mpesa",
    "phoneNumber": "254708374149"
  }'
```

## Step 5: Sandbox Testing

### Test Phone Numbers:
- **M-Pesa Sandbox**: `254708374149`
- **Airtel Money Sandbox**: `254708374149`
- **Equitel Sandbox**: `254708374149`

### Test PIN:
- **M-Pesa**: `1746`
- **Airtel Money**: `1234`
- **Equitel**: `1234`

## Step 6: Production Deployment

### 1. Update Environment Variables
```env
MPESA_BASE_URL=https://api.safaricom.co.ke
MPESA_ENVIRONMENT=production
MPESA_STK_CALLBACK_URL=https://your-domain.com/api/payments/mpesa/callback
```

### 2. SSL Certificate
Ensure your domain has a valid SSL certificate for webhook callbacks.

### 3. Webhook Security
Implement proper signature verification for production callbacks.

## API Endpoints

### Payment Initiation
```
POST /api/payments/initiate
```

### M-Pesa Callback
```
POST /api/payments/mpesa/callback
```

### Query Payment Status
```
GET /api/payments/:paymentId/status
```

### Query M-Pesa Status
```
POST /api/payments/:paymentId/query-mpesa
```

## Error Handling

The integration includes comprehensive error handling:

- **Invalid Credentials**: Falls back to simulation
- **Network Errors**: Retry mechanism
- **Callback Failures**: Logging and monitoring
- **Validation Errors**: Detailed error messages

## Security Considerations

1. **Environment Variables**: Never commit credentials to version control
2. **Webhook Verification**: Implement signature verification in production
3. **Rate Limiting**: Implement rate limiting for API calls
4. **Logging**: Monitor all payment transactions
5. **SSL**: Use HTTPS for all production endpoints

## Troubleshooting

### Common Issues:

1. **"M-Pesa credentials not configured"**
   - Check your environment variables
   - Ensure all required fields are set

2. **"STK Push failed"**
   - Verify phone number format (254XXXXXXXXX)
   - Check if phone number is registered for M-Pesa
   - Ensure amount is valid (minimum KES 1)

3. **"Callback not received"**
   - Check callback URL is accessible
   - Verify SSL certificate for production
   - Check server logs for errors

4. **"Payment not found"**
   - Verify checkout request ID
   - Check database connection
   - Ensure payment record exists

## Support

For M-Pesa API issues:
- [Safaricom Developer Documentation](https://developer.safaricom.co.ke/docs)
- [M-Pesa API Reference](https://developer.safaricom.co.ke/APIs)

For application issues:
- Check server logs
- Verify database connectivity
- Test API endpoints individually

## Testing Checklist

- [ ] Environment variables configured
- [ ] M-Pesa credentials working
- [ ] STK push initiated successfully
- [ ] Callback received and processed
- [ ] Payment status updated correctly
- [ ] Order status updated correctly
- [ ] Error handling working
- [ ] Validation working
- [ ] Security measures in place

## Production Checklist

- [ ] Production credentials configured
- [ ] SSL certificate installed
- [ ] Webhook signature verification implemented
- [ ] Monitoring and logging configured
- [ ] Rate limiting implemented
- [ ] Error handling tested
- [ ] Security audit completed
- [ ] Load testing performed
