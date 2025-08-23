const fs = require('fs');
const path = require('path');

// Create proper base64-encoded PNG icons
function createIcon(size) {
  // Create a simple canvas-like approach using base64 PNG data
  // This creates a minimal valid PNG header + data
  
  const width = size;
  const height = size;
  
  // PNG signature
  let png = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // IHDR chunk
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); // Length
  ihdr.write('IHDR', 4); // Type
  ihdr.writeUInt32BE(width, 8); // Width
  ihdr.writeUInt32BE(height, 12); // Height
  ihdr.writeUInt8(8, 16); // Bit depth
  ihdr.writeUInt8(6, 17); // Color type (RGBA)
  ihdr.writeUInt8(0, 18); // Compression
  ihdr.writeUInt8(0, 19); // Filter
  ihdr.writeUInt8(0, 20); // Interlace
  
  // Calculate CRC for IHDR
  const crc32 = require('zlib').crc32;
  const ihdrCrc = crc32(ihdr.slice(4, 21));
  ihdr.writeUInt32BE(ihdrCrc, 21);
  
  png = Buffer.concat([png, ihdr]);
  
  // Simple IDAT chunk with a basic looper pedal design
  const pixelData = createPixelData(size);
  const compressed = require('zlib').deflateSync(pixelData);
  
  const idat = Buffer.alloc(compressed.length + 12);
  idat.writeUInt32BE(compressed.length, 0);
  idat.write('IDAT', 4);
  compressed.copy(idat, 8);
  const idatCrc = crc32(idat.slice(4, idat.length - 4));
  idat.writeUInt32BE(idatCrc, idat.length - 4);
  
  png = Buffer.concat([png, idat]);
  
  // IEND chunk
  const iend = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]);
  png = Buffer.concat([png, iend]);
  
  return png;
}

function createPixelData(size) {
  const bytesPerPixel = 4; // RGBA
  const bytesPerRow = size * bytesPerPixel + 1; // +1 for filter byte
  const data = Buffer.alloc(size * bytesPerRow);
  
  for (let y = 0; y < size; y++) {
    const rowStart = y * bytesPerRow;
    data[rowStart] = 0; // Filter type: None
    
    for (let x = 0; x < size; x++) {
      const pixelStart = rowStart + 1 + x * bytesPerPixel;
      
      // Create a simple looper pedal design
      let r = 248, g = 249, b = 250, a = 255; // Background
      
      // Pedal body
      if (x >= size * 0.15 && x <= size * 0.85 && y >= size * 0.12 && y <= size * 0.88) {
        r = 26; g = 26; b = 26; // Dark body
      }
      
      // Top control panel
      if (x >= size * 0.18 && x <= size * 0.82 && y >= size * 0.14 && y <= size * 0.34) {
        r = 42; g = 42; b = 42; // Darker panel
      }
      
      // Knobs
      const knobY = size * 0.24;
      const knobRadius = size * 0.03;
      for (let i = 0; i < 4; i++) {
        const knobX = size * (0.27 + i * 0.12);
        const dist = Math.sqrt((x - knobX) * (x - knobX) + (y - knobY) * (y - knobY));
        if (dist < knobRadius) {
          r = 224; g = 224; b = 224; // Light knob
        }
      }
      
      // Display area
      if (x >= size * 0.22 && x <= size * 0.78 && y >= size * 0.69 && y <= size * 0.84) {
        r = 240; g = 240; b = 240; // Display
      }
      
      // Loop arrows (green)
      if (y >= size * 0.39 && y <= size * 0.62) {
        // Left arrow
        if ((x >= size * 0.25 && x <= size * 0.35 && Math.abs(y - size * 0.49) < 2) ||
            (x >= size * 0.25 && x <= size * 0.27 && Math.abs(y - size * 0.47) < 1) ||
            (x >= size * 0.25 && x <= size * 0.27 && Math.abs(y - size * 0.51) < 1)) {
          r = 76; g = 175; b = 80; // Green arrow
        }
        // Right arrow  
        if ((x >= size * 0.65 && x <= size * 0.75 && Math.abs(y - size * 0.49) < 2) ||
            (x >= size * 0.73 && x <= size * 0.75 && Math.abs(y - size * 0.47) < 1) ||
            (x >= size * 0.73 && x <= size * 0.75 && Math.abs(y - size * 0.51) < 1)) {
          r = 76; g = 175; b = 80; // Green arrow
        }
      }
      
      data[pixelStart] = r;     // Red
      data[pixelStart + 1] = g; // Green  
      data[pixelStart + 2] = b; // Blue
      data[pixelStart + 3] = a; // Alpha
    }
  }
  
  return data;
}

// Create icons for all required sizes
const sizes = [16, 32, 48, 128];
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

console.log('Creating PNG icons...');

for (const size of sizes) {
  const pngData = createIcon(size);
  const filename = `icon-${size}.png`;
  fs.writeFileSync(path.join(iconsDir, filename), pngData);
  console.log(`✅ Created ${filename} (${pngData.length} bytes)`);
}

console.log('🎵 All icon files created successfully!');