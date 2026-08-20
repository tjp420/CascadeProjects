# SEO and Crawlability Checklist

## Meta Tags Templates

### Page Title Tag
```html
<!-- Recommended format: Primary Keyword | Brand Name -->
<!-- Length: 50-60 characters for optimal display -->
<title>SimpleBeacon | Security Intelligence Platform for Modern Enterprises</title>
```

### Meta Description
```html
<!-- Length: 150-160 characters for optimal display -->
<meta name="description" content="Advanced security scanning and threat intelligence platform. Real-time monitoring, compliance tracking, and actionable insights for enterprise security operations." />
```

### Meta Viewport (Mobile Responsive)
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

### Open Graph Tags (Social Media)
```html
<meta property="og:title" content="SimpleBeacon | Security Intelligence Platform" />
<meta property="og:description" content="Advanced security scanning and threat intelligence platform." />
<meta property="og:image" content="https://simplebeacon.example.com/og-image.png" />
<meta property="og:url" content="https://simplebeacon.example.com" />
<meta property="og:type" content="website" />
```

### Twitter Card Tags
```html
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="SimpleBeacon | Security Intelligence Platform" />
<meta name="twitter:description" content="Advanced security scanning and threat intelligence platform." />
<meta name="twitter:image" content="https://simplebeacon.example.com/og-image.png" />
```

### Canonical URL
```html
<!-- Prevent duplicate content issues -->
<link rel="canonical" href="https://simplebeacon.example.com" />
```

### Robots Meta Tag
```html
<!-- Control search engine crawling -->
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
```

## sitemap.xml Stub

Create `/sitemap.xml` in the web root with the following structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://simplebeacon.example.com/</loc>
    <lastmod>2026-08-19</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://simplebeacon.example.com/features</loc>
    <lastmod>2026-08-19</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://simplebeacon.example.com/pricing</loc>
    <lastmod>2026-08-19</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://simplebeacon.example.com/docs</loc>
    <lastmod>2026-08-19</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://simplebeacon.example.com/blog</loc>
    <lastmod>2026-08-19</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>
