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
  jogAdjustmentMs: number;
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
  currentSemitoneShift: number;
  metronomeAudio: HTMLAudioElement | null;
  lastClickTime: number;
  guiElement: HTMLElement | null;
  isGuiVisible: boolean;
  isDraggingKnob: string | null;
  // Simplified audio processing with native browser capabilities
  currentPitchShift: number; // Independent pitch control (-12 to +12 semitones)
  currentSpeedMultiplier: number; // Independent speed control (0.25 to 4.0)
  basePitchRatio: number; // Base pitch ratio for calculations
  baseSpeedRatio: number; // Base speed ratio for calculations
}

class PunchLooper {
  private settings: LooperSettings = {
    looperKey: 'BracketLeft', // Legacy - not used anymore
    latencyCompensation: 0,
    epsilon: 50,
    enableHoldToDefine: false,
    edgeBleed: 100,
    metronomeEnabled: false,
    clicksPerLoop: 4,
    pointAPreTrim: 0,
    pointAPostTrim: 0,
    pointBPreTrim: 0,
    pointBPostTrim: 100,
    jogAdjustmentMs: 50,
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
    currentUrl: window.location.href,
    currentSemitoneShift: 0,
    metronomeAudio: null,
    lastClickTime: 0,
    guiElement: null,
    isGuiVisible: false,
    isDraggingKnob: null,
    // Simplified audio processing
    currentPitchShift: 0,
    currentSpeedMultiplier: 1.0,
    basePitchRatio: 1.0,
    baseSpeedRatio: 1.0
  };

  // Musical intervals - each step is a semitone
  private readonly musicalIntervals = [
    { semitones: 12, name: 'Original (+1 octave)', rate: 2.0 },
    { semitones: 7, name: 'Perfect 5th up', rate: 1.498 },
    { semitones: 5, name: 'Perfect 4th up', rate: 1.335 },
    { semitones: 4, name: 'Major 3rd up', rate: 1.260 },
    { semitones: 3, name: 'Minor 3rd up', rate: 1.189 },
    { semitones: 2, name: 'Major 2nd up', rate: 1.122 },
    { semitones: 1, name: 'Semitone up', rate: 1.059 },
    { semitones: 0, name: 'Original pitch', rate: 1.0 },
    { semitones: -1, name: 'Semitone down', rate: 0.944 },
    { semitones: -2, name: 'Major 2nd down', rate: 0.891 },
    { semitones: -3, name: 'Minor 3rd down', rate: 0.841 },
    { semitones: -4, name: 'Major 3rd down', rate: 0.794 },
    { semitones: -5, name: 'Perfect 4th down', rate: 0.749 },
    { semitones: -7, name: 'Perfect 5th down', rate: 0.667 },
    { semitones: -12, name: 'Original (-1 octave)', rate: 0.5 }
  ];

  private mutationObserver: MutationObserver | null = null;

  constructor() {
    this.init();
  }

  // Removed SoundTouch injection - using native browser capabilities instead

  // Removed complex audio context setup - using simple native controls

  // Removed SoundTouch processor - using direct media element control

  private semitoneToRatio(semitones: number): number {
    // Convert semitone shift to frequency ratio
    // Each semitone is 2^(1/12) ratio
    return Math.pow(2, semitones / 12);
  }

