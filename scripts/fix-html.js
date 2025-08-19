#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing HTML for Electron compatibility...');

const htmlPath = path.join(__dirname, '../dist/renderer/index.html');

if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  
  // Remove type="module" from script tags
  html = html.replace(/type="module"\s+crossorigin\s+/g, '');
  html = html.replace(/type="module"\s+/g, '');
  
  fs.writeFileSync(htmlPath, html);
  console.log('✅ HTML fixed for Electron compatibility');
} else {
  console.error('❌ HTML file not found:', htmlPath);
}
