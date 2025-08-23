# 🎵 Punch Looper

A production-grade Chrome MV3 extension that adds A/B loop functionality to any HTML5 `<video>` or `<audio>` element. Experience the feel of a looper pedal right in your browser.

## Features

- **Double-tap A/B looping**: Tap once to set A, tap again within 450ms to set B and start looping
- **Hold-to-define mode**: Hold the looper key to set A, release to set B and loop
- **Instant musical loops**: Uses `requestAnimationFrame` with tight edge detection and latency compensation
- **Smart media detection**: Automatically finds and prefers currently-playing media
- **SPA navigation support**: Works on sites like YouTube with in-app navigation
- **Minimal UI**: Subtle HUD that only appears during actions and auto-hides
- **Pitch preservation**: Maintains audio pitch during rate changes where supported
- **Rate control**: Fine-tune playback speed with keyboard shortcuts

## Installation

### From Chrome Web Store
*(Coming soon)*

### Developer Installation
1. Download or clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the extension
4. Open Chrome and navigate to `chrome://extensions/`
5. Enable "Developer mode" in the top right
6. Click "Load unpacked" and select the `dist/` folder

## Usage

### Basic Looping
1. Navigate to any page with video or audio (YouTube, course sites, etc.)
2. **Double-tap `L`** (default key):
   - First tap sets point A (punch-in)
   - Second tap (within 450ms) sets point B (punch-out) and starts looping
3. **Single tap `L`** while looping to stop

### Hold-to-Define Mode
1. **Hold down `L`** to mark point A
2. **Release `L`** to mark point B and start looping immediately
3. Great for capturing live moments or precise timing

### Advanced Controls
- **Shift + P**: Clear A/B points
- **Shift + =**: Increase playback rate by 0.05 (max 4.0x)
- **Shift + -**: Decrease playback rate by 0.05 (min 0.25x)

All shortcuts are ignored when typing in input fields or contentEditable areas.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `L` `L` (double-tap) | Set A→B points and start loop |
| `L` (while looping) | Stop loop |
| `L` (hold) | Hold-to-define: A on press, B on release |
| `Shift` + `P` | Clear A/B points |
| `Shift` + `=` | Increase playback rate (+0.05) |
| `Shift` + `-` | Decrease playback rate (-0.05) |

## Configuration

Access the options page via `chrome://extensions/` → Punch Looper → Options.

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| **Looper Key** | L | Key used for loop controls |
| **Double-tap Window** | 450ms | Max time between taps for double-tap |
| **Latency Compensation** | 30ms | Pre-roll time to reduce perceived latency |
| **Loop Edge Epsilon** | 10ms | Precision threshold for loop detection |
| **Hold-to-Define** | Enabled | Allow hold-down mode for A/B setting |

### Recommended Settings
- **Music/Audio**: Latency compensation 30-50ms, epsilon 5-10ms
- **Speech/Lectures**: Latency compensation 20-30ms, epsilon 10-15ms
- **Gaming/Live**: Latency compensation 10-20ms, epsilon 5ms

## Technical Details

### Media Detection
- Prioritizes currently playing media elements
- Falls back to largest visible media element
- Automatically rescans when DOM changes (SPA support)
- Handles multiple media elements gracefully

### Loop Engine
- Single `requestAnimationFrame` loop for minimal CPU usage
- Tight edge detection with configurable epsilon
- Latency pre-roll compensation for instant-feeling restarts
- Preserves pitch where browser supports it

### Browser Compatibility
- Chrome 88+ (Manifest V3)
- Edge 88+
- Works on all sites with HTML5 media
- Handles DRM-protected content limitations gracefully

## Troubleshooting

### "No media found" message
- Ensure the page has loaded completely
- Try refreshing the page
- Some DRM-protected content may not be accessible

### Loops feel sluggish
- Increase latency compensation in options (try 40-60ms)
- Decrease epsilon for tighter loop edges (try 5-8ms)
- Check if the media element has high latency

### Shortcuts not working
- Ensure you're not typing in an input field
- Check if the page has focus (click on the video area)
- Try the hold-to-define mode instead

### SPA navigation issues
- Extension automatically detects URL changes
- May take 1-2 seconds to rescan for new media
- A/B points are reset on navigation for consistency

### Performance concerns
- Extension uses <1-2% CPU when idle
- Single RAF loop minimizes resource usage
- No background page or persistent processes

## Privacy & Security

- **No network calls**: Extension works entirely offline
- **No background page**: Only runs when tabs are active
- **Minimal permissions**: Only requires storage for settings
- **No data collection**: Zero telemetry or analytics
- **Open source**: Full source code available for audit

## Known Limitations

- DRM-protected content (Netflix, some streaming sites) may not be controllable
- Some sites may hide media elements from script access
- Audio-only content may require larger epsilon values for reliable looping
- Browsers may limit playback rate changes on certain media types

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
- Double-tap A/B looping
- Hold-to-define mode  
- Smart media detection
- SPA navigation support
- Configurable settings
- Rate control shortcuts
- Minimal CPU usage design