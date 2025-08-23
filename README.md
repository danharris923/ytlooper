# 🎵 Punch Looper

A Chrome extension that adds A/B looping functionality to HTML5 video and audio elements, like a guitar looper pedal.

![Punch Looper Icon](public/icons/icon-128.png)

## Features

- **Simple Controls**: Use `[` and `]` keys to set loop points, `\` to stop
- **Professional Pitch Control**: Independent pitch shifting without affecting speed
- **High-Quality Audio Engine**: Web Audio API with real-time processing
- **Speed Control**: Change playback speed while maintaining pitch
- **Works Everywhere**: YouTube, Vimeo, and any site with HTML5 media
- **Seamless Looping**: Edge bleeding for smooth transitions
- **Smart Detection**: Automatically finds the active media element
- **Low CPU Usage**: Efficient `requestAnimationFrame` loop engine
- **Built-in Metronome**: Helps with timing and rhythm practice
- **Fine Control**: Precise 0.1 semitone pitch adjustments
- **Boss RC-Style GUI**: Authentic guitar pedal interface with mouse control
- **Interactive Knobs**: Drag to adjust pitch, speed, and volume
- **LED Status Indicators**: Visual feedback for A/B points and loop state
- **Draggable Interface**: Position the pedal GUI anywhere on screen
- **Configurable**: Adjust timing and audio settings

## Installation

1. Download or clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the extension
4. Open Chrome and go to `chrome://extensions/`
5. Enable "Developer mode"
6. Click "Load unpacked" and select the `dist/` folder

## Usage

### Keyboard Shortcuts

#### Basic Looping
- **`[`** - Set point A (punch in)
- **`]`** - Set point B (punch out) and start looping  
- **`\`** - Stop loop

#### Audio Control (NEW! 🎛️)
- **`Shift + =`** - Increase playback speed
- **`Shift + -`** - Decrease playback speed
- **`Shift + ↑`** - Pitch up (0.5 semitones)
- **`Shift + ↓`** - Pitch down (0.5 semitones)
- **`Shift + ←`** - Fine pitch down (0.1 semitones)
- **`Shift + →`** - Fine pitch up (0.1 semitones)
- **`Shift + R`** - Reset pitch and speed to normal
- **`Shift + E`** - Toggle high-quality audio engine

#### Loop Edge Adjustment
- **`Shift + <`** - Move point A backward
- **`Shift + >`** - Move point A forward
- **`Shift + :`** - Move point B backward
- **`Shift + "`** - Move point B forward

#### Metronome
- **`Shift + M`** - Toggle metronome

#### Guitar Pedal GUI (NEW! 🎸)
- **`Shift + G`** - Toggle YT Looper pedal interface
- **Extension Icon Click** - Opens the pedal GUI automatically

### How It Works

