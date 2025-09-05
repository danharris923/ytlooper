import { PedalTheme, getTheme, themes } from './themes';
import { BeatDetector } from './beatDetector';

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
  theme: string; // Theme ID
  referencePitch: number; // A440 reference
  beatDetectionSensitivity: number; // 0.1 to 2.0
  enableBeatDetection: boolean;
  quantizeMode: 'auto' | 'manual' | 'hybrid';
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
  enableExperimentalEQ: boolean; // Experimental EQ feature toggle
  eq: {
    low: number;      // 60Hz low shelf
    lowMid: number;   // 250Hz peaking
    mid: number;      // 1kHz peaking  
    highMid: number;  // 4kHz peaking
    high: number;     // 12kHz high shelf
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
  metronomeBuffer: AudioBuffer | null;
  metronomeContext: AudioContext | null;
  lastClickTime: number;
  guiElement: HTMLElement | null;
  isGuiVisible: boolean;
  isDraggingKnob: string | null;
  // Simplified audio processing with native browser capabilities
  currentPitchShift: number; // Independent pitch control (-12 to +12 semitones)
  currentSpeedMultiplier: number; // Independent speed control (0.25 to 4.0)
  basePitchRatio: number; // Base pitch ratio for calculations
  baseSpeedRatio: number; // Base speed ratio for calculations
  // EQ filter nodes for Web Audio API
  audioContext: AudioContext | null;
  sourceNode: MediaElementAudioSourceNode | null;
  eqFilters: {
    low: BiquadFilterNode | null;      // 60Hz low shelf
    lowMid: BiquadFilterNode | null;   // 250Hz peaking
    mid: BiquadFilterNode | null;      // 1kHz peaking
    highMid: BiquadFilterNode | null;  // 4kHz peaking
    high: BiquadFilterNode | null;     // 12kHz high shelf
  };
  // Event handler references for proper cleanup
  knobDragHandler: ((e: MouseEvent) => void) | null;
  knobMouseUpHandler: (() => void) | null;
}

