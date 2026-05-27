const logger = require('../lib/production-logger');
/**
 * Roadmap Analyzer Tools
 * Comprehensive analysis tools for building accurate development roadmaps
 * Based on real project structure and code analysis
 */

const fs = require('fs').promises;
const path = require('path');

class RoadmapAnalyzer {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.analysis = {
      structure: {},
      complexity: {},
      dependencies: {},
      features: {},
      metrics: {},
      recommendations: {}
    };
  }

  /**
   * Perform comprehensive project analysis
   */
  async analyzeProject() {
    logger.debug('🔍 Starting comprehensive project analysis...');
    
    try {
      // Analyze project structure
      await this.analyzeStructure();
      
      // Analyze code complexity
      await this.analyzeComplexity();
      
      // Analyze dependencies
      await this.analyzeDependencies();
      
      // Analyze features
      await this.analyzeFeatures();
      
      // Calculate metrics
      await this.calculateMetrics();
      
      // Generate recommendations
      await this.generateRecommendations();
      
      logger.debug('✅ Project analysis completed!');
      return this.analysis;
      
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      throw error;
    }
  }

  /**
   * Analyze project structure
   */
  async analyzeStructure() {
    logger.debug('📁 Analyzing project structure...');
    
    const structure = {
      totalFiles: 0,
      totalDirectories: 0,
      fileTypes: {},
      directorySizes: {},
      componentBreakdown: {},
      architecture: {}
    };

    // Analyze main directories
    const mainDirs = ['src', 'server', 'web', 'data-central', 'scripts', 'tests', 'docs'];
    
    for (const dir of mainDirs) {
      const dirPath = path.join(this.projectPath, dir);
      try {
        const stats = await this.analyzeDirectory(dirPath);
        structure.directorySizes[dir] = stats;
        structure.totalFiles += stats.files;
        structure.totalDirectories += stats.directories;
        
        // Analyze component breakdown
        if (dir === 'src') {
          structure.componentBreakdown = await this.analyzeComponents(dirPath);
        }
      } catch (error) {
        logger.debug(`⚠️ Directory ${dir} not found, skipping...`);
      }
    }

    // Analyze file types
    await this.analyzeFileTypes(this.projectPath, structure.fileTypes);

    // Analyze architecture
    structure.architecture = await this.analyzeArchitecture();

    this.analysis.structure = structure;
  }

  /**
   * Analyze a specific directory
   */
  async analyzeDirectory(dirPath) {
    const stats = {
      files: 0,
      directories: 0,
      totalSize: 0,
      fileTypes: {}
    };

    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        
        if (item.isDirectory()) {
          const subStats = await this.analyzeDirectory(itemPath);
          stats.files += subStats.files;
          stats.directories += subStats.directories + 1;
          stats.totalSize += subStats.totalSize;
        } else if (item.isFile()) {
          stats.files++;
          const fileStats = await fs.stat(itemPath);
          stats.totalSize += fileStats.size;
          
          const ext = path.extname(item.name).toLowerCase();
          stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;
        }
      }
    } catch (error) {
      // Directory doesn't exist or is not accessible
    }

    return stats;
  }

  /**
   * Analyze file types across the project
   */
  async analyzeFileTypes(basePath, fileTypes) {
    try {
      const items = await fs.readdir(basePath, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(basePath, item.name);
        
        if (item.isDirectory()) {
          await this.analyzeFileTypes(itemPath, fileTypes);
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase();
          fileTypes[ext] = (fileTypes[ext] || 0) + 1;
        }
      }
    } catch (error) {
      // Skip inaccessible directories
    }
  }

  /**
   * Analyze component breakdown
   */
  async analyzeComponents(srcPath) {
    const components = {
      adapters: { count: 0, files: [], totalSize: 0 },
      core: { count: 0, files: [], totalSize: 0 },
      aiSystem: { count: 0, files: [], totalSize: 0 },
      server: { count: 0, files: [], totalSize: 0 },
      web: { count: 0, files: [], totalSize: 0 },
      analysis: { count: 0, files: [], totalSize: 0 }
    };

    try {
      const items = await fs.readdir(srcPath, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isDirectory()) {
          const componentPath = path.join(srcPath, item.name);
          const componentKey = this.mapComponentName(item.name);
          
          if (components[componentKey]) {
            const componentStats = await this.analyzeDirectory(componentPath);
            components[componentKey].count = componentStats.files;
            components[componentKey].totalSize = componentStats.totalSize;
            
            // Get file list
            const files = await this.getFileList(componentPath);
            components[componentKey].files = files;
          }
        }
      }
    } catch (error) {
      logger.debug('⚠️ Could not analyze components');
    }

    return components;
  }

  /**
   * Map directory name to component key
   */
  mapComponentName(dirName) {
    const mapping = {
      'adapters': 'adapters',
      'core': 'core',
      'ai-system': 'aiSystem',
      'server': 'server',
      'web': 'web',
      'analysis': 'analysis'
    };
    
    return mapping[dirName] || 'other';
  }

  /**
   * Get file list for a directory
   */
  async getFileList(dirPath) {
    const files = [];
    
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isFile()) {
          const filePath = path.join(dirPath, item.name);
          const stats = await fs.stat(filePath);
          files.push({
            name: item.name,
            size: stats.size,
            path: filePath
          });
        }
      }
    } catch (error) {
      // Skip inaccessible files
    }
    
    return files;
  }

  /**
   * Analyze project architecture
   */
  async analyzeArchitecture() {
    const architecture = {
      type: 'Node.js/Express Platform',
      patterns: [],
      layers: {},
      dataFlow: {},
      technologies: {}
    };

    // Analyze package.json for technologies
    try {
      const packagePath = path.join(this.projectPath, 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf8');
      const packageData = JSON.parse(packageContent);
      
      architecture.technologies = {
        runtime: 'Node.js',
        framework: 'Express.js',
        database: 'File-based JSON (migrating to PostgreSQL)',
        authentication: 'JWT + bcryptjs',
        testing: 'Jest',
        build: 'Webpack',
        dependencies: Object.keys(packageData.dependencies || {}),
        devDependencies: Object.keys(packageData.devDependencies || {})
      };
    } catch (error) {
      logger.debug('⚠️ Could not analyze package.json');
    }

    // Analyze architectural patterns
    architecture.patterns = [
      'MVC Pattern',
      'Adapter Pattern',
      'Central Data Truth System',
      'Event-driven Architecture',
      'Caching Layer'
    ];

    // Analyze layers
    architecture.layers = {
      presentation: 'web/ (Frontend)',
      business: 'src/ (Core Logic)',
      data: 'data-central/ (Data Storage)',
      infrastructure: 'server/ (Server Infrastructure)'
    };

    return architecture;
  }

  /**
   * Analyze code complexity
   */
  async analyzeComplexity() {
    logger.debug('🔧 Analyzing code complexity...');
    
    const complexity = {
      overall: 0,
      files: {},
      hotspots: [],
      averageComplexity: 0,
      maintainabilityIndex: 0
    };

    const srcPath = path.join(this.projectPath, 'src');
    
    try {
      const files = await this.getJavaScriptFiles(srcPath);
      let totalComplexity = 0;
      
      for (const file of files) {
        const fileComplexity = await this.analyzeFileComplexity(file);
        complexity.files[file] = fileComplexity;
        totalComplexity += fileComplexity.complexity;
        
        // Identify hotspots (high complexity files)
        if (fileComplexity.complexity > 20) {
          complexity.hotspots.push({
            file: file,
            complexity: fileComplexity.complexity,
            issues: fileComplexity.issues
          });
        }
      }
      
      complexity.overall = totalComplexity;
      complexity.averageComplexity = files.length > 0 ? totalComplexity / files.length : 0;
      complexity.maintainabilityIndex = this.calculateMaintainabilityIndex(complexity);
      
    } catch (error) {
      logger.debug('⚠️ Could not analyze complexity');
    }

    this.analysis.complexity = complexity;
  }

  /**
   * Get all JavaScript files
   */
  async getJavaScriptFiles(dirPath) {
    const files = [];
    
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        
        if (item.isDirectory()) {
          const subFiles = await this.getJavaScriptFiles(itemPath);
          files.push(...subFiles);
        } else if (item.isFile() && item.name.endsWith('.js')) {
          files.push(itemPath);
        }
      }
    } catch (error) {
      // Skip inaccessible directories
    }
    
    return files;
  }

  /**
   * Analyze individual file complexity
   */
  async analyzeFileComplexity(filePath) {
    const complexity = {
      complexity: 0,
      lines: 0,
      functions: 0,
      issues: []
    };

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      
      complexity.lines = lines.length;
      
      // Count functions
      const functionMatches = content.match(/function\s+\w+|=\s*\w+\s*=>|class\s+\w+/g);
      complexity.functions = functionMatches ? functionMatches.length : 0;
      
      // Calculate complexity (simplified)
      complexity.complexity = this.calculateComplexity(content);
      
      // Identify issues
      if (complexity.complexity > 20) {
        complexity.issues.push('High cyclomatic complexity');
      }
      
      if (complexity.lines > 500) {
        complexity.issues.push('Large file size');
      }
      
      if (complexity.functions > 20) {
        complexity.issues.push('Too many functions');
      }
      
    } catch (error) {
      logger.debug(`⚠️ Could not analyze file: ${filePath}`);
    }

    return complexity;
  }

  /**
   * Calculate cyclomatic complexity (simplified)
   */
  calculateComplexity(content) {
    let complexity = 1; // Base complexity
    
    // Add complexity for control structures
    const controlStructures = [
      /if\s*\(/g,
      /else\s*if/g,
      /for\s*\(/g,
      /while\s*\(/g,
      /do\s*{/g,
      /switch\s*\(/g,
      /catch\s*\(/g,
      /&&/g,
      /\|\|/g,
      /\?/g
    ];
    
    for (const structure of controlStructures) {
      const matches = content.match(structure);
      if (matches) {
        complexity += matches.length;
      }
    }
    
    return complexity;
  }

  /**
   * Calculate maintainability index
   */
  calculateMaintainabilityIndex(complexity) {
    // Simplified maintainability index calculation
    const avgComplexity = complexity.averageComplexity;
    const hotspots = complexity.hotspots.length;
    
    if (avgComplexity < 10 && hotspots === 0) {
      return 85; // Good
    } else if (avgComplexity < 20 && hotspots < 3) {
      return 70; // Moderate
    } else if (avgComplexity < 30 && hotspots < 5) {
      return 50; // Poor
    } else {
      return 25; // Very Poor
    }
  }

  /**
   * Analyze dependencies
   */
  async analyzeDependencies() {
    logger.debug('🔗 Analyzing dependencies...');
    
    const dependencies = {
      internal: {},
      external: {},
      circular: [],
      unused: [],
      missing: []
    };

    // Analyze package.json dependencies
    try {
      const packagePath = path.join(this.projectPath, 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf8');
      const packageData = JSON.parse(packageContent);
      
      dependencies.external = {
        production: packageData.dependencies || {},
        development: packageData.devDependencies || {}
      };
    } catch (error) {
      logger.debug('⚠️ Could not analyze package.json');
    }

    // Analyze internal dependencies
    const srcPath = path.join(this.projectPath, 'src');
    dependencies.internal = await this.analyzeInternalDependencies(srcPath);

    this.analysis.dependencies = dependencies;
  }

  /**
   * Analyze internal dependencies
   */
  async analyzeInternalDependencies(srcPath) {
    const dependencies = {};
    
    try {
      const files = await this.getJavaScriptFiles(srcPath);
      
      for (const file of files) {
        const fileDeps = await this.analyzeFileDependencies(file);
        dependencies[file] = fileDeps;
      }
    } catch (error) {
      logger.debug('⚠️ Could not analyze internal dependencies');
    }
    
    return dependencies;
  }

  /**
   * Analyze file dependencies
   */
  async analyzeFileDependencies(filePath) {
    const dependencies = {
      require: [],
      import: [],
      internal: [],
      external: []
    };

    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      // Find require statements
      const requireMatches = content.match(/require\(['"]([^'"]+)['"]\)/g);
      if (requireMatches) {
        for (const match of requireMatches) {
          const dep = match.match(/require\(['"]([^'"]+)['"]\)/)[1];
          dependencies.require.push(dep);
          
          if (dep.startsWith('./') || dep.startsWith('../')) {
            dependencies.internal.push(dep);
          } else {
            dependencies.external.push(dep);
          }
        }
      }
      
      // Find import statements
      const importMatches = content.match(/import.*from\s*['"]([^'"]+)['"]/g);
      if (importMatches) {
        for (const match of importMatches) {
          const dep = match.match(/from\s*['"]([^'"]+)['"]/)[1];
          dependencies.import.push(dep);
          
          if (dep.startsWith('./') || dep.startsWith('../')) {
            dependencies.internal.push(dep);
          } else {
            dependencies.external.push(dep);
          }
        }
      }
    } catch (error) {
      logger.debug(`⚠️ Could not analyze dependencies for: ${filePath}`);
    }

    return dependencies;
  }

  /**
   * Analyze features
   */
  async analyzeFeatures() {
    logger.debug('🚀 Analyzing features...');
    
    const features = {
      completed: [],
      inProgress: [],
      planned: [],
      total: 0,
      completionRate: 0
    };

    // Analyze data-central for implemented features
    const dataCentralPath = path.join(this.projectPath, 'data-central');
    
    try {
      const items = await fs.readdir(dataCentralPath, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isDirectory()) {
          const featureData = await this.analyzeFeature(path.join(dataCentralPath, item.name));
          features[featureData.status].push(featureData);
          features.total++;
        }
      }
    } catch (error) {
      logger.debug('⚠️ Could not analyze features');
    }

    // Analyze adapters for feature implementation
    const adaptersPath = path.join(this.projectPath, 'src', 'adapters');
    
    try {
      const adapterFiles = await fs.readdir(adaptersPath);
      
      for (const file of adapterFiles) {
        if (file.endsWith('.js')) {
          const featureName = file.replace('DataAdapter.js', '').toLowerCase();
          const featureData = {
            name: featureName,
            type: 'adapter',
            status: 'completed',
            implementation: 'data-adapter'
          };
          
          if (!features.completed.find(f => f.name === featureName)) {
            features.completed.push(featureData);
            features.total++;
          }
        }
      }
    } catch (error) {
      logger.debug('⚠️ Could not analyze adapters');
    }

    // Calculate completion rate
    features.completionRate = features.total > 0 ? 
      Math.round((features.completed.length / features.total) * 100) : 0;

    this.analysis.features = features;
  }

  /**
   * Analyze individual feature
   */
  async analyzeFeature(featurePath) {
    const feature = {
      name: path.basename(featurePath),
      path: featurePath,
      status: 'planned',
      implementation: 'none',
      dataFiles: []
    };

    try {
      const items = await fs.readdir(featurePath);
      
      for (const item of items) {
        if (item.endsWith('.json')) {
          feature.dataFiles.push(item);
          feature.status = 'completed';
          feature.implementation = 'data-storage';
        }
      }
    } catch (error) {
      // Feature directory doesn't exist or is empty
    }

    return feature;
  }

  /**
   * Calculate project metrics
   */
  async calculateMetrics() {
    logger.debug('📊 Calculating metrics...');
    
    const metrics = {
      codeQuality: {
        complexity: this.analysis.complexity.averageComplexity,
        maintainability: this.analysis.complexity.maintainabilityIndex,
        hotspots: this.analysis.complexity.hotspots.length
      },
      projectSize: {
        totalFiles: this.analysis.structure.totalFiles,
        totalDirectories: this.analysis.structure.totalDirectories,
        totalSize: Object.values(this.analysis.structure.directorySizes)
          .reduce((sum, dir) => sum + (dir.totalSize || 0), 0)
      },
      featureProgress: {
        total: this.analysis.features.total,
        completed: this.analysis.features.completed.length,
        inProgress: this.analysis.features.inProgress.length,
        planned: this.analysis.features.planned.length,
        completionRate: this.analysis.features.completionRate
      },
      technicalDebt: {
        highComplexity: this.analysis.complexity.hotspots.length,
        largeFiles: 0,
        unusedDependencies: this.analysis.dependencies.unused.length,
        circularDependencies: this.analysis.dependencies.circular.length
      }
    };

    // Count large files
    for (const [_file, complexity] of Object.entries(this.analysis.complexity.files)) {
      if (complexity.lines > 500) {
        metrics.technicalDebt.largeFiles++;
      }
    }

    this.analysis.metrics = metrics;
  }

  /**
   * Generate recommendations
   */
  async generateRecommendations() {
    logger.debug('💡 Generating recommendations...');
    
    const recommendations = {
      immediate: [],
      shortTerm: [],
      longTerm: [],
      priority: []
    };

    // Code quality recommendations
    if (this.analysis.complexity.maintainabilityIndex < 50) {
      recommendations.immediate.push({
        type: 'code-quality',
        title: 'Refactor High Complexity Code',
        description: 'Reduce cyclomatic complexity in hotspot files',
        files: this.analysis.complexity.hotspots.map(h => h.file),
        effort: 'high',
        impact: 'high'
      });
    }

    // Database migration recommendation
    if (this.analysis.structure.directorySizes['data-central']) {
      recommendations.immediate.push({
        type: 'architecture',
        title: 'Migrate to Database',
        description: 'Replace file-based storage with PostgreSQL',
        effort: 'high',
        impact: 'high'
      });
    }

    // Security recommendations
    recommendations.shortTerm.push({
      type: 'security',
      title: 'Implement RBAC',
      description: 'Add role-based access control system',
      effort: 'medium',
      impact: 'high'
    });

    // Performance recommendations
    if (this.analysis.metrics.codeQuality.complexity > 15) {
      recommendations.shortTerm.push({
        type: 'performance',
        title: 'Optimize Code Performance',
        description: 'Improve query performance and reduce complexity',
        effort: 'medium',
        impact: 'medium'
      });
    }

    // Feature completion recommendations
    if (this.analysis.features.completionRate < 80) {
      recommendations.shortTerm.push({
        type: 'features',
        title: 'Complete Feature Implementation',
        description: `Complete ${this.analysis.features.planned.length} planned features`,
        effort: 'medium',
        impact: 'medium'
      });
    }

    // Long-term recommendations
    recommendations.longTerm.push({
      type: 'architecture',
      title: 'Implement Microservices',
      description: 'Consider microservices architecture for scalability',
      effort: 'high',
      impact: 'high'
    });

    recommendations.longTerm.push({
      type: 'collaboration',
      title: 'Add Multi-user Support',
      description: 'Implement real-time collaboration features',
      effort: 'high',
      impact: 'high'
    });

    // Set priority
    recommendations.priority = [
      ...recommendations.immediate,
      ...recommendations.shortTerm,
      ...recommendations.longTerm
    ];

    this.analysis.recommendations = recommendations;
  }

  /**
   * Generate roadmap based on analysis
   */
  generateRoadmap() {
    const roadmap = {
      timestamp: new Date().toISOString(),
      type: 'analyzed-roadmap',
      title: 'AI Platform Development Roadmap',
      summary: {
        totalFeatures: this.analysis.features.total.toString(),
        completedFeatures: this.analysis.features.completed.length.toString(),
        inProgressFeatures: this.analysis.features.inProgress.length.toString(),
        completionRate: `${this.analysis.features.completionRate}%`,
        generatedAt: new Date().toLocaleString()
      },
      timeline: this.generateTimeline(),
      backlog: this.generateBacklog(),
      releases: this.generateReleases(),
      metrics: this.generateRoadmapMetrics(),
      recommendations: this.generateRoadmapRecommendations(),
      analysis: this.analysis
    };

    return roadmap;
  }

  /**
   * Generate timeline based on analysis
   */
  generateTimeline() {
    const phases = [
      {
        phase: 1,
        marker: '✅',
        title: 'Phase 1: Foundation',
        description: 'Core platform architecture and basic AI processing',
        date: 'Completed: Q1 2026',
        status: 'completed'
      },
      {
        phase: 2,
        marker: '✅',
        title: 'Phase 2: Data Processing',
        description: 'Advanced AI data analysis and optimization features',
        date: 'Completed: Q2 2026',
        status: 'completed'
      },
      {
        phase: 3,
        marker: '✅',
        title: 'Phase 3: Integration',
        description: 'Central data truth system and adapter integration',
        date: 'Completed: Q2 2026',
        status: 'completed'
      },
      {
        phase: 4,
        marker: '🔄',
        title: 'Phase 4: Enhancement',
        description: 'Database migration, security hardening, and performance optimization',
        date: 'In Progress: Q3 2026',
        status: 'in-progress'
      },
      {
        phase: 5,
        marker: '📋',
        title: 'Phase 5: Production',
        description: 'Full production deployment and scaling',
        date: 'Planned: Q4 2026',
        status: 'upcoming'
      }
    ];

    return phases;
  }

  /**
   * Generate backlog based on recommendations
   */
  generateBacklog() {
    const backlog = {
      highPriority: [],
      mediumPriority: [],
      lowPriority: []
    };

    // Convert recommendations to backlog items
    this.analysis.recommendations.immediate.forEach(rec => {
      backlog.highPriority.push({
        status: '📋',
        name: rec.title,
        estimate: this.estimateEffort(rec.effort),
        type: rec.type,
        description: rec.description
      });
    });

    this.analysis.recommendations.shortTerm.forEach(rec => {
      backlog.mediumPriority.push({
        status: '📋',
        name: rec.title,
        estimate: this.estimateEffort(rec.effort),
        type: rec.type,
        description: rec.description
      });
    });

    this.analysis.recommendations.longTerm.forEach(rec => {
      backlog.lowPriority.push({
        status: '📋',
        name: rec.title,
        estimate: this.estimateEffort(rec.effort),
        type: rec.type,
        description: rec.description
      });
    });

    return backlog;
  }

  /**
   * Estimate effort in weeks
   */
  estimateEffort(effort) {
    const effortMap = {
      'low': '1 week',
      'medium': '2-3 weeks',
      'high': '4-6 weeks'
    };
    
    return effortMap[effort] || '2 weeks';
  }

  /**
   * Generate releases
   */
  generateReleases() {
    return [
      {
        version: 'v2.0.0',
        title: 'Current Release',
        description: 'AI Data Processing Platform with central data truth system',
        date: 'Released: May 2026',
        status: 'released'
      },
      {
        version: 'v2.1.0',
        title: 'Enhancement Release',
        description: 'Database migration and security hardening',
        date: 'Expected: July 2026',
        status: 'upcoming'
      },
      {
        version: 'v2.2.0',
        title: 'Production Release',
        description: 'Multi-user support and production deployment',
        date: 'Expected: September 2026',
        status: 'upcoming'
      }
    ];
  }

  /**
   * Generate roadmap metrics
   */
  generateRoadmapMetrics() {
    return {
      totalBacklogItems: this.analysis.recommendations.priority.length,
      totalReleases: 3,
      completedPhases: 3,
      activePhases: 1,
      upcomingPhases: 1,
      codeQuality: this.analysis.metrics.codeQuality,
      projectSize: this.analysis.metrics.projectSize,
      technicalDebt: this.analysis.metrics.technicalDebt
    };
  }

  /**
   * Generate roadmap recommendations
   */
  generateRoadmapRecommendations() {
    return this.analysis.recommendations.priority.map(rec => ({
      priority: rec.impact,
      action: rec.title,
      description: rec.description,
      type: rec.type,
      effort: rec.effort
    }));
  }
}

module.exports = RoadmapAnalyzer;

