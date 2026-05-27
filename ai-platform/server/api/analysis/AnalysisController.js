/**
 * Analysis API Controller
 * 
 * Comprehensive API controller for mock data analysis functionality
 * with job management, result retrieval, and statistics
 */

const AnalysisEngine = require('../../../src/analysis/AnalysisEngine');
const PatternDetector = require('../../../src/analysis/PatternDetector');
const IssueDetector = require('../../../src/analysis/IssueDetector');
const QualityAnalyzer = require('../../../src/analysis/QualityAnalyzer');

class AnalysisController {
  constructor() {
    this.analysisEngine = null;
    this.patternDetector = null;
    this.issueDetector = null;
    this.qualityAnalyzer = null;
    this.isInitialized = false;
    
    this.initialize();
  }

  // Initialize controller
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize analysis components
      this.analysisEngine = new AnalysisEngine();
      this.patternDetector = new PatternDetector();
      this.issueDetector = new IssueDetector();
      this.qualityAnalyzer = new QualityAnalyzer();
      
      // Initialize all components
      await Promise.all([
        this.analysisEngine.initialize(),
        this.patternDetector.initialize(),
        this.issueDetector.initialize(),
        this.qualityAnalyzer.initialize()
      ]);
      
      this.isInitialized = true;

    } catch (error) {
      console.error('[ANALYSIS_CONTROLLER] Failed to initialize controller:', error.message);
      throw error;
    }
  }

  // Create analysis job
  async createAnalysisJob(req, res) {
    try {
      const { data, analyzer, options = {} } = req.body;
      
      // Validate request
      if (!data) {
        return res.status(400).json({
          success: false,
          error: 'Data is required',
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      // Create analysis job
      const job = this.analysisEngine.createJob({
        type: 'data_analysis',
        source: req.user?.id || 'anonymous',
        analyzer: analyzer || 'pattern_detector',
        data,
        config: options
      });

      res.status(201).json({
        success: true,
        data: {
          jobId: job.id,
          status: job.status,
          analyzer: job.analyzer,
          createdAt: job.createdAt
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id,
          processingTime: 0
        }
      });
      
    } catch (error) {
      console.error('[ANALYSIS_CONTROLLER] Error creating analysis job:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Failed to create analysis job',
        details: error.message,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
  }

  // Get analysis job status
  async getAnalysisJob(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Job ID is required',
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      const jobStatus = this.analysisEngine.getJobStatus(id);
      
      if (!jobStatus) {
        return res.status(404).json({
          success: false,
          error: 'Analysis job not found',
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      res.json({
        success: true,
        data: jobStatus,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id,
          processingTime: 0
        }
      });
      
    } catch (error) {
      console.error('[ANALYSIS_CONTROLLER] Error getting analysis job:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Failed to get analysis job',
        details: error.message,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
  }

  // Get analysis results
  async getAnalysisResults(req, res) {
    try {
      const { id } = req.params;
      const { format = 'json' } = req.query;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Job ID is required',
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      const jobStatus = this.analysisEngine.getJobStatus(id);
      
      if (!jobStatus) {
        return res.status(404).json({
          success: false,
          error: 'Analysis job not found',
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      if (jobStatus.status !== 'completed') {
        return res.status(400).json({
          success: false,
          error: 'Analysis job not completed',
          data: {
            status: jobStatus.status,
            progress: jobStatus.progress
          },
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      // Get results from job
      const results = jobStatus.results;
      
      // Format results based on requested format
      let formattedResults = results;
      if (format === 'summary') {
        formattedResults = this.formatResultsSummary(results);
      }
      
      res.json({
        success: true,
        data: formattedResults,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id,
          processingTime: jobStatus.processingTime,
          format
        }
      });
      
    } catch (error) {
      console.error('[ANALYSIS_CONTROLLER] Error getting analysis results:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Failed to get analysis results',
        details: error.message,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
  }

  // Get analysis patterns
  async getAnalysisPatterns(req, res) {
    try {
      const { id } = req.params;
      const { confidence = 0.7, category } = req.query;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Job ID is required',
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      const jobStatus = this.analysisEngine.getJobStatus(id);
      
      if (!jobStatus) {
        return res.status(404).json({
          success: false,
          error: 'Analysis job not found',
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      if (jobStatus.status !== 'completed') {
        return res.status(400).json({
          success: false,
          error: 'Analysis job not completed',
          data: {
            status: jobStatus.status,
            progress: jobStatus.progress
          },
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      // Extract patterns from results
      const patterns = jobStatus.results.pattern_detector?.patterns || [];
      
      // Filter patterns
      let filteredPatterns = patterns;
      
      if (confidence) {
        filteredPatterns = filteredPatterns.filter(pattern => 
          pattern.confidence >= parseFloat(confidence)
        );
      }
      
      if (category) {
        filteredPatterns = filteredPatterns.filter(pattern => 
          pattern.category === category
        );
      }
      
      res.json({
        success: true,
        data: {
          patterns: filteredPatterns,
          totalPatterns: patterns.length,
          filteredPatterns: filteredPatterns.length,
          confidenceThreshold: parseFloat(confidence),
          category
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id,
          processingTime: jobStatus.processingTime
        }
      });
      
    } catch (error) {
      console.error('[ANALYSIS_CONTROLLER] Error getting analysis patterns:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Failed to get analysis patterns',
        details: error.message,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
  }

  // Get analysis issues
  async getAnalysisIssues(req, res) {
    try {
      const { id } = req.params;
      const { severity, category, resolved = 'false' } = req.query;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Job ID is required',
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      const jobStatus = this.analysisEngine.getJobStatus(id);
      
      if (!jobStatus) {
        return res.status(404).json({
          success: false,
          error: 'Analysis job not found',
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      if (jobStatus.status !== 'completed') {
        return res.status(400).json({
          success: false,
          error: 'Analysis job not completed',
          data: {
            status: jobStatus.status,
            progress: jobStatus.progress
          },
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      // Extract issues from results
      const issues = jobStatus.results.issue_detector?.issues || [];
      
      // Filter issues
      let filteredIssues = issues;
      
      if (severity) {
        filteredIssues = filteredIssues.filter(issue => 
          issue.severity === severity
        );
      }
      
      if (category) {
        filteredIssues = filteredIssues.filter(issue => 
          issue.category === category
        );
      }
      
      if (resolved === 'false') {
        filteredIssues = filteredIssues.filter(issue => 
          !issue.resolved
        );
      }
      
      res.json({
        success: true,
        data: {
          issues: filteredIssues,
          totalIssues: issues.length,
          filteredIssues: filteredIssues.length,
          severity,
          category,
          resolved: resolved === 'true'
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id,
          processingTime: jobStatus.processingTime
        }
      });
      
    } catch (error) {
      console.error('[ANALYSIS_CONTROLLER] Error getting analysis issues:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Failed to get analysis issues',
        details: error.message,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
  }

  // Get analysis quality
  async getAnalysisQuality(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Job ID is required',
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      const jobStatus = this.analysisEngine.getJobStatus(id);
      
      if (!jobStatus) {
        return res.status(404).json({
          success: false,
          error: 'Analysis job not found',
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      if (jobStatus.status !== 'completed') {
        return res.status(400).json({
          success: false,
          error: 'Analysis job not completed',
          data: {
            status: jobStatus.status,
            progress: jobStatus.progress
          },
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      // Extract quality from results
      const quality = jobStatus.results.quality_analyzer || {};
      
      res.json({
        success: true,
        data: quality,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id,
          processingTime: jobStatus.processingTime
        }
      });
      
    } catch (error) {
      console.error('[ANALYSIS_CONTROLLER] Error getting analysis quality:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Failed to get analysis quality',
        details: error.message,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
  }

  // Cancel analysis job
  async cancelAnalysisJob(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Job ID is required',
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      const cancelled = this.analysisEngine.cancelJob(id);
      
      if (!cancelled) {
        return res.status(404).json({
          success: false,
          error: 'Analysis job not found or cannot be cancelled',
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      res.json({
        success: true,
        data: {
          jobId: id,
          cancelled: true,
          cancelledAt: new Date().toISOString()
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
      
    } catch (error) {
      console.error('[ANALYSIS_CONTROLLER] Error cancelling analysis job:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Failed to cancel analysis job',
        details: error.message,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
  }

  // List analysis jobs
  async listAnalysisJobs(req, res) {
    try {
      const { status, limit = 50, offset = 0 } = req.query;
      
      let jobs = this.analysisEngine.getJobs();
      
      // Filter by status
      if (status) {
        jobs = jobs.filter(job => job.status === status);
      }
      
      // Sort by creation date (newest first)
      jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // Apply pagination
      const paginatedJobs = jobs.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
      
      res.json({
        success: true,
        data: {
          jobs: paginatedJobs,
          total: jobs.length,
          limit: parseInt(limit),
          offset: parseInt(offset),
          status
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
      
    } catch (error) {
      console.error('[ANALYSIS_CONTROLLER] Error listing analysis jobs:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Failed to list analysis jobs',
        details: error.message,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
  }

  // Batch analysis
  async batchAnalysis(req, res) {
    try {
      const { data, analyzer, options = {} } = req.body;
      
      if (!Array.isArray(data) || data.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Data array is required',
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      const jobs = [];
      const batchSize = options.batchSize || 10;
      
      // Create batch jobs
      for (let i = 0; i < data.length; i += batchSize) {
        const batchData = data.slice(i, i + batchSize);
        
        const job = this.analysisEngine.createJob({
          type: 'batch_analysis',
          source: req.user?.id || 'anonymous',
          analyzer: analyzer || 'pattern_detector',
          data: batchData,
          config: { ...options, batchIndex: Math.floor(i / batchSize) }
        });
        
        jobs.push(job);
      }

      res.status(201).json({
        success: true,
        data: {
          jobs: jobs.map(job => ({
            jobId: job.id,
            status: job.status,
            analyzer: job.analyzer,
            batchSize: job.data.length,
            createdAt: job.createdAt
          })),
          totalJobs: jobs.length,
          totalDataItems: data.length
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
      
    } catch (error) {
      console.error('[ANALYSIS_CONTROLLER] Error creating batch analysis:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Failed to create batch analysis',
        details: error.message,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
  }

  // Get analysis statistics
  async getAnalysisStatistics(req, res) {
    try {
      const { period = '24h' } = req.query;
      
      // Get engine statistics
      const engineStats = this.analysisEngine.getStats();
      const patternStats = this.patternDetector.getStats();
      const issueStats = this.issueDetector.getStats();
      const qualityStats = this.qualityAnalyzer.getStats();
      
      // Calculate period-specific statistics
      const periodStats = this.calculatePeriodStats(period);
      
      res.json({
        success: true,
        data: {
          engine: engineStats,
          patterns: patternStats,
          issues: issueStats,
          quality: qualityStats,
          period: periodStats
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id,
          period
        }
      });
      
    } catch (error) {
      console.error('[ANALYSIS_CONTROLLER] Error getting analysis statistics:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Failed to get analysis statistics',
        details: error.message,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
  }

  // Helper methods
  formatResultsSummary(results) {
    const summary = {
      totalSteps: Object.keys(results).length,
      completedSteps: Object.values(results).filter(result => result.success).length,
      failedSteps: Object.values(results).filter(result => !result.success).length,
      totalProcessingTime: Object.values(results).reduce((sum, result) => sum + (result.processingTime || 0), 0),
      steps: {}
    };
    
    Object.entries(results).forEach(([step, result]) => {
      summary.steps[step] = {
        success: result.success,
        processingTime: result.processingTime || 0,
        error: result.error || null
      };
    });
    
    return summary;
  }

  calculatePeriodStats(period) {
    // This would calculate statistics for the specified period
    // For now, return placeholder data
    const periodMs = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    
    const ms = periodMs[period] || periodMs['24h'];
    const cutoff = new Date(Date.now() - ms);
    
    // Get jobs within period
    const allJobs = this.analysisEngine.getJobs();
    const periodJobs = allJobs.filter(job => new Date(job.createdAt) >= cutoff);
    
    return {
      period,
      totalJobs: periodJobs.length,
      completedJobs: periodJobs.filter(job => job.status === 'completed').length,
      failedJobs: periodJobs.filter(job => job.status === 'failed').length,
      averageProcessingTime: periodJobs.reduce((sum, job) => sum + job.processingTime, 0) / periodJobs.length,
      successRate: periodJobs.length > 0 ? (periodJobs.filter(job => job.status === 'completed').length / periodJobs.length) * 100 : 0
    };
  }

  // Health check
  async healthCheck(req, res) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          analysisEngine: this.analysisEngine?.isInitialized || false,
          patternDetector: this.patternDetector?.isInitialized || false,
          issueDetector: this.issueDetector?.isInitialized || false,
          qualityAnalyzer: this.qualityAnalyzer?.isInitialized || false
        },
        stats: {
          activeJobs: this.analysisEngine?.getActiveJobs()?.length || 0,
          completedJobs: this.analysisEngine?.getCompletedJobs()?.length || 0
        }
      };
      
      // Check if all services are healthy
      const allHealthy = Object.values(health.services).every(status => status === true);
      
      if (!allHealthy) {
        health.status = 'unhealthy';
        return res.status(503).json(health);
      }
      
      res.json(health);
      
    } catch (error) {
      console.error('[ANALYSIS_CONTROLLER] Health check failed:', error.message);
      
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  }

  // Destroy controller
  destroy() {
    if (this.analysisEngine) {
      this.analysisEngine.destroy();
    }
    
    if (this.patternDetector) {
      this.patternDetector.destroy();
    }
    
    if (this.issueDetector) {
      this.issueDetector.destroy();
    }
    
    if (this.qualityAnalyzer) {
      this.qualityAnalyzer.destroy();
    }
    
    this.isInitialized = false;
  }
}

module.exports = AnalysisController;
