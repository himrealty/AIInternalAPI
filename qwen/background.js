let qwenTabId = null;

async function ensureQwenTab() {
  const tabs = await chrome.tabs.query({ url: ["https://chat.qwen.ai/*", "https://qwenlm.github.io/*"] });
  
  if (tabs.length > 0) {
    qwenTabId = tabs[0].id;
    try {
      await chrome.tabs.sendMessage(qwenTabId, { action: 'ping' });
    } catch (e) {
      await chrome.scripting.executeScript({
        target: { tabId: qwenTabId },
        files: ['content.js']
      });
      await new Promise(r => setTimeout(r, 500));
    }
    return qwenTabId;
  }
  
  const tab = await chrome.tabs.create({ url: "https://chat.qwen.ai" });
  qwenTabId = tab.id;
  await new Promise(r => setTimeout(r, 5000));
  await chrome.scripting.executeScript({
    target: { tabId: qwenTabId },
    files: ['content.js']
  });
  return qwenTabId;
}

async function sendToQwen(message) {
  const tabId = await ensureQwenTab();
  
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
    sendToQwen(request.message)
      .then(response => sendResponse({ success: true, response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});