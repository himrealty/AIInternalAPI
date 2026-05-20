let deepseekTabId = null;

async function ensureDeepSeekTab() {
  const tabs = await chrome.tabs.query({ url: "https://chat.deepseek.com/*" });
  
  if (tabs.length > 0) {
    deepseekTabId = tabs[0].id;
    // Ensure content script is ready
    try {
      await chrome.tabs.sendMessage(deepseekTabId, { action: 'ping' });
    } catch (e) {
      // Reload content script if needed
      await chrome.scripting.executeScript({
        target: { tabId: deepseekTabId },
        files: ['content.js']
      });
      await new Promise(r => setTimeout(r, 500));
    }
    return deepseekTabId;
  }
  
  const tab = await chrome.tabs.create({ url: "https://chat.deepseek.com" });
  deepseekTabId = tab.id;
  
  // Wait for page to fully load
  await new Promise(r => setTimeout(r, 5000));
  
  // Inject content script
  await chrome.scripting.executeScript({
    target: { tabId: deepseekTabId },
    files: ['content.js']
  });
  
  return deepseekTabId;
}

async function sendToDeepSeek(message) {
  const tabId = await ensureDeepSeekTab();
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for response'));
    }, 60000);
    
    chrome.tabs.sendMessage(tabId, { action: 'ask', message }, (response) => {
      clearTimeout(timeout);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response && response.success) {
        resolve(response.response);
      } else {
        reject(new Error(response?.error || 'Unknown error'));
      }
    });
  });
}

// Listen for popup messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'askFromPopup') {
    sendToDeepSeek(request.message)
      .then(response => sendResponse({ success: true, response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});