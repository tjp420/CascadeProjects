/**
 * Roadmap API Controller
 * 
 * Handles roadmap data requests with automatic status protection
 * Integrates StatusProtectionSystem to correct outdated data
 */

const path = require('path');
const fs = require('fs').promises;

class RoadmapController {
  constructor() {
    this.centralDataPath = path.join(__dirname, '../../../data-central/roadmap/roadmap-data.json');
    this.statusProtectionEnabled = true;
  }

  /**
   * Get current roadmap data with status protection
   */
  async getRoadmapData(req, res) {
    try {
      // Load central data (protected accurate data)
      const centralData = await this.loadCentralData();
      
      // Apply status protection if enabled
      let responseData = centralData;
      if (this.statusProtectionEnabled) {
        const StatusProtectionSystem = require('../../../src/core/StatusProtectionSystem');
        const protectionSystem = new StatusProtectionSystem();
        responseData = await protectionSystem.validateAndCorrectData(centralData);
      }

      res.json({
        success: true,
        data: responseData,
        timestamp: new Date().toISOString(),
        source: 'central-data-truth-system',
        statusProtection: this.statusProtectionEnabled
      });

    } catch (error) {
      console.error('Roadmap Controller Error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve roadmap data',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Update roadmap data with status protection
   */
  async updateRoadmapData(req, res) {
    try {
      const incomingData = req.body;

      // Apply status protection
      let correctedData = incomingData;
      if (this.statusProtectionEnabled) {
        const StatusProtectionSystem = require('../../../src/core/StatusProtectionSystem');
        const protectionSystem = new StatusProtectionSystem();
        correctedData = await protectionSystem.validateAndCorrectData(incomingData);
      }

      // Update central data with corrected data
      await this.updateCentralData(correctedData);

      res.json({
        success: true,
        data: correctedData,
        timestamp: new Date().toISOString(),
        statusProtection: this.statusProtectionEnabled,
        correctionsApplied: JSON.stringify(incomingData) !== JSON.stringify(correctedData)
      });

    } catch (error) {
      console.error('Roadmap Update Error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to update roadmap data',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Generate roadmap report with status protection
   */
  async generateRoadmapReport(req, res) {
    try {
      // Generate report data
      const reportData = await this.generateReportData();

      // Apply status protection
      let correctedReport = reportData;
      if (this.statusProtectionEnabled) {
        const StatusProtectionSystem = require('../../../src/core/StatusProtectionSystem');
        const protectionSystem = new StatusProtectionSystem();
        correctedReport = await protectionSystem.validateAndCorrectData(reportData);
      }

      res.json({
        success: true,
        report: correctedReport,
        timestamp: new Date().toISOString(),
        statusProtection: this.statusProtectionEnabled
      });

    } catch (error) {
      console.error('Report Generation Error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to generate roadmap report',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get status protection information
   */
  async getStatusProtectionInfo(req, res) {
    try {
      const StatusProtectionSystem = require('../../../src/core/StatusProtectionSystem');
      const protectionSystem = new StatusProtectionSystem();
      const report = await protectionSystem.generateProtectionReport();

      res.json({
        success: true,
        statusProtection: {
          enabled: this.statusProtectionEnabled,
          report: report,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Status Protection Info Error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve status protection information',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Load central data
   */
  async loadCentralData() {
    try {
      const data = await fs.readFile(this.centralDataPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load central data:', error.message);
      throw new Error('Central data not available');
    }
  }

  /**
   * Update central data
   */
  async updateCentralData(data) {
    try {
      // Ensure status lock is present
      if (!data.statusLock) {
        data.statusLock = {
          enabled: true,
          reason: "Phase 3 completion verified and locked against outdated data overrides",
          lockedMetrics: ["completedFeatures", "inProgressFeatures", "completionRate", "phaseStatus"],
          lastVerification: new Date().toISOString()
        };
      }

      await fs.writeFile(this.centralDataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to update central data:', error.message);
      throw new Error('Failed to update central data');
    }
  }

  /**
   * Generate report data
   */
  async generateReportData() {
    const centralData = await this.loadCentralData();
    
    // Generate fresh report based on central data
    return {
      timestamp: new Date().toISOString(),
      type: "development-roadmap-report",
      title: "Development Roadmap Report",
      summary: centralData.summary,
      timeline: centralData.timeline,
      backlog: centralData.backlog || {
        highPriority: [],
        mediumPriority: [],
        lowPriority: []
      },
      releases: centralData.releases || [],
      metrics: centralData.metrics || {
        totalBacklogItems: 0,
        totalReleases: 0,
        completedPhases: 3,
        activePhases: 1,
        upcomingPhases: 1
      },
      recommendations: [
        {
          priority: "high",
          action: "Begin Phase 4: Enhancement",
          description: "Phase 3 is complete. Start Phase 4 database migration and security hardening"
        },
        {
          priority: "medium",
          action: "Use accurate analysis tools",
          description: "Run node development-roadmap/run-analysis-fixed.js for accurate project status"
        }
      ]
    };
  }
}

module.exports = RoadmapController;
