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
  guiScale: number;
  experimentalPitch: boolean;
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
    guiScale: 1.0,
    experimentalPitch: false,
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
      
      // Apply edge bleed to create overlap and eliminate gaps
      // Edge bleed shortens the loop by moving B earlier and A later
      const bleedSeconds = this.settings.edgeBleed / 1000;
      
      // Move point B earlier (shortens the loop)
      const effectivePointB = this.state.pointB - bleedSeconds;
      // Keep point A at original position (or slightly later for overlap)
      const effectivePointA = this.state.pointA;
      
      // Check if we've reached the effective loop end point
      const shouldLoop = currentTime >= effectivePointB;
      
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
    this.showParameterChange(`TEMPO: ${speedPercentage}%`);
    
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
    
    const pitchSign = this.state.currentPitchShift > 0 ? '+' : '';
    this.showParameterChange(`PITCH: ${pitchSign}${this.state.currentPitchShift} ST`);
    
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
    let isDraggingHUD = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;
    
    // Define the event handlers as named functions so they can be removed
    const hudMouseMove = (e: MouseEvent) => {
      if (isDraggingHUD) {
        e.preventDefault();
        e.stopPropagation(); // Prevent interference with other drag handlers
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        element.style.transform = `translate(${currentX}px, ${currentY}px)`;
      }
    };
    
    const hudMouseUp = () => {
      if (isDraggingHUD) {
        isDraggingHUD = false;
        document.removeEventListener('mousemove', hudMouseMove);
        document.removeEventListener('mouseup', hudMouseUp);
      }
    };

    handle.addEventListener('mousedown', (e: MouseEvent) => {
      // Only allow dragging on the title bar itself, not buttons
      const target = e.target as HTMLElement;
      if (target === handle || target.tagName === 'SPAN' && target.closest('.title-content')) {
        initialX = e.clientX - currentX;
        initialY = e.clientY - currentY;
        isDraggingHUD = true;
        
        // Add event listeners only when dragging starts
        document.addEventListener('mousemove', hudMouseMove);
        document.addEventListener('mouseup', hudMouseUp);
        
        e.preventDefault();
        e.stopPropagation(); // Prevent interference with other drag handlers
      }
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
      width: 500px !important;
      max-width: 90vw !important;
      max-height: 80vh !important;
      overflow-y: auto !important;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5) !important;
      color: white !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    `;

    modal.innerHTML = `
      <div id="modal-header" style="
        display: flex; 
        align-items: center; 
        justify-content: space-between;
        margin-bottom: 20px; 
        padding: 8px 12px;
        background: #1a1a1a;
        border-radius: 8px 8px 0 0;
        margin: -24px -24px 20px -24px;
        cursor: move;
        user-select: none;
      ">
        <h2 style="color: #ff3333; margin: 0; font-size: 20px;">YT Looper Settings</h2>
        <button id="close-settings" style="
          background: none; 
          border: none; 
          color: #ccc; 
          font-size: 20px; 
          cursor: pointer; 
          padding: 4px 8px;
          border-radius: 4px;
          transition: background-color 0.2s, color 0.2s;
        " onmouseover="this.style.backgroundColor='#ff3333'; this.style.color='white';" 
           onmouseout="this.style.backgroundColor='transparent'; this.style.color='#ccc';">&times;</button>
      </div>
      
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; color: #ccc; font-size: 14px;">Loop Timing Compensation</label>
        <input type="range" id="latency-slider" min="-100" max="100" value="${this.settings.latencyCompensation}" 
               style="width: 100%; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; color: #888; font-size: 12px;">
          <span style="flex: 1; text-align: left;">Pre-loop<br>-100ms</span>
          <span id="latency-value" style="flex: 1; text-align: center; font-weight: bold; color: #fff;">${this.settings.latencyCompensation > 0 ? '+' : ''}${this.settings.latencyCompensation}ms</span>
          <span style="flex: 1; text-align: right;">Post-loop<br>+100ms</span>
        </div>
        <p style="color: #999; font-size: 12px; margin: 8px 0 0 0;">
          <strong>0</strong> = keypress at exact loop point<br>
          <strong>Negative</strong> = compensate for early keypresses<br>  
          <strong>Positive</strong> = compensate for late keypresses
        </p>
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; color: #ccc; font-size: 14px;">Loop Overlap (ms)</label>
        <input type="range" id="bleed-slider" min="0" max="300" value="${this.settings.edgeBleed}" 
               style="width: 100%; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; color: #888; font-size: 12px;">
          <span>0ms</span>
          <span id="bleed-value">${this.settings.edgeBleed}ms</span>
          <span>300ms</span>
        </div>
        <p id="bleed-description" style="color: #999; font-size: 12px; margin: 8px 0 0 0;">
          Loops back <strong>${this.settings.edgeBleed}ms early</strong> to eliminate gaps.<br>
          Higher values = tighter loops with more overlap.
        </p>
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: flex; align-items: center; gap: 8px; color: #ccc; font-size: 14px; cursor: pointer;">
          <input type="checkbox" id="experimental-pitch" ${this.settings.experimentalPitch ? 'checked' : ''} 
                 style="transform: scale(1.2);">
          <span>Experimental Pitch Controls</span>
        </label>
        <p style="color: #999; font-size: 12px; margin: 8px 0 0 24px;">
          Shows pitch adjustment controls in the GUI.<br>
          <strong>Warning:</strong> May cause audio glitches on some videos.
        </p>
      </div>

      <div style="margin-bottom: 16px;">
        <h3 style="color: #ff3333; margin: 0 0 12px 0; font-size: 16px;">Metronome</h3>
        <label style="display: flex; align-items: center; gap: 8px; color: #ccc; font-size: 14px; cursor: pointer; margin-bottom: 12px;">
          <input type="checkbox" id="metronome-enabled" ${this.settings.metronomeEnabled ? 'checked' : ''} 
                 style="transform: scale(1.2);">
          <span>Enable Metronome</span>
        </label>
        
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 8px; color: #ccc; font-size: 14px;">Clicks Per Loop</label>
          <input type="range" id="clicks-slider" min="1" max="16" value="${this.settings.clicksPerLoop}" 
                 style="width: 100%; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; color: #888; font-size: 12px;">
            <span>1</span>
            <span id="clicks-value">${this.settings.clicksPerLoop}</span>
            <span>16</span>
          </div>
          <p style="color: #999; font-size: 12px; margin: 8px 0 0 0;">Number of metronome clicks per loop cycle.</p>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="color: #ff3333; margin: 0 0 12px 0; font-size: 16px;">Keyboard Shortcuts</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between; color: #ccc;">
            <span>Set Point A:</span>
            <kbd style="background: #444; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${this.getReadableKeyName(this.settings.keyBindings.setPointA)}</kbd>
          </div>
          <div style="display: flex; justify-content: space-between; color: #ccc;">
            <span>Set Point B:</span>
            <kbd style="background: #444; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${this.getReadableKeyName(this.settings.keyBindings.setPointB)}</kbd>
          </div>
          <div style="display: flex; justify-content: space-between; color: #ccc;">
            <span>Stop Loop:</span>
            <kbd style="background: #444; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${this.getReadableKeyName(this.settings.keyBindings.stopLoop)}</kbd>
          </div>
          <div style="display: flex; justify-content: space-between; color: #ccc;">
            <span>Toggle GUI:</span>
            <kbd style="background: #444; padding: 2px 6px; border-radius: 3px; font-family: monospace;">Shift+G</kbd>
          </div>
          <div style="display: flex; justify-content: space-between; color: #ccc;">
            <span>Speed Up:</span>
            <kbd style="background: #444; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${this.getReadableKeyName(this.settings.keyBindings.speedUp)}</kbd>
          </div>
          <div style="display: flex; justify-content: space-between; color: #ccc;">
            <span>Speed Down:</span>
            <kbd style="background: #444; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${this.getReadableKeyName(this.settings.keyBindings.speedDown)}</kbd>
          </div>
          ${this.settings.experimentalPitch ? `
          <div style="display: flex; justify-content: space-between; color: #ccc;">
            <span>Pitch Up:</span>
            <kbd style="background: #444; padding: 2px 6px; border-radius: 3px; font-family: monospace;">Shift+${this.getReadableKeyName(this.settings.keyBindings.pitchUp)}</kbd>
          </div>
          <div style="display: flex; justify-content: space-between; color: #ccc;">
            <span>Pitch Down:</span>
            <kbd style="background: #444; padding: 2px 6px; border-radius: 3px; font-family: monospace;">Shift+${this.getReadableKeyName(this.settings.keyBindings.pitchDown)}</kbd>
          </div>
          <div style="display: flex; justify-content: space-between; color: #ccc;">
            <span>Reset Pitch:</span>
            <kbd style="background: #444; padding: 2px 6px; border-radius: 3px; font-family: monospace;">Shift+${this.getReadableKeyName(this.settings.keyBindings.resetPitch)}</kbd>
          </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; color: #ccc;">
            <span>A Jog Back:</span>
            <kbd style="background: #444; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${this.getReadableKeyName(this.settings.keyBindings.jogABack)}</kbd>
          </div>
          <div style="display: flex; justify-content: space-between; color: #ccc;">
            <span>A Jog Forward:</span>
            <kbd style="background: #444; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${this.getReadableKeyName(this.settings.keyBindings.jogAForward)}</kbd>
          </div>
          <div style="display: flex; justify-content: space-between; color: #ccc;">
            <span>B Jog Back:</span>
            <kbd style="background: #444; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${this.getReadableKeyName(this.settings.keyBindings.jogBBack)}</kbd>
          </div>
          <div style="display: flex; justify-content: space-between; color: #ccc;">
            <span>B Jog Forward:</span>
            <kbd style="background: #444; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${this.getReadableKeyName(this.settings.keyBindings.jogBForward)}</kbd>
          </div>
          <div style="display: flex; justify-content: space-between; color: #ccc;">
            <span>Toggle Metronome:</span>
            <kbd style="background: #444; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${this.getReadableKeyName(this.settings.keyBindings.toggleMetronome)}</kbd>
          </div>
        </div>
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
    const experimentalPitchCheckbox = modal.querySelector('#experimental-pitch') as HTMLInputElement;
    const metronomeCheckbox = modal.querySelector('#metronome-enabled') as HTMLInputElement;
    const clicksSlider = modal.querySelector('#clicks-slider') as HTMLInputElement;
    const clicksValue = modal.querySelector('#clicks-value') as HTMLElement;

    latencySlider.addEventListener('input', () => {
      const value = parseInt(latencySlider.value);
      const prefix = value > 0 ? '+' : '';
      latencyValue.innerHTML = `${prefix}${value}ms`;
      
      // Update color based on value
      if (value === 0) {
        latencyValue.style.color = '#fff';
      } else if (value < 0) {
        latencyValue.style.color = '#66ccff'; // Blue for pre-loop
      } else {
        latencyValue.style.color = '#ffcc66'; // Orange for post-loop
      }
    });

    bleedSlider.addEventListener('input', () => {
      const value = bleedSlider.value;
      bleedValue.textContent = `${value}ms`;
      
      // Update the description dynamically
      const bleedDescription = modal.querySelector('#bleed-description');
      if (bleedDescription) {
        bleedDescription.innerHTML = `Loops back <strong>${value}ms early</strong> to eliminate gaps.<br>
          Higher values = tighter loops with more overlap.`;
      }
    });

    jogSlider?.addEventListener('input', () => {
      jogValue.textContent = `${jogSlider.value}ms`;
    });

    clicksSlider?.addEventListener('input', () => {
      clicksValue.textContent = `${clicksSlider.value}`;
    });

    // Close modal
    const closeModal = () => {
      backdrop.remove();
    };

    modal.querySelector('#close-settings')?.addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    // Add drag functionality to modal header only
    const modalHeader = modal.querySelector('#modal-header');
    let isDraggingModal = false;
    let modalDragOffset = { x: 0, y: 0 };
    
    // Define the event handlers as named functions so they can be removed
    const modalMouseMove = (e: MouseEvent) => {
      if (!isDraggingModal) return;
      
      const newLeft = e.clientX - modalDragOffset.x;
      const newTop = e.clientY - modalDragOffset.y;
      
      // Keep modal within viewport bounds
      const maxLeft = window.innerWidth - modal.offsetWidth;
      const maxTop = window.innerHeight - modal.offsetHeight;
      
      modal.style.left = Math.max(0, Math.min(maxLeft, newLeft)) + 'px';
      modal.style.top = Math.max(0, Math.min(maxTop, newTop)) + 'px';
      
      e.stopPropagation(); // Prevent interference with other drag handlers
    };
    
    const modalMouseUp = () => {
      if (isDraggingModal) {
        isDraggingModal = false;
        document.removeEventListener('mousemove', modalMouseMove);
        document.removeEventListener('mouseup', modalMouseUp);
      }
    };

    modalHeader?.addEventListener('mousedown', (e) => {
      // Don't start drag if clicking on close button
      if ((e.target as Element).closest('#close-settings')) return;
      
      isDraggingModal = true;
      const modalRect = modal.getBoundingClientRect();
      modalDragOffset.x = e.clientX - modalRect.left;
      modalDragOffset.y = e.clientY - modalRect.top;
      
      modal.style.position = 'fixed';
      modal.style.top = modalRect.top + 'px';
      modal.style.left = modalRect.left + 'px';
      modal.style.transform = 'none';
      
      // Add event listeners only when dragging starts
      document.addEventListener('mousemove', modalMouseMove);
      document.addEventListener('mouseup', modalMouseUp);
      
      e.preventDefault();
      e.stopPropagation(); // Prevent interference with other drag handlers
    });

    // Reset defaults
    modal.querySelector('#reset-settings')?.addEventListener('click', () => {
      latencySlider.value = '0';
      bleedSlider.value = '100';
      jogSlider.value = '10';
      experimentalPitchCheckbox.checked = false;
      metronomeCheckbox.checked = false;
      clicksSlider.value = '4';
      latencyValue.innerHTML = '0ms';
      latencyValue.style.color = '#fff';
      bleedValue.textContent = '100ms';
      jogValue.textContent = '10ms';
      clicksValue.textContent = '4';
    });

    // Save settings
    modal.querySelector('#save-settings')?.addEventListener('click', async () => {
      this.settings.latencyCompensation = parseInt(latencySlider.value);
      this.settings.edgeBleed = parseInt(bleedSlider.value);
      this.settings.jogAdjustmentMs = parseInt(jogSlider.value);
      this.settings.experimentalPitch = experimentalPitchCheckbox.checked;
      this.settings.metronomeEnabled = metronomeCheckbox.checked;
      this.settings.clicksPerLoop = parseInt(clicksSlider.value);

      try {
        await chrome.storage.sync.set({
          latencyCompensation: this.settings.latencyCompensation,
          edgeBleed: this.settings.edgeBleed,
          jogAdjustmentMs: this.settings.jogAdjustmentMs,
          experimentalPitch: this.settings.experimentalPitch,
          metronomeEnabled: this.settings.metronomeEnabled,
          clicksPerLoop: this.settings.clicksPerLoop
        });
        this.showHUD('Settings saved!', 2000);
        
        // Update pitch controls visibility immediately
        this.updatePitchControlsVisibility();
        
        closeModal();
      } catch (error) {
        console.error('Failed to save settings:', error);
        this.showHUD('Failed to save settings', 2000);
      }
    });
  }

  private getReadableKeyName(keyCode: string): string {
    const keyMap: { [key: string]: string } = {
      'BracketLeft': '[',
      'BracketRight': ']',
      'Backslash': '\\',
      'Equal': '=',
      'Minus': '-',
      'ArrowUp': '↑',
      'ArrowDown': '↓',
      'ArrowLeft': '←',
      'ArrowRight': '→',
      'KeyR': 'R',
      'KeyM': 'M',
      'KeyG': 'G',
      'Comma': ',',
      'Period': '.',
      'Semicolon': ';',
      'Quote': "'",
      'Space': 'Space'
    };
    return keyMap[keyCode] || keyCode.replace('Key', '');
  }

  private updatePitchControlsVisibility(): void {
    if (!this.state.guiElement) return;
    
    const pitchControls = this.state.guiElement.querySelector('#pitch-controls');
    if (pitchControls) {
      (pitchControls as SVGElement).style.display = this.settings.experimentalPitch ? 'block' : 'none';
    }
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
    const scale = this.settings.guiScale || 1.0; // Default 1.0, can be 1.2 for accessibility
    gui.style.cssText = `
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      width: ${200 * scale}px !important;
      height: ${280 * scale}px !important;
      z-index: 2147483646 !important;
      pointer-events: none !important;
      opacity: 0 !important;
      transform: scale(0.9) translateY(20px) !important;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
      user-select: none !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      background: transparent !important;
      border-radius: 8px !important;
      overflow: visible !important;
    `;

    gui.innerHTML = this.createPedalSVG();
    
    // Add event listeners for interaction
    this.setupGUIEventListeners(gui);
    
    document.body.appendChild(gui);
    this.state.guiElement = gui;
    
    // Update pitch controls visibility based on settings
    this.updatePitchControlsVisibility();
  }

  private createPedalSVG(): string {
    return `
      
      <svg viewBox="0 0 170 280" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; filter: drop-shadow(0 12px 24px rgba(0,0,0,0.4));">
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
          <!-- Amber LED -->
          <radialGradient id="amberLED" cx="50%" cy="30%" r="60%">
            <stop offset="0%" style="stop-color:#ffcc00"/>
            <stop offset="100%" style="stop-color:#cc9900"/>
          </radialGradient>
        </defs>
        
        <!-- Main pedal body - Red with round corners -->
        <rect x="10" y="0" width="150" height="260" rx="8" ry="8" 
              fill="url(#redPedal)" 
              stroke="#990000" stroke-width="2"/>
        
        <!-- Top control area integrated into pedal -->
        <rect x="20" y="10" width="130" height="20" rx="4" ry="4" 
              fill="#222" 
              stroke="#555" stroke-width="1"/>
        
        <!-- Hamburger menu (left) -->
        <g id="hamburger-menu" style="cursor: pointer;" class="hamburger-menu">
          <rect x="25" y="13" width="12" height="2" fill="#ccc"/>
          <rect x="25" y="16" width="12" height="2" fill="#ccc"/>
          <rect x="25" y="19" width="12" height="2" fill="#ccc"/>
          <text x="31" y="28" text-anchor="middle" fill="#888" font-size="6" font-family="Arial, sans-serif">MENU</text>
        </g>
        
        <!-- Close button (right) -->
        <g id="close-button" style="cursor: pointer;" class="close-button">
          <circle cx="145" cy="18" r="6" fill="#444" stroke="#666" stroke-width="1"/>
          <text x="145" y="21" text-anchor="middle" fill="#ccc" font-size="12" font-weight="bold" font-family="Arial, sans-serif">×</text>
        </g>
              
        <!-- Main branding section -->
        <rect x="20" y="35" width="130" height="40" rx="4" ry="4" 
              fill="#111" 
              stroke="#333" stroke-width="1"/>
        
        <!-- Digital display inside black box - reorganized layout -->
        <rect x="25" y="40" width="120" height="30" rx="2" ry="2" fill="#000" stroke="#00ff00" stroke-width="1"/>
        
        <!-- A/B times stacked on left side -->
        <text id="a-time-display" x="35" y="50" text-anchor="start" fill="#00ff00" font-size="9" font-family="Courier New, monospace" font-weight="bold">A:--:--</text>
        <text id="b-time-display" x="35" y="62" text-anchor="start" fill="#00ff00" font-size="9" font-family="Courier New, monospace" font-weight="bold">B:--:--</text>
        
        <!-- Parameter info on far right -->
        <text id="param-display" x="135" y="56" text-anchor="end" fill="#00aa00" font-size="8" font-family="Courier New, monospace">READY</text>
        
        <!-- Input jacks -->
        <circle cx="30" cy="45" r="4" fill="#333" stroke="#666" stroke-width="1"/>
        <circle cx="30" cy="45" r="2" fill="#000"/>
        <text x="30" y="60" text-anchor="middle" fill="#888" font-size="7" font-family="Arial, sans-serif">IN 1</text>
        
        <circle cx="140" cy="45" r="4" fill="#333" stroke="#666" stroke-width="1"/>
        <circle cx="140" cy="45" r="2" fill="#000"/>
        <text x="140" y="60" text-anchor="middle" fill="#888" font-size="7" font-family="Arial, sans-serif">IN 2</text>
        
        <!-- Status LEDs horizontally below knobs -->
        <circle cx="30" cy="145" r="4" fill="${this.state.pointA ? 'url(#greenLED)' : '#002200'}" class="led-a" stroke="#333" stroke-width="1"/>
        <text x="30" y="158" text-anchor="middle" fill="#fff" font-size="8" font-weight="bold" font-family="Arial, sans-serif">A</text>
        
        <circle cx="60" cy="145" r="4" fill="${this.state.pointB ? 'url(#greenLED)' : '#002200'}" class="led-b" stroke="#333" stroke-width="1"/>
        <text x="60" y="158" text-anchor="middle" fill="#fff" font-size="8" font-weight="bold" font-family="Arial, sans-serif">B</text>
        
        <circle cx="90" cy="145" r="5" fill="${this.state.isLooping ? 'url(#amberLED)' : '#331100'}" class="led-loop" stroke="#333" stroke-width="1"/>
        <text x="90" y="158" text-anchor="middle" fill="#fff" font-size="8" font-weight="bold" font-family="Arial, sans-serif">LOOP</text>
        
        <!-- Two control knobs side by side on left - VOLUME and TEMPO only -->
        <!-- Volume knob -->
        <g id="volume-knob" class="knob-group" data-param="volume" style="cursor: pointer;">
          <circle cx="40" cy="100" r="15" fill="url(#chromeKnob)" stroke="#999" stroke-width="1"/>
          <circle cx="40" cy="100" r="12" fill="#ddd"/>
          <line x1="40" y1="90" x2="40" y2="95" stroke="#333" stroke-width="2" stroke-linecap="round" class="knob-pointer"/>
          <text x="40" y="122" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold" font-family="Arial, sans-serif">VOLUME</text>
          <text x="40" y="132" text-anchor="middle" fill="#ccc" font-size="7" font-family="Arial, sans-serif">100%</text>
        </g>
        
        <!-- Tempo knob -->
        <g id="speed-knob" class="knob-group" data-param="speed" style="cursor: pointer;">
          <circle cx="80" cy="100" r="15" fill="url(#chromeKnob)" stroke="#999" stroke-width="1"/>
          <circle cx="80" cy="100" r="12" fill="#ddd"/>
          <line x1="80" y1="90" x2="80" y2="95" stroke="#333" stroke-width="2" stroke-linecap="round" class="knob-pointer"/>
          <text x="80" y="122" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold" font-family="Arial, sans-serif">TEMPO</text>
        </g>


        <!-- A jog buttons - right of knobs -->
        <text x="130" y="85" text-anchor="middle" fill="#fff" font-size="8" font-weight="bold" font-family="Arial, sans-serif">A POINT</text>
        
        <!-- A back button (left arrow) -->
        <g id="point-a-back" class="jog-button" data-action="a-back" style="cursor: pointer;">
          <rect x="108" y="89" width="20" height="12" rx="2" fill="#333" stroke="#555" stroke-width="1"/>
          <polygon points="113,95 118,92 118,98" fill="#ccc"/>
          <text x="118" y="87" text-anchor="middle" fill="#aaa" font-size="8" font-family="Arial, sans-serif">&lt;</text>
        </g>
        
        <!-- A forward button (right arrow) -->
        <g id="point-a-forward" class="jog-button" data-action="a-forward" style="cursor: pointer;">
          <rect x="130" y="89" width="20" height="12" rx="2" fill="#333" stroke="#555" stroke-width="1"/>
          <polygon points="145,95 140,92 140,98" fill="#ccc"/>
          <text x="140" y="87" text-anchor="middle" fill="#aaa" font-size="8" font-family="Arial, sans-serif">&gt;</text>
        </g>
        
        <!-- B jog buttons - right of knobs -->
        <text x="130" y="115" text-anchor="middle" fill="#fff" font-size="8" font-weight="bold" font-family="Arial, sans-serif">B POINT</text>
        
        <!-- B back button (left arrow) -->
        <g id="point-b-back" class="jog-button" data-action="b-back" style="cursor: pointer;">
          <rect x="108" y="119" width="20" height="12" rx="2" fill="#333" stroke="#555" stroke-width="1"/>
          <polygon points="113,125 118,122 118,128" fill="#ccc"/>
          <text x="118" y="117" text-anchor="middle" fill="#aaa" font-size="8" font-family="Arial, sans-serif">&lt;</text>
        </g>
        
        <!-- B forward button (right arrow) -->
        <g id="point-b-forward" class="jog-button" data-action="b-forward" style="cursor: pointer;">
          <rect x="130" y="119" width="20" height="12" rx="2" fill="#333" stroke="#555" stroke-width="1"/>
          <polygon points="145,125 140,122 140,128" fill="#ccc"/>
          <text x="140" y="117" text-anchor="middle" fill="#aaa" font-size="8" font-family="Arial, sans-serif">&gt;</text>
        </g>
        
        <!-- Reset button (above and between knobs) -->
        <g id="reset-button" style="cursor: pointer;" class="reset-button">
          <circle cx="60" cy="85" r="6" fill="#333" stroke="#666" stroke-width="1"/>
          <text x="60" y="89" text-anchor="middle" fill="#ccc" font-size="8" font-weight="bold" font-family="Arial, sans-serif">R</text>
          <text x="60" y="97" text-anchor="middle" fill="#888" font-size="6" font-family="Arial, sans-serif">RST</text>
        </g>
        
        <!-- Pitch controls - experimental feature, hidden by default -->
        <g id="pitch-controls" style="display: ${this.settings.experimentalPitch ? 'block' : 'none'};">
          <!-- Pitch down button -->
          <g id="pitch-down" class="pitch-button" data-action="pitch-down" style="cursor: pointer;">
            <rect x="20" y="165" width="18" height="12" rx="2" fill="#333" stroke="#555" stroke-width="1"/>
            <polygon points="29,174 26,169 32,169" fill="#ccc"/>
          </g>
          
          <!-- Pitch up button -->
          <g id="pitch-up" class="pitch-button" data-action="pitch-up" style="cursor: pointer;">
            <rect x="40" y="165" width="18" height="12" rx="2" fill="#333" stroke="#555" stroke-width="1"/>
            <polygon points="49,168 46,173 52,173" fill="#ccc"/>
          </g>
          
          <!-- Pitch label to the right - now white -->
          <text x="62" y="172" text-anchor="start" fill="#fff" font-size="8" font-family="Arial, sans-serif">PITCH</text>
        </g>
        
        <!-- Section shift buttons - keep on right side -->
        <text x="130" y="145" text-anchor="middle" fill="#fff" font-size="8" font-weight="bold" font-family="Arial, sans-serif">SECTION</text>
        
        <!-- Section back button (left) -->
        <g id="section-back" class="section-button" data-action="section-back" style="cursor: pointer;">
          <rect x="108" y="149" width="20" height="12" rx="2" fill="#333" stroke="#555" stroke-width="1"/>
          <polygon points="113,155 118,152 118,158" fill="#ccc"/>
          <text x="118" y="156" text-anchor="middle" fill="#aaa" font-size="8" font-family="Arial, sans-serif">«</text>
        </g>
        
        <!-- Section forward button (right) -->
        <g id="section-forward" class="section-button" data-action="section-forward" style="cursor: pointer;">
          <rect x="130" y="149" width="20" height="12" rx="2" fill="#333" stroke="#555" stroke-width="1"/>
          <polygon points="145,155 140,152 140,158" fill="#ccc"/>
          <text x="140" y="156" text-anchor="middle" fill="#aaa" font-size="8" font-family="Arial, sans-serif">»</text>
        </g>
        
        <!-- Current settings display (moved to center) -->
        <text x="85" y="170" text-anchor="middle" fill="#888" font-size="7" font-family="Arial, sans-serif">${this.getCurrentIntervalName()}</text>
        
        <!-- Large black full-width footswitch with REC/PLAY label -->
        <g id="footswitch" style="cursor: pointer;" class="footswitch">
          <rect x="20" y="190" width="130" height="60" rx="4" ry="4" fill="#000" stroke="#333" stroke-width="2"/>
          <rect x="25" y="195" width="120" height="50" rx="2" ry="2" fill="#111" stroke="#222" stroke-width="1"/>
          <!-- Subtle texture on footswitch -->
          <rect x="30" y="200" width="110" height="40" rx="2" ry="2" fill="#222"/>
          <!-- REC/PLAY label on footswitch -->
          <text x="85" y="218" text-anchor="middle" fill="#ccc" font-size="10" font-weight="bold" font-family="Arial, sans-serif">REC</text>
          <text x="85" y="232" text-anchor="middle" fill="#ccc" font-size="10" font-weight="bold" font-family="Arial, sans-serif">PLAY</text>
        </g>
        
      </svg>
    `;
  }

  private setupGUIEventListeners(gui: HTMLElement): void {
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

    // Pitch up/down buttons
    const pitchButtons = gui.querySelectorAll('.pitch-button');
    pitchButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const action = (button as SVGElement).getAttribute('data-action');
        if (action === 'pitch-up') {
          this.adjustPitch(1);
        } else if (action === 'pitch-down') {
          this.adjustPitch(-1);
        }
      });
    });

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

    // Section buttons for shifting entire loop region
    const sectionButtons = gui.querySelectorAll('.section-button');
    sectionButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const action = (button as SVGElement).getAttribute('data-action');
        if (action === 'section-forward') {
          this.shiftLoopSection(1);
        } else if (action === 'section-back') {
          this.shiftLoopSection(-1);
        }
      });
    });

    // Global mouse events for knob dragging
    document.addEventListener('mousemove', (e) => this.handleKnobDrag(e));
    document.addEventListener('mouseup', () => this.endKnobDrag());

    // Hamburger menu event listener (integrated)
    const hamburgerMenu = gui.querySelector('#hamburger-menu');
    if (hamburgerMenu) {
      hamburgerMenu.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showSettingsModal();
      });
    }

    // Close button event listener (integrated)
    const closeButton = gui.querySelector('#close-button');
    if (closeButton) {
      closeButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleGUI();
      });
    }

    // Make entire GUI draggable (except when clicking interactive elements)
    let isDraggingGUI = false;
    let guiDragOffset = { x: 0, y: 0 };
    
    // Define the event handlers as named functions so they can be removed
    const guiMouseMove = (e: MouseEvent) => {
      if (!isDraggingGUI) return;
      gui.style.right = `${window.innerWidth - e.clientX - guiDragOffset.x}px`;
      gui.style.bottom = `${window.innerHeight - e.clientY - guiDragOffset.y}px`;
      e.stopPropagation(); // Prevent interference with other drag handlers
    };
    
    const guiMouseUp = () => {
      if (isDraggingGUI) {
        isDraggingGUI = false;
        gui.style.cursor = '';
        document.removeEventListener('mousemove', guiMouseMove);
        document.removeEventListener('mouseup', guiMouseUp);
      }
    };

    gui.addEventListener('mousedown', (e) => {
      // Don't drag if clicking on interactive elements
      if ((e.target as Element).closest('.knob-group, #footswitch, .pitch-button, .jog-button, .section-button, #reset-button, #hamburger-menu, #close-button')) return;
      
      // Only allow dragging from the top control area (y: 10-30 in the SVG, scaled by guiScale)
      const rect = gui.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const scaledTopArea = 30 * this.settings.guiScale; // Top control area height scaled
      if (clickY > scaledTopArea) return; // Only allow drag from top area
      
      e.preventDefault();
      e.stopPropagation();
      isDraggingGUI = true;
      guiDragOffset.x = e.clientX - rect.left;
      guiDragOffset.y = e.clientY - rect.top;
      gui.style.cursor = 'grabbing';
      
      // Add event listeners only when dragging starts
      document.addEventListener('mousemove', guiMouseMove);
      document.addEventListener('mouseup', guiMouseUp);
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
    if (ledLoop) ledLoop.setAttribute('fill', this.state.isLooping ? 'url(#amberLED)' : '#331100');
    
    // Update display text
    this.updateDisplayText();
  }
  
  private updateDisplayText(): void {
    if (!this.state.guiElement || !this.state.activeMedia) return;
    
    const aPoint = this.state.pointA ? this.formatTimeShort(this.state.pointA) : '--:--';
    const bPoint = this.state.pointB ? this.formatTimeShort(this.state.pointB) : '--:--';
    const pitchSign = this.state.currentPitchShift > 0 ? '+' : '';
    const pitchText = this.state.currentPitchShift !== 0 ? ` ${pitchSign}${this.state.currentPitchShift}ST` : '';
    const speedText = `${Math.round(this.state.currentSpeedMultiplier * 100)}%`;
    // Remove volumeText - not needed in new layout
    
    
    // Update stacked A/B time displays
    const aTimeDisplay = this.state.guiElement.querySelector('#a-time-display');
    if (aTimeDisplay) {
      aTimeDisplay.textContent = `A:${aPoint}`;
    }
    
    const bTimeDisplay = this.state.guiElement.querySelector('#b-time-display');
    if (bTimeDisplay) {
      bTimeDisplay.textContent = `B:${bPoint}`;
    }
    
    // Update parameter display on far right (no volume unless needed)
    const paramDisplay = this.state.guiElement.querySelector('#param-display');
    if (paramDisplay) {
      if (this.state.isLooping) {
        paramDisplay.textContent = `LOOP ${speedText}${pitchText}`;
      } else if (this.state.currentPitchShift !== 0 || this.state.currentSpeedMultiplier !== 1.0) {
        paramDisplay.textContent = `${speedText}${pitchText}`;
      } else {
        paramDisplay.textContent = 'READY';
      }
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
        this.adjustYouTubeVolume(-deltaY * 0.005);
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

  private showParameterChange(message: string): void {
    // Parameter changes now only show in the digital display, not in top bar
    // This function is kept for compatibility but does nothing
    return;
  }

  private updateKnobRotation(param: string): void {
    if (!this.state.guiElement) return;
    
    const knob = this.state.guiElement.querySelector(`#${param}-knob .knob-pointer`) as SVGLineElement;
    if (!knob) return;
    
    let angle = 0;
    const centerX = param === 'volume' ? 40 : 80; // Updated for side-by-side layout
    const centerY = 100;
    
    switch (param) {
      case 'volume':
        // Volume range 0 to 1 mapped to -150° to +150°
        if (this.state.activeMedia) {
          angle = (this.state.activeMedia.volume - 0.5) * 300;
        }
        break;
      case 'speed':
        // Speed range 0.5x to 1.5x with noon (0°) = 1.0x
        // Map: 0.5x to -150°, 1.0x to 0°, 1.5x to +150°
        const normalizedSpeed = (this.state.currentSpeedMultiplier - 1.0) / 0.5; // -1 to +1 range
        angle = normalizedSpeed * 150; // Map to -150° to +150°
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
    this.showParameterChange(`VOLUME: ${percentage}%`);
    
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
          this.showHUD(`A: ${this.formatTimeWithMs(this.state.pointA)}`, 1200);
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
            this.showHUD(`A: ${this.formatTimeWithMs(this.state.pointA)}`, 1200);
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
            this.showHUD(`B: ${this.formatTimeWithMs(this.state.pointB)}`, 1200);
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
          this.showHUD(`B: ${this.formatTimeWithMs(this.state.pointB)}`, 1200);
          this.updateGUILEDs();
          this.updateDisplayText();
        } else {
          this.showHUD('Set point B first with footswitch', 1000);
        }
        break;
    }
  }

  private shiftLoopSection(direction: number): void {
    if (!this.state.pointA || !this.state.pointB || !this.state.activeMedia) {
      this.showHUD('Set loop points first', 1000);
      return;
    }

    // Calculate the current loop duration
    const loopDuration = this.state.pointB - this.state.pointA;
    
    // Shift the entire loop region by its duration
    const shift = loopDuration * direction;
    const newPointA = this.state.pointA + shift;
    const newPointB = this.state.pointB + shift;

    // Check boundaries
    if (newPointA < 0 || newPointB > this.state.activeMedia.duration) {
      this.showHUD('Cannot shift: reached media boundary', 1000);
      return;
    }

    // Apply the shift
    this.state.pointA = newPointA;
    this.state.pointB = newPointB;
    
    // Update loop boundaries if we have an active loop
    if (this.state.loopA !== null && this.state.loopB !== null) {
      this.state.loopA = newPointA;
      this.state.loopB = newPointB;
    }

    // If currently looping, jump to the new loop start
    if (this.state.isLooping && this.state.activeMedia) {
      this.state.activeMedia.currentTime = this.state.pointA;
    }

    // Update display
    const directionText = direction > 0 ? 'forward' : 'backward';
    this.showHUD(`Section shifted ${directionText}`, 1000);
    this.updateGUILEDs();
    this.updateDisplayText();
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
  }

  private formatTimeWithMs(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const remainingSecs = seconds % 60;
    const wholeSecs = Math.floor(remainingSecs);
    const ms = Math.round((remainingSecs - wholeSecs) * 1000);
    return `${mins}:${wholeSecs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
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