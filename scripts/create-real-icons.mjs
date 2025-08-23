import fs from 'fs';
import path from 'path';

// Create a simple but valid PNG file for each size
// These are minimal PNG files with actual pixel data

const createMinimalPNG = (width, height, color = [76, 175, 80, 255]) => {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // IHDR chunk
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); // length
  ihdr.write('IHDR', 4);
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr.writeUInt8(8, 16); // bit depth
  ihdr.writeUInt8(2, 17); // color type (RGB)
  ihdr.writeUInt8(0, 18); // compression
  ihdr.writeUInt8(0, 19); // filter
  ihdr.writeUInt8(0, 20); // interlace
  
  // Calculate CRC for IHDR
  const crc32Table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crc32Table[i] = c;
  }
  
  const crc = (data) => {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
      crc = crc32Table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  };
  
  const ihdrCrc = crc(ihdr.slice(4, 21));
  ihdr.writeUInt32BE(ihdrCrc, 21);
  
  // Simple IDAT chunk - solid color
  const pixelData = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixelData.length; i += 3) {
    pixelData[i] = color[0];     // R
    pixelData[i + 1] = color[1]; // G
    pixelData[i + 2] = color[2]; // B
  }
  
  // Add filter bytes (0 for no filter)
  const filteredData = Buffer.alloc(height + pixelData.length);
  for (let y = 0; y < height; y++) {
    filteredData[y * (width * 3 + 1)] = 0; // filter byte
    pixelData.copy(filteredData, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  }
  
  // Compress with minimal deflate (uncompressed blocks)
  const compressed = Buffer.alloc(filteredData.length + Math.ceil(filteredData.length / 65535) * 5 + 6);
  let compressedPos = 0;
  
  // Deflate header
  compressed[compressedPos++] = 0x78;
  compressed[compressedPos++] = 0x01;
  
  let sourcePos = 0;
  while (sourcePos < filteredData.length) {
    const blockSize = Math.min(65535, filteredData.length - sourcePos);
    const isLast = sourcePos + blockSize >= filteredData.length;
    
    compressed[compressedPos++] = isLast ? 0x01 : 0x00;
    compressed.writeUInt16LE(blockSize, compressedPos);
    compressedPos += 2;
    compressed.writeUInt16LE(~blockSize & 0xFFFF, compressedPos);
    compressedPos += 2;
    
    filteredData.copy(compressed, compressedPos, sourcePos, sourcePos + blockSize);
    compressedPos += blockSize;
    sourcePos += blockSize;
  }
  
  // Adler32 checksum
  let a = 1, b = 0;
  for (let i = 0; i < filteredData.length; i++) {
    a = (a + filteredData[i]) % 65521;
    b = (b + a) % 65521;
  }
  compressed.writeUInt32BE((b << 16) | a, compressedPos);
  compressedPos += 4;
  
  // IDAT chunk
  const idat = Buffer.alloc(compressedPos + 12);
  idat.writeUInt32BE(compressedPos, 0);
  idat.write('IDAT', 4);
  compressed.copy(idat, 8, 0, compressedPos);
  
  const idatCrc = crc(idat.slice(4, 8 + compressedPos));
  idat.writeUInt32BE(idatCrc, 8 + compressedPos);
  
  // IEND chunk
  const iend = Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]);
  
  return Buffer.concat([signature, ihdr, idat.slice(0, 8 + compressedPos + 4), iend]);
};

const iconsDir = path.join(process.cwd(), 'public', 'icons');
const sizes = [16, 32, 48, 128];

console.log('Creating proper PNG icons...');

sizes.forEach(size => {
  const pngData = createMinimalPNG(size, size);
  const filename = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(filename, pngData);
  console.log(`✓ Created ${filename} (${pngData.length} bytes)`);
});

console.log('✅ All icons created successfully!');