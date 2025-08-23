// Background script for YT Looper extension
// Handles extension icon clicks and shows the GUI

chrome.action.onClicked.addListener(async (tab) => {
  // Only work on pages with media content
  if (!tab.id || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('moz-extension://')) {
    return;
  }

  try {
    // Send message to content script to show the GUI
    await chrome.tabs.sendMessage(tab.id, {
      action: 'showGUI'
    });
  } catch (error) {
    console.warn('Could not send message to content script:', error);
    
    // If content script isn't loaded, try to inject it
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
      // Try to send the message again after injection
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id!, {
            action: 'showGUI'
          });
        } catch (retryError) {
          console.warn('Failed to show GUI after script injection:', retryError);
        }
      }, 500);
    } catch (injectionError) {
      console.warn('Failed to inject content script:', injectionError);
    }
  }
});

// Install/update listener - optional, for setting default settings
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('YT Looper extension installed');
  } else if (details.reason === 'update') {
    console.log('YT Looper extension updated to version:', chrome.runtime.getManifest().version);
  }
});