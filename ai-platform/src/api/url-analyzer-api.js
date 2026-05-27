/**
 * URL Analyzer API
 * Provides comprehensive URL and website analysis endpoints
 */

const URLAnalyzer = require('../core/URLAnalyzer');

function setupURLAnalyzerAPIs(app) {
  // Initialize URL analyzer
  const urlAnalyzer = new URLAnalyzer();

  // Main URL analysis endpoint
  app.post('/api/url/analyze', async (req, res) => {
    try {
      console.log('🔍 Starting URL analysis...');
      
      const { url, options = {} } = req.body;
      
      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'URL is required',
          message: 'Please provide a URL to analyze'
        });
      }

      // Validate and analyze URL
      const analysis = await urlAnalyzer.analyzeURL(url, options);
      
      res.json({
        success: true,
        analysis: analysis,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ URL analysis failed:', error);
      res.status(500).json({
        success: false,
        error: 'URL analysis failed',
        message: error.message
      });
    }
  });

  // Quick URL validation endpoint
  app.post('/api/url/validate', (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'URL is required'
        });
      }

      // Basic URL validation
      try {
        const validatedURL = urlAnalyzer.validateURL(url);
        res.json({
          success: true,
          valid: true,
          url: validatedURL,
          message: 'URL is valid and ready for analysis'
        });
      } catch (validationError) {
        res.json({
          success: true,
          valid: false,
          error: validationError.message,
          message: 'URL format is invalid'
        });
      }
      
    } catch (error) {
      console.error('❌ URL validation failed:', error);
      res.status(500).json({
        success: false,
        error: 'URL validation failed',
        message: error.message
      });
    }
  });

  // Get analysis history
  app.get('/api/url/history', (req, res) => {
    try {
      const history = urlAnalyzer.getAnalysisHistory();
      
      res.json({
        success: true,
        history: history,
        total: history.length,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Failed to get analysis history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get analysis history',
        message: error.message
      });
    }
  });

  // Get specific analysis by ID
  app.get('/api/url/analysis/:id', (req, res) => {
    try {
      const { id } = req.params;
      const analysis = urlAnalyzer.getAnalysisById(id);
      
      if (!analysis) {
        return res.status(404).json({
          success: false,
          error: 'Analysis not found',
          message: `No analysis found with ID: ${id}`
        });
      }
      
      res.json({
        success: true,
        analysis: analysis,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Failed to get analysis:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get analysis',
        message: error.message
      });
    }
  });

  // Clear analysis history
  app.delete('/api/url/history', (req, res) => {
    try {
      urlAnalyzer.clearHistory();
      
      res.json({
        success: true,
        message: 'Analysis history cleared successfully',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Failed to clear history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear history',
        message: error.message
      });
    }
  });

  // Get available analysis types
  app.get('/api/url/analysis-types', (req, res) => {
    try {
      const analysisTypes = [
        {
          id: 'structure',
          name: 'Structure Analysis',
          description: 'Analyze HTML structure, meta tags, headings, images, and forms',
          icon: 'sitemap',
          enabled: true
        },
        {
          id: 'performance',
          name: 'Performance Analysis',
          description: 'Measure page load time, size, and performance metrics',
          icon: 'tachometer-alt',
          enabled: true
        },
        {
          id: 'seo',
          name: 'SEO Analysis',
          description: 'Check SEO factors like title, description, headings, and images',
          icon: 'search',
          enabled: true
        },
        {
          id: 'security',
          name: 'Security Analysis',
          description: 'Analyze security headers, HTTPS, forms, and scripts',
          icon: 'shield-alt',
          enabled: true
        },
        {
          id: 'accessibility',
          name: 'Accessibility Analysis',
          description: 'Check accessibility features like alt text, headings, and language',
          icon: 'universal-access',
          enabled: true
        },
        {
          id: 'content',
          name: 'Content Analysis',
          description: 'Analyze content quality, readability, and structure',
          icon: 'file-alt',
          enabled: true
        },
        {
          id: 'technology',
          name: 'Technology Detection',
          description: 'Detect frameworks, CMS, analytics, and server technologies',
          icon: 'code',
          enabled: true
        },
        {
          id: 'links',
          name: 'Links Analysis',
          description: 'Analyze internal/external links, categories, and protocols',
          icon: 'link',
          enabled: true
        }
      ];
      
      res.json({
        success: true,
        types: analysisTypes,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Failed to get analysis types:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get analysis types',
        message: error.message
      });
    }
  });

  // Batch URL analysis endpoint
  app.post('/api/url/batch-analyze', async (req, res) => {
    try {
      console.log('🔍 Starting batch URL analysis...');
      
      const { urls, options = {} } = req.body;
      
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'URLs array is required',
          message: 'Please provide an array of URLs to analyze'
        });
      }

      if (urls.length > 10) {
        return res.status(400).json({
          success: false,
          error: 'Too many URLs',
          message: 'Maximum 10 URLs can be analyzed in a single batch'
        });
      }

      const results = [];
      const errors = [];

      // Analyze each URL
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        
        try {
          console.log(`Analyzing URL ${i + 1}/${urls.length}: ${url}`);
          const analysis = await urlAnalyzer.analyzeURL(url, options);
          results.push(analysis);
        } catch (error) {
          console.error(`Failed to analyze ${url}:`, error);
          errors.push({
            url: url,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        results: results,
        errors: errors,
        summary: {
          total: urls.length,
          successful: results.length,
          failed: errors.length,
          averageScore: results.length > 0 ? 
            Math.round(results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length) : 0
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Batch URL analysis failed:', error);
      res.status(500).json({
        success: false,
        error: 'Batch URL analysis failed',
        message: error.message
      });
    }
  });

  // URL preview endpoint (quick analysis without full processing)
  app.post('/api/url/preview', async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'URL is required'
        });
      }

      // Quick validation and basic info
      const validatedURL = urlAnalyzer.validateURL(url);
      
      // Get basic page info (title, description, etc.)
      const preview = await urlAnalyzer.analyzeURL(validatedURL, {
        includeStructure: true,
        includePerformance: false,
        includeSEO: true,
        includeSecurity: false,
        includeAccessibility: false,
        includeContent: false,
        includeTechnology: false,
        includeLinks: false,
        timeout: 10000
      });

      res.json({
        success: true,
        preview: {
          url: validatedURL,
          title: preview.results.structure?.details?.title || '',
          description: preview.results.structure?.details?.meta?.find(m => m.name === 'description')?.content || '',
          score: preview.score,
          timestamp: preview.timestamp
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ URL preview failed:', error);
      res.status(500).json({
        success: false,
        error: 'URL preview failed',
        message: error.message
      });
    }
  });

  // Export analysis results
  app.get('/api/url/export/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { format = 'json' } = req.query;
      
      const analysis = urlAnalyzer.getAnalysisById(id);
      
      if (!analysis) {
        return res.status(404).json({
          success: false,
          error: 'Analysis not found'
        });
      }

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="url-analysis-${id}.json"`);
        res.send(JSON.stringify(analysis, null, 2));
      } else if (format === 'csv') {
        // Generate CSV format
        const csv = generateCSVReport(analysis);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="url-analysis-${id}.csv"`);
        res.send(csv);
      } else {
        res.status(400).json({
          success: false,
          error: 'Unsupported format',
          message: 'Supported formats: json, csv'
        });
      }
      
    } catch (error) {
      console.error('❌ Export failed:', error);
      res.status(500).json({
        success: false,
        error: 'Export failed',
        message: error.message
      });
    }
  });

  // Helper function to generate CSV report
  function generateCSVReport(analysis) {
    const headers = ['URL', 'Score', 'Load Time', 'Size', 'Title', 'Description', 'HTTPS', 'Timestamp'];
    const rows = [headers.join(',')];

    const row = [
      analysis.url,
      analysis.score || 0,
      analysis.results.performance?.loadTime || 0,
      analysis.results.performance?.size || 0,
      analysis.results.structure?.details?.title || '',
      analysis.results.structure?.details?.meta?.find(m => m.name === 'description')?.content || '',
      analysis.results.security?.https || false,
      analysis.timestamp
    ];

    rows.push(row.join(','));
    return rows.join('\n');
  }

  // Health check endpoint
  app.get('/api/url/health', (req, res) => {
    res.json({
      success: true,
      status: 'healthy',
      service: 'URL Analyzer API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      features: [
        'URL validation',
        'Comprehensive analysis',
        'Batch processing',
        'History management',
        'Export functionality',
        'Preview mode'
      ]
    });
  });

  console.log('✅ URL Analyzer APIs initialized');
}

module.exports = setupURLAnalyzerAPIs;
