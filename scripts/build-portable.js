#!/usr/bin/env node

/**
 * Build script for creating truly portable executable
 * Ensures all dependencies are bundled and no system dependencies are required
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Building Portable Image Manager...');

// Clean previous builds
console.log('🧹 Cleaning previous builds...');
try {
  execSync('rimraf dist release', { stdio: 'inherit' });
} catch (error) {
  // Directory might not exist, continue
}

// Build main and renderer processes
console.log('🔨 Building main process...');
execSync('npm run build:main', { stdio: 'inherit' });

console.log('🎨 Building renderer process...');
execSync('npm run build:renderer', { stdio: 'inherit' });

// Copy main files after build
console.log('📋 Copying main files...');
if (fs.existsSync('dist/main-simple.js')) {
  fs.copyFileSync('dist/main-simple.js', 'dist/main.js');
  console.log('✅ Copied main-simple.js to main.js');
}
if (fs.existsSync('dist/preload-simple.js')) {
  fs.copyFileSync('dist/preload-simple.js', 'dist/preload.js');
  console.log('✅ Copied preload-simple.js to preload.js');
}

// Verify critical files exist
const criticalFiles = [
  'dist/main.js',
  'dist/renderer/index.html',
  'Assets/Logo.ico'
];

console.log('✅ Verifying build artifacts...');
for (const file of criticalFiles) {
  if (!fs.existsSync(file)) {
    console.error(`❌ Critical file missing: ${file}`);
    process.exit(1);
  }
}

// Check for native dependencies that need special handling
console.log('🔍 Checking native dependencies...');
const nativeDeps = ['sharp', '@ffmpeg/ffmpeg'];
for (const dep of nativeDeps) {
  const depPath = path.join('node_modules', dep);
  if (!fs.existsSync(depPath)) {
    console.warn(`⚠️  Native dependency not found: ${dep}`);
  } else {
    console.log(`✅ Native dependency found: ${dep}`);
  }
}

// Build portable executable
console.log('📦 Creating portable executable...');
try {
  execSync('electron-builder --config electron-builder.config.js --win', {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production'
    }
  });
  
  console.log('🎉 Portable executable created successfully!');
  console.log('📁 Check the "release" directory for your portable app.');
  
  // List created files
  const releaseDir = 'release';
  if (fs.existsSync(releaseDir)) {
    const files = fs.readdirSync(releaseDir);
    console.log('\n📋 Created files:');
    files.forEach(file => {
      const filePath = path.join(releaseDir, file);
      const stats = fs.statSync(filePath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`  • ${file} (${sizeInMB} MB)`);
    });
  }
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

console.log('\n✨ Build completed successfully!');
console.log('💡 The portable app requires no installation and leaves no traces on the host system.');