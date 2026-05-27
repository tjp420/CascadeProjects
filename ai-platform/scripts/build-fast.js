#!/usr/bin/env node

/**
 * Fast Build Script for AI Platform
 * Provides different build options based on use case
 */

const { spawn } = require('child_process');
const path = require('path');

const BUILD_OPTIONS = {
  'simple': {
    name: 'Simple HTTP Server',
    description: 'Fastest option - serves static files directly',
    command: 'node',
    args: ['server/simple_http_server.js'],
    port: 3000,
    url: 'http://localhost:3000/'
  },
  'express': {
    name: 'Simplebeacon Server',
    description: 'Product server with scan APIs, billing, and dashboard (port 54355)',
    command: 'node',
    args: ['simplebeacon-server.js'],
    port: 54355,
    url: 'http://localhost:54355/'
  },
  'stripe-demo': {
    name: 'Legacy Stripe Demo Server',
    description: 'Deprecated demo server on port 3002',
    command: 'node',
    args: ['src/server/index.js'],
    port: 3002,
    url: 'http://localhost:3002'
  },
  'webpack': {
    name: 'Webpack Development',
    description: 'Development server with hot reload',
    command: 'npx',
    args: ['webpack', 'serve', '--mode', 'development'],
    port: 8080,
    url: 'http://localhost:8080',
    cwd: 'web'
  },
  'vite': {
    name: 'Vite Development',
    description: 'Modern development server',
    command: 'npx',
    args: ['vite'],
    port: 3000,
    url: 'http://localhost:3000'
  }
};

function printUsage() {
  console.log('\n🚀 AI Platform Fast Build Script\n');
  console.log('Usage: node scripts/build-fast.js [option]\n');
  
  console.log('Available options:\n');
  Object.entries(BUILD_OPTIONS).forEach(([key, option]) => {
    console.log(`  ${key.padEnd(10)} - ${option.name}`);
    console.log(`               ${option.description}`);
    console.log(`               URL: ${option.url}\n`);
  });
  
  console.log('Examples:\n');
  console.log('  node scripts/build-fast.js simple    # Fastest start');
  console.log('  node scripts/build-fast.js express    # Full backend');
  console.log('  node scripts/build-fast.js webpack    # Development mode');
}

function runBuild(option) {
  const buildConfig = BUILD_OPTIONS[option];
  
  if (!buildConfig) {
    console.error(`❌ Unknown option: ${option}`);
    printUsage();
    process.exit(1);
  }

  console.log(`🚀 Starting ${buildConfig.name}...`);
  console.log(`📡 Server will be available at: ${buildConfig.url}\n`);

  const cwd = buildConfig.cwd ? path.resolve(process.cwd(), buildConfig.cwd) : process.cwd();
  
  const child = spawn(buildConfig.command, buildConfig.args, {
    stdio: 'inherit',
    cwd: cwd
  });

  child.on('error', (error) => {
    console.error(`❌ Failed to start ${buildConfig.name}:`, error.message);
    process.exit(1);
  });

  child.on('close', (code) => {
    console.log(`\n⏹️  ${buildConfig.name} stopped with code ${code}`);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping server...');
    child.kill('SIGINT');
  });
}

// Main execution
const option = process.argv[2];

if (!option || option === '--help' || option === '-h') {
  printUsage();
  process.exit(0);
}

runBuild(option.toLowerCase());
