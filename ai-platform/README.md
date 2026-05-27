# 🚀 Cascade AI Platform

Unified AI Platform for comprehensive project analysis, automation, and development.

## 📋 Overview

The Cascade AI Platform is a consolidated system that brings together all the essential tools and services for AI-powered project management, code analysis, and automated development workflows.

## 🏗️ Project Structure

```
ai-platform/
├── 📁 src/
│   ├── 🤖 ai-system/           # AI engine and analysis tools
│   ├── 🌐 web/                 # Web frontend and UI components
│   └── 🖥️ server/              # Backend API and services
├── 📁 tools/                   # Development and analysis tools
├── 📁 scripts/                 # Build and utility scripts
├── 📁 tests/                   # Test suites
├── 📁 docs/                    # Documentation
├── 📁 config/                  # Configuration files
└── 📄 package.json            # Dependencies and scripts
```

## 🚀 Quick Start

### Prerequisites
- Node.js >= 16.0.0
- Python >= 3.8 (for AI tools)
- npm >= 8.0.0

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd ai-platform

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your settings (legacy FastAPI/docker keys: see config/README.md)

# Start the platform
npm start
```

### Development

```bash
# Development mode with hot reload
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Lint code
npm run lint
```

## 🔧 Features

### 🤖 AI System
- **Code Analysis**: Automated code quality assessment
- **Project Intelligence**: Smart project structure analysis
- **Automated Testing**: AI-powered test generation
- **Code Optimization**: Intelligent code refactoring suggestions

### 🌐 Web Interface
- **Unified Dashboard**: Single interface for all operations
- **Real-time Monitoring**: Live project status and metrics
- **Interactive Components**: Responsive UI components
- **Data Visualization**: Comprehensive charts and graphs

### 🖥️ Backend Services
- **RESTful API**: Comprehensive API endpoints
- **WebSocket Support**: Real-time communication
- **Authentication**: Secure user management
- **Database Integration**: Persistent data storage

### 🛠️ Development Tools
- **Code Quality Tools**: Automated code analysis
- **Build System**: Unified build and deployment
- **Testing Framework**: Comprehensive test suite
- **Documentation**: Auto-generated API docs

## 📊 Configuration

### Environment Variables

Key environment variables in `.env` (copy from `.env.example`):

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost/dbname

# AI Services
AI_API_KEY=your-ai-api-key
AI_MODEL=gpt-4

# Security
JWT_SECRET=your-jwt-secret
CORS_ORIGIN=http://localhost:3000
```

### Configuration Files

- `.env.example` / `.env` — Environment variables (canonical)
- `config/README.md` — Legacy config folder map
- `config/docker-compose.yml` — Docker configuration
- `config/dashboard_config.json` - Dashboard settings

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --testPathPattern=ai-system

# Generate coverage report
npm test -- --coverage
```

## 📚 Documentation

- **API Documentation**: Available at `/docs/api.md`
- **Development Guide**: Available at `/docs/DEVELOPMENT.md`
- **Deployment Guide**: Available at `/docs/DEPLOYMENT.md`

## 🚀 Deployment

### Docker Deployment

```bash
# Build Docker image
docker build -t cascade-ai-platform .

# Run with Docker Compose
docker-compose up -d
```

### Production Deployment

```bash
# Build for production
npm run build

# Start production server
NODE_ENV=production npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation at `/docs`
- Review the FAQ at `/docs/FAQ.md`

## 🔄 Version History

- **v1.0.0** - Initial consolidated platform release
- **v0.9.0** - Nuclear cleanup and consolidation
- **v0.8.0** - Aggressive merger and reduction
- **v0.7.0** - Comprehensive merger implementation

---

*Built with ❤️ by the Cascade AI Platform Team*
