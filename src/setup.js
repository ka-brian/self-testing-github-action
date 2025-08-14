#!/usr/bin/env node

/**
 * Setup script to install native dependencies required by the action
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🔧 Setting up PR Test Generator dependencies...');

try {
  // Get the action root directory (parent of dist)
  const actionRoot = path.join(__dirname, '..');
  
  // Install sharp for Linux
  console.log('📦 Installing sharp for Linux...');
  execSync('npm install --include=optional sharp', { 
    stdio: 'inherit',
    cwd: actionRoot 
  });

  // Install Playwright browsers
  console.log('🎭 Installing Playwright browsers...');
  execSync('npx playwright install --with-deps', { 
    stdio: 'inherit',
    cwd: actionRoot 
  });

  console.log('✅ Setup completed successfully!');
} catch (error) {
  console.error('❌ Setup failed:', error.message);
  process.exit(1);
}