# SimpleBeacon Framework-less Landing Page

A clean, framework-less replica of simplebeacon.ai built with HTML5, Tailwind CSS via CDN, and Vanilla JavaScript.

## 🚀 Quick Start

Simply open `index.html` in any browser - no build tools or server required!

## 📧 Setting Up Formspree for Email Submissions

To make the lead capture form actually send emails:

1. Go to [Formspree.io](https://formspree.io/) and create a free account
2. Create a new form and copy your Form ID (looks like: `mrbkrllz`)
3. Replace `YOUR_FORMSPREE_FORM_ID` in `index.html` line 297 with your actual Form ID
4. The form will now send submissions directly to your email!

Example:

```html
<form action="https://formspree.io/f/mrbkrllz" method="POST" ...></form>
```

## 🎯 Features

- **Hero Section** with copyable terminal command
- **Interactive Diagnostic Tool** that scans for:
  - Credential patterns (API keys, tokens, passwords)
  - Sample data paths in production code
  - AI-fiction KPIs (fake metrics)
- **EU AI Act Section** with compliance breakdown
- **5-Step Reputation Workflow**
- **Comparison Table** (Snyk vs SimpleBeacon)
- **Lead Capture Form** with Formspree integration
- **Responsive Design** for mobile and desktop

## 🔧 Customization

### Colors

Edit the Tailwind config in `index.html` to customize the color scheme:

```javascript
tailwind.config = {
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0B0F19', // Main background
          card: '#161B22', // Card background
          border: '#30363D', // Border color
          // ... more colors
        },
      },
    },
  },
};
```

### Diagnostic Patterns

Expand the regex patterns in `app.js` to catch more code anomalies:

```javascript
const patterns = {
  credentials: [
    // Add your custom patterns here
  ],
  samplePaths: [
    // Add more sample file patterns
  ],
  fictionKPIs: [
    // Add more fake metric patterns
  ],
};
```

## 📦 Deployment

### Netlify (Recommended - Drag & Drop)

1. Go to [Netlify Drop](https://app.netlify.com/drop)
2. Drag and drop the entire `simplebeacon-frameworkless` folder
3. Your site will be live in seconds with a URL like: `https://your-site-name.netlify.app`

### Netlify (Git Integration)

1. Push your code to GitHub
2. Go to [Netlify](https://app.netlify.com) and click "Add new site"
3. Connect your GitHub repository
4. Deploy settings are pre-configured in `netlify.toml`

### Vercel

1. Go to [Vercel](https://vercel.com) and sign up
2. Click "New Project" and import your GitHub repository
3. Deploy settings are pre-configured in `vercel.json`
4. Or use CLI: `npm i -g vercel` then run `vercel` in the project directory

### GitHub Pages

1. Push to GitHub repository
2. Go to repository Settings → Pages
3. Select `main` branch as source
4. Your site will be at: `https://yourusername.github.io/repository-name`

## 🔒 Security Headers

Both `netlify.toml` and `vercel.json` include security headers:

- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin

## 🛠️ Tech Stack

- **HTML5** - Semantic markup
- **Tailwind CSS** (CDN) - Utility-first styling
- **Vanilla JavaScript** - Interactive functionality
- **Formspree** - Form handling (optional)

## 📝 License

This is a replica project for educational purposes.
