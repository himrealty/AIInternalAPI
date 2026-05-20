document.getElementById('send').addEventListener('click', async () => {
  const message = document.getElementById('message').value;
  if (!message) return;
  
  const responseDiv = document.getElementById('response');
  const statusSpan = document.getElementById('status');
  
  responseDiv.innerHTML = '⏳ Waiting for Qwen response...';
  statusSpan.textContent = 'Processing...';
  
  chrome.runtime.sendMessage({ action: 'askFromPopup', message }, (response) => {
    if (response && response.success) {
      responseDiv.innerHTML = `<strong>✅ Response:</strong><br><br>${response.response}`;
      statusSpan.textContent = 'Ready';
    } else {
      responseDiv.innerHTML = `<strong>❌ Error:</strong><br>${response?.error || 'Unknown error'}`;
      statusSpan.textContent = 'Error';
    }
  });
});