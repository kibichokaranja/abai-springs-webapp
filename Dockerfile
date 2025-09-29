# Multi-stage build for production optimization
FROM node:18-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy package files
COPY backend/package*.json ./backend/
COPY package*.json ./

# Install dependencies with production optimizations
FROM base AS deps
WORKDIR /app/backend
RUN npm ci --only=production --no-audit --no-fund && npm cache clean --force

# Development dependencies for building
FROM base AS build-deps
WORKDIR /app/backend
RUN npm ci --no-audit --no-fund

# Build stage (if you have build steps)
FROM build-deps AS build
WORKDIR /app
COPY . .
# Add any build steps here if needed
# RUN npm run build

# Production stage
FROM base AS production

# Set production environment
ENV NODE_ENV=production
ENV PORT=3001

# Copy production dependencies
COPY --from=deps --chown=nodejs:nodejs /app/backend/node_modules ./backend/node_modules

# Copy application code
COPY --chown=nodejs:nodejs . .

# Create necessary directories
RUN mkdir -p /app/logs /app/uploads && chown -R nodejs:nodejs /app/logs /app/uploads

# Expose port
EXPOSE 3001

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node backend/healthcheck.js

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "backend/server.prod.js"]



