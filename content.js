// YouTube Looper with Pitch-Preserving Audio using SoundTouch
// MV3 Chrome Extension Content Script

(function() {
    'use strict';

    // State management
    const state = {
        soundTouchInjected: false,
        audioContext: null,
        sourceNode: null,
        soundTouchNode: null,
        video: null,
        isProcessing: false,
        currentSpeed: 1.0,
        currentPitchSemitones: 0,
        loopA: null,
        loopB: null,
        isLooping: false,
        loopAnimationFrame: null
    };

    // Helper functions
    function clamp(n, min, max) {
        return Math.min(Math.max(n, min), max);
    }

    function semisFromRate(rate) {
        return 12 * Math.log2(rate);
    }

    // Inject SoundTouch library into page context (MV3 requirement)
    async function injectSoundTouch() {
        if (state.soundTouchInjected) return true;

        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('lib/soundtouch.min.js');
            script.onload = () => {
                state.soundTouchInjected = true;
                console.log('[YT Looper] SoundTouch library injected successfully');
                resolve(true);
            };
            script.onerror = () => {
                console.warn('[YT Looper] Failed to inject SoundTouch library, falling back to native audio');
                resolve(false);
            };
            (document.head || document.documentElement).appendChild(script);
        });
    }

    // Initialize Web Audio API context
    async function initAudioContext() {
        if (state.audioContext) return state.audioContext;

        try {
            state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Resume on user gesture if suspended
            if (state.audioContext.state === 'suspended') {
                document.addEventListener('click', async () => {
                    if (state.audioContext && state.audioContext.state === 'suspended') {
                        await state.audioContext.resume();
                        console.log('[YT Looper] AudioContext resumed');
                    }
                }, { once: true });
            }

            console.log('[YT Looper] AudioContext initialized');
            return state.audioContext;
        } catch (error) {
            console.error('[YT Looper] Failed to initialize AudioContext:', error);
            return null;
        }
    }

    // Create SoundTouch processing node
    function createSoundTouchNode(audioContext) {
        if (!window.soundtouch) {
            console.warn('[YT Looper] SoundTouch not available in page context');
            return null;
        }

        const bufferSize = 4096;
        const channelCount = 2;

        // Create ScriptProcessor for SoundTouch processing
        const processor = audioContext.createScriptProcessor(bufferSize, channelCount, channelCount);
        
        // Initialize SoundTouch
        const soundTouch = new window.soundtouch.SoundTouch(audioContext.sampleRate);
        soundTouch.tempo = 1.0; // Always 1.0 - video playback rate controls tempo
        
        // Create filter for processing
        const filter = new window.soundtouch.SimpleFilter(null, soundTouch);
        
        // Processing buffers
        const sourceBuffer = new Float32Array(bufferSize * 2);
        const targetBuffer = new Float32Array(bufferSize * 2);
        
        processor.onaudioprocess = (event) => {
            if (!state.isProcessing) {
                // Pass through silence when not processing
                for (let channel = 0; channel < channelCount; channel++) {
                    event.outputBuffer.getChannelData(channel).fill(0);
                }
                return;
            }

            const inputL = event.inputBuffer.getChannelData(0);
            const inputR = event.inputBuffer.getChannelData(1);
            const outputL = event.outputBuffer.getChannelData(0);
            const outputR = event.outputBuffer.getChannelData(1);

            // Interleave input channels
            for (let i = 0; i < bufferSize; i++) {
                sourceBuffer[i * 2] = inputL[i];
                sourceBuffer[i * 2 + 1] = inputR[i];
            }

            // Process through SoundTouch
            filter.sourceSound = {
                extract: (target, numFrames) => {
                    const framesToCopy = Math.min(numFrames, bufferSize);
                    for (let i = 0; i < framesToCopy * 2; i++) {
                        target[i] = sourceBuffer[i];
                    }
                    return framesToCopy;
                }
            };

            const framesExtracted = filter.extract(targetBuffer, bufferSize);

            // Deinterleave output channels
            for (let i = 0; i < framesExtracted; i++) {
                outputL[i] = targetBuffer[i * 2];
                outputR[i] = targetBuffer[i * 2 + 1];
            }

            // Fill remaining with silence if needed
            for (let i = framesExtracted; i < bufferSize; i++) {
                outputL[i] = 0;
                outputR[i] = 0;
            }
        };

        processor.soundTouch = soundTouch;
        processor.filter = filter;

        return processor;
    }

    // Setup audio processing pipeline
    async function setupAudioProcessing() {
        const video = document.querySelector('video');
        if (!video) {
            console.warn('[YT Looper] No video element found');
            return false;
        }

        // Clean up existing connections
        if (state.sourceNode) {
            try {
                state.sourceNode.disconnect();
            } catch (e) {}
        }
        if (state.soundTouchNode) {
            try {
                state.soundTouchNode.disconnect();
            } catch (e) {}
        }

        state.video = video;

        // Mute original video to prevent double audio
        video.muted = true;

        // Initialize audio context
        const audioContext = await initAudioContext();
        if (!audioContext) return false;

        // Create source node from video element
        try {
            // Check if source already exists for this video
            if (!video._audioSource) {
                video._audioSource = audioContext.createMediaElementSource(video);
            }
            state.sourceNode = video._audioSource;
        } catch (error) {
            console.error('[YT Looper] Failed to create MediaElementSource:', error);
            return false;
        }

        // Create SoundTouch processing node
        state.soundTouchNode = createSoundTouchNode(audioContext);
        if (!state.soundTouchNode) {
            // Fallback: connect directly without processing
            console.warn('[YT Looper] Falling back to native audio (no pitch preservation)');
            state.sourceNode.connect(audioContext.destination);
            video.muted = false;
            return false;
        }

        // Connect audio graph: source -> SoundTouch -> destination
        state.sourceNode.connect(state.soundTouchNode);
        state.soundTouchNode.connect(audioContext.destination);
        state.isProcessing = true;

        console.log('[YT Looper] Audio processing pipeline established');
        return true;
    }

    // Set playback speed (with pitch preservation)
    function setSpeed(rate) {
        rate = clamp(rate, 0.5, 1.25);
        state.currentSpeed = rate;

        if (state.video) {
            state.video.playbackRate = rate;
        }

        // Update SoundTouch pitch compensation
        if (state.soundTouchNode && state.soundTouchNode.soundTouch) {
            const nativeSemis = semisFromRate(rate);
            const totalSemis = (-nativeSemis) + state.currentPitchSemitones;
            state.soundTouchNode.soundTouch.pitchSemitones = totalSemis;
            console.log(`[YT Looper] Speed: ${rate.toFixed(2)}x, Native semis: ${nativeSemis.toFixed(2)}, User semis: ${state.currentPitchSemitones}, Total compensation: ${totalSemis.toFixed(2)}`);
        }

        // Store in chrome.storage
        chrome.storage.sync.set({ playbackSpeed: rate });
    }

    // Set pitch adjustment in semitones
    function setPitchSemitones(semitones) {
        semitones = clamp(semitones, -6, 6);
        state.currentPitchSemitones = semitones;

        // Update SoundTouch pitch
        if (state.soundTouchNode && state.soundTouchNode.soundTouch) {
            const nativeSemis = semisFromRate(state.currentSpeed);
            const totalSemis = (-nativeSemis) + semitones;
            state.soundTouchNode.soundTouch.pitchSemitones = totalSemis;
            console.log(`[YT Looper] Pitch adjustment: ${semitones} semis, Total compensation: ${totalSemis.toFixed(2)}`);
        }

        // Store in chrome.storage
        chrome.storage.sync.set({ pitchSemitones: semitones });
    }

    // Load saved settings
    async function loadSettings() {
        const settings = await chrome.storage.sync.get(['playbackSpeed', 'pitchSemitones']);
        if (settings.playbackSpeed !== undefined) {
            state.currentSpeed = settings.playbackSpeed;
        }
        if (settings.pitchSemitones !== undefined) {
            state.currentPitchSemitones = settings.pitchSemitones;
        }
    }

    // A/B Loop functionality
    function setLoopPointA() {
        if (state.video) {
            state.loopA = state.video.currentTime;
            console.log(`[YT Looper] Loop point A set at ${state.loopA.toFixed(2)}s`);
        }
    }

    function setLoopPointB() {
        if (state.video && state.loopA !== null) {
            state.loopB = state.video.currentTime;
            if (state.loopB > state.loopA) {
                console.log(`[YT Looper] Loop point B set at ${state.loopB.toFixed(2)}s`);
                startLoop();
            } else {
                console.warn('[YT Looper] Loop point B must be after point A');
                state.loopB = null;
            }
        }
    }

    function startLoop() {
        if (!state.video || state.loopA === null || state.loopB === null) return;
        
        state.isLooping = true;
        
        function checkLoop() {
            if (!state.isLooping) return;
            
            if (state.video.currentTime >= state.loopB || state.video.currentTime < state.loopA) {
                state.video.currentTime = state.loopA;
            }
            
            state.loopAnimationFrame = requestAnimationFrame(checkLoop);
        }
        
        state.video.currentTime = state.loopA;
        checkLoop();
        console.log(`[YT Looper] Loop started: ${state.loopA.toFixed(2)}s - ${state.loopB.toFixed(2)}s`);
    }

    function stopLoop() {
        state.isLooping = false;
        if (state.loopAnimationFrame) {
            cancelAnimationFrame(state.loopAnimationFrame);
            state.loopAnimationFrame = null;
        }
        state.loopA = null;
        state.loopB = null;
        console.log('[YT Looper] Loop stopped');
    }

    // Message handler for popup communication
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        switch (request.type) {
            case 'SET_SPEED':
                setSpeed(request.rate);
                sendResponse({ success: true });
                break;
            case 'SET_PITCH':
                setPitchSemitones(request.semitones);
                sendResponse({ success: true });
                break;
            case 'GET_STATE':
                sendResponse({
                    speed: state.currentSpeed,
                    pitch: state.currentPitchSemitones,
                    loopA: state.loopA,
                    loopB: state.loopB,
                    isLooping: state.isLooping,
                    isProcessing: state.isProcessing
                });
                break;
            case 'SET_LOOP_A':
                setLoopPointA();
                sendResponse({ success: true });
                break;
            case 'SET_LOOP_B':
                setLoopPointB();
                sendResponse({ success: true });
                break;
            case 'STOP_LOOP':
                stopLoop();
                sendResponse({ success: true });
                break;
            default:
                sendResponse({ error: 'Unknown message type' });
        }
        return true; // Keep message channel open for async response
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (event) => {
        // Only handle if not in input field
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;

        switch (event.code) {
            case 'BracketLeft':
                event.preventDefault();
                setLoopPointA();
                break;
            case 'BracketRight':
                event.preventDefault();
                setLoopPointB();
                break;
            case 'Backslash':
                event.preventDefault();
                stopLoop();
                break;
        }
    });

    // Handle YouTube navigation (SPA)
    function handleNavigation() {
        console.log('[YT Looper] YouTube navigation detected, reinitializing...');
        state.isProcessing = false;
        
        // Wait for new video element
        setTimeout(async () => {
            await setupAudioProcessing();
            setSpeed(state.currentSpeed);
            setPitchSemitones(state.currentPitchSemitones);
        }, 1000);
    }

    // Listen for YouTube navigation events
    window.addEventListener('yt-navigate-finish', handleNavigation);
    
    // Also monitor for video element changes
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                const hasNewVideo = Array.from(mutation.addedNodes).some(node => 
                    node.nodeName === 'VIDEO' || (node.querySelector && node.querySelector('video'))
                );
                if (hasNewVideo) {
                    setTimeout(async () => {
                        await setupAudioProcessing();
                        setSpeed(state.currentSpeed);
                        setPitchSemitones(state.currentPitchSemitones);
                    }, 500);
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Initialize on load
    async function initialize() {
        console.log('[YT Looper] Initializing...');
        
        // Load saved settings
        await loadSettings();
        
        // Inject SoundTouch library
        const soundTouchLoaded = await injectSoundTouch();
        if (!soundTouchLoaded) {
            console.warn('[YT Looper] Running in fallback mode without pitch preservation');
        }

        // Setup audio processing
        const processingReady = await setupAudioProcessing();
        if (processingReady) {
            // Apply saved settings
            setSpeed(state.currentSpeed);
            setPitchSemitones(state.currentPitchSemitones);
        }
    }

    // Wait for page to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Cleanup on unload
    window.addEventListener('beforeunload', () => {
        if (state.soundTouchNode) {
            state.soundTouchNode.disconnect();
        }
        if (state.sourceNode) {
            state.sourceNode.disconnect();
        }
        if (state.audioContext) {
            state.audioContext.close();
        }
    });

})();