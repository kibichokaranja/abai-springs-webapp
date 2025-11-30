# 🚀 Quick Deployment Summary

## Architecture
- **Frontend**: Vercel (Static HTML/CSS/JS)
- **Backend**: Railway (Node.js/Express)
- **Database**: MongoDB Atlas
- **Code**: GitHub

## Quick Start

### 1. MongoDB Atlas Setup
1. Create account at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create free M0 cluster
3. Create database user
4. Allow network access (0.0.0.0/0 for development)
5. Get connection string

### 2. Railway Backend
1. Push code to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Set Root Directory: `backend`
4. Add environment variables (see `backend/.env.example`)
5. Get Railway URL: `https://your-app.up.railway.app`

### 3. Vercel Frontend
1. Go to [vercel.com](https://vercel.com) → Add New Project → Import from GitHub
2. Add environment variable: `API_BASE_URL=https://your-railway-backend.up.railway.app/api`
3. Deploy

### 4. Update Railway CORS
- Add to Railway environment variables: `CORS_ORIGIN=https://your-vercel-app.vercel.app`

## Files Created
- ✅ `config.js` - Centralized API URL configuration
- ✅ `railway.json` & `railway.toml` - Railway deployment config
- ✅ `vercel.json` - Updated for frontend-only deployment
- ✅ `DEPLOYMENT_GUIDE.md` - Complete step-by-step guide
- ✅ `.env.example` - Frontend environment variables template
- ✅ `backend/.env.example` - Backend environment variables template

## Important Notes
- All frontend files now use `window.API_BASE_URL` from `config.js`
- Backend CORS is configured to accept Vercel origin
- Environment variables must be set in Railway and Vercel dashboards
- See `DEPLOYMENT_GUIDE.md` for detailed instructions





