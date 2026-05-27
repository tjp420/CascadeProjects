# Technical Debt Analyzer & File Cleanup Tools Guide

**Overview:** Your codebase contains several powerful tools for analyzing technical debt, identifying unnecessary files, and cleaning up old data. This guide helps you locate and use these tools effectively.

---

## 🛠️ Available Tools

### 1. **Technical Debt Analyzer**
**Location:** `src/components/core/TechnicalDebtAnalyzer.js`

**Purpose:** Comprehensive technical debt analysis and reporting system

**Key Features:**
- Code complexity analysis
- Code duplication detection
- Code smells identification
- Test coverage assessment
- Documentation completeness analysis
- Dependency analysis
- Security debt calculation
- Performance debt evaluation

**How to Use:**
```javascript
// In your dashboard or application
const analyzer = new TechnicalDebtAnalyzer();
const projectData = {
    total_files: 4319,
    file_types: { '.js': 1500, '.py': 800, '.html': 200 },
    // ... other project metrics
};

const report = await analyzer.analyzeProject(projectData);
console.log('Technical Debt Report:', report);
```

**Dashboard Integration:** The Technical Debt Analyzer is integrated into your AI Coding Intelligence Dashboard and can be accessed via the "Code Analysis" section.

---

### 2. **Project File Analyzer**
**Location:** `src/components/core/ProjectFileAnalyzer.js`

**Purpose:** Detects untracked files and provides suggestions for file organization

**Key Features:**
- Untracked file detection
- Missing configuration file identification
- File structure analysis
- Integration suggestions
- Configuration file importance ratings

**How to Use:**
```javascript
const fileAnalyzer = new ProjectFileAnalyzer();
const projectData = {
    directory: './src',
    total_files: 4319,
    file_types: { '.js': 1500, '.py': 800 }
};

const analysis = await fileAnalyzer.analyzeProject(projectData);
console.log('File Analysis:', analysis);
```

---

### 3. **Project Cleanup Script**
**Location:** `src/tools/cleanup_project.py`

**Purpose:** Automated cleanup of redundant files, backups, and build artifacts

**Key Features:**
- Backup directory cleanup (older than 7 days)
- Unity artifact removal
- Phase2 backup file cleanup
- Temporary file removal
- Node module cleanup
- Python cache cleanup
- Log file management
- Build artifact removal

**How to Use:**
```bash
# Run the cleanup script
cd c:/Users/Trevor/CascadeProjects
python src/tools/cleanup_project.py

# Or run with specific options
python src/tools/cleanup_project.py --dry-run  # Preview changes
python src/tools/cleanup_project.py --aggressive  # More thorough cleanup
```

**What It Cleans:**
- `*.backup`, `*.bak`, `*.old` files
- `*.tmp`, `*.temporary`, `*.log` files
- `__pycache__`, `.pytest_cache` directories
- `node_modules/` (if requested)
- Unity build artifacts
- Old backup directories
- Phase2 backup files

---

### 4. **Security Monitor**
**Location:** `security_monitor.py` (root directory)

**Purpose:** Continuous security scanning for credentials and sensitive data

**Key Features:**
- API key detection
- Credit card number scanning
- Password detection
- Mock data pattern identification
- Automated alerting
- Health score calculation
- Scheduled monitoring support

**How to Use:**
```bash
# Run immediate security scan
python security_monitor.py

# Setup scheduled monitoring
python security_monitor.py --setup-schedule

# View configuration
cat security_monitor_config.json
```

---

### 5. **Mock Data Scanner**
**Location:** `web/mock_data_scanner.js`

**Purpose:** Identifies mock data, test data, and placeholder content

**Key Features:**
- Test email detection
- Fake name identification
- Mock phone number detection
- Sample credit card detection
- Placeholder text identification
- Mock database reference detection

**Dashboard Integration:** Integrated into the dashboard's "Security Scan" section

---

## 📊 Dashboard Integration

Your AI Coding Intelligence Dashboard (`http://localhost:56742`) includes these tools in the sidebar navigation:

### **Main Section:**
- **Dashboard** - Overview of all metrics
- **Code Analysis** - Technical debt analysis results
- **Security Scan** - Security vulnerability scanning
- **Performance** - Performance profiling

### **Tools Section:**
- **File Upload** - Upload files for analysis
- **Mock Data Analyzer** - Mock data detection and analysis
- **Roadmap Builder** - Remediation roadmap creation
- **Settings** - Tool configuration

---

## 🚀 Quick Start Guide

### **Step 1: Analyze Technical Debt**
```bash
# Start the dashboard server
node dashboard-server.js

# Navigate to http://localhost:56742
# Click "Code Analysis" in the sidebar
# View technical debt metrics and recommendations
```

### **Step 2: Identify Unnecessary Files**
```bash
# Use the Project File Analyzer
# In the dashboard, navigate to the file analysis section
# Review untracked files and missing configurations
```

### **Step 3: Run Security Scan**
```bash
# Run security monitor
python security_monitor.py

# Or use the dashboard Security Scan section
# Review critical issues and recommendations
```

### **Step 4: Clean Up Files**
```bash
# Preview cleanup changes
python src/tools/cleanup_project.py --dry-run

# Execute cleanup
python src/tools/cleanup_project.py

# Review cleanup log
cat security_logs/cleanup_*.log
```

---

## 🎯 Specific Use Cases

