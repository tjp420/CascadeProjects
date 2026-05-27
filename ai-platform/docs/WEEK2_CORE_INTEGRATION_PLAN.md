# Week 2 Core Integration Plan
# Service Integration and API Gateway Implementation

## 🎯 **WEEK 2 OBJECTIVES**

### **Primary Goals**
- Consolidate ai-platform and web codebases into unified monorepo
- Implement API gateway with Express.js for centralized routing
- Create unified data models and schemas
- Establish inter-service communication protocols
- Implement request/response validation and standardization

### **Success Criteria**
- Unified codebase is functional and accessible
- APIs are accessible, documented, and standardized
- Data flows between services work seamlessly
- Service boundaries are clearly defined and enforced

---

## 🏗️ **CODEBASE CONSOLIDATION STRATEGY**

### **Current State Analysis**
```
ai-platform/ (94,083 files)
├── JavaScript/TypeScript frontend
├── Python backend services
├── Configuration files
└── Documentation

web/ (26,910 files)
├── HTML/CSS frontend
├── Python backend
├── AI dashboard components
└── Static assets
```

### **Consolidation Plan**

#### **Phase 1: Directory Structure Unification**
```bash
# New Monorepo Structure
cascade-ai-platform/
├── packages/
│   ├── frontend/          # Consolidated frontend
│   ├── backend/           # Unified backend services
│   ├── shared/            # Shared utilities and models
│   └── api-gateway/       # API gateway service
├── apps/
│   ├── ai-dashboard/     # AI analysis dashboard
│   ├── admin-panel/      # Administrative interface
│   └── customer-portal/  # Customer-facing portal
├── services/
│   ├── auth-service/     # Authentication service
│   ├── analysis-service/ # AI analysis service
│   ├── reporting-service/ # Reporting service
│   └── billing-service/  # Billing and subscription
├── infrastructure/
│   ├── docker/           # Docker configurations
│   ├── k8s/             # Kubernetes manifests
│   └── terraform/       # Infrastructure as code
├── docs/                # Documentation
├── scripts/             # Build and deployment scripts
└── tests/               # Test suites
```

#### **Phase 2: Code Migration Strategy**
```python
# scripts/consolidate_codebases.py
import os
import shutil
from pathlib import Path

class CodebaseConsolidator:
    def __init__(self, source_dirs, target_dir):
        self.source_dirs = source_dirs
        self.target_dir = Path(target_dir)
        
    def consolidate_frontend(self):
        """Consolidate frontend codebases"""
        frontend_target = self.target_dir / "packages" / "frontend"
        
        # Copy ai-platform frontend
        ai_platform_frontend = Path("ai-platform") / "frontend"
        if ai_platform_frontend.exists():
            self.copy_directory(ai_platform_frontend, frontend_target / "ai-platform")
        
        # Copy web frontend
        web_frontend = Path("web")
        if web_frontend.exists():
            self.copy_directory(web_frontend, frontend_target / "web")
        
        # Create unified package.json
        self.create_unified_package_json(frontend_target)
    
    def consolidate_backend(self):
        """Consolidate backend services"""
        backend_target = self.target_dir / "packages" / "backend"
        
        # Copy Python services
        for source_dir in self.source_dirs:
            python_files = self.find_python_files(source_dir)
            for file_path in python_files:
                target_path = backend_target / file_path.name
                shutil.copy2(file_path, target_path)
        
        # Create unified requirements.txt
        self.create_unified_requirements(backend_target)
    
    def create_shared_utilities(self):
        """Create shared utilities and models"""
        shared_dir = self.target_dir / "packages" / "shared"
        
        # Create data models
        models_dir = shared_dir / "models"
        models_dir.mkdir(parents=True, exist_ok=True)
        
        # Create utility functions
        utils_dir = shared_dir / "utils"
        utils_dir.mkdir(parents=True, exist_ok=True)
        
        # Create configuration
        config_dir = shared_dir / "config"
        config_dir.mkdir(parents=True, exist_ok=True)
```

---

## 🚪 **API GATEWAY IMPLEMENTATION**

