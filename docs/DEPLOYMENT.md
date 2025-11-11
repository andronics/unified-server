# Deployment Guide

**Unified Multi-Protocol Server - Production Deployment**

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Configuration](#environment-configuration)
4. [Deployment Options](#deployment-options)
5. [Production Checklist](#production-checklist)
6. [Monitoring](#monitoring)
7. [Scaling](#scaling)
8. [Troubleshooting](#troubleshooting)

---

## Overview

This guide covers deploying the Unified Multi-Protocol Server to production, including:

- HTTP REST API (Express)
- WebSocket real-time communication
- PostgreSQL database
- Redis cache and PubSub
- Metrics endpoint (Prometheus)

---

## Prerequisites

### Required

- **Node.js**: v18+ or v20+ LTS
- **PostgreSQL**: v14+ or v15+
- **Redis**: v6+ or v7+ (optional for single-instance)
- **SSL/TLS Certificate**: For HTTPS/WSS in production

### Recommended

- **Reverse Proxy**: Nginx or Traefik
- **Process Manager**: PM2 or systemd
- **Monitoring**: Prometheus + Grafana
- **Load Balancer**: For horizontal scaling

---

## Environment Configuration

### 1. Create Production Environment File

```bash
cp .env.example .env.production
```

### 2. Configure Environment Variables

```env
# Application
NODE_ENV=production
APP_NAME=unified-server
PORT=3000
HOST=0.0.0.0
SHUTDOWN_TIMEOUT=30000

# Database (Production PostgreSQL)
DB_HOST=postgres.example.com
DB_PORT=5432
DB_NAME=unified_server_prod
DB_USER=app_user
DB_PASSWORD=<strong-password>
DB_POOL_MIN=5
DB_POOL_MAX=50

# Redis Cache & PubSub
REDIS_HOST=redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=<strong-password>
REDIS_DB=0
CACHE_TTL=300

# Authentication
JWT_SECRET=<generate-strong-secret-min-32-chars>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Logging
LOG_LEVEL=info
LOG_PRETTY=false

# Metrics
METRICS_ENABLED=true
METRICS_PORT=9090

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# CORS
CORS_ORIGINS=https://app.example.com,https://www.example.com

# Security
HELMET_ENABLED=true
COMPRESSION_ENABLED=true

# WebSocket
WEBSOCKET_ENABLED=true
WEBSOCKET_PORT=3000
WEBSOCKET_HOST=0.0.0.0
WEBSOCKET_PING_INTERVAL=30000
WEBSOCKET_PING_TIMEOUT=60000
WEBSOCKET_MAX_CONNECTIONS_PER_IP=100
WEBSOCKET_MAX_MESSAGE_SIZE=1048576

# PubSub (Use Redis in production for multi-instance)
PUBSUB_ADAPTER=redis
PUBSUB_REDIS_URL=redis://redis.example.com:6379
PUBSUB_REDIS_PREFIX=pubsub:
PUBSUB_MEMORY_MAX_MESSAGES=10000
```

### 3. Generate Secure Secrets

```bash
# Generate JWT secret (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate database password
openssl rand -base64 32
```

---

## Deployment Options

### Option 1: Docker (Recommended)

#### 1. Create Dockerfile

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Expose ports
EXPOSE 3000 9090

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/server.js"]
```

#### 2. Create docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
      - "9090:9090"
    env_file:
      - .env.production
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    networks:
      - app-network

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: unified_server_prod
      POSTGRES_USER: app_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - app-network
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    networks:
      - app-network
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - app
    networks:
      - app-network
    restart: unless-stopped

volumes:
  postgres-data:
  redis-data:

networks:
  app-network:
    driver: bridge
```

#### 3. Deploy

```bash
# Build and start
docker-compose up -d

# Check logs
docker-compose logs -f app

# Stop
docker-compose down
```

---

### Option 2: PM2 Process Manager

#### 1. Install PM2

```bash
npm install -g pm2
```

#### 2. Create ecosystem.config.js

```javascript
module.exports = {
  apps: [{
    name: 'unified-server',
    script: './dist/server.js',
    instances: 4, // Use all CPU cores
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G',
    autorestart: true,
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
  }],
};
```

#### 3. Deploy

```bash
# Build application
npm run build

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup

# Monitor
pm2 monit

# View logs
pm2 logs unified-server

# Restart
pm2 restart unified-server

# Stop
pm2 stop unified-server
```

---

### Option 3: Systemd Service

#### 1. Create service file

```ini
# /etc/systemd/system/unified-server.service

[Unit]
Description=Unified Multi-Protocol Server
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=app
WorkingDirectory=/opt/unified-server
Environment=NODE_ENV=production
EnvironmentFile=/opt/unified-server/.env.production
ExecStart=/usr/bin/node /opt/unified-server/dist/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=unified-server

[Install]
WantedBy=multi-user.target
```

#### 2. Deploy

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable unified-server

# Start service
sudo systemctl start unified-server

# Check status
sudo systemctl status unified-server

# View logs
sudo journalctl -u unified-server -f
```

---

## Production Checklist

### Security

- [ ] Use HTTPS/WSS (SSL/TLS certificates)
- [ ] Set strong JWT_SECRET (32+ characters)
- [ ] Use strong database passwords
- [ ] Enable Helmet security headers
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Use Redis password
- [ ] Run as non-root user
- [ ] Keep dependencies updated

### Performance

- [ ] Enable compression
- [ ] Configure connection pooling
- [ ] Set appropriate cache TTLs
- [ ] Use Redis for PubSub in multi-instance
- [ ] Enable clustering (PM2 or K8s)
- [ ] Configure keep-alive timeouts
- [ ] Set appropriate rate limits

### Monitoring

- [ ] Enable metrics endpoint
- [ ] Setup Prometheus scraping
- [ ] Configure Grafana dashboards
- [ ] Setup log aggregation
- [ ] Configure alerts
- [ ] Monitor error rates
- [ ] Track WebSocket connections

### Database

- [ ] Run database migrations
- [ ] Configure backups
- [ ] Setup read replicas (if needed)
- [ ] Monitor query performance
- [ ] Set up connection pooling

### Reliability

- [ ] Configure health checks
- [ ] Setup graceful shutdown
- [ ] Configure auto-restart
- [ ] Test disaster recovery
- [ ] Document runbooks
- [ ] Setup monitoring alerts

---

## Nginx Configuration

### nginx.conf

```nginx
upstream backend {
    least_conn;
    server app:3000;
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    # SSL configuration
    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # HTTP API
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /ws {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeouts
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Health check
    location /health {
        proxy_pass http://backend;
        access_log off;
    }
}

# Metrics (restrict access)
server {
    listen 9090;
    server_name localhost;

    location /metrics {
        proxy_pass http://backend:9090;
        allow 10.0.0.0/8;  # Internal network only
        deny all;
    }
}
```

---

## Monitoring

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'unified-server'
    static_configs:
      - targets: ['app:9090']
```

### Grafana Dashboard

Import dashboard for:
- HTTP request rates
- WebSocket connections
- Response times
- Error rates
- Database pool usage
- Redis cache hit rate

---

## Scaling

### Horizontal Scaling

#### Requirements:
- **Redis PubSub**: Required for multi-instance WebSocket
- **Load Balancer**: Distribute traffic
- **Session Affinity**: Not required (stateless HTTP)

#### Configuration:

```env
# Enable Redis PubSub
PUBSUB_ADAPTER=redis
PUBSUB_REDIS_URL=redis://redis.example.com:6379
```

#### Docker Compose Scale:

```bash
docker-compose up -d --scale app=4
```

#### Kubernetes:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: unified-server
spec:
  replicas: 4
  selector:
    matchLabels:
      app: unified-server
  template:
    metadata:
      labels:
        app: unified-server
    spec:
      containers:
      - name: app
        image: unified-server:latest
        ports:
        - containerPort: 3000
        env:
        - name: PUBSUB_ADAPTER
          value: "redis"
        - name: PUBSUB_REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: url
```

---

## Troubleshooting

### Server Won't Start

**Check logs:**
```bash
# PM2
pm2 logs unified-server --lines 100

# Docker
docker-compose logs app

# Systemd
sudo journalctl -u unified-server -n 100
```

**Common issues:**
- Database connection failed → Check DB_HOST, credentials
- Port already in use → Change PORT
- Missing environment variables → Check .env file

### WebSocket Not Working

**Check:**
- `WEBSOCKET_ENABLED=true` in env
- Nginx WebSocket proxy configuration
- Firewall allows WebSocket port
- SSL certificate valid for WSS

**Test connection:**
```bash
wscat -c ws://localhost:3000/ws
```

### High Memory Usage

**Solutions:**
- Reduce `DB_POOL_MAX`
- Lower `WEBSOCKET_MAX_CONNECTIONS_PER_IP`
- Enable compression
- Check for memory leaks in logs

### Database Connection Pool Exhausted

**Solutions:**
- Increase `DB_POOL_MAX`
- Check for long-running queries
- Add read replicas
- Optimize slow queries

---

## Support

For deployment issues:
- Check logs first
- Review this guide
- Check GitHub Issues
- Contact support

---

**Last Updated:** 2025-11-11
**Version:** 1.0.0
