# Week 1 Foundation Setup
# Google Cloud Project and Infrastructure Configuration

## 🚀 Google Cloud Project Setup

### 1. Project Creation and Configuration
```bash
# Set up Google Cloud project
gcloud projects create cascade-ai-platform --name="Cascade AI Platform"
gcloud config set project cascade-ai-platform

# Enable required APIs
gcloud services enable compute.googleapis.com
gcloud services enable sql-component.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable logging.googleapis.com
gcloud services monitoring.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services cloudbilling.googleapis.com
gcloud services enable iam.googleapis.com
gcloud services enable cloudresourcemanager.googleapis.com

# Set up billing
gcloud billing accounts list
gcloud billing projects link cascade-ai-platform --billing-account=YOUR_BILLING_ACCOUNT_ID
```

### 2. Service Accounts and Permissions
```bash
# Create service account for application
gcloud iam service-accounts create cascade-ai-service \
    --display-name="Cascade AI Platform Service" \
    --description="Service account for the Cascade AI Platform application"

# Grant necessary permissions
gcloud projects add-iam-policy-binding cascade-ai-platform \
    --member="serviceAccount:cascade-ai-service@cascade-ai-platform.iam.gserviceaccount.com" \
    --role="roles/cloudsql.admin"
gcloud projects add-iam-policy-binding cascade-ai-platform \
    --member="serviceAccount:cascade-ai-service@cascade-ai-platform.iam.gserviceaccount.com" \
    --role="roles/run.admin"
gcloud projects add-iam-policy-binding cascade-ai-platform \
    --member="serviceAccount:cascade-ai-service@cascade-ai-platform.iam.gserviceaccount.com" \
    --role="roles/secretmanager.admin"
gcloud projects add-iam-policy-binding cascade-ai-platform \
    --member="serviceAccount:cascade-ai-service@cascade-ai-platform.iam.gserviceaccount.com" \
    --role="roles/logging.logWriter"
gcloud projects add-iam-policy-binding cascade-ai-platform \
    --member="serviceAccount:cascade-ai-service@cascade-ai-platform.iam.gserviceaccount.com" \
    --role="roles/monitoring.viewer"

# Download service account key
gcloud iam service-accounts keys create cascade-ai-service \
    --key-file=service-account-key.json
```

### 3. Network Configuration
```bash
# Create VPC network
gcloud compute networks create cascade-ai-network \
    --subnet-mode=custom \
    --bg-mode=custom \
    --range=10.0.0.0/24 \
    --description="Cascade AI Platform VPC Network"

# Create subnets
gcloud compute networks subnets create cascade-ai-network \
    --range=10.0.1.0/24 \
    --network=cascade-ai-network \
    --description="Primary subnet for application servers"

gcloud compute networks subnets create cascade-ai-network \
    --range=10.0.2.0/24 \
    --network=cascade-ai-network \
    --description="Secondary subnet for database servers"

# Create firewall rules
gcloud compute firewall-rules create cascade-ai-firewall \
    --allow=tcp:80,443 \
    --source-ranges=0.0.0.0/0 \
    --description="Allow HTTP and HTTPS traffic"

gcloud compute firewall-rules create cascade-ai-firewall-ssh \
    --allow=tcp:22 \
    --source-ranges=0.0.0.0/0 \
    --description="Allow SSH access"
```

## 🗄️ Database Infrastructure Setup

