let geminiTabId = null;

async function ensureGeminiTab() {
  const tabs = await chrome.tabs.query({ url: "https://gemini.google.com/*" });
  
  if (tabs.length > 0) {
    geminiTabId = tabs[0].id;
    try {
      await chrome.tabs.sendMessage(geminiTabId, { action: 'ping' });
    } catch (e) {
      await chrome.scripting.executeScript({
        target: { tabId: geminiTabId },
        files: ['content.js']
      });
      await new Promise(r => setTimeout(r, 500));
    }
    return geminiTabId;
  }
  
  const tab = await chrome.tabs.create({ url: "https://gemini.google.com" });
  geminiTabId = tab.id;
  await new Promise(r => setTimeout(r, 5000));
  await chrome.scripting.executeScript({
    target: { tabId: geminiTabId },
    files: ['content.js']
  });
  return geminiTabId;
}

async function generateImage(prompt, autoDownload = true) {
  const tabId = await ensureGeminiTab();
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for image'));
    }, 120000);
    
    chrome.tabs.sendMessage(tabId, { action: 'generate', prompt, autoDownload }, (response) => {
      clearTimeout(timeout);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response && response.success) {
        resolve(response.imageUrl);
      } else {
        reject(new Error(response?.error || 'Unknown error'));
      }
    });
  });
}

// Listen for popup messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateFromPopup') {
    generateImage(request.prompt, request.autoDownload)
      .then(imageUrl => sendResponse({ success: true, imageUrl }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});