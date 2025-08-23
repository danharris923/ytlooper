import fs from 'fs';
import path from 'path';

console.log('Icon resizing instructions:');
console.log('');
console.log('1. Download the icon from: https://static.thenounproject.com/png/2448655-200.png');
console.log('2. Save it as "icon-source.png" in the public/icons/ folder');
console.log('3. Use an online tool to resize it to multiple sizes:');
console.log('   - https://www.iloveimg.com/resize-image/resize-png');
console.log('   - https://imageresizer.com/');
console.log('   - Or use Photoshop/GIMP');
console.log('');
console.log('Create these sizes:');
console.log('- icon-16.png (16x16)');
console.log('- icon-32.png (32x32)');  
console.log('- icon-48.png (48x48)');
console.log('- icon-128.png (128x128)');
console.log('');
console.log('Place all files in public/icons/ then run "npm run build"');

// Check if source exists
const iconsDir = path.join(process.cwd(), 'public', 'icons');
const sourcePath = path.join(iconsDir, 'icon-source.png');

if (fs.existsSync(sourcePath)) {
  console.log('✅ Found icon-source.png');
  
  // Check for resized versions
  const sizes = [16, 32, 48, 128];
  let allExist = true;
  
  sizes.forEach(size => {
    const iconPath = path.join(iconsDir, `icon-${size}.png`);
    if (fs.existsSync(iconPath)) {
      console.log(`✅ Found icon-${size}.png`);
    } else {
      console.log(`❌ Missing icon-${size}.png`);
      allExist = false;
    }
  });
  
  if (allExist) {
    console.log('');
    console.log('🎉 All icon sizes found! Run "npm run build" to update the extension.');
  }
} else {
  console.log('❌ icon-source.png not found in public/icons/');
}