### 1. PostgreSQL Instance
```bash
# Create Cloud SQL instance
gcloud sql instances create cascade-ai-db \
    --database-version=POSTGRES_14 \
    --tier=db-n1-standard-2 \
    --region=us-central1 \
    --network=cascade-ai-network \
    --subnet=cascade-ai-network \
    --authorized-networks=10.0.0.0/24 \
    --storage-size=100GB \
    --cpu=2 \
    --memory=8GiB \
    --database-version=POSTGRES_14 \
    --backup-start-time=2024-01-01T00:00:00Z \
    --retained-backups-count=7 \
    --deletion-protection

# Create database
gcloud sql databases create cascade-ai-db \
    --instance=cascade-ai-db \
    --database=cascade_ai_platform

# Create database user
gcloud sql users create cascade-ai-user \
    --instance=cascade-ai-db \
    --password=secure_password_123

# Grant permissions
gcloud sql databases set-permissions cascade-ai-db cascade_ai_user \
    --instance=cascade-ai-db \
    --role=cloudsqlsuperuser
```

### 2. Redis Cache Setup
```bash
# Create Memorystore instance
gcloud redis instances create cascade-ai-cache \
    --size=2 \
    --region=us-central1 \
    --zone=us-central1-a \
    --network=cascade-ai-network \
    --authorized-network=10.0.0.0/24 \
    --redis-version=redis_7_2 \
    --display-name="Cascade AI Cache"

# Get connection details
gcloud redis instances describe cascade-ai-cache --format=json > redis-config.json
```

## 🔐 Authentication System Setup

### 1. Environment Configuration
```bash
# Create environment configuration files
cat > .env.production << 'EOF'
# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT=cascade-ai-platform
GOOGLE_APPLICATION_CREDENTIALS=service-account-key.json

# Database Configuration
DB_HOST=10.0.1.3
DB_PORT=5432
DB_NAME=cascade_ai_platform
DB_USER=cascade_ai_user
DB_PASSWORD=secure_password_123

# Redis Configuration
REDIS_HOST=10.0.1.4
REDIS_PORT=6379
REDIS_PASSWORD=redis_secure_password_123

# Application Configuration
NODE_ENV=production
PORT=8080
JWT_SECRET=your_jwt_secret_key_minimum_32_characters_long
SESSION_SECRET=your_session_secret_key_minimum_32_characters_long

# Google Cloud Services
GOOGLE_SECRET_MANAGER_ID=cascade-ai-secrets
GOOGLE_LOGGING_PROJECT=cascade-ai-platform
GOOGLE_MONITORING_PROJECT=cascade-ai-platform
EOF
```

### 2. JWT Authentication Module
```python
# auth/jwt_auth.py
import jwt
import os
from datetime import datetime, timedelta
from functools import wraps
from flask import Flask, request, jsonify

class JWTAuth:
    def __init__(self, app=None):
        self.app = app
        self.secret_key = os.getenv('JWT_SECRET')
        
    def generate_token(self, user_id, user_email, role='user'):
        """Generate JWT token"""
        payload = {
            'user_id': user_id,
            'user_email': user_email,
            'role': role,
            'exp': datetime.utcnow() + timedelta(hours=24),
            'iat': datetime.utcnow()
        }
        
        return jwt.encode(payload, self.secret_key, algorithm='HS256')
    
    def verify_token(self, token):
        """Verify JWT token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=['HS256'])
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
    
    def auth_required(self, f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            token = request.headers.get('Authorization')
            if not token:
                return jsonify({'error': 'No token provided'}), 401
            
            token = token.replace('Bearer ', '')
            payload = self.verify_token(token)
            if not payload:
                return jsonify({'error': 'Invalid token'}), 401
            
            request.user = payload
            return f(*args, **kwargs)
        return decorated_function
```

