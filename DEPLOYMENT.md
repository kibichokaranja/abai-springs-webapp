# 🚀 Abai Springs Production Deployment Guide

This guide covers deploying the Abai Springs application to production using Docker and Docker Compose.

## 📋 Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- MongoDB Atlas account (or self-hosted MongoDB)
- Redis instance (optional but recommended)
- Domain name and SSL certificate (for HTTPS)
- M-Pesa production credentials

## 🔧 Environment Setup

### 1. Production Environment Variables

Copy and configure the production environment file:

```bash
cp backend/config.prod.env backend/.env.production
```

**Critical variables to update:**

```bash
# Security (REQUIRED)
JWT_SECRET=your_super_secure_jwt_secret_at_least_32_characters_long
JWT_REFRESH_SECRET=your_super_secure_refresh_secret_32_chars_long
SESSION_SECRET=your_super_secure_session_secret_32_characters

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/production_db

# M-Pesa Production Credentials
MPESA_BASE_URL=https://api.safaricom.co.ke
MPESA_CONSUMER_KEY=your_production_consumer_key
MPESA_CONSUMER_SECRET=your_production_consumer_secret
MPESA_PASSKEY=your_production_passkey
MPESA_SHORTCODE=your_production_shortcode

# Domain Configuration
CORS_ORIGIN=https://your-domain.com
MPESA_STK_CALLBACK_URL=https://your-domain.com/api/payments/mpesa/callback

# Redis (Recommended)
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=secure_redis_password

# Email (Optional)
SMTP_HOST=smtp.your-provider.com
SMTP_USER=your-email@domain.com
SMTP_PASS=your-email-password
```

### 2. SSL Certificate Setup

For HTTPS, place your SSL certificates in the `ssl/` directory:

```bash
mkdir ssl
# Copy your SSL certificate files
cp /path/to/your/cert.pem ssl/
cp /path/to/your/key.pem ssl/
```

### 3. Docker Environment

Create a `.env` file for Docker Compose:

```bash
# Docker environment variables
MONGO_ROOT_PASSWORD=secure_mongo_root_password
REDIS_PASSWORD=secure_redis_password
GRAFANA_PASSWORD=secure_grafana_password
```

## 🐳 Docker Deployment

### Quick Start

```bash
# 1. Build and start all services
npm run docker:compose

# 2. Check service status
docker-compose -f docker-compose.prod.yml ps

# 3. View logs
npm run logs
```

### Manual Deployment Steps

```bash
# 1. Build the Docker image
npm run docker:build

# 2. Start services
docker-compose -f docker-compose.prod.yml up -d

# 3. Initialize database (if needed)
docker-compose -f docker-compose.prod.yml exec mongo mongo --eval "db.adminCommand('ping')"

# 4. Check application health
curl http://localhost/health
```

## 📊 Monitoring & Health Checks

### Application Health Endpoints

- **Health Check**: `GET /health` - Basic health status
- **Readiness**: `GET /ready` - Service readiness (K8s)
- **Liveness**: `GET /live` - Service liveness (K8s)
- **Rate Limits**: `GET /api/rate-limit-stats` - Rate limiting stats

### Monitoring Stack

The deployment includes optional monitoring services:

- **Prometheus**: http://localhost:9090 - Metrics collection
- **Grafana**: http://localhost:3000 - Dashboards (admin/admin)

### Log Management

```bash
# View application logs
docker-compose -f docker-compose.prod.yml logs app

# View Nginx logs
docker-compose -f docker-compose.prod.yml logs nginx

# View all logs
docker-compose -f docker-compose.prod.yml logs

# Follow logs in real-time
npm run logs
```

## 🔒 Security Configuration

### Rate Limiting

The application includes comprehensive rate limiting:

- **Global**: 1000 requests/15min per IP
- **API**: 300 requests/15min per IP
- **Auth**: 10 requests/15min per IP
- **Payments**: 5 requests/15min per IP
- **Admin**: 50 requests/15min per IP

### Security Headers

Nginx is configured with security headers:
- HSTS
- CSP (Content Security Policy)
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection

### Production Security Features

