// YT Looper Theme System
// Fully customizable pedal skins with complete visual control

export interface PedalTheme {
  name: string;
  brand: string;
  model: string;
  
  // Body styling
  body: {
    background: string; // Can be gradient or solid color
    stroke: string;
    strokeWidth: number;
    borderRadius: number;
  };
  
  // Control panel (top area)
  controlPanel: {
    background: string;
    stroke: string;
    strokeWidth: number;
  };
  
  // Display screen
  display: {
    background: string;
    stroke: string;
    strokeWidth: number;
    textColor: string;
    textColorDim: string;
    fontFamily: string;
  };
  
  // Knobs
  knobs: {
    outer: string; // Gradient or color
    inner: string;
    pointer: string;
    pointerWidth: number;
    labelColor: string;
    labelFont: string;
  };
  
  // Buttons
  buttons: {
    background: string;
    stroke: string;
    iconColor: string;
    hoverBackground: string;
    activeBackground: string;
  };
  
  // LEDs
  leds: {
    off: {
      a: string;
      b: string;
      loop: string;
    };
    on: {
      a: string; // Can be gradient
      b: string;
      loop: string;
    };
    labelColor: string;
  };
  
  // Footswitch
  footswitch: {
    background: string;
    stroke: string;
    strokeWidth: number;
    textColor: string;
    textureBackground?: string; // Optional texture layer
    pressedBackground?: string;
  };
  
  // Text and labels
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    brandFont: string;
    labelFont: string;
  };
  
  // Special effects
  effects?: {
    shadow?: string;
    glow?: string;
    metallic?: boolean;
    worn?: boolean; // Vintage/worn look
  };
}

// Boss RC-1 Loop Station (Default Red)
export const bossRC1Theme: PedalTheme = {
  name: 'Boss RC-1',
  brand: 'BOSS',
  model: 'RC-1',
  
  body: {
    background: 'linear-gradient(135deg, #ff3333 0%, #dd2222 50%, #aa1111 100%)',
    stroke: '#990000',
    strokeWidth: 2,
    borderRadius: 8
  },
  
  controlPanel: {
    background: '#222',
    stroke: '#555',
    strokeWidth: 1
  },
  
  display: {
    background: '#000',
    stroke: '#00ff00',
    strokeWidth: 1,
    textColor: '#00ff00',
    textColorDim: '#00aa00',
    fontFamily: 'Courier New, monospace'
  },
  
  knobs: {
    outer: 'radial-gradient(circle at 30% 30%, #ffffff 0%, #f0f0f0 20%, #d0d0d0 60%, #b0b0b0 100%)',
    inner: '#ddd',
    pointer: '#333',
    pointerWidth: 2,
    labelColor: '#fff',
    labelFont: 'Arial, sans-serif'
  },
  
  buttons: {
    background: '#333',
    stroke: '#555',
    iconColor: '#ccc',
    hoverBackground: '#444',
    activeBackground: '#222'
  },
  
  leds: {
    off: {
      a: '#002200',
      b: '#002200',
      loop: '#331100'
    },
    on: {
      a: 'radial-gradient(circle at 50% 30%, #44ff44 0%, #00aa00 100%)',
      b: 'radial-gradient(circle at 50% 30%, #44ff44 0%, #00aa00 100%)',
      loop: 'radial-gradient(circle at 50% 30%, #ffcc00 0%, #cc9900 100%)'
    },
    labelColor: '#fff'
  },
  
  footswitch: {
    background: '#000',
    stroke: '#333',
    strokeWidth: 2,
    textColor: '#ccc',
    textureBackground: '#222'
  },
  
  text: {
    primary: '#fff',
    secondary: '#ccc',
    tertiary: '#888',
    brandFont: 'Arial, sans-serif',
    labelFont: 'Arial, sans-serif'
  },
  
  effects: {
    shadow: '0 12px 24px rgba(0,0,0,0.4)',
    metallic: true
  }
};