### **API Gateway Architecture**
```javascript
// packages/api-gateway/src/index.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { authMiddleware } = require('./middleware/auth');
const { validationMiddleware } = require('./middleware/validation');
const { loggingMiddleware } = require('./middleware/logging');
const { metricsMiddleware } = require('./middleware/metrics');

class APIGateway {
    constructor() {
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }
    
    setupMiddleware() {
        // Security middleware
        this.app.use(helmet());
        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
            credentials: true
        }));
        
        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 1000 // limit each IP to 1000 requests per windowMs
        });
        this.app.use(limiter);
        
        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        
        // Custom middleware
        this.app.use(loggingMiddleware);
        this.app.use(metricsMiddleware);
    }
    
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: process.env.APP_VERSION || '1.0.0',
                services: this.getServiceHealth()
            });
        });
        
        // API routes
        this.app.use('/api/v1/auth', this.createAuthRoutes());
        this.app.use('/api/v1/analysis', authMiddleware, this.createAnalysisRoutes());
        this.app.use('/api/v1/reports', authMiddleware, this.createReportRoutes());
        this.app.use('/api/v1/billing', authMiddleware, this.createBillingRoutes());
        this.app.use('/api/v1/admin', authMiddleware, this.createAdminRoutes());
        
        // Documentation
        this.app.get('/api/docs', (req, res) => {
            res.json(this.getAPIDocumentation());
        });
    }
    
    createAuthRoutes() {
        const router = express.Router();
        
        router.post('/login', validationMiddleware.loginSchema, async (req, res) => {
            try {
                const { email, password } = req.body;
                const result = await this.authService.authenticate(email, password);
                res.json(result);
            } catch (error) {
                res.status(401).json({ error: error.message });
            }
        });
        
        router.post('/register', validationMiddleware.registerSchema, async (req, res) => {
            try {
                const userData = req.body;
                const result = await this.authService.register(userData);
                res.json(result);
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        });
        
        router.post('/refresh', async (req, res) => {
            try {
                const { refreshToken } = req.body;
                const result = await this.authService.refreshToken(refreshToken);
                res.json(result);
            } catch (error) {
                res.status(401).json({ error: error.message });
            }
        });
        
        return router;
    }
    
    createAnalysisRoutes() {
        const router = express.Router();
        
        router.post('/scan', validationMiddleware.scanSchema, async (req, res) => {
            try {
                const { repositoryUrl, scanType, options } = req.body;
                const result = await this.analysisService.scanRepository(
                    repositoryUrl, 
                    scanType, 
                    options,
                    req.user.id
                );
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        router.get('/results/:scanId', async (req, res) => {
            try {
                const { scanId } = req.params;
                const result = await this.analysisService.getScanResults(scanId, req.user.id);
                res.json(result);
            } catch (error) {
                res.status(404).json({ error: error.message });
            }
        });
        
        router.get('/history', async (req, res) => {
            try {
                const { page = 1, limit = 10 } = req.query;
                const result = await this.analysisService.getScanHistory(
                    req.user.id, 
                    parseInt(page), 
                    parseInt(limit)
                );
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        return router;
    }
    
    setupErrorHandling() {
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                error: 'Not Found',
                message: `Route ${req.method} ${req.path} not found`,
                timestamp: new Date().toISOString()
            });
        });
        
        // Global error handler
        this.app.use((err, req, res, next) => {
            console.error('Error:', err);
            
            res.status(err.status || 500).json({
                error: 'Internal Server Error',
                message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
                timestamp: new Date().toISOString(),
                requestId: req.id
            });
        });
    }
    
    async getServiceHealth() {
        const services = ['auth-service', 'analysis-service', 'report-service'];
        const healthStatus = {};
        
        for (const service of services) {
            try {
                const health = await this.checkServiceHealth(service);
                healthStatus[service] = health;
            } catch (error) {
                healthStatus[service] = { status: 'unhealthy', error: error.message };
            }
        }
        
        return healthStatus;
    }
    
    getAPIDocumentation() {
        return {
            title: 'Cascade AI Platform API',
            version: '1.0.0',
            description: 'Enterprise AI code analysis and security platform',
            endpoints: {
                auth: {
                    'POST /api/v1/auth/login': 'User authentication',
                    'POST /api/v1/auth/register': 'User registration',
                    'POST /api/v1/auth/refresh': 'Token refresh'
                },
                analysis: {
                    'POST /api/v1/analysis/scan': 'Start code analysis',
                    'GET /api/v1/analysis/results/:id': 'Get scan results',
                    'GET /api/v1/analysis/history': 'Get scan history'
                },
                reports: {
                    'GET /api/v1/reports/:id': 'Get report',
                    'GET /api/v1/reports/list': 'List reports',
                    'POST /api/v1/reports/generate': 'Generate report'
                }
            }
        };
    }
}

module.exports = APIGateway;
```

