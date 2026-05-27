# 🚀 Installation Guide

**Version**: 1.1.0  
**Last Updated**: 2026-05-21

---

## 📋 Prerequisites

### **🔧 System Requirements**
- **Node.js**: Version 14.0 or higher
- **npm**: Version 6.0 or higher
- **Git**: Version 2.0 or higher

### **🌐 Operating Systems**
- **Windows**: Windows 10 or higher
- **macOS**: macOS 10.15 or higher
- **Linux**: Ubuntu 18.04 or higher

---

## 📦 Installation Steps

### **🚀 Quick Install**

#### **1. Clone the Repository**
```bash
git clone https://github.com/ai-platform/ai-platform.git
cd ai-platform
```

#### **2. Install Dependencies**
```bash
npm install
```

#### **3. Start the Server**
```bash
npm start
```

#### **4. Access the Platform**
- **Main Dashboard**: http://localhost:3003
- **AI Dashboard**: http://localhost:3003/ai_dashboard.html

---

## 🔧 Detailed Installation

### **📥 Step 1: Clone Repository**
```bash
# Clone the repository
git clone https://github.com/ai-platform/ai-platform.git

# Navigate to the project directory
cd ai-platform

# Verify the structure
ls -la
```

### **📦 Step 2: Install Dependencies**
```bash
# Install all required packages
npm install

# Verify installation
npm list --depth=0
```

### **🔧 Step 3: Environment Configuration**
```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

#### **Environment Variables**
```bash
# Server Configuration
PORT=3003
NODE_ENV=development

# Security Configuration
CORS_ORIGIN=http://localhost:3000
SESSION_SECRET=your-secret-key-here

# Database Configuration (if applicable)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_platform
DB_USER=ai_platform
DB_PASSWORD=your-password-here
```

### **🚀 Step 4: Start the Server**
```bash
# Development server
npm start

# Or start with custom port
PORT=8080 npm start

# Or run in development mode
npm run dev
```

### **🌐 Step 5: Verify Installation**
```bash
# Test server health
curl http://localhost:3003/api/health

# Test security status
curl http://localhost:3003/api/security/status

# Test AI dashboard
curl http://localhost:3003/ai_dashboard.html
```

---

## 🛠️ Troubleshooting

### **❌ Common Issues**

#### **Port Already in Use**
```bash
# Error: Error: listen EADDRINUSE :::3003
# Solution: Use different port or kill existing process
PORT=3004 npm start
# or
taskkill /F /IM node.exe  # Windows
killall node  # macOS/Linux
```

#### **Module Not Found**
```bash
# Error: Cannot find module 'dotenv'
# Solution: Install missing dependencies
npm install

# Clean install (if issues persist)
rm -rf node_modules package-lock.json
npm install
```

#### **Permission Denied**
```bash
# Error: EACCES: permission denied
# Solution: Check file permissions
chmod +x scripts/*.sh  # Linux/macOS
# Run with elevated permissions
sudo npm start  # Linux/macOS
```

#### **Build Errors**
```bash
# Error: Build failed
# Solution: Clean and rebuild
npm run clean
npm run build
```

---

## 🔧 Development Setup

### **📱 Development Tools**
```bash
# Install development dependencies
npm install --save-dev

# Available scripts
npm run dev          # Development server
npm run build        # Production build
npm run test         # Run tests
npm run lint         # Lint code
npm run format       # Format code
npm run security:scan # Security scan
```

### **🧪 Code Editors**
- **VS Code**: Recommended with extensions
- **WebStorm**: Full IDE support
- **Sublime Text**: Lightweight option
- **Vim**: Terminal-based option

### **🔧 VS Code Extensions**
```json
{
  "recommendations": [
    "ms-vscode.vscode-eslint",
    "ms-vscode.vscode-prettier",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json"
  ]
}
```

---

## 🐳 Docker Installation (Optional)

### **📦 Docker Setup**
```bash
# Build Docker image
docker build -t ai-platform .

# Run with Docker
docker run -p 3003:3003 ai-platform

# Or with docker-compose
docker-compose up
```

### **📋 Dockerfile**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3003

CMD ["npm", "start"]
```

---

## 🚀 Production Deployment

### **🌐 Production Server Setup**
```bash
# Set production environment
export NODE_ENV=production

# Install production dependencies
npm ci --only=production

# Build for production
npm run build

# Start production server
npm start
```

### **🔧 Environment Variables**
```bash
# Production configuration
NODE_ENV=production
PORT=3003
CORS_ORIGIN=https://yourdomain.com
SESSION_SECRET=production-secret-key
```

### **🛡️ Security Considerations**
- Use HTTPS in production
- Set strong session secrets
- Enable rate limiting
- Configure CORS properly
- Use environment variables for secrets

---

## 📊 Verification

### **✅ Installation Verification**
```bash
# Test all endpoints
curl http://localhost:3003/api/health
curl http://localhost:3003/api/security/status
curl http://localhost:3003/ai_dashboard.html

# Check logs
npm logs

# Verify security score
npm run security:scan
```

### **🎯 Expected Results**
- **Server Status**: ✅ Running
- **Security Score**: ✅ 100/100
- **Dashboard**: ✅ Loading
- **API Endpoints**: ✅ Responding

---

## 📞 Getting Help

### **📚 Documentation**
- [User Manual](./user-manual.md)
- [API Reference](./api-reference.md)
- [Troubleshooting](./troubleshooting.md)
- [Architecture Overview](./architecture.md)

### **💬 Community Support**
- **GitHub Issues**: [Report problems](https://github.com/ai-platform/issues)
- **Discord Community**: [Join discussions](https://discord.gg/ai-platform)
- **Email Support**: support@ai-platform.com

---

## 🔄 Next Steps

After successful installation:

1. **📖 Read the User Manual**: Learn basic usage
2. **🔧 Explore the API**: Check API documentation
3. **🛡️ Configure Security**: Set up production security
4. **📊 Monitor Performance**: Set up monitoring
5. **🚀 Deploy**: Deploy to production

---

**Last Updated**: 2026-05-21 07:55:00  
**Version**: 1.1.0  
**Next Review**: 2026-05-28
