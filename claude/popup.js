document.getElementById('open').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tab = tabs[0];
    if (tab.url && tab.url.includes('claude.ai')) {
      chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
      window.close();
    } else {
      chrome.tabs.create({ url: 'https://claude.ai' });
    }
  });
});
