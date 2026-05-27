# Centralized Navigation System

This document explains how to use the new centralized navigation system for the Cascade AI Platform.

## Overview

The centralized navigation system eliminates duplicate navigation code across all HTML pages by using a single navigation component that is dynamically loaded into each page.

## Files Created

### 1. Navigation Component
- **File**: `src/web/components/navigation-sidebar.html`
- **Purpose**: Contains the complete navigation sidebar HTML structure
- **Features**: 
  - All navigation links organized by sections
  - Responsive design with mobile support
  - Active state highlighting
  - Collapsible sidebar functionality

### 2. Navigation Loader
- **File**: `src/web/js/navigation-loader.js`
- **Purpose**: Dynamically loads the navigation component into all pages
- **Features**:
  - Automatic navigation loading
  - Active state detection based on current URL
  - Fallback navigation if component fails to load
  - Sidebar state persistence

### 3. Page Template
- **File**: `src/web/templates/page-template.html`
- **Purpose**: Template showing how to structure new pages
- **Usage**: Copy and modify for new pages

### 4. Migration Script
- **File**: `src/web/scripts/migrate-navigation.js`
- **Purpose**: Automatically converts existing HTML files to use centralized navigation
- **Features**: 
  - Extracts main content from existing files
  - Preserves existing styles and scripts
  - Creates backups of original files

## How to Use

### For New Pages

1. Copy the template from `src/web/templates/page-template.html`
2. Modify the page title and content
3. Add your page-specific styles and scripts

### For Existing Pages

#### Option 1: Use the Migration Script

```bash
cd src/web
node scripts/migrate-navigation.js
```

This will automatically convert all HTML files in the directory.

#### Option 2: Manual Conversion

1. Replace your existing navigation HTML with:
```html
<!-- Navigation Container - This will be populated by navigation-loader.js -->
<div class="navigation-container"></div>
```

2. Wrap your main content with:
```html
<!-- Main Content Area -->
<div class="main-content-with-sidebar">
    <!-- Your existing page content goes here -->
</div>
```

3. Add the navigation loader script before your closing `</body>` tag:
```html
<script src="/js/navigation-loader.js"></script>
```

## Server Configuration

Update your server to serve the navigation component:

```javascript
// Add to your server routes
app.get('/components/navigation-sidebar.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'src/web/components/navigation-sidebar.html'));
});

app.get('/js/navigation-loader.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'src/web/js/navigation-loader.js'));
});
```

## Navigation Structure

The navigation is organized into the following sections:

### 🤖 AI Tools
- AI Tools
- AI Roadmap
- AI Analysis
- GGUF Analysis
- Code Generation
- Issue Resolution
- Mock Data Analyzer

### 📊 Analytics
- Reports
- Analytics
- Performance

### 🔧 Development
- Dev Tools
- Database
- API
- Merger Tool
- Layout Analyzer

### 🗺️ Roadmap
- Development Roadmap
- AI-Powered Roadmap
- Release Timeline
- Feature Backlog

### 🔧 Technical Debt
- Debt Calculator
- Debt Reduction
- Debt Analytics

### 📁 Project Resources
- Billing System
- Reports
- Assets Library
- Code Templates
- Coverage Reports

### ⚙️ Settings
- Settings
- Help

## Features

### Active State Detection
The navigation automatically highlights the current page based on the URL path.

### Responsive Design
- **Desktop**: Sidebar is always visible, can be collapsed
- **Mobile**: Sidebar is hidden by default, toggles with button

### Sidebar Persistence
The sidebar collapsed state is saved to localStorage and restored on page load.

### Fallback Navigation
If the navigation component fails to load, a simple fallback navigation is provided.

## Styling

The navigation uses CSS custom properties for easy theming:

```css
:root {
    --bg-primary: #0f172a;
    --bg-secondary: #1e293b;
    --text-primary: #f1f5f9;
    --accent-color: #6366f1;
    /* ... more variables */
}
```

## JavaScript API

### Global Functions

- `setActiveNav(element)`: Manually set active navigation state
- `toggleSidebar()`: Toggle sidebar collapsed state

### Events

The navigation loader dispatches events:
- `navigationLoaded`: Fired when navigation component is loaded
- `navigationError`: Fired when navigation fails to load

## Benefits

### Before Centralization
- ❌ Duplicate navigation code in every HTML file
- ❌ Maintenance required across multiple files
- ❌ Inconsistent navigation between pages
- ❌ Difficult to add new navigation items

### After Centralization
- ✅ Single source of truth for navigation
- ✅ Easy maintenance and updates
- ✅ Consistent navigation across all pages
- ✅ Simple to add new navigation items
- ✅ Automatic active state detection
- ✅ Responsive design built-in

## Troubleshooting

### Navigation Not Loading
1. Check that `navigation-loader.js` is included in your HTML
2. Verify the server is serving the navigation component
3. Check browser console for errors

### Active State Not Working
1. Ensure URLs match the navigation href attributes
2. Check that the navigation loader script runs before other scripts

### Styling Issues
1. Verify CSS variables are properly defined
2. Check that the navigation component CSS is loaded

## Migration Checklist

- [ ] Run the migration script or convert files manually
- [ ] Update server routes for navigation component
- [ ] Test navigation on all pages
- [ ] Verify responsive behavior on mobile
- [ ] Remove backup files once confirmed working
- [ ] Update any page-specific navigation code

## Future Enhancements

Potential improvements for the centralized navigation system:

- Dynamic navigation based on user permissions
- Search functionality within navigation
- Keyboard shortcuts for navigation
- Navigation analytics and usage tracking
- Theme switching support
- Multi-language support for navigation labels
