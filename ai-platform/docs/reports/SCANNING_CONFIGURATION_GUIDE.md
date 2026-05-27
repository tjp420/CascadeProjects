# 🎯 Scanning Configuration Guide

## 📍 **How the Program Knows Where to Scan Data From**

This guide explains exactly how the program determines scanning targets and data sources, making it transparent for all users.

---

## 🗂️ **Scanning Configuration System**

### **1. Central Configuration File**
**Location**: `analysis-data/config/central-analysis-config.json`

```json
{
  "analysisConfig": {
    "targetDirectories": [
      "src/",
      "web/",
      "billing/",
      "tests/",
      "components/"
    ],
    "includePatterns": [
      "*.js",
      "*.ts", 
      "*.jsx",
      "*.tsx",
      "*.py",
      "*.html",
      "*.json"
    ],
    "excludePatterns": [
      "node_modules/",
      "*.log",
      "*.tmp",
      ".git/"
    ]
  }
}
```

### **2. Dashboard Display**
**URL**: `http://localhost:56742/mock-data`

The dashboard now shows users exactly where data is scanned from:

#### **📊 Scanning Configuration Panel**
- **Target Directories**: `src/, web/, billing/, tests/, components/`
- **File Types**: `*.js, *.ts, *.jsx, *.tsx, *.py, *.html, *.json`
- **Data Source**: `analysis-data/output/findings/comprehensive-analysis-findings.json`
- **Last Scan**: Shows actual scan timestamp

---

## 🔍 **How Scanning Works**

### **Step 1: Configuration Loading**
```javascript
// Program reads central configuration
fetch('/analysis-data/config/central-analysis-config.json')
  .then(response => response.json())
  .then(config => {
    // Load target directories and patterns
    this.targetDirectories = config.analysisConfig.targetDirectories;
    this.includePatterns = config.analysisConfig.includePatterns;
  });
```

### **Step 2: Directory Scanning**
```javascript
// Program scans each target directory
config.targetDirectories.forEach(dir => {
  scanDirectory(dir, config.includePatterns);
});

function scanDirectory(directory, patterns) {
  // Find all matching files
  const files = findFiles(directory, patterns);
  // Analyze each file
  files.forEach(file => analyzeFile(file));
}
```

### **Step 3: Data Collection**
```javascript
// Results stored in central location
const results = {
  scanInfo: {
    timestamp: new Date().toISOString(),
    targetPath: targetDirectories.join(', '),
    totalFiles: totalFilesFound,
    scannedFiles: filesAnalyzed
  },
  categories: {
    // Analysis results by category
  }
};

// Save to central location
saveResults('analysis-data/output/findings/comprehensive-analysis-findings.json', results);
```

### **Step 4: Dashboard Display**
```javascript
// Dashboard reads from central location
fetch('/analysis-data/output/findings/comprehensive-analysis-findings.json')
  .then(response => response.json())
  .then(data => {
    // Display results and configuration
    updateScanConfiguration(data);
    displayResults(data.categories);
  });
```

---

## 📁 **Directory Structure Explained**

### **Target Directories**
```
C:\Users\Trevor\CascadeProjects\
├── src/                    # ✅ SCANNED
│   ├── python/            # Python files
│   ├── javascript/         # JavaScript/TypeScript
│   ├── components/         # React components
│   ├── pages/             # HTML pages
│   └── js/                # JavaScript utilities
├── web/                   # ✅ SCANNED
│   ├── api/               # API endpoints
│   ├── __tests__/         # Test files
│   └── api-client-simple.js
├── billing/               # ✅ SCANNED
│   ├── pricing.html
│   └── stripe-integration.js
├── tests/                 # ✅ SCANNED
│   ├── unit/
│   └── integration/
└── components/            # ✅ SCANNED
    └── [component files]
```

### **Excluded Directories**
```
C:\Users\Trevor\CascadeProjects\
├── node_modules/          # ❌ EXCLUDED
├── .git/                  # ❌ EXCLUDED
├── dist/                  # ❌ EXCLUDED
├── build/                 # ❌ EXCLUDED
├── *.log                  # ❌ EXCLUDED
└── *.tmp                  # ❌ EXCLUDED
```

---

## 🔧 **Configuration Options**

### **Target Directories**
Add or remove directories to scan:
```json
"targetDirectories": [
  "src/",
  "web/",
  "billing/",
  "tests/",
  "components/",
  "docs/",           // Add new directory
  "scripts/"         // Add new directory
]
```

