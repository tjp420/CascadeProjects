#!/usr/bin/env node

/**
 * v1-Internal Profile Verification Script
 * 
 * This script verifies that the v1-internal environment is properly configured
 * and ready for production-grade deployment.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.v1-internal') });

const REQUIRED_VARS = [
  'PORT',
  'REQUIRE_AUTH',
  'SIMPLEBEACON_INTERNAL_DASHBOARD',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN'
];

const OPTIONAL_VARS = [
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_DB',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_PASSWORD',
  'CORS_ORIGIN',
  'STRIPE_SECRET_KEY',
  'ANALYZE_ALLOWED_ROOTS'
];

const PHASE2_VARS = [
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_DB',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_PASSWORD'
];

function checkEnvironmentVariable(name, required = true) {
  const value = process.env[name];
  
  if (!value) {
    if (required) {
      console.error(`❌ REQUIRED: ${name} is not set`);
      return false;
    } else {
      console.warn(`⚠️  OPTIONAL: ${name} is not set`);
      return true;
    }
  }
  
  // Check for placeholder values
  if (value.includes('your-') || value.includes('change-in-production') || value.includes('replace-with')) {
    if (required) {
      console.error(`❌ REQUIRED: ${name} contains placeholder value: "${value}"`);
      return false;
    } else {
      console.warn(`⚠️  OPTIONAL: ${name} contains placeholder value: "${value}"`);
      return true;
    }
  }
  
  // Check JWT secrets length
  if (name.includes('JWT_SECRET') && value.length < 32) {
    console.error(`❌ REQUIRED: ${name} must be at least 32 characters (current: ${value.length})`);
    return false;
  }
  
  console.log(`✅ ${name} is configured`);
  return true;
}

function checkFileExists(filePath, description) {
  try {
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${description} exists: ${filePath}`);
      return true;
    } else {
      console.error(`❌ ${description} missing: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error checking ${description}: ${error.message}`);
    return false;
  }
}

function checkDockerCompose() {
  const dockerComposePath = path.join(process.cwd(), 'docker-compose.phase2.yml');
  
  if (!fs.existsSync(dockerComposePath)) {
    console.warn(`⚠️  Phase 2 Docker Compose file not found: ${dockerComposePath}`);
    console.warn('    Run "npm run phase2:infra" to create Phase 2 infrastructure');
    return false;
  }
  
  console.log(`✅ Phase 2 Docker Compose file exists: ${dockerComposePath}`);
  return true;
}

function checkAuthConfiguration() {
  const requireAuth = process.env.REQUIRE_AUTH;
  const jwtSecret = process.env.JWT_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
  
  if (requireAuth === 'true') {
    if (!jwtSecret || jwtSecret.length < 32) {
      console.error('❌ REQUIRE_AUTH=true requires JWT_SECRET (32+ characters)');
      return false;
    }
    
    if (!jwtRefreshSecret || jwtRefreshSecret.length < 32) {
      console.error('❌ REQUIRE_AUTH=true requires JWT_REFRESH_SECRET (32+ characters)');
      return false;
    }
    
    console.log('✅ Authentication configuration is valid');
    return true;
  }
  
  console.log('ℹ️  Authentication is not required (REQUIRE_AUTH != true)');
  return true;
}

function checkPhase2Readiness() {
  const phase2Vars = PHASE2_VARS.filter(varName => process.env[varName]);
  
  if (phase2Vars.length === 0) {
    console.warn('⚠️  No Phase 2 variables configured - Phase 2 features will be disabled');
    return false;
  }
  
  const allPhase2VarsSet = PHASE2_VARS.every(varName => process.env[varName]);
  
  if (allPhase2VarsSet) {
    console.log('✅ All Phase 2 variables configured');
    return true;
  } else {
    console.warn('⚠️  Some Phase 2 variables missing - Phase 2 features may be limited');
    return false;
  }
}

function main() {
  console.log('🔍 Verifying v1-Internal Profile Configuration\n');
  
  let allChecksPassed = true;
  
  // Check required environment variables
  console.log('📋 Checking required environment variables:');
  for (const varName of REQUIRED_VARS) {
    if (!checkEnvironmentVariable(varName, true)) {
      allChecksPassed = false;
    }
  }
  
  console.log('\n📋 Checking optional environment variables:');
  for (const varName of OPTIONAL_VARS) {
    checkEnvironmentVariable(varName, false);
  }
  
  console.log('\n📁 Checking required files:');
  if (!checkFileExists('.env.v1-internal', 'v1-internal environment file')) {
    allChecksPassed = false;
  }
  
  if (!checkFileExists('server/index.cjs', 'Server entry point')) {
    allChecksPassed = false;
  }
  
  if (!checkFileExists('docs/v1-internal-runbook.md', 'v1-internal runbook')) {
    allChecksPassed = false;
  }
  
  console.log('\n🔧 Checking authentication configuration:');
  if (!checkAuthConfiguration()) {
    allChecksPassed = false;
  }
  
  console.log('\n🐳 Checking Phase 2 infrastructure:');
  checkDockerCompose();
  checkPhase2Readiness();
  
  console.log('\n📊 Summary:');
  if (allChecksPassed) {
    console.log('✅ All critical checks passed - v1-internal profile is ready!');
    console.log('\n🚀 Next steps:');
    console.log('   1. Start Phase 2 infrastructure: npm run phase2:infra');
    console.log('   2. Start the platform: npm run dashboard:v1-internal');
    console.log('   3. Run smoke tests: npm run smoke:test');
    process.exit(0);
  } else {
    console.error('❌ Some checks failed - please fix the issues above');
    console.log('\n📚 Documentation:');
    console.log('   - Read: docs/v1-internal-runbook.md');
    console.log('   - Reference: .env.v1-internal.example');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkEnvironmentVariable, checkAuthConfiguration, checkPhase2Readiness };
