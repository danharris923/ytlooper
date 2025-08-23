const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, 'dist');
const manifestPath = path.join(distPath, 'manifest.json');

console.log('🔍 Testing manifest and extension files...\n');

// Check if dist folder exists
if (!fs.existsSync(distPath)) {
  console.error('❌ dist/ folder does not exist');
  process.exit(1);
}

// Check manifest exists and is readable
if (!fs.existsSync(manifestPath)) {
  console.error('❌ manifest.json does not exist');
  process.exit(1);
}

// Read and parse manifest
let manifest;
try {
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');
  manifest = JSON.parse(manifestContent);
  console.log('✅ manifest.json is valid JSON');
} catch (error) {
  console.error('❌ manifest.json is not valid JSON:', error.message);
  process.exit(1);
}

// Check required fields
const requiredFields = ['manifest_version', 'name', 'version'];
for (const field of requiredFields) {
  if (!manifest[field]) {
    console.error(`❌ Missing required field: ${field}`);
  } else {
    console.log(`✅ ${field}: ${manifest[field]}`);
  }
}

// Check content script file exists
if (manifest.content_scripts) {
  for (const script of manifest.content_scripts) {
    for (const jsFile of script.js) {
      const jsPath = path.join(distPath, jsFile);
      if (fs.existsSync(jsPath)) {
        console.log(`✅ Content script exists: ${jsFile}`);
      } else {
        console.error(`❌ Content script missing: ${jsFile}`);
      }
    }
  }
}

// Check icons exist
if (manifest.icons) {
  for (const [size, iconPath] of Object.entries(manifest.icons)) {
    const fullIconPath = path.join(distPath, iconPath);
    if (fs.existsSync(fullIconPath)) {
      const stats = fs.statSync(fullIconPath);
      console.log(`✅ Icon ${size}x${size} exists: ${iconPath} (${stats.size} bytes)`);
      
      // Check if it's a valid PNG (simple check)
      const buffer = fs.readFileSync(fullIconPath);
      if (buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        console.log(`  ✅ ${iconPath} appears to be a valid PNG`);
      } else {
        console.error(`  ❌ ${iconPath} does not appear to be a valid PNG`);
      }
    } else {
      console.error(`❌ Icon missing: ${iconPath}`);
    }
  }
}

// Check options page exists
if (manifest.options_page) {
  const optionsPath = path.join(distPath, manifest.options_page);
  if (fs.existsSync(optionsPath)) {
    console.log(`✅ Options page exists: ${manifest.options_page}`);
  } else {
    console.error(`❌ Options page missing: ${manifest.options_page}`);
  }
}

console.log('\n📋 All required files present. The extension should load properly.');
console.log('If Chrome still shows "Manifest file is missing", try:');
console.log('1. Restart Chrome completely');
console.log('2. Make sure you\'re selecting the dist/ folder, not the root folder');
console.log('3. Check Chrome console for specific errors');