# Fast-Track Deployment Guide
## AI Coding Intelligence Dashboard

This guide will help you deploy your dashboard to production in under 2 hours using Vercel and Auth0.

---

## 🚀 Quick Start (2 Hours to Production)

### **Phase 1: Vercel Setup (30 minutes)**

#### Step 1: Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub (recommended)
3. Verify your email address

#### Step 2: Import Your Project
1. Click **"Add New Project"**
2. Select your GitHub repository
3. Configure the following settings:
   - **Framework Preset**: Other
   - **Root Directory**: `./` (project root)
   - **Build Command**: (leave empty - static site)
   - **Output Directory**: `web`
   - **Node Version**: 18.x

#### Step 3: Configure Environment Variables
1. In Vercel project settings, go to **Environment Variables**
2. Add the following variables (use placeholder values for now):
   ```
   NODE_ENV=production
   APP_URL=https://your-project.vercel.app
   ```

#### Step 4: Deploy
1. Click **"Deploy"**
2. Wait for deployment to complete (~2 minutes)
3. Visit your new Vercel URL (e.g., `https://your-project-abc123.vercel.app`)
4. Verify the dashboard loads correctly

---

### **Phase 2: Auth0 Setup (45 minutes)**

#### Step 1: Create Auth0 Account
1. Go to [auth0.com](https://auth0.com)
2. Sign up for free tier
3. Create a new tenant (choose a region close to your users)

#### Step 2: Create Application
1. In Auth0 dashboard, go to **Applications** → **Applications**
2. Click **"Create Application"**
3. Choose **Single Page Web Applications**
4. Name it: "AI Coding Intelligence Dashboard"
5. Click **"Create"**

#### Step 3: Configure Application Settings
1. Go to **Settings** tab
2. **Application Login URI**: `https://your-project.vercel.app`
3. **Allowed Callback URLs**: `https://your-project.vercel.app`
4. **Allowed Logout URLs**: `https://your-project.vercel.app`
5. **Allowed Web Origins**: `https://your-project.vercel.app`
6. Click **"Save Changes"**

#### Step 4: Get Credentials
1. Go to **Settings** → **Basic**
2. Copy **Domain** (e.g., `your-tenant.us.auth0.com`)
3. Copy **Client ID**
4. Note: Client Secret is not needed for SPA

#### Step 5: Update Vercel Environment Variables
1. Go back to Vercel project settings
2. Add Auth0 environment variables:
   ```
   AUTH0_DOMAIN=your-tenant.us.auth0.com
   AUTH0_CLIENT_ID=your-client-id
   AUTH0_CALLBACK_URL=https://your-project.vercel.app
   ```
3. Redeploy your Vercel project

---

### **Phase 3: Integrate Auth0 (30 minutes)**

#### Step 1: Add Auth0 SDK to Your Dashboard
1. Add this to your `web/index.html` `<head>` section:
   ```html
   <script src="https://cdn.auth0.com/js/auth0-spa-js/2.0/auth0-spa-js.production.js"></script>
   <script src="web/auth0-integration.js"></script>
   ```

#### Step 2: Add Login/Logout Buttons
Add these UI elements to your dashboard:
```html
<div id="auth-section">
    <button id="auth-login-button" onclick="auth0Manager.login()">Login</button>
    <button id="auth-logout-button" onclick="auth0Manager.logout()" style="display:none;">Logout</button>
    <span id="auth-user-display" style="display:none;"></span>
</div>
```

#### Step 3: Protect API Calls
Update your API calls to include authentication:
```javascript
// Example API call with auth
async function callAPI(endpoint) {
    const token = auth0Manager.getToken();
    const response = await fetch(endpoint, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.json();
}
```

#### Step 4: Test Authentication
1. Deploy changes to Vercel
2. Visit your dashboard
3. Click "Login" button
4. Complete Auth0 login flow
5. Verify you're logged in and user info displays

---

### **Phase 4: Custom Domain & SSL (15 minutes)**

#### Step 1: Add Custom Domain
1. In Vercel, go to **Settings** → **Domains**
2. Click **"Add Domain"**
3. Enter your domain (e.g., `dashboard.yourcompany.com`)
4. Follow DNS configuration instructions

#### Step 2: Update Auth0 Callbacks
1. Go back to Auth0 application settings
2. Update URLs to use your custom domain
3. Save changes

#### Step 3: Update Environment Variables
1. Update Vercel environment variables with custom domain
2. Redeploy

---

## 🔧 Configuration Files

### Vercel Configuration
Your project includes `vercel.json` with:
- Static site configuration
- Security headers
- Asset caching
- Routing rules

### Environment Variables Template
Use `.env.production.template` as a reference for all available configuration options.

---

## 📊 Monitoring Setup (15 minutes)

### Step 1: Vercel Analytics
1. In Vercel dashboard, go to **Analytics**
2. Enable Vercel Analytics (free tier)
3. Add analytics script to your dashboard

### Step 2: Error Tracking (Sentry)
1. Create free Sentry account at [sentry.io](https://sentry.io)
2. Create new project
3. Get DSN (Data Source Name)
4. Add to Vercel environment variables:
   ```
   SENTRY_DSN=your-sentry-dsn
   ```

---

## 🚀 Deployment Checklist

Before going live, verify:

- [ ] Vercel deployment successful
- [ ] Custom domain configured
- [ ] SSL certificate active
- [ ] Auth0 authentication working
- [ ] Environment variables configured
- [ ] Error tracking (Sentry) configured
- [ ] Analytics (Vercel Analytics) enabled
- [ ] Security headers configured
- [ ] Dashboard loads correctly
- [ ] Authentication flow tested
- [ ] API endpoints accessible
- [ ] Mobile responsive tested

---

## 🛠️ Troubleshooting

### Common Issues

**Dashboard doesn't load:**
- Check Vercel deployment logs
- Verify file paths in vercel.json
- Check browser console for errors

**Auth0 login fails:**
- Verify callback URLs match exactly
- Check Auth0 application settings
- Ensure HTTPS is used (required by Auth0)

**Environment variables not working:**
- Redeploy after adding variables
- Check variable names match exactly
- Verify no trailing spaces in values

**Custom domain not working:**
- Verify DNS configuration
- Wait for DNS propagation (up to 48 hours)
- Check SSL certificate status

---

## 📝 Post-Deployment Tasks

1. **Monitor Performance**
   - Check Vercel Analytics
   - Monitor error rates in Sentry
   - Track user engagement

2. **Security Review**
   - Run security audit: `npm run security:audit`
   - Fix critical security issues
   - Review Auth0 security settings

3. **Backup Configuration**
   - Document all environment variables
   - Save Auth0 configuration
   - Keep deployment scripts updated

4. **Team Handoff**
   - Share deployment access
   - Document maintenance procedures
   - Set up monitoring alerts

---

## 🎯 Next Steps

After successful deployment:

1. **Week 2:** Security fixes and API hardening
2. **Week 3:** Database integration
3. **Week 4:** Monitoring and analytics enhancement
4. **Week 5:** User onboarding improvements
5. **Week 6:** Legal compliance and launch prep

---

## 💡 Pro Tips

1. **Use Preview Deployments:** Vercel automatically creates preview URLs for each pull request
2. **Environment Variables:** Use different variables for development/production
3. **Security Headers:** Already configured in vercel.json
4. **Caching:** Static assets are cached for 1 year for performance
5. **CDN:** Vercel provides global CDN automatically

---

## 🆘 Support

If you encounter issues:
- Check Vercel deployment logs
- Review Auth0 application logs
- Test with incognito/private browser mode
- Clear browser cache and cookies
- Check browser console for JavaScript errors

---

**Congratulations!** 🎉 Your AI Coding Intelligence Dashboard is now live in production!

**Timeline:** Under 2 hours from zero to production deployment
**Cost:** $0/month (Vercel free tier + Auth0 free tier)
**Performance:** Global CDN, automatic SSL, 99.99% uptime SLA