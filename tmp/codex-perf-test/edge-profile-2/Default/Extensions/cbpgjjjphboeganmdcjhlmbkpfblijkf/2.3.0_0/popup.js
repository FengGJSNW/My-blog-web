// Function to replace i18n messages in the document
function replaceI18nMessages() {
  // Replace text content for elements with __MSG_ pattern
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    null,
    false
  );

  const nodesToUpdate = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (text.includes('__MSG_')) {
        nodesToUpdate.push(node);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute('data-i18n')) {
      nodesToUpdate.push(node);
    }
  }

  nodesToUpdate.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent = node.textContent.replace(
        /__MSG_(\w+)__/g,
        (match, messageName) => chrome.i18n.getMessage(messageName) || match
      );
    } else {
      const messageName = node.getAttribute('data-i18n');
      node.textContent = chrome.i18n.getMessage(messageName);
    }
  });
}

// Initialize i18n when the document is loaded
document.addEventListener('DOMContentLoaded', function() {
  const pdfPaginationModeSelect = document.getElementById('pdfPaginationMode');
  if (pdfPaginationModeSelect) {
    chrome.storage.sync.get('pdfPaginationMode', function(data) {
      const val = data.pdfPaginationMode || 'single';
      pdfPaginationModeSelect.value = val;
    });

    pdfPaginationModeSelect.addEventListener('change', function() {
      const selected = this.value;
      chrome.storage.sync.set({ pdfPaginationMode: selected }, function() {
        if (chrome.runtime.lastError) {
          console.error('Error saving pagination preference:', chrome.runtime.lastError);
        }
      });
    });
  }

  // First replace the messages
  replaceI18nMessages();
  
  // Set the version from manifest
  const versionElement = document.getElementById('version');
  if (versionElement) {
    const manifest = chrome.runtime.getManifest();
    versionElement.textContent = `${manifest.version}`;
  }
  
  // Then set up event handlers
  document.getElementById('pngBtn').addEventListener('click', () => handleCapture('png'));
  document.getElementById('pdfBtn').addEventListener('click', () => handleCapture('pdf'));
  document.getElementById('pdfReaderBtn').addEventListener('click', () => handleCapture('pdf', true));
  document.getElementById('markdownBtn').addEventListener('click', () => handleCapture('markdown', true));
  
  // Donation button handler(s)
  const donateCtaBtn = document.getElementById('donateCtaBtn');
  if (donateCtaBtn) {
    donateCtaBtn.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://www.pixelstech.net/donate.php?utm_source=pagesaver' });
    });
  }
});

// Function to handle capture
async function handleCapture(format, readerMode = false) {
  const statusEl = document.getElementById('status');
  const pngBtn = document.getElementById('pngBtn');
  const pdfBtn = document.getElementById('pdfBtn');
  const pdfReaderBtn = document.getElementById('pdfReaderBtn');
  const markdownBtn = document.getElementById('markdownBtn');
  
  try {
    // Disable buttons and show status
    pngBtn.disabled = true;
    pdfBtn.disabled = true;
    pdfReaderBtn.disabled = true;
    markdownBtn.disabled = true;
    
    // Show localized status message
    const readerText = readerMode ? chrome.i18n.getMessage('inReaderMode', [' ']) : '';
    statusEl.textContent = chrome.i18n.getMessage('statusCapturing', [
      format.toUpperCase(),
      readerText
    ]);
    
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    let currentMode = 'single';
    const currentModeEl = document.getElementById('pdfPaginationMode');
    if (currentModeEl && typeof currentModeEl.value === 'string' && currentModeEl.value.length > 0) {
      currentMode = currentModeEl.value;
    } else {
      try {
        const syncRes = await chrome.storage.sync.get('pdfPaginationMode');
        if (syncRes && typeof syncRes.pdfPaginationMode === 'string' && syncRes.pdfPaginationMode.length > 0) {
          currentMode = syncRes.pdfPaginationMode;
        }
      } catch (e) {
        // ignore and use default
      }
    }

    // Send message to background script
    const response = await chrome.runtime.sendMessage({ 
      action: 'capture',
      tabId: tab.id,
      format: format,
      readerMode: readerMode,
      pdfPaginationMode: currentMode
    });
    
    if (response.success) {
      statusEl.textContent = chrome.i18n.getMessage('statusSuccess');
      // Close popup after success
      setTimeout(() => window.close(), 1000);
    } else {
      throw new Error(response.error || chrome.i18n.getMessage('captureError'));
    }
  } catch (error) {
    console.error('Error:', error);
    statusEl.textContent = chrome.i18n.getMessage('statusError', [error.message]);
  } finally {
    // Re-enable buttons
    pngBtn.disabled = false;
    pdfBtn.disabled = false;
    pdfReaderBtn.disabled = false;
    markdownBtn.disabled = false;
  }
} 