```

**Implementation Steps:**
1. Generate sitemap dynamically from your routes or statically
2. Place at `/public/sitemap.xml` or generate at build time
3. Add to root web server directory
4. Submit to Google Search Console and Bing Webmaster Tools

## robots.txt Recommendation

Create `/robots.txt` in the web root:

```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/private/
Disallow: /admin-panel/
Disallow: /*.pdf$
Crawl-delay: 2

User-agent: AdsBot-Google
Allow: /

User-agent: Googlebot
Allow: /

Sitemap: https://simplebeacon.example.com/sitemap.xml
```

**Key Points:**
- Allow general crawling of public content
- Block admin and private API endpoints
- Specify crawl delay to avoid server overload
- Include sitemap location for search engines
- Review periodically as new sections are added

## Canonical URL Guidance

### Purpose
Prevent duplicate content penalties by indicating the preferred URL version to search engines.

### Implementation Strategy

**1. Self-Referential Canonicals (Default)**
```html
<!-- On every page, link to itself -->
<link rel="canonical" href="https://example.com/page" />
```

**2. Handle Multiple Versions**
```html
<!-- On www version, point to non-www -->
<link rel="canonical" href="https://example.com/page" />

<!-- On mobile version, point to desktop version -->
<link rel="canonical" href="https://example.com/page" />
```

**3. Parameterized URLs**
- For session IDs, tracking parameters, or sorting: add canonical to base URL
```html
<!-- On page?sort=price&session=123, use: -->
<link rel="canonical" href="https://example.com/page" />
```

**4. HTTPS Priority**
- Always prefer HTTPS in canonical URLs
- Redirect HTTP to HTTPS at server level

### Common Mistakes to Avoid
- ❌ Canonical to a different domain (unless intentional)
- ❌ Multiple conflicting canonicals on same page
- ❌ Relative canonical URLs (use absolute URLs)
- ❌ Forgetting canonicals on paginated content

## On-Page SEO Checklist for Landing Page

### ✅ Technical SEO
- [ ] Page loads in under 3 seconds (Core Web Vitals: LCP < 2.5s)
- [ ] Mobile responsive design tested on multiple devices
- [ ] SSL/HTTPS enabled and properly configured
- [ ] Structured data markup implemented (Schema.org JSON-LD)
- [ ] No crawl errors in Google Search Console
- [ ] Site speed optimized (compress images, enable caching, minify CSS/JS)

### ✅ Content & Keywords
- [ ] Primary keyword appears in page title (within first 50 chars)
- [ ] Meta description includes primary keyword (150-160 chars)
- [ ] H1 tag present and contains primary keyword
- [ ] Keyword naturally appears 2-3 times in first 100 words
- [ ] Target keyword density 1-2% throughout content
- [ ] LSI keywords and related terms included
- [ ] Unique, compelling content (minimum 300 words recommended)
- [ ] Proper heading hierarchy (H1 → H2 → H3)

### ✅ Meta Tags & Structure
- [ ] Title tag optimized (50-60 characters)
- [ ] Meta description present and optimized
- [ ] Open Graph tags configured (title, description, image, URL)
- [ ] Twitter Card tags implemented
- [ ] Canonical URL tag present
- [ ] Viewport meta tag for mobile responsiveness
- [ ] Robots meta tag allows indexing

### ✅ Links & Navigation
- [ ] Internal links use descriptive anchor text
- [ ] 3-5 relevant internal links from landing page
- [ ] Navigation menu clearly structured
- [ ] Breadcrumb navigation implemented (if applicable)
- [ ] No broken links on page (404 errors)
- [ ] External links to authority sites (where relevant)

### ✅ Media & Accessibility
- [ ] All images have descriptive alt text
- [ ] Image file names are descriptive (not "image1.jpg")
- [ ] Images optimized and compressed
- [ ] Video embeds have transcripts or captions
- [ ] Color contrast meets WCAG AA standards
- [ ] Form labels properly associated with inputs

### ✅ User Experience Signals
- [ ] Clear call-to-action (CTA) above the fold
- [ ] Mobile-friendly design verified
- [ ] Fast page load time (< 3 seconds)
- [ ] Low bounce rate factors implemented
- [ ] Readability optimized (font size, line height, spacing)
- [ ] No intrusive pop-ups (unless required by law)
- [ ] Social proof elements visible (testimonials, trust badges)

### ✅ Structured Data Markup
- [ ] Organization schema implemented
- [ ] LocalBusiness schema (if applicable)
- [ ] Product/Service schema with ratings (if applicable)
- [ ] FAQ schema for common questions (if applicable)
- [ ] Breadcrumb schema implemented
- [ ] Test with Google's Rich Results Test tool

### ✅ Analytics & Monitoring
- [ ] Google Analytics 4 installed and tracking
- [ ] Google Search Console property created and verified
- [ ] Bing Webmaster Tools registered
- [ ] Sitemap submitted to search engines
- [ ] robots.txt created and tested
- [ ] Conversion tracking implemented
- [ ] Page speed monitored (PageSpeed Insights, Core Web Vitals)

### ✅ Content Quality
- [ ] Originality checked (no plagiarism)
- [ ] Spelling and grammar verified
- [ ] Content matches search intent
- [ ] Addresses user pain points and questions
- [ ] Includes trust signals and credentials
- [ ] Regularly updated and maintained

### ✅ Pre-Launch Verification
- [ ] Indexability test: site:yourdomain.com in Google
- [ ] Mobile usability test in Search Console
- [ ] Crawl test with SEO audit tool
- [ ] Page load performance acceptable
- [ ] All forms and CTAs functioning
- [ ] Email signup or newsletter integration working

## SEO Best Practices Implementation Timeline

1. **Week 1**: Meta tags, title optimization, description
2. **Week 2**: Sitemap.xml and robots.txt creation
3. **Week 3**: Structured data markup implementation
4. **Week 4**: Content quality review and optimization
5. **Week 5**: Technical SEO audit and fixes
6. **Week 6**: Search Console and Analytics setup
7. **Week 7**: Monitor rankings and traffic
8. **Week 8**: Ongoing optimization based on data

## Resources

- [Google Search Central](https://developers.google.com/search)
- [Google PageSpeed Insights](https://pagespeed.web.dev/)
- [Rich Results Test](https://search.google.com/test/rich-results)
- [Screaming Frog SEO Spider](https://www.screamingfrog.co.uk/seo-spider/)
- [Core Web Vitals Guide](https://web.dev/vitals/)
