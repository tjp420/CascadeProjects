# Mock Data Lifecycle Documentation

**Created:** 2026-05-20  
**Version:** 1.0.0  
**Project:** CascadeProjects AI Dashboard

## Overview

This document describes the complete lifecycle of mock data in the AI Dashboard system, including when mock data is used versus real data, how data flows through the system, and the mechanisms for switching between mock and real data sources.

## Mock Data Sources

### 1. Component-Level Mock Data
**Purpose:** Provide static mock data for UI components and demonstrations  
**Location:** Individual component files (team.js, roadmap.js, etc.)  
**Lifecycle:** Loaded on page initialization, remains static

**Examples:**
- `teamData` in team.js
- `roadmapData` in roadmap.js
- `performanceData` in performance-metrics.js
- `debugData` in debug-tools.js

**When Used:**
- Development and demonstration
- UI component testing
- Feature prototyping
- Client-side rendering without backend

### 2. Export Mock Data Generation
**Purpose:** Generate dynamic mock data for export operations  
**Location:** export-mock-data.js (consolidated from export-system.js)  
**Lifecycle:** Generated on-demand during export operations

**Functions:**
- `generateMockData(type)` - General dashboard data
- `generateMockCSVData(datasetId)` - Dataset-specific CSV data
- `generateMockUploadData(period)` - Upload statistics
- `generateMockUploadDetails(uploadId)` - Detailed upload information
- `generateMockDirectoryData(reportType, format, includeCharts)` - Directory analysis
- `generateMockDiagnosticsData(reportType, format, includeCharts, period)` - System diagnostics

**When Used:**
- Export operations when real data is unavailable
- Report generation for demonstration
- Testing export functionality
- Format validation and testing

### 3. Test Infrastructure Mock Data
**Purpose:** Provide comprehensive mock data for testing  
**Location:** test-data-generator.js, test-fixtures.js, mock-factory.js  
**Lifecycle:** Generated during test execution

**Categories:**
- **Test Data Generators:** Dynamic generation of test data
- **Test Fixtures:** Pre-defined test data objects
- **Mock Factory:** Standardized mock object creation
- **Jest Setup:** Global test mocks and configurations

**When Used:**
- Unit testing
- Integration testing
- End-to-end testing
- CI/CD pipelines

### 4. Analysis Mock Data
**Purpose:** Provide mock analysis results and metrics  
**Location:** dashboard-scripts.js, mock-data.js  
**Lifecycle:** Loaded on demand, can be refreshed

**Examples:**
- `comprehensiveAnalysisData` - Complete project analysis
- `mockDataAnalysis` - Mock data analysis results
- `roadmapData` - Technical debt roadmap

**When Used:**
- Dashboard demonstrations
- Analysis feature testing
- Performance monitoring simulation
- Technical debt tracking

## Data Flow Architecture

### 1. Initialization Phase
```
Page Load
    ↓
Component Scripts Load (team.js, roadmap.js, etc.)
    ↓
Static Mock Data Initialized
    ↓
Global Window Objects Populated
    ↓
UI Components Render with Mock Data
```

### 2. Export Phase
```
User Initiates Export
    ↓
Export System Checks for Real Data
    ↓
If Real Data Available → Use Real Data
    ↓
If Real Data Unavailable → Generate Mock Data
    ↓
Export Mock Data Generator Called
    ↓
Dynamic Mock Data Generated
    ↓
Report Content Created
    ↓
File Downloaded
```

### 3. Analysis Phase
```
User Requests Analysis
    ↓
Analysis System Checks Data Source
    ↓
If Real Analysis Available → Use Real Results
    ↓
If Real Analysis Unavailable → Load Mock Analysis
    ↓
Mock Data Analysis Loaded
    ↓
Results Displayed in Dashboard
    ↓
Charts and Metrics Rendered
```

### 4. Testing Phase
```
Test Execution Started
    ↓
Jest Setup Runs (Global Mocks Configured)
    ↓
Test Data Generators Initialize
    ↓
Test Fixtures Loaded
    ↓
Mock Factory Creates Test Objects
    ↓
Test Functions Execute with Mock Data
    ↓
Assertions Validated
    ↓
Test Results Reported
```

## Mock Data vs Real Data Switching

### Current Implementation

**No Active Switching Mechanism:** The current system does not have an explicit toggle between mock and real data. Mock data is used by default in development environments.

### Recommended Switching Mechanism

