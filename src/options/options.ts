interface LooperSettings {
  looperKey: string;
  doubleTapWindow: number;
  latencyCompensation: number;
  epsilon: number;
  enableHoldToDefine: boolean;
  edgeBleed: number;
}

class OptionsManager {
  private defaultSettings: LooperSettings = {
    looperKey: 'BracketLeft',
    doubleTapWindow: 1200,
    latencyCompensation: 50,
    epsilon: 50,
    enableHoldToDefine: false,
    edgeBleed: 100
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
      looperKey: 'BracketLeft', // Fixed
      doubleTapWindow: 1200, // Not used
      latencyCompensation: parseInt((form.elements.namedItem('latencyCompensation') as HTMLInputElement).value, 10),
      epsilon: parseInt((form.elements.namedItem('epsilon') as HTMLInputElement).value, 10),
      enableHoldToDefine: false, // Fixed
      edgeBleed: parseInt((form.elements.namedItem('edgeBleed') as HTMLInputElement).value, 10)
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
    if (settings.latencyCompensation < 0 || settings.latencyCompensation > 100) {
      this.showStatus('Latency compensation must be between 0-100ms', 'error');
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