// Qwen API Handler
window.QwenController = {
  async sendMessage(message) {
    const ta = document.querySelector('textarea.message-input-textarea');
    if (!ta) throw new Error('Textarea not found');
    
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, message);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    
    return await this.waitForResponse();
  },
  
  async waitForResponse() {
    let lastLength = 0, stableCount = 0;
    
    const getLastOutput = () => {
      const candidates = [...document.querySelectorAll('.qwen-markdown, .response-message-content')].reverse();
      for (const el of candidates) {
        const text = (el.innerText || el.textContent || '').trim();
        if (text && text.length >= 50) return text;
      }
      return '';
    };
    
    const initial = getLastOutput();
    console.log('⏳ Waiting for Qwen response...');
    
    while (true) {
      const current = getLastOutput();
      const currentLength = current.length;
      
      if (current !== initial && currentLength === lastLength && currentLength > 0) {
        stableCount++;
        if (stableCount >= 3) {
          console.log('✅ Response complete!');
          return current;
        }
      } else {
        stableCount = 0;
      }
      
      lastLength = currentLength;
      await new Promise(r => setTimeout(r, 500));
    }
  }
};

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'ask') {
    window.QwenController.sendMessage(request.message)
      .then(response => sendResponse({ success: true, response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

console.log('Qwen API Controller loaded');