```javascript
// Configuration object for data source control
const dataSourceConfig = {
  environment: process.env.NODE_ENV || 'development',
  useMockData: {
    development: true,
    staging: false,
    production: false,
    test: true
  },
  dataSources: {
    team: {
      mock: () => import('./team.js').then(m => m.teamData),
      real: () => fetch('/api/team').then(r => r.json())
    },
    roadmap: {
      mock: () => import('./roadmap.js').then(m => m.roadmapData),
      real: () => fetch('/api/roadmap').then(r => r.json())
    }
  }
};

// Generic data loader with automatic switching
async function loadData(sourceName) {
  const config = dataSourceConfig.dataSources[sourceName];
  const useMock = dataSourceConfig.useMockData[dataSourceConfig.environment];
  
  if (useMock) {
    console.log(`Loading mock data for ${sourceName}`);
    return await config.mock();
  } else {
    console.log(`Loading real data for ${sourceName}`);
    return await config.real();
  }
}
```

### Environment-Based Configuration

```javascript
// Environment configuration
const ENV_CONFIG = {
  development: {
    useMockData: true,
    mockDataLevel: 'full', // full, partial, minimal
    logDataSources: true
  },
  staging: {
    useMockData: false,
    fallbackToMock: true,
    logDataSources: true
  },
  production: {
    useMockData: false,
    fallbackToMock: false,
    logDataSources: false
  },
  test: {
    useMockData: true,
    mockDataLevel: 'full',
    logDataSources: false
  }
};
```

## Mock Data Lifecycle Stages

### Stage 1: Definition
**Purpose:** Define mock data structures and schemas  
**Location:** Source files (component files, generator functions)  
**Trigger:** Development time  
**Output:** Mock data definitions and generators

**Best Practices:**
- Use realistic data patterns
- Include edge cases
- Document data structure
- Version data schemas

### Stage 2: Initialization
**Purpose:** Load mock data into memory  
**Location:** Browser/client-side initialization  
**Trigger:** Page load, component mount  
**Output:** Populated data objects in memory

**Best Practices:**
- Load asynchronously when possible
- Cache frequently used data
- Handle initialization errors
- Provide loading states

### Stage 3: Usage
**Purpose:** Use mock data in application logic  
**Location:** Throughout application code  
**Trigger:** User interactions, system events  
**Output:** UI rendering, report generation, analysis

**Best Practices:**
- Treat mock data like real data
- Validate mock data structure
- Handle missing or invalid data
- Log mock data usage

### Stage 4: Refresh/Update
**Purpose:** Update mock data during runtime  
**Location:** Data refresh functions  
**Trigger:** User actions, timers, events  
**Output:** Updated mock data in memory

**Best Practices:**
- Provide refresh mechanisms
- Maintain data consistency
- Handle refresh errors
- Update UI appropriately

### Stage 5: Cleanup
**Purpose:** Remove mock data from memory  
**Location:** Component unmount, page unload  
**Trigger:** Component lifecycle, navigation  
**Output:** Freed memory, cleaned references

**Best Practices:**
- Clean up event listeners
- Remove global references
- Clear caches
- Handle cleanup errors

## Mock Data Quality Assurance

### Validation Strategies

#### 1. Schema Validation
```javascript
// Example schema validation using JSON Schema
const teamDataSchema = {
  type: 'object',
  properties: {
    teamMembers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          role: { type: 'string' },
          email: { type: 'string', format: 'email' }
        },
        required: ['id', 'name', 'role', 'email']
      }
    }
  },
  required: ['teamMembers']
};

function validateMockData(data, schema) {
  const validate = ajv.compile(schema);
  const valid = validate(data);
  if (!valid) {
    console.error('Mock data validation failed:', validate.errors);
    return false;
  }
  return true;
}
```

#### 2. Data Integrity Checks
```javascript
// Example data integrity checks
function checkMockDataIntegrity(data) {
  const checks = {
    hasRequiredFields: data.hasOwnProperty('teamMembers'),
    hasValidDataTypes: Array.isArray(data.teamMembers),
    hasNoNullValues: !JSON.stringify(data).includes('null'),
    hasConsistentStructure: data.teamMembers.every(member => 
      member.id && member.name && member.role
    )
  };
  
  const allPassed = Object.values(checks).every(check => check === true);
  
  if (!allPassed) {
    console.error('Mock data integrity checks failed:', checks);
  }
  
  return allPassed;
}
```

