// YT Looper Popup Controller
// Handles UI interactions and messaging with content script

(function() {
    'use strict';

    // UI Elements
    const elements = {
        speedSlider: document.getElementById('speed'),
        speedValue: document.getElementById('speed-value'),
        pitchSlider: document.getElementById('pitch'),
        pitchValue: document.getElementById('pitch-value'),
        setAButton: document.getElementById('set-a'),
        setBButton: document.getElementById('set-b'),
        stopLoopButton: document.getElementById('stop-loop'),
        resetAllButton: document.getElementById('reset-all'),
        statusText: document.getElementById('status-text')
    };

    // State
    let currentTab = null;
    let debounceTimer = null;

    // Helper functions
    function updateStatus(text, duration = 2000) {
        elements.statusText.textContent = text;
        if (duration > 0) {
            setTimeout(() => {
                elements.statusText.textContent = 'Ready';
            }, duration);
        }
    }

    function formatPitchValue(semitones) {
        if (semitones === 0) return '0';
        return semitones > 0 ? `+${semitones}` : `${semitones}`;
    }

    // Send message to content script with debouncing
    function sendMessageDebounced(message, callback) {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
            sendMessage(message, callback);
        }, 50); // 50ms debounce
    }

    // Send message to content script
    async function sendMessage(message, callback) {
        if (!currentTab) {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            currentTab = tabs[0];
        }

        if (!currentTab || !currentTab.url || !currentTab.url.includes('youtube.com')) {
            updateStatus('Please open a YouTube video');
            return;
        }

        chrome.tabs.sendMessage(currentTab.id, message, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Message error:', chrome.runtime.lastError);
                updateStatus('Extension not ready. Refresh page.');
                return;
            }
            if (callback) callback(response);
        });
    }

    // Load current state from content script
    async function loadCurrentState() {
        sendMessage({ type: 'GET_STATE' }, (response) => {
            if (response) {
                // Update sliders with current values
                if (response.speed !== undefined) {
                    elements.speedSlider.value = response.speed;
                    elements.speedValue.textContent = `${response.speed.toFixed(2)}x`;
                }
                if (response.pitch !== undefined) {
                    elements.pitchSlider.value = response.pitch;
                    elements.pitchValue.textContent = formatPitchValue(response.pitch);
                }
                
                // Update status based on loop state
                if (response.isLooping) {
                    elements.statusText.innerHTML = '<span class="loop-indicator"></span>Looping';
                } else if (response.loopA !== null && response.loopB === null) {
                    updateStatus('Point A set - Set point B', 0);
                } else {
                    updateStatus('Ready', 0);
                }

                // Update button states
                elements.stopLoopButton.disabled = !response.isLooping;
            }
        });
    }

    // Event Listeners

    // Speed slider
    elements.speedSlider.addEventListener('input', (e) => {
        const speed = parseFloat(e.target.value);
        elements.speedValue.textContent = `${speed.toFixed(2)}x`;
        sendMessageDebounced({ type: 'SET_SPEED', rate: speed }, () => {
            updateStatus(`Speed: ${speed.toFixed(2)}x`);
        });
    });

    // Pitch slider
    elements.pitchSlider.addEventListener('input', (e) => {
        const pitch = parseInt(e.target.value);
        elements.pitchValue.textContent = formatPitchValue(pitch);
        sendMessageDebounced({ type: 'SET_PITCH', semitones: pitch }, () => {
            const pitchText = pitch === 0 ? 'Original pitch' : 
                             pitch > 0 ? `Pitch +${pitch} semitones` : 
                             `Pitch ${pitch} semitones`;
            updateStatus(pitchText);
        });
    });

    // Set point A button
    elements.setAButton.addEventListener('click', () => {
        sendMessage({ type: 'SET_LOOP_A' }, () => {
            updateStatus('Loop point A set');
            elements.setBButton.focus();
        });
    });

    // Set point B button
    elements.setBButton.addEventListener('click', () => {
        sendMessage({ type: 'SET_LOOP_B' }, (response) => {
            if (response && response.success) {
                elements.statusText.innerHTML = '<span class="loop-indicator"></span>Looping';
                elements.stopLoopButton.disabled = false;
            }
        });
    });

    // Stop loop button
    elements.stopLoopButton.addEventListener('click', () => {
        sendMessage({ type: 'STOP_LOOP' }, () => {
            updateStatus('Loop stopped');
            elements.stopLoopButton.disabled = true;
        });
    });

    // Reset all button
    elements.resetAllButton.addEventListener('click', () => {
        // Reset sliders
        elements.speedSlider.value = 1.0;
        elements.speedValue.textContent = '1.00x';
        elements.pitchSlider.value = 0;
        elements.pitchValue.textContent = '0';
        
        // Send reset messages
        sendMessage({ type: 'SET_SPEED', rate: 1.0 });
        sendMessage({ type: 'SET_PITCH', semitones: 0 });
        sendMessage({ type: 'STOP_LOOP' }, () => {
            updateStatus('All settings reset');
            elements.stopLoopButton.disabled = true;
        });
    });

    // Keyboard shortcuts in popup
    document.addEventListener('keydown', (e) => {
        switch(e.key) {
            case '[':
                e.preventDefault();
                elements.setAButton.click();
                break;
            case ']':
                e.preventDefault();
                elements.setBButton.click();
                break;
            case '\\':
                e.preventDefault();
                elements.stopLoopButton.click();
                break;
            case 'r':
            case 'R':
                if (e.shiftKey || e.ctrlKey) {
                    e.preventDefault();
                    elements.resetAllButton.click();
                }
                break;
        }
    });

    // Initialize on popup open
    async function initialize() {
        try {
            // Get current tab
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            currentTab = tabs[0];

            if (!currentTab.url || !currentTab.url.includes('youtube.com')) {
                updateStatus('Please open a YouTube video', 0);
                // Disable controls if not on YouTube
                elements.speedSlider.disabled = true;
                elements.pitchSlider.disabled = true;
                elements.setAButton.disabled = true;
                elements.setBButton.disabled = true;
                elements.stopLoopButton.disabled = true;
                return;
            }

            // Load current state
            await loadCurrentState();

            // Poll for state updates periodically
            setInterval(() => {
                loadCurrentState();
            }, 1000);

        } catch (error) {
            console.error('Initialization error:', error);
            updateStatus('Error initializing', 0);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();