### **Authentication Middleware**
```javascript
// packages/api-gateway/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { promisify } = require('util');

class AuthMiddleware {
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET;
        this.jwtVerify = promisify(jwt.verify);
    }
    
    authenticate() {
        return async (req, res, next) => {
            try {
                const token = this.extractToken(req);
                if (!token) {
                    return res.status(401).json({ error: 'No token provided' });
                }
                
                const payload = await this.jwtVerify(token, this.jwtSecret);
                req.user = payload;
                next();
            } catch (error) {
                res.status(401).json({ error: 'Invalid token' });
            }
        };
    }
    
    authorize(roles) {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            
            if (roles && !roles.includes(req.user.role)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
            
            next();
        };
    }
    
    extractToken(req) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }
        return null;
    }
}

module.exports = new AuthMiddleware();
```

---

## 🗄️ **UNIFIED DATA MODELS**

### **Base Data Models**
```python
# packages/shared/models/base.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from datetime import datetime
import uuid

Base = declarative_base()

class BaseModel(Base):
    __abstract__ = True
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True)
    
    def to_dict(self):
        return {
            column.name: getattr(self, column.name)
            for column in self.__table__.columns
        }
    
    def update_from_dict(self, data):
        for key, value in data.items():
            if hasattr(self, key):
                setattr(self, key, value)
        self.updated_at = datetime.utcnow()
```

### **User Model**
```python
# packages/shared/models/user.py
from sqlalchemy import Column, String, Enum, Boolean
from sqlalchemy.orm import relationship
from enum import Enum as PyEnum
from .base import BaseModel

class UserRole(PyEnum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    ANALYST = "analyst"
    VIEWER = "viewer"

class User(BaseModel):
    __tablename__ = "users"
    
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.ANALYST, nullable=False)
    organization_id = Column(String, nullable=False)
    last_login = Column(DateTime(timezone=True))
    email_verified = Column(Boolean, default=False)
    
    # Relationships
    organization = relationship("Organization", back_populates="users")
    scans = relationship("Scan", back_populates="user")
    reports = relationship("Report", back_populates="user")
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"
    
    def has_permission(self, required_role):
        role_hierarchy = {
            UserRole.VIEWER: 1,
            UserRole.ANALYST: 2,
            UserRole.ADMIN: 3,
            UserRole.SUPER_ADMIN: 4
        }
        return role_hierarchy.get(self.role, 0) >= role_hierarchy.get(required_role, 0)
```

### **Organization Model**
```python
# packages/shared/models/organization.py
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from .base import BaseModel

class Organization(BaseModel):
    __tablename__ = "organizations"
    
    name = Column(String(255), nullable=False)
    stripe_customer_id = Column(String(255), unique=True)
    subscription_tier = Column(String(50), default="free")
    subscription_expires = Column(DateTime(timezone=True))
    max_users = Column(Integer, default=5)
    max_scans_per_month = Column(Integer, default=10)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    users = relationship("User", back_populates="organization")
    scans = relationship("Scan", back_populates="organization")
    reports = relationship("Report", back_populates="organization")
```

### **Scan Model**
```python
# packages/shared/models/scan.py
from sqlalchemy import Column, String, Enum, Text, Integer, ForeignKey
from sqlalchemy.orm import relationship
from enum import Enum as PyEnum
from .base import BaseModel

class ScanStatus(PyEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class ScanType(PyEnum):
    SECURITY = "security"
    QUALITY = "quality"
    LICENSES = "licenses"
    TECHNICAL_DEBT = "technical_debt"
    PERFORMANCE = "performance"
    SAIF_COMPLIANCE = "saif_compliance"

class Scan(BaseModel):
    __tablename__ = "scans"
    
    repository_url = Column(String(500), nullable=False)
    branch = Column(String(100), default="main")
    commit_hash = Column(String(40))
    scan_type = Column(Enum(ScanType), nullable=False)
    status = Column(Enum(ScanStatus), default=ScanStatus.PENDING)
    progress = Column(Integer, default=0)
    lines_of_code = Column(Integer)
    file_count = Column(Integer)
    
    # Foreign keys
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    
    # Results
    results = Column(Text)  # JSON string
    summary = Column(Text)  # JSON string
    error_message = Column(Text)
    
    # Relationships
    user = relationship("User", back_populates="scans")
    organization = relationship("Organization", back_populates="scans")
    reports = relationship("Report", back_populates="scan")
    
    @property
    def results_dict(self):
        import json
        return json.loads(self.results) if self.results else {}
    
    @results_dict.setter
    def results_dict(self, value):
        import json
        self.results = json.dumps(value)
```

