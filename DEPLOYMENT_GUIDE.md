# 🚀 Abai Springs Deployment Guide
## Vercel (Frontend) + Railway (Backend) + MongoDB Atlas

This guide will help you deploy the Abai Springs web app using the same architecture as Dallas Courier:
- **Frontend**: Vercel
- **Backend**: Railway
- **Database**: MongoDB Atlas
- **Code**: GitHub

---

## 📋 Prerequisites

1. **GitHub Account** - For hosting your code
2. **Vercel Account** - Free tier available at [vercel.com](https://vercel.com)
3. **Railway Account** - Free tier available at [railway.app](https://railway.app)
4. **MongoDB Atlas Account** - Free tier available at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)

---

## 🗄️ Step 1: Set Up MongoDB Atlas

1. **Create MongoDB Atlas Account**
   - Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
   - Sign up for a free account
   - Create a new cluster (choose the free M0 tier)

2. **Configure Database Access**
   - Go to "Database Access" → "Add New Database User"
   - Create a username and password (save these!)
   - Set privileges to "Atlas Admin" or "Read and write to any database"

3. **Configure Network Access**
   - Go to "Network Access" → "Add IP Address"
   - Click "Allow Access from Anywhere" (0.0.0.0/0) for development
   - For production, add Railway's IP ranges

4. **Get Connection String**
   - Go to "Database" → "Connect" → "Connect your application"
   - Copy the connection string (looks like: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/`)
   - Replace `<password>` with your actual password
   - Add database name: `mongodb+srv://.../abai_springs_db?retryWrites=true&w=majority`

---

## 🚂 Step 2: Deploy Backend to Railway

1. **Push Code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/abai-springs-webapp.git
   git push -u origin main
   ```

2. **Create Railway Project**
   - Go to [railway.app](https://railway.app)
   - Sign up/login with GitHub
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your `abai-springs-webapp` repository

3. **Configure Railway Service**
   - Railway will auto-detect it's a Node.js project
   - Set the **Root Directory** to `backend`
   - Set the **Start Command** to: `npm run start:prod`
   - Or Railway will use the `railway.json` config automatically

4. **Add Environment Variables in Railway**
   Go to your Railway service → "Variables" tab, add:

   ```env
   NODE_ENV=production
   PORT=3001
   
   # MongoDB Atlas Connection
   MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/abai_springs_db?retryWrites=true&w=majority
   
   # JWT Secrets (generate strong random strings)
   JWT_SECRET=your_super_secure_jwt_secret_min_32_characters_long_here
   JWT_REFRESH_SECRET=your_super_secure_refresh_secret_min_32_characters_long_here
   JWT_EXPIRE=24h
   JWT_REFRESH_EXPIRE=7d
   SESSION_SECRET=your_super_secure_session_secret_min_32_characters_long_here
   
   # CORS - Will be your Vercel URL (update after Step 3)
   CORS_ORIGIN=https://your-app.vercel.app
   
   # M-Pesa Configuration (Production)
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
   
   # Email Configuration (Optional)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_app_specific_password
   EMAIL_FROM=noreply@abaisprings.com
   
   # Redis (Optional - for caching)
   REDIS_URL=redis://default:password@redis.railway.internal:6379
   # Or use Railway's Redis service if you add it
   
   # Logging
   LOG_LEVEL=info
   LOG_MAX_SIZE=50m
   LOG_MAX_FILES=30
   
   # Security
   BCRYPT_ROUNDS=12
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   ```

5. **Get Railway Backend URL**
   - After deployment, Railway will provide a URL like: `https://your-app.up.railway.app`
   - Go to "Settings" → "Generate Domain" if needed
   - Copy this URL - you'll need it for Vercel

6. **Test Backend**
   - Visit: `https://your-railway-backend.up.railway.app/health`
   - Should return: `{"status":"ok","timestamp":"..."}`

---

## 🌐 Step 3: Deploy Frontend to Vercel

1. **Connect GitHub to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign up/login with GitHub
   - Click "Add New Project"
   - Import your `abai-springs-webapp` repository

2. **Configure Vercel Project**
   - **Framework Preset**: Other
   - **Root Directory**: `/` (root)
   - **Build Command**: `node vercel-build.js` (injects API_BASE_URL into HTML files)
   - **Output Directory**: `/` (root)
   - **Install Command**: Leave empty (or `npm install` if vercel-build.js needs dependencies)

3. **Add Environment Variables in Vercel**
   Go to Project Settings → Environment Variables:

   ```env
   API_BASE_URL=https://your-railway-backend.up.railway.app/api
   ```

   **Important**: Replace `your-railway-backend.up.railway.app` with your actual Railway backend URL!

4. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy your frontend
   - You'll get a URL like: `https://abai-springs-webapp.vercel.app`

5. **Update Railway CORS**
   - Go back to Railway
   - Update the `CORS_ORIGIN` variable with your Vercel URL:
     ```
     CORS_ORIGIN=https://abai-springs-webapp.vercel.app
     ```
   - Railway will automatically redeploy

---

## 🔧 Step 4: Update Frontend Files (If Needed)

The frontend files should automatically use the `API_BASE_URL` environment variable. However, if you need to update specific files:

1. **All HTML files** should include:
   ```html
   <script src="config.js"></script>
   ```

2. **All JavaScript files** should use:
   ```javascript
   const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3001/api';
   ```

3. **For Vercel**, the `config.js` will automatically detect the environment variable.

---

## ✅ Step 5: Verify Deployment

1. **Frontend**: Visit your Vercel URL
   - Should load the homepage
   - Check browser console for any API errors

2. **Backend Health**: `https://your-railway-backend.up.railway.app/health`
   - Should return JSON with status

3. **API Test**: Try fetching products
   - `https://your-railway-backend.up.railway.app/api/products`
   - Should return product list

4. **CORS Test**: From your Vercel frontend, try to fetch from the API
   - Should work without CORS errors

---

## 🔐 Step 6: Security Checklist

- [ ] All JWT secrets are strong (32+ characters, random)
- [ ] MongoDB password is strong
- [ ] CORS_ORIGIN is set to your Vercel URL only
- [ ] M-Pesa credentials are production (not sandbox)
- [ ] Environment variables are set in Railway (not in code)
- [ ] Railway domain is set (not using random subdomain)
- [ ] SSL/HTTPS is enabled (automatic on Railway & Vercel)

---

## 🔄 Step 7: Continuous Deployment

Both Vercel and Railway automatically deploy when you push to GitHub:

```bash
# Make changes locally
git add .
git commit -m "Your changes"
git push origin main

# Vercel and Railway will auto-deploy
```

---

## 📊 Monitoring

### Railway
- View logs: Railway Dashboard → Your Service → "Logs"
- Monitor metrics: Railway Dashboard → "Metrics"
- Check deployments: Railway Dashboard → "Deployments"

### Vercel
- View logs: Vercel Dashboard → Your Project → "Deployments" → Click deployment → "Functions" tab
- Analytics: Vercel Dashboard → "Analytics"

### MongoDB Atlas
- Monitor: MongoDB Atlas Dashboard → "Metrics"
- View logs: MongoDB Atlas Dashboard → "Logs"

---

## 🐛 Troubleshooting

### Backend Issues

**Problem**: Backend not starting
- Check Railway logs for errors
- Verify all environment variables are set
- Check MongoDB connection string

**Problem**: CORS errors
- Verify `CORS_ORIGIN` in Railway matches your Vercel URL exactly
- Check for trailing slashes
- Ensure Railway backend URL is correct

**Problem**: Database connection failed
- Verify MongoDB Atlas network access allows Railway IPs
- Check connection string format
- Verify username/password in connection string

### Frontend Issues

**Problem**: API calls failing
- Check browser console for errors
- Verify `API_BASE_URL` environment variable in Vercel
- Check that Railway backend is running
- Verify CORS is configured correctly

**Problem**: 404 errors on routes
- Vercel needs a `vercel.json` with proper routing (already configured)
- Check that all static files are in the root directory

---

## 💰 Cost Estimate

- **Vercel**: Free tier (sufficient for most apps)
- **Railway**: $5/month starter plan (or free credits)
- **MongoDB Atlas**: Free tier (M0) or $9/month for M10
- **Total**: ~$5-15/month for small to medium traffic

---

## 📝 Next Steps

1. Set up custom domain (optional)
2. Configure M-Pesa production credentials
3. Set up email service (SendGrid, Mailgun, etc.)
4. Add monitoring (Sentry, LogRocket, etc.)
5. Set up backups for MongoDB Atlas

---

## 🆘 Need Help?

- Railway Docs: [docs.railway.app](https://docs.railway.app)
- Vercel Docs: [vercel.com/docs](https://vercel.com/docs)
- MongoDB Atlas Docs: [docs.atlas.mongodb.com](https://docs.atlas.mongodb.com)

---

**Happy Deploying! 🚀**

