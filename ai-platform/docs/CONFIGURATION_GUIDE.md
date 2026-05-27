# Configuration Guide

This guide explains all configuration files in the AI Coding Intelligence Dashboard project.

## 📁 Configuration Files Overview

### ✅ Essential Configuration Files (All Present)

#### **High Priority**
- **`.gitignore`** - Specifies intentionally untracked files to ignore
- **`package.json`** - Project metadata and dependencies
- **`README.md`** - Project documentation
- **`.env.example`** - Template for environment variables

#### **Medium Priority**
- **`package-lock.json`** - Locked dependency versions
- **`.eslintrc`** - ESLint configuration for code linting
- **`.eslintrc.js`** - ESLint configuration (JavaScript format)
- **`.eslintrc.json`** - ESLint configuration (JSON format)
- **`.prettierrc`** - Prettier configuration for code formatting
- **`.prettierrc.json`** - Prettier configuration (JSON format)
- **`jest.config.js`** - Jest testing framework configuration
- **`LICENSE`** - Project license
- **`tsconfig.json`** - TypeScript configuration

#### **Low Priority**
- **`docker-compose.yml`** - Docker Compose configuration
- **`Dockerfile`** - Docker container configuration
- **`.dockerignore`** - Files to exclude from Docker builds
- **`webpack.config.js`** - Webpack bundler configuration
- **`vite.config.js`** - Vite build tool configuration
- **`.gitattributes`** - Git attributes for file handling
- **`CONTRIBUTING.md`** - Contribution guidelines
- **`.github/workflows/ci.yml`** - GitHub Actions CI/CD workflow

#### **Development Tools**
- **`.pre-commit-config.yaml`** - Pre-commit hooks configuration
- **`.lintstagedrc.json`** - Lint-staged configuration
- **`.husky/`** - Git hooks configuration directory

### ❌ Intentionally Missing
- **`.env`** - Environment variables (should not be committed)
- **`yarn.lock`** - Yarn lock file (not needed for npm)

## 🔧 Environment Setup

### 1. Local Development

```bash
# Copy the environment template
cp .env.template .env

# Edit the .env file with your local values
nano .env
```

### 2. Required Environment Variables

#### API Configuration
```env
API_HOST=localhost
API_PORT=8081
API_PROTOCOL=http
```

#### Dashboard Configuration
```env
DASHBOARD_HOST=localhost
DASHBOARD_PORT=8000
DASHBOARD_PROTOCOL=http
```

#### Feature Flags
```env
ENABLE_AI_ANALYSIS=true
ENABLE_DEPENDENCY_GRAPH=true
ENABLE_CODE_COMPLEXITY=true
ENABLE_SECURITY_SCAN=true
```

### 3. Development vs Production

#### Development (.env)
```env
NODE_ENV=development
DEBUG=false
VERBOSE_LOGGING=false
LOG_LEVEL=info
```

#### Production (.env)
```env
NODE_ENV=production
DEBUG=false
VERBOSE_LOGGING=false
LOG_LEVEL=warn
```

## 📋 Configuration File Details

### ESLint Configuration

#### `.eslintrc.js` (JavaScript Format)
```javascript
module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: ['eslint:recommended'],
  rules: {
    // Custom rules
  }
};
```

#### `.eslintrc.json` (JSON Format)
```json
{
  "env": {
    "browser": true,
    "es2021": true,
    "node": true
  },
  "extends": ["eslint:recommended"],
  "rules": {}
}
```

### Prettier Configuration

#### `.prettierrc` (YAML Format)
```yaml
semi: true
singleQuote: true
trailingComma: es5
tabWidth: 2
printWidth: 80
```

