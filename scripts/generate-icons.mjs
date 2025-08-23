import fs from 'fs';
import path from 'path';

// Simple SVG icon for the looper - circular arrow with play symbol
const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4CAF50;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2196F3;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background circle -->
  <circle cx="64" cy="64" r="56" fill="url(#grad)" stroke="#333" stroke-width="3"/>
  
  <!-- Loop arrow -->
  <path d="M 32 44 A 20 20 0 1 1 96 44" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
  <path d="M 88 36 L 96 44 L 88 52" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
  
  <!-- Play triangle -->
  <path d="M 52 56 L 52 72 L 68 64 Z" fill="#fff"/>
  
  <!-- A and B markers -->
  <text x="40" y="90" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#fff">A</text>
  <text x="80" y="90" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#fff">B</text>
</svg>`;

// Create the icons directory
const iconsDir = path.join(process.cwd(), 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Write the SVG file
fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgContent.trim());

console.log('SVG icon created. Note: You will need to convert this to PNG files manually or using a tool like Inkscape:');
console.log('- icon-16.png (16x16)');
console.log('- icon-32.png (32x32)');
console.log('- icon-48.png (48x48)');  
console.log('- icon-128.png (128x128)');
console.log('\\nFor now, creating placeholder PNG files...');

// Create simple placeholder PNG files (base64 encoded 1x1 transparent pixels)
const transparentPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

[16, 32, 48, 128].forEach(size => {
  const buffer = Buffer.from(transparentPng, 'base64');
  fs.writeFileSync(path.join(iconsDir, `icon-${size}.png`), buffer);
});

console.log('Placeholder PNG files created.');