### 3. Google Cloud IAM Integration
```python
# auth/google_iam.py
import os
from google.cloud import secretmanager
from google.oauth2 import service_account
import google.auth

class GoogleCloudIAM:
    def __init__(self):
        self.credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
        self.secret_manager_id = os.getenv('GOOGLE_SECRET_MANAGER_ID')
        
    def get_credentials(self):
        """Get Google Cloud credentials"""
        try:
            return service_account.Credentials.from_service_account_file(
                self.credentials_path, scopes=['https://www.googleapis.com/auth/cloud-platform'])
        except Exception as e:
            print(f"Error loading credentials: {e}")
            return None
    
    def get_secret(self, secret_id):
        """Get secret from Google Secret Manager"""
        try:
            credentials = self.get_credentials()
            client = secretmanager.SecretManagerServiceClient(credentials=credentials)
            
            name = f"projects/{os.getenv('GOOGLE_CLOUD_PROJECT')}/secrets/{secret_id}/versions/latest"
            response = client.access_secret_version(request={'name': name})
            
            return response.payload.data.decode('UTF-8')
        except Exception as e:
            print(f"Error accessing secret: {e}")
            return None
    
    def store_secret(self, secret_id, secret_value):
        """Store secret in Google Secret Manager"""
        try:
            credentials = self.get_credentials()
            client = secretmanager.SecretManagerServiceClient(credentials=credentials)
            
            name = f"projects/{os.getenv('GOOGLE_CLOUD_PROJECT')}/secrets/{secret_id}"
            
            response = client.create_secret(
                parent=f"projects/{os.getenv('GOOGLE_CLOUD_PROJECT')}/secrets/{secret_id}",
                secret_id=secret_id,
                secret=secret_value,
                secret_id=secret_id
            )
            
            print(f"Secret {secret_id} stored successfully")
            return response.name
        except Exception as e:
            print(f"Error storing secret: {e}")
            return None
```

## 📊 Monitoring and Logging Setup

### 1. Google Cloud Logging Configuration
```python
# monitoring/logging_config.py
import logging
import os
from google.cloud import logging as cloud_logging
import google.cloud.logging.handlers

class CloudLoggingConfig:
    def __init__(self):
        self.project_id = os.getenv('GOOGLE_CLOUD_PROJECT')
        self.setup_logging()
    
    def setup_logging(self):
        """Setup Google Cloud Logging"""
        # Create Cloud Logging client
        client = cloud_logging.Client(project=self.project_id)
        
        # Configure root logger
        cloud_logging.setup_logging()
        
        # Create custom logger
        logger = logging.getLogger('cascade_ai_platform')
        logger.setLevel(logging.INFO)
        
        # Add Cloud Logging handler
        cloud_handler = cloud_logging.CloudLoggingHandler(
            name='cascade-ai-platform',
            labels={'environment': os.getenv('NODE_ENV', 'development')}
        )
        logger.addHandler(cloud_handler)
        
        # Configure format
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        cloud_handler.setFormatter(formatter)
        
        logger.info("Google Cloud Logging initialized")
```

### 2. Monitoring Dashboard Setup
```python
# monitoring/metrics.py
from prometheus_client import Counter, Histogram, Gauge, generate_latest
import time

class MetricsCollector:
    def __init__(self):
        self.request_count = Counter('cascade_ai_requests_total')
        self.request_duration = Histogram('cascade_ai_request_duration_seconds')
        self.active_users = Gauge('cascade_ai_active_users')
        self.error_count = Counter('cascade_ai_errors_total')
        
    def record_request(self, duration, status_code):
        """Record API request metrics"""
        self.request_count.inc()
        self.request_duration.observe(duration)
        
        if status_code >= 400:
            self.error_count.inc()
    
    def record_user_activity(self, user_id):
        """Record user activity"""
        self.active_users.inc()
    
    def get_metrics(self):
        """Get current metrics for Prometheus"""
        return generate_latest(
            self.request_count,
            self.request_duration,
            self.active_users,
            self.error_count
        )
```

## 🐳️ Container Configuration

### 1. Dockerfile
```dockerfile
# Use official Python image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd --create-home --shell /bin/bash cascade-ai
USER cascade-ai

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s \
    CMD curl -f http://localhost:8080/health || exit 1

# Start application
CMD ["python", "app.py"]
```

