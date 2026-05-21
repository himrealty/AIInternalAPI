let lastImageUrl = null;

document.getElementById('generate').addEventListener('click', async () => {
  const prompt = document.getElementById('prompt').value;
  const autoDownload = document.getElementById('autoDownload').checked;
  
  if (!prompt) {
    alert('Please enter a prompt');
    return;
  }
  
  const statusDiv = document.getElementById('status');
  const statusText = document.getElementById('statusText');
  const generateBtn = document.getElementById('generate');
  const downloadBtn = document.getElementById('download');
  
  statusDiv.innerHTML = '⏳ Generating image... This may take 10-30 seconds...';
  statusText.textContent = 'Generating...';
  generateBtn.disabled = true;
  downloadBtn.disabled = true;
  
  chrome.runtime.sendMessage({ action: 'generateFromPopup', prompt, autoDownload }, (response) => {
    generateBtn.disabled = false;
    
    if (response && response.success) {
      lastImageUrl = response.imageUrl;
      statusDiv.innerHTML = '✅ <strong>Image generated successfully!</strong><br><br>📸 Image URL ready for download.';
      statusText.textContent = 'Ready';
      downloadBtn.disabled = false;
      
      if (!autoDownload) {
        statusDiv.innerHTML += '<br><br>Click "Download Last Image" to save.';
      }
    } else {
      statusDiv.innerHTML = `❌ Error: ${response?.error || 'Unknown error'}`;
      statusText.textContent = 'Error';
    }
  });
});

document.getElementById('download').addEventListener('click', () => {
  if (lastImageUrl) {
    chrome.runtime.sendMessage({ action: 'download', imageUrl: lastImageUrl });
    document.getElementById('status').innerHTML += '<br>📥 Download started...';
  }
});