#### 3. Realism Validation
```javascript
// Example realism validation
function validateMockDataRealism(data) {
  const checks = {
    hasRealisticDates: data.teamMembers.every(member => 
      isValidDate(member.joinDate)
    ),
    hasRealisticEmails: data.teamMembers.every(member => 
      isValidEmail(member.email)
    ),
    hasRealisticPerformance: data.teamMembers.every(member => 
      member.performance.productivity >= 0 && 
      member.performance.productivity <= 100
    )
  };
  
  const allPassed = Object.values(checks).every(check => check === true);
  
  if (!allPassed) {
    console.error('Mock data realism checks failed:', checks);
  }
  
  return allPassed;
}
```

## Mock Data Performance Considerations

### Memory Management

#### 1. Lazy Loading
```javascript
// Example lazy loading implementation
class MockDataManager {
  constructor() {
    this.cache = new Map();
    this.loaded = new Set();
  }
  
  async getData(sourceName) {
    if (this.loaded.has(sourceName)) {
      return this.cache.get(sourceName);
    }
    
    const data = await this.loadSource(sourceName);
    this.cache.set(sourceName, data);
    this.loaded.add(sourceName);
    
    return data;
  }
  
  async loadSource(sourceName) {
    // Lazy load implementation
    switch(sourceName) {
      case 'team':
        return (await import('./team.js')).teamData;
      case 'roadmap':
        return (await import('./roadmap.js')).roadmapData;
      default:
        throw new Error(`Unknown source: ${sourceName}`);
    }
  }
  
  clearCache() {
    this.cache.clear();
    this.loaded.clear();
  }
}
```

#### 2. Data Caching
```javascript
// Example caching strategy
const mockDataCache = {
  team: null,
  roadmap: null,
  performance: null,
  
  async get(key, loader) {
    if (this[key] !== null) {
      return this[key];
    }
    
    this[key] = await loader();
    return this[key];
  },
  
  clear() {
    Object.keys(this).forEach(key => {
      this[key] = null;
    });
  },
  
  invalidate(key) {
    this[key] = null;
  }
};
```

### Loading Optimization

#### 1. Parallel Loading
```javascript
// Example parallel loading
async function loadAllMockData() {
  const [team, roadmap, performance] = await Promise.all([
    import('./team.js').then(m => m.teamData),
    import('./roadmap.js').then(m => m.roadmapData),
    import('./performance-metrics.js').then(m => m.performanceData)
  ]);
  
  return { team, roadmap, performance };
}
```

#### 2. Progressive Loading
```javascript
// Example progressive loading
async function loadMockDataProgressively() {
  // Load critical data first
  const teamData = await (await import('./team.js')).teamData;
  updateTeamUI(teamData);
  
  // Load secondary data
  setTimeout(async () => {
    const roadmapData = await (await import('./roadmap.js')).roadmapData;
    updateRoadmapUI(roadmapData);
  }, 100);
  
  // Load tertiary data
  setTimeout(async () => {
    const performanceData = await (await import('./performance-metrics.js')).performanceData;
    updatePerformanceUI(performanceData);
  }, 200);
}
```

## Mock Data Security Considerations

### Data Anonymization

#### 1. Email Address Anonymization
```javascript
// Current approach (potentially confusing):
const email = 'john.doe@company.com';

// Recommended approach (clearly mock):
const email = 'john.doe@mock-data.local';
const email = generateTestEmail('john', 'mock-data.local');
```

#### 2. Personal Information Anonymization
```javascript
// Current approach (realistic but potentially confusing):
const user = {
  name: 'John Doe',
  phone: '+1-555-123-4567',
  address: '123 Main St, City, State'
};

// Recommended approach (clearly mock):
const user = {
  name: 'Test User',
  phone: generateTestPhone(),
  address: 'Mock Address, Test City, TS'
};
```

### Environment Isolation

#### 1. Environment-Specific Loading
```javascript
// Ensure mock data never loads in production
if (process.env.NODE_ENV === 'production') {
  if (useMockData) {
    throw new Error('Mock data cannot be used in production');
  }
}
```

#### 2. Mock Data Watermarking
```javascript
// Add watermark to mock data
function watermarkMockData(data) {
  return {
    ...data,
    _mock: true,
    _generatedAt: new Date().toISOString(),
    _environment: process.env.NODE_ENV,
    _version: '1.0.0'
  };
}
```

## Mock Data Monitoring and Debugging

### Usage Tracking

