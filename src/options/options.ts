interface LooperSettings {
  looperKey: string;
  latencyCompensation: number;
  epsilon: number;
  enableHoldToDefine: boolean;
  edgeBleed: number;
  metronomeEnabled: boolean;
  clicksPerLoop: number;
  pointAPreTrim: number;
  pointAPostTrim: number;
  pointBPreTrim: number;
  pointBPostTrim: number;
  keyBindings: {
    setPointA: string;
    setPointB: string;
    stopLoop: string;
    speedUp: string;
    speedDown: string;
    pitchUp: string;
    pitchDown: string;
    resetPitch: string;
    toggleMetronome: string;
    jogABack: string;
    jogAForward: string;
    jogBBack: string;
    jogBForward: string;
  };
}

class OptionsManager {
  private defaultSettings: LooperSettings = {
    looperKey: 'BracketLeft',
    latencyCompensation: 50,
    epsilon: 50,
    enableHoldToDefine: false,
    edgeBleed: 100,
    metronomeEnabled: false,
    clicksPerLoop: 4,
    pointAPreTrim: 0,
    pointAPostTrim: 0,
    pointBPreTrim: 0,
    pointBPostTrim: 150,
    keyBindings: {
      setPointA: 'BracketLeft',
      setPointB: 'BracketRight', 
      stopLoop: 'Backslash',
      speedUp: 'Equal',
      speedDown: 'Minus',
      pitchUp: 'ArrowUp',
      pitchDown: 'ArrowDown',
      resetPitch: 'KeyR',
      toggleMetronome: 'KeyM',
      jogABack: 'Comma',
      jogAForward: 'Period',
      jogBBack: 'Semicolon',
      jogBForward: 'Quote'
    }
  };

