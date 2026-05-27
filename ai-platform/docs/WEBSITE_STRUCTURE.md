# AI Coding Intelligence Dashboard - Website Structure

## Overview
This is the AI Coding Intelligence Dashboard - a comprehensive web-based tool for analyzing code quality, generating development checklists, and providing AI-powered insights for software projects.

## Core Structure

### Main Entry Point
- **index.html** - Main dashboard entry point with navigation and core functionality

### Essential Directories

#### `/dashboard_components/`
Core modular components for the dashboard:
- **core/** - Core JavaScript modules
  - `DataEngine.js` - Centralized data management and caching
  - `AiBridgeSimple.js` - AI analysis integration
  - `PerformanceOptimizer.js` - Performance optimization
  - `KeyboardShortcuts.js` - Keyboard navigation
  - `DarkMode.js` - Dark mode functionality
  - `ResponsiveDesign.js` - Responsive design utilities
- **Tab Components** - Individual tab HTML files
  - `dir-analysis-tab.html` - Directory analysis functionality
  - `overview-tab.html` - Overview dashboard
  - `analysis-tab.html` - Code analysis tools
  - `exports-tab.html` - Export functionality
  - etc.

#### `/css/`
- **dashboard.css** - Main stylesheet for the dashboard

#### `/api/`
Python API server for code analysis:
- **simple_server.py** - Main API server
- Provides endpoints for project analysis, code quality metrics, etc.

#### `/__tests__/`
Test files:
- `AiBridgeSimple.test.js`
- `DataEngine.test.js`
- `logger.test.js`
- `performance-monitor.test.js`
- `dashboard.test.js`
- `api-integration.test.js`

#### `/tests/`
Additional test files and integration tests

### Essential JavaScript Files
- **logger.js** - Structured logging
- **performance-monitor.js** - Performance monitoring
- **error-tracking.js** - Error tracking
- **clear-cache.js** - Cache clearing utility

### Configuration Files
- **package.json** - Node.js dependencies
- **jest.config.js** - Jest testing configuration
- **.eslintrc** - ESLint linting rules
- **.prettierrc** - Prettier formatting rules
- **pyproject.toml** - Python project configuration
- **pytest.ini** - Pytest configuration

### Documentation
- **README.md** - Project overview and setup
- **ARCHITECTURE.md** - System architecture documentation
- **CONTRIBUTING.md** - Developer contribution guidelines

### CI/CD
- **/.github/workflows/ci-cd.yml** - CI/CD pipeline configuration

### Deployment
- **deploy.sh** - Deployment script

## Getting Started

### Prerequisites
- Node.js and npm
- Python 3.8+
- Modern web browser

### Installation
1. Install dependencies:
```bash
npm install
pip install -r requirements-quality.txt
```

2. Start the API server:
```bash
python api/simple_server.py
```

3. Start the web server:
```bash
python -m http.server 8000
```

4. Open in browser:
```
http://localhost:8000/index.html
```

## Features

### Dashboard Tabs
- **Overview** - System status and performance metrics
- **Analysis** - Code analysis tools
- **Directory** - File browser and directory explorer
- **Exports** - Export reports in multiple formats
- **AI Analysis** - AI-powered insights
- **Analytics** - Comprehensive analytics dashboard
- **Predictions** - Predictive analytics
- **Realtime** - Real-time monitoring
- **Scheduling** - Automated analysis scheduling
- **DIR Analysis** - Deep directory analysis
- **AI Code** - AI code analysis
- **Executive** - Executive summary

### Key Functionality
- Real-time code quality analysis
- Automated checklist generation
- Multi-format report export (Markdown, PDF, Excel)
- Dark mode support
- Keyboard shortcuts
- Responsive design
- Performance monitoring
- Error tracking
- Structured logging

## Development

### Running Tests
```bash
# JavaScript tests
npm test

# Python tests
pytest
```

### Building for Production
```bash
# Build assets
npm run build

# Deploy
./deploy.sh
```

## File Cleanup Notes

### Files to Keep (Essential)
- index.html (main entry point)
- dashboard_components/ (core components)
- css/dashboard.css (main stylesheet)
- api/ (API server)
- __tests__/ (test files)
- logger.js, performance-monitor.js, error-tracking.js (utilities)
- clear-cache.js (cache utility)
- Configuration files (.eslintrc, .prettierrc, jest.config.js, etc.)
- Documentation (README.md, ARCHITECTURE.md, CONTRIBUTING.md)
- package.json, pyproject.toml (dependency files)

### Files to Archive/Remove (Duplicates/Backups)
- dashboard.html (redirect page, can be removed)
- dashboard_new.html, dashboard_direct.html, dashboard_direct_fixed.html (duplicates)
- dashboard_final_corrected.html, dashboard_corrected_final.html (duplicates)
- dashboard_old.html, dashboard_working.html, dashboard_simple.html (backups)
- enhanced_dashboard_fixed.html, enhanced_dashboard_optimized.html (duplicates)
- dashboard.backup_manual.html (backup)
- final_100_complete.html (celebration page, can be archived)
- see_100_complete.html (duplicate celebration page)
- force_refresh.html, refresh_dashboard.html (utility pages)
- test-buttons.html, test_buttons.html (test pages)
- update_next_steps.html (utility page)
- Various .md response files (temporary analysis outputs)
- JSON plan files (temporary planning files)
- Archive directory (can be cleaned)

## API Endpoints

The Python API server provides the following endpoints:

- `GET /api/health` - Health check
- `GET /api/project/overview` - Project overview
- `GET /api/code-structure` - Code structure analysis
- `GET /api/file-structure` - File structure
- `GET /api/analysis/quality` - Code quality analysis
- `GET /api/analysis/technical-debt` - Technical debt analysis
- `GET /api/recommendations` - AI recommendations
- `POST /api/ai-recommendations` - Get AI-powered recommendations

## Support

For issues or questions, refer to:
- CONTRIBUTING.md for development guidelines
- ARCHITECTURE.md for system architecture
- README.md for general information
