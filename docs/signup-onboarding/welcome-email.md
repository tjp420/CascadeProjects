# Welcome Email Templates

## Email Verification Email

### Subject Line
```
Confirm Your Email Address - SimpleBeacon
```

### Plain Text Body
```
Hello [USER_FIRST_NAME],

Thank you for signing up for SimpleBeacon! 

To complete your account activation, please verify your email address by clicking the link below:

[VERIFICATION_LINK]

This link will expire in 24 hours for security reasons.

If you did not create this account, please ignore this email or contact our support team at support@simplebeacon.com.

Best regards,
The SimpleBeacon Team

---
SimpleBeacon
support@simplebeacon.com
https://www.simplebeacon.com
```

### HTML Body
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Your Email Address</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.5;
      color: #333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
    }
    .content {
      padding: 40px;
    }
    .content p {
      margin: 15px 0;
      font-size: 16px;
      line-height: 1.6;
    }
    .greeting {
      font-size: 18px;
      font-weight: 500;
      margin-bottom: 20px;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 14px 32px;
      border-radius: 4px;
      text-decoration: none;
      font-weight: 600;
      margin: 20px 0;
      font-size: 16px;
    }
    .cta-button:hover {
      opacity: 0.9;
    }
    .expiration-notice {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
      font-size: 14px;
      color: #856404;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-top: 1px solid #e0e0e0;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    .footer p {
      margin: 5px 0;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>SimpleBeacon</h1>
    </div>
    
    <div class="content">
      <p class="greeting">Hello [USER_FIRST_NAME],</p>
      
      <p>Thank you for signing up for SimpleBeacon! We're excited to have you on board.</p>
      
      <p>To complete your account activation and start using SimpleBeacon, please verify your email address by clicking the button below:</p>
      
      <center>
        <a href="[VERIFICATION_LINK]" class="cta-button">Verify Email Address</a>
      </center>
      
      <p>Or copy and paste this link in your browser:</p>
      <p style="word-break: break-all; background-color: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px;">
        [VERIFICATION_LINK]
      </p>
      
      <div class="expiration-notice">
        <strong>Security Notice:</strong> This verification link expires in 24 hours. If you did not request this email, please ignore it or contact support.
      </div>
      
      <p>Once verified, you'll have full access to SimpleBeacon's features, including:</p>
      <ul>
        <li>Real-time scanning and monitoring</li>
        <li>Detailed threat intelligence reports</li>
        <li>Customizable alerts and notifications</li>
        <li>Team collaboration tools</li>
      </ul>
      
      <p>If you have any questions or need assistance, don't hesitate to reach out to our support team at <a href="mailto:support@simplebeacon.com">support@simplebeacon.com</a>.</p>
      
      <p>Best regards,<br>The SimpleBeacon Team</p>
    </div>
    
    <div class="footer">
      <p>SimpleBeacon | <a href="https://www.simplebeacon.com">Visit Website</a> | <a href="https://docs.simplebeacon.com">Documentation</a></p>
      <p><a href="https://www.simplebeacon.com/support">Support</a> | <a href="https://www.simplebeacon.com/privacy">Privacy Policy</a></p>
      <p>&copy; 2026 SimpleBeacon. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## Welcome Email (After Onboarding)

### Subject Line
```
Welcome to SimpleBeacon! Get Started in 3 Steps 🚀
```

### Plain Text Body
```
Hello [USER_FIRST_NAME],

Welcome to SimpleBeacon! Your account is now active and ready to use.

GET STARTED IN 3 STEPS:
1. Complete Your Profile - https://app.simplebeacon.com/onboarding/profile
2. Set Up Your First Scan - https://app.simplebeacon.com/new-scan
3. Configure Alerts - https://app.simplebeacon.com/settings/notifications

QUICK LINKS:
- Getting Started Guide: https://docs.simplebeacon.com/getting-started
- Video Tutorials: https://docs.simplebeacon.com/tutorials
- API Documentation: https://api.simplebeacon.com/docs
- Knowledge Base: https://help.simplebeacon.com

KEY FEATURES INCLUDED:
- Continuous Monitoring: Real-time threat detection across your digital assets
- Threat Intelligence: Comprehensive reports with actionable insights
- Smart Alerts: Intelligent notification system reduces alert fatigue
- Team Collaboration: Share findings and coordinate responses with your team

NEXT STEPS:
Visit your dashboard to start exploring: https://app.simplebeacon.com/dashboard

If you have any questions, our support team is here to help:
Email: support@simplebeacon.com
Live Chat: Available in your dashboard (weekdays 8am-6pm EST)

Happy scanning!

Best regards,
The SimpleBeacon Team

---
SimpleBeacon - Security & Threat Detection Platform
https://www.simplebeacon.com
support@simplebeacon.com
```

### HTML Body
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to SimpleBeacon</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.5;
      color: #333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 32px;
      font-weight: 600;
    }
    .header .subtitle {
      font-size: 16px;
      margin-top: 10px;
      opacity: 0.95;
    }
    .content {
      padding: 40px;
    }
    .content p {
      margin: 15px 0;
      font-size: 16px;
      line-height: 1.6;
    }
    .greeting {
      font-size: 18px;
      font-weight: 500;
      margin-bottom: 10px;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #667eea;
      margin-top: 25px;
      margin-bottom: 15px;
      border-bottom: 2px solid #667eea;
      padding-bottom: 10px;
    }
    .step-item {
      background-color: #f8f9fa;
      border-left: 4px solid #667eea;
      padding: 12px;
      margin: 10px 0;
      border-radius: 4px;
    }
    .step-number {
      font-weight: 600;
      color: #667eea;
    }
    .feature-item {
      display: flex;
      margin: 10px 0;
      padding: 10px;
      background-color: #f8f9fa;
      border-radius: 4px;
    }
    .feature-icon {
      margin-right: 12px;
      font-size: 18px;
    }
    .feature-text {
      flex: 1;
    }
    .feature-text strong {
      display: block;
      color: #667eea;
      margin-bottom: 2px;
    }
    .link-list {
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 4px;
      margin: 15px 0;
    }
    .link-list a {
      display: inline-block;
      color: #667eea;
      text-decoration: none;
      margin-right: 15px;
      margin-bottom: 8px;
      font-weight: 500;
    }
    .link-list a:hover {
      text-decoration: underline;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 14px 32px;
      border-radius: 4px;
      text-decoration: none;
      font-weight: 600;
      margin: 20px 0;
      font-size: 16px;
    }
    .cta-button:hover {
      opacity: 0.9;
    }
    .support-box {
      background-color: #e7f3ff;
      border-left: 4px solid #2196F3;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .support-box strong {
      color: #1976D2;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-top: 1px solid #e0e0e0;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    .footer p {
      margin: 5px 0;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>🎉 Welcome to SimpleBeacon!</h1>
      <p class="subtitle">Your account is active and ready to use</p>
    </div>
    
    <div class="content">
      <p class="greeting">Hello [USER_FIRST_NAME],</p>
      
      <p>Your SimpleBeacon account is now fully activated and ready to explore! Here's how to get started:</p>
      
      <div class="section-title">🚀 Get Started in 3 Steps</div>
      <div class="step-item">
        <span class="step-number">Step 1:</span> Complete Your Profile
        <br><a href="https://app.simplebeacon.com/onboarding/profile">Update your profile settings</a>
      </div>
      <div class="step-item">
        <span class="step-number">Step 2:</span> Set Up Your First Scan
        <br><a href="https://app.simplebeacon.com/new-scan">Create your first security scan</a>
      </div>
      <div class="step-item">
        <span class="step-number">Step 3:</span> Configure Alerts
        <br><a href="https://app.simplebeacon.com/settings/notifications">Set up notifications for threats</a>
      </div>
      
      <center>
        <a href="https://app.simplebeacon.com/dashboard" class="cta-button">Go to Dashboard</a>
      </center>
      
      <div class="section-title">⚡ Key Features</div>
      <div class="feature-item">
        <div class="feature-icon">🔍</div>
        <div class="feature-text">
          <strong>Continuous Monitoring</strong>
          Real-time threat detection across your digital assets
        </div>
      </div>
      <div class="feature-item">
        <div class="feature-icon">📊</div>
        <div class="feature-text">
          <strong>Threat Intelligence</strong>
          Comprehensive reports with actionable insights
        </div>
      </div>
      <div class="feature-item">
        <div class="feature-icon">🔔</div>
        <div class="feature-text">
          <strong>Smart Alerts</strong>
          Intelligent notification system reduces alert fatigue
        </div>
      </div>
      <div class="feature-item">
        <div class="feature-icon">👥</div>
        <div class="feature-text">
          <strong>Team Collaboration</strong>
          Share findings and coordinate responses with your team
        </div>
      </div>
      
      <div class="section-title">📚 Quick Links</div>
      <div class="link-list">
        <a href="https://docs.simplebeacon.com/getting-started">Getting Started Guide</a><br>
        <a href="https://docs.simplebeacon.com/tutorials">Video Tutorials</a><br>
        <a href="https://api.simplebeacon.com/docs">API Documentation</a><br>
        <a href="https://help.simplebeacon.com">Knowledge Base</a>
      </div>
      
      <div class="support-box">
        <strong>Need Help?</strong><br>
        Our support team is here for you! Email us at <a href="mailto:support@simplebeacon.com">support@simplebeacon.com</a> or use the live chat in your dashboard (weekdays 8am-6pm EST).
      </div>
      
      <p>Happy scanning!<br><strong>The SimpleBeacon Team</strong></p>
    </div>
    
    <div class="footer">
      <p>SimpleBeacon - Security & Threat Detection Platform</p>
      <p><a href="https://www.simplebeacon.com">Visit Website</a> | <a href="https://docs.simplebeacon.com">Documentation</a> | <a href="https://www.simplebeacon.com/support">Support</a></p>
      <p><a href="https://www.simplebeacon.com/privacy">Privacy Policy</a> | <a href="https://www.simplebeacon.com/terms">Terms of Service</a></p>
      <p>&copy; 2026 SimpleBeacon. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## Email Configuration Reference

### Email Server Details
- **SMTP Server:** mail.simplebeacon.com (placeholder)
- **Port:** 587 (TLS) or 465 (SSL)
- **Authentication:** API key based (credentials stored in environment variables)
- **From Address:** noreply@simplebeacon.com
- **Reply-To:** support@simplebeacon.com

### Template Variables
| Variable | Description | Example |
|----------|-------------|---------|
| [USER_FIRST_NAME] | User's first name | John |
| [USER_EMAIL] | User's email address | john@example.com (placeholder) |
| [VERIFICATION_LINK] | Email verification URL | https://app.simplebeacon.com/verify?token=... |
| [COMPANY_NAME] | Company name if provided | Acme Corp |
| [SUPPORT_EMAIL] | Support contact | support@simplebeacon.com |

### Email Delivery Guarantees
- Verification emails: Critical path - retry up to 3 times over 1 hour
- Welcome emails: Best effort - retry up to 2 times over 24 hours
- Bounce handling: Automatic suppression after 5 consecutive bounces
- Unsubscribe: Available via link in footer (for marketing emails only)

### Analytics Tracking
- Email opens: Pixel tracking enabled
- Link clicks: URL parameter tracking (utm_source=email, utm_medium=welcome)
- Event mapping: email_opened, email_clicked, verification_link_clicked