### **Database Connection and Session Management**
```python
# packages/shared/database/connection.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
import os

class DatabaseManager:
    def __init__(self):
        self.engine = None
        self.SessionLocal = None
        self.setup_database()
    
    def setup_database(self):
        database_url = os.getenv('DATABASE_URL')
        
        if database_url:
            # Production database
            self.engine = create_engine(
                database_url,
                pool_pre_ping=True,
                pool_recycle=300,
                echo=os.getenv('DB_ECHO', 'false').lower() == 'true'
            )
        else:
            # Development SQLite
            self.engine = create_engine(
                'sqlite:///cascade_ai.db',
                poolclass=StaticPool,
                connect_args={'check_same_thread': False},
                echo=os.getenv('DB_ECHO', 'false').lower() == 'true'
            )
        
        self.SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine
        )
    
    def get_session(self) -> Session:
        return self.SessionLocal()
    
    def create_tables(self):
        from .models import Base
        Base.metadata.create_all(bind=self.engine)
    
    def drop_tables(self):
        from .models import Base
        Base.metadata.drop_all(bind=self.engine)

# Global database instance
db_manager = DatabaseManager()

def get_db_session():
    session = db_manager.get_session()
    try:
        yield session
    finally:
        session.close()
```

---

## 🔄 **INTER-SERVICE COMMUNICATION**

### **Service Discovery and Communication**
```python
# packages/shared/communication/service_client.py
import requests
import json
from typing import Dict, Any, Optional
from dataclasses import dataclass

@dataclass
class ServiceEndpoint:
    name: str
    host: str
    port: int
    protocol: str = "http"
    health_endpoint: str = "/health"

class ServiceClient:
    def __init__(self):
        self.services = self.load_service_config()
        self.circuit_breakers = {}
        
    def load_service_config(self) -> Dict[str, ServiceEndpoint]:
        return {
            'auth-service': ServiceEndpoint('auth-service', 'auth-service', 8081),
            'analysis-service': ServiceEndpoint('analysis-service', 'analysis-service', 8082),
            'report-service': ServiceEndpoint('report-service', 'report-service', 8083),
            'billing-service': ServiceEndpoint('billing-service', 'billing-service', 8084)
        }
    
    async def call_service(self, service_name: str, endpoint: str, 
                          method: str = 'GET', data: Optional[Dict] = None,
                          headers: Optional[Dict] = None) -> Dict[str, Any]:
        service = self.services.get(service_name)
        if not service:
            raise ValueError(f"Service {service_name} not found")
        
        url = f"{service.protocol}://{service.host}:{service.port}{endpoint}"
        
        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method.upper() == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method.upper() == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            self.handle_service_error(service_name, e)
            raise
    
    def handle_service_error(self, service_name: str, error: Exception):
        # Implement circuit breaker logic
        if service_name not in self.circuit_breakers:
            self.circuit_breakers[service_name] = {
                'failures': 0,
                'last_failure': None,
                'state': 'closed'
            }
        
        breaker = self.circuit_breakers[service_name]
        breaker['failures'] += 1
        breaker['last_failure'] = datetime.utcnow()
        
        # Open circuit after 5 failures
        if breaker['failures'] >= 5:
            breaker['state'] = 'open'
    
    async def check_service_health(self, service_name: str) -> bool:
        service = self.services.get(service_name)
        if not service:
            return False
        
        try:
            url = f"{service.protocol}://{service.host}:{service.port}{service.health_endpoint}"
            response = requests.get(url, timeout=5)
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False
```

