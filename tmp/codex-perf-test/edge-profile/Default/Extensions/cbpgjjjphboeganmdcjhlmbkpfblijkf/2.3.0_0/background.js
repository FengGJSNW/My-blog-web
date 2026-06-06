const screenshotPayloads = new Map();

function msg(key, fallback) {
  return chrome.i18n.getMessage(key) || fallback;
}

// Create context menu items
function createContextMenu() {
  // Remove existing menu items first
  chrome.contextMenus.removeAll();

  chrome.contextMenus.create({
    id: "savePdfReader",
    title: chrome.i18n.getMessage("saveAsPDFReader"),
    contexts: ["page", "image"]
  });

  chrome.contextMenus.create({
    id: "savePdf",
    title: chrome.i18n.getMessage("saveAsPDF"),
    contexts: ["page", "image"]
  });

  chrome.contextMenus.create({
    id: "savePng",
    title: chrome.i18n.getMessage("saveAsImage"),
    contexts: ["page", "image"]
  });

  chrome.contextMenus.create({
    id: "saveMarkdown",
    title: chrome.i18n.getMessage("saveAsMarkdown"),
    contexts: ["page", "image"]
  });

  chrome.contextMenus.create({
    id: "separator_save",
    type: "separator",
    contexts: ["page", "image"]
  });

  chrome.contextMenus.create({
    id: "captureScreenshot",
    title: msg("screenshotMenu", "Capture Screenshot"),
    contexts: ["page"]
  });

  chrome.contextMenus.create({
    id: "captureVisible",
    title: msg("screenshotVisible", "Visible area"),
    parentId: "captureScreenshot",
    contexts: ["page"]
  });

  chrome.contextMenus.create({
    id: "captureSelection",
    title: msg("screenshotSelection", "Select area"),
    parentId: "captureScreenshot",
    contexts: ["page"]
  });

  chrome.contextMenus.create({
    id: "captureElement",
    title: msg("screenshotElement", "Select element"),
    parentId: "captureScreenshot",
    contexts: ["page"]
  });

  // Submit current page link to Pixelstech
  chrome.contextMenus.create({
    id: "submitLinkToPixelstech",
    title: chrome.i18n.getMessage("submitLink"),
    contexts: ["page", "image"],
  });

  // Add separator
  chrome.contextMenus.create({
    id: "separator1",
    type: "separator",
    contexts: ["page", "image"]
  });

  // Translate to (selection context)
  chrome.contextMenus.create({
    id: "translateTo",
    title: chrome.i18n.getMessage('translateTo'),
    contexts: ["selection"]
  });

  const translateTargets = [
    { id: "translateTo_en", title: chrome.i18n.getMessage('translateToEnglish'), lang: "en" },
    { id: "translateTo_zh", title: chrome.i18n.getMessage('translateToChineseSimplified'), lang: "zh" },
    { id: "translateTo_zhHant", title: chrome.i18n.getMessage('translateToChineseTraditional'), lang: "zh-Hant" },
    { id: "translateTo_ja", title: chrome.i18n.getMessage('translateToJapanese'), lang: "ja" },
    { id: "translateTo_vi", title: chrome.i18n.getMessage('translateToVietnamese'), lang: "vi" }
  ];

  for (const t of translateTargets) {
    chrome.contextMenus.create({
      id: t.id,
      title: t.title,
      parentId: "translateTo",
      contexts: ["selection"]
    });
  }

  // Create context menu items for images
  // Instead of using enabled property, use separate items for page/image contexts
  
  // chrome.contextMenus.create({
  //   id: "extractTextFromImage_page",
  //   title: chrome.i18n.getMessage("extractTextFromImage"),
  //   contexts: ["page"],
  //   enabled: false
  // });
  
  // For image context - enabled items
  chrome.contextMenus.create({
    id: "extractTextFromImage",
    title: chrome.i18n.getMessage("extractTextFromImage"),
    contexts: ["image"]
  });

  // Add separator
  chrome.contextMenus.create({
    id: "separator2",
    type: "separator",
    contexts: ["page", "image"]
  });

  // Add Donate menu item
  chrome.contextMenus.create({
    id: "donate",
    title: chrome.i18n.getMessage("donate"),
    contexts: ["page", "image"]
  });

  // Report issue (prefill current page URL)
  chrome.contextMenus.create({
    id: "reportIssue",
    title: chrome.i18n.getMessage("reportIssue"),
    contexts: ["page", "image"]
  });

  // Add About menu item
  chrome.contextMenus.create({
    id: "about",
    title: chrome.i18n.getMessage("about"),
    contexts: ["page", "image"]
  });

  // Add version menu item (non-clickable)
  const manifest = chrome.runtime.getManifest();
  chrome.contextMenus.create({
    id: "version",
    title: `${chrome.i18n.getMessage("version")}: ${manifest.version}`,
    contexts: ["page", "image"],
    enabled: false
  });
}

// Create context menu when extension is installed
chrome.runtime.onInstalled.addListener((details) => {
  // Create the context menu
  createContextMenu();

  // Only show welcome page on initial installation, not on updates
  if (details.reason === 'install') {
    // Open welcome page
    chrome.tabs.create({
      url: 'https://www.pixelstech.net/application/pagesaver?action=install',
      active: true
    });
  }
  
  // Log update information
  if (details.reason === 'update') {
    const manifest = chrome.runtime.getManifest();
    console.log(`Extension updated from ${details.previousVersion} to ${manifest.version}`);
  }
});

// Listen for Chrome language changes and recreate the menu
chrome.i18n.getAcceptLanguages(() => {
  // Recreate context menu with new language
  createContextMenu();
});

// ========== OPEN MARKDOWN IN TAB CONFIGURATION ==========
// When enabled, after markdown download, upload to pixelstech.net and open view URL in new tab
const PageSaverOpenMarkdownInTab = {
  enabled: true, // Set to true to open generated markdown in new tab
};

