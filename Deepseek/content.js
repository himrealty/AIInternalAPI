// DeepSeek API Handler
window.DeepSeekController = {
  async sendMessage(message) {
    const ta = document.querySelector('textarea');
    if (!ta) throw new Error('Textarea not found');
    
    // Clear existing text first
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, '');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Set new message
    setter.call(ta, message);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Enable send button
    const btn = document.querySelector('div[role="button"]');
    if (btn) {
      btn.setAttribute('aria-disabled', 'false');
      btn.classList.remove('ds-icon-button--disabled');
    }
    
    // Send with Enter key
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    
    // Wait for response
    return await this.waitForResponse();
  },
  
  async waitForResponse() {
    let lastLength = 0, stableCount = 0;
    const getText = () => {
      const nodes = document.querySelectorAll('[class*="message"], [class*="assistant"]');
      return nodes.length ? nodes[nodes.length-1].innerText : '';
    };
    const initial = getText();
    
    while (true) {
      await new Promise(r => setTimeout(r, 500));
      const current = getText();
      if (current !== initial && current.length === lastLength && current.length > 0) {
        stableCount++;
        if (stableCount >= 3) return current;
      } else {
        stableCount = 0;
      }
      lastLength = current.length;
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
    window.DeepSeekController.sendMessage(request.message)
      .then(response => sendResponse({ success: true, response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

console.log('DeepSeek API Controller loaded');