// Strymon Timeline (Blue/Silver)
export const strymonTimelineTheme: PedalTheme = {
  name: 'Strymon Timeline',
  brand: 'STRYMON',
  model: 'TIMELINE',
  
  body: {
    background: 'linear-gradient(135deg, #4a6fa5 0%, #3a5f95 50%, #2a4f85 100%)',
    stroke: '#1a3f75',
    strokeWidth: 2,
    borderRadius: 12
  },
  
  controlPanel: {
    background: 'linear-gradient(180deg, #e8e8e8 0%, #d0d0d0 100%)',
    stroke: '#999',
    strokeWidth: 1
  },
  
  display: {
    background: '#001122',
    stroke: '#00aaff',
    strokeWidth: 1,
    textColor: '#00ddff',
    textColorDim: '#0088cc',
    fontFamily: 'Helvetica, Arial, sans-serif'
  },
  
  knobs: {
    outer: 'radial-gradient(circle at 40% 40%, #ffffff 0%, #e0e0e0 30%, #c0c0c0 70%, #909090 100%)',
    inner: '#f5f5f5',
    pointer: '#000',
    pointerWidth: 3,
    labelColor: '#000',
    labelFont: 'Helvetica, Arial, sans-serif'
  },
  
  buttons: {
    background: 'linear-gradient(180deg, #606060 0%, #404040 100%)',
    stroke: '#303030',
    iconColor: '#fff',
    hoverBackground: '#505050',
    activeBackground: '#303030'
  },
  
  leds: {
    off: {
      a: '#001133',
      b: '#001133',
      loop: '#110033'
    },
    on: {
      a: 'radial-gradient(circle at 50% 30%, #00aaff 0%, #0066cc 100%)',
      b: 'radial-gradient(circle at 50% 30%, #00aaff 0%, #0066cc 100%)',
      loop: 'radial-gradient(circle at 50% 30%, #ff00ff 0%, #cc00cc 100%)'
    },
    labelColor: '#e0e0e0'
  },
  
  footswitch: {
    background: 'linear-gradient(180deg, #1a1a1a 0%, #000000 100%)',
    stroke: '#444',
    strokeWidth: 2,
    textColor: '#ddd',
    textureBackground: '#111'
  },
  
  text: {
    primary: '#fff',
    secondary: '#ddd',
    tertiary: '#aaa',
    brandFont: 'Helvetica, Arial, sans-serif',
    labelFont: 'Helvetica, Arial, sans-serif'
  },
  
  effects: {
    shadow: '0 8px 32px rgba(0,0,0,0.5)',
    metallic: true,
    glow: 'rgba(0, 170, 255, 0.3)'
  }
};

// Empress Echosystem (Dark Green/Gold)
export const empressEchosystemTheme: PedalTheme = {
  name: 'Empress Echosystem',
  brand: 'EMPRESS',
  model: 'ECHOSYSTEM',
  
  body: {
    background: 'linear-gradient(135deg, #1a3a2e 0%, #0f2818 50%, #061408 100%)',
    stroke: '#000',
    strokeWidth: 2,
    borderRadius: 6
  },
  
  controlPanel: {
    background: '#0a0a0a',
    stroke: '#333',
    strokeWidth: 1
  },
  
  display: {
    background: 'linear-gradient(180deg, #000 0%, #0a0a0a 100%)',
    stroke: '#ffa500',
    strokeWidth: 1,
    textColor: '#ffa500',
    textColorDim: '#cc8400',
    fontFamily: 'Monaco, Courier New, monospace'
  },
  
  knobs: {
    outer: 'radial-gradient(circle at 35% 35%, #ffd700 0%, #ffcc00 30%, #cc9900 70%, #996600 100%)',
    inner: '#ffdd00',
    pointer: '#000',
    pointerWidth: 2,
    labelColor: '#ffa500',
    labelFont: 'Monaco, monospace'
  },
  
  buttons: {
    background: '#1a1a1a',
    stroke: '#444',
    iconColor: '#ffa500',
    hoverBackground: '#2a2a2a',
    activeBackground: '#0a0a0a'
  },
  
  leds: {
    off: {
      a: '#1a1a00',
      b: '#1a1a00',
      loop: '#1a0000'
    },
    on: {
      a: 'radial-gradient(circle at 50% 30%, #ffff00 0%, #cccc00 100%)',
      b: 'radial-gradient(circle at 50% 30%, #ffff00 0%, #cccc00 100%)',
      loop: 'radial-gradient(circle at 50% 30%, #ff0000 0%, #cc0000 100%)'
    },
    labelColor: '#ffa500'
  },
  
  footswitch: {
    background: '#000',
    stroke: '#222',
    strokeWidth: 2,
    textColor: '#ffa500',
    textureBackground: '#0a0a0a'
  },
  
  text: {
    primary: '#ffa500',
    secondary: '#cc8400',
    tertiary: '#996600',
    brandFont: 'Monaco, monospace',
    labelFont: 'Monaco, monospace'
  },
  
  effects: {
    shadow: '0 10px 30px rgba(0,0,0,0.6)',
    metallic: true
  }
};