#### `.prettierrc.json` (JSON Format)
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2,
  "printWidth": 80
}
```

### Jest Configuration

#### `jest.config.js`
```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/tests/**/*.test.js'
  ],
  collectCoverageFrom: [
    'dashboard_components/**/*.js',
    'tests/**/*.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### TypeScript Configuration

#### `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": [
    "dashboard_components/**/*",
    "tests/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

## 🔧 Development Tools Configuration

### Pre-commit Hooks (`.pre-commit-config.yaml`)
```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.4.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
      - id: check-json
  - repo: local
    hooks:
      - id: lint-staged
        files: \.(js|jsx|ts|tsx|json|css|md|html|yaml)$
        language: system
        pass: npm run lint:staged
      - id: format-staged
        files: \.(js|jsx|ts|tsx|json|css|md|html|yaml)$
        language: system
        pass: npm run format:staged
```

### Lint-staged Configuration (`.lintstagedrc.json`)
```json
{
  "*.{js,jsx,ts,tsx}": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.{json,css,md,html,yml,yaml}": [
    "prettier --write"
  ]
}
```

## 🚀 Build Configuration

### Webpack (`webpack.config.js`)
```javascript
const path = require('path');

module.exports = {
  entry: './index.html',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      }
    ]
  },
  plugins: [
    // Webpack plugins
  ],
  devServer: {
    contentBase: './',
    port: 8000,
    hot: true
  }
};
```

### Vite (`vite.config.js`)
```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html'
    }
  },
  server: {
    port: 8000,
    hot: true
  },
  plugins: [
    // Vite plugins
  ]
});
```

## 📦 Package Management

### Dependencies (`package.json`)
```json
{
  "name": "ai-coding-dashboard",
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext .js,.jsx,.ts,.tsx",
    "lint:fix": "eslint . --ext .js,.jsx,.ts,.tsx --fix",
    "format": "prettier --write .",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "eslint": "^8.56.0",
    "prettier": "^3.1.1",
    "jest": "^29.7.0"
  }
}
```

## 🔒 Security Configuration

### Git Configuration (`.gitignore`)
```
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs
dist/
build/
*.tgz

# Environment files
.env
.env.local
.env.production

# Logs
logs/
*.log

# Cache
.cache/
.parcel-cache/
.eslintcache

# OS files
.DS_Store
Thumbs.db
```

### Docker Configuration (`.dockerignore`)
```
node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.git
.gitignore
README.md
.env
dist
```

## 🧪 Testing Configuration

### Jest Setup (`jest.setup.js`)
```javascript
import '@testing-library/jest-dom';

// Setup test environment
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:8000'
  },
  writable: true
});

// Mock chart.js for tests
jest.mock('chart.js', () => ({
  Chart: jest.fn(() => ({
    render: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn()
  }))
}));

// Global test utilities
global.testUtils = {
  createMockAnalysis: () => ({
    data: { total_files: 100, total_directories: 10 },
    analysis: { codeQuality: 85, testCoverage: 75 }
  })
};
```

## 📊 Monitoring Configuration

### Performance Monitoring
```javascript
// Enable performance monitoring
const performanceConfig = {
  enabled: true,
  metricsPort: 9090,
  healthCheckInterval: 30000,
  slowOperationThreshold: 1000
};
```

### Error Tracking
```javascript
// Error tracking configuration
const errorConfig = {
  enabled: true,
  logLevel: 'error',
  maxErrors: 100,
  reportToConsole: true
};
```

## 🔧 Customization Guide

### Adding New Configuration Files

1. **Create the configuration file** in the project root
2. **Update the ProjectFileAnalyzer** to include it in the check
3. **Add documentation** to this guide
4. **Update the importance level** if needed

### Modifying Existing Configuration

1. **Edit the configuration file** directly
2. **Test the changes** by running the relevant tools
3. **Update documentation** if behavior changes
4. **Commit the changes** to version control

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone <repository-url>
cd <project-directory>

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.template .env
# Edit .env with your values

# 4. Start development server
npm run dev

# 5. Run tests
npm test

# 6. Build for production
npm run build
```

## 📚 Additional Resources

- [ESLint Configuration Guide](https://eslint.org/docs/latest/user-guide/configuring/)
- [Prettier Configuration Options](https://prettier.io/docs/en/options.html)
- [Jest Configuration Documentation](https://jestjs.io/docs/configuration)
- [TypeScript Configuration](https://www.typescriptlang.org/docs/handbook/compiler-options.html)
- [Webpack Configuration](https://webpack.js.org/configuration/)
- [Vite Configuration](https://vitejs.dev/config/)

---

**Last Updated:** 2026-05-17  
**Version:** 1.0  
**Status:** Complete and Up-to-Date
