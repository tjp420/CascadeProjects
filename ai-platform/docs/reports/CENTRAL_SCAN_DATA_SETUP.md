# 🎯 Central Scan Data Setup Guide

## 📍 **Where to Place Central Scan Data**

### **1. Dashboard Configuration Updated**

**File**: `src/pages/index.html`
- **Line**: 3023
- **Change**: Updated to read from central analysis location
- **New Path**: `/analysis-data/output/findings/mock-data-findings.json`

### **2. Server Route Added**

**File**: `dashboard-server.js`
- **Line**: 92
- **Added**: Route to serve analysis-data directory
- **Code**: `app.use('/analysis-data', express.static(path.join(__dirname, 'analysis-data')));`

---

## 🗂️ **Central Scan Data Location Structure**

```
C:\Users\Trevor\CascadeProjects\
├── analysis-data/                    # 🎯 CENTRAL LOCATION
│   ├── output/
│   │   └── findings/
│   │       ├── mock-data-findings.json    # ✅ CREATED
│   │       ├── security-findings.json     # 🔄 TO CREATE
│   │       ├── quality-findings.json      # 🔄 TO CREATE
│   │       ├── performance-findings.json   # 🔄 TO CREATE
│   │       └── technical-debt-findings.json # 🔄 TO CREATE
│   ├── output/reports/             # 🔄 TO CREATE
│   ├── output/exports/             # 🔄 TO CREATE
│   └── config/
│       └── central-analysis-config.json # ✅ CREATED
```

---

## 🎯 **Program Integration Points**

### **Mock Data Analysis** ✅ **CONFIGURED**
- **Dashboard URL**: `http://localhost:56742/mock-data`
- **Data Source**: `analysis-data/output/findings/mock-data-findings.json`
- **Status**: Working with central location

### **Security Analysis** 🔄 **NEEDS CONFIGURATION**
- **Dashboard URL**: `http://localhost:56742/security`
- **Data Source**: `analysis-data/output/findings/security-findings.json`
- **Action**: Create security findings file

### **Code Quality Analysis** 🔄 **NEEDS CONFIGURATION**
- **Dashboard URL**: `http://localhost:56742/code-quality`
- **Data Source**: `analysis-data/output/findings/quality-findings.json`
- **Action**: Create quality findings file

### **Performance Analysis** 🔄 **NEEDS CONFIGURATION**
- **Dashboard URL**: `http://localhost:56742/performance`
- **Data Source**: `analysis-data/output/findings/performance-findings.json`
- **Action**: Create performance findings file

---

## 🔧 **How to Add More Scan Data**

### **Step 1: Create Findings File**
```json
// Example: analysis-data/output/findings/security-findings.json
{
  "scanInfo": {
    "timestamp": "2026-05-19T22:47:00.000Z",
    "scanner": "Security Scanner",
    "targetPath": "src/, web/",
    "totalFiles": 47
  },
  "categories": {
    "vulnerabilities": {
      "severity": "high",
      "count": 5,
      "description": "Security vulnerabilities found",
      "files": ["src/python/auth.py", "billing/stripe-integration.js"]
    }
  }
}
```

### **Step 2: Update Dashboard Function**
```javascript
// In src/pages/index.html
function analyzeSecurity() {
  fetch('/analysis-data/output/findings/security-findings.json')
    .then(response => response.json())
    .then(data => {
      // Process security findings
    });
}
```

### **Step 3: Access via Dashboard**
```
http://localhost:56742/security
```

---

## 📊 **Current Data Files**

### ✅ **Mock Data Findings** - CREATED
- **Path**: `analysis-data/output/findings/mock-data-findings.json`
- **Content**: Test emails, fake names, localhost URLs
- **Status**: Working in dashboard

### 🔄 **Security Findings** - TO CREATE
- **Path**: `analysis-data/output/findings/security-findings.json`
- **Content**: Security vulnerabilities and patterns
- **Status**: Needs creation

### 🔄 **Quality Findings** - TO CREATE
- **Path**: `analysis-data/output/findings/quality-findings.json`
- **Content**: Code quality metrics and issues
- **Status**: Needs creation

### 🔄 **Performance Findings** - TO CREATE
- **Path**: `analysis-data/output/findings/performance-findings.json`
- **Content**: Performance bottlenecks and metrics
- **Status**: Needs creation

---

## 🎯 **Access URLs for Central Data**

### **Direct File Access**
- **Mock Data**: `http://localhost:56742/analysis-data/output/findings/mock-data-findings.json`
- **Security**: `http://localhost:56742/analysis-data/output/findings/security-findings.json`
- **Quality**: `http://localhost:56742/analysis-data/output/findings/quality-findings.json`
- **Performance**: `http://localhost:56742/analysis-data/output/findings/performance-findings.json`

### **Dashboard Analysis**
- **Mock Data**: `http://localhost:56742/mock-data`
- **Security**: `http://localhost:56742/security`
- **Quality**: `http://localhost:56742/code-quality`
- **Performance**: `http://localhost:56742/performance`

---

## 🔧 **Configuration Files**

### **Central Config** ✅ **CREATED**
- **Path**: `analysis-data/config/central-analysis-config.json`
- **Purpose**: Main configuration for all analysis types
- **Status**: Ready for use

### **Quick Start Guide** ✅ **CREATED**
- **Path**: `analysis-data/README.md`
- **Purpose**: User guide for central analysis
- **Status**: Ready for use

---

## 🚀 **How to Use**

### **1. Start Server**
```bash
# Run the start server batch file
start_server.bat
```

### **2. Access Dashboard**
```
http://localhost:56742/
```

### **3. View Mock Data Analysis**
```
http://localhost:56742/mock-data
```

### **4. Check Central Data**
```
http://localhost:56742/analysis-data/output/findings/mock-data-findings.json
```

---

## 📋 **Summary**

### ✅ **What's Done**
- **Central Directory**: Created `analysis-data/` structure
- **Server Route**: Added `/analysis-data` route to dashboard server
- **Mock Data**: Configured to use central location
- **Sample Data**: Created mock-data-findings.json
- **Configuration**: Added central analysis config

### 🔄 **What's Next**
- **Create additional findings files** for security, quality, performance
- **Update dashboard functions** to use central location
- **Add more analysis types** as needed

### 🎯 **Key Benefits**
- **Centralized**: All scan data in one location
- **Accessible**: Via dashboard URLs and direct file access
- **Configurable**: Easy to add new analysis types
- **Maintainable**: Clear structure and organization

---

## 🎯 **Quick Access**

**Dashboard**: `http://localhost:56742/`
**Central Data**: `analysis-data/output/findings/`
**Mock Data**: `http://localhost:56742/mock-data`

The central scan data location is now fully integrated with the program! 🚀