// Electro-Harmonix (Silver/Black)
export const ehxTheme: PedalTheme = {
  name: 'EHX Style',
  brand: 'ELECTRO-HARMONIX',
  model: 'LOOPER',
  
  body: {
    background: 'linear-gradient(135deg, #c0c0c0 0%, #a0a0a0 50%, #808080 100%)',
    stroke: '#606060',
    strokeWidth: 2,
    borderRadius: 4
  },
  
  controlPanel: {
    background: '#000',
    stroke: '#333',
    strokeWidth: 1
  },
  
  display: {
    background: '#000',
    stroke: '#ff0000',
    strokeWidth: 1,
    textColor: '#ff0000',
    textColorDim: '#cc0000',
    fontFamily: 'Impact, Arial Black, sans-serif'
  },
  
  knobs: {
    outer: 'radial-gradient(circle at 30% 30%, #000 0%, #222 50%, #000 100%)',
    inner: '#111',
    pointer: '#fff',
    pointerWidth: 2,
    labelColor: '#000',
    labelFont: 'Impact, Arial Black, sans-serif'
  },
  
  buttons: {
    background: '#000',
    stroke: '#333',
    iconColor: '#fff',
    hoverBackground: '#222',
    activeBackground: '#000'
  },
  
  leds: {
    off: {
      a: '#330000',
      b: '#330000',
      loop: '#330000'
    },
    on: {
      a: 'radial-gradient(circle at 50% 30%, #ff0000 0%, #aa0000 100%)',
      b: 'radial-gradient(circle at 50% 30%, #ff0000 0%, #aa0000 100%)',
      loop: 'radial-gradient(circle at 50% 30%, #ff0000 0%, #aa0000 100%)'
    },
    labelColor: '#000'
  },
  
  footswitch: {
    background: '#000',
    stroke: '#666',
    strokeWidth: 3,
    textColor: '#fff'
  },
  
  text: {
    primary: '#000',
    secondary: '#333',
    tertiary: '#666',
    brandFont: 'Impact, Arial Black, sans-serif',
    labelFont: 'Arial, sans-serif'
  },
  
  effects: {
    shadow: '0 6px 12px rgba(0,0,0,0.3)',
    metallic: true,
    worn: true
  }
};