### 2. Kubernetes Deployment
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cascade-ai-platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: cascade-ai-platform
  template:
    metadata:
      labels:
        app: cascade-ai-platform
    spec:
      containers:
      - name: cascade-ai-platform
        image: gcr.io/cascade-ai-platform:latest
        ports:
        - containerPort: 8080
        env:
        - name: DB_HOST
          value: "10.0.1.3"
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-password
        envFrom:
        - secretKeyRef:
            name: JWT_SECRET
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 1000m
            memory: 2Gi
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 60
          periodSeconds: 30
---
apiVersion: v1
kind: Service
metadata:
  name: cascade-ai-platform
spec:
  selector:
    matchLabels:
      app: cascade-ai-platform
  ports:
  - port: 8080
    targetPort: 8080
  type: LoadBalancer
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: cascade-ai-config
data:
  NODE_ENV: "production"
  GOOGLE_CLOUD_PROJECT: "cascade-ai-platform"
  DB_HOST: "10.0.1.3"
  DB_PORT: "5432"
  DB_NAME: "cascade_ai_platform"
```

## 🚀 CI/CD Pipeline Setup

### 1. GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy to Google Cloud

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
      - name: Run tests
        run: |
          python -m pytest tests/ -v --cov=tests/
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage.xml

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_CREDENTIALS }}
        project_id: cascade-ai-platform
      - name: Build and push Docker image
        run: |
          docker build -t gcr.io/cascade-ai-platform:$GITHUB_SHA .
          docker push gcr.io/cascade-ai-platform:$GITHUB_SHA
      - name: Deploy to Google Kubernetes
        run: |
          gcloud container clusters get-credentials default-zone
          kubectl apply -f k8s/
          kubectl set image deployment/cascade-ai-platform cascade-ai-platform=gcr.io/cascade-ai-platform:$GITHUB_SHA
```

## 🔧 Development Environment Setup

### 1. Local Development Docker Compose
```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=development
      - DB_HOST=localhost
      - REDIS_HOST=localhost
      - DB_PASSWORD=dev_password
    volumes:
      - .:/app
      - ./logs:/app/logs
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=cascade_ai_platform_dev
      - POSTGRES_USER=cascade_ai_user
      - POSTGRES_PASSWORD=dev_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
```

### 2. Development Scripts
```bash
#!/bin/bash
# scripts/dev-setup.sh

echo "🚀 Setting up development environment..."

# Create .env file
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env file from template"
fi

# Create logs directory
mkdir -p logs

# Install dependencies
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt

# Set up pre-commit hooks
echo "🔧 Setting up pre-commit hooks..."
pre-commit install

# Start development services
echo "🚀 Starting development services..."
docker-compose -f docker-compose.dev.yml up -d

echo "✅ Development environment ready!"
echo "🌐 Access the application at: http://localhost:8080"
```

## 📋 Immediate Action Checklist

### ✅ **This Week Tasks**
- [ ] Create Google Cloud project
- [ ] Enable required APIs
- [ ] Set up billing account
- [ ] Create service accounts
- [ ] Configure network and firewall
- [ ] Set up PostgreSQL instance
- [ ] Create Redis cache
- [ ] Configure authentication system
- [ ] Set up monitoring and logging
- [ ] Create Docker configuration
- [ ] Set up CI/CD pipeline
- [ ] Configure development environment

### 📊 **Success Metrics**
- Google Cloud project created and configured
- Database and cache infrastructure running
- Authentication system implemented
- Monitoring and logging operational
- CI/CD pipeline automated
- Development environment ready

### 🎯 **Next Steps**
- Begin Week 2: Core Service Integration
- Consolidate ai-platform and web codebases
- Implement API gateway and routing
- Create unified data models
- Set up inter-service communication

---

## 📞 **Infrastructure Status Dashboard**

### **Current Status**: 🟡 **PLANNING**
### **Target Status**: 🟢 **IMPLEMENTING**
### **Expected Completion**: End of Week 1

The foundation infrastructure will provide the base for all subsequent development phases and enable rapid iteration on the enterprise platform.