// ===== Global rate limiter for captureVisibleTab =====
const CAPTURE_MIN_INTERVAL_MS = 600; // ensure <= ~1.6 calls/sec (Chrome limit ~2/sec)
const CAPTURE_MAX_RETRIES = 5;
const CAPTURE_BACKOFF_BASE_MS = 400;

let captureQueue = [];
let captureProcessing = false;
let lastCaptureTimestamp = 0;

function schedule(fn, delayMs) {
  return new Promise(resolve => setTimeout(() => resolve(fn()), delayMs));
}

function processCaptureQueue() {
  if (captureProcessing) return;
  if (captureQueue.length === 0) return;

  const job = captureQueue.shift();
  captureProcessing = true;

  const now = Date.now();
  const wait = Math.max(0, CAPTURE_MIN_INTERVAL_MS - (now - lastCaptureTimestamp));

  const runJob = () => {
    const onCaptured = (dataUrl) => {
      lastCaptureTimestamp = Date.now();

      if (chrome.runtime.lastError) {
        const message = chrome.runtime.lastError.message || 'captureVisibleTab failed';
        const isRateLimited = /MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND/i.test(message);

        if (isRateLimited && job.attempt < CAPTURE_MAX_RETRIES) {
          job.attempt += 1;
          const backoff = CAPTURE_BACKOFF_BASE_MS * job.attempt;
          // Requeue the same job with backoff
          setTimeout(() => {
            captureQueue.unshift(job);
            captureProcessing = false;
            processCaptureQueue();
          }, backoff);
          return;
        }

        try { job.reject(new Error(message)); } catch (_) {}
      } else if (!dataUrl) {
        try { job.reject(new Error('Empty capture image')); } catch (_) {}
      } else {
        try { job.resolve(dataUrl); } catch (_) {}
      }

      captureProcessing = false;
      processCaptureQueue();
    };

    if (typeof job.windowId === 'number') {
      chrome.tabs.captureVisibleTab(job.windowId, { format: 'png' }, onCaptured);
    } else {
      chrome.tabs.captureVisibleTab({ format: 'png' }, onCaptured);
    }
  };

  if (wait > 0) {
    setTimeout(runJob, wait);
  } else {
    runJob();
  }
}

function captureVisibleTabThrottled(windowId) {
  return new Promise((resolve, reject) => {
    captureQueue.push({ resolve, reject, attempt: 0, windowId });
    processCaptureQueue();
  });
}

// Helper function to check if we're in development mode
function isDevMode() {
  return !('update_url' in chrome.runtime.getManifest());
}

function buildReportIssueUrl(pageUrl) {
  const safeUrl = (typeof pageUrl === 'string') ? pageUrl : '';
  return `https://www.pixelstech.net/application/pagesaver/issue.php?url=${encodeURIComponent(safeUrl)}`;
}

function openReportIssueTab(tab, info) {
  const tabUrl = tab && typeof tab.url === 'string' ? tab.url : '';
  const pageUrl = info && typeof info.pageUrl === 'string' ? info.pageUrl : '';
  chrome.tabs.create({ url: buildReportIssueUrl(tabUrl || pageUrl) });
}

// Function to track save with menu item info
function trackSave(menuItem = '', mode = 'client', pagination) {
  try {    
    // Get the manifest
    const manifest = chrome.runtime.getManifest();
    
    // Clean and encode the menu item
    const cleanMenuItem = menuItem.replace(/^saveImageAs/, 'save_image_').toLowerCase() || 'page';
    const encodedMenuItem = encodeURIComponent(cleanMenuItem);
    let trackUrl = `https://www.pixelstech.net/application/pagesaver/?action=save&type=${encodedMenuItem}&mode=${mode}&version=${manifest.version}`;
    if (pagination) {
      trackUrl += `&pagination=${encodeURIComponent(pagination)}`;
    }

    // Skip tracking for local development/testing
    if (isDevMode()) {
      console.log('Development mode detected: Skipping tracking event. URL: ', trackUrl);
      return; // Exit early without sending the tracking event
    }

    const response = fetch(trackUrl, {
      method: 'GET',
      headers: {
        'User-Agent': navigator.userAgent
      }
    });

    if (!response.ok) {
      console.log('Error saving page:', response);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error saving page:', error);
  }
}

// Listen for context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  // Handle different menu items
  if (info.menuItemId === "saveMarkdown") {
    handleCapture(tab.id, 'markdown', true);
  } else if (info.menuItemId === "savePng") {
    handleCapture(tab.id, 'png', false);
  } else if (info.menuItemId === "savePdf") {
    handleCapture(tab.id, 'pdf', false);
  } else if (info.menuItemId === "savePdfReader") {
    handleCapture(tab.id, 'pdf', true);
  } else if (info.menuItemId === "extractTextFromImage" && info.srcUrl) {
    handleExtractTextFromImage(tab.id, info.srcUrl);
  } else if (info.menuItemId === "captureVisible") {
    startScreenshotCapture(tab && tab.id, 'visible');
  } else if (info.menuItemId === "captureSelection") {
    startScreenshotCapture(tab && tab.id, 'selection');
  } else if (info.menuItemId === "captureElement") {
    startScreenshotCapture(tab && tab.id, 'element');
  } else if (info.menuItemId === "submitLinkToPixelstech") {
    handleSubmitLinkToPixelstech(tab);
  } else if (info.menuItemId === "donate") {
    chrome.tabs.create({ url: 'https://www.pixelstech.net/donate.php?utm_source=pagesaver' });
  } else if (info.menuItemId === "reportIssue") {
    openReportIssueTab(tab, info);
  } else if (info.menuItemId === "about") {
    chrome.tabs.create({ url: 'https://pagesaver.pixelstech.net' });
  } else if (typeof info.menuItemId === 'string' && info.menuItemId.startsWith('translateTo_')) {
    const targetMap = {
      translateTo_en: 'en',
      translateTo_zh: 'zh',
      translateTo_zhHant: 'zh-Hant',
      translateTo_ja: 'ja',
      translateTo_vi: 'vi'
    };
    const targetLanguage = targetMap[info.menuItemId] || 'en';
    const selectionText = (info.selectionText || '').trim();
    if (!selectionText) {
      // nothing selected
      return;
    }
    runTranslateInPage(tab.id, targetLanguage, selectionText);
  }
});

