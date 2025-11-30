# ✅ Deployment Checklist

Use this checklist to ensure everything is set up correctly before deploying.

## Pre-Deployment

### Code Preparation
- [x] ✅ Created `config.js` for centralized API URL management
- [x] ✅ Updated `vercel.json` for frontend-only deployment
- [x] ✅ Created `railway.json` and `railway.toml` for Railway
- [x] ✅ Updated backend CORS to accept Vercel origin
- [x] ✅ Created build script (`vercel-build.js`) for Vercel
- [x] ✅ Updated key frontend files to use `window.API_BASE_URL`
- [x] ✅ Created `.gitignore` to exclude sensitive files

### Documentation
- [x] ✅ Created `DEPLOYMENT_GUIDE.md` - Complete step-by-step guide
- [x] ✅ Created `ENV_VARIABLES.md` - Environment variables reference
- [x] ✅ Created `README_DEPLOYMENT.md` - Quick start guide

---

## Step 1: MongoDB Atlas Setup

- [ ] Create MongoDB Atlas account
- [ ] Create free M0 cluster
- [ ] Create database user (save username/password)
- [ ] Configure network access (allow 0.0.0.0/0 for now)
- [ ] Get connection string
- [ ] Test connection string locally

**Connection String Format:**
```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/abai_springs_db?retryWrites=true&w=majority
```

---

## Step 2: Push Code to GitHub

- [ ] Initialize git repository (if not already done)
- [ ] Create `.gitignore` (already created)
- [ ] Commit all files
- [ ] Create GitHub repository
- [ ] Push code to GitHub
- [ ] Verify all files are pushed (check GitHub)

**Commands:**
```bash
git init
git add .
git commit -m "Initial commit - ready for deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/abai-springs-webapp.git
git push -u origin main
```

---

## Step 3: Deploy Backend to Railway

- [ ] Sign up/login to Railway
- [ ] Create new project
- [ ] Connect GitHub repository
- [ ] Select repository
- [ ] Set Root Directory: `backend`
- [ ] Set Start Command: `npm run start:prod` (or use railway.json)
- [ ] Add environment variables (see `ENV_VARIABLES.md`)
- [ ] Deploy
- [ ] Get Railway backend URL
- [ ] Test health endpoint: `https://your-backend.up.railway.app/health`

**Required Railway Environment Variables:**
- `NODE_ENV=production`
- `PORT=3001`
- `MONGODB_URI=...` (from MongoDB Atlas)
- `JWT_SECRET=...` (generate strong random string)
- `JWT_REFRESH_SECRET=...` (generate strong random string)
- `SESSION_SECRET=...` (generate strong random string)
- `CORS_ORIGIN=...` (will be your Vercel URL - set after Step 4)

---

## Step 4: Deploy Frontend to Vercel

- [ ] Sign up/login to Vercel
- [ ] Create new project
- [ ] Import GitHub repository
- [ ] Configure project:
  - Framework Preset: Other
  - Root Directory: `/` (root)
  - Build Command: `node vercel-build.js` (or leave empty if using default)
  - Output Directory: `/` (root)
- [ ] Add environment variable:
  - `API_BASE_URL=https://your-railway-backend.up.railway.app/api`
- [ ] Deploy
- [ ] Get Vercel frontend URL
- [ ] Test frontend loads correctly

**Vercel Environment Variable:**
```
API_BASE_URL=https://your-railway-backend.up.railway.app/api
```

---

## Step 5: Connect Frontend and Backend

- [ ] Go back to Railway
- [ ] Update `CORS_ORIGIN` environment variable with your Vercel URL
- [ ] Railway will auto-redeploy
- [ ] Test API calls from frontend
- [ ] Check browser console for errors
- [ ] Verify CORS is working (no CORS errors)

**Railway CORS_ORIGIN:**
```
CORS_ORIGIN=https://your-app.vercel.app
```

---

## Step 6: Testing

### Backend Tests
- [ ] Health check: `https://your-backend.up.railway.app/health` → Returns `{"status":"ok"}`
- [ ] Products API: `https://your-backend.up.railway.app/api/products` → Returns product list
- [ ] Check Railway logs for errors

### Frontend Tests
- [ ] Homepage loads: `https://your-app.vercel.app`
- [ ] Products display correctly
- [ ] Can navigate between pages
- [ ] Browser console shows no errors
- [ ] API calls work (check Network tab)
- [ ] No CORS errors

### Integration Tests
- [ ] User registration works
- [ ] User login works
- [ ] Can add products to cart
- [ ] Can checkout
- [ ] Orders are created in database
- [ ] Staff login works
- [ ] Dashboards load correctly

---

## Step 7: Security Checklist

- [ ] All JWT secrets are strong (32+ characters, random)
- [ ] MongoDB password is strong
- [ ] `CORS_ORIGIN` is set to your Vercel URL only (not `*`)
- [ ] Environment variables are set in dashboards (not in code)
- [ ] `.env` files are in `.gitignore`
- [ ] No secrets committed to GitHub
- [ ] MongoDB Atlas network access is configured
- [ ] SSL/HTTPS is enabled (automatic on Railway & Vercel)

---

## Step 8: Production Configuration

### M-Pesa Setup (If using)
- [ ] Get production M-Pesa credentials
- [ ] Add to Railway environment variables
- [ ] Update callback URL to Railway backend
- [ ] Test payment flow

### Email Setup (Optional)
- [ ] Configure SMTP settings
- [ ] Add to Railway environment variables
- [ ] Test email sending

### Custom Domain (Optional)
- [ ] Add custom domain to Vercel
- [ ] Update `CORS_ORIGIN` in Railway
- [ ] Configure DNS
- [ ] Test custom domain

---

## Troubleshooting

### Backend not starting
- Check Railway logs
- Verify all environment variables are set
- Check MongoDB connection string
- Verify Node.js version compatibility

### Frontend can't connect to backend
- Verify `API_BASE_URL` in Vercel matches Railway URL
- Check Railway backend is running
- Verify CORS configuration
- Check browser console for errors

### CORS errors
- Verify `CORS_ORIGIN` in Railway matches Vercel URL exactly
- No trailing slashes
- Using HTTPS (not HTTP)
- Check Railway logs for CORS errors

### Database connection failed
- Verify MongoDB Atlas network access
- Check connection string format
- Verify username/password
- Check Railway logs for connection errors

---

## Post-Deployment

- [ ] Set up monitoring (optional)
- [ ] Configure backups for MongoDB Atlas
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Document any custom configurations
- [ ] Share deployment URLs with team

---

## Quick Reference

### URLs
- **Frontend**: `https://your-app.vercel.app`
- **Backend**: `https://your-backend.up.railway.app`
- **MongoDB Atlas**: Dashboard at mongodb.com/cloud/atlas

### Important Files
- `DEPLOYMENT_GUIDE.md` - Complete guide
- `ENV_VARIABLES.md` - Environment variables reference
- `config.js` - API URL configuration
- `vercel.json` - Vercel configuration
- `railway.json` - Railway configuration

---

**✅ Ready to deploy? Follow `DEPLOYMENT_GUIDE.md` for detailed instructions!**