### **Message Queue Integration**
```python
# packages/shared/communication/message_queue.py
import json
import asyncio
from typing import Dict, Any, Callable
from dataclasses import dataclass
from enum import Enum

class MessageType(Enum):
    SCAN_STARTED = "scan_started"
    SCAN_COMPLETED = "scan_completed"
    SCAN_FAILED = "scan_failed"
    REPORT_GENERATED = "report_generated"
    USER_CREATED = "user_created"
    BILLING_EVENT = "billing_event"

@dataclass
class Message:
    type: MessageType
    data: Dict[str, Any]
    timestamp: float
    correlation_id: str
    retry_count: int = 0

class MessageQueue:
    def __init__(self):
        self.subscribers: Dict[MessageType, list[Callable]] = {}
        self.message_queue = asyncio.Queue()
        self.running = False
        
    def subscribe(self, message_type: MessageType, callback: Callable):
        if message_type not in self.subscribers:
            self.subscribers[message_type] = []
        self.subscribers[message_type].append(callback)
    
    async def publish(self, message_type: MessageType, data: Dict[str, Any], 
                      correlation_id: str = None):
        message = Message(
            type=message_type,
            data=data,
            timestamp=asyncio.get_event_loop().time(),
            correlation_id=correlation_id or str(uuid.uuid4())
        )
        
        await self.message_queue.put(message)
    
    async def start_consuming(self):
        self.running = True
        while self.running:
            try:
                message = await asyncio.wait_for(self.message_queue.get(), timeout=1.0)
                await self.process_message(message)
            except asyncio.TimeoutError:
                continue
    
    async def process_message(self, message: Message):
        subscribers = self.subscribers.get(message.type, [])
        
        for callback in subscribers:
            try:
                await callback(message)
            except Exception as e:
                print(f"Error processing message {message.type}: {e}")
    
    def stop(self):
        self.running = False

# Global message queue instance
message_queue = MessageQueue()
```

---

## 📋 **WEEK 2 IMPLEMENTATION CHECKLIST**

### **Day 1-2: Codebase Consolidation**
- [ ] Create new monorepo directory structure
- [ ] Migrate ai-platform frontend code
- [ ] Migrate web frontend code
- [ ] Consolidate Python backend services
- [ ] Create shared utilities and models
- [ ] Update package.json and requirements.txt
- [ ] Test consolidated codebase

### **Day 3-4: API Gateway Implementation**
- [ ] Set up Express.js API gateway
- [ ] Implement authentication middleware
- [ ] Create request validation middleware
- [ ] Set up rate limiting and security
- [ ] Implement error handling
- [ ] Add logging and metrics
- [ ] Create API documentation

### **Day 5-6: Data Models and Database**
- [ ] Create unified data models
- [ ] Set up database connection management
- [ ] Implement user and organization models
- [ ] Create scan and report models
- [ ] Set up database migrations
- [ ] Test data model relationships

### **Day 7: Inter-service Communication**
- [ ] Implement service discovery
- [ ] Create service client library
- [ ] Set up message queue system
- [ ] Implement circuit breaker pattern
- [ ] Add health checking
- [ ] Test service communication

---

## 🎯 **SUCCESS METRICS**

### **Technical KPIs**
- **Code Consolidation**: 30-40% reduction in duplicate code
- **API Response Time**: <200ms for 95% of requests
- **Service Availability**: 99.9% uptime
- **Data Model Performance**: <50ms database queries
- **Inter-service Latency**: <100ms communication

### **Integration KPIs**
- **Unified Codebase**: 100% functional
- **API Accessibility**: All endpoints documented and accessible
- **Data Flow**: Seamless service communication
- **Service Boundaries**: Clearly defined and enforced

---

## 🚀 **NEXT STEPS**

### **Week 3 Preparation**
- Frontend consolidation and responsive design
- Unified component library creation
- Performance optimization
- User experience standardization

### **Week 4 Preparation**
- Comprehensive testing implementation
- Production deployment setup
- Monitoring and alerting configuration
- Go-live preparation

---

## 📞 **WEEK 2 STATUS**

### **Current Phase**: 🟡 **PLANNING COMPLETE**
### **Execution Phase**: 🟢 **READY TO START**
### **Timeline**: 7 days for complete implementation
### **Team**: 2-3 engineers for consolidation and integration
### **Dependencies**: Week 1 infrastructure must be operational

---

## 🎉 **CONCLUSION**

**Week 2 Core Integration is fully planned and ready for execution.**

All technical specifications, consolidation strategies, and implementation details are complete. The integration plan addresses:

- **Codebase unification** with minimal disruption
- **API gateway implementation** with security and performance
- **Unified data models** with proper relationships
- **Inter-service communication** with reliability and scalability

**Ready to transform the distributed codebase into a cohesive, enterprise-ready platform.**

The consolidation will eliminate technical debt, improve maintainability, and establish the foundation for rapid feature development and scaling.