/**
 * Injects a script into the page to detect the source language and translate
 * the selected text to the given target language using Chrome's built-in AI APIs.
 * Renders a small overlay on the page with the translated text.
 */
async function runTranslateInPage(tabId, targetLanguage, selectionText) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      args: [targetLanguage, selectionText],
      func: async (targetLang, text) => {
        const upgradeHelp = 'Translation requires Chrome 138+ with Built-in AI enabled. Please update Chrome and try again.';

        const getSelectionRect = () => {
          const sel = window.getSelection && window.getSelection();
          if (!sel || sel.rangeCount === 0) return null;
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          if (rect && rect.width !== 0 && rect.height !== 0) return rect;
          const dummy = document.createElement('span');
          dummy.textContent = '\u200d';
          range.insertNode(dummy);
          const r = dummy.getBoundingClientRect();
          dummy.remove();
          return r;
        };

        const ensureOverlay = () => {
          let host = document.getElementById('pagesaver-translate-host');
          if (host) return host;
          host = document.createElement('div');
          host.id = 'pagesaver-translate-host';
          Object.assign(host.style, {
            position: 'fixed',
            top: '16px',
            right: '16px',
            zIndex: 2147483647,
          });
          document.documentElement.appendChild(host);
          return host;
        };

        const render = (content, isError = false, options = {}) => {
          const host = ensureOverlay();
          if (!host.shadowRoot) host.attachShadow({ mode: 'open' });
          const root = host.shadowRoot;
          root.innerHTML = '';
          const wrap = document.createElement('div');
          wrap.setAttribute('part', 'container');
          const baseStyle = `
            font: 13px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
            color: #111;
            background: ${isError ? '#fdecea' : '#fff'};
            border: 1px solid ${isError ? '#f5c2c0' : '#d0d7de'};
            box-shadow: 0 8px 24px rgba(140,149,159,0.2);
            border-radius: 8px;
            width: auto;
            max-width: min(520px, 80vw);
            height: auto;
            max-height: min(70vh, 560px);
            overflow: auto;
            padding: 12px 12px 8px 12px;
            forced-color-adjust: none;`;

          // Set base style first; position will be computed after measuring
          wrap.style.cssText = `${baseStyle} position: fixed; left: 8px; top: 8px;`;
          const closeBtn = document.createElement('button');
          closeBtn.textContent = '×';
          closeBtn.ariaLabel = 'Close';
          closeBtn.style.cssText = `
            position:absolute; top:4px; right:6px; border:none; background:transparent; cursor:pointer; font-size:16px; color:#57606a; forced-color-adjust:none;
          `;
          closeBtn.onclick = () => host.remove();
          const title = document.createElement('div');
          title.textContent = isError ? 'Translation error' : '';
          title.style.cssText = 'font-weight:600; margin-bottom:6px; padding-right:18px; position:relative;';
          const body = document.createElement('div');
          body.style.cssText = 'white-space:pre-wrap; overflow-wrap:break-word; word-break:break-word; margin-bottom:8px;';
          if (content instanceof Node) {
            body.appendChild(content);
          } else {
            body.textContent = String(content);
          }

          const actions = document.createElement('div');
          actions.style.cssText = 'display:flex; gap:8px; justify-content:space-between; align-items:center;';

          const leftGroup = document.createElement('div');
          leftGroup.style.cssText = 'display:flex; gap:8px; align-items:center;';
          const rightGroup = document.createElement('div');
          rightGroup.style.cssText = 'display:flex; gap:8px; align-items:center;';
          const copyBtn = document.createElement('button');
          copyBtn.textContent = 'Copy';
          copyBtn.style.cssText = 'border:1px solid #d0d7de; background:#f6f8fa; color:#24292f; padding:4px 8px; border-radius:6px; cursor:pointer; forced-color-adjust:none;';
          copyBtn.onclick = async () => {
            try {
              const textToCopy = body.innerText || body.textContent || '';
              await navigator.clipboard.writeText(textToCopy);
              copyBtn.textContent = 'Copied';
              setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
            } catch (e) {
              console.error('Copy failed:', e);
            }
          };
          wrap.appendChild(closeBtn);
          wrap.appendChild(title);
          wrap.appendChild(body);
          rightGroup.appendChild(copyBtn);

          if (options && options.actionLabel && typeof options.onAction === 'function') {
            const actionBtn = document.createElement('button');
            actionBtn.textContent = options.actionLabel;
            actionBtn.style.cssText = 'border:1px solid #0969da; background:#0969da; color:#fff; padding:4px 10px; border-radius:6px; cursor:pointer; forced-color-adjust:none;';
            actionBtn.onclick = () => {
              try { options.onAction(); } catch (e) { console.error(e); }
            };
            leftGroup.appendChild(actionBtn);
          }

          actions.appendChild(leftGroup);
          actions.appendChild(rightGroup);
          wrap.appendChild(actions);
          root.appendChild(wrap);

          // After content is in DOM, measure and place to keep it fully visible
          const selRect = getSelectionRect();
          const dialogRect = wrap.getBoundingClientRect();
          const margin = 8;
          const maxWidthPx = Math.min(520, Math.floor(window.innerWidth * 0.8));
          const width = Math.min(dialogRect.width, maxWidthPx);
          let left = margin;
          let top = margin;
          if (selRect) {
            left = Math.min(
              Math.max(margin, selRect.left),
              window.innerWidth - width - margin
            );
            // Prefer showing below selection; flip above if overflow
            const belowTop = selRect.bottom + 6;
            const aboveTop = selRect.top - dialogRect.height - 6;
            if (belowTop + dialogRect.height + margin <= window.innerHeight) {
              top = Math.min(Math.max(margin, belowTop), window.innerHeight - dialogRect.height - margin);
            } else if (aboveTop >= margin) {
              top = Math.min(Math.max(margin, aboveTop), window.innerHeight - dialogRect.height - margin);
            } else {
              // If cannot fully fit above/below, clamp within viewport
              top = Math.min(Math.max(margin, belowTop), window.innerHeight - dialogRect.height - margin);
            }
          } else {
            left = Math.min(margin, window.innerWidth - width - margin);
            top = Math.min(margin, window.innerHeight - dialogRect.height - margin);
          }
          wrap.style.left = `${left}px`;
          wrap.style.top = `${top}px`;

          // keep dialog visible; no auto-close
        };

        const doTranslate = async () => {
          try {
            // Prefer live page selection over provided plain text for HTML-aware translation
            const selection = window.getSelection && window.getSelection();
            const hasRange = !!(selection && selection.rangeCount);
            const range = hasRange ? selection.getRangeAt(0) : null;
            const plainSelection = hasRange ? (range.cloneContents().textContent || '') : (text || '');
            if (!plainSelection || !plainSelection.trim()) return;

            // Prefer new global classes when available
            const hasDetector = 'LanguageDetector' in self;
            const hasTranslator = 'Translator' in self;
            if (!hasDetector || !hasTranslator) {
              render(upgradeHelp, true);
              return;
            }

            const detector = await self.LanguageDetector.create({
              monitor(m) {
                m.addEventListener('downloadprogress', () => {});
              },
            });
            const results = await detector.detect(plainSelection);
            const sourceLang = (results && results[0] && results[0].detectedLanguage) || 'auto';

            if(sourceLang === targetLang) {
              render(plainSelection, false);
              return;
            }
            const translator = await self.Translator.create({
              sourceLanguage: sourceLang,
              targetLanguage: targetLang,
              monitor(m) {
                m.addEventListener('downloadprogress', (e) => {
                  const pct = Math.round((e.loaded || 0) * 100);
                  render(`Downloading translation model... ${pct}%`, false);
                });
              },
            });

            // If user selection exists, translate based on HTML to preserve formatting
            let container;
            if (range) {
              const fragment = range.cloneContents();
              const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT, {
                acceptNode: (node) => (/\S/.test(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT)
              });
              const textNodes = [];
              let current;
              while ((current = walker.nextNode())) textNodes.push(current);
              for (const tn of textNodes) {
                try {
                  const original = tn.nodeValue || '';
                  const translatedPiece = await translator.translate(original);
                  tn.nodeValue = translatedPiece;
                } catch (e) {
                  // If a single node translation fails, leave it as-is and continue
                }
              }
              container = document.createDocumentFragment();
              container.appendChild(fragment);
            } else {
              // Fallback to plain-text structure preserving translation
              container = document.createDocumentFragment();
              const addParagraph = (txt) => {
                const pEl = document.createElement('p');
                pEl.style.margin = '0 0 0.6em 0';
                pEl.textContent = txt;
                container.appendChild(pEl);
              };
              if (/\r?\n\r?\n/.test(plainSelection)) {
                const paragraphs = plainSelection.split(/\r?\n\r?\n/);
                for (const p of paragraphs) {
                  if (p.trim().length === 0) {
                    container.appendChild(document.createElement('br'));
                  } else {
                    addParagraph(await translator.translate(p));
                  }
                }
              } else if (/\r?\n/.test(plainSelection)) {
                const lines = plainSelection.split(/\r?\n/);
                for (let i = 0; i < lines.length; i++) {
                  const line = lines[i];
                  const translatedLine = line.trim().length ? await translator.translate(line) : '';
                  const span = document.createElement('span');
                  span.textContent = translatedLine;
                  container.appendChild(span);
                  if (i < lines.length - 1) container.appendChild(document.createElement('br'));
                }
              } else {
                addParagraph(await translator.translate(plainSelection));
              }
            }

            detector.destroy();
            translator.destroy();
            render(container, false);
            
            // Return success to indicate translation completed
            return { success: true };
          } catch (err) {
            render((err && err.message) ? err.message : 'Failed to translate the selected text.', true);
          }
        };

        // If no user activation in page, request a click to proceed
        const hasActivation = !!(navigator.userActivation && navigator.userActivation.isActive);
        if (!hasActivation) {
          render('Click Translate to start translation.', false, {
            actionLabel: 'Translate',
            onAction: async () => { 
              const result = await doTranslate(); 
              return result;
            },
          });
          return;
        }
        // Otherwise proceed immediately
        return await doTranslate();
      },
    });
    
    // Check if translation was successful and track it
    if (results && results[0] && results[0].result && results[0].result.success) {
      trackSave('translate', 'client');
    }
  } catch (e) {
    console.error('Failed to inject translation script:', e);
  }
}

