# 🚀 Deployment Guide

## Overview

This guide covers deploying the Cascade AI Platform to various environments.

## Prerequisites

- Node.js >= 16.0.0
- Python >= 3.8
- npm >= 8.0.0
- PostgreSQL (optional, for production)

## Environment Setup

### 1. Clone and Setup

```bash
git clone <repository-url>
cd ai-platform
```

### 2. Install Dependencies

```bash
# Node.js dependencies
npm install

# Python dependencies (if using AI features)
pip install -r requirements.txt
```

### 3. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

### 4. Database Setup (Optional)

```bash
# Create database
createdb cascade_platform

# Run migrations (if applicable)
npm run migrate
```

## Development Deployment

### Local Development

```bash
# Start development server
npm run dev

# Start AI system (separate terminal)
python src/ai-system/main.py
```

### Docker Development

```bash
# Build development image
docker build -t cascade-ai-platform:dev .

# Run with docker-compose
docker-compose -f docker-compose.dev.yml up
```

## Production Deployment

### Method 1: Direct Node.js

```bash
# Build for production
npm run build

# Set production environment
export NODE_ENV=production

# Start production server
npm start
```

### Method 2: PM2 Process Manager

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save
pm2 startup
```

### Method 3: Docker Production

```bash
# Build production image
docker build -t cascade-ai-platform:latest .

# Run with docker-compose
docker-compose -f docker-compose.yml up -d
```

### Method 4: Kubernetes

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n cascade-platform
```

## Configuration

### Environment Variables

Key production environment variables:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/dbname
AI_API_KEY=your-production-ai-key
JWT_SECRET=your-production-jwt-secret
CORS_ORIGIN=https://yourdomain.com
```

### Security Considerations

1. **HTTPS**: Always use HTTPS in production
2. **Environment Variables**: Never commit secrets to git
3. **Database**: Use strong passwords and SSL
4. **API Keys**: Rotate keys regularly
5. **Firewall**: Configure appropriate firewall rules

## Monitoring and Logging

### Application Monitoring

```bash
# Check application logs
pm2 logs cascade-platform

# Monitor system resources
pm2 monit
```

### Health Checks

```bash
# Check API health
curl https://yourdomain.com/api/health

# Check system status
curl https://yourdomain.com/api/status
```

## Scaling

### Horizontal Scaling

```bash
# Scale with PM2
pm2 scale cascade-platform 4

# Scale with Kubernetes
kubectl scale deployment cascade-platform --replicas=4
```

### Load Balancing

Use nginx or cloud load balancers:

```nginx
upstream cascade-platform {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}
```

## Backup and Recovery

### Database Backups

```bash
# Create backup
pg_dump cascade_platform > backup_$(date +%Y%m%d).sql

# Restore backup
psql cascade_platform < backup_20231201.sql
```

### File System Backups

```bash
# Backup application files
tar -czf cascade-platform-backup.tar.gz ai-platform/
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Find process using port
   lsof -i :3000
   
   # Kill process
   kill -9 <PID>
   ```

2. **Database Connection Failed**
   ```bash
   # Check database status
   pg_isready -h localhost -p 5432
   
   # Check connection string
   echo $DATABASE_URL
   ```

3. **Memory Issues**
   ```bash
   # Check memory usage
   free -h
   
   # Increase Node.js memory limit
   node --max-old-space-size=4096 server/index.js
   ```

### Performance Optimization

1. **Enable Gzip Compression**
2. **Use CDN for Static Assets**
3. **Implement Caching**
4. **Optimize Database Queries**
5. **Monitor and Profile Performance**

## Maintenance

### Regular Tasks

1. **Update Dependencies**
   ```bash
   npm audit fix
   npm update
   ```

2. **Security Updates**
   ```bash
   npm audit
   pip audit
   ```

3. **Log Rotation**
   ```bash
   # Configure logrotate
   sudo nano /etc/logrotate.d/cascade-platform
   ```

4. **Performance Monitoring**
   ```bash
   # Monitor application metrics
   npm run monitor
   ```

## Support

For deployment issues:
1. Check logs: `pm2 logs` or application logs
2. Verify environment variables
3. Check system resources
4. Review this documentation
5. Create an issue in the repository

---

*Last Updated: 2026-05-21*
