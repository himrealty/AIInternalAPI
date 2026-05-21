// Gemini Image Controller
window.GeminiController = {
  async generateImage(prompt) {
    // Step 1: Type prompt
    const editor = document.querySelector('.ql-editor');
    if (!editor) throw new Error('Editor not found');
    
    editor.innerText = prompt;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));
    console.log('📝 Prompt entered:', prompt);
    
    // Step 2: Wait for UI to update (CRITICAL FIX)
    await new Promise(r => setTimeout(r, 500));
    
    // Step 3: Click send button
    const sendBtn = document.querySelector('mat-icon[fonticon="arrow_upward"]')?.closest('button');
    if (!sendBtn) throw new Error('Send button not found');
    sendBtn.click();
    console.log('📤 Prompt sent');
    
    // Step 4: Wait for and return image
    return await this.waitForImage();
  },
  
  async waitForImage() {
    const beforeCount = document.querySelectorAll('img[src^="blob:"]').length;
    console.log('⏳ Waiting for image generation...');
    
    while (true) {
      await new Promise(r => setTimeout(r, 500));
      const currentCount = document.querySelectorAll('img[src^="blob:"]').length;
      
      if (currentCount > beforeCount) {
        const newImg = document.querySelectorAll('img[src^="blob:"]')[currentCount - 1];
        console.log('✅ Image generated!');
        return newImg.src;
      }
    }
  },
  
  downloadImage(src, filename = `gemini_${Date.now()}.png`) {
    const link = document.createElement('a');
    link.href = src;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log('✅ Image downloaded:', filename);
  }
};

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'generate') {
    window.GeminiController.generateImage(request.prompt)
      .then(imageUrl => {
        if (request.autoDownload) {
          window.GeminiController.downloadImage(imageUrl);
        }
        sendResponse({ success: true, imageUrl });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'download') {
    window.GeminiController.downloadImage(request.imageUrl, request.filename);
    sendResponse({ success: true });
    return true;
  }
});

console.log('Gemini Image Controller loaded');