// Handle messages from popup and content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateServerPDF') {
    const host = isDevMode()
      ? "http://pixelstech.localhost"
      : "https://www.pixelstech.net";
    
    const endpoint = `${host}/backstage/application/pagesaver/pdf_v3.php`;
    
    fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        url: request.url,
        content: request.content
      }).toString()
    })
    .then(async response => {
      // Check if response is JSON (for error messages)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const jsonResponse = await response.json();
        if (!jsonResponse.success && jsonResponse.text === 'not_logged_in') {
          const loginUrl = isDevMode()
            ? 'http://pixelstech.localhost/login.php'
            : 'https://www.pixelstech.net/login.php';
          
          // Open login page in new tab
          chrome.tabs.create({ url: loginUrl });
          
          throw new Error('Please log in first');
        }
        if (!jsonResponse.success && jsonResponse.text === 'not_allowed') {
          const pricingUrl = isDevMode()
            ? 'http://pixelstech.localhost/application/pagesaver/pricing.php'
            : 'https://www.pixelstech.net/application/pagesaver/pricing.php';
          
          // Open pricing page in new tab
          chrome.tabs.create({ url: pricingUrl });
          
          throw new Error('Please upgrade to access this feature');
        }
        throw new Error(jsonResponse.text || 'Server error');
      }
      
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      return response.blob();
    })
    .then(async blob => {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Data = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      
      sendResponse({ 
        success: true, 
        data: base64Data,
        filename: request.filename || 'page.pdf'
      });
    })
    .catch(error => {
      console.error('PDF generation failed:', error);
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // Will respond asynchronously
  } else if (request.action === 'capture') {
    handleCapture(request.tabId, request.format, request.readerMode, request.pdfPaginationMode)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Will respond asynchronously
  } else if (request.action === 'download') {
    // Validate dataUrl before attempting download
    if (!request.dataUrl) {
      console.error('Missing dataUrl in download request');
      sendResponse({ success: false, error: 'Missing dataUrl in download request' });
      return true;
    }

    chrome.downloads.download({
      url: request.dataUrl,
      filename: request.filename,
      saveAs: false  // Let user choose save location
    })
    .then(() => {
      // Track successful download
      const format = request.filename.split('.').pop();
      trackSave(format, 'client');
      sendResponse({ success: true });
    })
    .catch(error => {
      console.error('Download error:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  } else if (request.action === 'fetchImage') {
    console.log('Received fetchImage request for URL:', request.url);
    fetchImageData(request.url)
      .then(dataUrl => {
        console.log('Successfully fetched image data');
        sendResponse({ success: true, data: dataUrl });
      })
      .catch(error => {
        console.error('Error fetching image data:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Will respond asynchronously
  } else if (request.action === 'openTab' && request.url) {
    chrome.tabs.create({ url: request.url });
    sendResponse({ success: true });
  } else if (request.action === 'ping') {
    sendResponse({status: 'alive'});
    return;
  } else if (request.action === 'startScreenshotCapture') {
    startScreenshotCapture(request.tabId || (sender.tab && sender.tab.id), request.mode)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === 'getScreenshotPayload') {
    getScreenshotPayload(request.captureId)
      .then(payload => sendResponse({ success: true, payload }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === 'captureVisibleTab') {
    // Handle captureVisibleTab with global throttling and retries
    captureVisibleTabThrottled(sender.tab && sender.tab.windowId)
      .then((dataUrl) => {
        sendResponse({ success: true, dataUrl });
      })
      .catch((error) => {
        console.error('Error capturing visible tab:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // respond asynchronously after queued capture completes
  }
  return true;
});

// ========== UPLOAD MARKDOWN FOR VIEW (OPEN IN TAB) ==========
const MARKDOWN_VIEW_UPLOAD_URL = 'https://www.pixelstech.net/backstage/application/pagesaver/markdown_view.php';
const MARKDOWN_VIEW_UPLOAD_TIMEOUT_MS = 60000; // 1 minute

async function uploadMarkdownForView(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    console.log('[PageSaver] Markdown view: invalid dataUrl (missing or not data:)');
    return null;
  }
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) return null;
  const base64 = dataUrl.substring(commaIdx + 1);
  if (!base64) return null;

  console.log('[PageSaver] Markdown view: uploading to', MARKDOWN_VIEW_UPLOAD_URL, 'size:', Math.round(base64.length / 1024), 'KB');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MARKDOWN_VIEW_UPLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(MARKDOWN_VIEW_UPLOAD_URL, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ md: base64 }).toString(),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const json = await response.json();
    if (json.success && json.viewUrl) {
      console.log('[PageSaver] Markdown view: upload OK, viewUrl:', json.viewUrl);
      return json.viewUrl;
    }
    console.warn('[PageSaver] Markdown view upload failed:', json.text || json.error || response.status);
    return null;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[PageSaver] Markdown view upload error:', err?.message || err);
    return null;
  }
}

async function handleCapture(tabId, format = 'png', readerMode = false, requestedPaginationMode = 'single') {
  try {
    const pdfGenerationMode = readerMode ? 'server' : 'client';
    const pdfPaginationMode = requestedPaginationMode === 'multi' ? 'multi' : 'single';
    
    // Inject content script only if needed
    await injectContentScriptIfNeeded(tabId);

    // Send message to content script
    const response = await chrome.tabs.sendMessage(tabId, { 
      action: 'capture',
      format: format,
      readerMode: readerMode,
      pdfPaginationMode: pdfPaginationMode
    });

    console.log('Capture response received:', {
      success: response.success, 
      hasDataUrl: !!response.dataUrl,
      isBlob: response.isBlob,
      format: format,
      readerMode: readerMode,
      pdfGenerationMode: pdfGenerationMode,
      pdfPaginationMode: pdfPaginationMode
    });

    if (!response.success) {
      throw new Error(response.error || 'Capture failed');
    }

    // For server-side PDF generation, dataUrl might be undefined but operation still successful
    // Skip the download but still track the save
    if (!response.dataUrl) {
      console.log('No dataUrl provided, assuming server-side processing completed successfully.');
      // Track successful save
      trackSave(readerMode ? 'pdfreader' : format, pdfGenerationMode, format.toLowerCase() === 'pdf' ? pdfPaginationMode : undefined);
      return { success: true };
    }

    // Get tab info for filename
    const tab = await chrome.tabs.get(tabId);
    
    // Generate safe filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    
    // Enhanced filename sanitization for international characters and invisible Unicode
    const sanitizedTitle = tab.title
      .trim()
      // Remove zero-width characters and invisible characters
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
      // Remove other invisible/control characters
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      // Remove directional marks
      .replace(/[\u202A-\u202E\u2066-\u2069]/g, '')
      // Remove variation selectors
      .replace(/[\uFE00-\uFE0F]/g, '')
      // Replace Windows/Unix unsafe characters
      .replace(/[\\/:*?"<>|]/g, '_')
      // Replace @ symbol which can be problematic
      .replace(/@/g, '_at_')
      // Replace other potentially problematic characters while preserving Chinese/Japanese/etc
      .replace(/[^\w\s\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\u0400-\u04ff\u0590-\u05ff\u0600-\u06ff\u3400-\u4dbf.-]/g, '_')
      // Replace multiple spaces/underscores with single underscore
      .replace(/[\s_]+/g, '_')
      // Remove leading/trailing underscores
      .replace(/^_+|_+$/g, '')
      // Limit length to avoid too long filenames
      .slice(0, 100) || 'page';
    
    // Set file extension based on format
    let fileExtension;
    switch (format.toLowerCase()) {
      case 'png':
        fileExtension = 'png';
        break;
      case 'pdf':
        fileExtension = 'pdf';
        break;
      case 'markdown':
      case 'md':
        fileExtension = 'md';
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
    
    const filename = `${sanitizedTitle}_${timestamp}${readerMode ? '_reader' : ''}.${fileExtension}`;
    // Download the file (we already checked that dataUrl exists)
    const downloadId = await chrome.downloads.download({
      url: response.dataUrl,
      filename: filename,
      saveAs: false  // Save directly to default download location
    });

    // Track successful save
    if (format.toLowerCase() === 'pdf') {
      trackSave(readerMode ? 'pdfreader' : format, pdfGenerationMode, pdfPaginationMode);
    } else {
      trackSave(format, 'client');
    }

    // Open markdown in new tab (when enabled)
    const shouldOpenMarkdown = PageSaverOpenMarkdownInTab.enabled &&
      format.toLowerCase() === 'markdown' &&
      response.dataUrl &&
      response.dataUrl.startsWith('data:');
    console.log('[PageSaver] Markdown open-in-tab: enabled=', PageSaverOpenMarkdownInTab.enabled, 'format=', format, 'hasDataUrl=', !!response.dataUrl, 'isDataUrl=', response.dataUrl?.startsWith?.('data:'), 'willAttempt=', shouldOpenMarkdown);
    if (shouldOpenMarkdown) {
      const viewUrl = await uploadMarkdownForView(response.dataUrl);
      if (viewUrl) {
        console.log('[PageSaver] Markdown view: opening tab', viewUrl);
        chrome.tabs.create({ url: viewUrl, active: true }, (tab) => {
          try { if (tab?.windowId && chrome.windows?.update) chrome.windows.update(tab.windowId, { focused: true }); } catch (_) {}
        });
      } else {
        console.warn('[PageSaver] Markdown view: upload returned no URL');
      }
    }

    // If it's a blob URL, we need to revoke it after download
    if (response.isBlob && response.dataUrl) {
      // Wait a bit to ensure download has started
      setTimeout(() => {
        try {
          // Use window.URL or self.URL as a fallback
          if (typeof URL !== 'undefined' && URL.revokeObjectURL) {
            URL.revokeObjectURL(response.dataUrl);
          } else if (typeof window !== 'undefined' && window.URL && window.URL.revokeObjectURL) {
            window.URL.revokeObjectURL(response.dataUrl);
          } else if (typeof self !== 'undefined' && self.URL && self.URL.revokeObjectURL) {
            self.URL.revokeObjectURL(response.dataUrl);
          } else {
            console.warn('URL.revokeObjectURL is not available in this context');
          }
          console.log('Blob URL revoked');
        } catch (e) {
          console.error('Error revoking blob URL:', e);
        }
      }, 5000); // Wait 5 seconds before revoking
    }

    return { success: true };
  } catch (error) {
    console.error('Capture error:', error);
    return { success: false, error: error.message };
  }
}

// Handle image fetching
async function fetchImageData(url) {
  console.log('Fetching image data from URL:', url);
  
  // List of fetch methods to try
  const fetchMethods = [
    // Method 1: Direct fetch with CORS
    async () => {
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Accept': 'image/*'
        }
      });
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      return response;
    },
    
    // Method 2: No-CORS mode
    async () => {
      const response = await fetch(url, {
        method: 'GET',
        mode: 'no-cors',
        credentials: 'omit'
      });
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      return response;
    },
    
    // Method 3: Using corsproxy.io
    async () => {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Accept': 'image/*'
        }
      });
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      return response;
    }
  ];
  
  let lastError = null;
  
  // Try each fetch method in sequence
  for (const method of fetchMethods) {
    try {
      const response = await method();
      const contentType = response.headers.get('content-type');
      
      if (!contentType || !contentType.includes('image/')) {
        console.warn('Response is not an image:', contentType);
        continue;
      }
      
      const blob = await response.blob();
      
      // Convert blob to data URL
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = (e) => reject(new Error(`FileReader error: ${e.message || 'Unknown error'}`));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn('Fetch method failed:', error);
      lastError = error;
      continue;
    }
  }
  
  // If all methods fail, throw the last error
  throw lastError || new Error('All fetch methods failed');
}

// Function to handle text extraction from image
async function handleExtractTextFromImage(tabId, srcUrl) {
  try {
    // Inject content script only if needed
    await injectContentScriptIfNeeded(tabId);

    // Send message to content script to extract text from image
    const response = await chrome.tabs.sendMessage(tabId, { 
      action: 'extractTextFromImage',
      srcUrl: srcUrl
    });

    // Track successful text extraction
    if (response && response.success) {
      trackSave('extract_text', 'server');
    }

    return { success: true };
  } catch (error) {
    console.error('Extract text from image error:', error);
    return { success: false, error: error.message };
  }
}

// Submit the active tab URL to Pixelstech feed save endpoint
async function handleSubmitLinkToPixelstech(tab) {
  try {
    const tabId = tab?.id;
    const url = tab?.url;
    if (!url) {
      console.warn('No URL found for the active tab');
      return;
    }

    const response = await fetch('https://www.pixelstech.net/backstage/feed/feed_saved.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        cmd: 'save',
        url: url,
      }),
      credentials: 'include',
    });

    // Try to parse JSON response robustly
    let data;
    try {
      data = await response.json();
    } catch (e) {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch (e2) {
        data = { status: 'failed', message: text || 'Unknown server response' };
      }
    }

    if (data && data.status === 'success') {
      if (typeof tabId === 'number') {
        try {
          await injectContentScriptIfNeeded(tabId);
          await chrome.tabs.sendMessage(tabId, {
            action: 'showSuccessToast',
            messageHtml: 'Feed submitted successfully. You can now read it in your <a href="https://www.pixelstech.net/admin/feed.php?tab=saved" target="_blank">saved feeds</a> page.'
          });
          trackSave('submit_link', 'client');
        } catch (err) {
          console.error('Failed to show success toast:', err);
        }
      }
      return;
    }

    // Not logged in: open login page
    if (data && data.status === 'failed' && data.reason === 'not_logged_in') {
      chrome.tabs.create({ url: 'https://www.pixelstech.net/login.php' });
      return;
    }

    // Other errors: show a toast like extractTextFromImage
    const errorMessage = (data && (data.message || data.error)) || 'Failed to submit link';
    if (typeof tabId === 'number') {
      try {
        await injectContentScriptIfNeeded(tabId);
        await chrome.tabs.sendMessage(tabId, {
          action: 'showErrorToast',
          message: errorMessage,
        });
      } catch (err) {
        console.error('Failed to show error toast in content script:', err);
      }
    }
  } catch (error) {
    console.error('Error submitting link to Pixelstech:', error);
    // Best-effort UI feedback on failure
    if (tab?.id) {
      try {
        await injectContentScriptIfNeeded(tab.id);
        await chrome.tabs.sendMessage(tab.id, {
          action: 'showErrorToast',
          message: error?.message || 'Error submitting link',
        });
      } catch (err) {
        console.error('Failed to show error toast after exception:', err);
      }
    }
  }
}

// Add this function at the appropriate place in your code
async function injectContentScriptIfNeeded(tabId) {
  try {
    // Try to message the content script to see if it's already loaded
    const isLoaded = await chrome.tabs.sendMessage(tabId, { action: 'ping' })
      .then(() => true)
      .catch(() => false);
    
    // Only inject if not already loaded
    if (!isLoaded) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
      // Wait a bit for the script to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return true;
  } catch (error) {
    console.error('Error injecting content script:', error);
    return false;
  }
}

// Helper function to send messages with proper callback handling
function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// ========== SCREENSHOT CAPTURE ==========

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sanitizeFilenamePart(value, fallback = 'screenshot') {
  return (value || fallback)
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/[\s_]+/g, '_')
    .slice(0, 90) || fallback;
}

function createCaptureId() {
  return `shot_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function isCapturableTab(tab) {
  return tab && tab.id && tab.url && !/^(about|moz-extension|chrome|edge|chrome-extension|data|file|resource):/i.test(tab.url);
}

async function startScreenshotCapture(tabId, mode = 'selection') {
  const tab = tabId ? await new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (t) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(t);
    });
  }) : null;

  if (!isCapturableTab(tab)) {
    throw new Error('Open a normal web page before capturing a screenshot.');
  }

  if (!['visible', 'selection', 'element'].includes(mode)) {
    throw new Error(`Unsupported screenshot mode: ${mode}`);
  }

  await injectContentScriptIfNeeded(tab.id);

  let payload;
  if (mode === 'visible') {
    payload = await captureVisibleScreenshot(tab);
  } else if (mode === 'selection') {
    payload = await captureSelectionScreenshot(tab);
  } else if (mode === 'element') {
    payload = await captureElementScreenshot(tab);
  }

  payload.sourceUrl = tab.url;
  payload.title = tab.title || 'Screenshot';
  payload.capturedAt = new Date().toISOString();
  payload.filenameBase = sanitizeFilenamePart(tab.title || (new URL(tab.url)).hostname, 'pagesaver-screenshot');

  return openScreenshotEditor(payload);
}

async function captureVisibleScreenshot(tab) {
  const metrics = await sendMessageToTab(tab.id, { action: 'prepareFullPageCapture' });
  if (!metrics || !metrics.success) throw new Error((metrics && metrics.error) || 'Could not read page metrics');

  const dataUrl = await captureVisibleTabDataUrl(tab.windowId);
  const imageSize = await getDataUrlImageSize(dataUrl);
  const scaleX = imageSize.width / metrics.viewportWidth;
  const scaleY = imageSize.height / metrics.viewportHeight;
  const suggestions = await collectRedactionSuggestions(tab.id, 'visible');
  const redactionSuggestions = (suggestions.rects || [])
    .map((item) => rectToEditorSuggestion(item, {
      offsetX: metrics.scrollX,
      offsetY: metrics.scrollY,
      scaleX,
      scaleY
    }))
    .filter(Boolean);
  try { await sendMessageToTab(tab.id, { action: 'restoreScrollPosition' }); } catch {}

  return {
    imageDataUrl: dataUrl,
    mode: 'visible',
    width: imageSize.width,
    height: imageSize.height,
    displayScale: Math.min(scaleX > 0 ? 1 / scaleX : 1, scaleY > 0 ? 1 / scaleY : 1),
    redactionSuggestions
  };
}

async function captureSelectionScreenshot(tab) {
  const selection = await sendMessageToTab(tab.id, { action: 'startSelectionCapture' });
  return cropInteractiveScreenshot(tab, selection, 'selection', 'Selection was cancelled');
}

async function captureElementScreenshot(tab) {
  const selection = await sendMessageToTab(tab.id, { action: 'startElementCapture' });
  return cropInteractiveScreenshot(tab, selection, 'element', 'Element selection was cancelled');
}

async function cropInteractiveScreenshot(tab, selection, mode, cancelledMessage) {
  if (!selection || !selection.success) {
    if (selection && selection.cancelled) return { success: false, cancelled: true };
    throw new Error((selection && selection.error) || cancelledMessage);
  }

  const dataUrl = await captureVisibleTabDataUrl(tab.windowId);
  const imageSize = await getDataUrlImageSize(dataUrl);
  const scaleX = imageSize.width / selection.viewportWidth;
  const scaleY = imageSize.height / selection.viewportHeight;
  const cropRect = {
    x: Math.max(0, Math.round(selection.rect.left * scaleX)),
    y: Math.max(0, Math.round(selection.rect.top * scaleY)),
    width: Math.max(1, Math.round(selection.rect.width * scaleX)),
    height: Math.max(1, Math.round(selection.rect.height * scaleY))
  };
  const imageDataUrl = await cropDataUrl(dataUrl, cropRect);
  const croppedSize = await getDataUrlImageSize(imageDataUrl);

  const suggestions = await collectRedactionSuggestions(tab.id, 'visible');
  const redactionSuggestions = (suggestions.rects || [])
    .map((item) => rectToEditorSuggestion(item, {
      offsetX: selection.scrollX + selection.rect.left,
      offsetY: selection.scrollY + selection.rect.top,
      scaleX,
      scaleY
    }))
    .filter((item) => item && rectIntersectsCanvas(item, croppedSize.width, croppedSize.height));

  return {
    imageDataUrl,
    mode,
    width: croppedSize.width,
    height: croppedSize.height,
    displayScale: Math.min(scaleX > 0 ? 1 / scaleX : 1, scaleY > 0 ? 1 / scaleY : 1),
    redactionSuggestions
  };
}

async function collectRedactionSuggestions(tabId, scope) {
  try {
    const response = await sendMessageToTab(tabId, { action: 'collectRedactionSuggestions', scope });
    return response && response.success ? response : { rects: [] };
  } catch (e) {
    console.warn('[PageSaver] redaction suggestions unavailable:', e.message);
    return { rects: [] };
  }
}

function rectToEditorSuggestion(item, transform) {
  if (!item || !item.rect) return null;
  const x = Math.round((item.rect.left - transform.offsetX) * transform.scaleX);
  const y = Math.round((item.rect.top - transform.offsetY) * transform.scaleY);
  const width = Math.round(item.rect.width * transform.scaleX);
  const height = Math.round(item.rect.height * transform.scaleY);
  if (width < 3 || height < 3) return null;
  return {
    id: item.id || createCaptureId(),
    label: item.label || 'Sensitive text',
    reason: item.reason || 'Detected sensitive text',
    x,
    y,
    width,
    height
  };
}

function rectIntersectsCanvas(rect, width, height) {
  return rect.x < width && rect.y < height && rect.x + rect.width > 0 && rect.y + rect.height > 0;
}

function captureVisibleTabDataUrl(windowId) {
  return captureVisibleTabDataUrlAttempt(windowId).catch(async (firstError) => {
    await wait(900);
    return captureVisibleTabDataUrlAttempt(windowId).catch((secondError) => {
      throw new Error(secondError.message || firstError.message || 'Visible tab capture failed');
    });
  });
}

function captureVisibleTabDataUrlAttempt(windowId) {
  return captureVisibleTabThrottled(windowId);
}

function dataUriToBlob(dataUri) {
  const [header, data] = dataUri.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(data);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function cropDataUrl(dataUrl, rect) {
  const imageBitmap = await createImageBitmap(dataUriToBlob(dataUrl));
  const canvas = new OffscreenCanvas(rect.width, rect.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageBitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return blobToDataUrl(blob);
}

async function getDataUrlImageSize(dataUrl) {
  const imageBitmap = await createImageBitmap(dataUriToBlob(dataUrl));
  return { width: imageBitmap.width, height: imageBitmap.height };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

async function openScreenshotEditor(payload) {
  if (payload && payload.success === false && payload.cancelled) return payload;
  if (!payload || !payload.imageDataUrl) throw new Error('Missing screenshot payload');
  const captureId = createCaptureId();
  const storedPayload = { ...payload, captureId };
  screenshotPayloads.set(captureId, storedPayload);
  setTimeout(() => screenshotPayloads.delete(captureId), 10 * 60 * 1000);

  try {
    await saveScreenshotPayloadToIdb(storedPayload);
  } catch (e) {
    console.warn('[PageSaver] could not persist screenshot payload in IndexedDB:', e.message);
  }

  chrome.tabs.create({
    url: chrome.runtime.getURL(`editor.html?captureId=${encodeURIComponent(captureId)}`),
    active: true
  });

  return { success: true, captureId };
}

async function getScreenshotPayload(captureId) {
  if (!captureId) throw new Error('Missing capture id');
  if (screenshotPayloads.has(captureId)) return screenshotPayloads.get(captureId);
  const idbPayload = await getScreenshotPayloadFromIdb(captureId).catch(() => null);
  if (idbPayload) return idbPayload;
  throw new Error('Screenshot data expired. Please capture again.');
}

function openScreenshotDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('pagesaverScreenshotEditor', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('payloads')) {
        db.createObjectStore('payloads', { keyPath: 'captureId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
  });
}

async function saveScreenshotPayloadToIdb(payload) {
  const db = await openScreenshotDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('payloads', 'readwrite');
    tx.objectStore('payloads').put({ ...payload, savedAt: Date.now() });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('IndexedDB write failed'));
  });
  db.close();
}

async function getScreenshotPayloadFromIdb(captureId) {
  const db = await openScreenshotDb();
  const payload = await new Promise((resolve, reject) => {
    const tx = db.transaction('payloads', 'readonly');
    const request = tx.objectStore('payloads').get(captureId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('IndexedDB read failed'));
  });
  db.close();
  return payload;
}