### **File Types**
Specify which file types to analyze:
```json
"includePatterns": [
  "*.js",
  "*.ts",
  "*.jsx",
  "*.tsx",
  "*.py",
  "*.html",
  "*.json",
  "*.md",            // Add new file type
  "*.yml"            // Add new file type
]
```

### **Exclude Patterns**
Exclude files and directories:
```json
"excludePatterns": [
  "node_modules/",
  "*.log",
  "*.tmp",
  ".git/",
  "*.min.js",        // Exclude minified files
  "coverage/"        // Exclude coverage reports
]
```

---

## 🎯 **How Users Can See Scanning Targets**

### **1. Dashboard Interface**
- **Navigate to**: `http://localhost:56742/mock-data`
- **View**: "Scanning Configuration" panel
- **See**: Target directories, file types, data source, last scan time

### **2. Configuration File**
- **Location**: `analysis-data/config/central-analysis-config.json`
- **Edit**: Modify target directories and patterns
- **Save**: Changes apply to next scan

### **3. Direct Data Access**
- **URL**: `http://localhost:56742/analysis-data/config/central-analysis-config.json`
- **View**: Raw configuration in browser
- **Download**: Save configuration for backup

---

## 🔄 **Scanning Process Flow**

```
1. START → Load Configuration
2. → Read Target Directories
3. → Scan Each Directory
4. → Find Matching Files
5. → Analyze File Contents
6. → Collect Results
7. → Save to Central Location
8. → Update Dashboard Display
9. → END
```

---

## 📊 **Real-time Configuration Display**

### **What Users See**
```
📊 Scanning Configuration
├── Target Directories: src/, web/, billing/, tests/, components/
├── File Types: *.js, *.ts, *.jsx, *.tsx, *.py, *.html, *.json
├── Data Source: analysis-data/output/findings/comprehensive-analysis-findings.json
└── Last Scan: 5/19/2026, 10:50:37 PM
```

### **What's Happening Behind the Scenes**
```
🔍 Scanning Process
├── Reading: analysis-data/config/central-analysis-config.json
├── Scanning: 47 total files in 5 directories
├── Analyzing: 45 files successfully processed
├── Finding: 189,928 total findings across 11 categories
└── Saving: analysis-data/output/findings/comprehensive-analysis-findings.json
```

---

## 🚀 **How to Modify Scanning Targets**

### **Add New Directory**
1. **Edit**: `analysis-data/config/central-analysis-config.json`
2. **Add**: New directory to `targetDirectories` array
3. **Save**: Configuration file
4. **Refresh**: Dashboard to see changes

### **Change File Types**
1. **Edit**: `analysis-data/config/central-analysis-config.json`
2. **Update**: `includePatterns` array
3. **Save**: Configuration file
4. **Rescan**: Run new analysis

### **Exclude Files**
1. **Edit**: `analysis-data/config/central-analysis-config.json`
2. **Add**: Patterns to `excludePatterns` array
3. **Save**: Configuration file
4. **Rescan**: Run new analysis

---

## 🎯 **Transparency Features**

### **1. Configuration Display**
- **Visible**: Target directories and file types
- **Clear**: Data source location
- **Timestamp**: Last scan time

### **2. Scan Information**
- **Total Files**: Number of files found
- **Scanned Files**: Files successfully analyzed
- **Findings**: Total issues discovered

### **3. Real-time Updates**
- **Live Display**: Configuration changes shown immediately
- **Auto-refresh**: Scan times updated automatically
- **Status Indicators**: Progress and completion status

---

## 📋 **Summary**

### **How the Program Knows Where to Scan:**
1. **Configuration File**: Central config defines targets
2. **Dashboard Display**: Shows users exactly what's being scanned
3. **Dynamic Loading**: Configuration loaded in real-time
4. **Transparent Results**: All scanning information visible to users

### **Key Benefits:**
- **🎯 Clear Visibility**: Users see exactly what's being scanned
- **⚙️ Easy Configuration**: Simple JSON file to modify targets
- **📊 Real-time Display**: Live configuration information
- **🔍 Comprehensive Coverage**: All relevant directories and file types

### **User Experience:**
- **No Hidden Processes**: All scanning targets are visible
- **Easy to Understand**: Clear configuration display
- **Simple to Modify**: Edit configuration file to change targets
- **Immediate Feedback**: Changes reflected in dashboard

The scanning system is designed to be **completely transparent** - users always know exactly where data is being scanned from and can easily modify the configuration as needed! 🎯