// TC Electronic Ditto (Purple)
export const tcDittoTheme: PedalTheme = {
  name: 'TC Ditto',
  brand: 'TC ELECTRONIC',
  model: 'DITTO',
  
  body: {
    background: 'linear-gradient(135deg, #663399 0%, #552288 50%, #441177 100%)',
    stroke: '#330066',
    strokeWidth: 2,
    borderRadius: 10
  },
  
  controlPanel: {
    background: 'rgba(0,0,0,0.3)',
    stroke: 'rgba(255,255,255,0.1)',
    strokeWidth: 1
  },
  
  display: {
    background: 'rgba(0,0,0,0.8)',
    stroke: '#ff00ff',
    strokeWidth: 1,
    textColor: '#ff00ff',
    textColorDim: '#cc00cc',
    fontFamily: 'Orbitron, monospace'
  },
  
  knobs: {
    outer: 'radial-gradient(circle at 30% 30%, #aaa 0%, #888 50%, #666 100%)',
    inner: '#999',
    pointer: '#fff',
    pointerWidth: 2,
    labelColor: '#fff',
    labelFont: 'Orbitron, monospace'
  },
  
  buttons: {
    background: 'rgba(255,255,255,0.1)',
    stroke: 'rgba(255,255,255,0.3)',
    iconColor: '#fff',
    hoverBackground: 'rgba(255,255,255,0.2)',
    activeBackground: 'rgba(255,255,255,0.05)'
  },
  
  leds: {
    off: {
      a: '#220022',
      b: '#220022',
      loop: '#220022'
    },
    on: {
      a: 'radial-gradient(circle at 50% 30%, #ff00ff 0%, #cc00cc 100%)',
      b: 'radial-gradient(circle at 50% 30%, #ff00ff 0%, #cc00cc 100%)',
      loop: 'radial-gradient(circle at 50% 30%, #ffff00 0%, #cccc00 100%)'
    },
    labelColor: '#fff'
  },
  
  footswitch: {
    background: 'radial-gradient(circle at 50% 50%, #222 0%, #000 100%)',
    stroke: '#444',
    strokeWidth: 2,
    textColor: '#ff00ff'
  },
  
  text: {
    primary: '#fff',
    secondary: '#ddd',
    tertiary: '#aaa',
    brandFont: 'Orbitron, monospace',
    labelFont: 'Orbitron, monospace'
  },
  
  effects: {
    shadow: '0 10px 40px rgba(102,51,153,0.4)',
    glow: 'rgba(255, 0, 255, 0.2)'
  }
};

// Theme registry
export const themes: { [key: string]: PedalTheme } = {
  'boss-rc1': bossRC1Theme,
  'strymon-timeline': strymonTimelineTheme,
  'empress-echosystem': empressEchosystemTheme,
  'ehx': ehxTheme,
  'tc-ditto': tcDittoTheme
};

// Get theme by ID with fallback to default
export function getTheme(themeId: string): PedalTheme {
  return themes[themeId] || bossRC1Theme;
}

// Apply theme to SVG string
export function applyThemeToSVG(svg: string, theme: PedalTheme): string {
  // This function will be used to dynamically replace theme tokens in the SVG
  // We'll implement a token-based system in the SVG
  return svg
    .replace(/\{\{body\.background\}\}/g, theme.body.background)
    .replace(/\{\{body\.stroke\}\}/g, theme.body.stroke)
    .replace(/\{\{body\.strokeWidth\}\}/g, theme.body.strokeWidth.toString())
    .replace(/\{\{body\.borderRadius\}\}/g, theme.body.borderRadius.toString())
    .replace(/\{\{controlPanel\.background\}\}/g, theme.controlPanel.background)
    .replace(/\{\{display\.background\}\}/g, theme.display.background)
    .replace(/\{\{display\.stroke\}\}/g, theme.display.stroke)
    .replace(/\{\{display\.textColor\}\}/g, theme.display.textColor)
    .replace(/\{\{knobs\.outer\}\}/g, theme.knobs.outer)
    .replace(/\{\{knobs\.inner\}\}/g, theme.knobs.inner)
    .replace(/\{\{buttons\.background\}\}/g, theme.buttons.background)
    .replace(/\{\{footswitch\.background\}\}/g, theme.footswitch.background)
    .replace(/\{\{text\.primary\}\}/g, theme.text.primary)
    .replace(/\{\{text\.secondary\}\}/g, theme.text.secondary)
    .replace(/\{\{effects\.shadow\}\}/g, theme.effects?.shadow || 'none');
}

// Load custom theme from JSON
export async function loadCustomTheme(json: string): Promise<PedalTheme> {
  try {
    const customTheme = JSON.parse(json) as PedalTheme;
    // Validate required fields
    if (!customTheme.name || !customTheme.body || !customTheme.display) {
      throw new Error('Invalid theme format');
    }
    return customTheme;
  } catch (error) {
    console.error('Failed to load custom theme:', error);
    return bossRC1Theme; // Fallback to default
  }
}

// Export theme as JSON for sharing
export function exportTheme(theme: PedalTheme): string {
  return JSON.stringify(theme, null, 2);
}