### **Use Case 1: Find Unused Files**
```bash
# Use the Project File Analyzer to identify:
# - Untracked files
# - Duplicate files
# - Old backup files
# - Temporary files

# Then use the cleanup script to remove them
python src/tools/cleanup_project.py
```

### **Use Case 2: Reduce Technical Debt**
```bash
# Run Technical Debt Analyzer via dashboard
# Focus on high-debt categories:
# - Code complexity
# - Code duplication
# - Missing documentation

# Follow the remediation recommendations
# Track progress in the dashboard
```

### **Use Case 3: Security Cleanup**
```bash
# Run security monitor
python security_monitor.py

# Review the generated reports
cat security_reports/security_report_*.json

# Address critical issues:
# - Remove hardcoded API keys
# - Clean up test credentials
# - Remove sample credit cards
```

### **Use Case 4: Archive Old Data**
```bash
# The archive_cleanup/ directory contains scripts for:
# - File analysis and archiving
# - Technical debt assessment
# - Security scanning of archives

# Review archived files
ls archive_cleanup/

# Remove old archives if needed
# (Use caution - review before deletion)
```

---

## 📈 Monitoring & Reporting

### **Generated Reports:**
- **Technical Debt Reports:** JSON format with remediation recommendations
- **Security Reports:** Detailed vulnerability findings
- **File Analysis Reports:** Untracked files and suggestions
- **Cleanup Logs:** Detailed cleanup operation logs

### **Report Locations:**
- Technical debt: Dashboard + JSON exports
- Security: `security_reports/` directory
- File analysis: Dashboard + ProjectFileAnalyzer output
- Cleanup: `security_logs/` directory

---

## 🔧 Configuration Files

### **Security Monitor Config:**
```json
{
  "monitoring_config": {
    "scan_frequency": "6h",
    "alert_thresholds": {
      "critical": 1,
      "high": 5
    },
    "exclusions": {
      "directories": [".git", "node_modules"],
      "files": ["*.min.js", "*.min.css"]
    }
  }
}
```

### **Technical Debt Thresholds:**
```javascript
debtThresholds: {
    codeComplexity: { low: 10, medium: 20, high: 30 },
    codeDuplication: { low: 3, medium: 7, high: 15 },
    testCoverage: { low: 80, medium: 60, high: 40 }
}
```

---

## 🛡️ Safety Features

### **Cleanup Script Safety:**
- **Dry-run mode** to preview changes
- **Age-based deletion** (only files older than 7 days)
- **Error handling** with logging
- **Selective patterns** to avoid accidental deletion
- **Configuration file protection**

### **Security Monitor Safety:**
- **Pattern-based detection** (no false positives)
- **Configurable exclusions** for known safe files
- **Threshold-based alerting** to avoid noise
- **Detailed logging** of all findings

---

## 📞 Troubleshooting

### **Issue: Dashboard not loading**
```bash
# Check server status
curl http://localhost:56742

# Restart server
node dashboard-server.js
```

### **Issue: Cleanup script removing too much**
```bash
# Use dry-run mode first
python src/tools/cleanup_project.py --dry-run

# Check the log file
cat security_logs/cleanup_*.log
```

### **Issue: Security monitor false positives**
```bash
# Update exclusions in security_monitor_config.json
# Add safe patterns to the exclusions list
```

---

## 🚦 Best Practices

1. **Always use dry-run mode first** with cleanup scripts
2. **Review security reports** before taking action
3. **Backup important data** before major cleanup
4. **Schedule regular scans** (weekly recommended)
5. **Track technical debt trends** over time
6. **Prioritize critical security issues** first
7. **Document cleanup decisions** for future reference

---

## 📚 Additional Resources

### **Documentation Files:**
- `CRITICAL_SECURITY_REMEDIATION_PLAN.md` - Security fix roadmap
- `CRITICAL_FILES_INVESTIGATION_REPORT.md` - Detailed file analysis
- `TECHNICAL_DEBT_FIX_REPORT.md` - Technical debt remediation
- `SECURITY_TECHNICAL_DEBT_IMPROVEMENT_SUMMARY.md` - Combined analysis

### **Archived Analysis:**
- `archive/` - Historical analysis reports
- `archive_cleanup/` - Archived cleanup scripts
- `docs/` - Additional documentation and guides

---

## 🎯 Quick Reference

| Tool | Location | Purpose | Command |
|------|----------|---------|---------|
| Technical Debt Analyzer | `src/components/core/TechnicalDebtAnalyzer.js` | Code quality analysis | Dashboard integration |
| Project File Analyzer | `src/components/core/ProjectFileAnalyzer.js` | File structure analysis | Dashboard integration |
| Cleanup Script | `src/tools/cleanup_project.py` | File cleanup | `python src/tools/cleanup_project.py` |
| Security Monitor | `security_monitor.py` | Security scanning | `python security_monitor.py` |
| Mock Data Scanner | `web/mock_data_scanner.js` | Mock data detection | Dashboard integration |

---

**Next Steps:**
1. Start the dashboard: `node dashboard-server.js`
2. Navigate to `http://localhost:56742`
3. Explore the Code Analysis and Security Scan sections
4. Run the cleanup script in dry-run mode
5. Review generated reports and recommendations

**Dashboard URL:** http://localhost:56742  
**Server Status:** Currently running on port 56742 ✅