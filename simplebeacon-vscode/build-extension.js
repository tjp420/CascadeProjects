#!/usr/bin/env node

/**
 * Build script for SimpleBeacon VSCode extension
 * Compiles TypeScript and creates VSIX package
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Building SimpleBeacon VSCode Extension...');

try {
  // Clean previous build
  console.log('🧹 Cleaning previous build...');
  if (fs.existsSync('./out')) {
    fs.rmSync('./out', { recursive: true, force: true });
  }
  if (fs.existsSync('./simplebeacon-*.vsix')) {
    const files = fs.readdirSync('.').filter(f => f.startsWith('simplebeacon-') && f.endsWith('.vsix'));
    files.forEach(f => fs.unlinkSync(f));
  }

  // Compile TypeScript
  console.log('📦 Compiling TypeScript...');
  execSync('npm run compile', { stdio: 'inherit' });

  // Check if compilation was successful
  if (!fs.existsSync('./out/extension.js')) {
    throw new Error('TypeScript compilation failed - extension.js not found');
  }

  // Create VSIX package
  console.log('📦 Creating VSIX package...');
  execSync('npx vsce package', { stdio: 'inherit' });

  // Find the created VSIX file
  const files = fs.readdirSync('.').filter(f => f.startsWith('simplebeacon-') && f.endsWith('.vsix'));
  if (files.length === 0) {
    throw new Error('VSIX package creation failed - no .vsix file found');
  }

  const vsixFile = files[0];
  console.log(`✅ Extension built successfully: ${vsixFile}`);
  
  // Display file info
  const stats = fs.statSync(vsixFile);
  console.log(`📊 Package size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📅 Created: ${stats.mtime.toLocaleString()}`);
  
  console.log('\n🎉 SimpleBeacon Enhanced AI Extension is ready!');
  console.log(`📦 Package: ${vsixFile}`);
  console.log('\nTo install:');
  console.log('1. Open VSCode');
  console.log('2. Go to Extensions (Ctrl+Shift+X)');
  console.log('3. Click "..." and select "Install from VSIX..."');
  console.log(`4. Choose ${vsixFile}`);

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
