# Developer Guide for AI Coding Intelligence Dashboard

## 🚀 Welcome

Welcome to the AI Coding Intelligence Dashboard! This guide will help you get started with development, understand the project structure, and contribute effectively to the codebase.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Getting Started](#getting-started)
3. [Project Structure](#project-structure)
4. [Development Workflow](#development-workflow)
5. [Code Standards](#code-standards)
6. [Testing](#testing)
7. [Deployment](#deployment)
8. [Troubleshooting](#troubleshooting)
9. [Contributing](#contributing)

## 🔧 Prerequisites

### Required Software
- **Node.js**: Version 16.0.0 or higher
- **Python**: Version 3.8.0 or higher
- **Git**: For version control
- **Modern Browser**: Chrome, Firefox, Safari, or Edge

### Development Tools
- **ESLint**: Code quality enforcement
- **Prettier**: Code formatting
- **Jest**: Testing framework
- **VS Code** (recommended): IDE with extensions

### IDE Setup (VS Code)
Install these recommended extensions:
```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-jest",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml"
  ]
}
```

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/ai-coding-dashboard.git
cd ai-coding-dashboard
```

### 2. Install Dependencies
```bash
# Install Node.js dependencies
cd web
npm install

# Install Python dependencies (if needed)
cd api
pip install -r requirements.txt
```

### 3. Start Development Servers
```bash
# Start API server (port 8081)
cd web/api
python simple_server.py

# Start frontend server (port 57220)
cd web
python -m http.server 57220 --directory web
```

### 4. Access the Dashboard
Open your browser and navigate to:
- **Main Dashboard**: http://localhost:57220/dashboard_direct.html
- **API Health Check**: http://localhost:8081/api/health
- **API Documentation**: http://localhost:8081/api/project/overview

## 📁 Project Structure

```
ai-coding-dashboard/
├── web/                          # Frontend application
│   ├── dashboard_direct.html      # Main dashboard file
│   ├── dashboard_new.html          # Alternative dashboard
│   ├── dashboard.html              # Original dashboard
│   ├── api/                       # API server
│   │   ├── simple_server.py       # Main API server
│   │   ├── health_check.py        # Health monitoring
│   │   └── performance_monitor.py # Performance tracking
│   ├── dashboard_components/       # Dashboard components
│   │   ├── core/                  # Core functionality
│   │   ├── api-client/            # API client code
│   │   └── real-data-loader/       # Data loading
│   ├── css/                       # Stylesheets
│   ├── tests/                     # Test files
│   │   ├── integration/          # Integration tests
│   │   └── unit/               # Unit tests
│   ├── config/                    # Configuration files
│   │   ├── logging.json           # Logging configuration
│   └── scripts/                   # Utility scripts
│       ├── deploy.sh            # Deployment script
│       ├── post-deploy.sh      # Post-deployment tasks
│       └── rollback.sh          # Rollback script
├── docs/                          # Documentation
│   ├── API_DOCUMENTATION.md     # API reference
│   ├── DEPLOYMENT_GUIDE.md      # Deployment instructions
│   └── DEVELOPER_GUIDE.md        # This guide
├── config/                        # Environment configs
│   ├── .env.production           # Production environment
│   └── .env.staging            # Staging environment
├── .github/                       # GitHub Actions
│   └── workflows/
│       └── ci-cd-pipeline.yml    # CI/CD pipeline
└── scripts/                       # Project scripts
    ├── deploy.sh                # Deployment script
    ├── post-deploy.sh           # Post-deployment tasks
    └── rollback.sh              # Rollback script
```

## 🔄 Development Workflow

### 1. Feature Development Flow
```bash
1. Create a feature branch
   git checkout -b feature/new-feature

2. Make your changes
   # Edit files in web/dashboard_components/
   # Add tests in web/tests/

3. Run tests and linting
   npm test
   npm run lint

4. Commit changes
   git add .
   git commit -m "feat: Add new feature"

5. Push and create PR
   git push origin feature/new-feature
   # Create Pull Request on GitHub
```

### 2. Code Review Process
- **Self-Review**: Review your own code before submitting
- **Peer Review**: Team members review your changes
- **Automated Checks**: CI/CD pipeline runs tests and linting
- **Approval**: Get approval before merging

### 3. Merge Process
- **Rebase**: Keep your branch up-to-date with main
- **Resolve Conflicts**: Address any merge conflicts
- **Merge**: Merge to main branch
- **Deploy**: Automatic deployment on merge to main

## 📏 Code Standards

### JavaScript/TypeScript Standards

#### ESLint Configuration
Follow the ESLint rules defined in `.eslintrc.js`:
```javascript
{
  "extends": ["eslint:recommended"],
  "rules": {
    "no-unused-vars": "error",
    "no-console": "warn",
    "prefer-const": "error",
    "arrow-spacing": "error"
  }
}
```

#### Prettier Configuration
Follow the Prettier rules defined in `.prettierrc`:
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "tabWidth": 2,
  "printWidth": 80
}
```

#### Code Style Guidelines
- **Variable Naming**: Use camelCase for variables and functions
- **Constants**: Use UPPER_SNAKE_CASE for constants
- **File Naming**: Use kebab-case for files
- **Component Names**: Use PascalCase for React components
- **Comments**: Add JSDoc comments for functions and classes

#### Example Code Structure
```javascript
/**
 * Component for displaying project metrics
 * @param {Object} metrics - Project metrics data
 * @returns {JSX.Element} Rendered component
 */
const MetricsDisplay = ({ metrics }) => {
  const { totalFiles, codeQuality, testCoverage } = metrics;
  
  return (
    <div className="metrics-container">
      <h2>Project Metrics</h2>
      <div className="metric">
        <span className="label">Total Files:</span>
        <span className="value">{totalFiles.toLocaleString()}</span>
      </div>
      <div className="metric">
        <span className="label">Code Quality:</span>
        <span className="value">{codeQuality}%</span>
      </div>
      <div className="metric">
        <span className="label">Test Coverage:</span>
        <span className="value">{testCoverage}%</span>
      </div>
    </div>
  );
};

export default MetricsDisplay;
```

### Python Standards

#### Code Style
- **Indentation**: 4 spaces
- **Line Length**: Maximum 88 characters
- **Import Order**: Standard library, third-party, local modules
- **Docstrings**: Use triple quotes for docstrings

#### Example Structure
```python
"""Utility functions for project analysis.

This module provides various functions for analyzing project structure,
code quality, and metrics.

Author: Your Name
"""

import os
import sys
from pathlib import Path

def analyze_project(project_path):
    """Analyze project structure and return metrics.
    
    Args:
        project_path (str): Path to the project directory
        
    Returns:
        dict: Project analysis results
    """
    # Implementation here
    return {
        'total_files': 0,
        'total_directories': 0,
        'code_quality': 0
    }
```

## 🧪 Testing

### Test Structure
```
tests/
├── integration/
│   └── dashboard.integration.test.js  # Integration tests
├── unit/
│   ├── api.test.js               # API unit tests
│   └── components.test.js        # Component tests
└── fixtures/
    ├── sample-data.json          # Test data
    └── mock-responses.json       # Mock API responses
```

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/integration/dashboard.integration.test.js
```

### Writing Tests

#### Unit Tests
```javascript
describe('MetricsDisplay', () => {
  it('should render project metrics correctly', () => {
    const mockMetrics = {
      totalFiles: 1000,
      codeQuality: 85,
      testCoverage: 75
    };
    
    render(<MetricsDisplay metrics={mockMetrics} />);
    
    expect(screen.getByText('Total Files:')).toBeInTheDocument();
    expect(screen.getByText('Code Quality: 85%')).toBeInTheDocument();
    expect(screen.getByText('Test Coverage: 75%')).toBeInTheDocument();
  });
});
```

#### Integration Tests
```javascript
describe('Dashboard Integration', () => {
  it('should load project data from API', async () => {
    // Mock fetch for testing
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          totalFiles: 7780,
          codeQuality: 82,
          testCoverage: 75
        })
      })
    );

    const { loadProjectData } = require('../dashboard_components/core/DataEngine');
    const data = await loadProjectData();
    
    expect(data.totalFiles).toBe(7780);
    expect(data.codeQuality).toBe(82);
  });
});
```

### Test Coverage
- **Target Coverage**: 80%+
- **Current Coverage**: ~75%
- **Coverage Reports**: Generated in `coverage/` directory

## 🚀 Deployment

### Development Deployment
```bash
# Deploy to development environment
npm run deploy:staging
```

### Production Deployment
```bash
# Deploy to production environment
npm run deploy:production
```

### Deployment Process
1. **Pre-Deployment Checks**
   ```bash
   npm run lint
   npm test
   npm run build:prod
   ```

2. **Deploy Application**
   ```bash
   npm run deploy
   ```

3. **Post-Deployment Verification**
   ```bash
   npm run health-check
   npm run post-deploy
   ```

### Environment Configuration
- **Development**: Use `.env.development`
- **Staging**: Use `.env.staging`
- **Production**: Use `.env.production`

### Rollback Process
```bash
# Rollback to previous version
npm run deploy:rollback

# List available backups
bash scripts/rollback.sh list

# Rollback to specific backup
bash scripts/rollback.sh specific backup-20231201-120000
```

## 🔧 Troubleshooting

### Common Issues

#### API Connection Issues
```bash
# Check API server status
curl -f http://localhost:8081/api/health

# Restart API server
cd web/api
python simple_server.py
```

#### Frontend Loading Issues
```bash
# Clear browser cache
# Press Ctrl+F5 or Cmd+R

# Check frontend server
python -m http.server 57220 --directory web
```

#### Build Errors
```bash
# Clean and rebuild
npm run clean
npm install
npm run build:prod
```

#### Test Failures
```bash
# Run tests with verbose output
npm test --verbose

# Update test snapshots
npm test --updateSnapshot
```

### Getting Help

- **Documentation**: Check `docs/` directory
- **API Reference**: See `docs/API_DOCUMENTATION.md`
- **Deployment Guide**: See `docs/DEPLOYMENT_GUIDE.md`
- **GitHub Issues**: Report issues on the repository

## 🤝 Contributing

### How to Contribute

1. **Fork the Repository**
   ```bash
   git clone https://github.com/your-username/ai-coding-dashboard.git
   cd ai-coding-dashboard
   git checkout -b feature/your-feature
   ```

2. **Make Changes**
   - Follow the code standards
   - Add tests for new features
   - Update documentation

3. **Submit Changes**
   ```bash
   git add .
   git commit -m "feat: Add your feature"
   git push origin feature/your-feature
   ```

4. **Create Pull Request**
   - Provide clear description
   - Link to relevant issues
   - Request review

### Pull Request Guidelines

- **Title**: Use clear, descriptive titles
- **Description**: Explain what changes you made and why
- **Testing**: Include tests for new features
- **Documentation**: Update relevant documentation
- **Review**: Request code review from team members

### Code Review Process

1. **Self-Review**: Review your own changes first
2. **Automated Checks**: Ensure CI/CD passes
3. **Peer Review**: Get review from team members
4. **Approval**: Get approval before merging

### Release Process

1. **Version Bump**: Update version in `package.json`
2. **Tag Release**: Create git tag
3. **Deploy**: Deploy to production
4. **Announce**: Share release notes

## 📚 Additional Resources

### Documentation
- [API Documentation](../docs/API_DOCUMENTATION.md)
- [Deployment Guide](../docs/DEPLOYMENT_GUIDE.md)
- [Architecture Documentation](../docs/ARCHITECTURE.md)

### Tools and Resources
- [Node.js Documentation](https://nodejs.org/docs/)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)
- [ESLint User Guide](https://eslint.org/docs/user-guide/)
- [Prettier Documentation](https://prettier.io/docs/)

### Community
- [GitHub Discussions](https://github.com/your-username/ai-coding-dashboard/discussions)
- [GitHub Issues](https://github.com/your-username/ai-coding-dashboard/issues)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/ai-coding-dashboard)

## 🎯 Best Practices

### Development Best Practices
- Write clean, readable code
- Add comprehensive tests
- Document your changes
- Follow the established code standards
- Keep dependencies up to date

### Security Best Practices
- Never commit sensitive data
- Use environment variables for secrets
- Regular security audits
- Follow OWASP guidelines
- Keep dependencies updated

### Performance Best Practices
- Optimize bundle size
- Implement caching strategies
- Monitor performance metrics
- Use lazy loading when appropriate
- Minimize API calls

## 📞 Getting Help

If you need help with any aspect of the project:

1. **Check Documentation**: Look in the `docs/` directory
2. **Search Issues**: Check existing GitHub issues
3. **Ask Questions**: Create a new discussion or issue
4. **Contact Team**: Reach out to maintainers

### Contact Information
- **Development Team**: dev-team@example.com
- **Support**: support@example.com
- **Security**: security@example.com

---

**Happy coding! 🎉**
