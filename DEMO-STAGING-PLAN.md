# Demo & Staging Environment Plan

**Date Created:** 2026-08-19  
**Status:** Ready for Provisioning  
**Target Environments:** Local Docker, Azure AKS, AWS ECS, GCP GKE

---

## 1. Environment Requirements

### Local Development (Docker Compose)
- **Docker Desktop** version 4.x+
- **Docker Compose** version 2.x+
- **Minimum Resources:**
  - CPU: 4 cores
  - RAM: 8 GB
  - Disk: 50 GB available
- **Ports Required:** 3000, 3003, 5432, 6379, 8080, 8443
- **OS:** Windows 10/11, macOS 12+, or Linux with Docker

### Cloud Deployment (Recommended for Staging)
- **Azure AKS:**
  - Resource Group created
  - AKS cluster (1.27+)
  - Container Registry (ACR)
  - Database (Azure Database for PostgreSQL)
  - Redis Cache
  
- **AWS ECS:**
  - ECS cluster provisioned
  - ECR repositories created
  - RDS PostgreSQL instance
  - ElastiCache Redis
  - VPC and security groups configured
  
- **GCP GKE:**
  - GKE cluster (1.27+)
  - Artifact Registry
  - Cloud SQL for PostgreSQL
  - Memorystore Redis
  - VPC network ready

---

## 2. Demo User Credentials (Non-Sensitive)

These are default demo accounts for testing. **Do NOT use in production.**

### Admin User
```
Email: admin@demo.simplebeacon.local
Username: admin_demo
Default Password: Will be set via seed script
MFA: Disabled for demo
Permissions: Full administrative access
```

### Standard Demo User
```
Email: user@demo.simplebeacon.local
Username: user_demo
Default Password: Will be set via seed script
MFA: Disabled for demo
Permissions: Standard user access
```

### API Test User
```
Email: api@demo.simplebeacon.local
Username: api_test
API Key: Will be generated during data seeding
Permissions: API-only access
```

### Guest/Limited Access User
```
Email: guest@demo.simplebeacon.local
Username: guest_demo
Default Password: Will be set via seed script
MFA: Disabled for demo
Permissions: View-only access
```

---

## 3. Data Seeding Script Stub

A comprehensive data seeding script will populate demo data. Below is the structure:

### Script Purpose
- Initialize database schema
- Create demo users with various roles and permissions
- Populate sample scan results and reports
- Generate test configurations and policies
- Create sample organization hierarchies
- Seed analytics and metrics data

### Script Location
```
scripts/seed-demo-data.js
```

### Script Usage
```bash
# Local development
NODE_ENV=demo npm run seed

# With custom configuration
npm run seed -- --env staging --users 5 --orgs 3

# Reset demo data
npm run seed:reset -- --env demo
```

### Key Seed Operations
1. **Drop existing demo data** (if --reset flag)
2. **Create organizations:**
   - Demo Corp (primary)
   - Test Industries (secondary)
   - Sample Enterprises (multi-tenant test)
3. **Create users** with various roles:
   - Super Admin
   - Organization Admin
   - Analyst
   - Compliance Officer
   - Limited User
   - API Service Account
4. **Create sample scans:**
   - Web application scans
   - Infrastructure scans
   - Compliance reports
   - Real-time monitoring data
5. **Generate demo findings:**
   - High, Medium, Low severity issues
   - Resolved and open findings
   - Historical trends
6. **Populate analytics:**
   - Dashboard widgets
   - Reports
   - Metrics and KPIs

---

## 4. Local Provisioning Steps

### Step 1: Clone and Navigate
```bash
cd c:\Users\user\CascadeProjects.worktrees\pre-marketing-strategies-simple-beacon
git checkout -b launch/demo-and-staging
```

### Step 2: Environment Setup
```bash
# Copy environment template
cp .env.example .env.demo
cp .env.example .env.staging

# Edit .env.demo with:
NODE_ENV=demo
DATABASE_URL=postgresql://demo:demo@localhost:5432/simplebeacon_demo
REDIS_URL=redis://localhost:6379/0
API_PORT=3003
DASHBOARD_PORT=3000
DEMO_MODE=true
SEED_DATA=true
```

### Step 3: Docker Compose Local Stack
```bash
# Start all services
docker-compose -f docker-compose.demo.yml up -d

# Monitor startup
docker-compose -f docker-compose.demo.yml logs -f

# Verify services
docker-compose -f docker-compose.demo.yml ps
```

### Step 4: Database Initialization
```bash
# Run migrations
npm run migrate -- --env demo

# Seed demo data
npm run seed -- --env demo --verbose

# Verify seeding
psql -U demo -d simplebeacon_demo -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM organizations;"
```

### Step 5: Access Demo Environment
```
Dashboard:  http://localhost:3000
API Server: http://localhost:3003
Adminer DB: http://localhost:8080
```

### Step 6: Cleanup
```bash
# Stop services
docker-compose -f docker-compose.demo.yml down

# Remove volumes (full reset)
docker-compose -f docker-compose.demo.yml down -v
```

---

## 5. Cloud Provisioning Steps

### Azure AKS Deployment