  private saveTimeout: number | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    await this.loadSettings();
    this.setupEventListeners();
    this.updateKeyboardShortcuts();
  }

  private async loadSettings(): Promise<void> {
    try {
      const stored = await chrome.storage.sync.get(this.defaultSettings);
      this.populateForm(stored as LooperSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showStatus('Failed to load settings', 'error');
    }
  }

  private populateForm(settings: LooperSettings): void {
    const form = document.getElementById('settingsForm') as HTMLFormElement;
    
    (form.elements.namedItem('latencyCompensation') as HTMLInputElement).value = settings.latencyCompensation.toString();
    (form.elements.namedItem('epsilon') as HTMLInputElement).value = settings.epsilon.toString();
    (form.elements.namedItem('edgeBleed') as HTMLInputElement).value = settings.edgeBleed.toString();
    (form.elements.namedItem('metronomeEnabled') as HTMLInputElement).checked = settings.metronomeEnabled;
    (form.elements.namedItem('clicksPerLoop') as HTMLInputElement).value = settings.clicksPerLoop.toString();
    
    // Populate loop point trim settings
    (form.elements.namedItem('pointAPreTrim') as HTMLInputElement).value = settings.pointAPreTrim.toString();
    (form.elements.namedItem('pointAPostTrim') as HTMLInputElement).value = settings.pointAPostTrim.toString();
    (form.elements.namedItem('pointBPreTrim') as HTMLInputElement).value = settings.pointBPreTrim.toString();
    (form.elements.namedItem('pointBPostTrim') as HTMLInputElement).value = settings.pointBPostTrim.toString();
    
    // Populate key bindings
    (form.elements.namedItem('setPointA') as HTMLInputElement).value = settings.keyBindings.setPointA;
    (form.elements.namedItem('setPointB') as HTMLInputElement).value = settings.keyBindings.setPointB;
    (form.elements.namedItem('stopLoop') as HTMLInputElement).value = settings.keyBindings.stopLoop;
    (form.elements.namedItem('speedUp') as HTMLInputElement).value = settings.keyBindings.speedUp;
    (form.elements.namedItem('speedDown') as HTMLInputElement).value = settings.keyBindings.speedDown;
    (form.elements.namedItem('pitchUp') as HTMLInputElement).value = settings.keyBindings.pitchUp;
    (form.elements.namedItem('pitchDown') as HTMLInputElement).value = settings.keyBindings.pitchDown;
    (form.elements.namedItem('resetPitch') as HTMLInputElement).value = settings.keyBindings.resetPitch;
    (form.elements.namedItem('toggleMetronome') as HTMLInputElement).value = settings.keyBindings.toggleMetronome;
    (form.elements.namedItem('jogABack') as HTMLInputElement).value = settings.keyBindings.jogABack;
    (form.elements.namedItem('jogAForward') as HTMLInputElement).value = settings.keyBindings.jogAForward;
    (form.elements.namedItem('jogBBack') as HTMLInputElement).value = settings.keyBindings.jogBBack;
    (form.elements.namedItem('jogBForward') as HTMLInputElement).value = settings.keyBindings.jogBForward;
  }

  private setupEventListeners(): void {
    const form = document.getElementById('settingsForm') as HTMLFormElement;
    const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
    const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;

    // Auto-save with debounce
    form.addEventListener('input', () => {
      this.debouncedSave();
      this.updateKeyboardShortcuts();
    });

    form.addEventListener('change', () => {
      this.debouncedSave();
      this.updateKeyboardShortcuts();
    });

    saveBtn.addEventListener('click', () => {
      this.saveSettings();
    });

    resetBtn.addEventListener('click', () => {
      this.resetToDefaults();
    });
  }

  private debouncedSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = window.setTimeout(() => {
      this.saveSettings();
    }, 500);
  }

  private async saveSettings(): Promise<void> {
    const form = document.getElementById('settingsForm') as HTMLFormElement;
    
    const settings: LooperSettings = {
      looperKey: 'BracketLeft', // Legacy - not used
      latencyCompensation: parseInt((form.elements.namedItem('latencyCompensation') as HTMLInputElement).value, 10),
      epsilon: parseInt((form.elements.namedItem('epsilon') as HTMLInputElement).value, 10),
      enableHoldToDefine: false, // Fixed
      edgeBleed: parseInt((form.elements.namedItem('edgeBleed') as HTMLInputElement).value, 10),
      metronomeEnabled: (form.elements.namedItem('metronomeEnabled') as HTMLInputElement).checked,
      clicksPerLoop: parseInt((form.elements.namedItem('clicksPerLoop') as HTMLInputElement).value, 10),
      pointAPreTrim: parseInt((form.elements.namedItem('pointAPreTrim') as HTMLInputElement).value, 10),
      pointAPostTrim: parseInt((form.elements.namedItem('pointAPostTrim') as HTMLInputElement).value, 10),
      pointBPreTrim: parseInt((form.elements.namedItem('pointBPreTrim') as HTMLInputElement).value, 10),
      pointBPostTrim: parseInt((form.elements.namedItem('pointBPostTrim') as HTMLInputElement).value, 10),
      keyBindings: {
        setPointA: (form.elements.namedItem('setPointA') as HTMLInputElement).value || 'BracketLeft',
        setPointB: (form.elements.namedItem('setPointB') as HTMLInputElement).value || 'BracketRight',
        stopLoop: (form.elements.namedItem('stopLoop') as HTMLInputElement).value || 'Backslash',
        speedUp: (form.elements.namedItem('speedUp') as HTMLInputElement).value || 'Equal',
        speedDown: (form.elements.namedItem('speedDown') as HTMLInputElement).value || 'Minus',
        pitchUp: (form.elements.namedItem('pitchUp') as HTMLInputElement).value || 'ArrowUp',
        pitchDown: (form.elements.namedItem('pitchDown') as HTMLInputElement).value || 'ArrowDown',
        resetPitch: (form.elements.namedItem('resetPitch') as HTMLInputElement).value || 'KeyR',
        toggleMetronome: (form.elements.namedItem('toggleMetronome') as HTMLInputElement).value || 'KeyM',
        jogABack: (form.elements.namedItem('jogABack') as HTMLInputElement).value || 'Comma',
        jogAForward: (form.elements.namedItem('jogAForward') as HTMLInputElement).value || 'Period',
        jogBBack: (form.elements.namedItem('jogBBack') as HTMLInputElement).value || 'Semicolon',
        jogBForward: (form.elements.namedItem('jogBForward') as HTMLInputElement).value || 'Quote'
      }
    };

    // Validate settings
    if (!this.validateSettings(settings)) {
      return;
    }

    try {
      await chrome.storage.sync.set(settings);
      this.showStatus('Saved ✓', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showStatus('Save failed', 'error');
    }
  }

  private validateSettings(settings: LooperSettings): boolean {
    if (settings.latencyCompensation < -200 || settings.latencyCompensation > 100) {
      this.showStatus('Latency compensation must be between -200 to 100ms', 'error');
      return false;
    }

    if (settings.epsilon < 1 || settings.epsilon > 100) {
      this.showStatus('Epsilon must be between 1-100ms', 'error');
      return false;
    }

    if (settings.edgeBleed < 0 || settings.edgeBleed > 300) {
      this.showStatus('Edge bleed must be between 0-300ms', 'error');
      return false;
    }

    if (settings.clicksPerLoop < 1 || settings.clicksPerLoop > 64) {
      this.showStatus('Clicks per loop must be between 1-64', 'error');
      return false;
    }

    if (settings.pointAPreTrim < -500 || settings.pointAPreTrim > 500) {
      this.showStatus('Point A pre-trim must be between -500 to 500ms', 'error');
      return false;
    }

    if (settings.pointAPostTrim < -500 || settings.pointAPostTrim > 500) {
      this.showStatus('Point A post-trim must be between -500 to 500ms', 'error');
      return false;
    }

    if (settings.pointBPreTrim < -500 || settings.pointBPreTrim > 500) {
      this.showStatus('Point B pre-trim must be between -500 to 500ms', 'error');
      return false;
    }

    if (settings.pointBPostTrim < -500 || settings.pointBPostTrim > 500) {
      this.showStatus('Point B post-trim must be between -500 to 500ms', 'error');
      return false;
    }

    return true;
  }

  private resetToDefaults(): void {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      this.populateForm(this.defaultSettings);
      this.saveSettings();
      this.updateKeyboardShortcuts();
    }
  }

  private updateKeyboardShortcuts(): void {
    // No dynamic updates needed anymore
  }

  private getKeyDisplayName(keyCode: string): string {
    const keyMap: { [key: string]: string } = {
      'KeyL': 'L',
      'KeyK': 'K', 
      'KeyJ': 'J',
      'KeySpace': 'Space',
      'Semicolon': ';',
      'Quote': "'",
      'Comma': ',',
      'Period': '.'
    };

    return keyMap[keyCode] || keyCode.replace('Key', '');
  }

  private showStatus(message: string, type: 'success' | 'error' | ''): void {
    const status = document.getElementById('status') as HTMLElement;
    status.textContent = message;
    status.className = `status ${type}`;

    if (type) {
      setTimeout(() => {
        status.textContent = '';
        status.className = 'status';
      }, 3000);
    }
  }
}

// Initialize options when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new OptionsManager();
  });
} else {
  new OptionsManager();
}