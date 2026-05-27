# Production Deployment Guide

## Overview
This guide covers deploying the AI Coding Intelligence Dashboard to production environments.

## Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- Environment variables configured
- SSL/TLS certificate (for HTTPS)

## Environment Setup

### 1. Environment Variables
Create a `.env.production` file with the following variables:

```bash
# Server Configuration
NODE_ENV=production
PORT=3001

# Security
ALLOWED_ORIGINS=https://yourdomain.com
API_KEY=your_secure_api_key_here

# Database (if applicable)
DATABASE_URL=your_production_database_url

# Monitoring (optional)
SENTRY_DSN=your_sentry_dsn
LOG_LEVEL=info
```

### 2. Install Production Dependencies
```bash
npm install --production
```

## Deployment Options

### Option 1: Direct Node.js Deployment

#### Linux/Mac:
```bash
chmod +x start-production.sh
./start-production.sh
```

#### Windows:
```cmd
start-production.bat
```

### Option 2: Using PM2 (Process Manager)

1. Install PM2 globally:
```bash
npm install -g pm2
```

2. Create ecosystem file `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'ai-dashboard',
    script: './dashboard-server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

3. Start with PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Option 3: Docker Deployment

1. Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001

CMD ["node", "dashboard-server.js"]
```

2. Create `.dockerignore`:
```
node_modules
npm-debug.log
.env
.git
.gitignore
README.md
```

3. Build and run:
```bash
docker build -t ai-dashboard .
docker run -p 3001:3001 --env-file .env.production ai-dashboard
```

## Security Configuration

### 1. SSL/TLS Setup
Use a reverse proxy like Nginx for SSL termination:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Firewall Configuration
```bash
# Allow only necessary ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

## Monitoring and Logging

### 1. Application Logging
Logs are stored in the following locations:
- Error logs: `./logs/err.log`
- Output logs: `./logs/out.log`

### 2. PM2 Monitoring
```bash
pm2 monit
pm2 logs ai-dashboard
pm2 status
```

### 3. Health Checks
Add health check endpoint monitoring:
```bash
curl http://localhost:3001/health
```

## Performance Optimization

### 1. Enable Compression
Compression is automatically enabled in production mode.

### 2. Static Asset Caching
Static assets are cached for 24 hours by default.

### 3. Rate Limiting
API endpoints are rate-limited to 100 requests per 15 minutes per IP.

## Scaling

### Horizontal Scaling
Use PM2 cluster mode:
```javascript
instances: 'max', // Use all CPU cores
exec_mode: 'cluster'
```

### Load Balancing
Use Nginx or a cloud load balancer to distribute traffic across multiple instances.

## Backup Strategy

### 1. Database Backups
```bash
# Daily database backups
0 2 * * * /path/to/backup-script.sh
```

### 2. Configuration Backups
Backup environment files and configuration regularly.

## Troubleshooting

### Common Issues

1. **Port already in use**
```bash
lsof -i :3001
kill -9 <PID>
```

2. **Memory issues**
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" node dashboard-server.js
```

3. **Permission issues**
```bash
chmod +x start-production.sh
```

## Maintenance

### 1. Update Dependencies
```bash
npm update
npm audit fix
```

### 2. Monitor Disk Space
```bash
df -h
du -sh logs/
```

### 3. Log Rotation
Configure logrotate for application logs:
```
/path/to/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
```

## Rollback Plan

1. Keep previous version backup
2. Use Git tags for version control
3. Database rollback scripts ready
4. Quick rollback procedure documented

## Support

For production issues:
- Check logs: `./logs/err.log`
- Monitor system resources
- Review security logs
- Contact support team

## Checklist

- [ ] Environment variables configured
- [ ] SSL/TLS certificates installed
- [ ] Firewall rules configured
- [ ] Database backups scheduled
- [ ] Monitoring setup
- [ ] Log rotation configured
- [ ] Health checks implemented
- [ ] Rollback plan tested
- [ ] Team trained on deployment process
- [ ] Documentation updated