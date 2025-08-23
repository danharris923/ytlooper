import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const distPath = path.join(process.cwd(), 'dist');
const zipPath = path.join(process.cwd(), 'punch-looper.zip');

// Check if dist folder exists
if (!fs.existsSync(distPath)) {
  console.error('❌ dist/ folder not found. Run "npm run build" first.');
  process.exit(1);
}

// Remove existing zip
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
  console.log('🗑️  Removed existing zip file');
}

try {
  // Create zip using system zip command (works on most systems)
  console.log('📦 Creating zip file...');
  
  // Change to dist directory and zip contents
  const command = process.platform === 'win32' 
    ? `cd dist && tar -a -c -f ../punch-looper.zip *`
    : `cd dist && zip -r ../punch-looper.zip .`;
  
  execSync(command, { stdio: 'inherit' });
  
  console.log('✅ Created punch-looper.zip');
  console.log('📁 Ready to upload to Chrome Web Store or load as unpacked extension');
  
  // Show zip contents
  const zipSizeKB = Math.round(fs.statSync(zipPath).size / 1024);
  console.log(`📊 Package size: ${zipSizeKB} KB`);
  
} catch (error) {
  console.error('❌ Failed to create zip:', error.message);
  
  // Fallback: List files that would be zipped
  console.log('📂 Files in dist/:');
  const distFiles = fs.readdirSync(distPath, { recursive: true });
  distFiles.forEach(file => console.log(`  - ${file}`));
  
  process.exit(1);
}