# Environment Variables Guide

## Frontend (Vercel)

Set these in **Vercel Dashboard** → Your Project → Settings → Environment Variables

### Required
```env
API_BASE_URL=https://your-railway-backend.up.railway.app/api
```

**Example:**
```env
API_BASE_URL=https://abai-springs-backend-production.up.railway.app/api
```

**Note:** After setting this, you need to redeploy your Vercel project for the changes to take effect.

---

## Backend (Railway)

Set these in **Railway Dashboard** → Your Service → Variables tab

### Required Variables

```env
# Server
NODE_ENV=production
PORT=3001

# Database (MongoDB Atlas)
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/abai_springs_db?retryWrites=true&w=majority

# JWT Secrets (Generate strong random strings - 32+ characters)
JWT_SECRET=your_super_secure_jwt_secret_min_32_characters_long_here
JWT_REFRESH_SECRET=your_super_secure_refresh_secret_min_32_characters_long_here
SESSION_SECRET=your_super_secure_session_secret_min_32_characters_long_here

# CORS (Your Vercel frontend URL)
CORS_ORIGIN=https://your-app.vercel.app
```

### Optional Variables

```env
# JWT Expiration
JWT_EXPIRE=24h
JWT_REFRESH_EXPIRE=7d

# M-Pesa (Production)
MPESA_BASE_URL=https://api.safaricom.co.ke
MPESA_CONSUMER_KEY=your_production_consumer_key
MPESA_CONSUMER_SECRET=your_production_consumer_secret
MPESA_PASSKEY=your_production_passkey
MPESA_SHORTCODE=your_production_shortcode
MPESA_ENVIRONMENT=production
MPESA_STK_CALLBACK_URL=https://your-railway-backend.up.railway.app/api/payments/mpesa/callback

# Payment Security
PAYMENT_WEBHOOK_SECRET=your_production_webhook_secret
PAYMENT_RATE_LIMIT_ENABLED=true
PAYMENT_FRAUD_DETECTION_ENABLED=true

# Email (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_specific_password
EMAIL_FROM=noreply@abaisprings.com

# Redis (Optional - if using Railway Redis service)
REDIS_URL=redis://default:password@redis.railway.internal:6379

# Logging
LOG_LEVEL=info
LOG_MAX_SIZE=50m
LOG_MAX_FILES=30

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## How to Generate Secure Secrets

### Option 1: Using Node.js
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Option 2: Using OpenSSL
```bash
openssl rand -hex 32
```

### Option 3: Online Generator
- Visit: https://randomkeygen.com/
- Use "CodeIgniter Encryption Keys" (256-bit)

---

## Setting Up Environment Variables

### Vercel
1. Go to your project dashboard
2. Click "Settings" → "Environment Variables"
3. Add variable: `API_BASE_URL`
4. Value: Your Railway backend URL + `/api`
5. Click "Save"
6. **Important:** Redeploy your project for changes to take effect

### Railway
1. Go to your service dashboard
2. Click "Variables" tab
3. Click "New Variable"
4. Add each variable one by one
5. Railway will automatically redeploy when you save

---

## Testing Environment Variables

### Frontend (Vercel)
1. Open browser console on your Vercel site
2. Type: `window.API_BASE_URL`
3. Should show your Railway backend URL

### Backend (Railway)
1. Check Railway logs
2. Look for: "Server running on port 3001"
3. Visit: `https://your-railway-backend.up.railway.app/health`
4. Should return: `{"status":"ok"}`

---

## Common Issues

### Issue: Frontend can't connect to backend
- **Check:** Is `API_BASE_URL` set correctly in Vercel?
- **Check:** Is `CORS_ORIGIN` set to your Vercel URL in Railway?
- **Check:** Are both services deployed?

### Issue: CORS errors
- **Check:** `CORS_ORIGIN` in Railway matches your Vercel URL exactly
- **Check:** No trailing slashes
- **Check:** Using HTTPS (not HTTP)

### Issue: Database connection failed
- **Check:** MongoDB Atlas network access allows Railway IPs
- **Check:** Connection string format is correct
- **Check:** Username/password in connection string are correct

---

## Security Best Practices

1. ✅ Never commit `.env` files to GitHub
2. ✅ Use strong, random secrets (32+ characters)
3. ✅ Rotate secrets periodically
4. ✅ Use different secrets for development and production
5. ✅ Limit CORS_ORIGIN to your actual domain
6. ✅ Use MongoDB Atlas IP whitelist for production

