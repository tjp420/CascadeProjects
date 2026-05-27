# CDN Configuration Guide

This document provides instructions for configuring a CDN (Content Delivery Network) for the AI Coding Intelligence Dashboard.

## Overview

The application has been optimized for CDN caching with the following features:
- HTTP caching headers with appropriate TTLs
- ETag support for conditional requests
- Cache-Control directives for different content types
- Stale-while-revalidate for improved performance
- Service worker for offline support

## Supported CDN Providers

The application is compatible with most CDN providers including:
- Cloudflare
- AWS CloudFront
- Azure CDN
- Fastly
- Akamai

## Configuration Steps

### 1. Choose a CDN Provider

Select a CDN provider based on your requirements:
- **Cloudflare**: Free tier available, easy setup, good performance
- **AWS CloudFront**: Best for AWS infrastructure, pay-as-you-go
- **Azure CDN**: Best for Azure infrastructure
- **Fastly**: High performance, advanced features

### 2. Configure CDN Origin

Set up your CDN with the following origin configuration:

**Origin URL:** `http://localhost:8080` (or your production API URL)

**Origin Protocol:** HTTP/HTTPS

**Ports:** 8080 (or your configured API port)

### 3. Configure Caching Rules

The application sends the following cache headers automatically:

#### Static Files
- **Cache-Control:** `public, max-age=31536000, immutable`
- **TTL:** 1 year
- **Content:** CSS, JS, images, fonts
- **Strategy:** Cache-first

#### API Endpoints

**Analysis Data**
- **Cache-Control:** `public, max-age=300, s-maxage=300, stale-while-revalidate=60`
- **CDN-Cache-Control:** `public, max-age=300`
- **TTL:** 5 minutes
- **Endpoints:** `/api/analysis/*`

**Projects Data**
- **Cache-Control:** `public, max-age=900, s-maxage=900, stale-while-revalidate=120`
- **CDN-Cache-Control:** `public, max-age=900`
- **TTL:** 15 minutes
- **Endpoints:** `/api/projects/*`

**User Data**
- **Cache-Control:** `private, max-age=3600`
- **TTL:** 1 hour
- **Endpoints:** `/api/auth/me`

**Notifications**
- **Cache-Control:** `private, max-age=60`
- **TTL:** 1 minute
- **Endpoints:** `/api/notifications/*`

### 4. Configure Cache Invalidation

Set up cache invalidation rules:

**Automatic Invalidation:**
- Versioned assets with `?v=` query parameter
- ETag-based conditional requests
- Service worker cache management

**Manual Invalidation:**
- Invalidate `/api/analysis/*` after code analysis updates
- Invalidate `/api/projects/*` after project changes
- Invalidate static files on deployment

### 5. Configure SSL/TLS

Enable HTTPS for your CDN:
- Upload SSL certificate to CDN
- Configure HTTPS redirect
- Enable HSTS headers

### 6. Configure Custom Headers

The application already sends CDN-friendly headers:
- `X-Cache-Status`: Cache hit/miss indicator
- `X-Content-Type-Options`: nosniff
- `X-Frame-Options`: SAMEORIGIN
- `X-XSS-Protection`: 1; mode=block

### 7. Test CDN Configuration

Verify CDN is working:

1. **Check Cache Headers:**
   ```bash
   curl -I http://your-cdn-url/api/analysis/quality
   ```

2. **Verify Cache Hits:**
   ```bash
   curl -I http://your-cdn-url/static/dashboard_components/api-client.js
   ```

3. **Monitor CDN Metrics:**
   - Cache hit rate
   - Response times
   - Bandwidth usage

## Cloudflare Configuration Example

### Step 1: Add Site to Cloudflare
1. Log in to Cloudflare dashboard
2. Add your domain
3. Update nameservers

### Step 2: Configure DNS
```
Type: CNAME
Name: api
Target: your-api-server.com
Proxy status: Proxied (orange cloud icon)
```

### Step 3: Configure Caching
- Go to Caching > Configuration
- Set Caching Level: Standard
- Enable Browser Cache TTL: Respect Existing Headers
- Enable Always Online: Yes

### Step 4: Page Rules
Create page rules for specific caching:
```
Pattern: /api/analysis/*
Settings: Cache Level: Cache Everything, Edge Cache TTL: 5 minutes

Pattern: /static/*
Settings: Cache Level: Cache Everything, Edge Cache TTL: 1 year
```

## AWS CloudFront Configuration Example

### Step 1: Create Distribution
1. Go to AWS CloudFront console
2. Create Distribution
3. Set Origin Domain Name to your API server

### Step 2: Configure Behaviors
- Path Pattern: `/api/analysis/*`
- Target Origin ID: Your API origin
- Cache Policy: CachingOptimized
- Origin Request Policy: CORS-S3Origin

### Step 3: Configure Cache Behaviors
- Create separate behavior for static files
- Use Managed-CachingOptimized policy for static assets

## Monitoring and Maintenance

### Key Metrics to Monitor
- Cache hit rate (target: >80%)
- Response times (target: <200ms)
- Bandwidth usage
- Error rates

### Maintenance Tasks
- Regularly review cache hit rates
- Update cache invalidation rules as needed
- Monitor CDN costs
- Test cache invalidation after deployments

## Troubleshooting

### Cache Not Working
1. Check CDN configuration
2. Verify cache headers are being sent
3. Check CDN logs for errors
4. Test with curl to verify headers

### Stale Content
1. Manually invalidate cache
2. Check cache TTL settings
3. Verify ETag implementation
4. Check service worker cache

### Performance Issues
1. Monitor CDN edge locations
2. Check cache hit rates
3. Review CDN metrics
4. Test with different CDN providers

## Expected Outcomes

After implementing CDN caching:
- **Cache hit rate:** 80% (from 34%)
- **Load time:** -1.5s improvement
- **Server requests:** -65% reduction
- **Bandwidth:** 45% savings