#### 1. Mock Data Usage Logger
```javascript
// Example usage tracking
const mockDataUsageTracker = {
  usage: new Map(),
  
  logUsage(sourceName, context) {
    if (!this.usage.has(sourceName)) {
      this.usage.set(sourceName, []);
    }
    
    this.usage.get(sourceName).push({
      timestamp: new Date().toISOString(),
      context: context,
      stackTrace: new Error().stack
    });
  },
  
  getUsageReport() {
    return Object.fromEntries(this.usage);
  },
  
  clearUsage() {
    this.usage.clear();
  }
};
```

#### 2. Performance Monitoring
```javascript
// Example performance monitoring
function trackMockDataPerformance(sourceName, loader) {
  const startTime = performance.now();
  const result = loader();
  const endTime = performance.now();
  
  console.log(`Mock data load time for ${sourceName}: ${endTime - startTime}ms`);
  
  return result;
}
```

### Debugging Tools

#### 1. Mock Data Inspector
```javascript
// Developer tool for inspecting mock data
function inspectMockData() {
  return {
    teamData: window.teamData,
    roadmapData: window.roadmapData,
    performanceData: window.performanceData,
    exportMockData: window.ExportMockData,
    testDataGenerator: window.TestDataGenerator,
    testFixtures: window.TestFixtures
  };
}
```

#### 2. Mock Data Validator
```javascript
// Developer tool for validating mock data
function validateAllMockData() {
  const results = {};
  
  Object.keys(inspectMockData()).forEach(key => {
    try {
      const data = inspectMockData()[key];
      results[key] = {
        valid: true,
        structure: Object.keys(data || {}),
        size: JSON.stringify(data).length
      };
    } catch (error) {
      results[key] = {
        valid: false,
        error: error.message
      };
    }
  });
  
  return results;
}
```

## Best Practices Summary

### Development
1. **Use realistic data patterns** that mirror production data structures
2. **Document all mock data** with clear comments and type definitions
3. **Version mock data schemas** to track changes over time
4. **Validate mock data** during development to catch issues early

### Testing
1. **Use centralized generators** instead of hardcoded values
2. **Create reusable fixtures** for common test scenarios
3. **Mock external dependencies** consistently across tests
4. **Clean up mock data** after each test to prevent interference

### Production
1. **Never use mock data** in production environments
2. **Implement fallback mechanisms** for when real data is unavailable
3. **Monitor data sources** to detect accidental mock data usage
4. **Log all data source switches** for debugging and audit purposes

### Security
1. **Clearly identify mock data** with distinctive patterns (e.g., @mock-data.local)
2. **Anonymize personal information** even in mock data
3. **Implement environment checks** to prevent mock data in production
4. **Add watermarks** to mock data for easy identification

## Troubleshooting

### Common Issues

#### 1. Mock Data Not Loading
**Symptoms:** UI components show empty or missing data  
**Causes:** Script loading order, missing global exports, initialization timing  
**Solutions:** 
- Check script loading order in HTML
- Verify global window object assignments
- Add loading state handling
- Check browser console for errors

#### 2. Mock Data Structure Mismatches
**Symptoms:** Type errors, missing properties, runtime exceptions  
**Causes:** Schema changes, inconsistent data structures  
**Solutions:**
- Validate mock data against schemas
- Update all mock data sources consistently
- Add type checking where appropriate
- Document data structure changes

#### 3. Performance Issues with Mock Data
**Symptoms:** Slow page load, high memory usage, UI lag  
**Causes:** Large mock data objects, inefficient loading, memory leaks  
**Solutions:**
- Implement lazy loading
- Add data caching
- Clean up unused mock data
- Optimize data structures

#### 4. Accidental Production Mock Data Usage
**Symptoms:** Mock data appearing in production, inconsistent user experience  
**Causes:** Missing environment checks, incorrect configuration  
**Solutions:**
- Add environment-specific loading logic
- Implement runtime checks
- Add monitoring and alerts
- Review deployment configurations

## Future Improvements

### Recommended Enhancements

1. **Dynamic Data Switching:** Implement runtime toggle between mock and real data
2. **Mock Data Versioning:** Add version control for mock data schemas
3. **Automated Validation:** Integrate schema validation into CI/CD pipeline
4. **Performance Monitoring:** Add metrics for mock data loading and usage
5. **Security Hardening:** Implement stricter mock data identification and isolation
6. **Documentation Generation:** Auto-generate documentation from mock data schemas
7. **Testing Integration:** Better integration between mock data and test frameworks
8. **Developer Tools:** Create browser extension for mock data inspection and debugging

---

**Document End**

*This documentation should be updated whenever mock data structures, loading mechanisms, or lifecycle processes change.*