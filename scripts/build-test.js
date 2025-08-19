#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Building test version...');

// 1. Compile TypeScript
console.log('📝 Compiling TypeScript...');
const { execSync } = require('child_process');
execSync('tsc -p tsconfig.main.json', { stdio: 'inherit' });

// 2. Copy test.html to dist
console.log('📄 Copying test.html...');
const srcPath = path.join(__dirname, '../src/renderer/test.html');
const destPath = path.join(__dirname, '../dist/renderer/test.html');

// Ensure directory exists
const destDir = path.dirname(destPath);
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

fs.copyFileSync(srcPath, destPath);

// 3. Copy main-test.js to main.js for electron-builder
console.log('🔄 Setting up main entry point...');
const mainTestPath = path.join(__dirname, '../dist/main-test.js');
const mainPath = path.join(__dirname, '../dist/main.js');

if (fs.existsSync(mainTestPath)) {
  fs.copyFileSync(mainTestPath, mainPath);
  console.log('✅ Copied main-test.js to main.js');
} else {
  console.error('❌ main-test.js not found!');
  process.exit(1);
}

console.log('🎉 Test build completed!');