class PunchLooper {
  private settings: LooperSettings = {
    looperKey: 'BracketLeft',
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
    theme: 'boss-rc1', // Default theme
    referencePitch: 440, // Standard A440
    beatDetectionSensitivity: 1.0, // Default sensitivity
    enableBeatDetection: true,
    quantizeMode: 'auto',
    enableExperimentalEQ: false, // Disabled by default
    eq: {
      low: 0,      // 60Hz low shelf (-12 to +12 dB)
      lowMid: 0,   // 250Hz peaking (-12 to +12 dB)
      mid: 0,      // 1kHz peaking (-12 to +12 dB)  
      highMid: 0,  // 4kHz peaking (-12 to +12 dB)
      high: 0      // 12kHz high shelf (-12 to +12 dB)
    },
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

  private currentTheme: PedalTheme = getTheme('boss-rc1');
  private beatDetector: BeatDetector = new BeatDetector();
  
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
    metronomeBuffer: null,
    metronomeContext: null,
    lastClickTime: 0,
    guiElement: null,
    isGuiVisible: false,
    isDraggingKnob: null,
    // Simplified audio processing
    currentPitchShift: 0,
    currentSpeedMultiplier: 1.0,
    basePitchRatio: 1.0,
    baseSpeedRatio: 1.0,
    // Quantize state
    isQuantized: false,
    originalPointA: null,
    originalPointB: null,
    // EQ filter nodes
    audioContext: null,
    sourceNode: null,
    eqFilters: {
      low: null,
      lowMid: null,
      mid: null,
      highMid: null,
      high: null
    },
    // Initialize event handlers as null
    knobDragHandler: null,
    knobMouseUpHandler: null
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
    } else if (event.code === 'KeyD' && event.shiftKey) {
      // Shift + D - double loop length
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.doubleLoopLength();
    } else if (event.code === 'KeyH' && event.shiftKey) {
      // Shift + H - half loop length
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.halfLoopLength();
    } else if (event.code === 'KeyQ' && event.shiftKey) {
      // Shift + Q - quantize loop
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.quantizeLoop();
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

  private setPointA(): void {
    if (!this.state.activeMedia) {
      this.showHUD('No media found', 1000);
      return;
    }
    
    // Apply pre-trim offset when setting point A
    let adjustedTime = this.state.activeMedia.currentTime + (this.settings.pointAPreTrim / 1000);
    adjustedTime = Math.max(0, adjustedTime); // Don't go negative
    
    this.state.pointA = adjustedTime;
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
    
    // Clear quantize state when resetting
    if (this.state.isQuantized) {
      this.state.isQuantized = false;
      this.state.originalPointA = null;
      this.state.originalPointB = null;
      
      // Update quantize button appearance
      const quantizeBtn = this.state.guiElement?.querySelector('#quantize-loop rect');
      if (quantizeBtn) {
        quantizeBtn.setAttribute('fill', '#0a4a0a'); // Dark green when off
      }
    }
    
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
      // Edge bleed creates overlap by jumping back BEFORE reaching point B
      // and jumping to BEFORE point A to create seamless transition
      const bleedSeconds = this.settings.edgeBleed / 1000;
      
      // Jump earlier (before reaching actual point B) to avoid gap
      const effectivePointB = this.state.pointB - bleedSeconds;
      // Jump to slightly before point A to overlap the beginning
      const effectivePointA = this.state.pointA - bleedSeconds;
      
      // Check if we've reached the effective loop end point
      const shouldLoop = currentTime >= effectivePointB;
      
      if (shouldLoop) {
        console.log(`Loop boundary hit: ${currentTime.toFixed(3)} -> A (${effectivePointA.toFixed(3)})`);
        
        // Apply latency compensation AND edge bleed for seamless loop
        // Jump to before point A to create overlap
        const jumpTarget = effectivePointA - (this.settings.latencyCompensation / 1000);
        this.state.activeMedia.currentTime = Math.max(0, jumpTarget);

        // Ensure playback continues after seek
        if (this.state.activeMedia.paused) {
          console.log('Video was paused, resuming playback');
          this.state.activeMedia.play().catch((error) => {
            console.warn('Failed to resume playback:', error);
          });
        }
        
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

    // Update pitch shift value (clamp between -6 and +6 semitones for half-step precision)
    this.state.currentPitchShift = Math.max(-6, Math.min(6, this.state.currentPitchShift + semitones));
    
    this.applyPitchShift();
    
    // Update pitch display
    this.updatePitchDisplay();
    
    const pitchSign = this.state.currentPitchShift > 0 ? '+' : '';
    this.showParameterChange(`PITCH: ${pitchSign}${this.state.currentPitchShift} ST`);
    
    // Update display immediately
    this.updateDisplayText();
  }
  
  private updatePitchDisplay(): void {
    if (!this.state.guiElement) return;
    
    const pitchDisplay = this.state.guiElement.querySelector('#pitch-display');
    if (pitchDisplay) {
      const pitchValue = this.state.currentPitchShift;
      if (pitchValue === 0) {
        pitchDisplay.textContent = '0ST';
        pitchDisplay.setAttribute('fill', '#888');
      } else {
        const sign = pitchValue > 0 ? '+' : '';
        pitchDisplay.textContent = `${sign}${pitchValue}ST`;
        pitchDisplay.setAttribute('fill', pitchValue > 0 ? '#0a0' : '#a00');
      }
    }
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
    
    // Update all displays
    this.updatePitchDisplay();
    this.updateKnobRotation('pitch');
    this.updateKnobRotation('speed');
    this.updateDisplayText();
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
    if (this.state.metronomeBuffer && this.state.metronomeContext) return;

    try {
      // Create Web Audio API context
      this.state.metronomeContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create metronome click buffer
      const sampleRate = this.state.metronomeContext.sampleRate;
      const duration = 0.05; // 50ms click
      const length = sampleRate * duration;
      const buffer = this.state.metronomeContext.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);

      // Generate a sharp click sound
      for (let i = 0; i < length; i++) {
        const envelope = Math.exp(-i / (sampleRate * 0.01)); // Quick decay
        const frequency = 1200; // Sharp click frequency
        data[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * envelope * 0.8;
      }

      this.state.metronomeBuffer = buffer;
      console.log('[PunchLooper] Metronome initialized with Web Audio API');
      return;
      
    } catch (error) {
      console.warn('Failed to initialize Web Audio metronome, falling back to HTMLAudioElement:', error);
    }

    // Fallback to HTML Audio Element
    this.state.metronomeAudio = new Audio();
    this.state.metronomeAudio.volume = 0.5;
    
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
    if (!this.state.activeMedia || 
        (!this.state.metronomeAudio && !this.state.metronomeBuffer) ||
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
    // Try Web Audio API first
    if (this.state.metronomeContext && this.state.metronomeBuffer) {
      try {
        const source = this.state.metronomeContext.createBufferSource();
        const gainNode = this.state.metronomeContext.createGain();
        
        source.buffer = this.state.metronomeBuffer;
        gainNode.gain.value = isDownbeat ? 0.8 : 0.5; // Emphasize downbeat
        
        source.connect(gainNode);
        gainNode.connect(this.state.metronomeContext.destination);
        source.start(0);
        return;
      } catch (error) {
        console.warn('Web Audio metronome click failed:', error);
      }
    }
    
    // Fallback to HTML Audio
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

  private doubleLoopLength(): void {
    if (!this.state.activeMedia || this.state.pointA === null || this.state.pointB === null) {
      this.showHUD('No loop set', 700);
      return;
    }

    const currentLength = this.state.pointB - this.state.pointA;
    const newPointB = this.state.pointA + (currentLength * 2);
    const maxTime = this.state.activeMedia.duration || Number.MAX_SAFE_INTEGER;

    if (newPointB <= maxTime) {
      this.state.pointB = newPointB;
      const lengthStr = this.formatTime(newPointB - this.state.pointA);
      this.showHUD(`Loop 2x → ${lengthStr}`, 1000);
      this.updateGUILEDs();
    } else {
      this.showHUD('Cannot double - exceeds media length', 700);
    }
  }

  private halfLoopLength(): void {
    if (!this.state.activeMedia || this.state.pointA === null || this.state.pointB === null) {
      this.showHUD('No loop set', 700);
      return;
    }

    const currentLength = this.state.pointB - this.state.pointA;
    const minLoopLength = 0.1; // Minimum 100ms loop

    if (currentLength / 2 >= minLoopLength) {
      this.state.pointB = this.state.pointA + (currentLength / 2);
      const lengthStr = this.formatTime(this.state.pointB - this.state.pointA);
      this.showHUD(`Loop ½x → ${lengthStr}`, 1000);
      this.updateGUILEDs();
    } else {
      this.showHUD('Cannot halve - loop too short', 700);
    }
  }

  private quantizeLoop(): void {
    if (!this.state.activeMedia || this.state.pointA === null || this.state.pointB === null) {
      this.showHUD('No loop set', 700);
      return;
    }

    // Toggle quantize OFF if already quantized
    if (this.state.isQuantized) {
      // Restore original loop points
      if (this.state.originalPointA !== null && this.state.originalPointB !== null) {
        this.state.pointA = this.state.originalPointA;
        this.state.pointB = this.state.originalPointB;
        
        // Update active loop boundaries if currently looping
        if (this.state.loopA !== null && this.state.loopB !== null) {
          this.state.loopA = this.state.originalPointA;
          this.state.loopB = this.state.originalPointB;
        }
      }
      this.state.isQuantized = false;
      this.state.originalPointA = null;
      this.state.originalPointB = null;
      
      this.showHUD('Quantize OFF - Original loop restored', 1000);
      
      // Update button appearance
      const quantizeBtn = this.state.guiElement?.querySelector('#quantize-loop rect');
      if (quantizeBtn) {
        quantizeBtn.setAttribute('fill', '#0a4a0a'); // Dark green when off
      }
      this.updateGUILEDs();
      return;
    }

    // Save original points before quantizing
    this.state.originalPointA = this.state.pointA;
    this.state.originalPointB = this.state.pointB;

    // Simple 0.1 second grid snap - just clean up timing boundaries
    const gridSize = 0.1; // 100ms grid
    
    // Snap both points to clean 100ms boundaries
    const snappedPointA = Math.round(this.state.pointA / gridSize) * gridSize;
    const snappedPointB = Math.round(this.state.pointB / gridSize) * gridSize;
    
    // Ensure snapped points are valid
    const maxTime = this.state.activeMedia.duration || Number.MAX_SAFE_INTEGER;
    if (snappedPointB <= maxTime && snappedPointA >= 0 && snappedPointB > snappedPointA) {
      // Update the boundary points - no audio processing, no loop restart
      this.state.pointA = Math.max(0, snappedPointA);
      this.state.pointB = Math.min(maxTime, snappedPointB);
      this.state.isQuantized = true;
      
      this.showHUD('Quantized ON - Snapped to clean boundaries', 1200);
      
      // Update button appearance
      const quantizeBtn = this.state.guiElement?.querySelector('#quantize-loop rect');
      if (quantizeBtn) {
        quantizeBtn.setAttribute('fill', '#0f0'); // Bright green when on
      }
      this.updateGUILEDs();
    } else {
      // Restore original points if quantization fails
      this.state.originalPointA = null;
      this.state.originalPointB = null;
      this.showHUD('Cannot quantize - invalid boundaries', 700);
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

    // Theme picker section
    const themeOptions = Object.entries(themes).map(([id, theme]) => 
      `<option value="${id}" ${this.settings.theme === id ? 'selected' : ''}>${theme.name}</option>`
    ).join('');
    
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
        <h2 style="color: #ccc; margin: 0; font-size: 20px;">YT Looper Settings</h2>
        <button id="close-settings" style="
          background: none; 
          border: none; 
          color: #ccc; 
          font-size: 20px; 
          cursor: pointer; 
          padding: 4px 8px;
          border-radius: 4px;
          transition: background-color 0.2s, color 0.2s;
        " onmouseover="this.style.backgroundColor='#777'; this.style.color='white';" 
           onmouseout="this.style.backgroundColor='transparent'; this.style.color='#ccc';">&times;</button>
      </div>
      
      <!-- Theme Selection -->
      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500; color: #ccc;">Pedal Theme</label>
        <select id="theme-select" style="
          width: 100%;
          padding: 10px;
          background: #333;
          border: 1px solid #555;
          color: #fff;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
        ">
          ${themeOptions}
        </select>
        <div style="margin-top: 8px; font-size: 11px; color: #888;">
          Choose from classic pedal designs: Boss, Strymon, Empress, EHX, TC Ditto
        </div>
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
          <input type="checkbox" id="experimental-eq-enabled" ${this.settings.enableExperimentalEQ ? 'checked' : ''} 
                 style="transform: scale(1.2);">
          <span>Enable Experimental EQ</span>
        </label>
        <p style="color: #888; font-size: 12px; margin: 8px 0 0 28px; line-height: 1.4;">
          ⚠️ Web Audio API based 5-band equalizer. May cause audio processing issues or button conflicts.
        </p>
      </div>

      <div style="margin-bottom: 24px;">
        <h3 style="color: #ccc; margin: 0 0 16px 0; font-size: 16px;">5-Band EQ</h3>
        
        <div style="display: flex; justify-content: space-evenly; gap: 8px; padding: 0 4px;">
          <!-- Low Band (60Hz) -->
          <div style="display: flex; flex-direction: column; align-items: center; width: 60px;">
            <div style="color: #888; font-size: 9px; margin-bottom: 2px;">+12</div>
            <input type="range" id="eq-low-slider" min="-12" max="12" value="${this.settings.eq.low}" step="0.5"
                   orient="vertical" style="writing-mode: bt-lr; -webkit-appearance: slider-vertical; width: 16px; height: 100px; background: #333;">
            <div style="color: #888; font-size: 9px; margin-top: 2px;">-12</div>
            <div id="eq-low-value" style="color: #0f0; font-size: 10px; font-weight: bold; margin-top: 6px; min-height: 14px;">${this.settings.eq.low > 0 ? '+' : ''}${this.settings.eq.low}dB</div>
            <div style="color: #ccc; font-size: 10px; font-weight: bold; margin-top: 4px; text-align: center; line-height: 1.1;">LOW<br><span style="font-size: 8px; color: #888;">60Hz</span></div>
          </div>
          
          <!-- Low-Mid Band (250Hz) -->
          <div style="display: flex; flex-direction: column; align-items: center; width: 60px;">
            <div style="color: #888; font-size: 9px; margin-bottom: 2px;">+12</div>
            <input type="range" id="eq-lowmid-slider" min="-12" max="12" value="${this.settings.eq.lowMid}" step="0.5"
                   orient="vertical" style="writing-mode: bt-lr; -webkit-appearance: slider-vertical; width: 16px; height: 100px; background: #333;">
            <div style="color: #888; font-size: 9px; margin-top: 2px;">-12</div>
            <div id="eq-lowmid-value" style="color: #0f0; font-size: 10px; font-weight: bold; margin-top: 6px; min-height: 14px;">${this.settings.eq.lowMid > 0 ? '+' : ''}${this.settings.eq.lowMid}dB</div>
            <div style="color: #ccc; font-size: 10px; font-weight: bold; margin-top: 4px; text-align: center; line-height: 1.1;">L-MID<br><span style="font-size: 8px; color: #888;">250Hz</span></div>
          </div>
          
          <!-- Mid Band (1kHz) -->
          <div style="display: flex; flex-direction: column; align-items: center; width: 60px;">
            <div style="color: #888; font-size: 9px; margin-bottom: 2px;">+12</div>
            <input type="range" id="eq-mid-slider" min="-12" max="12" value="${this.settings.eq.mid}" step="0.5"
                   orient="vertical" style="writing-mode: bt-lr; -webkit-appearance: slider-vertical; width: 16px; height: 100px; background: #333;">
            <div style="color: #888; font-size: 9px; margin-top: 2px;">-12</div>
            <div id="eq-mid-value" style="color: #0f0; font-size: 10px; font-weight: bold; margin-top: 6px; min-height: 14px;">${this.settings.eq.mid > 0 ? '+' : ''}${this.settings.eq.mid}dB</div>
            <div style="color: #ccc; font-size: 10px; font-weight: bold; margin-top: 4px; text-align: center; line-height: 1.1;">MID<br><span style="font-size: 8px; color: #888;">1kHz</span></div>
          </div>
          
          <!-- High-Mid Band (4kHz) -->
          <div style="display: flex; flex-direction: column; align-items: center; width: 60px;">
            <div style="color: #888; font-size: 9px; margin-bottom: 2px;">+12</div>
            <input type="range" id="eq-highmid-slider" min="-12" max="12" value="${this.settings.eq.highMid}" step="0.5"
                   orient="vertical" style="writing-mode: bt-lr; -webkit-appearance: slider-vertical; width: 16px; height: 100px; background: #333;">
            <div style="color: #888; font-size: 9px; margin-top: 2px;">-12</div>
            <div id="eq-highmid-value" style="color: #0f0; font-size: 10px; font-weight: bold; margin-top: 6px; min-height: 14px;">${this.settings.eq.highMid > 0 ? '+' : ''}${this.settings.eq.highMid}dB</div>
            <div style="color: #ccc; font-size: 10px; font-weight: bold; margin-top: 4px; text-align: center; line-height: 1.1;">H-MID<br><span style="font-size: 8px; color: #888;">4kHz</span></div>
          </div>
          
          <!-- High Band (12kHz) -->
          <div style="display: flex; flex-direction: column; align-items: center; width: 60px;">
            <div style="color: #888; font-size: 9px; margin-bottom: 2px;">+12</div>
            <input type="range" id="eq-high-slider" min="-12" max="12" value="${this.settings.eq.high}" step="0.5"
                   orient="vertical" style="writing-mode: bt-lr; -webkit-appearance: slider-vertical; width: 16px; height: 100px; background: #333;">
            <div style="color: #888; font-size: 9px; margin-top: 2px;">-12</div>
            <div id="eq-high-value" style="color: #0f0; font-size: 10px; font-weight: bold; margin-top: 6px; min-height: 14px;">${this.settings.eq.high > 0 ? '+' : ''}${this.settings.eq.high}dB</div>
            <div style="color: #ccc; font-size: 10px; font-weight: bold; margin-top: 4px; text-align: center; line-height: 1.1;">HIGH<br><span style="font-size: 8px; color: #888;">12kHz</span></div>
          </div>
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <h3 style="color: #ccc; margin: 0 0 12px 0; font-size: 16px;">Pitch Control</h3>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <button id="pitch-down-modal" style="background: #444; color: #fff; border: 1px solid #666; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 14px;">▼ -1</button>
          <span style="color: #ccc; font-size: 14px; min-width: 100px; text-align: center;" id="pitch-display-modal">Original (0)</span>
          <button id="pitch-up-modal" style="background: #444; color: #fff; border: 1px solid #666; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 14px;">+1 ▲</button>
          <button id="pitch-reset-modal" style="background: #666; color: #fff; border: 1px solid #888; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Reset</button>
        </div>
        <p style="color: #888; font-size: 12px; margin: 0; line-height: 1.4;">
          Adjust pitch in semitone steps. Range: -6 to +6 semitones.
        </p>
      </div>

      <div style="margin-bottom: 16px;">
        <h3 style="color: #ccc; margin: 0 0 12px 0; font-size: 16px;">Metronome</h3>
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
        <h3 style="color: #ccc; margin: 0 0 12px 0; font-size: 16px;">Keyboard Shortcuts</h3>
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

      <!-- Support Section -->
      <div style="margin-top: 20px; padding: 16px; background: #1a1a1a; border-radius: 8px; border: 1px solid #333;">
        <h3 style="color: #fff; margin: 0 0 12px 0; font-size: 14px; display: flex; align-items: center; gap: 8px;">
          ❤️ Support YT Looper
        </h3>
        <p style="color: #ccc; font-size: 13px; margin: 0 0 12px 0; line-height: 1.4;">
          If you find YT Looper useful, consider supporting development to keep it free and add new features!
        </p>
        <a href="https://buy.stripe.com/00w9AT4q30dtby3aqtdIA04" target="_blank" rel="noopener" 
           style="display: inline-block; padding: 8px 16px; background: linear-gradient(45deg, #635bff, #ff6b6b); 
                  color: white; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: bold;
                  transition: opacity 0.2s;">
          💖 Donate via Stripe
        </a>
      </div>

      <div style="display: flex; gap: 12px; margin-top: 24px;">
        <button id="reset-settings" style="flex: 1; padding: 10px; background: #444; color: white; border: none; border-radius: 6px; cursor: pointer;">Reset Defaults</button>
        <button id="save-settings" style="flex: 1; padding: 10px; background: #666; color: white; border: none; border-radius: 6px; cursor: pointer;">Save</button>
      </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    
    // Theme selector handler
    const themeSelect = modal.querySelector('#theme-select') as HTMLSelectElement;
    if (themeSelect) {
      themeSelect.addEventListener('change', () => {
        this.settings.theme = themeSelect.value;
        this.currentTheme = getTheme(themeSelect.value);
        
        // Save theme preference
        chrome.storage.sync.set({ theme: themeSelect.value });
        
        // Recreate GUI with new theme
        if (this.state.guiElement) {
          const wasVisible = this.state.isGuiVisible;
          document.body.removeChild(this.state.guiElement);
          this.createGUI();
          if (wasVisible) {
            this.toggleGUI();
          }
        }
      });
    }

    // Add event listeners
    const latencySlider = modal.querySelector('#latency-slider') as HTMLInputElement;
    const latencyValue = modal.querySelector('#latency-value') as HTMLElement;
    const bleedSlider = modal.querySelector('#bleed-slider') as HTMLInputElement;
    const bleedValue = modal.querySelector('#bleed-value') as HTMLElement;
    const jogSlider = modal.querySelector('#jog-slider') as HTMLInputElement;
    const jogValue = modal.querySelector('#jog-value') as HTMLElement;
    const metronomeCheckbox = modal.querySelector('#metronome-enabled') as HTMLInputElement;
    const clicksSlider = modal.querySelector('#clicks-slider') as HTMLInputElement;
    const clicksValue = modal.querySelector('#clicks-value') as HTMLElement;
    const experimentalEQCheckbox = modal.querySelector('#experimental-eq-enabled') as HTMLInputElement;
    
    // Pitch control elements
    const pitchDownBtn = modal.querySelector('#pitch-down-modal') as HTMLButtonElement;
    const pitchUpBtn = modal.querySelector('#pitch-up-modal') as HTMLButtonElement;
    const pitchResetBtn = modal.querySelector('#pitch-reset-modal') as HTMLButtonElement;
    const pitchDisplayModal = modal.querySelector('#pitch-display-modal') as HTMLElement;
    
    // Update pitch display initially
    const updatePitchDisplay = () => {
      const interval = this.getCurrentInterval();
      const name = this.getCurrentIntervalName();
      pitchDisplayModal.textContent = `${name} (${this.state.currentPitchShift > 0 ? '+' : ''}${this.state.currentPitchShift})`;
    };
    updatePitchDisplay();
    
    // Pitch button event listeners
    pitchDownBtn.addEventListener('click', () => {
      this.adjustPitch(-1);
      updatePitchDisplay();
    });
    
    pitchUpBtn.addEventListener('click', () => {
      this.adjustPitch(1);
      updatePitchDisplay();
    });
    
    pitchResetBtn.addEventListener('click', () => {
      this.resetPlaybackSettings();
      updatePitchDisplay();
    });
    
    // EQ sliders
    const eqLowSlider = modal.querySelector('#eq-low-slider') as HTMLInputElement;
    const eqLowValue = modal.querySelector('#eq-low-value') as HTMLElement;
    const eqLowMidSlider = modal.querySelector('#eq-lowmid-slider') as HTMLInputElement;
    const eqLowMidValue = modal.querySelector('#eq-lowmid-value') as HTMLElement;
    const eqMidSlider = modal.querySelector('#eq-mid-slider') as HTMLInputElement;
    const eqMidValue = modal.querySelector('#eq-mid-value') as HTMLElement;
    const eqHighMidSlider = modal.querySelector('#eq-highmid-slider') as HTMLInputElement;
    const eqHighMidValue = modal.querySelector('#eq-highmid-value') as HTMLElement;
    const eqHighSlider = modal.querySelector('#eq-high-slider') as HTMLInputElement;
    const eqHighValue = modal.querySelector('#eq-high-value') as HTMLElement;

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

    // EQ slider event handlers
    eqLowSlider?.addEventListener('input', () => {
      const value = parseFloat(eqLowSlider.value);
      eqLowValue.textContent = `${value > 0 ? '+' : ''}${value}dB`;
      this.updateEQ();
    });
    
    eqLowMidSlider?.addEventListener('input', () => {
      const value = parseFloat(eqLowMidSlider.value);
      eqLowMidValue.textContent = `${value > 0 ? '+' : ''}${value}dB`;
      this.updateEQ();
    });
    
    eqMidSlider?.addEventListener('input', () => {
      const value = parseFloat(eqMidSlider.value);
      eqMidValue.textContent = `${value > 0 ? '+' : ''}${value}dB`;
      this.updateEQ();
    });
    
    eqHighMidSlider?.addEventListener('input', () => {
      const value = parseFloat(eqHighMidSlider.value);
      eqHighMidValue.textContent = `${value > 0 ? '+' : ''}${value}dB`;
      this.updateEQ();
    });
    
    eqHighSlider?.addEventListener('input', () => {
      const value = parseFloat(eqHighSlider.value);
      eqHighValue.textContent = `${value > 0 ? '+' : ''}${value}dB`;
      this.updateEQ();
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
      metronomeCheckbox.checked = false;
      clicksSlider.value = '4';
      experimentalEQCheckbox.checked = false;
      
      // Reset EQ sliders
      eqLowSlider.value = '0';
      eqLowMidSlider.value = '0';
      eqMidSlider.value = '0';
      eqHighMidSlider.value = '0';
      eqHighSlider.value = '0';
      
      latencyValue.innerHTML = '0ms';
      latencyValue.style.color = '#fff';
      bleedValue.textContent = '100ms';
      jogValue.textContent = '10ms';
      clicksValue.textContent = '4';
      
      // Reset EQ value displays
      eqLowValue.textContent = '0dB';
      eqLowMidValue.textContent = '0dB';
      eqMidValue.textContent = '0dB';
      eqHighMidValue.textContent = '0dB';
      eqHighValue.textContent = '0dB';
    });

    // Save settings
    modal.querySelector('#save-settings')?.addEventListener('click', async () => {
      this.settings.latencyCompensation = parseInt(latencySlider.value);
      this.settings.edgeBleed = parseInt(bleedSlider.value);
      this.settings.jogAdjustmentMs = parseInt(jogSlider.value);
      this.settings.metronomeEnabled = metronomeCheckbox.checked;
      this.settings.clicksPerLoop = parseInt(clicksSlider.value);
      this.settings.enableExperimentalEQ = experimentalEQCheckbox.checked;
      
      // Save EQ settings
      this.settings.eq = {
        low: parseFloat(eqLowSlider.value),
        lowMid: parseFloat(eqLowMidSlider.value),
        mid: parseFloat(eqMidSlider.value),
        highMid: parseFloat(eqHighMidSlider.value),
        high: parseFloat(eqHighSlider.value)
      };

      try {
        await chrome.storage.sync.set({
          latencyCompensation: this.settings.latencyCompensation,
          edgeBleed: this.settings.edgeBleed,
          jogAdjustmentMs: this.settings.jogAdjustmentMs,
          metronomeEnabled: this.settings.metronomeEnabled,
          clicksPerLoop: this.settings.clicksPerLoop,
          enableExperimentalEQ: this.settings.enableExperimentalEQ,
          eq: this.settings.eq
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
    // Pitch controls are now always visible - no longer experimental
    // This method kept for compatibility but does nothing
  }

  private hideHUD(): void {
    if (!this.state.hudElement) return;

    const container = document.getElementById('punch-looper-hud-container');
    if (container) {
      container.style.opacity = '0';
      setTimeout(() => {
        if (container && container.parentNode) {
          container.parentNode.removeChild(container);
        }
        this.state.hudElement = null;
      }, 300);
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
    
    // Initialize displays
    this.updatePitchDisplay();
    
    // Update pitch controls visibility based on settings
    this.updatePitchControlsVisibility();
  }

  private createPedalSVG(): string {
    const theme = this.currentTheme;
    
    // Parse gradient colors from theme if it's a gradient
    let bodyGradientStops = '';
    if (theme.body.background.includes('gradient')) {
      // Extract colors from gradient string for Boss RC-1: #ff3333, #dd2222, #aa1111
      if (theme.name === 'Boss RC-1') {
        bodyGradientStops = `
            <stop offset="0%" style="stop-color:#ff3333"/>
            <stop offset="50%" style="stop-color:#dd2222"/>
            <stop offset="100%" style="stop-color:#aa1111"/>`;
      } else if (theme.name === 'Strymon Timeline') {
        bodyGradientStops = `
            <stop offset="0%" style="stop-color:#4a6fa5"/>
            <stop offset="50%" style="stop-color:#3a5f95"/>
            <stop offset="100%" style="stop-color:#2a4f85"/>`;
      } else if (theme.name === 'Empress Echosystem') {
        bodyGradientStops = `
            <stop offset="0%" style="stop-color:#1a3a2e"/>
            <stop offset="50%" style="stop-color:#0f2818"/>
            <stop offset="100%" style="stop-color:#061408"/>`;
      } else if (theme.name === 'TC Ditto') {
        bodyGradientStops = `
            <stop offset="0%" style="stop-color:#663399"/>
            <stop offset="50%" style="stop-color:#552288"/>
            <stop offset="100%" style="stop-color:#441177"/>`;
      } else if (theme.name === 'EHX Style') {
        bodyGradientStops = `
            <stop offset="0%" style="stop-color:#c0c0c0"/>
            <stop offset="50%" style="stop-color:#a0a0a0"/>
            <stop offset="100%" style="stop-color:#808080"/>`;
      } else {
        // Default red for unknown themes
        bodyGradientStops = `
            <stop offset="0%" style="stop-color:#ff3333"/>
            <stop offset="50%" style="stop-color:#dd2222"/>
            <stop offset="100%" style="stop-color:#aa1111"/>`;
      }
    } else {
      // Solid color
      bodyGradientStops = `
            <stop offset="0%" style="stop-color:${theme.body.background}"/>
            <stop offset="100%" style="stop-color:${theme.body.background}"/>`;
    }
    
    return `
      
      <svg viewBox="0 0 190 300" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; filter: drop-shadow(${theme.effects?.shadow || '0 12px 24px rgba(0,0,0,0.4)'});">
        <!-- ${theme.brand} ${theme.model} Style -->
        <defs>
          <!-- Dynamic body gradient based on theme -->
          <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">${bodyGradientStops}
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
        
        <!-- Main pedal body with theme colors -->
        <rect x="10" y="0" width="170" height="280" rx="${theme.body.borderRadius}" ry="${theme.body.borderRadius}" 
              fill="${theme.body.background.includes('gradient') ? 'url(#bodyGradient)' : theme.body.background}" 
              stroke="${theme.body.stroke}" stroke-width="${theme.body.strokeWidth}"/>
        
        <!-- Top control area integrated into pedal -->
        <rect x="20" y="10" width="150" height="20" rx="4" ry="4" 
              fill="${theme.controlPanel.background}" 
              stroke="${theme.controlPanel.stroke}" stroke-width="${theme.controlPanel.strokeWidth}"/>
        
        <!-- Hamburger menu (left) -->
        <g id="hamburger-menu" style="cursor: pointer;" class="hamburger-menu">
          <rect x="25" y="13" width="12" height="2" fill="#ccc"/>
          <rect x="25" y="16" width="12" height="2" fill="#ccc"/>
          <rect x="25" y="19" width="12" height="2" fill="#ccc"/>
          <text x="31" y="28" text-anchor="middle" fill="#888" font-size="6" font-family="Arial, sans-serif">MENU</text>
        </g>
        
        <!-- Close button (right) -->
        <g id="close-button" style="cursor: pointer;" class="close-button">
          <circle cx="165" cy="18" r="6" fill="#444" stroke="#666" stroke-width="1"/>
          <text x="165" y="21" text-anchor="middle" fill="#ccc" font-size="12" font-weight="bold" font-family="Arial, sans-serif">×</text>
        </g>
              
        <!-- Main branding section -->
        <rect x="20" y="35" width="150" height="40" rx="4" ry="4" 
              fill="#111" 
              stroke="#333" stroke-width="1"/>
        
        <!-- Digital display inside black box - reorganized layout -->
        <rect x="25" y="40" width="140" height="30" rx="2" ry="2" fill="${theme.display.background}" stroke="${theme.display.stroke}" stroke-width="${theme.display.strokeWidth}"/>
        
        <!-- A/B times stacked on left side -->
        <text id="a-time-display" x="35" y="50" text-anchor="start" fill="${theme.display.textColor}" font-size="9" font-family="${theme.display.fontFamily}" font-weight="bold">A:--:--</text>
        <text id="b-time-display" x="35" y="62" text-anchor="start" fill="${theme.display.textColor}" font-size="9" font-family="${theme.display.fontFamily}" font-weight="bold">B:--:--</text>
        
        <!-- Parameter info on far right -->
        <text id="param-display" x="155" y="56" text-anchor="end" fill="${theme.display.textColorDim}" font-size="8" font-family="${theme.display.fontFamily}">READY</text>
        
        
        <!-- Status LEDs horizontally below knobs - optimized spacing -->
        <circle cx="30" cy="140" r="4" fill="${this.state.pointA ? 'url(#greenLED)' : '#002200'}" class="led-a" stroke="#333" stroke-width="1"/>
        <text x="30" y="152" text-anchor="middle" fill="${theme.leds.labelColor}" font-size="8" font-weight="bold" font-family="${theme.text.labelFont}">A</text>
        
        <circle cx="55" cy="140" r="4" fill="${this.state.pointB ? 'url(#greenLED)' : '#002200'}" class="led-b" stroke="#333" stroke-width="1"/>
        <text x="55" y="152" text-anchor="middle" fill="#fff" font-size="8" font-weight="bold" font-family="Arial, sans-serif">B</text>
        
        <circle cx="80" cy="140" r="5" fill="${this.state.isLooping ? 'url(#amberLED)' : '#331100'}" class="led-loop" stroke="#333" stroke-width="1"/>
        <text x="80" y="152" text-anchor="middle" fill="#fff" font-size="8" font-weight="bold" font-family="Arial, sans-serif">LOOP</text>
        
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


        <!-- Row 2: A POINT Controls (y=115 baseline) -->
        <text x="145" y="110" text-anchor="middle" fill="#fff" font-size="7" font-weight="bold" font-family="Arial, sans-serif">A POINT</text>
        <g id="point-a-back" class="control-button" data-action="a-back" style="cursor: pointer;">
          <rect x="125" y="115" width="20" height="16" rx="3" fill="#444" stroke="#666" stroke-width="1"/>
          <text x="135" y="125" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold" font-family="Arial, sans-serif">◀</text>
        </g>
        <g id="point-a-forward" class="control-button" data-action="a-forward" style="cursor: pointer;">
          <rect x="155" y="115" width="20" height="16" rx="3" fill="#444" stroke="#666" stroke-width="1"/>
          <text x="165" y="125" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold" font-family="Arial, sans-serif">▶</text>
        </g>
        
        <!-- Row 3: B POINT Controls (y=145 baseline) -->
        <text x="145" y="140" text-anchor="middle" fill="#fff" font-size="7" font-weight="bold" font-family="Arial, sans-serif">B POINT</text>
        <g id="point-b-back" class="control-button" data-action="b-back" style="cursor: pointer;">
          <rect x="125" y="145" width="20" height="16" rx="3" fill="#444" stroke="#666" stroke-width="1"/>
          <text x="135" y="155" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold" font-family="Arial, sans-serif">◀</text>
        </g>
        <g id="point-b-forward" class="control-button" data-action="b-forward" style="cursor: pointer;">
          <rect x="155" y="145" width="20" height="16" rx="3" fill="#444" stroke="#666" stroke-width="1"/>
          <text x="165" y="155" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold" font-family="Arial, sans-serif">▶</text>
        </g>
        
        <!-- Reset button (above and between knobs) -->
        <g id="reset-button" style="cursor: pointer;" class="reset-button">
          <circle cx="60" cy="85" r="6" fill="#333" stroke="#666" stroke-width="1"/>
          <text x="60" y="89" text-anchor="middle" fill="#ccc" font-size="8" font-weight="bold" font-family="Arial, sans-serif">R</text>
          <text x="60" y="97" text-anchor="middle" fill="#888" font-size="6" font-family="Arial, sans-serif">RST</text>
        </g>
        
        
        <!-- Loop manipulation buttons - new modern controls -->
        
        <!-- Half loop button -->
        <!-- LEFT SIDE: LOOP Controls - Unified Professional Design -->
        <text x="60" y="160" text-anchor="middle" fill="#fff" font-size="8" font-weight="bold" font-family="Arial, sans-serif">LOOP</text>
        
        <!-- Half Loop Button (moved up 5px) -->
        <g id="half-loop" class="loop-button" data-action="half-loop" style="cursor: pointer;">
          <rect x="15" y="170" width="22" height="18" rx="3" fill="#444" stroke="#666" stroke-width="1"/>
          <text x="26" y="181" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold" font-family="Arial, sans-serif">½×</text>
        </g>
        
        <!-- Double Loop Button (moved up 5px) -->
        <g id="double-loop" class="loop-button" data-action="double-loop" style="cursor: pointer;">
          <rect x="43" y="170" width="22" height="18" rx="3" fill="#444" stroke="#666" stroke-width="1"/>
          <text x="54" y="181" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold" font-family="Arial, sans-serif">2×</text>
        </g>
        
        <!-- Quantize Button (moved up 5px) -->
        <g id="quantize-loop" class="loop-button" data-action="quantize-loop" style="cursor: pointer;">
          <rect x="71" y="170" width="32" height="18" rx="3" fill="#0a4a0a" stroke="#0f0" stroke-width="1"/>
          <text x="87" y="181" text-anchor="middle" fill="#0f0" font-size="10" font-weight="bold" font-family="Arial, sans-serif">QNTZ</text>
        </g>
        
        <!-- Tap Tempo button - small round button same level as RESET -->
        <g id="tap-tempo" class="tap-button" style="cursor: pointer;" data-action="tap-tempo">
          <circle cx="100" cy="85" r="6" fill="#444" stroke="#666" stroke-width="1"/>
          <text x="100" y="89" text-anchor="middle" fill="#ff0" font-size="7" font-weight="bold" font-family="Arial, sans-serif">T</text>
          <text x="100" y="97" text-anchor="middle" fill="#888" font-size="5" font-family="Arial, sans-serif">TAP</text>
        </g>
        
        <!-- BPM Display - below TAP button -->
        <text id="bpm-display" x="100" y="105" text-anchor="middle" fill="#888" font-size="6" font-family="${theme.display.fontFamily}">---BPM</text>
        
        <!-- RIGHT COLUMN: UNIFIED BUTTON GRID - Compact Professional Layout -->
        
        <!-- SHIFT Controls (moved up to align with loop buttons at y=170) -->
        <text x="145" y="165" text-anchor="middle" fill="#fff" font-size="7" font-weight="bold" font-family="Arial, sans-serif">SHIFT</text>
        <g id="section-back" class="control-button" data-action="section-back" style="cursor: pointer;">
          <rect x="125" y="170" width="20" height="16" rx="3" fill="#444" stroke="#666" stroke-width="1"/>
          <text x="135" y="180" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold" font-family="Arial, sans-serif">◀</text>
        </g>
        <g id="section-forward" class="control-button" data-action="section-forward" style="cursor: pointer;">
          <rect x="155" y="170" width="20" height="16" rx="3" fill="#444" stroke="#666" stroke-width="1"/>
          <text x="165" y="180" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold" font-family="Arial, sans-serif">▶</text>
        </g>
        
        <!-- Main Footswitch - Professional Full-Width Design -->
        <g id="footswitch" style="cursor: pointer;" class="footswitch">
          <rect x="20" y="200" width="150" height="60" rx="4" ry="4" fill="#000" stroke="#333" stroke-width="2"/>
          <rect x="25" y="205" width="140" height="50" rx="2" ry="2" fill="#111" stroke="#222" stroke-width="1"/>
          <rect x="30" y="210" width="130" height="40" rx="2" ry="2" fill="#222"/>
          <text x="95" y="228" text-anchor="middle" fill="#ccc" font-size="11" font-weight="bold" font-family="Arial, sans-serif">REC</text>
          <text x="95" y="242" text-anchor="middle" fill="#ccc" font-size="11" font-weight="bold" font-family="Arial, sans-serif">PLAY</text>
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

    // All control buttons (pitch, A/B points, section shift) - unified handler
    const controlButtons = gui.querySelectorAll('.control-button');
    console.log(`Found ${controlButtons.length} control buttons`);
    controlButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const action = (button as SVGElement).getAttribute('data-action');
        console.log(`Control button clicked: ${action}`);
        
        if (!action) {
          console.log('No action found on button');
          return;
        }
        
        // A/B point jog controls
        if (action === 'a-back' || action === 'a-forward' || 
                 action === 'b-back' || action === 'b-forward') {
          console.log(`Executing jog: ${action}`);
          this.showHUD(`Jog: ${action}`, 500);
          this.handleJogButton(action);
        }
        // Section shift controls
        else if (action === 'section-forward') {
          console.log('Executing section-forward');
          this.showHUD('Section →', 500);
          this.shiftLoopSection(1);
        } else if (action === 'section-back') {
          console.log('Executing section-back');
          this.showHUD('Section ←', 500);
          this.shiftLoopSection(-1);
        }
      });
    });

    // Loop manipulation buttons (half, double, quantize)
    const loopButtons = gui.querySelectorAll('.loop-button');
    loopButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const action = (button as SVGElement).getAttribute('data-action');
        if (action === 'half-loop') {
          this.halfLoopLength();
        } else if (action === 'double-loop') {
          this.doubleLoopLength();
        } else if (action === 'quantize-loop') {
          this.quantizeLoop();
          // Animate quantize button after successful quantization
          setTimeout(() => this.animateButton(button as SVGElement, '#0a0'), 10);
        }
      });
    });
    
    // Tap tempo button
    const tapButton = gui.querySelector('#tap-tempo');
    if (tapButton) {
      tapButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleTapTempo();
      });
    }


    // Global mouse events for knob dragging - store references for proper cleanup
    this.state.knobDragHandler = (e: MouseEvent) => this.handleKnobDrag(e);
    this.state.knobMouseUpHandler = () => this.endKnobDrag();
    
    document.addEventListener('mousemove', this.state.knobDragHandler);
    document.addEventListener('mouseup', this.state.knobMouseUpHandler);

    // Hamburger menu event listener (integrated)
    const hamburgerMenu = gui.querySelector('#hamburger-menu');
    if (hamburgerMenu) {
      hamburgerMenu.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showSettingsModal();
      });
    }

    // Close button event listener - completely destroy extension
    const closeButton = gui.querySelector('#close-button');
    if (closeButton) {
      closeButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Completely destroy the extension when X is clicked
        this.destroy();
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
      if ((e.target as Element).closest('.knob-group, #footswitch, .control-button, .loop-button, .tap-button, #reset-button, #hamburger-menu, #close-button')) return;
      
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
      // Don't change cursor on GUI element itself
      
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
      // Clean up any cursor states
      document.body.style.cursor = '';
      // Reset any dragging states
      this.state.isDraggingKnob = null;
      // Clean up any knob cursors
      const knobs = this.state.guiElement.querySelectorAll('.knob');
      knobs.forEach(k => {
        (k as HTMLElement).style.cursor = 'pointer';
      });
      this.showHUD('Guitar pedal GUI hidden', 700);
    }
  }

  private handleFootswitchClick(): void {
    if (!this.state.activeMedia) {
      this.showHUD('No media found', 1000);
      return;
    }

    // Auto-disable quantize when footswitch is pressed
    if (this.state.isQuantized) {
      // Restore original loop points before footswitch action
      if (this.state.originalPointA !== null && this.state.originalPointB !== null) {
        this.state.pointA = this.state.originalPointA;
        this.state.pointB = this.state.originalPointB;
        
        // Update active loop boundaries if currently looping
        if (this.state.loopA !== null && this.state.loopB !== null) {
          this.state.loopA = this.state.originalPointA;
          this.state.loopB = this.state.originalPointB;
        }
      }
      this.state.isQuantized = false;
      this.state.originalPointA = null;
      this.state.originalPointB = null;
      
      // Update button appearance
      const quantizeBtn = this.state.guiElement?.querySelector('#quantize-loop rect');
      if (quantizeBtn) {
        quantizeBtn.setAttribute('fill', '#0a4a0a'); // Dark green when off
      }
      
      this.showHUD('Quantize OFF - Auto-disabled by footswitch', 1000);
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
    
    const theme = this.currentTheme;
    
    // Update LED colors based on theme
    const ledA = this.state.guiElement.querySelector('.led-a') as SVGCircleElement;
    const ledB = this.state.guiElement.querySelector('.led-b') as SVGCircleElement;
    const ledLoop = this.state.guiElement.querySelector('.led-loop') as SVGCircleElement;

    if (ledA) ledA.setAttribute('fill', this.state.pointA ? theme.leds.on.a : theme.leds.off.a);
    if (ledB) ledB.setAttribute('fill', this.state.pointB ? theme.leds.on.b : theme.leds.off.b);
    if (ledLoop) ledLoop.setAttribute('fill', this.state.isLooping ? theme.leds.on.loop : theme.leds.off.loop);
    
    // Update display text
    this.updateDisplayText();
  }
  
  private updateDisplayText(): void {
    if (!this.state.guiElement || !this.state.activeMedia) return;
    
    const aPoint = this.state.pointA ? this.formatTimeShort(this.state.pointA) : '--:--.--';
    const bPoint = this.state.pointB ? this.formatTimeShort(this.state.pointB) : '--:--.--';
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
    const hundredths = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
  }

  private startKnobDrag(e: MouseEvent, knob: SVGElement): void {
    e.preventDefault();
    e.stopPropagation();
    
    const param = knob.getAttribute('data-param');
    if (!param) return;
    
    this.state.isDraggingKnob = param;
    // Don't modify body cursor - only change cursor on the knob itself
    if (knob) {
      (knob as HTMLElement).style.cursor = 'grabbing';
    }
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
    // Reset cursor on all knobs
    if (this.state.guiElement) {
      const knobs = this.state.guiElement.querySelectorAll('.knob');
      knobs.forEach(k => {
        (k as HTMLElement).style.cursor = 'pointer';
      });
    }
    this.state.isDraggingKnob = null;
    // Clean up any body cursor changes that might have been applied
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
    const secs = Math.floor(seconds % 60);
    const hundredths = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
  }

  private formatTimeWithMs(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const hundredths = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
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
    
    // Set up EQ processing (only if experimental EQ is enabled)
    if (this.settings.enableExperimentalEQ) {
      this.setupEQ(this.state.activeMedia);
    }
    
    this.showHUD('Audio controls and EQ initialized', 800);
    console.log('[PunchLooper] Native audio controls and EQ initialized');
  }

  private cleanupAudioProcessing(): void {
    // Clean up EQ connections
    this.cleanupEQ();
    
    // Reset media element to defaults when switching
    if (this.state.activeMedia) {
      this.state.activeMedia.playbackRate = 1.0;
      this.state.activeMedia.preservesPitch = true;
      console.log('[PunchLooper] Audio settings reset to defaults');
    }
    
    // Disconnect beat detector
    if (this.beatDetector) {
      this.beatDetector.disconnect();
    }
  }
  
  private handleTapTempo(): void {
    this.showHUD('Tap!', 300);
    
    const bpm = this.beatDetector.tap();
    
    if (bpm > 0) {
      // Update BPM display
      const bpmDisplay = this.state.guiElement?.querySelector('#bpm-display');
      if (bpmDisplay) {
        bpmDisplay.textContent = `${Math.round(bpm)}BPM`;
      }
      
      // Flash the tap button circle (not rect)
      const tapButton = this.state.guiElement?.querySelector('#tap-tempo circle');
      if (tapButton) {
        tapButton.setAttribute('fill', '#666');
        setTimeout(() => {
          tapButton.setAttribute('fill', '#444');
        }, 100);
      }
      
      if (bpm > 40 && bpm < 200) {
        this.showHUD(`Tap Tempo: ${Math.round(bpm)} BPM`, 500);
      }
    } else {
      this.showHUD('Keep tapping to set tempo...', 800);
    }
  }

  // EQ Setup and Processing Methods
  private setupEQ(mediaElement: HTMLMediaElement): void {
    try {
      // Create or reuse AudioContext
      if (!this.state.audioContext) {
        this.state.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      // Clean up existing connections
      this.cleanupEQ();
      
      // Create source node from media element
      this.state.sourceNode = this.state.audioContext.createMediaElementSource(mediaElement);
      
      // Create 5-band EQ filters
      this.state.eqFilters.low = this.state.audioContext.createBiquadFilter();
      this.state.eqFilters.lowMid = this.state.audioContext.createBiquadFilter();
      this.state.eqFilters.mid = this.state.audioContext.createBiquadFilter();
      this.state.eqFilters.highMid = this.state.audioContext.createBiquadFilter();
      this.state.eqFilters.high = this.state.audioContext.createBiquadFilter();
      
      // Configure filter types and frequencies
      // Low (60Hz) - Low shelf
      this.state.eqFilters.low.type = 'lowshelf';
      this.state.eqFilters.low.frequency.setValueAtTime(60, this.state.audioContext.currentTime);
      
      // Low-Mid (250Hz) - Peaking
      this.state.eqFilters.lowMid.type = 'peaking';
      this.state.eqFilters.lowMid.frequency.setValueAtTime(250, this.state.audioContext.currentTime);
      this.state.eqFilters.lowMid.Q.setValueAtTime(1, this.state.audioContext.currentTime);
      
      // Mid (1kHz) - Peaking
      this.state.eqFilters.mid.type = 'peaking';
      this.state.eqFilters.mid.frequency.setValueAtTime(1000, this.state.audioContext.currentTime);
      this.state.eqFilters.mid.Q.setValueAtTime(1, this.state.audioContext.currentTime);
      
      // High-Mid (4kHz) - Peaking
      this.state.eqFilters.highMid.type = 'peaking';
      this.state.eqFilters.highMid.frequency.setValueAtTime(4000, this.state.audioContext.currentTime);
      this.state.eqFilters.highMid.Q.setValueAtTime(1, this.state.audioContext.currentTime);
      
      // High (12kHz) - High shelf
      this.state.eqFilters.high.type = 'highshelf';
      this.state.eqFilters.high.frequency.setValueAtTime(12000, this.state.audioContext.currentTime);
      
      // Connect the audio chain: source -> low -> lowMid -> mid -> highMid -> high -> destination
      this.state.sourceNode.connect(this.state.eqFilters.low);
      this.state.eqFilters.low.connect(this.state.eqFilters.lowMid);
      this.state.eqFilters.lowMid.connect(this.state.eqFilters.mid);
      this.state.eqFilters.mid.connect(this.state.eqFilters.highMid);
      this.state.eqFilters.highMid.connect(this.state.eqFilters.high);
      this.state.eqFilters.high.connect(this.state.audioContext.destination);
      
      // Apply current EQ settings
      this.updateEQ();
      
    } catch (error) {
      console.error('Failed to setup EQ:', error);
    }
  }
  
  private updateEQ(): void {
    if (!this.state.audioContext || !this.state.eqFilters.low) return;
    
    const currentTime = this.state.audioContext.currentTime;
    
    try {
      // Apply EQ settings with smooth transitions
      this.state.eqFilters.low.gain.setValueAtTime(this.settings.eq.low, currentTime);
      this.state.eqFilters.lowMid.gain.setValueAtTime(this.settings.eq.lowMid, currentTime);
      this.state.eqFilters.mid.gain.setValueAtTime(this.settings.eq.mid, currentTime);
      this.state.eqFilters.highMid.gain.setValueAtTime(this.settings.eq.highMid, currentTime);
      this.state.eqFilters.high.gain.setValueAtTime(this.settings.eq.high, currentTime);
    } catch (error) {
      console.error('Failed to update EQ:', error);
    }
  }
  
  private cleanupEQ(): void {
    if (this.state.sourceNode) {
      try {
        this.state.sourceNode.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      this.state.sourceNode = null;
    }
    
    // Clean up EQ filter nodes
    Object.values(this.state.eqFilters).forEach(filter => {
      if (filter) {
        try {
          filter.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
      }
    });
    
    this.state.eqFilters = {
      low: null,
      lowMid: null,
      mid: null,
      highMid: null,
      high: null
    };
  }

  public destroy(): void {
    // Stop all active processes
    this.stopLoop();
    this.cleanupAudioProcessing();
    
    // Clean up any cursor changes
    document.body.style.cursor = '';
    document.body.style.removeProperty('cursor');
    
    // Reset all dragging states
    this.state.isDraggingKnob = null;
    
    // Disconnect observers
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    // Remove ALL DOM elements created by this extension
    // Remove HUD container
    const hudContainer = document.getElementById('punch-looper-hud-container');
    if (hudContainer) {
      hudContainer.remove();
    }
    
    // Remove GUI element
    const guiElement = document.getElementById('punch-looper-gui');
    if (guiElement) {
      guiElement.remove();
    }
    
    // Remove settings modal if it exists
    const settingsBackdrop = document.getElementById('punch-looper-settings-backdrop');
    if (settingsBackdrop) {
      settingsBackdrop.remove();
    }
    
    // Remove any other elements we may have created
    const allOurElements = document.querySelectorAll('[id^="punch-looper"]');
    allOurElements.forEach(element => element.remove());

    // Clear state references
    if (this.state.hudElement) {
      this.state.hudElement.remove();
      this.state.hudElement = null;
    }

    if (this.state.guiElement) {
      this.state.guiElement.remove();
      this.state.guiElement = null;
    }

    // Clear all timeouts
    if (this.state.hudTimeout) {
      clearTimeout(this.state.hudTimeout);
      this.state.hudTimeout = null;
    }

    // Remove all event listeners
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    document.removeEventListener('keyup', this.handleKeyUp.bind(this));
    
    // Remove global knob drag listeners that were causing persistent cursor artifacts
    if (this.state.knobDragHandler) {
      document.removeEventListener('mousemove', this.state.knobDragHandler);
      this.state.knobDragHandler = null;
    }
    if (this.state.knobMouseUpHandler) {
      document.removeEventListener('mouseup', this.state.knobMouseUpHandler);
      this.state.knobMouseUpHandler = null;
    }
    
    // Clear all state references
    this.state.activeMedia = null;
    this.state.isLooping = false;
    this.state.pointA = null;
    this.state.pointB = null;
    
    // Mark instance as destroyed
    (this as any).destroyed = true;
    
    console.log('[PunchLooper] Extension completely destroyed and cleaned up');
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

// Cleanup on page unload or tab close
window.addEventListener('beforeunload', () => {
  if (looper) {
    looper.destroy();
    looper = null;
  }
});

// Also cleanup on visibility change (tab switching)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && looper) {
    // Clean up cursor states when tab is hidden
    document.body.style.cursor = '';
  }
});

// Cleanup on page hide (mobile/some browsers)
window.addEventListener('pagehide', () => {
  if (looper) {
    looper.destroy();
    looper = null;
  }
});

// Additional cleanup for extension being disabled/uninstalled
// Note: Commenting out runtime.connect as it was causing immediate crashes
// The destroy() method and event listeners should be sufficient for cleanup

// Periodic cleanup check (safety net)
const cleanupInterval = setInterval(() => {
  // Check if extension context is still valid
  try {
    chrome.runtime.getURL(''); // This will throw if extension is invalid
  } catch (error) {
    console.log('[PunchLooper] Extension context invalid, performing cleanup');
    if (looper) {
      looper.destroy();
      looper = null;
    }
    
    // Emergency cleanup
    const allOurElements = document.querySelectorAll('[id^="punch-looper"]');
    allOurElements.forEach(element => element.remove());
    
    clearInterval(cleanupInterval);
  }
}, 30000); // Check every 30 seconds