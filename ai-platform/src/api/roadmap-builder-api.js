/**
 * Roadmap Builder API
 * Provides endpoints for creating and managing roadmaps from various data sources
 */

const RoadmapBuilder = require('../core/RoadmapBuilder');

function setupRoadmapBuilderAPIs(app) {
  // Initialize roadmap builder
  const roadmapBuilder = new RoadmapBuilder();

  // Create roadmap from data sources
  app.post('/api/roadmap/create', async (req, res) => {
    try {
      console.log('🗺️ Creating roadmap from data sources...');
      
      const {
        template = 'standard',
        dataSources = ['url-analysis', 'gguf-roadmap'],
        title = 'Generated Roadmap',
        description = 'Roadmap generated from system data analysis',
        duration = null,
        customPhases = null
      } = req.body;
      
      if (!template) {
        return res.status(400).json({
          success: false,
          error: 'Template is required',
          message: 'Please specify a roadmap template'
        });
      }
      
      const roadmap = await roadmapBuilder.createRoadmap({
        template,
        dataSources,
        title,
        description,
        duration,
        customPhases
      });
      
      res.json({
        success: true,
        roadmap: roadmap,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Failed to create roadmap:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create roadmap',
        message: error.message
      });
    }
  });

  // Create custom roadmap
  app.post('/api/roadmap/create-custom', async (req, res) => {
    try {
      console.log('🗺️ Creating custom roadmap...');
      
      const {
        phases,
        title,
        description,
        duration,
        timeUnit,
        customData
      } = req.body;
      
      if (!phases || !Array.isArray(phases)) {
        return res.status(400).json({
          success: false,
          error: 'Phases array is required',
          message: 'Please provide an array of phases'
        });
      }
      
      if (!title) {
        return res.status(400).json({
          success: false,
          error: 'Title is required',
          message: 'Please provide a roadmap title'
        });
      }
      
      const roadmap = roadmapBuilder.createCustomRoadmap({
        phases,
        title,
        description,
        duration,
        timeUnit,
        customData
      });
      
      res.json({
        success: true,
        roadmap: roadmap,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Failed to create custom roadmap:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create custom roadmap',
        message: error.message
      });
    }
  });

  // Get available templates
  app.get('/api/roadmap/templates', (req, res) => {
    try {
      const templates = roadmapBuilder.getAvailableTemplates();
      
      res.json({
        success: true,
        templates: templates,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Failed to get templates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get templates',
        message: error.message
      });
    }
  });

  // Get available data sources
  app.get('/api/roadmap/data-sources', (req, res) => {
    try {
      const dataSources = roadmapBuilder.getAvailableDataSources();
      
      res.json({
        success: true,
        dataSources: dataSources,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Failed to get data sources:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get data sources',
        message: error.message
      });
    }
  });

  // Get roadmap history
  app.get('/api/roadmap/history', (req, res) => {
    try {
      const history = roadmapBuilder.getRoadmapHistory();
      
      res.json({
        success: true,
        history: history,
        total: history.length,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Failed to get roadmap history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get roadmap history',
        message: error.message
      });
    }
  });

  // Get specific roadmap
  app.get('/api/roadmap/:id', (req, res) => {
    try {
      const { id } = req.params;
      const roadmap = roadmapBuilder.getRoadmapById(id);
      
      if (!roadmap) {
        return res.status(404).json({
          success: false,
          error: 'Roadmap not found',
          message: `No roadmap found with ID: ${id}`
        });
      }
      
      res.json({
        success: true,
        roadmap: roadmap,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Failed to get roadmap:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get roadmap',
        message: error.message
      });
    }
  });

  // Export roadmap
  app.get('/api/roadmap/export/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { format = 'json' } = req.query;
      
      const roadmap = roadmapBuilder.getRoadmapById(id);
      
      if (!roadmap) {
        return res.status(404).json({
          success: false,
          error: 'Roadmap not found',
          message: `No roadmap found with ID: ${id}`
        });
      }
      
      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="roadmap-${id}.json"`);
        const exportData = roadmapBuilder.exportRoadmap(id);
        res.send(exportData);
      } else if (format === 'pdf') {
        // PDF export would require additional library like puppeteer or jsPDF
        res.status(400).json({
          success: false,
          error: 'PDF export not yet implemented',
          message: 'Use JSON format for now'
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Unsupported format',
          message: 'Supported formats: json, pdf'
        });
      }
      
    } catch (error) {
      console.error('❌ Failed to export roadmap:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export roadmap',
        message: error.message
      });
    }
  });

  // Clear roadmap history
  app.delete('/api/roadmap/history', (req, res) => {
    try {
      roadmapBuilder.clearHistory();
      
      res.json({
        success: true,
        message: 'Roadmap history cleared successfully',
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

  // Validate roadmap configuration
  app.post('/api/roadmap/validate', (req, res) => {
    try {
      const { config } = req.body;
      
      const validation = {
        isValid: true,
        errors: [],
        warnings: []
      };
      
      // Validate template
      if (!config.template) {
        validation.isValid = false;
        validation.errors.push('Template is required');
      } else {
        const availableTemplates = roadmapBuilder.getAvailableTemplates();
        if (!availableTemplates.find(t => t.id === config.template)) {
          validation.isValid = false;
          validation.errors.push(`Template "${config.template}" is not available`);
        }
      }
      
      // Validate data sources
      if (config.dataSource && config.dataSource.length > 0) {
        const availableSources = roadmapBuilder.getAvailableDataSources();
        config.dataSource.forEach(source => {
          if (!availableSources.find(s => s.id === source)) {
            validation.warnings.push(`Data source "${source}" may not be available`);
          }
        });
      }
      
      // Validate phases for custom roadmap
      if (config.phases && config.phases.length > 0) {
        config.phases.forEach((phase, index) => {
          if (!phase.name || phase.name.trim() === '') {
            validation.isValid = false;
            validation.errors.push(`Phase ${index + 1} is missing name`);
          }
          
          if (!phase.duration || phase.duration <= 0) {
            validation.warnings.push(`Phase "${phase.name}" has invalid duration`);
          }
        });
      }
      
      res.json({
        success: true,
        validation: validation,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Failed to validate roadmap:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate roadmap',
        message: error.message
      });
    }
  });

  // Get current roadmap
  app.get('/api/roadmap/current', (req, res) => {
    try {
      const roadmap = roadmapBuilder.getCurrentRoadmap();
      
      if (!roadmap) {
        return res.status(404).json({
          success: false,
          error: 'No current roadmap found',
          message: 'No roadmap has been created yet'
        });
      }
      
      res.json({
        success: true,
        roadmap: roadmap,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Failed to get current roadmap:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get current roadmap',
        message: error.message
      });
    }
  });

  // Health check
  app.get('/api/roadmap/health', (req, res) => {
    res.json({
      success: true,
      status: 'healthy',
      service: 'Roadmap Builder API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      features: [
        'Template-based roadmap creation',
        'Multi-source data integration',
        'Custom roadmap creation',
        'Export functionality',
        'History management',
        'Validation system',
        'Budget estimation',
        'Risk assessment'
      ]
    });
  });

  console.log('✅ Roadmap Builder APIs initialized');
}

module.exports = setupRoadmapBuilderAPIs;
