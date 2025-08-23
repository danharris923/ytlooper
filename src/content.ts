interface LooperSettings {
  looperKey: string;
  doubleTapWindow: number;
  latencyCompensation: number;
  epsilon: number;
  enableHoldToDefine: boolean;
  edgeBleed: number;
}

interface LooperState {
  pointA: number | null;
  pointB: number | null;
  isLooping: boolean;
  activeMedia: HTMLMediaElement | null;
  lastTapTime: number;
  isHoldDefining: boolean;
  holdStartTime: number;
  animationFrameId: number | null;
  hudElement: HTMLElement | null;
  hudTimeout: number | null;
  currentUrl: string;
}

class PunchLooper {
  private settings: LooperSettings = {
    looperKey: 'BracketLeft', // Not used anymore
    doubleTapWindow: 1200,
    latencyCompensation: 50,
    epsilon: 50,
    enableHoldToDefine: false,
    edgeBleed: 100
  };

  private state: LooperState = {
    pointA: null,
    pointB: null,
    isLooping: false,
    activeMedia: null,
    lastTapTime: 0,
    isHoldDefining: false,
    holdStartTime: 0,
    animationFrameId: null,
    hudElement: null,
    hudTimeout: null,
    currentUrl: window.location.href
  };

  private mutationObserver: MutationObserver | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    await this.loadSettings();
    this.setupEventListeners();
    this.setupMutationObserver();
    this.findActiveMedia();
    this.createHUD();
  }

  private async loadSettings(): Promise<void> {
    try {
      const stored = await chrome.storage.sync.get(this.settings);
      this.settings = { ...this.settings, ...stored };
    } catch (error) {
      console.warn('[PunchLooper] Failed to load settings:', error);
    }
  }

  private setupEventListeners(): void {
    document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
    document.addEventListener('keyup', this.handleKeyUp.bind(this), true);

    // Listen for settings changes
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync') {
        for (const key in changes) {
          if (key in this.settings) {
            (this.settings as any)[key] = changes[key].newValue;
          }
        }
      }
    });
  }

  private setupMutationObserver(): void {
    this.mutationObserver = new MutationObserver((mutations) => {
      let shouldRescan = false;
      
      // Check for URL changes (SPA navigation)
      if (window.location.href !== this.state.currentUrl) {
        this.state.currentUrl = window.location.href;
        this.resetLoop();
        shouldRescan = true;
        this.showHUD('Navigation detected - resetting', 1000);
      }

      // Check for new media elements
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (element.tagName === 'VIDEO' || element.tagName === 'AUDIO' ||
                  element.querySelector('video, audio')) {
                shouldRescan = true;
              }
            }
          }
        }
      }

      if (shouldRescan) {
        this.findActiveMedia();
      }
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private findActiveMedia(): void {
    const mediaElements = document.querySelectorAll('video, audio') as NodeListOf<HTMLMediaElement>;
    
    if (mediaElements.length === 0) {
      this.state.activeMedia = null;
      return;
    }

    // Prefer currently playing media
    let bestMedia: HTMLMediaElement | null = null;
    let maxScore = -1;

    for (const media of mediaElements) {
      let score = 0;
      
      // Playing media gets highest priority
      if (!media.paused && !media.ended) {
        score += 1000;
      }

      // Visible elements get priority
      const rect = media.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        score += rect.width * rect.height; // Larger elements preferred
      }

      // Elements with duration get priority
      if (media.duration && !isNaN(media.duration)) {
        score += 100;
      }

      if (score > maxScore) {
        maxScore = score;
        bestMedia = media;
      }
    }

    if (bestMedia !== this.state.activeMedia) {
      this.state.activeMedia = bestMedia;
      this.resetLoop();
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    console.log('Key pressed:', event.code, 'ignored?', this.shouldIgnoreEvent(event));
    
    if (this.shouldIgnoreEvent(event)) return;

    console.log('Processing key:', event.code);
    
    if (event.code === 'BracketLeft') {
      console.log('BracketLeft detected - setting point A');
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.setPointA();
    } else if (event.code === 'BracketRight') {
      console.log('BracketRight detected - setting point B');
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.setPointB();
      if (this.state.pointA !== null && this.state.pointB !== null) {
        this.startLoop();
      }
    } else if (event.code === 'Backslash') {
      console.log('Backslash detected - stopping loop');
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (this.state.isLooping) {
        this.stopLoop();
      } else {
        console.log('Not looping, ignoring backslash');
      }
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    // Not needed anymore
  }

  private shouldIgnoreEvent(event: KeyboardEvent): boolean {
    const target = event.target as Element;
    
    // Ignore if in input fields
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      return true;
    }

    // Ignore if contentEditable
    if (target.isContentEditable) {
      return true;
    }

    // Check for modal/dialog focus
    const activeElement = document.activeElement;
    if (activeElement && activeElement.closest('[role="dialog"], [role="modal"]')) {
      return true;
    }

    return false;
  }

  // Removed unused methods

  private setPointA(): void {
    console.log('setPointA called, activeMedia:', !!this.state.activeMedia);
    if (!this.state.activeMedia) {
      this.showHUD('No media found', 1000);
      return;
    }
    
    this.state.pointA = this.state.activeMedia.currentTime;
    console.log('Set Point A at:', this.state.pointA);
    const timeStr = this.formatTime(this.state.pointA);
    this.showHUD(`A @ ${timeStr}`, 700);
  }

  private setPointB(): void {
    if (!this.state.activeMedia || this.state.pointA === null) return;
    
    this.state.pointB = this.state.activeMedia.currentTime;
    console.log('Set Point B at:', this.state.pointB);
    console.log('Loop length:', this.state.pointB - this.state.pointA, 'seconds');
    
    if (this.state.pointB <= this.state.pointA) {
      this.showHUD('B must be after A', 1000);
      this.state.pointB = null;
      return;
    }

    const timeStr = this.formatTime(this.state.pointB);
    const lengthStr = this.formatTime(this.state.pointB - this.state.pointA);
    this.showHUD(`B @ ${timeStr} (len=${lengthStr})`, 700);
  }

  private startLoop(): void {
    if (!this.state.activeMedia || this.state.pointA === null || this.state.pointB === null) {
      return;
    }

    this.state.isLooping = true;
    this.startLoopEngine();
    
    const lengthStr = this.formatTime(this.state.pointB - this.state.pointA);
    this.showHUD(`▶ Loop [A→B] (${lengthStr})`, 1000);

    // Set preservesPitch if supported
    this.setPitchPreservation(true);
  }

  private stopLoop(): void {
    this.state.isLooping = false;
    if (this.state.animationFrameId) {
      cancelAnimationFrame(this.state.animationFrameId);
      this.state.animationFrameId = null;
    }
    this.showHUD('⏸ Loop stopped', 700);
  }

  private resetLoop(): void {
    this.stopLoop();
    this.state.pointA = null;
    this.state.pointB = null;
  }

  private clearPoints(): void {
    this.resetLoop();
    this.showHUD('A/B cleared', 700);
  }

  private startLoopEngine(): void {
    if (!this.state.isLooping) return;

    const tick = () => {
      if (!this.state.isLooping || !this.state.activeMedia || 
          this.state.pointA === null || this.state.pointB === null) {
        return;
      }

      const currentTime = this.state.activeMedia.currentTime;
      const loopLength = this.state.pointB - this.state.pointA;
      
      console.log(`Current: ${currentTime.toFixed(3)}, A: ${this.state.pointA.toFixed(3)}, B: ${this.state.pointB.toFixed(3)}, Length: ${loopLength.toFixed(3)}`);
      
      // Check if we've passed point B + edge bleed
      const effectivePointB = this.state.pointB + (this.settings.edgeBleed / 1000);
      const effectivePointA = Math.max(0, this.state.pointA - (this.settings.edgeBleed / 1000));
      
      if (currentTime >= effectivePointB) {
        console.log(`Hit point B+bleed (${effectivePointB.toFixed(3)}), jumping back to A-bleed (${effectivePointA.toFixed(3)})`);
        
        // Seek to point A with edge bleed for smoother transition
        this.state.activeMedia.currentTime = effectivePointA;

        // Ensure playback continues after seek
        if (this.state.activeMedia.paused) {
          console.log('Video was paused, resuming playback');
          this.state.activeMedia.play().catch((error) => {
            console.warn('Failed to resume playback:', error);
          });
        }
        
        console.log('Seek completed, new currentTime:', this.state.activeMedia.currentTime);
      }

      this.state.animationFrameId = requestAnimationFrame(tick);
    };

    this.state.animationFrameId = requestAnimationFrame(tick);
  }

  private adjustPlaybackRate(delta: number): void {
    if (!this.state.activeMedia) return;

    const newRate = Math.max(0.25, Math.min(4.0, this.state.activeMedia.playbackRate + delta));
    this.state.activeMedia.playbackRate = newRate;
    this.showHUD(`Rate ×${newRate.toFixed(2)}`, 700);
  }

  private setPitchPreservation(preserve: boolean): void {
    if (!this.state.activeMedia) return;

    // Try different vendor prefixes
    const media = this.state.activeMedia as any;
    if ('preservesPitch' in media) {
      media.preservesPitch = preserve;
    } else if ('mozPreservesPitch' in media) {
      media.mozPreservesPitch = preserve;
    } else if ('webkitPreservesPitch' in media) {
      media.webkitPreservesPitch = preserve;
    }
  }

  private createHUD(): void {
    console.log('createHUD called');
    const hud = document.createElement('div');
    hud.id = 'punch-looper-hud';
    hud.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      background: rgba(0, 0, 0, 0.85) !important;
      color: white !important;
      padding: 8px 12px !important;
      border-radius: 6px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 13px !important;
      font-weight: 500 !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
      opacity: 0 !important;
      transform: translateY(-10px) !important;
      transition: all 0.2s ease-out !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
      backdrop-filter: blur(8px) !important;
      white-space: nowrap !important;
    `;
    
    // Test visibility immediately
    hud.textContent = 'TEST HUD';
    hud.style.opacity = '1';
    hud.style.transform = 'translateY(0)';
    
    document.body.appendChild(hud);
    this.state.hudElement = hud;
    
    console.log('HUD created and added to DOM:', hud);
    
    // Hide test text after 2 seconds
    setTimeout(() => {
      if (this.state.hudElement) {
        this.state.hudElement.style.opacity = '0';
        this.state.hudElement.style.transform = 'translateY(-10px)';
      }
    }, 2000);
  }

  private showHUD(message: string, duration: number): void {
    console.log('showHUD called:', message, 'duration:', duration, 'hudElement:', !!this.state.hudElement);
    
    if (!this.state.hudElement) {
      console.error('HUD element is null!');
      return;
    }

    this.state.hudElement.textContent = message;
    this.state.hudElement.style.opacity = '1';
    this.state.hudElement.style.transform = 'translateY(0)';
    
    console.log('HUD updated - opacity:', this.state.hudElement.style.opacity, 'text:', this.state.hudElement.textContent);

    if (this.state.hudTimeout) {
      clearTimeout(this.state.hudTimeout);
    }

    if (duration > 0) {
      this.state.hudTimeout = window.setTimeout(() => {
        this.hideHUD();
      }, duration);
    }
  }

  private hideHUD(): void {
    if (!this.state.hudElement) return;

    this.state.hudElement.style.opacity = '0';
    this.state.hudElement.style.transform = 'translateY(-10px)';
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
  }

  public destroy(): void {
    this.stopLoop();
    
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }

    if (this.state.hudElement) {
      this.state.hudElement.remove();
    }

    if (this.state.hudTimeout) {
      clearTimeout(this.state.hudTimeout);
    }

    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    document.removeEventListener('keyup', this.handleKeyUp.bind(this));
  }
}

// Initialize the looper
let looper: PunchLooper | null = null;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    looper = new PunchLooper();
  });
} else {
  looper = new PunchLooper();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (looper) {
    looper.destroy();
  }
});