#### Prerequisites
```bash
az login
az account set --subscription "YOUR_SUBSCRIPTION_ID"
az configure --defaults group=simplebeacon-demo location=eastus
```

#### Deploy
```bash
# Create resource group
az group create --name simplebeacon-demo --location eastus

# Create AKS cluster
az aks create \
  --resource-group simplebeacon-demo \
  --name sb-demo-cluster \
  --node-count 3 \
  --vm-set-type VirtualMachineScaleSets \
  --load-balancer-sku standard

# Get credentials
az aks get-credentials --resource-group simplebeacon-demo --name sb-demo-cluster

# Deploy using Helm or kubectl
kubectl apply -f k8s/demo/
```

### AWS ECS Deployment

#### Prerequisites
```bash
aws configure
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
```

#### Deploy
```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name simplebeacon-demo

# Push images to ECR
aws ecr create-repository --repository-name simplebeacon-demo
docker build -t simplebeacon:demo .
docker tag simplebeacon:demo ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/simplebeacon-demo:demo
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/simplebeacon-demo:demo

# Deploy task definition
aws ecs register-task-definition --cli-input-json file://aws/demo-task-definition.json

# Create service
aws ecs create-service \
  --cluster simplebeacon-demo \
  --service-name simplebeacon-api \
  --task-definition simplebeacon-demo:1 \
  --desired-count 3
```

### GCP GKE Deployment

#### Prerequisites
```bash
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID
gcloud config set compute/zone us-central1-a
```

#### Deploy
```bash
# Create GKE cluster
gcloud container clusters create simplebeacon-demo \
  --num-nodes 3 \
  --machine-type n1-standard-2

# Get credentials
gcloud container clusters get-credentials simplebeacon-demo

# Push to Artifact Registry
gcloud builds submit --tag us-central1-docker.pkg.dev/PROJECT_ID/simplebeacon/demo:latest

# Deploy
kubectl apply -f k8s/demo/
```

---

## 6. Monitoring & Validation

### Health Checks
```bash
# API health
curl http://localhost:3003/api/health

# Dashboard status
curl http://localhost:3000/api/status

# Database connection
npm run test:db -- --env demo

# Redis connectivity
redis-cli -h localhost ping
```

### Key Metrics to Validate
- [ ] All pods/services in Running state
- [ ] Database seeding completed successfully
- [ ] API responds with 200 status
- [ ] Dashboard loads without errors
- [ ] Demo users can authenticate
- [ ] Sample data is visible in UI

---

## 7. Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Find and kill process on port
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**Database Connection Failed**
```bash
# Check PostgreSQL is running
docker-compose -f docker-compose.demo.yml ps postgres

# Verify credentials
psql -U demo -d simplebeacon_demo -c "SELECT VERSION();"
```

**Seed Script Fails**
```bash
# Check logs
docker-compose -f docker-compose.demo.yml logs api

# Manually run with verbose output
npm run seed -- --env demo --verbose --debug
```

**Docker Network Issues**
```bash
# Inspect network
docker network ls
docker network inspect simplebeacon-demo_default

# Recreate network
docker network prune
docker-compose -f docker-compose.demo.yml down
docker-compose -f docker-compose.demo.yml up -d
```

---

## 8. Security Considerations

⚠️ **IMPORTANT:** This is a demo/staging environment only.

- **No sensitive production data** should be used
- **Demo credentials** are non-sensitive and for testing only
- **All secrets** must be injected at runtime via environment variables (never committed)
- **Network access** should be restricted (use VPN/firewall for staging)
- **HTTPS required** for staging cloud deployments
- **Demo data automatically expires** (configurable TTL)
- **Audit logging enabled** for all activities
- **Rate limiting disabled** for demo (enable in staging)

---

## 9. Post-Deployment Verification Checklist

- [ ] Environment variables properly configured (no secrets in .env)
- [ ] Database migrations ran successfully
- [ ] Demo data seeding completed
- [ ] Admin user can log in
- [ ] All API endpoints respond correctly
- [ ] Dashboard displays mock data
- [ ] Redis cache is operational
- [ ] Logs are being written (no errors)
- [ ] Monitoring stack is configured (if using cloud)
- [ ] Backup procedures documented
- [ ] Disaster recovery plan reviewed

---

## 10. Next Steps

1. **Infrastructure Setup:** Provision cloud resources if needed
2. **Seed Data:** Run data seeding script
3. **Configure Monitoring:** Set up alerts and dashboards
4. **Test Workflows:** Validate key user journeys
5. **Performance Testing:** Run load tests with demo data
6. **Security Scan:** Run vulnerability assessments
7. **Documentation:** Update runbooks and playbooks
8. **Handoff:** Document for ops team if cloud deployment

---

**Revision History**
| Date | Author | Change |
|------|--------|--------|
| 2026-08-19 | System | Initial template created |

**Related Documentation**
- [DEPLOYMENT-CHECKLIST.md](../../DEPLOYMENT-CHECKLIST.md)
- [LAUNCH-CHECKLIST.md](../../LAUNCH-CHECKLIST.md)
- [OPERATIONAL-SETUP-RUNBOOK.md](../../OPERATIONAL-SETUP-RUNBOOK.md)
