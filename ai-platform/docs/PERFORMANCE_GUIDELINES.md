# ⚡ Performance Guidelines

## Critical Performance Rules

### 1. Avoid Inline Scripts and Styles
```html
<!-- ❌ BAD - Inline scripts and styles -->
<script>
// Large JavaScript code
function complexLogic() { /* ... */ }
</script>
<style>
/* Large CSS code */
.large-style { /* ... */ }
</style>

<!-- ✅ GOOD - External files -->
<script src="js/app.js" defer></script>
<script src="js/utils.js" defer></script>
<link rel="stylesheet" href="css/main.css">
<link rel="stylesheet" href="css/components.css">
```

### 2. Use Proper Loading Attributes
```html
<!-- ✅ GOOD - Use defer for non-critical scripts -->
<script src="js/app.js" defer></script>

<!-- ✅ GOOD - Use async for independent scripts -->
<script src="js/analytics.js" async></script>

<!-- ✅ GOOD - Use preload for critical resources -->
<link rel="preload" href="css/critical.css" as="style">
<link rel="preload" href="js/critical.js" as="script">
```

### 3. Optimize Resource Loading
```html
<!-- ✅ GOOD - Proper loading order -->
<head>
<!-- Critical CSS first -->
<link rel="stylesheet" href="css/critical.css">

<!-- Preload important resources -->
<link rel="preload" href="js/main.js" as="script">

<!-- Non-critical CSS -->
<link rel="stylesheet" href="css/non-critical.
    css" media="print" onload="this.media='all'">
</head>

<body>
<!-- Content here -->

<!-- Scripts at the end -->
<script src="js/main.js" defer></script>
</body>
```

### 4. Implement Caching Strategies
```html
<!-- ✅ GOOD - Add cache headers -->
<meta http-equiv="Cache-Control" content="max-age=31536000, immutable">
<meta http-equiv="ETag" content="v1.0.0">

<!-- ✅ GOOD - Use versioned assets -->
<script src="js/app.v1.2.3.js"></script>
<link rel="stylesheet" href="css/main.v1.2.3.css">
```

## Implementation Checklist

- [ ] Extract inline scripts to external .js files
- [ ] Extract inline styles to external .css files
- [ ] Use defer/async attributes appropriately
- [ ] Implement proper loading order
- [ ] Add caching headers
- [ ] Use versioned assets
- [ ] Monitor performance metrics
- [ ] Continuously optimize

## Performance Best Practices

1. **Minimize HTTP Requests**: Combine files when possible
2. **Use Compression**: Enable gzip/brotli compression
3. **Optimize Images**: Use modern formats and responsive images
4. **Lazy Loading**: Load non-critical resources later
5. **CDN Usage**: Use Content Delivery Networks
6. **Monitor Metrics**: Track Core Web Vitals regularly
