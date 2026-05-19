# AI Coding Intelligence Dashboard

## Overview

This project provides a comprehensive real-time code analysis dashboard that converts mock data to genuine project insights. The dashboard analyzes actual codebase structure, provides quality metrics, and generates professional reports.

## Features

### 🚀 Real-Time Analysis
- **Live Project Analysis**: Analyzes 7,780+ files in real-time
- **Multiple API Endpoints**: 7 comprehensive analysis endpoints
- **Smart Caching**: 5-minute cache intervals for optimal performance
- **Batch Processing**: Intelligent request queuing system

### 📊 Comprehensive Metrics
- **Code Quality Analysis**: Real quality scoring based on actual code
- **Technical Debt Assessment**: Calculated from code complexity
- **File Structure Analysis**: Directory depth and organization metrics
- **Technology Stack Detection**: Automatic language and framework identification

### 📈 Professional Reporting
- **Multiple Export Formats**: PDF, Excel, and Markdown reports
- **Executive Summaries**: High-level business insights
- **Real-time Analytics**: Live project metrics and trends
- **Customizable Reports**: Professional formatting with timestamps

### 🎯 Interactive Dashboard
- **Multi-Tab Interface**: Overview, Analytics, Predictions, Real-time, Scheduling
- **Advanced Visualizations**: Chart.js integration with real data
- **Responsive Design**: Modern UI with smooth transitions
- **Export Capabilities**: One-click report generation

## Architecture

### Backend API Server
- **Location**: `web/api/simple_server.py`
- **Port**: 8081
- **Endpoints**: 7 comprehensive analysis endpoints
- **Technology**: Python with Flask-like architecture

### Frontend Dashboard
- **Location**: `web/dashboard_new.html`
- **Port**: 8080
- **Technology**: HTML5, CSS3, JavaScript with Chart.js
- **Features**: Real-time data integration, professional UI

### Data Flow
1. **API Server** analyzes project structure
2. **Frontend Dashboard** consumes real API data
3. **Caching Layer** optimizes performance
4. **Export System** generates professional reports

## Quick Start

### Prerequisites
- Python 3.7+
- Node.js 14+
- Modern web browser
- npm or yarn package manager

### Installation

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start the API Server**:
   ```bash
   cd web/api
   python simple_server.py
   ```

4. **Access the Dashboard**:
   ```
   http://localhost:8080/dashboard_new.html
   ```

### Development Setup

1. **Code Quality Tools**:
   ```bash
   # Lint and fix code
   npm run lint
   
   # Format code
   npm run format
   
   # Run tests
   npm test
   
   # Run test coverage
   npm run test:coverage
   ```

2. **Pre-commit Hooks**:
   ```bash
   # Install husky for pre-commit hooks
   npm run prepare
   ```

### Usage

1. **Analyze Current Directory**: Click "Analyze Current" for real-time analysis
2. **Select Custom Directory**: Use "Select Directory" for specific analysis
3. **Generate Reports**: Choose from PDF, Excel, or Markdown formats
4. **View Analytics**: Explore multi-tab interface with real data

## API Endpoints

### Project Analysis
- `GET /api/project/overview` - High-level project metrics
- `GET /api/file-structure` - File and directory analysis
- `GET /api/code-structure` - Code organization and patterns

### Quality Assessment
- `GET /api/analysis/quality` - Code quality metrics
- `GET /api/analysis/technical-debt` - Technical debt analysis
- `GET /api/recommendations` - AI-powered recommendations

### Health Check
- `GET /api/health` - API server status

## Configuration

### Environment Variables
Copy `.env.example` to `.env` and configure:
- `API_HOST` - API server host (default: localhost)
- `API_PORT` - API server port (default: 8081)
- `NODE_ENV` - Environment (development/production)
- `ENABLE_AI_ANALYSIS` - Enable AI features (default: true)
- See `.env.example` for all available options

### API Server Settings
- **Cache Timeout**: 5 minutes
- **Batch Size**: 3 concurrent requests
- **Response Timeout**: 30 seconds

### Dashboard Settings
- **Auto-refresh**: 5-minute intervals
- **Chart Updates**: Real-time data visualization
- **Export Formats**: PDF, Excel, Markdown

### Code Quality Configuration
- **ESLint**: Configured in `.eslintrc.json`
- **Prettier**: Configured in `.prettierrc.json`
- **Jest**: Configured in `jest.config.js`
- **Pre-commit**: Configured in `package.json` (lint-staged)

## Development

### Code Quality & Testing

This project includes comprehensive code quality tools and testing infrastructure:

#### **Linting & Formatting**
- **ESLint**: Code quality and style enforcement (configured in `.eslintrc.json`)
- **Prettier**: Consistent code formatting (configured in `.prettierrc.json`)
- **Pre-commit Hooks**: Automated quality checks via Husky
- **Lint-staged**: Runs linting on staged files only

#### **Testing Framework**
- **Jest**: Unit and integration testing
- **Coverage**: 70% minimum coverage threshold
- **Test Environment**: jsdom for DOM testing
- **Configuration**: `jest.config.js`

#### **Development Scripts**
```bash
# Code quality
npm run lint          # Lint and fix code
npm run lint:check    # Check linting without fixing
npm run format        # Format code with Prettier
npm run format:check  # Check formatting without fixing

# Testing
npm test              # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report

# Validation
npm run validate      # Run linting, formatting, and tests
npm run build         # Full validation pipeline
```

### Project Structure
```
├── .eslintrc.json         # ESLint configuration
├── .prettierrc.json       # Prettier configuration
├── .env.example           # Environment variables template
├── .gitignore             # Git ignore patterns
├── jest.config.js         # Jest testing configuration
├── package.json           # Root dependencies and scripts
├── CONTRIBUTING.md        # Contribution guidelines
├── tests/                 # Test files
│   ├── setup.js          # Test environment setup
│   ├── DataEngine.test.js # DataEngine tests
│   └── AiBridgeSimple.test.js # AiBridgeSimple tests
├── web/
│   ├── package.json      # Web-specific dependencies
│   ├── .pre-commit-config.yaml # Python pre-commit hooks
│   ├── CONTRIBUTING.md    # Detailed web development guide
│   ├── api/               # Backend API server
│   │   ├── simple_server.py    # Main API server
│   │   ├── code_analysis.py    # Code analysis logic
│   │   └── server.py           # Alternative server
│   ├── dashboard_components/    # Frontend components
│   │   ├── api-client.js       # API integration
│   │   ├── real-data-loader.js # Data loading logic
│   │   ├── real-data-init.js   # Dashboard initialization
│   │   └── core/               # Core functionality
│   │       ├── DataEngine.js   # Data management
│   │       └── AiBridgeSimple.js # AI analysis
│   ├── css/               # Stylesheets
│   ├── data/              # Mock data (legacy)
│   └── dashboard_new.html # Main dashboard
├── src/                   # Python source code
├── tools/                 # Utility scripts
└── README.md             # Project documentation
```

### Adding New Features

1. **API Endpoints**: Add to `simple_server.py`
2. **Frontend Components**: Add to `dashboard_components/`
3. **Export Formats**: Extend `real-data-loader.js`
4. **Analytics**: Add to dashboard HTML

## Performance

### Metrics
- **API Response Time**: 285ms-1600ms
- **Cache Hit Rate**: High (5-minute intervals)
- **Concurrent Requests**: Limited to 3
- **Memory Usage**: Optimized for large projects

### Optimization Features
- **Request Batching**: Intelligent queuing system
- **Smart Caching**: Automatic invalidation
- **Background Processing**: Non-blocking operations
- **Progressive Loading**: Step-by-step data loading

## Security

### Current Implementation
- **Local Development**: No external dependencies
- **Data Privacy**: No data transmission to external services
- **File Access**: Limited to project directory
- **API Security**: Basic error handling and validation

### Recommendations
- Add authentication for production deployment
- Implement rate limiting for API endpoints
- Add HTTPS support for secure communication
- Validate file access permissions

## Troubleshooting

### Common Issues

1. **API Server Not Responding**:
   - Check if server is running on port 8081
   - Verify Python dependencies are installed
   - Check console for error messages

2. **Dashboard Not Loading**:
   - Ensure API server is accessible
   - Check browser console for JavaScript errors
   - Verify dashboard_new.html exists

3. **Export Not Working**:
   - Check browser popup settings
   - Verify data has been analyzed first
   - Try different export formats

### Debug Mode
Enable console logging for detailed debugging:
```javascript
console.log('Debug mode enabled');
```

## Contributing

For detailed contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md) and [web/CONTRIBUTING.md](web/CONTRIBUTING.md).

### Quick Start
1. Fork the repository
2. Create feature branch
3. Configure environment: `cp .env.example .env`
4. Implement changes
5. Run quality checks: `npm run lint` and `npm test`
6. Submit pull request

### Code Standards
- Follow existing code patterns
- Add comprehensive error handling
- Include console logging for debugging
- Maintain responsive design principles
- Use conventional commit messages
- Ensure all tests pass before submitting

## License

This project is open-source and available under the MIT License.

## Support

For issues and questions:
- Check the troubleshooting section
- Review the API documentation
- Examine the browser console for errors
- Verify API server status

---

*Last Updated: 5/16/2026*
*Version: 2.0 - Real Data Integration Complete*
