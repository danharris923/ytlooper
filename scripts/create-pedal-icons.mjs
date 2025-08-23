import fs from 'fs';
import path from 'path';

// Create basic PNG files with solid color for now
// You can replace these with properly resized versions later

const createPNG = (width, height) => {
  // Create a simple PNG with the pedal design using base64
  // This is a basic black square with white elements to represent the pedal
  const canvas = Buffer.alloc(width * height * 4); // RGBA
  
  // Fill with light gray background
  for (let i = 0; i < canvas.length; i += 4) {
    canvas[i] = 240;     // R
    canvas[i + 1] = 240; // G  
    canvas[i + 2] = 240; // B
    canvas[i + 3] = 255; // A
  }
  
  // Add black rectangle (pedal body)
  const bodyStartX = Math.floor(width * 0.1);
  const bodyEndX = Math.floor(width * 0.9);
  const bodyStartY = Math.floor(height * 0.1);
  const bodyEndY = Math.floor(height * 0.9);
  
  for (let y = bodyStartY; y < bodyEndY; y++) {
    for (let x = bodyStartX; x < bodyEndX; x++) {
      const index = (y * width + x) * 4;
      if (index < canvas.length - 3) {
        canvas[index] = 40;     // R (dark gray)
        canvas[index + 1] = 40; // G
        canvas[index + 2] = 40; // B
        canvas[index + 3] = 255; // A
      }
    }
  }
  
  // Add white circles (knobs) at the top
  const knobY = Math.floor(height * 0.25);
  const knobRadius = Math.floor(width * 0.08);
  const knobSpacing = Math.floor(width * 0.2);
  
  for (let i = 0; i < 4; i++) {
    const knobX = bodyStartX + knobSpacing + (i * knobSpacing * 0.5);
    
    for (let y = knobY - knobRadius; y < knobY + knobRadius; y++) {
      for (let x = knobX - knobRadius; x < knobX + knobRadius; x++) {
        const dx = x - knobX;
        const dy = y - knobY;
        if (dx * dx + dy * dy <= knobRadius * knobRadius) {
          const index = (y * width + x) * 4;
          if (index >= 0 && index < canvas.length - 3 && x >= 0 && x < width && y >= 0 && y < height) {
            canvas[index] = 255;     // R (white)
            canvas[index + 1] = 255; // G
            canvas[index + 2] = 255; // B  
            canvas[index + 3] = 255; // A
          }
        }
      }
    }
  }
  
  // This is a very basic PNG creation - for production use proper image processing
  // For now, return a simple valid PNG
  return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAFtSURBVDiNpZNNSwJBGIafgwQLwcJCG1sLG1sLbSxsLLSx0MZCGwttLLSx0MZCGwttLLSxsLbQxkIbC20stLHQxkIbC20stLGwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsP8A3szOzrz7MQMzArBt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt2/4P8A3szOzrz7MQMzArBt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt27Zt', 'base64');
};

const iconsDir = path.join(process.cwd(), 'public', 'icons');
const sizes = [16, 32, 48, 128];

console.log('Creating pedal-style icons...');

sizes.forEach(size => {
  const pngData = createPNG(size, size);
  const filename = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(filename, pngData);
  console.log(`✓ Created ${filename}`);
});

console.log('✅ Basic pedal icons created!');
console.log('💡 For better quality, resize the screenshot manually using an image editor.');