- Input validation and sanitization
- SQL injection protection
- XSS protection
- CSRF protection
- IP-based blocking for suspicious activity
- File upload restrictions
- Request size limits

## 🌐 Domain & SSL Setup

### Nginx Configuration

1. Update `nginx.prod.conf` with your domain:

```nginx
server_name your-domain.com www.your-domain.com;
```

2. Enable SSL configuration:

```nginx
# Uncomment SSL server block in nginx.prod.conf
# Update certificate paths
ssl_certificate /etc/nginx/ssl/cert.pem;
ssl_certificate_key /etc/nginx/ssl/key.pem;
```

3. Update Docker Compose volumes:

```yaml
volumes:
  - ./ssl:/etc/nginx/ssl:ro
```

### Let's Encrypt SSL (Optional)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 📈 Performance Optimization

### Database Optimization

- Connection pooling (maxPoolSize: 10)
- Query optimization with indexes
- Read preferences configured
- Connection timeouts optimized

### Caching Strategy

- In-memory caching with NodeCache
- Redis for distributed caching
- Nginx static file caching
- CDN recommendations for static assets

### Process Management

- Clustering enabled (auto-detect CPU cores)
- Graceful shutdown handling
- Health checks for auto-restart
- Resource limits in Docker

## 🔄 Deployment Updates

### Zero-Downtime Updates

```bash
# 1. Build new image
docker build -t abai-springs:new .

# 2. Update service
docker-compose -f docker-compose.prod.yml up -d --no-deps app

# 3. Verify deployment
curl http://localhost/health
```

### Database Migrations

```bash
# Run migrations (if any)
docker-compose -f docker-compose.prod.yml exec app npm run migrate

# Backup before major updates
docker-compose -f docker-compose.prod.yml exec mongo mongodump --out /backup
```

## 🚨 Troubleshooting

### Common Issues

**Application won't start:**
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs app

# Check environment variables
docker-compose -f docker-compose.prod.yml exec app env | grep NODE_ENV
```

**Database connection issues:**
```bash
# Test database connectivity
docker-compose -f docker-compose.prod.yml exec app node -e "
import mongoose from 'mongoose';
mongoose.connect(process.env.MONGODB_URI).then(() => console.log('Connected')).catch(console.error);
"
```

**Rate limiting issues:**
```bash
# Check rate limit stats
curl http://localhost/api/rate-limit-stats
```

### Health Check Commands

```bash
# Application health
curl -f http://localhost/health || echo "App unhealthy"

# Database health
docker-compose -f docker-compose.prod.yml exec mongo mongo --eval "db.adminCommand('ping')"

# Redis health
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping
```

## 📊 Scaling

### Horizontal Scaling

Update `docker-compose.prod.yml` to scale the app service:

```yaml
services:
  app:
    deploy:
      replicas: 3  # Run 3 instances
```

### Load Balancing

Nginx is configured for load balancing across multiple app instances.

### Database Scaling

- Use MongoDB Atlas auto-scaling
- Implement read replicas for heavy read workloads
- Consider sharding for very large datasets

## 🔐 Backup Strategy

### Database Backup

```bash
# Manual backup
docker-compose -f docker-compose.prod.yml exec mongo mongodump --uri="$MONGODB_URI" --out=/backup

# Automated backup (cron job)
0 2 * * * docker-compose -f /path/to/docker-compose.prod.yml exec mongo mongodump --uri="$MONGODB_URI" --out=/backup/$(date +\%Y\%m\%d)
```

### File Backup

```bash
# Backup uploads and logs
tar -czf backup-$(date +%Y%m%d).tar.gz uploads/ logs/
```

## 📞 Support

For deployment issues:
1. Check this documentation
2. Review application logs
3. Check health endpoints
4. Contact system administrator

## 🎯 Production Checklist

- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Database connected and optimized
- [ ] Redis cache configured
- [ ] Domain name configured
- [ ] Security headers enabled
- [ ] Rate limiting configured
- [ ] Monitoring setup
- [ ] Backup strategy implemented
- [ ] Health checks passing
- [ ] Performance testing completed

---

**🎉 Your Abai Springs application is now production-ready!**