  private async init(): Promise<void> {
    await this.loadSettings();
    this.setupEventListeners();
    this.setupMutationObserver();
    this.findActiveMedia();
    this.createHUD();
    this.createGUI();
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

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'showGUI') {
        if (!this.state.isGuiVisible) {
          this.toggleGUI();
        }
        sendResponse({ success: true });
      }
      return true;
    });

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
      this.cleanupAudioProcessing();
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
      this.cleanupAudioProcessing();
      this.state.activeMedia = bestMedia;
      this.resetLoop();
      
      // Initialize native audio controls for the new media element
      if (this.state.activeMedia) {
        this.initializeNativeAudioControls();
      }
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    console.log('Key pressed:', event.code, 'ignored?', this.shouldIgnoreEvent(event));
    
    if (this.shouldIgnoreEvent(event)) return;

    console.log('Processing key:', event.code);
    
    if (event.code === this.settings.keyBindings.setPointA) {
      console.log('Set Point A key detected');
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.setPointA();
    } else if (event.code === this.settings.keyBindings.setPointB) {
      console.log('Set Point B key detected');
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.setPointB();
      if (this.state.pointA !== null && this.state.pointB !== null) {
        this.startLoop();
      }
    } else if (event.code === this.settings.keyBindings.stopLoop) {
      console.log('Stop loop key detected');
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (this.state.isLooping) {
        this.resetLoop();
      } else {
        console.log('Not looping, ignoring stop key');
      }
    } else if (event.code === this.settings.keyBindings.speedUp && event.shiftKey) {
      // Shift + speed up key - increase speed
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.adjustPlaybackRate(0.01); // Smaller steps for finer control
    } else if (event.code === this.settings.keyBindings.speedDown && event.shiftKey) {
      // Shift + speed down key - decrease speed
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.adjustPlaybackRate(-0.01); // Smaller steps for finer control
    } else if (event.code === this.settings.keyBindings.toggleMetronome && event.shiftKey) {
      // Shift + M - toggle metronome
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.toggleMetronome();
    } else if (event.code === this.settings.keyBindings.pitchUp && event.shiftKey) {
      // Shift + pitch up key - pitch up 1 chromatic step
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.adjustPitch(1); // 1 semitone steps for discrete positions
    } else if (event.code === this.settings.keyBindings.pitchDown && event.shiftKey) {
      // Shift + pitch down key - pitch down 1 chromatic step
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.adjustPitch(-1); // 1 semitone steps for discrete positions
    } else if (event.code === this.settings.keyBindings.resetPitch && event.shiftKey) {
      // Shift + reset key - reset pitch and speed
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.resetPlaybackSettings();
    } else if (event.code === this.settings.keyBindings.jogABack && event.shiftKey) {
      // Shift + jog A back key - move point A back
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.adjustLoopEdge('A', 'back');
    } else if (event.code === this.settings.keyBindings.jogAForward && event.shiftKey) {
      // Shift + > - move point A forward  
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.adjustLoopEdge('A', 'forward');
    } else if (event.code === this.settings.keyBindings.jogBBack && event.shiftKey) {
      // Shift + jog B back key - move point B back
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.adjustLoopEdge('B', 'back');
    } else if (event.code === this.settings.keyBindings.jogBForward && event.shiftKey) {
      // Shift + jog B forward key - move point B forward
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.adjustLoopEdge('B', 'forward');
    } else if (event.code === 'KeyE' && event.shiftKey) {
      // Shift + E - toggle audio engine
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.toggleAudioEngine();
    } else if (event.code === 'ArrowLeft' && event.shiftKey) {
      // Shift + Left Arrow - pitch down 1 chromatic step
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.adjustPitch(-1);
    } else if (event.code === 'ArrowRight' && event.shiftKey) {
      // Shift + Right Arrow - pitch up 1 chromatic step
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.adjustPitch(1);
    } else if (event.code === 'KeyG' && event.shiftKey) {
      // Shift + G - toggle guitar pedal GUI
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.toggleGUI();
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
    
    // Apply pre-trim offset when setting point A
    let adjustedTime = this.state.activeMedia.currentTime + (this.settings.pointAPreTrim / 1000);
    adjustedTime = Math.max(0, adjustedTime); // Don't go negative
    
    this.state.pointA = adjustedTime;
    console.log(`Set Point A at: ${this.state.pointA} (original: ${this.state.activeMedia.currentTime}, pre-trim: ${this.settings.pointAPreTrim}ms)`);
    const timeStr = this.formatTime(this.state.pointA);
    this.showHUD(`A @ ${timeStr}`, 700);
  }

  private setPointB(): void {
    if (!this.state.activeMedia || this.state.pointA === null) return;
    
    // Apply pre-trim then post-trim offsets when setting point B
    let adjustedTime = this.state.activeMedia.currentTime + (this.settings.pointBPreTrim / 1000);
    adjustedTime = Math.max(0, adjustedTime); // Don't go negative
    
    // Apply post-trim (default 150ms back to fix loop timing)
    adjustedTime += (this.settings.pointBPostTrim / 1000);
    adjustedTime = Math.max(0, adjustedTime);
    
    this.state.pointB = adjustedTime;
    console.log(`Set Point B at: ${this.state.pointB} (original: ${this.state.activeMedia.currentTime}, pre-trim: ${this.settings.pointBPreTrim}ms, post-trim: ${this.settings.pointBPostTrim}ms)`);
    console.log('Loop length:', this.state.pointB - this.state.pointA, 'seconds');
    
    // Allow overlapping points for creative looping
    if (this.state.pointB <= this.state.pointA - 0.5) {
      // If B is significantly before A (more than 0.5 seconds), warn but allow it
      this.showHUD('⚠ Overlapped loop (B before A)', 1000);
    }

    const timeStr = this.formatTime(this.state.pointB);
    const lengthStr = this.formatTime(this.state.pointB - this.state.pointA);
    this.showHUD(`B @ ${timeStr} (len=${lengthStr})`, 700);
    
    // Auto-start looping
    this.startLoop();
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
    this.updateGUILEDs();
  }

  private stopLoop(): void {
    this.state.isLooping = false;
    if (this.state.animationFrameId) {
      cancelAnimationFrame(this.state.animationFrameId);
      this.state.animationFrameId = null;
    }
    this.showHUD('⏸ Loop stopped', 700);
    this.updateGUILEDs();
  }

  private resetLoop(): void {
    this.stopLoop();
    this.state.pointA = null;
    this.state.pointB = null;
    this.updateGUILEDs();
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
      
      // Handle metronome clicks if enabled
      if (this.settings.metronomeEnabled && this.settings.clicksPerLoop > 0) {
        this.handleMetronomeClick(currentTime, loopLength);
      }
      
      // Handle both normal and overlapped loops
      let effectivePointB: number;
      let effectivePointA: number;
      
      if (this.state.pointB > this.state.pointA) {
        // Normal loop: A -> B
        const bleedCompensation = (this.settings.edgeBleed / 1000) * 0.5;
        effectivePointB = this.state.pointB - bleedCompensation;
        effectivePointA = Math.max(0, this.state.pointA - (this.settings.edgeBleed / 1000));
      } else {
        // Overlapped loop: A -> end, start -> B (creates tighter loop)
        effectivePointB = this.state.pointB + (this.settings.edgeBleed / 1000);
        effectivePointA = Math.max(0, this.state.pointA - (this.settings.edgeBleed / 1000));
      }
      
      const shouldLoop = (this.state.pointB > this.state.pointA && currentTime >= effectivePointB) ||
                        (this.state.pointB <= this.state.pointA && (currentTime >= effectivePointA || currentTime <= effectivePointB));
      
      if (shouldLoop) {
        console.log(`Loop boundary hit: ${currentTime.toFixed(3)} -> A (${effectivePointA.toFixed(3)})`);
        
        // Apply latency compensation for more precise looping (negative latency moves forward)
        const jumpTarget = effectivePointA - (this.settings.latencyCompensation / 1000);
        this.state.activeMedia.currentTime = Math.max(0, jumpTarget);

        // Ensure playback continues after seek
        if (this.state.activeMedia.paused) {
          console.log('Video was paused, resuming playback');
          this.state.activeMedia.play().catch((error) => {
            console.warn('Failed to resume playback:', error);
          });
        }
        
        console.log('Seek completed, new currentTime:', this.state.activeMedia.currentTime);
      }

      // Update GUI display
      this.updateDisplayText();

      this.state.animationFrameId = requestAnimationFrame(tick);
    };

    this.state.animationFrameId = requestAnimationFrame(tick);
  }

  private adjustPlaybackRate(delta: number): void {
    if (!this.state.activeMedia) return;

    // Update speed multiplier (clamp between 0.5x and 1.5x) with noon = 1.0x
    this.state.currentSpeedMultiplier = Math.max(0.5, Math.min(1.5, this.state.currentSpeedMultiplier + delta));
    
    // Use native browser capabilities for pitch-preserving speed control
    this.state.activeMedia.preservesPitch = true;
    this.state.activeMedia.playbackRate = this.state.currentSpeedMultiplier;
    
    const speedPercentage = Math.round(this.state.currentSpeedMultiplier * 100);
    this.showHUD(`Speed: ${speedPercentage}% (×${this.state.currentSpeedMultiplier.toFixed(2)})`, 1000);
    
    // Update display immediately
    this.updateDisplayText();
    
    console.log(`[PunchLooper] Speed adjusted to ${this.state.currentSpeedMultiplier.toFixed(3)}x (pitch preserved)`);
    
    // Update speed knob rotation
    this.updateKnobRotation('speed');
    this.updateGUILEDs();
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

  private adjustPitch(semitones: number): void {
    if (!this.state.activeMedia) return;

    // Update pitch shift value (clamp between -12 and +12 semitones)
    this.state.currentPitchShift = Math.max(-12, Math.min(12, this.state.currentPitchShift + semitones));
    
    this.applyPitchShift();
    
    // Update display immediately
    this.updateDisplayText();
  }

  private adjustPitchSmooth(delta: number): void {
    if (!this.state.activeMedia) return;

    // Smooth pitch adjustment that snaps to chromatic positions
    let newPitch = this.state.currentPitchShift + delta;
    
    // Clamp to -6 to +6 semitones range
    newPitch = Math.max(-6, Math.min(6, newPitch));
    
    // Round to nearest chromatic step (integer semitone)
    const snappedPitch = Math.round(newPitch);
    
    // Always update the pitch (even if same value) to provide visual feedback
    this.state.currentPitchShift = snappedPitch;
    this.applyPitchShift();
  }

  private applyPitchShift(): void {
    if (!this.state.activeMedia) return;
    
    // Calculate pitch ratio from semitones
    const pitchRatio = this.semitoneToRatio(this.state.currentPitchShift);
    
    // For pitch changes, disable preservesPitch and combine with speed
    this.state.activeMedia.preservesPitch = false;
    
    // Apply ONLY pitch change - don't modify speed
    const combinedRate = pitchRatio * this.state.currentSpeedMultiplier;
    this.state.activeMedia.playbackRate = combinedRate;
    
    const pitchName = this.getPitchShiftName(this.state.currentPitchShift);
    this.showHUD(`Pitch: ${pitchName}`, 1000);
    
    console.log(`[PunchLooper] Pitch: ${this.state.currentPitchShift} semitones, Speed: ${this.state.currentSpeedMultiplier}x, Combined: ${combinedRate.toFixed(3)}x`);
    
    // Update pitch knob rotation
    this.updateKnobRotation('pitch');
    this.updateGUILEDs();
  }

  private getPitchShiftName(semitones: number): string {
    if (semitones === 0) return 'Original pitch';
    const direction = semitones > 0 ? 'up' : 'down';
    const abs = Math.abs(semitones);
    const octaves = Math.floor(abs / 12);
    const remainder = abs % 12;
    
    let name = '';
    if (octaves > 0) {
      name += `${octaves} octave${octaves > 1 ? 's' : ''} `;
    }
    if (remainder > 0) {
      name += `${remainder} semitone${remainder > 1 ? 's' : ''} `;
    }
    return name.trim() + ` ${direction}`;
  }

  private getIntervalForSemitones(semitones: number): { semitones: number; name: string; rate: number } {
    // Find the closest musical interval for fallback
    const interval = this.musicalIntervals.find(i => i.semitones === semitones);
    return interval || { semitones: 0, name: 'Original pitch', rate: 1.0 };
  }

  private toggleAudioEngine(): void {
    // No longer needed - we're using simple musical intervals
    this.showHUD('Using musical intervals for natural pitch/speed', 1200);
  }

  private resetPlaybackSettings(): void {
    if (!this.state.activeMedia) return;

    // Reset both pitch and speed to defaults
    this.state.currentSemitoneShift = 0;
    this.state.currentPitchShift = 0;
    this.state.currentSpeedMultiplier = 1.0;
    
    // Reset to normal playback
    this.state.activeMedia.playbackRate = 1.0;
    this.state.activeMedia.preservesPitch = true; // Default to pitch preservation
    
    this.showHUD('Pitch and speed reset to original', 700);
    console.log('[PunchLooper] Playback settings reset to defaults');
    
    // Update both knob positions to center (reset position)
    this.updateKnobRotation('pitch');
    this.updateKnobRotation('speed');
    this.updateGUILEDs();
  }

  private toggleMetronome(): void {
    this.settings.metronomeEnabled = !this.settings.metronomeEnabled;
    
    // Save to storage
    chrome.storage.sync.set({ metronomeEnabled: this.settings.metronomeEnabled });
    
    if (this.settings.metronomeEnabled) {
      this.initMetronome();
      this.showHUD(`Metronome ON (${this.settings.clicksPerLoop} clicks/loop)`, 1000);
    } else {
      this.showHUD('Metronome OFF', 700);
    }
  }

  private initMetronome(): void {
    if (this.state.metronomeAudio) return;

    // Create a simple click sound using Web Audio API
    this.state.metronomeAudio = new Audio();
    this.state.metronomeAudio.volume = 0.3;
    
    // Create a simple beep sound as data URL
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const sampleRate = audioContext.sampleRate;
    const duration = 0.1; // 100ms click
    const length = sampleRate * duration;
    const buffer = audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    // Generate a simple beep
    for (let i = 0; i < length; i++) {
      data[i] = Math.sin(2 * Math.PI * 800 * i / sampleRate) * Math.exp(-i / (sampleRate * 0.05));
    }

    // Convert to data URL (simplified - in real implementation you'd need to encode properly)
    // For now, we'll use a simple approach
    this.state.metronomeAudio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBjiR1/LNeSsFJHfH8N2QQAoUXrTp';
  }

  private handleMetronomeClick(currentTime: number, loopLength: number): void {
    if (!this.state.activeMedia || !this.state.metronomeAudio || 
        this.state.pointA === null || this.state.pointB === null) {
      return;
    }

    // Calculate position in loop (0 to 1)
    const relativeTime = (currentTime - this.state.pointA) / loopLength;
    const loopPosition = relativeTime % 1; // Handle if we're slightly past the end

    // Calculate which click we should be on
    const clickInterval = 1 / this.settings.clicksPerLoop;
    const currentClickIndex = Math.floor(loopPosition / clickInterval);
    const nextClickTime = this.state.pointA + (currentClickIndex + 1) * clickInterval * loopLength;

    // Check if we should play a click (with small tolerance for timing)
    const timeSinceLastClick = currentTime - this.state.lastClickTime;
    const timeToNextClick = nextClickTime - currentTime;
    
    if (timeToNextClick <= 0.05 && timeSinceLastClick > 0.1) { // 50ms window, minimum 100ms between clicks
      this.playMetronomeClick(currentClickIndex === 0); // First click is emphasized
      this.state.lastClickTime = currentTime;
    }
  }

  private playMetronomeClick(isDownbeat: boolean): void {
    if (!this.state.metronomeAudio) return;

    try {
      // Reset and play the click
      this.state.metronomeAudio.currentTime = 0;
      this.state.metronomeAudio.volume = isDownbeat ? 0.6 : 0.4; // Emphasize downbeat
      this.state.metronomeAudio.play().catch(e => {
        console.warn('Metronome click failed:', e);
      });
    } catch (error) {
      console.warn('Error playing metronome click:', error);
    }
  }

  private adjustLoopEdge(point: 'A' | 'B', direction: 'forward' | 'back'): void {
    if (!this.state.activeMedia || this.state.pointA === null || this.state.pointB === null) {
      this.showHUD('No loop points set', 700);
      return;
    }

    const adjustment = (direction === 'forward' ? 1 : -1) * (this.settings.jogAdjustmentMs / 1000);

    if (point === 'A') {
      const newPointA = Math.max(0, this.state.pointA + adjustment);
      if (newPointA < this.state.pointB) {
        this.state.pointA = newPointA;
        this.showHUD(`Point A: ${this.state.pointA.toFixed(2)}s`, 700);
      } else {
        this.showHUD('Point A cannot pass point B', 700);
      }
    } else {
      const newPointB = Math.max(0, this.state.pointB + adjustment);
      const maxTime = this.state.activeMedia.duration || Number.MAX_SAFE_INTEGER;
      if (newPointB > this.state.pointA && newPointB <= maxTime) {
        this.state.pointB = newPointB;
        this.showHUD(`Point B: ${this.state.pointB.toFixed(2)}s`, 700);
      } else {
        this.showHUD('Point B out of bounds', 700);
      }
    }
  }

  private createHUD(): void {
    console.log('createHUD called');
    
    // Create container
    const container = document.createElement('div');
    container.id = 'punch-looper-hud-container';
    container.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      background: rgba(20, 20, 20, 0.95) !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-radius: 8px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      z-index: 2147483647 !important;
      opacity: 0 !important;
      transition: opacity 0.2s ease-out !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
      backdrop-filter: blur(10px) !important;
      min-width: 220px !important;
      user-select: none !important;
    `;
    
    // Title bar
    const titleBar = document.createElement('div');
    titleBar.style.cssText = `
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 6px 10px !important;
      background: rgba(30, 30, 30, 0.8) !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-radius: 8px 8px 0 0 !important;
      cursor: move !important;
    `;
    
    // Title and controls container
    const titleContent = document.createElement('div');
    titleContent.className = 'title-content';
    titleContent.style.cssText = `
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      flex: 1 !important;
    `;
    
    // Title
    const title = document.createElement('span');
    title.textContent = 'YT Looper';
    title.style.cssText = `
      color: #999 !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      letter-spacing: 0.5px !important;
    `;
    
    // Settings button
    const settingsBtn = document.createElement('button');
    settingsBtn.innerHTML = '⚙';
    settingsBtn.style.cssText = `
      background: none !important;
      border: none !important;
      color: #666 !important;
      cursor: pointer !important;
      padding: 0 4px !important;
      font-size: 14px !important;
      transition: color 0.2s !important;
    `;
    settingsBtn.onmouseover = () => settingsBtn.style.color = '#fff !important';
    settingsBtn.onmouseout = () => settingsBtn.style.color = '#666 !important';
    settingsBtn.onclick = (e) => {
      e.stopPropagation();
      this.showSettingsModal();
    };
    
    titleContent.appendChild(title);
    titleContent.appendChild(settingsBtn);
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
      background: none !important;
      border: none !important;
      color: #666 !important;
      cursor: pointer !important;
      padding: 0 4px !important;
      font-size: 20px !important;
      line-height: 1 !important;
      transition: color 0.2s !important;
    `;
    closeBtn.onmouseover = () => closeBtn.style.color = '#ff4444 !important';
    closeBtn.onmouseout = () => closeBtn.style.color = '#666 !important';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      this.hideHUD();
    };
    
    titleBar.appendChild(titleContent);
    titleBar.appendChild(closeBtn);
    
    // Message area
    const messageArea = document.createElement('div');
    messageArea.id = 'punch-looper-hud';
    messageArea.style.cssText = `
      padding: 10px 14px !important;
      color: #fff !important;
      font-size: 13px !important;
      font-weight: 500 !important;
      min-height: 20px !important;
      white-space: nowrap !important;
    `;
    
    container.appendChild(titleBar);
    container.appendChild(messageArea);
    document.body.appendChild(container);
    
    this.state.hudElement = messageArea;
    
    // Make draggable by title bar only
    this.makeDraggable(container, titleBar);
    
    console.log('HUD created and added to DOM');
  }
  
  private makeDraggable(element: HTMLElement, handle: HTMLElement): void {
    let isDragging = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;

    handle.addEventListener('mousedown', (e: MouseEvent) => {
      // Only allow dragging on the title bar itself, not buttons
      const target = e.target as HTMLElement;
      if (target === handle || target.tagName === 'SPAN' && target.closest('.title-content')) {
        initialX = e.clientX - currentX;
        initialY = e.clientY - currentY;
        isDragging = true;
        e.preventDefault();
      }
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        element.style.transform = `translate(${currentX}px, ${currentY}px)`;
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  private showHUD(message: string, duration: number): void {
    console.log('showHUD called:', message, 'duration:', duration);
    
    // Display on the pedal GUI instead of separate HUD
    if (this.state.guiElement && this.state.isGuiVisible) {
      const timeDisplay = this.state.guiElement.querySelector('#time-display');
      if (timeDisplay) {
        timeDisplay.textContent = message;
        
        if (this.state.hudTimeout) {
          clearTimeout(this.state.hudTimeout);
        }

        if (duration > 0) {
          this.state.hudTimeout = window.setTimeout(() => {
            // Only update if GUI is still visible and element still exists
            if (this.state.guiElement && this.state.isGuiVisible) {
              const currentTimeDisplay = this.state.guiElement.querySelector('#time-display');
              if (currentTimeDisplay && this.state.activeMedia) {
                currentTimeDisplay.textContent = this.formatTime(this.state.activeMedia.currentTime);
              }
            }
          }, duration);
        }
      }
    }
    // If GUI is not visible, just log the message (fallback behavior)
    else {
      console.log('GUI not visible, message:', message);
    }
  }

  private showSettingsModal(): void {
    // Create modal backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'punch-looper-settings-backdrop';
    backdrop.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: rgba(0, 0, 0, 0.7) !important;
      z-index: 2147483647 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    `;

    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #2a2a2a !important;
      border-radius: 12px !important;
      padding: 24px !important;
      width: 400px !important;
      max-width: 90vw !important;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5) !important;
      color: white !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    `;

    modal.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 20px;">
        <h2 style="color: #ff3333; margin: 0; flex: 1; font-size: 20px;">YT Looper Settings</h2>
        <button id="close-settings" style="background: none; border: none; color: #ccc; font-size: 24px; cursor: pointer; padding: 0; width: 30px; height: 30px;">&times;</button>
      </div>
      
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; color: #ccc; font-size: 14px;">Latency Compensation (ms)</label>
        <input type="range" id="latency-slider" min="0" max="200" value="${this.settings.latencyCompensation}" 
               style="width: 100%; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; color: #888; font-size: 12px;">
          <span>0ms</span>
          <span id="latency-value">${this.settings.latencyCompensation}ms</span>
          <span>200ms</span>
        </div>
        <p style="color: #999; font-size: 12px; margin: 8px 0 0 0;">Compensates for audio delay. Increase if loops feel late.</p>
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; color: #ccc; font-size: 14px;">Loop Edge Bleed (ms)</label>
        <input type="range" id="bleed-slider" min="0" max="300" value="${this.settings.edgeBleed}" 
               style="width: 100%; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; color: #888; font-size: 12px;">
          <span>0ms</span>
          <span id="bleed-value">${this.settings.edgeBleed}ms</span>
          <span>300ms</span>
        </div>
        <p style="color: #999; font-size: 12px; margin: 8px 0 0 0;">Overlap before A and after B for smoother loops.</p>
      </div>


      <div style="display: flex; gap: 12px; margin-top: 24px;">
        <button id="reset-settings" style="flex: 1; padding: 10px; background: #444; color: white; border: none; border-radius: 6px; cursor: pointer;">Reset Defaults</button>
        <button id="save-settings" style="flex: 1; padding: 10px; background: #ff3333; color: white; border: none; border-radius: 6px; cursor: pointer;">Save</button>
      </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    // Add event listeners
    const latencySlider = modal.querySelector('#latency-slider') as HTMLInputElement;
    const latencyValue = modal.querySelector('#latency-value') as HTMLElement;
    const bleedSlider = modal.querySelector('#bleed-slider') as HTMLInputElement;
    const bleedValue = modal.querySelector('#bleed-value') as HTMLElement;
    const jogSlider = modal.querySelector('#jog-slider') as HTMLInputElement;
    const jogValue = modal.querySelector('#jog-value') as HTMLElement;

    latencySlider.addEventListener('input', () => {
      latencyValue.textContent = `${latencySlider.value}ms`;
    });

    bleedSlider.addEventListener('input', () => {
      bleedValue.textContent = `${bleedSlider.value}ms`;
    });

    jogSlider?.addEventListener('input', () => {
      jogValue.textContent = `${jogSlider.value}ms`;
    });

    // Close modal
    const closeModal = () => {
      backdrop.remove();
    };

    modal.querySelector('#close-settings')?.addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    // Reset defaults
    modal.querySelector('#reset-settings')?.addEventListener('click', () => {
      latencySlider.value = '50';
      bleedSlider.value = '100';
      latencyValue.textContent = '50ms';
      bleedValue.textContent = '100ms';
    });

    // Save settings
    modal.querySelector('#save-settings')?.addEventListener('click', async () => {
      this.settings.latencyCompensation = parseInt(latencySlider.value);
      this.settings.edgeBleed = parseInt(bleedSlider.value);
      this.settings.jogAdjustmentMs = parseInt(jogSlider.value);

      try {
        await chrome.storage.sync.set({
          latencyCompensation: this.settings.latencyCompensation,
          edgeBleed: this.settings.edgeBleed,
          jogAdjustmentMs: this.settings.jogAdjustmentMs
        });
        this.showHUD('Settings saved!', 1000);
        closeModal();
      } catch (error) {
        console.error('Failed to save settings:', error);
        this.showHUD('Failed to save settings', 2000);
      }
    });
  }

  private hideHUD(): void {
    if (!this.state.hudElement) return;

    const container = document.getElementById('punch-looper-hud-container');
    if (container) {
      container.style.opacity = '0';
    }
  }

  private createGUI(): void {
    const gui = document.createElement('div');
    gui.id = 'punch-looper-gui';
    gui.style.cssText = `
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      width: 160px !important;
      height: 310px !important;
      z-index: 2147483646 !important;
      pointer-events: none !important;
      opacity: 0 !important;
      transform: scale(0.9) translateY(20px) !important;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
      user-select: none !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      border-radius: 8px !important;
      overflow: hidden !important;
      background: linear-gradient(to bottom, #dd2222, #aa1111) !important;
      box-shadow: 0 12px 24px rgba(0,0,0,0.4) !important;
    `;

    gui.innerHTML = this.createPedalHTML();
    
    // Add event listeners for interaction
    this.setupGUIEventListeners(gui);
    
    document.body.appendChild(gui);
    this.state.guiElement = gui;
  }

  private createPedalHTML(): string {
    return `
      <!-- Top drag bar -->
      <div style="
        width: 100%;
        height: 30px;
        background: linear-gradient(to bottom, #333, #222);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 10px;
        box-sizing: border-box;
        cursor: move;
        border-bottom: 1px solid #111;
      " class="drag-handle">
        <div style="display: flex; align-items: center; gap: 10px;">
          <svg width="20" height="20" class="hamburger-menu" style="cursor: pointer;">
            <rect x="3" y="5" width="14" height="2" fill="#ccc"/>
            <rect x="3" y="9" width="14" height="2" fill="#ccc"/>
            <rect x="3" y="13" width="14" height="2" fill="#ccc"/>
          </svg>
          <span style="color: #fff; font-size: 12px; font-weight: bold;">YTLOOPER</span>
        </div>
        <button style="
          background: #ff4444;
          border: none;
          color: white;
          width: 20px;
          height: 20px;
          border-radius: 3px;
          cursor: pointer;
          font-weight: bold;
          font-size: 16px;
          line-height: 1;
          padding: 0;
        " class="close-button">×</button>
      </div>
      
      <svg viewBox="0 0 150 280" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 280px;">
        <!-- Boss RC-1 Style Compact Design -->
        <defs>
          <!-- Red pedal gradient -->
          <linearGradient id="redPedal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#ff3333"/>
            <stop offset="50%" style="stop-color:#dd2222"/>
            <stop offset="100%" style="stop-color:#aa1111"/>
          </linearGradient>
          <!-- Chrome knobs -->
          <radialGradient id="chromeKnob" cx="30%" cy="30%" r="70%">
            <stop offset="0%" style="stop-color:#ffffff"/>
            <stop offset="20%" style="stop-color:#f0f0f0"/>
            <stop offset="60%" style="stop-color:#d0d0d0"/>
            <stop offset="100%" style="stop-color:#b0b0b0"/>
          </radialGradient>
          <!-- Multi-color LED ring -->
          <radialGradient id="ledRing" cx="50%" cy="50%" r="50%">
            <stop offset="0%" style="stop-color:#000"/>
            <stop offset="70%" style="stop-color:#111"/>
            <stop offset="100%" style="stop-color:#333"/>
          </radialGradient>
          <!-- Green active LED -->
          <radialGradient id="greenLED" cx="50%" cy="30%" r="60%">
            <stop offset="0%" style="stop-color:#44ff44"/>
            <stop offset="100%" style="stop-color:#00aa00"/>
          </radialGradient>
          <!-- Red recording LED -->
          <radialGradient id="redLED" cx="50%" cy="30%" r="60%">
            <stop offset="0%" style="stop-color:#ff4444"/>
            <stop offset="100%" style="stop-color:#cc0000"/>
          </radialGradient>
          <!-- Orange LED -->
          <radialGradient id="orangeLED" cx="50%" cy="30%" r="60%">
            <stop offset="0%" style="stop-color:#ffaa44"/>
            <stop offset="100%" style="stop-color:#cc6600"/>
          </radialGradient>
        </defs>
        
        <!-- Main content area already has background from div -->
              
        <!-- Top section with time and A/B point display -->
        <rect x="20" y="10" width="130" height="35" rx="4" ry="4" 
              fill="#111" 
              stroke="#333" stroke-width="1"/>
        
        <text x="75" y="20" text-anchor="middle" fill="#00ff00" font-size="10" font-family="monospace" id="time-display" class="time-display">00:00.000</text>
        <text x="75" y="32" text-anchor="middle" fill="#00ff00" font-size="9" font-family="monospace" id="points-display" class="points-display">A:-- B:--</text>
        <text x="75" y="42" text-anchor="middle" fill="#888" font-size="7" id="status-display" class="status-display">READY</text>
        
        <!-- Three control knobs in a line -->
        <!-- Volume knob -->
        <g id="volume-knob" class="knob-group" data-param="volume" style="cursor: pointer;">
          <circle cx="40" cy="80" r="15" fill="url(#chromeKnob)" stroke="#999" stroke-width="1"/>
          <circle cx="40" cy="80" r="12" fill="#ddd"/>
          <line x1="40" y1="70" x2="40" y2="75" stroke="#333" stroke-width="2" stroke-linecap="round" class="knob-pointer"/>
          <text x="40" y="102" text-anchor="middle" fill="#fff" font-size="8" font-weight="bold">VOL</text>
          <text x="40" y="112" text-anchor="middle" fill="#ccc" font-size="6">100%</text>
        </g>
        
        <!-- Pitch knob -->
        <g id="pitch-knob" class="knob-group" data-param="pitch" style="cursor: pointer;">
          <circle cx="75" cy="80" r="15" fill="url(#chromeKnob)" stroke="#999" stroke-width="1"/>
          <circle cx="75" cy="80" r="12" fill="#ddd"/>
          <line x1="75" y1="70" x2="75" y2="75" stroke="#333" stroke-width="2" stroke-linecap="round" class="knob-pointer"/>
          <text x="75" y="102" text-anchor="middle" fill="#fff" font-size="8" font-weight="bold">PITCH</text>
          <text x="75" y="112" text-anchor="middle" fill="#ccc" font-size="6">${this.getCurrentIntervalName()}</text>
        </g>
        
        <!-- Tempo knob -->
        <g id="speed-knob" class="knob-group" data-param="speed" style="cursor: pointer;">
          <circle cx="110" cy="80" r="15" fill="url(#chromeKnob)" stroke="#999" stroke-width="1"/>
          <circle cx="110" cy="80" r="12" fill="#ddd"/>
          <line x1="110" y1="70" x2="110" y2="75" stroke="#333" stroke-width="2" stroke-linecap="round" class="knob-pointer"/>
          <text x="110" y="102" text-anchor="middle" fill="#fff" font-size="8" font-weight="bold">TEMPO</text>
          <text x="110" y="112" text-anchor="middle" fill="#ccc" font-size="6">${this.getCurrentPlaybackRate()}x</text>
        </g>
        
        <!-- Reset button under pitch and tempo knobs -->
        <g id="reset-button" style="cursor: pointer;" class="reset-button">
          <rect x="77" y="120" width="26" height="14" rx="2" fill="#333" stroke="#666" stroke-width="1"/>
          <text x="90" y="130" text-anchor="middle" fill="#ccc" font-size="7" font-weight="bold">RESET</text>
        </g>

        <!-- Status LEDs with properly grouped jog buttons -->
        <g id="led-and-jog-section">
          <!-- Point A section - LED with grouped jog buttons -->
          <circle cx="40" cy="155" r="6" fill="${this.state.pointA ? 'url(#greenLED)' : '#002200'}" class="led-a" stroke="#333" stroke-width="1"/>
          <text x="40" y="146" text-anchor="middle" fill="#fff" font-size="8" font-weight="bold">A</text>
          
          <!-- A jog buttons grouped together -->
          <g id="point-a-back" class="jog-button" data-action="a-back" style="cursor: pointer;">
            <rect x="23" y="164" width="18" height="15" rx="2" fill="#333" stroke="#555" stroke-width="1"/>
            <polygon points="27,171.5 33,168 33,175" fill="#ccc"/>
          </g>
          
          <g id="point-a-forward" class="jog-button" data-action="a-forward" style="cursor: pointer;">
            <rect x="43" y="164" width="18" height="15" rx="2" fill="#333" stroke="#555" stroke-width="1"/>
            <polygon points="57,171.5 51,168 51,175" fill="#ccc"/>
          </g>
          
          <!-- Point B section - LED with grouped jog buttons -->
          <circle cx="110" cy="155" r="6" fill="${this.state.pointB ? 'url(#greenLED)' : '#002200'}" class="led-b" stroke="#333" stroke-width="1"/>
          <text x="110" y="146" text-anchor="middle" fill="#fff" font-size="8" font-weight="bold">B</text>
          
          <!-- B jog buttons grouped together -->
          <g id="point-b-back" class="jog-button" data-action="b-back" style="cursor: pointer;">
            <rect x="93" y="164" width="18" height="15" rx="2" fill="#333" stroke="#555" stroke-width="1"/>
            <polygon points="97,171.5 103,168 103,175" fill="#ccc"/>
          </g>
          
          <g id="point-b-forward" class="jog-button" data-action="b-forward" style="cursor: pointer;">
            <rect x="113" y="164" width="18" height="15" rx="2" fill="#333" stroke="#555" stroke-width="1"/>
            <polygon points="127,171.5 121,168 121,175" fill="#ccc"/>
          </g>
          
          <!-- Loop LED centered -->
          <circle cx="75" cy="155" r="7" fill="${this.state.isLooping ? 'url(#redLED)' : '#220000'}" class="led-loop" stroke="#333" stroke-width="1"/>
          <text x="75" y="146" text-anchor="middle" fill="#fff" font-size="8" font-weight="bold">LOOP</text>
        </g>
        
        <!-- Display current settings -->
        <text x="75" y="185" text-anchor="middle" fill="#ccc" font-size="8">STOP</text>
        
        <!-- Large black full-width footswitch with REC/PLAY label -->
        <g id="footswitch" style="cursor: pointer;" class="footswitch">
          <rect x="20" y="200" width="130" height="60" rx="4" ry="4" fill="#000" stroke="#333" stroke-width="2"/>
          <rect x="25" y="205" width="120" height="50" rx="2" ry="2" fill="#111" stroke="#222" stroke-width="1"/>
          <!-- Subtle texture on footswitch -->
          <rect x="30" y="210" width="110" height="40" rx="2" ry="2" fill="#222"/>
          <!-- REC/PLAY label on footswitch -->
          <text x="75" y="235" text-anchor="middle" fill="#ccc" font-size="10" font-weight="bold">REC/PLAY</text>
        </g>
        
        <!-- Bottom label -->
        <text x="75" y="275" text-anchor="middle" fill="#666" font-size="8" font-weight="bold">Musical Loop Station</text>
      </svg>
    `;
  }

  private setupGUIEventListeners(gui: HTMLElement): void {
    // Close button
    const closeButton = gui.querySelector('.close-button');
    if (closeButton) {
      closeButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleGUI();
      });
    }

    // Hamburger menu
    const hamburger = gui.querySelector('.hamburger-menu');
    if (hamburger) {
      hamburger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showSettingsModal();
      });
    }

    // Footswitch for loop control
    const footswitch = gui.querySelector('#footswitch');
    if (footswitch) {
      footswitch.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleFootswitchClick();
      });
    }

    // Knob controls
    const knobs = gui.querySelectorAll('.knob-group');
    knobs.forEach(knob => {
      knob.addEventListener('mousedown', (e) => this.startKnobDrag(e as MouseEvent, knob as SVGElement));
    });

    // Reset button
    const resetButton = gui.querySelector('#reset-button');
    if (resetButton) {
      resetButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.resetPlaybackSettings();
      });
    }

    // Jog buttons for loop edge adjustment
    const jogButtons = gui.querySelectorAll('.jog-button');
    jogButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const action = (button as SVGElement).getAttribute('data-action');
        if (action) {
          this.handleJogButton(action);
        }
      });
    });

    // Global mouse events for knob dragging
    document.addEventListener('mousemove', (e) => this.handleKnobDrag(e));
    document.addEventListener('mouseup', () => this.endKnobDrag());

    // Make GUI draggable ONLY by the top bar
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    const dragHandle = gui.querySelector('.drag-handle') as HTMLElement;
    if (dragHandle) {
      dragHandle.addEventListener('mousedown', (e) => {
        // Don't start drag if clicking close button or hamburger
        if ((e.target as Element).closest('.close-button, .hamburger-menu')) return;
        
        isDragging = true;
        const rect = gui.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
        dragHandle.style.cursor = 'grabbing';
      });
    }

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      gui.style.right = 'auto';
      gui.style.bottom = 'auto';
      gui.style.left = `${e.clientX - dragOffset.x}px`;
      gui.style.top = `${e.clientY - dragOffset.y}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        const handle = gui.querySelector('.drag-handle') as HTMLElement;
        if (handle) {
          handle.style.cursor = 'move';
        }
      }
    });
  }

  private toggleGUI(): void {
    if (!this.state.guiElement) return;

    this.state.isGuiVisible = !this.state.isGuiVisible;
    
    if (this.state.isGuiVisible) {
      this.state.guiElement.style.opacity = '1';
      this.state.guiElement.style.transform = 'scale(1) translateY(0)';
      this.state.guiElement.style.pointerEvents = 'auto';
      this.showHUD('Guitar pedal GUI shown (Shift+G)', 1000);
      
      // Initialize native audio controls when GUI is shown
      if (this.state.activeMedia) {
        this.initializeNativeAudioControls();
        this.updateDisplayText();
      }
    } else {
      this.state.guiElement.style.opacity = '0';
      this.state.guiElement.style.transform = 'scale(0.9) translateY(20px)';
      this.state.guiElement.style.pointerEvents = 'none';
      this.showHUD('Guitar pedal GUI hidden', 700);
    }
  }

  private handleFootswitchClick(): void {
    if (!this.state.activeMedia) {
      this.showHUD('No media found', 1000);
      return;
    }

    const currentTime = Date.now();
    const timeSinceLastTap = currentTime - this.state.lastTapTime;
    this.state.lastTapTime = currentTime;

    if (this.state.isLooping) {
      // Stop loop and reset points
      this.resetLoop();
    } else if (this.state.pointA === null) {
      // Set point A
      this.setPointA();
      this.updateGUILEDs();
    } else if (this.state.pointB === null || timeSinceLastTap > 1200) {
      // Set point B and start loop
      this.setPointB();
      if (this.state.pointA !== null && this.state.pointB !== null) {
        this.startLoop();
      }
      this.updateGUILEDs();
    } else {
      // Double tap - reset
      this.resetLoop();
      this.updateGUILEDs();
    }
  }

  private updateGUILEDs(): void {
    if (!this.state.guiElement) return;
    
    // Update LED colors
    const ledA = this.state.guiElement.querySelector('.led-a') as SVGCircleElement;
    const ledB = this.state.guiElement.querySelector('.led-b') as SVGCircleElement;
    const ledLoop = this.state.guiElement.querySelector('.led-loop') as SVGCircleElement;

    if (ledA) ledA.setAttribute('fill', this.state.pointA ? 'url(#greenLED)' : '#002200');
    if (ledB) ledB.setAttribute('fill', this.state.pointB ? 'url(#greenLED)' : '#002200');
    if (ledLoop) ledLoop.setAttribute('fill', this.state.isLooping ? 'url(#redLED)' : '#220000');
    
    // Update display text
    this.updateDisplayText();
  }
  
  private updateDisplayText(): void {
    if (!this.state.guiElement || !this.state.activeMedia) return;
    
    // Update time display
    const timeDisplay = this.state.guiElement.querySelector('#time-display');
    if (timeDisplay) {
      const currentTime = this.state.activeMedia.currentTime;
      timeDisplay.textContent = this.formatTime(currentTime);
    }
    
    // Update A/B points display
    const pointsDisplay = this.state.guiElement.querySelector('#points-display');
    if (pointsDisplay) {
      const aPoint = this.state.pointA ? this.formatTimeShort(this.state.pointA) : '--';
      const bPoint = this.state.pointB ? this.formatTimeShort(this.state.pointB) : '--';
      pointsDisplay.textContent = `A:${aPoint} B:${bPoint}`;
    }
    
    // Update status display
    const statusDisplay = this.state.guiElement.querySelector('#status-display');
    if (statusDisplay) {
      if (this.state.isLooping) {
        statusDisplay.textContent = 'LOOPING';
      } else if (this.state.pointB) {
        statusDisplay.textContent = 'A→B SET';
      } else if (this.state.pointA) {
        statusDisplay.textContent = 'A SET';
      } else {
        statusDisplay.textContent = 'READY';
      }
    }
  }
  
  private formatTimeShort(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private startKnobDrag(e: MouseEvent, knob: SVGElement): void {
    e.preventDefault();
    e.stopPropagation();
    
    const param = knob.getAttribute('data-param');
    if (!param) return;
    
    this.state.isDraggingKnob = param;
    document.body.style.cursor = 'grabbing';
  }

  private handleKnobDrag(e: MouseEvent): void {
    if (!this.state.isDraggingKnob) return;

    const deltaY = e.movementY;
    
    switch (this.state.isDraggingKnob) {
      case 'volume':
        // YouTube volume control - slower like tempo
        this.adjustYouTubeVolume(-deltaY * 0.002);
        break;
      case 'pitch':
        // Smooth pitch control like other knobs, but snap to half-steps
        const pitchSensitivity = 0.002; // Same sensitivity as other knobs
        const currentPitch = this.state.currentPitchShift;
        const newPitch = currentPitch + (-deltaY * pitchSensitivity * 24); // Scale to semitone range
        
        // Snap to nearest half-step
        const snappedPitch = Math.round(newPitch * 2) / 2; // Round to nearest 0.5
        const clampedPitch = Math.max(-12, Math.min(12, snappedPitch)); // Clamp to ±12 semitones
        
        // Use step-based adjustment if pitch changed
        const stepChange = clampedPitch - currentPitch;
        if (Math.abs(stepChange) >= 0.5) {
          const steps = Math.round(stepChange / 0.5); // Convert to half-step increments
          this.adjustPitch(steps * 0.5);
        }
        break;
      case 'speed':
        // Smooth speed control: 0.5x to 1.5x with noon = 1.0x
        const speedSensitivity = 0.002; // Keep same sensitivity
        this.adjustPlaybackRate(-deltaY * speedSensitivity);
        break;
    }
    
    this.updateKnobRotation(this.state.isDraggingKnob);
  }

  private endKnobDrag(): void {
    this.state.isDraggingKnob = null;
    document.body.style.cursor = '';
  }

  private updateKnobRotation(param: string): void {
    if (!this.state.guiElement) return;
    
    const knob = this.state.guiElement.querySelector(`#${param}-knob .knob-pointer`) as SVGLineElement;
    if (!knob) return;
    
    let angle = 0;
    let centerX = 85;
    const centerY = 80;
    
    switch (param) {
      case 'volume':
        centerX = 40;
        // Volume range 0 to 1 mapped to -150° to +150°
        if (this.state.activeMedia) {
          angle = (this.state.activeMedia.volume - 0.5) * 300;
          // Show in LCD display
          const percentage = Math.round(this.state.activeMedia.volume * 100);
          this.showParameterInDisplay(`VOL: ${percentage}%`);
        }
        break;
      case 'pitch':
        centerX = 75;
        // 13 discrete positions: -6 to +6 semitones = -150° to +150°
        angle = (this.state.currentPitchShift / 6) * 150;
        // Show in LCD display
        this.showParameterInDisplay(`PITCH: ${this.getCurrentIntervalName()}`);
        break;
      case 'speed':
        centerX = 110;
        // Speed range 0.5x to 1.5x with noon (0°) = 1.0x
        const normalizedSpeed = (this.state.currentSpeedMultiplier - 1.0) / 0.5;
        angle = normalizedSpeed * 150;
        // Show in LCD display
        const speedPercentage = Math.round(this.state.currentSpeedMultiplier * 100);
        this.showParameterInDisplay(`TEMPO: ${speedPercentage}%`);
        break;
    }
    
    knob.setAttribute('transform', `rotate(${angle} ${centerX} ${centerY})`);
    
    // Update volume display
    if (param === 'volume' && this.state.activeMedia) {
      const volText = this.state.guiElement.querySelector('#volume-knob text:last-child');
      if (volText) {
        volText.textContent = `${Math.round(this.state.activeMedia.volume * 100)}%`;
      }
    }
  }

  private showParameterInDisplay(message: string): void {
    if (!this.state.guiElement || !this.state.isGuiVisible) return;
    
    const statusDisplay = this.state.guiElement.querySelector('#status-display');
    if (statusDisplay) {
      statusDisplay.textContent = message;
      
      // Clear the parameter display after 2 seconds
      setTimeout(() => {
        if (this.state.guiElement && this.state.isGuiVisible) {
          const currentStatusDisplay = this.state.guiElement.querySelector('#status-display');
          if (currentStatusDisplay) {
            if (this.state.isLooping) {
              currentStatusDisplay.textContent = 'LOOPING';
            } else if (this.state.pointB) {
              currentStatusDisplay.textContent = 'A→B SET';
            } else if (this.state.pointA) {
              currentStatusDisplay.textContent = 'A SET';
            } else {
              currentStatusDisplay.textContent = 'READY';
            }
          }
        }
      }, 2000);
    }
  }

  private adjustYouTubeVolume(delta: number): void {
    if (!this.state.activeMedia) {
      this.showHUD('No media found', 1000);
      return;
    }

    // Adjust volume (0 to 1 range)
    const newVolume = Math.max(0, Math.min(1, this.state.activeMedia.volume + delta));
    this.state.activeMedia.volume = newVolume;
    
    const percentage = Math.round(newVolume * 100);
    this.showHUD(`Volume: ${percentage}%`, 500);
    
    // Update display immediately
    this.updateDisplayText();
  }


  private handleJogButton(action: string): void {
    if (!this.state.activeMedia) {
      this.showHUD('No media found', 1000);
      return;
    }

    const adjustment = this.settings.jogAdjustmentMs / 1000; // Convert ms to seconds

    switch (action) {
      case 'a-back':
        if (this.state.pointA !== null) {
          this.state.pointA = Math.max(0, this.state.pointA - adjustment);
          this.showHUD(`Point A: ${this.formatTime(this.state.pointA)}`, 800);
          this.updateGUILEDs();
          this.updateDisplayText();
        } else {
          this.showHUD('Set point A first with footswitch', 1000);
        }
        break;
        
      case 'a-forward':
        if (this.state.pointA !== null) {
          const maxTime = this.state.activeMedia.duration || this.state.activeMedia.currentTime + 10;
          const newA = this.state.pointA + adjustment;
          if (!this.state.pointB || newA < this.state.pointB) {
            this.state.pointA = Math.min(maxTime, newA);
            this.showHUD(`Point A: ${this.formatTime(this.state.pointA)}`, 800);
            this.updateGUILEDs();
            this.updateDisplayText();
          } else {
            this.showHUD('Point A cannot pass point B', 1000);
          }
        } else {
          this.showHUD('Set point A first with footswitch', 1000);
        }
        break;
        
      case 'b-back':
        if (this.state.pointB !== null) {
          const newB = this.state.pointB - adjustment;
          if (!this.state.pointA || newB > this.state.pointA) {
            this.state.pointB = Math.max(0, newB);
            this.showHUD(`Point B: ${this.formatTime(this.state.pointB)}`, 800);
            this.updateGUILEDs();
            this.updateDisplayText();
          } else {
            this.showHUD('Point B cannot pass point A', 1000);
          }
        } else {
          this.showHUD('Set point B first with footswitch', 1000);
        }
        break;
        
      case 'b-forward':
        if (this.state.pointB !== null) {
          const maxTime = this.state.activeMedia.duration || this.state.activeMedia.currentTime + 10;
          this.state.pointB = Math.min(maxTime, this.state.pointB + adjustment);
          this.showHUD(`Point B: ${this.formatTime(this.state.pointB)}`, 800);
          this.updateGUILEDs();
          this.updateDisplayText();
        } else {
          this.showHUD('Set point B first with footswitch', 1000);
        }
        break;
    }
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
  }

  private getCurrentInterval() {
    return this.musicalIntervals.find(interval => interval.semitones === this.state.currentSemitoneShift) || this.musicalIntervals[7];
  }

  private getCurrentIntervalName(): string {
    const interval = this.getCurrentInterval();
    // Shorten the name for display
    return interval.name.replace('Original pitch', 'Orig').replace(' up', '↑').replace(' down', '↓');
  }

  private getCurrentPlaybackRate(): string {
    const interval = this.getCurrentInterval();
    return interval.rate.toFixed(3);
  }


  private initializeNativeAudioControls(): void {
    if (!this.state.activeMedia) return;
    
    // Set up native browser audio controls
    this.state.activeMedia.preservesPitch = true; // Enable pitch preservation by default
    this.state.activeMedia.playbackRate = 1.0;
    
    // Reset state values
    this.state.currentPitchShift = 0;
    this.state.currentSpeedMultiplier = 1.0;
    
    this.showHUD('Native audio controls initialized', 800);
    console.log('[PunchLooper] Native audio controls initialized');
  }

  private cleanupAudioProcessing(): void {
    // Reset media element to defaults when switching
    if (this.state.activeMedia) {
      this.state.activeMedia.playbackRate = 1.0;
      this.state.activeMedia.preservesPitch = true;
      console.log('[PunchLooper] Audio settings reset to defaults');
    }
  }

  // Removed createPitchShiftProcessor - using native browser capabilities

  public destroy(): void {
    this.stopLoop();
    this.cleanupAudioProcessing();
    
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }

    if (this.state.hudElement) {
      this.state.hudElement.remove();
    }

    if (this.state.guiElement) {
      this.state.guiElement.remove();
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