**Keyboard Control (Traditional)**
1. Navigate to any page with video/audio (like YouTube)
2. Press `[` to mark the start of your loop (point A)
3. Press `]` to mark the end and immediately start looping (point B)
4. Use `Shift + ↑/↓` to adjust pitch, `Shift + +/-` to adjust speed
5. Press `Shift + E` to enable the high-quality audio engine for better pitch control
6. Press `\` to stop the loop

**Guitar Pedal GUI (Mouse Control)**
1. Click the extension icon in the toolbar OR press `Shift + G` to show the pedal interface
2. Click the large square footswitch to set A, then B, then start looping
3. Drag the **PITCH** knob to adjust pitch (maintains speed)
4. Drag the **TEMPO** knob to adjust speed (maintains pitch)  
5. Drag the **LEVEL** knob to control volume
6. Click the blue **HQ** LED to toggle the high-quality audio engine
7. Click the **SET** gear to open advanced settings (latency, edge bleed, etc.)
8. Drag the pedal to reposition it anywhere on screen

The extension automatically detects the active media element and works seamlessly with single-page applications.

### Audio Engine Modes

**Basic Mode (Default)**
- Uses native HTML5 playback rate control
- Pitch and speed are linked (changing speed affects pitch)
- Lower CPU usage, compatible everywhere

**High-Quality Mode (Shift + E)**
- Uses Web Audio API with AudioWorklet processing
- Independent pitch and speed control
- Professional-grade audio processing
- Slightly higher CPU usage, requires modern browser

### Why Better Than YouTube's Built-in Speed Control?

YouTube's native speed control has a major limitation: changing speed also changes pitch, creating that "chipmunk" or "slow-motion" effect that sounds terrible for music practice. 

**Punch Looper solves this by:**
- **Independent Control**: Change speed without affecting pitch, or pitch without affecting speed
- **High-Quality Processing**: Uses advanced Web Audio API algorithms instead of simple playback rate changes
- **Musical Intervals**: Pitch control in musically meaningful semitone increments
- **Fine Control**: 0.1 semitone precision for perfect tuning
- **Professional Interface**: Authentic Boss RC loop station GUI with tactile knob controls
- **Mouse + Keyboard**: Use whichever control method feels more natural
- **Professional Features**: Built-in metronome, loop edge adjustment, and more

### GUI Design

The pedal interface is inspired by professional looper pedals with:
- **Authentic red and black color scheme** 
- **Chrome knobs** with realistic shadows and gradients
- **Status LEDs** (green for A/B points, red for loop, blue for HQ engine)
- **Large square footswitch** for professional feel
- **Settings gear** for quick access to latency and timing controls
- **Stereo input jacks** visual detail
- **YTLOOPER branding** and professional typography
- **Draggable positioning** - place it wherever works best
- **Taller enclosure** for better proportions and more authentic look

## Settings

**Quick Access:** Click the settings gear (⚙️) on the pedal interface  
**Advanced:** Go to `chrome://extensions/` and click "Options" on the extension

### Quick Settings (Pedal Interface)
- **Latency Compensation** - Adjust timing to compensate for audio delay
- **Loop Edge Bleed** - Control overlap before/after loop points for smoother transitions  
- **Double Tap Window** - Set time window for double-tap to reset loops

### Full Options Page
Access the complete settings interface for additional configuration options.

### Audio Engine Settings

- **Latency Compensation**: Pre-roll time to compensate for playback latency (0-100ms)
- **Loop Edge Epsilon**: Precision threshold for loop edge detection (1-50ms)  
- **Edge Bleed**: Overlap before A and after B for smoother loops (0-300ms)

## Technical Details

- **Manifest V3** Chrome extension
- **TypeScript** with ES2020 target
- **Vite** build system
- **requestAnimationFrame** for efficient looping
- **Event capture phase** for reliable key interception
- **MutationObserver** for SPA navigation detection
- **Chrome Storage Sync** for settings persistence

## Browser Support

- Chrome 88+ (Manifest V3 support required)
- Chromium-based browsers (Edge, Brave, etc.)

## Development

### Setup
```bash
npm install
npm run dev    # Watch mode for development
npm run build  # Production build
npm run lint   # Run ESLint
npm run zip    # Create distribution package
```

### Project Structure
```
├── src/
│   ├── content.ts         # Main content script
│   └── options/           # Options page
│       ├── options.html
│       ├── options.css
│       └── options.ts
├── public/
│   ├── manifest.json      # Extension manifest
│   └── icons/            # Extension icons
└── dist/                 # Build output
```

### Building
The build process:
1. Compiles TypeScript to ES2020
2. Bundles with Vite/Rollup
3. Copies static assets
4. Outputs to `dist/` ready for Chrome

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run lint` and `npm run build`
5. Test the extension thoroughly
6. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Changelog

### v1.0.0
- Initial release
- A/B looping with `[` `]` `\` keys
- Smart media detection
- Edge bleeding for seamless loops
- Modern settings interface
- Works on YouTube, Vimeo, and all HTML5 media