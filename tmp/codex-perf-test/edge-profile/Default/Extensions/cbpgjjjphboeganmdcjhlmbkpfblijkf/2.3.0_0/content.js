// ========== GLOBAL CONFIGURATIONS ==========
// Global pagination mode (set during capture)
let PDFPaginationMode = 'single';

// Control whether a watermark is added. Default: true
const PageSaverWatermark = {
  enabled: false,
  sizePx: 100,
  marginBottomPx: 20,
  resourcePath: "icons/pagesaver_qr.png",
};

// Control whether a source link section is added to PDFs
// - enabledForPDF controls normal PDF captures
// - enabledForReaderPDF controls Reader Mode PDFs
// Default: disabled for both
const PageSaverSourceSection = {
  enabledForPDF: false,
  enabledForReaderPDF: false,
};

// Control single-page PDF behavior and fallback
const SinglePagePDFConfig = {
  enableAutoFallback: true, // Default: no fallback to multi-page
  maxHeightPoints: 14400,    // jsPDF limit in points
};

// Configuration for capture settings
const CaptureConfig = {
  PDF: {
    width: 210, // A4 width in mm
    height: 297, // A4 height in mm
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  },
  CAPTURE: {
    maxCaptures: 200,
    minOverlap: 50,
    scrollDelay: 200,
    firstCaptureDelay: 500,
    elementHideDelay: 50,
    rateLimitDelay: 300,
    captureTimeout: 10000,
  },
  CANVAS: {
    maxSize: 65000,
    maxDPR: 3,
  },
};

// ========== LIBRARY LOADING ==========
async function loadLibraries() {
  try {
    // Load html2canvas-pro instead of html2canvas
    await import(chrome.runtime.getURL("html2canvas-pro.min.js"));
    if (typeof html2canvas !== "function") {
      throw new Error("html2canvas-pro not available after loading");
    }

    // Load jsPDF
    await import(chrome.runtime.getURL("jspdf.umd.min.js"));
    if (typeof window.jspdf === "undefined") {
      throw new Error("jsPDF not available after loading");
    }

    // Load Readability - it's loaded via script tag since it's not an ES module
    await import(chrome.runtime.getURL("Readability.js"));
    if (typeof window.Readability === "undefined") {
      throw new Error("Readability not available after loading");
    }

    // Load turndown.js
    await import(chrome.runtime.getURL("turndown.js"));
    if (typeof window.TurndownService === "undefined") {
      throw new Error("TurndownService not available after loading");
    }

    return {
      html2canvas,
      jsPDF: window.jspdf.jsPDF,
      Readability: window.Readability,
      TurndownService: window.TurndownService,
    };
  } catch (error) {
    console.error("Error loading libraries:", error);
    throw error;
  }
}

// Helper function to check if we're in development mode
function isDevMode() {
  return !("update_url" in chrome.runtime.getManifest());
}

// Function to load image with CORS handling
async function loadImageWithCORS(imageUrl) {
  console.log("Attempting to load image with CORS handling:", imageUrl);

  // List of CORS proxies to try - use local proxy for dev mode
  const corsProxies = isDevMode()
    ? [
        "http://pixelstech.localhost/backstage/application/pagesaver/cors.php?url=",
      ]
    : [
        "https://corsproxy.io/?",
        "https://cors-anywhere.herokuapp.com/",
        "https://www.pixelstech.net/backstage/application/pagesaver/cors.php?url=",
      ];

  // Try direct loading first
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Image loading timed out")),
        5000
      );
      img.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Failed to load image directly"));
      };
      img.src = imageUrl;
    });
    console.log("Direct image load successful");
    return img;
  } catch (directError) {
    console.log("Direct image load failed, trying proxies...");

    // Try each proxy in sequence
    for (const proxy of corsProxies) {
      try {
        const proxyUrl = proxy + encodeURIComponent(imageUrl);
        console.log("Trying proxy:", proxy);

        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("Proxy image loading timed out")),
            5000
          );
          img.onload = () => {
            clearTimeout(timeout);
            resolve();
          };
          img.onerror = () => {
            clearTimeout(timeout);
            reject(new Error(`Failed to load image through proxy: ${proxy}`));
          };
          img.src = proxyUrl;
        });
        console.log("Proxy image load successful with:", proxy);
        return img;
      } catch (proxyError) {
        console.log("Proxy failed:", proxy, proxyError.message);
        continue;
      }
    }

    // If all proxies fail, try fetching through background script
    try {
      console.log("All proxies failed, trying background fetch...");
      const response = await chrome.runtime.sendMessage({
        action: "fetchImage",
        url: imageUrl,
      });

      if (response.success && response.data) {
        const img = new Image();
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("Background fetch image loading timed out")),
            5000
          );
          img.onload = () => {
            clearTimeout(timeout);
            resolve();
          };
          img.onerror = () => {
            clearTimeout(timeout);
            reject(new Error("Failed to load image from background fetch"));
          };
          img.src = response.data;
        });
        console.log("Background fetch successful");
        return img;
      }
    } catch (backgroundError) {
      console.log("Background fetch failed:", backgroundError.message);
    }

    // If all methods fail, throw error
    throw new Error("All image loading methods failed");
  }
}

// Function to extract text from image
async function extractTextFromImage(imageUrl) {
  console.log("Starting text extraction from image:", imageUrl);

  try {
    // Create loading overlay
    const {
      overlay,
      message,
      progress,
      progressBar,
      statusText,
      removeOverlay,
    } = setupExtractionUI();

    try {
      statusText.textContent = "Loading image...";
      console.log("Loading image for preprocessing...");

      // Try to load and process image locally first
      try {
        statusText.textContent = "Loading image...";
        progressBar.style.width = "40%";

        const img = await loadImageWithCORS(imageUrl);

        // Create canvas and draw image
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        // Get image data URL
        const imageData = canvas.toDataURL("image/png");

        // Perform OCR with image data
        statusText.textContent = "Image loaded. Starting OCR...";
        progressBar.style.width = "70%";

        const result = await performServerSideOCR(imageData);

        statusText.textContent = "OCR completed. Post-processing...";
        progressBar.style.width = "90%";

        if (result && result.trim().length > 0) {
          const processedText = postprocessOcrText(result);
          displayExtractedText(processedText, 90);
          return processedText;
        }
      } catch (localError) {
        console.log(
          "Local image processing failed, trying direct URL OCR:",
          localError
        );
        statusText.textContent = "Trying alternative OCR method...";
        progressBar.style.width = "70%";

        // Fallback to direct URL OCR
        const result = await performServerSideOCR(imageUrl);

        statusText.textContent = "OCR completed. Post-processing...";
        progressBar.style.width = "90%";

        if (result && result.trim().length > 0) {
          const processedText = postprocessOcrText(result);
          displayExtractedText(processedText, 90);
          return processedText;
        }
      }

      // If we get here, no text was found
      showNoTextFoundMessage();
      return "";
    } finally {
      // Always remove the overlay
      removeOverlay();
    }
  } catch (error) {
    console.error("Error in text extraction:", error);
    showExtractionErrorMessage(error);
    throw error;
  }
}

// Set up the extraction UI elements
function setupExtractionUI() {
  // Create a loading overlay
  const overlay = document.createElement("div");
  overlay.className = "pagesaver-loading-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  const message = document.createElement("div");
  message.textContent = "Extracting text from image...";
  message.style.cssText = `
    font-size: 18px;
    margin-bottom: 20px;
  `;

  const progress = document.createElement("div");
  progress.style.cssText = `
    width: 300px;
    height: 10px;
    background: #444;
    border-radius: 5px;
    overflow: hidden;
  `;

  const progressBar = document.createElement("div");
  progressBar.style.cssText = `
    width: 0%;
    height: 100%;
    background: #4CAF50;
    transition: width 0.3s;
  `;

  const statusText = document.createElement("div");
  statusText.style.cssText = `
    font-size: 14px;
    margin-top: 10px;
    color: #ccc;
  `;
  statusText.textContent = "Initializing...";

  progress.appendChild(progressBar);
  overlay.appendChild(message);
  overlay.appendChild(progress);
  overlay.appendChild(statusText);

  // Remove any existing loading overlays first
  const existingOverlays = document.querySelectorAll(
    ".pagesaver-loading-overlay"
  );
  existingOverlays.forEach((existingOverlay) => {
    if (document.body.contains(existingOverlay)) {
      document.body.removeChild(existingOverlay);
    }
  });

  document.body.appendChild(overlay);

  // Function to safely remove the overlay
  const removeOverlay = () => {
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
    }
  };

  return { overlay, message, progress, progressBar, statusText, removeOverlay };
}

// Post-process OCR text to clean it up
function postprocessOcrText(text) {
  if (!text) return "";

  // Function to clean up OCR noise characters
  const cleanupOcrNoise = (text) => {
    if (!text) return "";

    // Step 1: Remove isolated special characters that are likely noise
    let cleaned = text.replace(
      /(?<=\s|^)[\^~`|•¦+*_\\\/\[\]{}()<>]+(?=\s|$)/g,
      " "
    );

    // Step 2: Remove repeated punctuation (more than 2 of the same character)
    cleaned = cleaned.replace(/([.,:;!?#@$%&=\-])\1{2,}/g, "$1");

    // Step 3: Remove non-printable characters and control characters
    cleaned = cleaned.replace(/[\x00-\x1F\x7F-\x9F]/g, "");

    // Step 4: Fix common OCR errors
    cleaned = cleaned.replace(/l\s*\|\s*l/g, "II"); // Fix "l|l" to "II"
    cleaned = cleaned.replace(/l\s*\|\s*i/g, "li"); // Fix "l|i" to "li"
    cleaned = cleaned.replace(/i\s*\|\s*i/g, "ii"); // Fix "i|i" to "ii"
    cleaned = cleaned.replace(/\|\s*\|/g, "||"); // Fix "| |" to "||"

    // Step 5: Fix common OCR substitutions
    cleaned = cleaned.replace(/0(?=[A-Za-z])/g, "O"); // Fix "0" to "O" when followed by a letter
    cleaned = cleaned.replace(/(?<=[A-Za-z])0/g, "o"); // Fix "0" to "o" when preceded by a letter
    cleaned = cleaned.replace(/1(?=[A-Za-z])/g, "I"); // Fix "1" to "I" when followed by a letter
    cleaned = cleaned.replace(/(?<=[A-Za-z])1/g, "l"); // Fix "1" to "l" when preceded by a letter
    cleaned = cleaned.replace(/5(?=[A-Za-z])/g, "S"); // Fix "5" to "S" when followed by a letter
    cleaned = cleaned.replace(/(?<=[A-Za-z])5/g, "s"); // Fix "5" to "s" when preceded by a letter

    // Step 6: Remove random symbols that often appear in OCR errors
    cleaned = cleaned.replace(/[¢£¥§©®°±²³µ¶·¹º¼½¾¿]/g, "");

    // Step 7: Fix spacing around punctuation
    cleaned = cleaned.replace(/\s+([.,;:!?)])/g, "$1"); // Remove space before punctuation
    cleaned = cleaned.replace(/([([{])\s+/g, "$1"); // Remove space after opening brackets

    return cleaned;
  };

  // Apply noise cleanup
  let extractedText = cleanupOcrNoise(text);

  // Detect if the text is primarily Chinese
  const chineseCharCount = (extractedText.match(/[\u4e00-\u9fa5]/g) || [])
    .length;
  const totalCharCount = extractedText.length;
  const isChineseText = chineseCharCount > totalCharCount * 0.3; // If more than 30% is Chinese

  console.log(
    `Text analysis: ${chineseCharCount} Chinese characters out of ${totalCharCount} total (${Math.round(
      (chineseCharCount / totalCharCount) * 100
    )}%)`
  );

  // First, properly normalize all line breaks - crucial step
  extractedText = extractedText.replace(/\r\n|\r/g, "\n");

  // Preserve existing paragraph structure by marking paragraphs
  const paragraphs = extractedText.split(/\n\s*\n+/);

  if (isChineseText) {
    console.log(
      "Detected primarily Chinese text, applying Chinese-specific post-processing"
    );

    // Process each paragraph
    extractedText = paragraphs
      .map((paragraph) => {
        return paragraph
          .replace(/\s+/g, " ") // Replace multiple spaces with a single space
          .replace(/([^\u4e00-\u9fa5]) ([^\u4e00-\u9fa5])/g, "$1$2") // Remove spaces between non-Chinese characters
          .replace(/([^\u4e00-\u9fa5])([^\u4e00-\u9fa5])/g, "$1$2") // Join non-Chinese characters
          .replace(/([^\u4e00-\u9fa5])([\u4e00-\u9fa5])/g, "$1 $2") // Add space between non-Chinese and Chinese
          .replace(/([\u4e00-\u9fa5])([^\u4e00-\u9fa5])/g, "$1 $2") // Add space between Chinese and non-Chinese
          .replace(/\s+/g, " ") // Clean up any double spaces created
          .trim(); // Remove leading/trailing whitespace
      })
      .join("\n\n"); // Join paragraphs with double newlines
  } else {
    // Process each paragraph for non-Chinese text
    extractedText = paragraphs
      .map((paragraph) => {
        // Clean up spaces but preserve intentional line breaks
        const lines = paragraph.split("\n");
        return lines
          .map((line) => {
            return line
              .replace(/\s+/g, " ") // Replace multiple spaces with a single space
              .replace(/^\s+|\s+$/g, "") // Remove leading/trailing whitespace from each line
              .trim();
          })
          .join("\n"); // Join lines with a single newline
      })
      .join("\n\n"); // Join paragraphs with double newlines
  }

  // Improve paragraph structure - be careful not to destroy existing structure
  extractedText = extractedText
    // Try to detect paragraphs that weren't properly separated
    .replace(/([.!?]['"]?)(\s*)([A-Z])/g, "$1\n\n$3")
    // Detect list items and ensure they're on new lines
    .replace(/(?<=\n|^)(\s*[-•*]\s+)/g, "\n$1")
    // Ensure numbered lists have proper line breaks
    .replace(/(?<=\n|^)(\s*\d+\.\s+)/g, "\n$1")
    // Improve spacing around bullets
    .replace(/(?<=[-•*])\s*/g, " ")
    // Remove single line breaks between items that don't look like list items or paragraph starts
    .replace(/(?<=[a-z,;:])\n(?=[a-z])/g, " ")
    // Remove excessive line breaks while preserving paragraph structure
    .replace(/\n{3,}/g, "\n\n")
    // Final trim
    .trim();

  return extractedText;
}

// Display the extracted text in a modal
function displayExtractedText(extractedText, confidence) {
  console.log("Text found, displaying results...");

  // Remove any existing popups first
  const existingPopups = document.querySelectorAll(
    ".pagesaver-popup, .pagesaver-overlay"
  );
  existingPopups.forEach((popup) => {
    if (document.body.contains(popup)) {
      document.body.removeChild(popup);
    }
  });

  // Create a modal to display the extracted text
  const textModal = document.createElement("div");
  textModal.className = "pagesaver-popup";
  textModal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 80%;
    max-height: 80%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-width: 400px;
  `;

  const header = document.createElement("div");
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    border-bottom: 1px solid #eee;
    padding-bottom: 10px;
  `;

  const title = document.createElement("h3");
  title.textContent = "Extracted Text";
  title.style.cssText = `
    margin: 0;
    font-size: 18px;
    color: #333;
  `;

  const closeButton = document.createElement("button");
  closeButton.textContent = "×";
  closeButton.style.cssText = `
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #666;
    transition: color 0.2s;
  `;

  closeButton.onmouseover = () => {
    closeButton.style.color = "#333";
  };

  closeButton.onmouseout = () => {
    closeButton.style.color = "#666";
  };

  // Create a modal overlay
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "pagesaver-overlay";
  modalOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 999998;
    backdrop-filter: blur(2px);
  `;

  closeButton.onclick = () => {
    // Remove both the modal and overlay
    if (document.body.contains(textModal)) document.body.removeChild(textModal);
    if (document.body.contains(modalOverlay))
      document.body.removeChild(modalOverlay);
  };

  modalOverlay.onclick = (e) => {
    if (e.target === modalOverlay) {
      // Remove both the modal and overlay
      if (document.body.contains(textModal))
        document.body.removeChild(textModal);
      if (document.body.contains(modalOverlay))
        document.body.removeChild(modalOverlay);
    }
  };

  header.appendChild(title);
  header.appendChild(closeButton);

  // Create a container for the text content with scrolling
  const textContentContainer = document.createElement("div");
  textContentContainer.style.cssText = `
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 10px;
    margin-right: -10px;
    flex-grow: 1;
    max-height: 60vh;
  `;

  const textContent = document.createElement("pre");
  textContent.style.cssText = `
    white-space: pre-wrap;
    font-size: 14px;
    line-height: 1.6;
    color: #333;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
    background-color: #f9f9f9;
    padding: 12px;
    border-radius: 4px;
    border-left: 3px solid #4CAF50;
    margin: 0;
  `;

  // Preserve original text but ensure consistent newlines
  let normalizedText = extractedText;
  if (extractedText.includes("\\n")) {
    try {
      // This will correctly interpret escape sequences
      normalizedText = JSON.parse(
        '"' + extractedText.replace(/"/g, '\\"') + '"'
      );
    } catch (e) {
      // Fallback to manual replacement
      normalizedText = normalizedText
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\n")
        .replace(/\\t/g, "\t");
    }
  }

  // Create formatted version that respects paragraph structure
  const formattedText = normalizedText
    // Ensure paragraph breaks are preserved exactly
    .replace(/\n\s*\n/g, "\n\n")
    // Remove any more than 2 consecutive newlines
    .replace(/\n{3,}/g, "\n\n")
    // Ensure consistent spacing
    .replace(/[ \t]{2,}/g, " ");

  // Set the initial text content
  textContent.textContent = formattedText;
  textContentContainer.appendChild(textContent);

  // Create button container
  const buttonContainer = document.createElement("div");
  buttonContainer.style.cssText = `
    display: blcok;
    text-align: right;
    margin-top: 15px;
    border-top: 1px solid #eee;
    padding-top: 15px;
  `;

  // Copy button
  const copyButton = document.createElement("button");
  copyButton.textContent = "Copy to Clipboard";
  copyButton.style.cssText = `
    padding: 8px 16px;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
    font-weight: 500;
  `;

  copyButton.onmouseover = () => {
    copyButton.style.background = "#45a049";
  };

  copyButton.onmouseout = () => {
    copyButton.style.background = "#4CAF50";
  };

  copyButton.onclick = () => {
    // Use the original text when copying to preserve all formatting
    navigator.clipboard
      .writeText(extractedText)
      .then(() => {
        copyButton.textContent = "Copied!";
        copyButton.style.background = "#27ae60";
        setTimeout(() => {
          copyButton.textContent = "Copy to Clipboard";
          copyButton.style.background = "#4CAF50";
        }, 2000);
      })
      .catch((err) => {
        console.error("Failed to copy text:", err);
        copyButton.textContent = "Failed to copy";
        copyButton.style.background = "#e74c3c";
      });
  };

  buttonContainer.appendChild(copyButton);

  textModal.appendChild(header);
  textModal.appendChild(textContentContainer);
  textModal.appendChild(buttonContainer);

  document.body.appendChild(modalOverlay);
  document.body.appendChild(textModal);

  // Add keyboard shortcuts for the modal
  const handleKeydown = (e) => {
    if (e.key === "Escape") {
      if (document.body.contains(textModal))
        document.body.removeChild(textModal);
      if (document.body.contains(modalOverlay))
        document.body.removeChild(modalOverlay);
      document.removeEventListener("keydown", handleKeydown);
    } else if (e.key === "c" && (e.ctrlKey || e.metaKey)) {
      copyButton.click();
    } else if (e.key === "f" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault(); // Prevent browser's find dialog
      formatButton.click();
    }
  };

  document.addEventListener("keydown", handleKeydown);
}

// Show message when no text is found
function showNoTextFoundMessage() {
  console.log("No text found in the image");

  // Remove any existing notifications first
  const existingPopups = document.querySelectorAll(
    ".pagesaver-notification, .pagesaver-popup, .pagesaver-overlay"
  );
  existingPopups.forEach((popup) => {
    if (document.body.contains(popup)) {
      document.body.removeChild(popup);
    }
  });

  // Create a toast notification
  const notification = document.createElement("div");
  notification.className = "pagesaver-notification";
  notification.style.cssText = `
    position: fixed;
    bottom: 30px;
    right: 30px;
    background: #323232;
    color: white;
    padding: 16px 24px;
    border-radius: 6px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    align-items: center;
    gap: 12px;
    transform: translateY(100px);
    opacity: 0;
    transition: transform 0.3s ease, opacity 0.3s ease;
    min-width: 250px;
    max-width: 350px;
  `;

  // Add an icon
  const iconDiv = document.createElement("div");
  iconDiv.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  `;
  iconDiv.style.color = "#e74c3c";

  // Message container
  const messageContainer = document.createElement("div");
  messageContainer.style.cssText = `
    flex: 1;
  `;

  // Add a title
  const title = document.createElement("div");
  title.textContent = "No Text Found";
  title.style.cssText = `
    font-weight: 600;
    margin-bottom: 4px;
  `;

  // Add a description
  const description = document.createElement("div");
  description.textContent =
    "No text could be recognized in this image. Try with a clearer image or different settings.";
  description.style.cssText = `
    font-size: 13px;
    opacity: 0.9;
    line-height: 1.4;
  `;

  // Add a close button
  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = "&times;";
  closeBtn.style.cssText = `
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    opacity: 0.7;
    transition: opacity 0.2s;
  `;

  closeBtn.onmouseover = () => {
    closeBtn.style.opacity = "1";
  };

  closeBtn.onmouseout = () => {
    closeBtn.style.opacity = "0.7";
  };

  closeBtn.onclick = () => {
    notification.style.opacity = "0";
    notification.style.transform = "translateY(100px)";
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 300);
  };

  // Add a retry button
  const retryBtn = document.createElement("button");
  retryBtn.textContent = "Try Again";
  retryBtn.style.cssText = `
    background: #4CAF50;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    margin-top: 10px;
    cursor: pointer;
    font-size: 12px;
    transition: background 0.2s;
  `;

  retryBtn.onmouseover = () => {
    retryBtn.style.background = "#45a049";
  };

  retryBtn.onmouseout = () => {
    retryBtn.style.background = "#4CAF50";
  };

  retryBtn.onclick = () => {
    // Simulate triggering the extraction again - you might want to adapt this
    // to your specific needs
    notification.style.opacity = "0";
    notification.style.transform = "translateY(100px)";
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
      // Here you would typically re-trigger the extraction
      // This is a placeholder - replace with actual retry logic
      console.log("Retry extraction requested");
    }, 300);
  };

  // Assemble the notification
  messageContainer.appendChild(title);
  messageContainer.appendChild(description);
  messageContainer.appendChild(retryBtn);

  notification.appendChild(iconDiv);
  notification.appendChild(messageContainer);
  notification.appendChild(closeBtn);

  document.body.appendChild(notification);

  // Animation for smooth appearance
  setTimeout(() => {
    notification.style.transform = "translateY(0)";
    notification.style.opacity = "1";
  }, 10);

  // Auto-remove after 6 seconds
  const autoRemoveTimeout = setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transform = "translateY(100px)";
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 5000);

  // Clear the auto-remove timeout if the user interacts with the notification
  notification.addEventListener("mouseenter", () => {
    clearTimeout(autoRemoveTimeout);
  });
}

// Show error message
function showExtractionErrorMessage(error) {
  // Remove any existing notifications first
  const existingPopups = document.querySelectorAll(
    ".pagesaver-notification, .pagesaver-popup, .pagesaver-overlay"
  );
  existingPopups.forEach((popup) => {
    if (document.body.contains(popup)) {
      document.body.removeChild(popup);
    }
  });

  // Format the error message
  let errorMessage = error && error.message ? error.message : String(error);

  // Check for specific known problematic URLs
  const errorString = String(error);
  if (
    errorString.includes("digitaloceanspaces.com") ||
    errorString.includes("sgp1.cdn.digitaloceanspaces.com") ||
    errorString.includes("jianhua.sgp1.cdn.digitaloceanspaces.com")
  ) {
    errorMessage =
      "This image is hosted on DigitalOcean Spaces which has CORS restrictions. The extension has attempted multiple approaches to access it.";
  }
  // Simplify error messages for better user experience
  else if (errorMessage.includes("Failed to fetch")) {
    errorMessage =
      "Network error: The OCR service could not be reached. Check your connection.";
  } else if (errorMessage.includes("timeout")) {
    errorMessage =
      "The operation timed out. The image might be too complex or your connection too slow.";
  } else if (errorMessage.includes("permission")) {
    errorMessage =
      "Permission denied. The extension needs permission to process this image.";
  } else if (errorMessage.length > 120) {
    // Truncate long error messages
    errorMessage = errorMessage.substring(0, 120) + "...";
  }

  // Create a toast notification
  const notification = document.createElement("div");
  notification.className = "pagesaver-notification";
  notification.style.cssText = `
    position: fixed;
    bottom: 30px;
    right: 30px;
    background: #323232;
    color: white;
    padding: 16px 24px;
    border-radius: 6px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    align-items: center;
    gap: 12px;
    transform: translateY(100px);
    opacity: 0;
    transition: transform 0.3s ease, opacity 0.3s ease;
    min-width: 280px;
    max-width: 400px;
  `;

  // Add an icon
  const iconDiv = document.createElement("div");
  iconDiv.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="15" y1="9" x2="9" y2="15"></line>
      <line x1="9" y1="9" x2="15" y2="15"></line>
    </svg>
  `;
  iconDiv.style.color = "#e74c3c";

  // Message container
  const messageContainer = document.createElement("div");
  messageContainer.style.cssText = `
    flex: 1;
  `;

  // Add a title
  const title = document.createElement("div");
  title.textContent = "Extraction Failed";
  title.style.cssText = `
    font-weight: 600;
    margin-bottom: 4px;
  `;

  // Add a description
  const description = document.createElement("div");
  description.textContent = errorMessage;
  description.style.cssText = `
    font-size: 13px;
    opacity: 0.9;
    line-height: 1.4;
    word-break: break-word;
  `;

  // Add technical details that can be expanded
  const technicalDetails = document.createElement("details");
  technicalDetails.style.cssText = `
    margin-top: 8px;
    font-size: 12px;
    opacity: 0.8;
  `;

  const summary = document.createElement("summary");
  summary.textContent = "Technical details";
  summary.style.cssText = `
    cursor: pointer;
    user-select: none;
  `;

  const detailsPre = document.createElement("pre");
  detailsPre.textContent = error && error.stack ? error.stack : String(error);
  detailsPre.style.cssText = `
    margin: 8px 0 0;
    padding: 8px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    overflow-x: auto;
    max-height: 100px;
    font-family: monospace;
    white-space: pre-wrap;
    font-size: 11px;
  `;

  technicalDetails.appendChild(summary);
  technicalDetails.appendChild(detailsPre);

  // Add a close button
  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = "&times;";
  closeBtn.style.cssText = `
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    opacity: 0.7;
    transition: opacity 0.2s;
  `;

  closeBtn.onmouseover = () => {
    closeBtn.style.opacity = "1";
  };

  closeBtn.onmouseout = () => {
    closeBtn.style.opacity = "0.7";
  };

  closeBtn.onclick = () => {
    notification.style.opacity = "0";
    notification.style.transform = "translateY(100px)";
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 300);
  };

  // Assemble the notification
  messageContainer.appendChild(title);
  messageContainer.appendChild(description);
  messageContainer.appendChild(technicalDetails);

  notification.appendChild(iconDiv);
  notification.appendChild(messageContainer);
  notification.appendChild(closeBtn);

  document.body.appendChild(notification);

  // Animation for smooth appearance
  setTimeout(() => {
    notification.style.transform = "translateY(0)";
    notification.style.opacity = "1";
  }, 10);

  // Auto-remove after 8 seconds
  const autoRemoveTimeout = setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transform = "translateY(100px)";
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 8000);

  // Clear the auto-remove timeout if the user interacts with the notification
  notification.addEventListener("mouseenter", () => {
    clearTimeout(autoRemoveTimeout);
  });
}

// Separated server-side OCR function
async function performServerSideOCR(imageInput) {
  try {
    // Determine server URL based on environment
    let serverUrl =
      "https://www.pixelstech.net/backstage/application/pagesaver/ocr.php";

    // For local testing, use localhost
    if (isDevMode()) {
      serverUrl =
        "http://pixelstech.localhost/backstage/application/pagesaver/ocr.php";
      console.log("Using local server URL for development:", serverUrl);
    }

    // Check if imageInput is a URL or data URL
    const isDataUrl = imageInput.startsWith("data:");
    const formData = new FormData();

    if (isDataUrl) {
      // Handle data URL by converting to blob
      try {
        const response = await fetch(imageInput);
        const imageBlob = await response.blob();

        if (imageBlob.size === 0) {
          throw new Error(
            "The image has zero size. Please try again with a valid image."
          );
        }

        formData.append("image", imageBlob, "image.png");
      } catch (error) {
        console.error("Error processing data URL:", error);
        throw error;
      }
    } else {
      // Direct URL processing - send the URL to the server
      formData.append("image_url", imageInput);
    }

    // Add current page URL
    formData.append("url", window.location.href);

    // Send to server for OCR processing
    const response = await fetch(serverUrl, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    // Check if the request was successful
    if (!response.ok) {
      throw new Error(
        `Server returned ${response.status}: ${response.statusText}`
      );
    }

    // Get raw response first for debugging
    const rawResponse = await response.text();
    console.log("Raw server response:", rawResponse);

    // Try to parse as JSON
    let result;
    try {
      result = JSON.parse(rawResponse);
    } catch (parseError) {
      console.error("Failed to parse server response as JSON:", parseError);
      throw new Error("Server returned invalid JSON response");
    }

    // Check if the OCR was successful
    if (result && result.success) {
      console.log("Server-side OCR successful");
      return result.text;
    } else {
      handleNotOKOCRResult(result);
      return "";
    }
  } catch (error) {
    console.error("Server-side OCR failed:", error);
    throw error;
  }
}

function handleNotOKOCRResult(result) {
  if (result) {
    const isInDevMode = isDevMode();
    const loginBaseUrl = isInDevMode
      ? "http://pixelstech.localhost"
      : "https://www.pixelstech.net";
    let targetUrl = "";
    if (result.text == "not_logged_in") {
      // Determine login URL based on dev mode
      targetUrl = `${loginBaseUrl}/login.php`;

      // Open login page in a new tab
      console.log(`Opening login page: ${targetUrl}`);
    } else if (result.text == "not_allowed") {
      targetUrl = `${loginBaseUrl}/application/pagesaver/pricing.php`;

      // Open login page in a new tab
      console.log(`Opening pricing page: ${targetUrl}`);
    } else if (result.text == "not_applicable") {
      targetUrl = `${loginBaseUrl}/application/pagesaver/`;

      console.log("Not applicable");
    }
    chrome.runtime.sendMessage({
      action: "openTab",
      url: targetUrl,
    });
  }
}

// ========== PDF GENERATION PROGRESS INDICATOR ==========

function createPDFProgressIndicator() {
  // Remove any existing indicators
  const existing = document.getElementById("pagesaver-pdf-progress");
  if (existing) existing.remove();

  // Create progress indicator container
  const progressContainer = document.createElement("div");
  progressContainer.id = "pagesaver-pdf-progress";
  progressContainer.className = "pagesaver-pdf-progress";
  progressContainer.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 16px 20px;
    border-radius: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 999999;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    min-width: 280px;
    transform: translateX(320px);
    transition: transform 0.3s ease;
    pointer-events: none;
  `;

  // Create header with icon
  const header = document.createElement("div");
  header.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    font-weight: 600;
  `;

  const icon = document.createElement("div");
  icon.innerHTML = "📄";
  icon.style.cssText = `
    font-size: 18px;
    animation: pulse 2s infinite;
  `;

  const title = document.createElement("div");
  title.textContent = "Generating PDF...";
  title.style.cssText = `
    flex: 1;
    font-size: 16px;
  `;

  header.appendChild(icon);
  header.appendChild(title);

  // Create progress bar container
  const progressBarContainer = document.createElement("div");
  progressBarContainer.style.cssText = `
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 10px;
  `;

  // Create progress bar
  const progressBar = document.createElement("div");
  progressBar.style.cssText = `
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, #4CAF50, #45a049);
    border-radius: 3px;
    transition: width 0.3s ease;
    position: relative;
    overflow: hidden;
  `;

  // Add animated shine effect
  const shine = document.createElement("div");
  shine.style.cssText = `
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
    animation: shine 2s infinite;
  `;
  progressBar.appendChild(shine);
  progressBarContainer.appendChild(progressBar);

  // Create status text
  const statusText = document.createElement("div");
  statusText.style.cssText = `
    font-size: 12px;
    color: rgba(255, 255, 255, 0.8);
    line-height: 1.4;
  `;
  statusText.textContent = "Initializing...";

  // Create estimated time
  const timeEstimate = document.createElement("div");
  timeEstimate.style.cssText = `
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
    margin-top: 4px;
  `;

  // Add CSS animations
  const style = document.createElement("style");
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
    @keyframes shine {
      0% { left: -100%; }
      100% { left: 100%; }
    }
    .pagesaver-pdf-progress.show {
      transform: translateX(0) !important;
    }
    .pagesaver-pdf-progress.hide {
      transform: translateX(320px) !important;
    }
  `;
  document.head.appendChild(style);

  // Assemble the indicator
  progressContainer.appendChild(header);
  progressContainer.appendChild(progressBarContainer);
  progressContainer.appendChild(statusText);
  progressContainer.appendChild(timeEstimate);

  document.body.appendChild(progressContainer);

  // Track start time for estimates
  const startTime = Date.now();

  // Show the indicator with animation
  setTimeout(() => {
    progressContainer.classList.add("show");
  }, 100);

  // Return control functions
  return {
    setProgress: (percent, status = null) => {
      progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
      if (status) {
        statusText.textContent = status;
      }

      // Update time estimate
      if (percent > 5) {
        const elapsed = Date.now() - startTime;
        const estimated = (elapsed / percent) * (100 - percent);
        if (estimated > 1000) {
          timeEstimate.textContent = `Est. ${Math.ceil(
            estimated / 1000
          )}s remaining`;
        }
      }
    },

    setStatus: (status) => {
      statusText.textContent = status;
    },

    setTitle: (newTitle) => {
      title.textContent = newTitle;
    },

    hide: () => {
      progressContainer.classList.remove("show");
      progressContainer.classList.add("hide");
      // Also set display none to ensure it's not captured in screenshots
      progressContainer.style.display = "none";
    },

    show: () => {
      progressContainer.classList.remove("hide");
      progressContainer.classList.add("show");
      // Restore display when showing
      progressContainer.style.display = "";
    },

    remove: () => {
      progressContainer.classList.add("hide");
      setTimeout(() => {
        if (progressContainer.parentNode) {
          progressContainer.parentNode.removeChild(progressContainer);
        }
        if (style.parentNode) {
          style.parentNode.removeChild(style);
        }
      }, 300);
    },

    complete: (message = "PDF generated successfully!") => {
      progressBar.style.width = "100%";
      statusText.textContent = message;
      timeEstimate.textContent = "";
      icon.innerHTML = "✅";

      // Auto-remove after showing completion
      setTimeout(() => {
        progressContainer.classList.add("hide");
        setTimeout(() => {
          if (progressContainer.parentNode) {
            progressContainer.parentNode.removeChild(progressContainer);
          }
          if (style.parentNode) {
            style.parentNode.removeChild(style);
          }
        }, 300);
      }, 2000);
    },

    error: (message = "PDF generation failed") => {
      progressBar.style.background = "linear-gradient(90deg, #f44336, #d32f2f)";
      progressBar.style.width = "100%";
      statusText.textContent = message;
      timeEstimate.textContent = "";
      icon.innerHTML = "❌";

      // Auto-remove after showing error
      setTimeout(() => {
        progressContainer.classList.add("hide");
        setTimeout(() => {
          if (progressContainer.parentNode) {
            progressContainer.parentNode.removeChild(progressContainer);
          }
          if (style.parentNode) {
            style.parentNode.removeChild(style);
          }
        }, 300);
      }, 3000);
    },
  };
}

// Function to detect if current page is a Feishu document
function isFeishuDocument(docClone) {
  return Boolean(
    docClone.querySelector('title[content*="Feishu"]') ||
    window.location.href.includes("feishu.cn") ||
    window.location.href.includes("larksuite.com") ||
    docClone.querySelector('[data-slate-editor="true"]') ||
    docClone.querySelector('.note-editor-text') ||
    docClone.querySelector('[data-block-type]')
  );
}

// Function to detect if current page is a chat interface
function isChatInterface(docClone) {
  return Boolean(
    docClone.querySelector(
      '.chat-container, [class*="conversation-container"], [class*="chat-content"], [class*="markdown"]'
    ) &&
      (window.location.href.includes("chat.openai.com") ||
        window.location.href.includes("chatgpt.com"))
  );
}

// Function to convert Feishu documents to reader mode
async function convertFeishuToReaderMode(docClone) {
  console.log("Feishu document detected, using specialized extraction...");
  console.log("URL:", window.location.href);
  console.log("Has data-block-type elements:", docClone.querySelectorAll('[data-block-type]').length);
  
  // For Feishu documents, we need to handle dynamic content loading
  const feishuContent = await extractFeishuDocContentWithDynamicLoading(docClone);
  
  console.log("Extraction result:", {
    title: feishuContent.title,
    author: feishuContent.author,
    contentLength: feishuContent.content ? feishuContent.content.length : 0
  });
  
  if (!feishuContent.content) {
    return null;
  }
  
  // Create a new document for the Feishu content
  const readerDoc = document.implementation.createHTMLDocument(feishuContent.title);
  
  // Add reader mode styles
  const style = readerDoc.createElement("style");
  style.textContent = `
    @page {
      margin: 20mm;
      size: A4;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 170mm;
      margin: 0 auto;
      padding: 0;
      background: white;
      color: #333;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .article-header {
      margin-bottom: 1.5em;
      border-bottom: 1px solid #eee;
      padding-bottom: 1em;
    }
    .article-title {
      font-size: 2em;
      font-weight: 600;
      margin-top: 0;
      margin-bottom: 0.3em;
      color: #1a1a1a;
    }
    .article-author {
      font-size: 1.1em;
      color: #666;
      margin-bottom: 0.5em;
    }
    .article-content {
      font-size: 1.1em;
      line-height: 1.8;
    }
    .article-content p {
      margin: 1.2em 0;
    }
    
    /* Heading styles */
    h1, h2, h3, h4, h5, h6 {
      font-weight: 600;
      margin: 1.5em 0 0.8em 0;
      color: #1a1a1a;
      page-break-after: avoid;
      page-break-inside: avoid;
    }
    h1 {
      font-size: 2em;
      margin-top: 2em;
    }
    h2 {
      font-size: 1.6em;
      margin-top: 1.8em;
    }
    h3 {
      font-size: 1.4em;
      margin-top: 1.6em;
    }
    h4 {
      font-size: 1.2em;
      margin-top: 1.4em;
    }
    h5 {
      font-size: 1.1em;
      margin-top: 1.2em;
    }
    h6 {
      font-size: 1em;
      margin-top: 1em;
      color: #666;
    }
    
    /* List styles */
    ul, ol {
      margin: 1.2em 0;
      padding-left: 1.8em;
    }
    li {
      margin: 0.4em 0;
      line-height: 1.6;
      display: list-item;
      position: relative;
    }
    ul li {
      list-style-type: disc;
      list-style-position: outside;
      padding-left: 0.2em;
    }
    ol li {
      list-style-type: decimal;
      list-style-position: outside;
      padding-left: 0.2em;
    }
    ul li::marker {
      font-size: 0.9em;
      line-height: 1.6;
    }
    ol li::marker {
      font-size: 0.9em;
      line-height: 1.6;
    }
    
    /* Quote styles */
    blockquote {
      margin: 1.5em 0;
      padding: 1em 1.5em;
      border-left: 4px solid #ddd;
      background: #f9f9f9;
      font-style: italic;
      color: #666;
    }
    
    /* Code styles */
    pre, code {
      font-family: 'Consolas', 'Monaco', 'Courier New', Courier, monospace;
      background: #f5f5f5;
      border-radius: 4px;
      font-size: 0.9em;
      margin: 1em 0;
      padding: 1em;
      overflow-x: auto;
      white-space: pre-wrap !important;
      word-wrap: break-word;
      tab-size: 2;
      -moz-tab-size: 2;
      page-break-inside: avoid;
    }
    code {
      padding: 0.2em 0.4em;
      margin: 0;
      background: #f0f0f0;
      border-radius: 3px;
      font-size: 0.85em;
    }
    pre code {
      background: none;
      padding: 0;
      margin: 0;
    }
    
    /* Callout styles */
    .callout {
      margin: 1.5em 0;
      padding: 1em 1.5em;
      border-radius: 6px;
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      font-weight: 500;
    }
    
    /* Divider styles */
    hr {
      margin: 2em 0;
      border: none;
      border-top: 1px solid #ddd;
      height: 1px;
    }
    
    /* Table styles */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5em 0;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 0.8em;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f5f5f5;
      font-weight: 600;
    }
    
    /* Image styles */
    img {
      max-width: 170mm !important;
      width: auto !important;
      height: auto !important;
      page-break-inside: avoid !important;
      box-sizing: border-box !important;
      display: block !important;
      margin: 1em auto !important;
      border-radius: 4px;
    }
    
    /* General layout */
    div, section, article, figure {
      max-width: 100% !important;
      overflow-x: hidden !important;
    }
  `;
  readerDoc.head.appendChild(style);

  // Create the article structure
  const articleHeader = readerDoc.createElement("div");
  articleHeader.className = "article-header";
  
  const titleElement = readerDoc.createElement("h1");
  titleElement.className = "article-title";
  titleElement.textContent = feishuContent.title;
  articleHeader.appendChild(titleElement);
  
  if (feishuContent.author) {
    const authorElement = readerDoc.createElement("div");
    authorElement.className = "article-author";
    authorElement.textContent = "By " + feishuContent.author;
    articleHeader.appendChild(authorElement);
  }
  
  const contentElement = readerDoc.createElement("div");
  contentElement.className = "article-content";
  
  // Process content with proper HTML structure
  contentElement.innerHTML = feishuContent.content;
  
  readerDoc.body.appendChild(articleHeader);
  readerDoc.body.appendChild(contentElement);
  
  return readerDoc;
}

// Function to convert chat interfaces to reader mode
function convertChatToReaderMode(docClone) {
  console.log("Chat interface detected, using custom extraction...");

  // Create a new document for the chat content
  const readerDoc = document.implementation.createHTMLDocument("Chat Conversation");

  // Add reader mode styles with chat-specific additions
  const style = readerDoc.createElement("style");
  style.textContent = `
    @page {
      margin: 20mm;
      size: A4;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 170mm;
      margin: 0 auto;
      padding: 0;
      background: white;
      color: #333;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .conversation {
      padding: 2em 0;
    }
    .message {
      padding: 1.5em 0;
      border-bottom: 1px solid #eee;
      page-break-inside: avoid;
    }
    .message:last-child {
      border-bottom: none;
    }
    .message-role {
      font-weight: 600;
      color: #444;
      margin-bottom: 0.5em;
    }
    .message-content {
      white-space: pre-wrap;
      overflow-wrap: break-word;
    }
    pre, code {
      font-family: 'Consolas', 'Monaco', 'Courier New', Courier, monospace;
      background: #f5f5f5;
      border-radius: 4px;
      font-size: 0.9em;
      margin: 1em 0;
      padding: 1em;
      overflow-x: auto;
      white-space: pre-wrap !important;
      word-wrap: break-word;
      tab-size: 2;
      -moz-tab-size: 2;
      page-break-inside: avoid;
    }
    pre code {
      background: none;
      padding: 0;
      margin: 0;
    }
    p {
      margin: 0.8em 0;
    }
    img {
      max-width: 170mm !important;
      width: auto !important;
      height: auto !important;
      page-break-inside: avoid !important;
      box-sizing: border-box !important;
      display: block !important;
      margin: 0 auto !important;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 0.5em;
      text-align: left;
    }
    th {
      background: #f5f5f5;
    }
    div, section, article, figure {
      max-width: 100% !important;
      overflow-x: hidden !important;
    }
  `;
  readerDoc.head.appendChild(style);

  // Create container for the conversation
  const conversationContainer = readerDoc.createElement("div");
  conversationContainer.className = "conversation";

  // Find all chat messages
  const messageSelectors = [
    '[class*="message"]',
    '[class*="chat-message"]',
    '[class*="conversation-message"]',
    "[data-message-author-role]",
    '[class*="markdown"]',
  ];

  const messages = docClone.querySelectorAll(messageSelectors.join(","));

  messages.forEach((message) => {
    // Create message container
    const messageDiv = readerDoc.createElement("div");
    messageDiv.className = "message";

    // Determine message role
    let role = "Message";
    if (
      message.matches('[data-message-author-role="assistant"]') ||
      message.classList.contains("assistant") ||
      message.querySelector('[class*="assistant"]')
    ) {
      role = "Assistant";
    } else if (
      message.matches('[data-message-author-role="user"]') ||
      message.classList.contains("user") ||
      message.querySelector('[class*="user"]')
    ) {
      role = "User";
    }

    // Add role header
    const roleDiv = readerDoc.createElement("div");
    roleDiv.className = "message-role";
    roleDiv.textContent = role;
    messageDiv.appendChild(roleDiv);

    // Add message content
    const contentDiv = readerDoc.createElement("div");
    contentDiv.className = "message-content";

    // Clone the message content
    const contentClone = message.cloneNode(true);

    // Process code blocks
    contentClone.querySelectorAll("pre, code").forEach((element) => {
      element.style.whiteSpace = "pre-wrap";
    });

    // Clean up the content
    const cleanContent = sanitizeContent(contentClone);
    contentDiv.innerHTML = cleanContent;

    messageDiv.appendChild(contentDiv);
    conversationContainer.appendChild(messageDiv);
  });

  // Add the conversation to the document
  readerDoc.body.appendChild(conversationContainer);

  return readerDoc;
}

// Function to convert general documents to reader mode
function convertGeneralToReaderMode(docClone) {
  // Pre-process code blocks
  docClone.querySelectorAll("pre, code").forEach((element) => {
    element.style.whiteSpace = "pre-wrap";
    element.setAttribute("data-preserve-format", "true");
  });

  // Remove all anchor links and their children
  docClone.querySelectorAll("a").forEach((link) => {
    if (
      link.getAttribute("href")?.startsWith("#") ||
      (link.hash &&
        link.origin === window.location.origin &&
        link.pathname === window.location.pathname) ||
      link.textContent.trim().match(/^Link to.*/i)
    ) {
      link.remove();
    }
  });

  // Create a new Readability object
  const reader = new window.Readability(docClone, {
    keepClasses: true,
    classesToPreserve: ["language-*", "hljs", "highlight"],
    charThreshold: 20,
  });

  // Parse the content
  const article = reader.parse();
  if (!article || !article.content) {
    console.log("Readability parsing failed, trying alternative extraction");
    return null;
  }

  // remove width and height properties for img tags if there is, article.content is a string
  article.content = article.content.replace(
    /<img([^>]*)(?:width|height)=['"][^'"]*['"]([^>]*)>/gi,
    "<img$1$2>"
  );
  article.content = article.content.replace(
    /<img([^>]*)(?:width|height)=['"][^'"]*['"]([^>]*)>/gi,
    "<img$1$2>"
  );
  // Also remove inline style width/height
  article.content = article.content.replace(
    /<img([^>]*)style=['"][^'"]*(?:width|height)[^'"]*['"]([^>]*)>/gi,
    function (match, before, after) {
      const styleAttr = match.match(/style=['"]([^'"]*)['"]/);
      if (styleAttr && styleAttr[1]) {
        const newStyle = styleAttr[1]
          .replace(/width\s*:\s*[^;]+;?/gi, "")
          .replace(/height\s*:\s*[^;]+;?/gi, "")
          .replace(/\s+/g, " ")
          .trim();

        if (newStyle) {
          return `<img${before}style="${newStyle}"${after}>`;
        } else {
          // Remove style attribute entirely if it's empty
          return `<img${before}${after}>`;
        }
      }
      return match;
    }
  );

  // Create reader document with the article content
  const readerDoc = document.implementation.createHTMLDocument(article.title);

  // Add reader mode styles
  const style = readerDoc.createElement("style");
  style.textContent = `
    @page {
      margin: 20mm;
      size: A4;
    }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      line-height: 1.6;
      max-width: 170mm;
      margin: 0 auto;
      padding: 0;
      background: white;
      color: #333;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
  `;
  readerDoc.head.appendChild(style);

  // Set the content
  readerDoc.body.innerHTML = `
    <article class="article-content">
      <h1>${article.title || document.title}</h1>
      ${article.byline ? `<p class="byline">${article.byline}</p>` : ""}
      ${article.content}
    </article>
  `;
  
  return readerDoc;
}

// Function to convert page to reader mode
async function convertToReaderMode() {
  try {
    // Create a clone of the document to avoid modifying the original
    const docClone = document.cloneNode(true);

    // Check document type and delegate to appropriate handler
    if (isFeishuDocument(docClone)) {
      return await convertFeishuToReaderMode(docClone);
    } else if (isChatInterface(docClone)) {
      return convertChatToReaderMode(docClone);
    } else {
      return convertGeneralToReaderMode(docClone);
    }
  } catch (error) {
    console.error("Error in reader mode conversion:", error);
    return null;
  }
}


// Helper function to sanitize content
function sanitizeContent(element) {
  // Remove unnecessary elements
  const elementsToRemove = [
    '[class*="timestamp"]',
    '[class*="button"]',
    '[class*="action"]',
    '[class*="regenerate"]',
    '[class*="feedback"]',
  ];

  elementsToRemove.forEach((selector) => {
    element.querySelectorAll(selector).forEach((el) => el.remove());
  });

  // Clean up text nodes
  const cleanTextNodes = (node) => {
    if (node.nodeType === 3 && !node.parentElement?.closest("pre, code")) {
      node.textContent = node.textContent.replace(/\s+/g, " ").trim();
    } else if (node.nodeType === 1) {
      Array.from(node.childNodes).forEach(cleanTextNodes);
    }
  };
  cleanTextNodes(element);

  return element.innerHTML;
}

// Function to collect all links and their positions
function collectLinks(scale) {
  const links = [];

  // Helper function to get the total offset of an element
  function getTotalOffset(element) {
    let totalTop = 0;
    let totalLeft = 0;
    let current = element;

    while (
      current &&
      current !== document.body &&
      current !== document.documentElement
    ) {
      totalTop += current.offsetTop - current.scrollTop;
      totalLeft += current.offsetLeft - current.scrollLeft;
      current = current.offsetParent;
    }

    return { top: totalTop, left: totalLeft };
  }

  // Process each link
  document.querySelectorAll("a").forEach((link) => {
    const rect = link.getBoundingClientRect();
    const offset = getTotalOffset(link);

    // Only collect visible links with actual dimensions
    if (rect.width > 0 && rect.height > 0) {
      // Get the computed style to check visibility
      const style = window.getComputedStyle(link);
      if (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0"
      ) {
        links.push({
          x: offset.left * scale,
          y: offset.top * scale,
          width: rect.width * scale,
          height: rect.height * scale,
          href: link.href,
        });
      }
    }
  });

  return links;
}

// Function to expand scrollable elements
function expandScrollableElements(doc) {
  const expandedElements = [];

  // Helper function to check if an element might be scrollable or have fixed height
  function needsExpansion(element) {
    const style = window.getComputedStyle(element);
    return (
      // Check for any kind of overflow
      style.overflow !== "visible" ||
      style.overflowY !== "visible" ||
      style.overflowX !== "visible" ||
      // Check for height limitations
      style.maxHeight !== "none" ||
      style.height !== "auto" ||
      // Check actual scroll presence
      element.scrollHeight > element.clientHeight ||
      element.scrollWidth > element.clientWidth ||
      // Check for fixed/absolute positioning
      style.position === "fixed" ||
      style.position === "absolute"
    );
  }

  // Aggressively expand an element
  function expandElement(element) {
    // Skip specific elements that shouldn't be expanded
    if (element.tagName === "HTML" || element.tagName === "BODY") {
      return;
    }

    const originalStyle = {
      height: element.style.height,
      maxHeight: element.style.maxHeight,
      overflow: element.style.overflow,
      overflowX: element.style.overflowX,
      overflowY: element.style.overflowY,
      position: element.style.position,
      display: element.style.display,
      minHeight: element.style.minHeight,
    };

    if (needsExpansion(element)) {
      expandedElements.push({
        element,
        originalStyle,
      });

      // Force element to expand
      element.style.height = "auto !important";
      element.style.maxHeight = "none !important";
      element.style.overflow = "visible !important";
      element.style.overflowX = "visible !important";
      element.style.overflowY = "visible !important";
      element.style.display = "block !important";
      element.style.minHeight = "0 !important";

      // If position is fixed or absolute, change it to static
      const computedStyle = window.getComputedStyle(element);
      if (
        computedStyle.position === "fixed" ||
        computedStyle.position === "absolute"
      ) {
        element.style.position = "static !important";
      }

      // Force the element to its full height if it has scroll
      if (element.scrollHeight > element.clientHeight) {
        element.style.height = element.scrollHeight + "px !important";
      }
    }
  }

  // First pass: expand all elements that might need it
  const elements = doc.querySelectorAll("*");
  elements.forEach(expandElement);

  // Second pass: handle any elements that might still be constrained
  elements.forEach((element) => {
    if (
      element.scrollHeight > element.clientHeight ||
      element.scrollWidth > element.clientWidth
    ) {
      expandElement(element);
    }
  });

  // Special handling for the main chat container in ChatGPT
  const chatContainer = doc.querySelector(
    '.chat-container, [class*="conversation-container"], [class*="chat-content"]'
  );
  if (chatContainer) {
    const messages = chatContainer.querySelectorAll(
      '[class*="message"], [class*="chat-message"], [class*="conversation-message"]'
    );
    messages.forEach((message) => {
      message.style.maxHeight = "none !important";
      message.style.height = "auto !important";
      message.style.overflow = "visible !important";
    });
  }

  return expandedElements;
}

// Function to restore scrollable elements
function restoreScrollableElements(expandedElements) {
  // Restore in reverse order to handle nested elements properly
  for (let i = expandedElements.length - 1; i >= 0; i--) {
    const { element, originalStyle } = expandedElements[i];
    Object.assign(element.style, originalStyle);
  }
}

// ========== PDF CAPTURE AND STITCH - MODULAR HELPER FUNCTIONS ==========

function pixelsToMm(pixels, dpi = 96) {
  const mmPerInch = 25.4;
  return (pixels / dpi) * mmPerInch;
}

async function getWatermarkDataUrl(sizePx = PageSaverWatermark.sizePx) {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = sizePx;
          canvas.height = sizePx;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, sizePx, sizePx);
          ctx.drawImage(img, 0, 0, sizePx, sizePx);
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = (err) => reject(err);
      img.src = chrome.runtime.getURL(PageSaverWatermark.resourcePath);
    } catch (e) {
      reject(e);
    }
  });
}

async function addWatermarkToPDF(doc, lastPageNumber) {
  if (!PageSaverWatermark.enabled) return;
  try {
    const targetPage = lastPageNumber || (typeof doc.getNumberOfPages === 'function' ? doc.getNumberOfPages() : undefined);
    if (targetPage && typeof doc.setPage === 'function') {
      doc.setPage(targetPage);
    }

    const wmDataUrl = await getWatermarkDataUrl(PageSaverWatermark.sizePx);
    const wmSizeMm = pixelsToMm(PageSaverWatermark.sizePx);
    const bottomMarginMm = pixelsToMm(PageSaverWatermark.marginBottomPx);
    const pageWidth = (doc.internal && doc.internal.pageSize && typeof doc.internal.pageSize.getWidth === 'function') ? doc.internal.pageSize.getWidth() : CaptureConfig.PDF.width;
    const pageHeight = (doc.internal && doc.internal.pageSize && typeof doc.internal.pageSize.getHeight === 'function') ? doc.internal.pageSize.getHeight() : CaptureConfig.PDF.height;
    const x = (pageWidth - wmSizeMm) / 2;
    const y = Math.max(0, pageHeight - wmSizeMm - bottomMarginMm);
    doc.addImage(wmDataUrl, 'PNG', x, y, wmSizeMm, wmSizeMm, '', 'FAST');
  } catch (e) {
    console.warn('Failed to add PDF watermark:', e);
  }
}

async function addSourceSectionToPDF(doc, sourceUrl, lastPageNumber, position = 'page') {
  try {
    const targetPage = lastPageNumber || (typeof doc.getNumberOfPages === 'function' ? doc.getNumberOfPages() : undefined);
    if (targetPage && typeof doc.setPage === 'function') {
      doc.setPage(targetPage);
    }

    const pageWidth = (doc.internal && doc.internal.pageSize && typeof doc.internal.pageSize.getWidth === 'function') ? doc.internal.pageSize.getWidth() : CaptureConfig.PDF.width;
    const pageHeight = (doc.internal && doc.internal.pageSize && typeof doc.internal.pageSize.getHeight === 'function') ? doc.internal.pageSize.getHeight() : CaptureConfig.PDF.height;

    const wmSizeMm = pixelsToMm(PageSaverWatermark.sizePx);
    const bottomMarginMm = pixelsToMm(PageSaverWatermark.marginBottomPx);
    const watermarkTopY = PageSaverWatermark.enabled
      ? Math.max(0, pageHeight - wmSizeMm - bottomMarginMm)
      : pageHeight - 8; // small margin when no watermark

    const outerMarginX = 0; // full-width card
    const topMarginY = 18; // mm from top when positioned at top/page
    const cardPadding = 4; // mm inside card
    const gapToWatermark = 3; // mm
    const cardWidth = pageWidth - outerMarginX * 2;

    const urlText = sourceUrl || (typeof window !== 'undefined' ? window.location.href : '');

    // Measure text heights
    const labelFontSize = 10;
    const urlFontSize = 9;
    const lineHeight = 4.5; // mm approx

    // Prepare wrapped URL text within card content width
    const contentWidth = cardWidth - cardPadding * 2;
    doc.setFontSize(urlFontSize);
    const wrappedUrl = doc.splitTextToSize(urlText, contentWidth);
    const urlBlockHeight = wrappedUrl.length * lineHeight;

    // Compute card height dynamically: padding + label + small gap + url + padding
    const cardHeight = cardPadding + lineHeight + 2 + urlBlockHeight + cardPadding;

    // Position card
    let cardTop;
    if (position === 'bottom') {
      const cardBottom = Math.max(0, watermarkTopY - gapToWatermark);
      cardTop = Math.max(0, cardBottom - cardHeight);
    } else {
      // 'page' or 'top': reserve space by adding a new page if needed to avoid overlap with content
      // If there is not enough remaining space on the current page to fit the card above the watermark, add a new page
      try {
        const cursorY = (doc.internal && doc.internal.getCurrentPageInfo) ? doc.internal.getCurrentPageInfo().pageContext?.y : null;
        const remaining = cursorY ? (watermarkTopY - cursorY) : (watermarkTopY - topMarginY);
        if (remaining < cardHeight + 6 && typeof doc.addPage === 'function') {
          doc.addPage();
          // Recompute page metrics after adding page
          const w = (doc.internal && doc.internal.pageSize && typeof doc.internal.pageSize.getWidth === 'function') ? doc.internal.pageSize.getWidth() : pageWidth;
          const h = (doc.internal && doc.internal.pageSize && typeof doc.internal.pageSize.getHeight === 'function') ? doc.internal.pageSize.getHeight() : pageHeight;
          // Reset card width for new page
          cardTop = topMarginY;
        } else {
          cardTop = topMarginY;
        }
      } catch (_) {
        cardTop = topMarginY;
      }
    }

    // Draw card background and border
    doc.setFillColor(247, 248, 250); // light neutral background
    doc.setDrawColor(230, 232, 235); // subtle border
    doc.setLineWidth(0.3);
    doc.rect(outerMarginX, cardTop, cardWidth, cardHeight, 'FD');

    // Label: "Original Link:"
    doc.setTextColor(70, 70, 70);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(labelFontSize);
    const labelY = cardTop + cardPadding + lineHeight; // baseline
    doc.text('Original Link:', outerMarginX + cardPadding, labelY);

    // URL lines under label
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(36, 95, 199);
    doc.setFontSize(urlFontSize);
    const urlY = labelY + 2 + lineHeight; // small gap then first URL line baseline
    doc.text(wrappedUrl, outerMarginX + cardPadding, urlY, { maxWidth: contentWidth });

    // Make the URL area clickable (rough rectangle over the URL block)
    try {
      const linkHeight = Math.max(lineHeight, urlBlockHeight);
      doc.link(outerMarginX + cardPadding, urlY - lineHeight, contentWidth, linkHeight, { url: urlText });
    } catch (_) {}
  } catch (e) {
    console.warn('Failed to add source section:', e);
  }
}

function estimateSourceSectionReserveMm(doc, pageWidth, urlText) {
  try {
    const wmSizeMm = pixelsToMm(PageSaverWatermark.sizePx);
    const bottomMarginMm = pixelsToMm(PageSaverWatermark.marginBottomPx);
    const watermarkReserve = PageSaverWatermark.enabled ? (wmSizeMm + bottomMarginMm) : 8;

    const outerMarginX = 0; // full width
    const cardPadding = 4;
    const urlFontSize = 9;
    const lineHeight = 4.5;
    const contentWidth = (pageWidth - outerMarginX * 2) - cardPadding * 2;

    const text = urlText || (typeof window !== 'undefined' ? window.location.href : '');
    doc.setFontSize(urlFontSize);
    const wrappedUrl = doc.splitTextToSize(text, contentWidth);
    const urlBlockHeight = wrappedUrl.length * lineHeight;
    const cardHeight = cardPadding + lineHeight + 2 + urlBlockHeight + cardPadding;
    const gapToWatermark = 3;
    return cardHeight + gapToWatermark + watermarkReserve;
  } catch (_) {
    return 30; // fallback reserve
  }
}

async function addWatermarkToCanvas(canvas) {
  if (!PageSaverWatermark.enabled) return canvas;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const size = PageSaverWatermark.sizePx;
        const extraBottom = size + Math.max(0, PageSaverWatermark.marginBottomPx);

        // Create a new canvas with extra height to avoid overlapping content
        const outCanvas = document.createElement('canvas');
        outCanvas.width = canvas.width;
        outCanvas.height = canvas.height + extraBottom;
        const outCtx = outCanvas.getContext('2d');

        // Draw original content
        outCtx.drawImage(canvas, 0, 0);

        // Draw watermark centered at the bottom area
        const x = Math.max(0, Math.round((outCanvas.width - size) / 2));
        const y = outCanvas.height - size - PageSaverWatermark.marginBottomPx;
        outCtx.drawImage(img, x, y, size, size);

        resolve(outCanvas);
      } catch (e) {
        console.warn('Failed drawing watermark on canvas:', e);
        resolve(canvas);
      }
    };
    img.onerror = () => resolve(canvas);
    img.src = chrome.runtime.getURL(PageSaverWatermark.resourcePath);
  });
}

// Get document and viewport dimensions
function getPageDimensions() {
  const documentHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.offsetHeight
  );

  const documentWidth = Math.max(
    document.body.scrollWidth,
    document.documentElement.scrollWidth,
    document.body.offsetWidth,
    document.documentElement.offsetWidth
  );

  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  return { documentHeight, documentWidth, viewportHeight, viewportWidth };
}

// Temporarily hide scrollbars across the document; returns a function to restore
function hideScrollbarsTemporarily() {
  try {
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-pagesaver", "hide-scrollbars");
    styleEl.textContent = `
*::-webkit-scrollbar { width: 0 !important; height: 0 !important; background: transparent !important; }
* { scrollbar-width: none !important; -ms-overflow-style: none !important; }
`;
    (document.head || document.documentElement).appendChild(styleEl);
    return function restoreScrollbars() {
      try {
        if (styleEl && styleEl.parentNode) {
          styleEl.parentNode.removeChild(styleEl);
        }
      } catch (_) {}
    };
  } catch (_) {
    // If injection fails, return a no-op restore function
    return function noopRestore() {};
  }
}

// Create element data structure
function createElementData(element, computedStyle) {
  return {
    element,
    originalPosition: element.style.position || computedStyle.position,
    originalZIndex: element.style.zIndex || computedStyle.zIndex,
    originalVisibility: element.style.visibility || computedStyle.visibility,
    originalOpacity: element.style.opacity || computedStyle.opacity,
    tagName: element.tagName,
    className: element.className,
    id: element.id,
  };
}

// Check if element is problematic (fixed/sticky and visible)
function isProblematicElement(element, computedStyle) {
  const position = computedStyle.position;
  const rect = element.getBoundingClientRect();

  // Always consider PageSaver extension elements as problematic (they should never be captured)
  const elementId = element.id || "";
  
  // Safely get className as string - handle different types
  let elementClass = "";
  try {
    if (element.className) {
      if (typeof element.className === 'string') {
        elementClass = element.className;
      } else if (element.className.baseVal !== undefined) {
        // SVG elements have className as SVGAnimatedString
        elementClass = element.className.baseVal || "";
      } else if (element.className.toString) {
        // DOMTokenList or other objects with toString
        elementClass = element.className.toString();
      }
    }
  } catch (e) {
    // If there's any error accessing className, default to empty string
    elementClass = "";
  }
  
  const isPageSaverElement =
    elementId.includes("pagesaver") ||
    elementClass.includes("pagesaver") ||
    elementId === "pagesaver-pdf-progress" ||
    elementClass.includes("pagesaver-pdf-progress");

  if (isPageSaverElement) {
    return true;
  }

  const isFixedOrSticky = position === "fixed" || position === "sticky";
  // For fixed/sticky elements, consider them problematic if they have ANY meaningful dimension
  // (width OR height > 0), not necessarily both. Zero-height headers can still be problematic.
  const hasSize = rect.width > 0 || rect.height > 0;
  const isDisplayed = computedStyle.display !== "none";
  const isVisible = computedStyle.visibility !== "hidden";
  const isOpaque = computedStyle.opacity !== "0";

  const isProblematic =
    isFixedOrSticky && hasSize && isDisplayed && isVisible && isOpaque;

  return isProblematic;
}

// Universal initial detection - scans ALL elements regardless of class names
function detectInitialProblematicElements() {
  const problematicElements = [];

  // Get ALL elements in the document for comprehensive scanning
  const allElements = Array.from(document.querySelectorAll("*"));

  let scannedCount = 0;
  let problematicCount = 0;

  allElements.forEach((el, index) => {
    try {
      scannedCount++;

      const computedStyle = window.getComputedStyle(el);

      if (isProblematicElement(el, computedStyle)) {
        const elementData = createEnhancedElementData(el, computedStyle);
        problematicElements.push(elementData);
        problematicCount++;
      }
    } catch (e) {
      // Skip elements that can't be processed (rare edge cases)
      console.warn(
        `Could not process element at index ${index} during initial scan:`,
        e.message
      );
    }
  });

  return problematicElements;
}

// Universal element scanner - detects ALL problematic elements regardless of class names
function detectCommonProblematicElements() {
  const problematicElements = [];

  // Get ALL elements in the document
  const allElements = Array.from(document.querySelectorAll("*"));

  let scannedCount = 0;
  let problematicCount = 0;

  allElements.forEach((el, index) => {
    try {
      scannedCount++;

      const computedStyle = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();

      // Check if element is problematic based on computed styles only
      if (isProblematicElement(el, computedStyle)) {
        const elementData = createEnhancedElementData(el, computedStyle);
        problematicElements.push(elementData);
        problematicCount++;
      }
    } catch (e) {
      // Skip elements that can't be processed (rare edge cases)
      console.warn(`Could not process element at index ${index}:`, e.message);
    }
  });

  return problematicElements;
}

// Enhanced merge function for multiple element arrays
function mergeMultipleProblematicElements(elementArrays) {
  const merged = [];
  const seenElements = new Set();

  elementArrays.forEach((elementArray, arrayIndex) => {
    elementArray.forEach((elementData) => {
      if (!seenElements.has(elementData.element)) {
        seenElements.add(elementData.element);
        merged.push(elementData);
      }
    });
  });

  return merged;
}

// Delayed detection to catch elements added/modified after initial load
async function detectDelayedProblematicElements() {
  const problematicElements = [];

  // Set up mutation observer to catch dynamic changes
  const dynamicElements = new Set();
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      // Check added nodes
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          // Element node
          dynamicElements.add(node);
          // Also check children of added nodes
          const children = node.querySelectorAll("*");
          children.forEach((child) => dynamicElements.add(child));
        }
      });

      // Check for attribute changes that might affect positioning
      if (
        mutation.type === "attributes" &&
        (mutation.attributeName === "class" ||
          mutation.attributeName === "style")
      ) {
        dynamicElements.add(mutation.target);
      }
    });
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style"],
  });

  // Wait for mutations to be captured
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Stop observing
  observer.disconnect();

  // Universal scan of all elements (both existing and newly detected)
  const allElements = Array.from(document.querySelectorAll("*"));
  let scannedCount = 0;
  let dynamicCount = 0;

  allElements.forEach((el, index) => {
    try {
      scannedCount++;

      const computedStyle = window.getComputedStyle(el);

      // Check if element became problematic
      if (isProblematicElement(el, computedStyle)) {
        const elementData = createEnhancedElementData(el, computedStyle);
        problematicElements.push(elementData);
        dynamicCount++;
      }
    } catch (e) {
      // Skip elements that can't be processed (rare edge cases)
      console.warn(
        `Could not process element at index ${index} during delayed scan:`,
        e.message
      );
    }
  });

  return problematicElements;
}

// Universal dynamic detection - scans ALL elements for newly problematic ones
function detectDynamicFixedElements(existingElements) {
  const newlyFixedElements = [];

  try {
    // Get ALL elements for comprehensive scanning
    const allElements = Array.from(document.querySelectorAll("*"));

    let scannedCount = 0;
    let newlyFixedCount = 0;

    allElements.forEach((el, index) => {
      try {
        scannedCount++;

        const computedStyle = window.getComputedStyle(el);

        if (isProblematicElement(el, computedStyle)) {
          // Check if not already tracked
          const alreadyTracked = existingElements.some(
            (item) => item.element === el
          );
          if (!alreadyTracked) {
            const elementData = createEnhancedElementData(el, computedStyle);
            newlyFixedElements.push(elementData);
            newlyFixedCount++;
          }
        }
      } catch (e) {
        // Skip elements that can't be processed (rare edge cases)
        console.warn(
          `Could not process element at index ${index} during dynamic scan:`,
          e.message
        );
      }
    });
  } catch (e) {
    console.warn("Error in detectDynamicFixedElements:", e);
  }

  return newlyFixedElements;
}

// Calculate scroll positions with overlap ensuring full document coverage
function calculateScrollPositions(
  documentHeight,
  viewportHeight,
  config = CaptureConfig.CAPTURE
) {
  // Ensure we have reasonable values
  if (documentHeight <= viewportHeight) {
    return { scrollPositions: [0], numCaptures: 1 };
  }

  const effectiveViewportHeight = viewportHeight - config.minOverlap;
  const capturesNeeded =
    Math.ceil((documentHeight - viewportHeight) / effectiveViewportHeight) + 1;
  const numCaptures = Math.min(capturesNeeded, config.maxCaptures);

  const scrollPositions = [];

  for (let i = 0; i < numCaptures; i++) {
    let scrollTop;

    if (i === 0) {
      // First capture - start at top
      scrollTop = 0;
    } else if (i === numCaptures - 1) {
      // Last capture - ALWAYS ensure we get the absolute bottom
      scrollTop = Math.max(0, documentHeight - viewportHeight);
    } else {
      // Middle captures - calculate with overlap
      scrollTop = i * effectiveViewportHeight;
    }

    // Ensure we don't scroll beyond the document, but for the last capture, trust our calculation
    if (i < numCaptures - 1) {
      scrollTop = Math.min(scrollTop, documentHeight - viewportHeight);
    }

    scrollPositions.push(scrollTop);
  }

  // Verification: ensure the last position actually covers the bottom
  const lastPosition = scrollPositions[scrollPositions.length - 1];
  const bottomCoverage = lastPosition + viewportHeight;

  if (bottomCoverage < documentHeight) {
    // Adjust the last position to ensure full coverage
    scrollPositions[scrollPositions.length - 1] = Math.max(
      0,
      documentHeight - viewportHeight
    );
  }

  return { scrollPositions, numCaptures };
}

// Hide problematic elements
function hideProblematicElements(elements) {
  elements.forEach((item) => {
    try {
      item.element.style.visibility = "hidden";
      item.element.style.opacity = "0";
      item.element.style.pointerEvents = "none";
    } catch (e) {
      // Element might be detached
    }
  });
}

// Restore problematic elements
function restoreProblematicElements(elements) {
  elements.forEach((item) => {
    try {
      item.element.style.visibility = item.originalVisibility;
      item.element.style.opacity = item.originalOpacity;
      item.element.style.pointerEvents = "";
    } catch (e) {
      // Element might be detached
    }
  });
}

// Create placeholder image for failed captures
function createPlaceholder(viewportWidth, viewportHeight) {
  const blankCanvas = document.createElement("canvas");
  blankCanvas.width = viewportWidth;
  blankCanvas.height = viewportHeight;
  const ctx = blankCanvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, blankCanvas.width, blankCanvas.height);
  return blankCanvas.toDataURL("image/png");
}

async function getImageDimensionsFromDataUrl(dataUrl) {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    let timeoutId = setTimeout(() => {
      reject(new Error("Image load timed out"));
    }, 5000);

    img.onload = () => {
      clearTimeout(timeoutId);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error("Failed to load capture image"));
    };

    img.src = dataUrl;
  });
}

// Calculate canvas dimensions with scaling
function calculateCanvasDimensions(
  viewportWidth,
  documentHeight,
  config = CaptureConfig.CANVAS
) {
  const dpr = Math.min(window.devicePixelRatio || 1, config.maxDPR);
  let canvasWidth = viewportWidth * dpr;
  let canvasHeight = documentHeight * dpr;

  // Scale down if too large
  if (canvasHeight > config.maxSize) {
    const scale = config.maxSize / canvasHeight;
    canvasWidth *= scale;
    canvasHeight = config.maxSize;
  }

  return { canvasWidth, canvasHeight, dpr };
}

// Clamp adjusted scroll position to ensure minimum overlap with previous capture
async function clampScrollToAvoidGap(
  adjustedScrollTop,
  viewportHeight,
  capturedImages,
  i,
  numCaptures,
  progressIndicator
) {
  if (!capturedImages || capturedImages.length === 0) return adjustedScrollTop;
  try {
    const prev = capturedImages[capturedImages.length - 1];
    const prevTop = typeof prev.actualScrollTop === "number" ? prev.actualScrollTop : prev.scrollTop;
    const minOverlapPx = Math.max(20, (CaptureConfig && CaptureConfig.CAPTURE && CaptureConfig.CAPTURE.minOverlap) || 0);
    const maxNoGapTop = Math.max(0, prevTop + viewportHeight - minOverlapPx);
    if (adjustedScrollTop > maxNoGapTop) {
      console.log(
        `Clamping scroll to avoid gap: ${Math.round(adjustedScrollTop)} → ${Math.round(maxNoGapTop)}`
      );
      adjustedScrollTop = maxNoGapTop;
      try {
        await smoothScrollToPosition(adjustedScrollTop, i, numCaptures, progressIndicator);
        await new Promise((resolve) => setTimeout(resolve, 80));
      } catch (_) {}
    }
  } catch (_) {}
  return adjustedScrollTop;
}

// Stitch images together
async function stitchImages(
  capturedImages,
  canvasWidth,
  canvasHeight,
  documentHeight,
  viewportHeight,
  minOverlap
) {
  const stitchedCanvas = document.createElement("canvas");
  const ctx = stitchedCanvas.getContext("2d");

  stitchedCanvas.width = canvasWidth;
  stitchedCanvas.height = canvasHeight;

  // Fill with white background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Load and stitch images with proper overlap handling
  for (let i = 0; i < capturedImages.length; i++) {
    const capture = capturedImages[i];

    if (capture.isPlaceholder) {
      continue;
    }

    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout loading image ${i}`));
        }, 5000);

        img.onload = () => {
          clearTimeout(timeout);
          try {
            // Calculate position more accurately
            const captureScrollTop =
              typeof capture.actualScrollTop === "number"
                ? capture.actualScrollTop
                : capture.scrollTop;
            let yPosition = (captureScrollTop / documentHeight) * canvasHeight;

            const sourceRect = getCaptureSourceRect(img, capture);
            const hasCropRect = !!sourceRect;

            // Handle overlap for middle images - ONLY when not using crop rect
            // When using crop rect (element scrolling), scroll positions already
            // account for overlap so this adjustment creates gaps
            if (!hasCropRect && i > 0 && i < capturedImages.length - 1) {
              const overlapPixels =
                (minOverlap / documentHeight) * canvasHeight;
              yPosition = Math.max(0, yPosition - overlapPixels / 2);
            }

            const imgWidth = canvasWidth;
            // For cropped captures, use the crop height; otherwise use viewportHeight
            const effectiveViewportHeight = hasCropRect && capture.cropRect
              ? capture.cropRect.height
              : viewportHeight;
            const imgHeight = (effectiveViewportHeight / documentHeight) * canvasHeight;

            // Ensure we don't draw outside canvas bounds
            const drawHeight = Math.min(imgHeight, canvasHeight - yPosition);

            console.log(`Stitch frame ${i}: scrollTop=${captureScrollTop}, yPos=${Math.round(yPosition)}, drawH=${Math.round(drawHeight)}, hasCrop=${hasCropRect}, cropRect=${JSON.stringify(capture.cropRect)}, sourceRect=${JSON.stringify(sourceRect)}`);

            if (drawHeight > 0) {
              if (sourceRect) {
                ctx.drawImage(
                  img,
                  sourceRect.sx,
                  sourceRect.sy,
                  sourceRect.sWidth,
                  sourceRect.sHeight,
                  0,
                  yPosition,
                  imgWidth,
                  drawHeight
                );
              } else {
                ctx.drawImage(img, 0, yPosition, imgWidth, drawHeight);
              }
            }

            resolve();
          } catch (drawError) {
            console.error(`Error drawing image ${i}:`, drawError);
            reject(drawError);
          }
        };

        img.onerror = (error) => {
          clearTimeout(timeout);
          console.error(`Failed to load captured image ${i}:`, error);
          reject(new Error(`Failed to load captured image ${i}`));
        };

        img.src = capture.dataUrl;
      });
    } catch (imageError) {
      console.warn(`Skipping problematic image ${i + 1}:`, imageError);
    }
  }

  return stitchedCanvas;
}

// Convert canvas to image data with quality fallback
function convertCanvasToImageData(
  canvas,
  qualityLevels = [0.98, 0.95, 0.9, 0.85]
) {
  // Final fallback to PNG
  try {
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.error("Failed to convert canvas to image data", e);
    // continue with JPEG
    // throw new Error("Failed to convert canvas to image data");
  }

  for (let quality of qualityLevels) {
    try {
      const jpegDataUrl = canvas.toDataURL("image/jpeg", quality);
      if (jpegDataUrl && jpegDataUrl.length > 1000) {
        return jpegDataUrl;
      }
    } catch (e) {
      console.warn(`JPEG conversion failed with quality ${quality}:`, e);
    }
  }

  throw new Error("Failed to convert canvas to image data");
}

function getCaptureSourceRect(img, capture) {
  if (!capture) {
    console.log("getCaptureSourceRect: no capture object");
    return null;
  }
  if (!capture.cropRect) {
    console.log("getCaptureSourceRect: no cropRect in capture");
    return null;
  }
  if (!capture.captureViewportWidth || !capture.captureViewportHeight) {
    console.log("getCaptureSourceRect: no viewport dimensions", {
      captureViewportWidth: capture.captureViewportWidth,
      captureViewportHeight: capture.captureViewportHeight,
    });
    return null;
  }

  const scaleX = img.width / capture.captureViewportWidth;
  const scaleY = img.height / capture.captureViewportHeight;
  const sx = Math.max(0, Math.round(capture.cropRect.left * scaleX));
  const sy = Math.max(0, Math.round(capture.cropRect.top * scaleY));
  const sWidth = Math.max(1, Math.round(capture.cropRect.width * scaleX));
  const sHeight = Math.max(1, Math.round(capture.cropRect.height * scaleY));

  console.log("getCaptureSourceRect result:", {
    imgSize: { width: img.width, height: img.height },
    scale: { scaleX, scaleY },
    cropRect: capture.cropRect,
    sourceRect: { sx, sy, sWidth, sHeight },
  });

  return { sx, sy, sWidth, sHeight };
}

// Optimized smooth scroll function with improved speed while maintaining visual appeal
async function smoothScrollToPosition(
  targetScrollTop,
  sectionIndex,
  totalSections,
  progressIndicator
) {
  const startScrollTop =
    window.pageYOffset || document.documentElement.scrollTop;
  const scrollDistance = targetScrollTop - startScrollTop;

  // Skip smooth scroll if we're already at the target position
  if (Math.abs(scrollDistance) < 5) {
    return;
  }

  // Create scroll indicator overlay
  const scrollIndicator = createScrollIndicator(
    sectionIndex + 1,
    totalSections,
    targetScrollTop
  );

  try {
    // Optimized duration calculation - faster but still smooth
    const baseDuration = Math.abs(scrollDistance) < 1000 ? 150 : 250; // Shorter base duration
    const maxDuration = 400; // Reduced max duration from 800ms to 400ms
    const duration = Math.min(maxDuration, Math.max(150, baseDuration)); // 150-400ms range
    const startTime = performance.now();

    // Optimized easing function (ease-out quad - faster initial movement)
    const easeOutQuad = (t) => {
      return 1 - (1 - t) * (1 - t);
    };

    return new Promise((resolve) => {
      const animateScroll = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Apply optimized easing for faster perceived speed
        const easedProgress = easeOutQuad(progress);
        const currentScrollTop =
          startScrollTop + scrollDistance * easedProgress;

        // Smooth scroll using CSS
        window.scrollTo({
          top: currentScrollTop,
          left: 0,
          behavior: "instant",
        });

        // Update scroll indicator less frequently for better performance
        if (Math.round(progress * 10) % 2 === 0) {
          // Update every 20% instead of every frame
          updateScrollIndicator(scrollIndicator, progress);
        }

        // Update main progress indicator less frequently
        if (Math.round(progress * 4) % 1 === 0) {
          // Update every 25%
          const baseProgress =
            25 + Math.round(((sectionIndex + 1) / totalSections) * 40);
          const scrollProgress = Math.round(progress * 100);
          progressIndicator.setStatus(
            `Scrolling to section ${
              sectionIndex + 1
            }/${totalSections} (${scrollProgress}%)`
          );
        }

        if (progress < 1) {
          requestAnimationFrame(animateScroll);
        } else {
          // Ensure we're exactly at the target
          window.scrollTo({
            top: targetScrollTop,
            left: 0,
            behavior: "instant",
          });

          // Clean up scroll indicator
          removeScrollIndicator(scrollIndicator);

          // Reduced stabilization delay from 200ms to 100ms
          setTimeout(resolve, 100);
        }
      };

      requestAnimationFrame(animateScroll);
    });
  } catch (error) {
    console.warn(
      "Smooth scroll failed, falling back to instant scroll:",
      error
    );
    // Fallback to instant scroll
    window.scrollTo({
      top: targetScrollTop,
      left: 0,
      behavior: "instant",
    });
    removeScrollIndicator(scrollIndicator);
  }
}

// Optimized lightweight scroll indicator for better performance
function createScrollIndicator(currentSection, totalSections, targetPosition) {
  // Remove any existing scroll indicators
  const existing = document.querySelector(".pagesaver-scroll-indicator");
  if (existing) existing.remove();

  const indicator = document.createElement("div");
  indicator.className = "pagesaver-scroll-indicator";
  indicator.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 999998;
    text-align: center;
    min-width: 240px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease;
  `;

  // Simplified content - less DOM elements for better performance
  indicator.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 6px;">Section ${currentSection}/${totalSections}</div>
    <div style="width: 100%; height: 3px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden;">
      <div class="scroll-progress" style="height: 100%; width: 0%; background: #4CAF50; border-radius: 2px; transition: width 0.1s ease;"></div>
    </div>
  `;

  document.body.appendChild(indicator);

  // Quick fade-in
  setTimeout(() => {
    indicator.style.opacity = "1";
  }, 10);

  return indicator;
}

// Update scroll indicator progress
function updateScrollIndicator(indicator, progress) {
  const progressBar = indicator.querySelector(".scroll-progress");
  if (progressBar) {
    progressBar.style.width = `${progress * 100}%`;
  }
}

// Optimized scroll indicator removal
function removeScrollIndicator(indicator) {
  if (indicator && indicator.parentNode) {
    indicator.style.opacity = "0";
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    }, 150); // Reduced from 300ms to 150ms
  }
}

// ========== MAIN REFACTORED FUNCTION ==========

async function generateNormalModePDFCaptureStitch(
  element,
  fullHeight,
  fullWidth,
  scale,
  { html2canvas, jsPDF }
) {
  const progressIndicator = createPDFProgressIndicator();
  let restoreScrollbars;

  try {
    progressIndicator.setProgress(
      5,
      "Initializing capture and stitch PDF generation..."
    );

    // Create PDF with compression using config
    const doc = new jsPDF({
      orientation: CaptureConfig.PDF.orientation,
      unit: CaptureConfig.PDF.unit,
      format: CaptureConfig.PDF.format,
      compress: true,
      putOnlyUsedFonts: true,
      precision: 16,
    });

    progressIndicator.setProgress(10, "Analyzing page structure...");

    // Store original scroll position
    const originalScrollTop =
      window.pageYOffset || document.documentElement.scrollTop;
    const originalScrollLeft =
      window.pageXOffset || document.documentElement.scrollLeft;

    progressIndicator.setProgress(15, "Identifying fixed elements...");

    // Multi-phase detection for robust element discovery
    const initialElements = detectInitialProblematicElements();
    const commonElements = detectCommonProblematicElements();

    // Add delayed detection to catch dynamically added/modified elements
    await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for dynamic content

    const delayedElements = await detectDelayedProblematicElements();

    // Merge all detected elements
    const problematicElements = mergeMultipleProblematicElements([
      initialElements,
      commonElements,
      delayedElements,
    ]);

    // IMPORTANT: Get page dimensions AFTER all element detection is complete
    // This ensures sticky elements have been reverted to their original positions
    await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay for any pending style changes
    const { documentHeight, documentWidth, viewportHeight, viewportWidth } =
      getPageDimensions();

    // Calculate scroll positions using helper function
    const { scrollPositions, numCaptures } = calculateScrollPositions(
      documentHeight,
      viewportHeight
    );

    progressIndicator.setProgress(20, "Starting page capture...");

    // Temporarily hide scrollbars during capture to avoid them appearing in screenshots
    restoreScrollbars = hideScrollbarsTemporarily();

    // Array to store captured images with metadata
    const capturedImages = [];

    // Hide progress indicator during captures
    progressIndicator.hide();

    // Capture each section
    var collectedToHideElements = [];
    for (let i = 0; i < numCaptures; i++) {
      const scrollTop = scrollPositions[i];

      // Update progress with smooth scroll indication
      const captureProgress = 25 + Math.round(((i + 1) / numCaptures) * 40);
      progressIndicator.setProgress(
        captureProgress,
        `Scrolling to section ${i + 1}/${numCaptures}...`
      );
      console.log("Scrolling to section", i + 1, "/", numCaptures, "at", scrollTop);

      try {
        // Smooth scroll to position with visual appeal
        await smoothScrollToPosition(
          scrollTop,
          i,
          numCaptures,
          progressIndicator
        );

        // Update progress to show we're now capturing
        progressIndicator.setProgress(
          captureProgress,
          `Capturing section ${i + 1}/${numCaptures}...`
        );

        // Optimized wait for dynamic content to load
        if (i === 0) {
          await new Promise((resolve) => setTimeout(resolve, 200)); // Reduced from 300ms to 200ms
        } else {
          await new Promise((resolve) => setTimeout(resolve, 100)); // Reduced from 150ms to 100ms
        }

        // Detect elements that may have become fixed after scrolling
        try {
          const newlyFixedElements =
            detectDynamicFixedElements(problematicElements);
          if (newlyFixedElements.length > 0) {
            problematicElements.push(...newlyFixedElements);
          }
        } catch (dynamicDetectionError) {
          console.warn(
            "Error in dynamic detection, continuing with capture:",
            dynamicDetectionError
          );
        }

        // Determine which elements to hide for this specific capture
        const elementsToHide = getElementsToHideForCapture(
          problematicElements,
          i,
          numCaptures
        );

        // Find sticky elements that will be visible in this capture
        const visibleElements = problematicElements.filter(
          (el) => !elementsToHide.includes(el)
        );
        const visibleStickyElements = visibleElements.filter(
          (el) => el.type === ElementTypes.STICKY
        );

        // Adjust scroll position to ensure sticky elements are fully visible
        let adjustedScrollTop = scrollTop;
        if (visibleStickyElements.length > 0) {
          adjustedScrollTop = adjustScrollPositionForStickyElements(
            scrollTop,
            visibleStickyElements,
            viewportHeight
          );
          if (adjustedScrollTop !== scrollTop) {
            await smoothScrollToPosition(
              adjustedScrollTop,
              i,
              numCaptures,
              progressIndicator
            );
            // Small delay for scroll to complete
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        // Gap-guard: ensure the adjusted position does not create a gap with the previous capture
        adjustedScrollTop = await clampScrollToAvoidGap(
          adjustedScrollTop,
          viewportHeight,
          capturedImages,
          i,
          numCaptures,
          progressIndicator
        );

        collectedToHideElements.push(...elementsToHide);
        // Hide only the selected problematic elements
        hideProblematicElements(elementsToHide);

        // Additional safeguard: Explicitly hide all PageSaver elements during capture
        const pageSaverElements = document.querySelectorAll(
          '[id*="pagesaver"], [class*="pagesaver"]'
        );
        const originalPageSaverStyles = [];
        pageSaverElements.forEach((el, index) => {
          originalPageSaverStyles[index] = el.style.display;
          el.style.display = "none";
        });

        // Small delay to ensure styles are applied
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Capture using Chrome API
        const captureDataUrl = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Capture timeout"));
          }, 10000);

          chrome.runtime.sendMessage(
            {
              action: "captureVisibleTab",
            },
            (response) => {
              clearTimeout(timeout);
              if (response && response.success) {
                resolve(response.dataUrl);
              } else {
                reject(
                  new Error(response?.error || "Failed to capture visible tab")
                );
              }
            }
          );
        });

        // Store captured image with metadata
        capturedImages.push({
          dataUrl: captureDataUrl,
          scrollTop: adjustedScrollTop,
          actualScrollTop:
          window.pageYOffset || document.documentElement.scrollTop,
          index: i,
          viewportHeight: viewportHeight,
        });

        // Restore PageSaver elements
        pageSaverElements.forEach((el, index) => {
          el.style.display = originalPageSaverStyles[index];
        });

        // Restore only the hidden elements after capture
        // restoreProblematicElements(elementsToHide);

        // Optimized rate limiting
        if (i < numCaptures - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200)); // Reduced from 300ms to 200ms
        }
      } catch (captureError) {
        console.warn(`Failed to capture section ${i + 1}:`, captureError);

        // Restore PageSaver elements on error
        if (
          typeof pageSaverElements !== "undefined" &&
          typeof originalPageSaverStyles !== "undefined"
        ) {
          pageSaverElements.forEach((el, index) => {
            el.style.display = originalPageSaverStyles[index];
          });
        }

        // Restore all elements on error (since we might not have elementsToHide in scope)
        restoreProblematicElements(problematicElements);

        // Create a placeholder to maintain sequence using helper function
        const placeholderDataUrl = createPlaceholder(
          viewportWidth,
          viewportHeight
        );

        capturedImages.push({
          dataUrl: placeholderDataUrl,
          scrollTop: scrollTop,
          actualScrollTop: scrollTop,
          index: i,
          viewportHeight: viewportHeight,
          isPlaceholder: true,
        });
      }
    }

    // restore all hidden elements once the capture is complete
    restoreProblematicElements(collectedToHideElements);

    // Restore original scroll position
    window.scrollTo(originalScrollLeft, originalScrollTop);

    // Show progress indicator again
    progressIndicator.show();
    progressIndicator.setProgress(70, "Stitching images together...");

    if (capturedImages.length === 0) {
      throw new Error("No images were captured successfully");
    }

    if (PDFPaginationMode === 'single') {
      progressIndicator.setProgress(70, "Assembling high-quality PDF...");

      const validCaptures = capturedImages.filter((capture) => !capture.isPlaceholder);
      if (validCaptures.length === 0) {
        throw new Error("No valid images were captured for single-page PDF");
      }

      const highestScrollTop = Math.max(...validCaptures.map((capture) => capture.scrollTop));
      const lowestScrollTop = Math.min(...validCaptures.map((capture) => capture.scrollTop));
      const totalScrollRange = highestScrollTop - lowestScrollTop + viewportHeight;

      const dpr = Math.min(window.devicePixelRatio || 1, CaptureConfig.CANVAS.maxDPR || 1);
      const totalPxHeight = Math.round(totalScrollRange * dpr);
      const pxWidth = Math.round(viewportWidth * dpr);

      const mmPerPixel = CaptureConfig.PDF.width / pxWidth;
      const contentHeightMm = totalPxHeight * mmPerPixel;
      const reserveMm = estimateSourceSectionReserveMm(doc, CaptureConfig.PDF.width, window.location.href);
      const totalHeightMm = contentHeightMm + reserveMm;

      // Check if PDF height exceeds jsPDF limit (14400 points)
      const MM_TO_POINTS = 72 / 25.4; // Convert mm to points
      const totalHeightPoints = totalHeightMm * MM_TO_POINTS;
      const exceedsLimit = totalHeightPoints > SinglePagePDFConfig.maxHeightPoints;

      if (exceedsLimit && SinglePagePDFConfig.enableAutoFallback) {
        console.warn(
          `Single-page PDF height (${Math.round(totalHeightPoints)} pt) exceeds jsPDF limit (${SinglePagePDFConfig.maxHeightPoints} pt). Falling back to multi-page layout.`
        );
        progressIndicator.setProgress(
          70,
          "Page too tall for single-page PDF. Switching to multi-page layout..."
        );
        // Fall through to multi-page logic below
      } else {
        if (exceedsLimit) {
          console.warn(
            `Single-page PDF height (${Math.round(totalHeightPoints)} pt) exceeds jsPDF limit (${SinglePagePDFConfig.maxHeightPoints} pt). Fallback disabled by config.`
          );
        }

        const singleDoc = new jsPDF({
          orientation: CaptureConfig.PDF.orientation,
          unit: CaptureConfig.PDF.unit,
          format: [CaptureConfig.PDF.width, Math.max(1, totalHeightMm)],
          compress: true,
          putOnlyUsedFonts: true,
          precision: 16,
        });

        const { width: captureWidthPx, height: captureHeightPx } = await getImageDimensionsFromDataUrl(validCaptures[0].dataUrl);
        const captureWidthMm = captureWidthPx * mmPerPixel;
        const captureHeightMm = captureHeightPx * mmPerPixel;

        for (const capture of validCaptures) {
          const offsetScroll = capture.scrollTop - lowestScrollTop;
          const yPositionMm = offsetScroll * dpr * mmPerPixel;
          singleDoc.addImage(
            capture.dataUrl,
            'PNG',
            0,
            yPositionMm,
            captureWidthMm,
            captureHeightMm,
            '',
            'FAST'
          );
        }

        progressIndicator.setProgress(95, "Finalizing PDF...");

        if (PageSaverSourceSection.enabledForPDF) {
          await addSourceSectionToPDF(singleDoc, window.location.href, 1, 'bottom');
        }
        await addWatermarkToPDF(singleDoc, 1);
        const pdfData = singleDoc.output('datauristring');
        progressIndicator.complete("PDF generated successfully!");
        return { success: true, dataUrl: pdfData, format: 'pdf' };
      }
    }

    // Calculate canvas dimensions using helper function
    const { canvasWidth, canvasHeight } = calculateCanvasDimensions(
      viewportWidth,
      documentHeight
    );

    // Stitch images using helper function
    const stitchedCanvas = await stitchImages(
      capturedImages,
      canvasWidth,
      canvasHeight,
      documentHeight,
      viewportHeight,
      CaptureConfig.CAPTURE.minOverlap
    );

    progressIndicator.setProgress(85, "Converting to PDF format...");

    // Convert canvas to image data using helper function
    const jpegDataUrl = convertCanvasToImageData(stitchedCanvas);

    progressIndicator.setProgress(95, "Adding content to PDF...");

    // Add image to PDF; support single-page mode
    const imgHeight = (stitchedCanvas.height / canvasWidth) * CaptureConfig.PDF.width;
    const imageFormat = jpegDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
    let heightLeft = imgHeight;
    let position = 0;
    let currentPage = 1;

    doc.addImage(jpegDataUrl, imageFormat, 0, position, CaptureConfig.PDF.width, imgHeight, '', 'FAST');
    heightLeft -= CaptureConfig.PDF.height;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      doc.addPage();
      currentPage++;
      doc.addImage(jpegDataUrl, imageFormat, 0, position, CaptureConfig.PDF.width, imgHeight, '', 'FAST');
      heightLeft -= CaptureConfig.PDF.height;
    }

    // Ensure page counter matches actual number of pages created
    if (typeof doc.getNumberOfPages === 'function') {
      currentPage = doc.getNumberOfPages();
    }

    // Append link section at bottom of the last page; if not enough room, add new page for section
    const reserveMm = estimateSourceSectionReserveMm(doc, CaptureConfig.PDF.width, window.location.href);
    const pageHeight = (doc.internal && doc.internal.pageSize && typeof doc.internal.pageSize.getHeight === 'function') ? doc.internal.pageSize.getHeight() : CaptureConfig.PDF.height;
    // Compute remaining space on last page relative to bottom
    // We do not track cursor Y easily; safe path: always add new page after content, then place section at top
    // But to keep on same page when possible, try placing at bottom; if overflow occurs, we'll add another page.
    let lastPage = (typeof doc.getNumberOfPages === 'function') ? doc.getNumberOfPages() : currentPage;
    if (PageSaverSourceSection.enabledForPDF) {
      try {
        await addSourceSectionToPDF(doc, window.location.href, lastPage, 'bottom');
      } catch (_) {
        doc.addPage();
        lastPage = (typeof doc.getNumberOfPages === 'function') ? doc.getNumberOfPages() : (lastPage + 1);
        await addSourceSectionToPDF(doc, window.location.href, lastPage, 'page');
      }
    }
    await addWatermarkToPDF(doc, lastPage);
    const pdfData = doc.output('datauristring');
    progressIndicator.complete("PDF generated successfully!");
    return { success: true, dataUrl: pdfData, format: 'pdf' };
  } catch (error) {
    console.error("Error in generateNormalModePDFCaptureStitch:", error);
    progressIndicator.error("PDF generation failed: " + error.message);
    throw error;
  } finally {
    // Ensure scrollbar styles are removed even if an error occurs
    try { if (typeof restoreScrollbars === 'function') restoreScrollbars(); } catch (_) {}
  }
}

// Main function to generate PDF in normal mode with automatic fallback
async function generateNormalModePDF(
  element,
  fullHeight,
  fullWidth,
  scale,
  { html2canvas, jsPDF }
) {
  return await generateNormalModePDFCaptureStitchEnhanced(
    element,
    fullHeight,
    fullWidth,
    scale,
    { html2canvas, jsPDF }
  );
}

async function generateServerSideReaderModePDF(url, content) {
  const progressIndicator = createPDFProgressIndicator();
  
  try {
    progressIndicator.setProgress(10, "Initializing server-side PDF generation...");
    progressIndicator.setTitle("Generating Reader Mode PDF...");
    
    const filename = document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf';
    
    progressIndicator.setProgress(30, "Sending content to server. Please be patient.");
    
    // Send request to background script to handle the PDF generation
    const response = await chrome.runtime.sendMessage({
      action: 'generateServerPDF',
      url: url,
      content: content,
      filename: filename
    });

    if (!response.success) {
      const error = response.error || 'Failed to generate PDF';
      if (error === 'Please log in first') {
        progressIndicator.error('Authentication required');
        // Show a user-friendly message
        alert('Please log in to generate PDF. A login page has been opened in a new tab.');
      } else {
        progressIndicator.error('PDF generation failed: ' + error);
      }
      throw new Error(error);
    }

    progressIndicator.setProgress(90, "Processing server response...");
    
    // Small delay to show completion
    await new Promise(resolve => setTimeout(resolve, 500));
    
    progressIndicator.complete("Server-side PDF generated successfully!");

    // Return the PDF data in the expected format
    return {
      success: true,
      dataUrl: response.data,
      format: 'pdf',
      filename: response.filename
    };
  } catch (error) {
    console.error("Server-side PDF generation failed:", error);
    if (progressIndicator) {
      progressIndicator.error("PDF generation failed: " + error.message);
    }
    return false;
  }
}

/**
 * Reader-mode PDF generation is server-only.
 */
async function generateReaderModePDF(readerDoc) {
  try {
    return await generateServerSideReaderModePDF(
      window.location.href,
      readerDoc.documentElement.outerHTML
    );
  } catch (error) {
    console.error("Error generating reader mode PDF:", error);
    throw error;
  }
}

// Function to get full page dimensions
function getFullPageDimensions() {
  const fullHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.offsetHeight,
    document.body.clientHeight,
    document.documentElement.clientHeight
  );

  const fullWidth = document.documentElement.scrollWidth;
  return { fullHeight, fullWidth };
}

// Function to capture the full page
async function captureFullPage(
  format = "png",
  readerMode = false,
  pdfPaginationMode = "single"
) {
  try {
    // Load libraries
    let libraries;
    try {
      libraries = await loadLibraries();
      console.log("Libraries loaded successfully");
    } catch (libError) {
      console.error("Failed to load libraries:", libError);
      return {
        success: false,
        error: `Failed to load required libraries: ${libError.message}`,
      };
    }

    const { html2canvas, jsPDF, Readability, TurndownService } = libraries;
    PDFPaginationMode = pdfPaginationMode === 'multi' ? 'multi' : 'single';

    if (format === "png") {
      try {
        const result = await generateEnhancedPNG(html2canvas);
        return {
          success: true,
          dataUrl: result.dataUrl,
          format: "png",
        };
      } catch (pngError) {
        console.error("PNG generation failed:", pngError);
        return {
          success: false,
          error: `Failed to generate PNG: ${pngError.message}`,
        };
      }
    } else if (format === "markdown") {
      try {
        let content;
        let title;

        if (readerMode) {
          // Convert to reader mode first
          const readerDoc = await convertToReaderMode();
          
          if (readerDoc) {
            content = readerDoc.body.innerHTML;
            title = readerDoc.title;
          } else {
            throw new Error('Could not convert to reader mode');
          }
        } else {
          // Use the whole page content
          content = document.body.innerHTML;
          title = document.title;
        }

        // Create temporary container for content processing
        const tempContainer = document.implementation.createHTMLDocument().createElement('div');
        tempContainer.innerHTML = content;

        // Process the content before conversion
        // Remove unnecessary elements
        const elementsToRemove = tempContainer.querySelectorAll('script, style, noscript, iframe');
        elementsToRemove.forEach(el => el.remove());

        // Fix relative URLs to absolute
        const links = tempContainer.getElementsByTagName('a');
        Array.from(links).forEach(link => {
          const href = link.getAttribute('href');
          if (href && !href.startsWith('http') && !href.startsWith('#')) {
            link.setAttribute('href', new URL(href, window.location.href).href);
          }
        });

        const images = tempContainer.getElementsByTagName('img');
        Array.from(images).forEach(img => {
          const src = img.getAttribute('src');
          if (src && !src.startsWith('http') && !src.startsWith('data:')) {
            img.setAttribute('src', new URL(src, window.location.href).href);
          }
        });

        // Pre-process math formulas to preserve LaTeX for rendering in Markdown viewers
        const mathDoc = tempContainer.ownerDocument;

        // MathJax v2: <script type="math/tex"> and <script type="math/tex; mode=display">
        tempContainer.querySelectorAll('script[type^="math/tex"]').forEach(script => {
          const isDisplay = script.getAttribute('type').includes('mode=display');
          const latex = script.textContent.trim();
          if (latex) {
            const text = isDisplay ? `\n\n$$${latex}$$\n\n` : `$${latex}$`;
            script.parentNode.replaceChild(mathDoc.createTextNode(text), script);
          }
        });

        // KaTeX display math: <span class="katex-display"> (process before inline to avoid double-handling)
        tempContainer.querySelectorAll('.katex-display').forEach(span => {
          const annotation = span.querySelector('annotation[encoding="application/x-tex"]');
          if (annotation) {
            const latex = annotation.textContent.trim();
            span.parentNode.replaceChild(mathDoc.createTextNode(`\n\n$$${latex}$$\n\n`), span);
          }
        });

        // KaTeX inline math: <span class="katex"> (remaining ones not inside .katex-display)
        tempContainer.querySelectorAll('span.katex').forEach(span => {
          const annotation = span.querySelector('annotation[encoding="application/x-tex"]');
          if (annotation) {
            const latex = annotation.textContent.trim();
            span.parentNode.replaceChild(mathDoc.createTextNode(`$${latex}$`), span);
          }
        });

        // MathJax v3: <mjx-container> with data-latex attribute or <annotation> inside SVG
        tempContainer.querySelectorAll('mjx-container').forEach(container => {
          let latex = container.getAttribute('data-latex');
          if (!latex) {
            const annotation = container.querySelector('annotation[encoding="application/x-tex"]');
            if (annotation) latex = annotation.textContent.trim();
          }
          if (latex) {
            const isDisplay = container.getAttribute('display') === 'true';
            const text = isDisplay ? `\n\n$$${latex}$$\n\n` : `$${latex}$`;
            container.parentNode.replaceChild(mathDoc.createTextNode(text), container);
          }
        });

        // Plain MathML <math> elements with LaTeX annotation
        tempContainer.querySelectorAll('math').forEach(math => {
          const annotation = math.querySelector('annotation[encoding="application/x-tex"]');
          if (annotation) {
            const latex = annotation.textContent.trim();
            const isDisplay = math.getAttribute('display') === 'block';
            const text = isDisplay ? `\n\n$$${latex}$$\n\n` : `$${latex}$`;
            math.parentNode.replaceChild(mathDoc.createTextNode(text), math);
          }
        });

        // Convert HTML to Markdown
        const turndownService = new TurndownService({
          headingStyle: 'atx',
          codeBlockStyle: 'fenced',
          bulletListMarker: '-',
          hr: '---',
          linkStyle: 'referenced',
          linkReferenceStyle: 'full',
          preformattedCode: true
        });

        // Add support for code blocks with language
        turndownService.addRule('fencedCodeBlock', {
          filter: function (node, options) {
            return (
              node.nodeName === 'PRE' &&
              node.firstChild &&
              node.firstChild.nodeName === 'CODE'
            );
          },
          replacement: function (content, node, options) {
            const code = node.firstChild;
            const className = code.getAttribute('class') || '';
            const language = className.match(/language-(\w+)/) || ['', ''];
            return '\n```' + language[1] + '\n' + code.textContent + '\n```\n';
          }
        });

        // Convert to markdown
        const markdown = turndownService.turndown(tempContainer);

        // Create the final markdown with title and metadata
        const date = new Date().toISOString().split('T')[0];
        const url = window.location.href;
        const finalMarkdown = `# ${title}\n\n` +
          `> Saved from [${url}](${url}) on ${date}\n\n` +
          markdown;

        // Create a Blob with the markdown content; use data URL for open-in-tab feature
        const blob = new Blob([finalMarkdown], { type: 'text/markdown' });
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });

        return {
          success: true,
          dataUrl: dataUrl,
          format: "markdown",
        };
      } catch (markdownError) {
        console.error("Markdown generation failed:", markdownError);
        return {
          success: false,
          error: `Failed to generate Markdown: ${markdownError.message}`,
        };
      }
    } else if (format === "pdf") {
      try {
        let readerDoc = null;
        if (readerMode) {
          console.log("Attempting reader mode conversion...");
          readerDoc = await convertToReaderMode();
          if (!readerDoc) {
            console.log(
              "Reader mode not available, falling back to normal mode"
            );
            readerMode = false;
          }
        }

        const { fullHeight, fullWidth } = getFullPageDimensions();
        console.log("Page dimensions:", { fullHeight, fullWidth });

        if (fullHeight === 0 || fullWidth === 0) {
          throw new Error("Invalid page dimensions detected");
        }

        const scale = 210 / fullWidth; // 210 is A4 width in mm

        let result;
        if (readerMode && readerDoc) {
          console.log("Generating reader mode PDF...");
          result = await generateReaderModePDF(readerDoc);

          // NEW: Handle the case where server-side generation was successful
          if (result === true) {
            return {
              success: true,
              format: "pdf",
              serverGenerated: true, // Flag to indicate server-side generation
              message: "PDF generated successfully on server", // Optional message
            };
          }
        } else {
          console.log("Generating normal mode PDF...");
          result = await generateNormalModePDF(
            document.documentElement,
            fullHeight,
            fullWidth,
            scale,
            libraries
          );
        }

        // Handle the result from generateNormalModePDF - it returns an object now
        let dataUrl;
        let isBlob = false;

        if (typeof result === "object" && result.success && result.dataUrl) {
          // New format: object with success, dataUrl, format
          dataUrl = result.dataUrl;
        } else if (typeof result === "string") {
          // Legacy format: string data URL or blob URL
          dataUrl = result;
        } else {
          throw new Error(
            "Generated PDF data is invalid - unexpected result format"
          );
        }

        // Check if result is a blob URL (starts with blob:) or a data URL
        const isDataUrl = dataUrl.startsWith("data:");
        const isBlobUrl = dataUrl.startsWith("blob:");
        isBlob = isBlobUrl;

        if (!isDataUrl && !isBlobUrl) {
          throw new Error(
            "Generated PDF data is invalid - not a valid URL format"
          );
        }

        return {
          success: true,
          dataUrl: dataUrl,
          format: "pdf",
          isBlob: isBlob,
        };
      } catch (pdfError) {
        console.error("PDF generation error:", pdfError);
        return {
          success: false,
          error: `Failed to generate PDF: ${pdfError.message}`,
        };
      }
    }

    return {
      success: false,
      error: "Unsupported format",
    };
  } catch (error) {
    console.error("Capture error:", error);
    return {
      success: false,
      error: error.message || "Unknown error occurred during capture",
    };
  }
}

// ========== SCREENSHOT CAPTURE (content script side) ==========

let pagesaverCaptureScrollState = null;
let pagesaverCaptureFixedElements = null;

function getPageCaptureMetrics() {
  const body = document.body || {};
  const doc = document.documentElement || {};
  const pageWidth = Math.ceil(Math.max(
    body.scrollWidth || 0, body.offsetWidth || 0,
    doc.clientWidth || 0, doc.scrollWidth || 0,
    doc.offsetWidth || 0, window.innerWidth || 0
  ));
  const pageHeight = Math.ceil(Math.max(
    body.scrollHeight || 0, body.offsetHeight || 0,
    doc.clientHeight || 0, doc.scrollHeight || 0,
    doc.offsetHeight || 0, window.innerHeight || 0
  ));
  return {
    success: true,
    pageWidth,
    pageHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    devicePixelRatio: window.devicePixelRatio || 1
  };
}

async function prepareFullPageCapture() {
  pagesaverCaptureScrollState = { x: window.scrollX, y: window.scrollY };
  pagesaverCaptureFixedElements = null;
  return getPageCaptureMetrics();
}

async function restoreScrollPosition() {
  restorePagesaverCaptureFixedElements();
  if (pagesaverCaptureScrollState) {
    window.scrollTo(pagesaverCaptureScrollState.x, pagesaverCaptureScrollState.y);
    pagesaverCaptureScrollState = null;
  }
  return { success: true };
}

function restorePagesaverCaptureFixedElements() {
  if (!pagesaverCaptureFixedElements) return;
  for (const item of pagesaverCaptureFixedElements) {
    item.el.style.visibility = item.visibility;
    item.el.style.transition = item.transition;
  }
  pagesaverCaptureFixedElements = null;
}

function startSelectionCapture() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.id = 'pagesaver-selection-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 2147483647; cursor: crosshair;
      background: rgba(6, 16, 12, 0.18);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      user-select: none;
    `;

    const hint = document.createElement('div');
    hint.textContent = 'Drag to capture an area. Press Esc to cancel.';
    hint.style.cssText = `
      position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
      padding: 9px 14px; color: #f8fff9; background: rgba(12, 36, 24, 0.92);
      border: 1px solid rgba(255,255,255,0.28); border-radius: 8px;
      font-size: 13px; font-weight: 700; box-shadow: 0 12px 34px rgba(0,0,0,0.28);
      pointer-events: none;
    `;

    const box = document.createElement('div');
    box.style.cssText = `
      position: fixed; display: none; border: 2px solid #72e07c;
      background: rgba(76, 175, 80, 0.18);
      box-shadow: 0 0 0 9999px rgba(0,0,0,0.34), inset 0 0 0 1px rgba(255,255,255,0.8);
      pointer-events: none;
    `;

    overlay.appendChild(hint);
    overlay.appendChild(box);
    document.documentElement.appendChild(overlay);

    let startX = 0, startY = 0, currentRect = null, dragging = false;

    const cleanup = () => {
      document.removeEventListener('keydown', onKeyDown, true);
      overlay.remove();
    };

    const updateBox = (clientX, clientY) => {
      const left = Math.min(startX, clientX);
      const top = Math.min(startY, clientY);
      const width = Math.abs(clientX - startX);
      const height = Math.abs(clientY - startY);
      currentRect = { left, top, width, height };
      box.style.display = 'block';
      box.style.left = `${left}px`;
      box.style.top = `${top}px`;
      box.style.width = `${width}px`;
      box.style.height = `${height}px`;
    };

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      cleanup();
      resolve({ success: false, cancelled: true });
    };

    overlay.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      updateBox(event.clientX, event.clientY);
      overlay.setPointerCapture(event.pointerId);
    });

    overlay.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      event.preventDefault();
      updateBox(event.clientX, event.clientY);
    });

    overlay.addEventListener('pointerup', (event) => {
      if (!dragging) return;
      event.preventDefault();
      dragging = false;
      updateBox(event.clientX, event.clientY);
      const rect = currentRect;
      cleanup();
      if (!rect || rect.width < 6 || rect.height < 6) {
        resolve({ success: false, cancelled: true });
        return;
      }
      setTimeout(() => {
        resolve({
          success: true,
          rect,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio || 1
        });
      }, 60);
    });

    document.addEventListener('keydown', onKeyDown, true);
  });
}

function startElementCapture() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.id = 'pagesaver-element-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      user-select: none;
    `;

    const hint = document.createElement('div');
    hint.textContent = 'Hover an element, click to capture. Press Esc to cancel.';
    hint.style.cssText = `
      position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
      padding: 9px 14px; color: #f8fff9; background: rgba(12, 36, 24, 0.94);
      border: 1px solid rgba(255,255,255,0.28); border-radius: 8px;
      font-size: 13px; font-weight: 700; box-shadow: 0 12px 34px rgba(0,0,0,0.28);
      pointer-events: none;
    `;

    const box = document.createElement('div');
    box.style.cssText = `
      position: fixed; display: none; border: 2px solid #72e07c;
      background: rgba(76, 175, 80, 0.12);
      box-shadow: 0 0 0 9999px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(255,255,255,0.78);
      pointer-events: none;
    `;

    overlay.appendChild(hint);
    overlay.appendChild(box);
    document.documentElement.appendChild(overlay);

    let selectedElement = null, selectedRect = null;
    let hoverFrame = 0, pendingHoverPoint = null;
    let lastRawElement = null, lastCandidateElement = null;
    const scoreCache = new WeakMap();

    const cleanup = () => {
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
      if (hoverFrame) cancelAnimationFrame(hoverFrame);
      overlay.remove();
    };

    const updateHighlight = (clientX, clientY, force = false) => {
      const raw = document.elementFromPoint(clientX, clientY);
      const candidate = !force && raw === lastRawElement ? lastCandidateElement : chooseCaptureElement(raw, scoreCache);
      lastRawElement = raw;
      lastCandidateElement = candidate;
      selectedElement = candidate;
      if (!candidate) { selectedRect = null; box.style.display = 'none'; return; }
      selectedRect = clampViewportRect(candidate.getBoundingClientRect());
      if (!selectedRect || selectedRect.width < 6 || selectedRect.height < 6) { box.style.display = 'none'; return; }
      box.style.display = 'block';
      box.style.left = `${selectedRect.left}px`;
      box.style.top = `${selectedRect.top}px`;
      box.style.width = `${selectedRect.width}px`;
      box.style.height = `${selectedRect.height}px`;
    };

    const onMouseMove = (event) => {
      pendingHoverPoint = { x: event.clientX, y: event.clientY };
      if (hoverFrame) return;
      hoverFrame = requestAnimationFrame(() => {
        hoverFrame = 0;
        if (pendingHoverPoint) updateHighlight(pendingHoverPoint.x, pendingHoverPoint.y);
      });
    };

    const onClick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (hoverFrame) { cancelAnimationFrame(hoverFrame); hoverFrame = 0; }
      updateHighlight(event.clientX, event.clientY, true);
      const rect = selectedRect;
      const tagName = selectedElement ? selectedElement.tagName : '';
      cleanup();
      if (!rect) { resolve({ success: false, cancelled: true }); return; }
      setTimeout(() => {
        resolve({
          success: true,
          rect,
          element: {
            tagName,
            role: selectedElement?.getAttribute?.('role') || '',
            label: getElementLabel(selectedElement)
          },
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio || 1
        });
      }, 60);
    };

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      cleanup();
      resolve({ success: false, cancelled: true });
    };

    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
  });
}

function chooseCaptureElement(raw, scoreCache) {
  if (!raw || raw.id === 'pagesaver-element-overlay' || raw.closest?.('#pagesaver-element-overlay')) return null;
  const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
  let best = null;
  let el = raw;
  while (el && el !== document.body && el !== document.documentElement) {
    const rect = el.getBoundingClientRect();
    const area = rect.width * rect.height;
    if (rect.width >= 120 && rect.height >= 80 && area <= viewportArea * 0.92 &&
        rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth) {
      const score = scoreCaptureElement(el, area, viewportArea, scoreCache);
      if (!best || score > best.score || (score === best.score && area < best.area)) {
        best = { el, area, score };
      }
    }
    el = el.parentElement;
  }
  return best ? best.el : raw;
}

function scoreCaptureElement(el, area, viewportArea, scoreCache) {
  const areaRatio = area / viewportArea;
  let score = Math.max(0, 60 - areaRatio * 80);
  if (areaRatio >= 0.18 && areaRatio <= 0.55) score += 24;
  if (areaRatio > 0.65) score -= 45;
  return score + getStaticCaptureElementScore(el, scoreCache);
}

function getStaticCaptureElementScore(el, scoreCache) {
  if (scoreCache?.has(el)) return scoreCache.get(el);
  const tag = el.tagName || '';
  const role = el.getAttribute?.('role') || '';
  const testId = el.getAttribute?.('data-testid') || '';
  const className = typeof el.className === 'string' ? el.className : '';
  const id = el.id || '';
  const descriptor = `${tag} ${role} ${testId} ${className} ${id}`;
  let score = 0;
  if (/^(ARTICLE|FIGURE|LI)$/i.test(tag) || role === 'article' || role === 'listitem') score += 35;
  if (/\b(tweet|post|card|tile|panel|product|item|entry|result)\b/i.test(descriptor)) score += 32;
  if (/^(SECTION|MAIN|NAV|HEADER|FOOTER)$/i.test(tag)) score -= 22;
  const style = window.getComputedStyle(el);
  const hasBorder = ['Top', 'Right', 'Bottom', 'Left'].some((side) => parseFloat(style[`border${side}Width`]) > 0);
  const hasCardRadius = parseFloat(style.borderTopLeftRadius) >= 6 || parseFloat(style.borderTopRightRadius) >= 6;
  const hasPaint = style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent';
  if (hasBorder) score += 14;
  if (hasCardRadius) score += 10;
  if (hasPaint) score += 6;
  if (el.querySelector?.('h1,h2,h3,h4,[role="heading"],button,a,img,svg')) score += 10;
  if (el.children.length >= 2) score += 5;
  if (el.children.length > 12) score -= 8;
  scoreCache?.set(el, score);
  return score;
}

function clampViewportRect(rect) {
  const left = Math.max(0, Math.min(window.innerWidth, rect.left));
  const top = Math.max(0, Math.min(window.innerHeight, rect.top));
  const right = Math.max(0, Math.min(window.innerWidth, rect.right));
  const bottom = Math.max(0, Math.min(window.innerHeight, rect.bottom));
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

function getElementLabel(el) {
  if (!el) return '';
  return (el.getAttribute('aria-label') || el.getAttribute('data-testid') || el.tagName || '').slice(0, 80);
}

function collectRedactionSuggestions(scope = 'visible') {
  const patterns = [
    { reason: 'Email address', regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
    { reason: 'Phone number', regex: /(?:\+?\d[\d\s().-]{7,}\d)/g },
    { reason: 'Credit-card-like number', regex: /\b(?:\d[ -]*?){13,19}\b/g },
    { reason: 'API key or token', regex: /\b(?:api[_-]?key|access[_-]?token|secret|bearer|sk|pk)[A-Z0-9_:= .-]{8,}\b/gi },
    { reason: 'Long secret-like value', regex: /\b[A-Za-z0-9_-]{28,}\b/g }
  ];
  const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|SELECT|OPTION)$/i.test(tag)) return NodeFilter.FILTER_REJECT;
      const style = window.getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const results = [];
  let node;
  let id = 0;
  while ((node = walker.nextNode()) && results.length < 120) {
    const text = node.nodeValue;
    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      let match;
      while ((match = pattern.regex.exec(text)) && results.length < 120) {
        const value = match[0] || '';
        if (pattern.reason === 'Phone number' && value.replace(/\D/g, '').length < 9) continue;
        if (pattern.reason === 'Credit-card-like number' && !passesLuhn(value)) continue;
        const range = document.createRange();
        try {
          range.setStart(node, match.index);
          range.setEnd(node, match.index + value.length);
          for (const rect of range.getClientRects()) {
            if (rect.width < 6 || rect.height < 6) continue;
            if (scope === 'visible' && (rect.bottom < 0 || rect.right < 0 || rect.top > window.innerHeight || rect.left > window.innerWidth)) continue;
            results.push({
              id: `redact_${Date.now()}_${id++}`,
              label: pattern.reason,
              reason: pattern.reason,
              rect: { left: rect.left + window.scrollX, top: rect.top + window.scrollY, width: rect.width, height: rect.height }
            });
          }
        } finally {
          range.detach();
        }
      }
    }
  }
  return { success: true, rects: mergeNearbyRedactionRects(results) };
}

function passesLuhn(value) {
  const digits = value.replace(/\D/g, '');
  let sum = 0, shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    if (shouldDouble) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return digits.length >= 13 && sum % 10 === 0;
}

function mergeNearbyRedactionRects(items) {
  return items.map((item) => ({
    ...item,
    rect: {
      left: Math.max(0, Math.floor(item.rect.left - 2)),
      top: Math.max(0, Math.floor(item.rect.top - 2)),
      width: Math.ceil(item.rect.width + 4),
      height: Math.ceil(item.rect.height + 4)
    }
  }));
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script received message:", request);

  if (request.action === "capture") {
    console.log("Received capture request:", request.format);

    // Only check if document exists and is minimally interactive
    if (!document || !document.documentElement) {
      sendResponse({
        success: false,
        error: "Document not available for capture.",
      });
      return true;
    }

    // Check for valid format
    if (!["png", "pdf", "markdown"].includes(request.format)) {
      sendResponse({
        success: false,
        error: `Unsupported format: ${request.format}`,
      });
      return true;
    }

    // Process the capture
    captureFullPage(
      request.format,
      request.readerMode,
      request.pdfPaginationMode
    )
      .then((result) => {
        console.log(
          "Capture process completed:",
          result.success ? "success" : "failed"
        );
        if (!result.success) {
          console.error("Capture error:", result.error);
        }
        sendResponse(result);
      })
      .catch((error) => {
        console.error("Unexpected error during capture:", error);
        sendResponse({
          success: false,
          error: error.message || "An unexpected error occurred",
        });
      });

    return true; // Will respond asynchronously
  } else if (request.action === "extractTextFromImage") {
    console.log("Received extract text request for image:", request.srcUrl);

    if (!request.srcUrl) {
      console.error("No image URL provided");
      sendResponse({
        success: false,
        error: "No image URL provided",
      });
      return true;
    }

    extractTextFromImage(request.srcUrl)
      .then(() => {
        console.log("Text extraction completed successfully");
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("Error extracting text:", error);
        sendResponse({
          success: false,
          error: error.message || "Failed to extract text from image",
        });
      });
    return true; // Will respond asynchronously
  } else if (request.action === "showErrorToast") {
    try {
      const message = request.message || "An error occurred";
      showExtractionErrorMessage(message);
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error?.message || String(error) });
    }
    return true;
  } else if (request.action === "showSuccessToast") {
    try {
      const html = request.messageHtml || "Success";
      showSuccessToast(html);
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error?.message || String(error) });
    }
    return true;
  } else if (request.action === "prepareFullPageCapture") {
    prepareFullPageCapture().then(sendResponse).catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === "restoreScrollPosition") {
    restoreScrollPosition().then(sendResponse).catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === "startSelectionCapture") {
    startSelectionCapture().then(sendResponse).catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === "startElementCapture") {
    startElementCapture().then(sendResponse).catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === "collectRedactionSuggestions") {
    try {
      sendResponse(collectRedactionSuggestions(request.scope));
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
    return true;
  } else if (request.action === "ping") {
    // Allow background to detect that content script is loaded
    sendResponse({ ok: true });
    return true;
  }
});

// Generic success toast (supports HTML content for links)
function showSuccessToast(innerHtml) {
  // Remove any existing notifications
  const existingPopups = document.querySelectorAll(
    ".pagesaver-notification, .pagesaver-popup, .pagesaver-overlay"
  );
  existingPopups.forEach((popup) => {
    if (document.body.contains(popup)) {
      document.body.removeChild(popup);
    }
  });

  const notification = document.createElement("div");
  notification.className = "pagesaver-notification";
  notification.style.cssText = `
    position: fixed;
    bottom: 30px;
    right: 30px;
    background: #1f8f43;
    color: white;
    padding: 16px 24px;
    border-radius: 6px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    align-items: center;
    gap: 12px;
    transform: translateY(100px);
    opacity: 0;
    transition: transform 0.3s ease, opacity 0.3s ease;
    min-width: 280px;
    max-width: 420px;
  `;

  const iconDiv = document.createElement("div");
  iconDiv.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  `;
  iconDiv.style.color = "#ffffff";

  const messageContainer = document.createElement("div");
  messageContainer.style.cssText = `flex: 1; line-height: 1.4;`;
  messageContainer.innerHTML = innerHtml;
  // Ensure links are visible
  messageContainer.querySelectorAll('a').forEach(a => {
    a.style.color = '#fff';
    a.style.textDecoration = 'underline';
  });

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.style.cssText = `
    background: transparent; color: white; border: none; font-size: 18px; cursor: pointer;
  `;
  closeBtn.onclick = () => {
    notification.style.opacity = "0";
    notification.style.transform = "translateY(100px)";
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 300);
  };

  notification.appendChild(iconDiv);
  notification.appendChild(messageContainer);
  notification.appendChild(closeBtn);

  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.transform = "translateY(0)";
    notification.style.opacity = "1";
  }, 10);

  const autoRemoveTimeout = setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transform = "translateY(100px)";
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 5000);

  notification.addEventListener("mouseenter", () => {
    clearTimeout(autoRemoveTimeout);
  });
}

// Enhanced element classification for smart capture positioning
const ElementTypes = {
  HEADER: "header",
  FOOTER: "footer",
  SEARCH: "search",
  NAVIGATION: "navigation",
  SIDEBAR: "sidebar",
  OVERLAY: "overlay",
  STATIC_OVERLAY: "static_overlay", // Elements that should only appear on first page
  STICKY: "sticky",
  UNKNOWN: "unknown",
};

// Helper function to generate a useful CSS selector for an element
function getElementSelector(element) {
  if (!element || !element.tagName) return "unknown";

  let selector = element.tagName.toLowerCase();

  // Add ID if present
  if (element.id) {
    selector += `#${element.id}`;
  }

  // Add first few classes if present
  if (element.className && typeof element.className === "string") {
    const classes = element.className.trim().split(/\s+/).slice(0, 3); // Limit to first 3 classes
    if (classes.length > 0 && classes[0]) {
      selector += "." + classes.join(".");
    }
  }

  // Add position info for context
  const rect = element.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    selector += ` [${Math.round(rect.width)}×${Math.round(rect.height)}]`;
  }

  return selector;
}

// Enhanced element classification
function classifyProblematicElement(element, computedStyle) {
  const rect = element.getBoundingClientRect();
  const tagName = element.tagName ? element.tagName.toLowerCase() : "";
  const className =
    element.className && typeof element.className === "string"
      ? element.className.toLowerCase()
      : "";
  const id = element.id ? element.id.toLowerCase() : "";
  const textContent = element.textContent
    ? element.textContent.toLowerCase()
    : "";

  // Special handling for sticky elements - classify by document position
  if (computedStyle.position === "sticky") {
    // Get the element's position in the document flow
    const documentHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );

    // Calculate where this element would be in the document
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const elementDocumentTop = rect.top + scrollTop;
    const documentPosition = elementDocumentTop / documentHeight;

    // Classify sticky elements based on their document position
    if (documentPosition < 0.2) {
      return ElementTypes.HEADER; // Top 20% of document
    } else if (documentPosition > 0.8) {
      return ElementTypes.FOOTER; // Bottom 20% of document
    } else {
      return ElementTypes.STICKY; // Middle section
    }
  }

  // Header classification
  if (
    tagName === "header" ||
    className.includes("header") ||
    className.includes("navbar") ||
    className.includes("nav-bar") ||
    className.includes("topbar") ||
    className.includes("top-bar") ||
    id.includes("header") ||
    id.includes("navbar") ||
    (rect.top <= 100 && rect.height < window.innerHeight * 0.3) // Top area, not too tall
  ) {
    return ElementTypes.HEADER;
  }

  // Search-specific classification
  if (
    id.includes("search") ||
    className.includes("search") ||
    (tagName === "form" && element.querySelector('input[type="search"]')) ||
    id === "searchform" ||
    className.includes("searchbar") ||
    textContent.includes("search")
  ) {
    return ElementTypes.SEARCH;
  }

  // Footer classification
  if (
    tagName === "footer" ||
    className.includes("footer") ||
    id.includes("footer") ||
    (rect.bottom >= window.innerHeight - 100 &&
      rect.height < window.innerHeight * 0.3) // Bottom area, not too tall
  ) {
    return ElementTypes.FOOTER;
  }

  // Navigation classification
  if (
    tagName === "nav" ||
    className.includes("navigation") ||
    className.includes("menu") ||
    id.includes("menu") ||
    element.getAttribute("role") === "navigation"
  ) {
    return ElementTypes.NAVIGATION;
  }

  // Sidebar classification
  if (
    className.includes("sidebar") ||
    className.includes("side-bar") ||
    id.includes("sidebar") ||
    (rect.width < window.innerWidth * 0.3 &&
      rect.height > window.innerHeight * 0.5) // Narrow and tall
  ) {
    return ElementTypes.SIDEBAR;
  }

  // Overlay classification (things that should always be hidden)
  if (
    className.includes("overlay") ||
    className.includes("modal") ||
    className.includes("popup") ||
    className.includes("tooltip") ||
    computedStyle.zIndex > 1000
  ) {
    return ElementTypes.OVERLAY;
  }

  return ElementTypes.UNKNOWN;
}

// Enhanced element data structure with classification
function createEnhancedElementData(element, computedStyle) {
  const basicData = createElementData(element, computedStyle);
  const elementType = classifyProblematicElement(element, computedStyle);
  const rect = element.getBoundingClientRect();

  // For sticky elements, calculate their true document position more carefully
  let documentPosition = null;
  if (computedStyle.position === "sticky") {
    try {
      // Save the current scroll position
      const currentScrollTop =
        window.pageYOffset || document.documentElement.scrollTop;

      // Method 1: Try to get position by temporarily disabling sticky (safer approach)
      const originalPosition = element.style.position;
      const originalDisplay = element.style.display;

      // Temporarily make static and hidden to avoid layout shifts
      element.style.position = "static";
      element.style.visibility = "hidden";

      // Force reflow to get accurate position
      element.offsetHeight;
      const staticRect = element.getBoundingClientRect();
      const trueDocumentTop = staticRect.top + currentScrollTop;

      // Restore original styles immediately
      element.style.position = originalPosition;
      element.style.visibility = "";

      // Force reflow again to restore layout
      element.offsetHeight;

      const documentHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );

      documentPosition = {
        documentTop: trueDocumentTop,
        documentHeight: documentHeight,
        relativePosition: trueDocumentTop / documentHeight,
      };
    } catch (error) {
      console.warn(
        "Failed to calculate sticky element position, using fallback:",
        error
      );
      // Fallback: use current position as approximation
      const currentScrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
      const approximateDocumentTop = rect.top + currentScrollTop;
      const documentHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );

      documentPosition = {
        documentTop: approximateDocumentTop,
        documentHeight: documentHeight,
        relativePosition: approximateDocumentTop / documentHeight,
      };
    }
  }

  return {
    ...basicData,
    type: elementType,
    position: {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom,
      right: rect.right,
    },
    documentPosition: documentPosition,
    zIndex: parseInt(computedStyle.zIndex) || 0,
  };
}

// Determine which elements to hide for each capture
function getElementsToHideForCapture(allElements, captureIndex, totalCaptures) {
  const elementsToHide = [];

  allElements.forEach((elementData) => {
    const { type } = elementData;

    switch (type) {
      case ElementTypes.HEADER:
      case ElementTypes.SEARCH:
        // Hide headers/search in all captures except the first one
        if (captureIndex > 0) {
          elementsToHide.push(elementData);
        }
        break;

      case ElementTypes.FOOTER:
        // Hide footers in all captures except the last one
        if (captureIndex < totalCaptures - 1) {
          elementsToHide.push(elementData);
        }
        break;

      case ElementTypes.NAVIGATION:
        // For navigation, decide based on position
        if (elementData.position.top < window.innerHeight / 2) {
          // Top navigation - only show in first capture
          if (captureIndex > 0) {
            elementsToHide.push(elementData);
          }
        } else {
          // Bottom navigation - only show in last capture
          if (captureIndex < totalCaptures - 1) {
            elementsToHide.push(elementData);
          }
        }
        break;

      case ElementTypes.SIDEBAR:
        // Sidebars can appear in all captures, but we might want to handle them specially
        // For now, let them appear in all captures
        break;

      case ElementTypes.STICKY:
        // For sticky elements, use their stored true document position
        if (elementData.documentPosition) {
          const elementDocumentTop = elementData.documentPosition.documentTop;
          const documentHeight = elementData.documentPosition.documentHeight;

          // Calculate which capture this sticky element should appear in
          const elementSection = Math.floor(
            (elementDocumentTop / documentHeight) * totalCaptures
          );
          const targetCapture = Math.min(
            Math.max(0, elementSection),
            totalCaptures - 1
          );

          // Hide sticky element in all captures except its target capture
          if (captureIndex !== targetCapture) {
            elementsToHide.push(elementData);
          }
        } else {
          // Fallback: hide if no document position stored
          elementsToHide.push(elementData);
        }
        break;

      case ElementTypes.OVERLAY:
      case ElementTypes.UNKNOWN:
        // Always hide overlays and unknown elements
        elementsToHide.push(elementData);
        break;
    }
  });

  return elementsToHide;
}
// Adjust scroll position to ensure sticky elements are fully visible
function adjustScrollPositionForStickyElements(
  scrollTop,
  stickyElements,
  viewportHeight
) {
  if (stickyElements.length === 0) return scrollTop;

  let adjustedScrollTop = scrollTop;
  let maxAdjustment = 0;

  console.log(
    `Checking ${stickyElements.length} sticky elements for visibility adjustments`
  );

  stickyElements.forEach((elementData) => {
    if (elementData.documentPosition) {
      const elementHeight = elementData.position.height;
      const elementDocumentTop = elementData.documentPosition.documentTop;

      console.log(
        `Sticky element: documentTop=${Math.round(
          elementDocumentTop
        )}, height=${Math.round(elementHeight)}, scrollTop=${Math.round(
          scrollTop
        )}`
      );

      // Calculate where the element would be on screen at the current scroll position
      const elementScreenTop = elementDocumentTop - scrollTop;
      const elementScreenBottom = elementScreenTop + elementHeight;

      console.log(
        `Screen position: top=${Math.round(
          elementScreenTop
        )}, bottom=${Math.round(
          elementScreenBottom
        )}, viewport=${viewportHeight}`
      );

      // Calculate optimal scroll position to center the element
      const idealScrollTop =
        elementDocumentTop - viewportHeight / 2 + elementHeight / 2;

      // If element would be partially clipped at top of viewport
      if (elementScreenTop < 0 && elementScreenTop > -elementHeight) {
        console.log(`Element clipped at top, adjusting scroll`);
        const adjustment = Math.max(0, elementDocumentTop - 20); // 20px padding
        adjustedScrollTop = Math.min(adjustedScrollTop, adjustment);
        maxAdjustment = Math.max(
          maxAdjustment,
          Math.abs(scrollTop - adjustment)
        );
      }

      // If element would be partially clipped at bottom of viewport
      else if (
        elementScreenBottom > viewportHeight &&
        elementScreenTop < viewportHeight
      ) {
        console.log(`Element clipped at bottom, adjusting scroll`);
        const adjustment =
          elementDocumentTop - viewportHeight + elementHeight + 20; // 20px padding
        adjustedScrollTop = Math.max(adjustedScrollTop, adjustment);
        maxAdjustment = Math.max(
          maxAdjustment,
          Math.abs(scrollTop - adjustment)
        );
      }

      // If element is completely outside viewport, center it
      else if (elementScreenTop >= viewportHeight || elementScreenBottom <= 0) {
        console.log(`Element outside viewport, centering`);
        adjustedScrollTop = idealScrollTop;
        maxAdjustment = Math.max(
          maxAdjustment,
          Math.abs(scrollTop - idealScrollTop)
        );
      }
    }
  });

  // Don't make huge adjustments that might break the capture sequence
  if (maxAdjustment > viewportHeight) {
    console.log(
      `Large adjustment detected (${Math.round(
        maxAdjustment
      )}px), limiting to viewport height`
    );
    const direction = adjustedScrollTop > scrollTop ? 1 : -1;
    adjustedScrollTop = scrollTop + direction * viewportHeight * 0.5;
  }

  // Ensure we don't scroll beyond document bounds
  const documentHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight
  );
  adjustedScrollTop = Math.max(
    0,
    Math.min(adjustedScrollTop, documentHeight - viewportHeight)
  );

  if (adjustedScrollTop !== scrollTop) {
    console.log(
      `Final scroll adjustment: ${Math.round(scrollTop)} → ${Math.round(
        adjustedScrollTop
      )} (${Math.round(adjustedScrollTop - scrollTop)}px)`
    );
  }

  return adjustedScrollTop;
}

// ========== SCROLLING SCENARIO DETECTION ==========

// Scrolling scenarios enum
const ScrollingScenarios = {
  DOCUMENT_SCROLL: "document_scroll", // Scenario 1: Entire document scrolls
  ELEMENT_SCROLL: "element_scroll", // Scenario 2: Specific element scrolls
};

// Detect which scrolling scenario applies to the current page
function detectScrollingScenario() {
  try {
    // Get initial document and viewport dimensions
    const { documentHeight, viewportHeight } = getPageDimensions();

    // If document height is significantly larger than viewport, likely document scroll
    if (documentHeight > viewportHeight + 100) {
      // Test if the document actually scrolls
      const originalScrollTop =
        window.pageYOffset || document.documentElement.scrollTop;

      // Try to scroll the document a small amount
      window.scrollTo(0, originalScrollTop + 10);
      const newScrollTop =
        window.pageYOffset || document.documentElement.scrollTop;

      // Restore original position
      window.scrollTo(0, originalScrollTop);

      if (newScrollTop !== originalScrollTop) {
        return {
          scenario: ScrollingScenarios.DOCUMENT_SCROLL,
          scrollableElement: null,
          documentHeight,
          viewportHeight,
        };
      }
    }

    // Check for scrollable elements (scenario 2)
    const scrollableCandidate = findPrimaryScrollableElement();
    if (scrollableCandidate) {
      // NEW: Check if the scrollable element is large enough relative to document height
      // If element height is less than 50% of document height, don't use element_scroll
      const comparisonHeight = getScrollableCandidateComparisonHeight(
        scrollableCandidate,
        viewportHeight,
        documentHeight
      );
      const elementHeightRatio =
        comparisonHeight > 0
          ? scrollableCandidate.clientHeight / comparisonHeight
          : 0;
      
      console.log(
        `Scrollable element height ratio: ${(elementHeightRatio * 100).toFixed(1)}% of comparison height`
      );
      console.log(
        `Element height: ${scrollableCandidate.clientHeight}px, Comparison height: ${comparisonHeight}px`
      );
      
      if (elementHeightRatio >= 0.5) {
        console.log("Using element_scroll strategy - element is large enough (≥50% of document height)");
        return {
          scenario: ScrollingScenarios.ELEMENT_SCROLL,
          scrollableElement: scrollableCandidate.element,
          elementHeight: scrollableCandidate.scrollHeight,
          viewportHeight: scrollableCandidate.clientHeight,
        };
      } else {
        console.log("Element is too small (<50% of document height), falling back to document_scroll strategy");
      }
    }

    // Default to document scroll if no specific scrollable element found
    // or if the scrollable element is too small relative to document height
    console.log(
      "No suitable scrollable element found, defaulting to document scroll"
    );
    return {
      scenario: ScrollingScenarios.DOCUMENT_SCROLL,
      scrollableElement: null,
      documentHeight,
      viewportHeight,
    };
  } catch (error) {
    console.warn(
      "Error detecting scrolling scenario, defaulting to document scroll:",
      error
    );
    const { documentHeight, viewportHeight } = getPageDimensions();
    return {
      scenario: ScrollingScenarios.DOCUMENT_SCROLL,
      scrollableElement: null,
      documentHeight,
      viewportHeight,
    };
  }
}

function getScrollableCandidateComparisonHeight(
  scrollableCandidate,
  viewportHeight,
  documentHeight
) {
  if (scrollableCandidate.containerIframe) {
    const iframeHeight = scrollableCandidate.containerIframe.clientHeight || 0;
    return Math.max(iframeHeight, viewportHeight, 1);
  }
  return Math.max(documentHeight, 1);
}

// Find the primary scrollable element on the page
function findPrimaryScrollableElement() {
  console.log("Looking for primary scrollable element...");

  const candidates = [];
  const scrollableSelectors = getScrollableSelectors();

  addScrollableCandidatesFromSelectors({
    rootDocument: document,
    selectors: scrollableSelectors,
    candidates,
  });

  addScrollableCandidatesFromAllElements({
    rootDocument: document,
    candidates,
  });

  addScrollableCandidatesFromIframes({
    selectors: scrollableSelectors,
    candidates,
  });

  return selectBestScrollableCandidate(candidates);
}

function getScrollableSelectors() {
  return [
    // ChatGPT and similar chat interfaces
    '[class*="conversation"]',
    '[id*="conversation"]',
    '[class*="messages"]',
    '[id*="messages"]',
    '[class*="chat"]',
    '[id*="chat"]',

    // General content areas
    '[class*="main-content"]',
    '[id*="main-content"]',
    '[class*="content-area"]',
    '[id*="content-area"]',
    '[class*="scroll"]',
    '[id*="scroll"]',

    // Common frameworks and patterns
    ".overflow-auto",
    ".overflow-y-auto",
    ".overflow-scroll",
    '[style*="overflow-y: auto"]',
    '[style*="overflow-y: scroll"]',
    '[style*="overflow: auto"]',
    '[style*="overflow: scroll"]',

    // Specific application patterns
    'main[role="main"]',
    '[role="main"]',
    ".content",
    "#content",
  ];
}

function addScrollableCandidatesFromSelectors({
  rootDocument,
  selectors,
  candidates,
  containerIframe = null,
}) {
  selectors.forEach((selector) => {
    try {
      const elements = rootDocument.querySelectorAll(selector);
      elements.forEach((element) => {
        addScrollableCandidate({
          element,
          selector,
          candidates,
          containerIframe,
        });
      });
    } catch (e) {
      console.warn(`Error checking selector ${selector}:`, e);
    }
  });
}

function addScrollableCandidatesFromAllElements({
  rootDocument,
  candidates,
  containerIframe = null,
}) {
  const allElements = rootDocument.querySelectorAll("*");
  Array.from(allElements).forEach((element) => {
    if (!isElementScrollable(element)) return;
    if (candidates.find((c) => c.element === element)) return;

    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;
    const scrollableHeight = scrollHeight - clientHeight;

    if (scrollableHeight > 200) {
      addScrollableCandidate({
        element,
        selector: getElementSelector(element),
        candidates,
        containerIframe,
      });
    }
  });
}

function addScrollableCandidatesFromIframes({ selectors, candidates }) {
  const iframes = getSameOriginIframes();
  if (!iframes.length) return;

  iframes.forEach((iframe) => {
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) return;

    addScrollableCandidatesFromSelectors({
      rootDocument: iframeDoc,
      selectors,
      candidates,
      containerIframe: iframe,
    });

    addScrollableCandidatesFromAllElements({
      rootDocument: iframeDoc,
      candidates,
      containerIframe: iframe,
    });

    addScrollableDocumentCandidate({
      rootDocument: iframeDoc,
      candidates,
      containerIframe: iframe,
    });
  });
}

function getSameOriginIframes() {
  return Array.from(document.querySelectorAll("iframe")).filter((iframe) => {
    try {
      return !!iframe.contentDocument;
    } catch (e) {
      return false;
    }
  });
}

function addScrollableCandidate({
  element,
  selector,
  candidates,
  containerIframe = null,
}) {
  if (!isElementScrollable(element)) return;

  const scrollHeight = element.scrollHeight;
  const clientHeight = element.clientHeight;
  const scrollableHeight = scrollHeight - clientHeight;

  candidates.push({
    element,
    selector: containerIframe
      ? `${getIframeLabel(containerIframe)} ${selector}`
      : selector,
    scrollHeight,
    clientHeight,
    scrollableHeight,
    priority: calculateScrollablePriority(element, selector, containerIframe),
    containerIframe,
  });
}

function addScrollableDocumentCandidate({
  rootDocument,
  candidates,
  containerIframe = null,
}) {
  const scrollElement =
    rootDocument.scrollingElement ||
    rootDocument.documentElement ||
    rootDocument.body;
  if (!scrollElement) return;

  const scrollHeight = scrollElement.scrollHeight;
  const clientHeight = scrollElement.clientHeight;
  if (scrollHeight <= clientHeight + 10) return;

  candidates.push({
    element: scrollElement,
    selector: containerIframe
      ? `${getIframeLabel(containerIframe)} document`
      : "document",
    scrollHeight,
    clientHeight,
    scrollableHeight: scrollHeight - clientHeight,
    priority: calculateScrollablePriority(scrollElement, "", containerIframe),
    containerIframe,
  });
}

function selectBestScrollableCandidate(candidates) {
  if (candidates.length === 0) {
    console.log("No scrollable elements found");
    return null;
  }

  candidates.sort((a, b) => b.priority - a.priority);

  console.log(`Found ${candidates.length} scrollable elements:`);
  candidates.forEach((candidate, index) => {
    console.log(
      `  ${index + 1}. ${candidate.selector} - ${
        candidate.scrollableHeight
      }px scrollable (priority: ${candidate.priority})`
    );
  });

  return candidates[0];
}

// Check if an element is scrollable
function isElementScrollable(element) {
  try {
    const docView =
      (element && element.ownerDocument && element.ownerDocument.defaultView) ||
      window;
    const style = docView.getComputedStyle(element);
    const hasScrollableOverflow =
      style.overflowY === "auto" ||
      style.overflowY === "scroll" ||
      style.overflow === "auto" ||
      style.overflow === "scroll";

    const hasScrollableContent = element.scrollHeight > element.clientHeight;
    const hasHeight = element.clientHeight > 0;

    return hasScrollableOverflow && hasScrollableContent && hasHeight;
  } catch (e) {
    return false;
  }
}

// Calculate priority for scrollable elements
function calculateScrollablePriority(element, selector, containerIframe = null) {
  let priority = 0;

  // Base priority on scrollable content amount
  const scrollableHeight = element.scrollHeight - element.clientHeight;
  priority += Math.min(scrollableHeight / 100, 50); // Max 50 points for height

  // Higher priority for elements that take up significant viewport space
  const rect = getScrollableCandidateRect(element, containerIframe);
  const viewportCoverage =
    (rect.width * rect.height) / (window.innerWidth * window.innerHeight);
  priority += viewportCoverage * 30; // Max 30 points for viewport coverage

  // Bonus for specific selectors that are likely to be main content
  if (
    selector.includes("conversation") ||
    selector.includes("messages") ||
    selector.includes("chat")
  ) {
    priority += 20;
  }
  if (selector.includes("main") || selector.includes("content")) {
    priority += 15;
  }
  if (element.tagName === "MAIN" || element.getAttribute("role") === "main") {
    priority += 10;
  }

  return priority;
}

function getScrollableCandidateRect(element, containerIframe) {
  try {
    if (containerIframe) {
      return containerIframe.getBoundingClientRect();
    }
    return element.getBoundingClientRect();
  } catch (e) {
    return { width: 0, height: 0 };
  }
}

function getIframeLabel(iframe) {
  const iframeId = iframe.id ? `#${iframe.id}` : "";
  const iframeName = iframe.name ? `[name="${iframe.name}"]` : "";
  return `iframe${iframeId || iframeName || ""}`.trim();
}

// ========== ELEMENT SCROLLING SCENARIO HANDLER ==========

function getScrollContainerElement(scrollableElement) {
  if (!scrollableElement) return null;
  if (scrollableElement.ownerDocument === document) return scrollableElement;
  return findContainingIframeForDocument(scrollableElement.ownerDocument) || scrollableElement;
}

function findContainingIframeForDocument(targetDocument) {
  if (!targetDocument) return null;
  const iframes = document.querySelectorAll("iframe");
  for (const iframe of iframes) {
    try {
      if (iframe.contentDocument === targetDocument) {
        return iframe;
      }
    } catch (e) {
      // Ignore cross-origin iframes
    }
  }
  return null;
}

function getCaptureCropRect(containerRect) {
  if (!containerRect) return null;
  const viewportWidth = window.innerWidth || 0;
  const viewportHeight = window.innerHeight || 0;
  const left = Math.max(0, Math.round(containerRect.left));
  const top = Math.max(0, Math.round(containerRect.top));
  const right = Math.min(viewportWidth, Math.round(containerRect.right));
  const bottom = Math.min(viewportHeight, Math.round(containerRect.bottom));
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  if (!width || !height) return null;
  return { left, top, width, height };
}

function getContentBoxRect(element) {
  if (!element || typeof element.getBoundingClientRect !== "function") {
    return null;
  }
  const rect = element.getBoundingClientRect();
  const left = rect.left + (element.clientLeft || 0);
  const top = rect.top + (element.clientTop || 0);
  const width = element.clientWidth || rect.width;
  const height = element.clientHeight || rect.height;
  return { left, top, right: left + width, bottom: top + height };
}

// Handle PDF generation for element scrolling scenario (scenario 2)
async function generateElementScrollPDF(
  scrollableElement,
  elementHeight,
  viewportHeight,
  scale,
  { html2canvas, jsPDF }
) {
  const progressIndicator = createPDFProgressIndicator();
  let restoreScrollbars;

  try {
    progressIndicator.setProgress(
      5,
      "Initializing element scroll PDF generation..."
    );

    // Create PDF with compression using config
    const doc = new jsPDF({
      orientation: CaptureConfig.PDF.orientation,
      unit: CaptureConfig.PDF.unit,
      format: CaptureConfig.PDF.format,
      compress: true,
      putOnlyUsedFonts: true,
      precision: 16,
    });

    progressIndicator.setProgress(10, "Analyzing scrollable element...");

    // Detect non-scrollable (fixed / sticky) UI so that we can hide them per capture.
    progressIndicator.setProgress(15, "Identifying fixed elements...");
    const initialElements = detectInitialProblematicElements();
    const commonElements = detectCommonProblematicElements();
    const delayedElements = await detectDelayedProblematicElements();
    let problematicElements = mergeMultipleProblematicElements([
      initialElements,
      commonElements,
      delayedElements,
    ]);

    const scrollContainerElement = getScrollContainerElement(scrollableElement);
    const scrollContainerRect = scrollContainerElement
      ? scrollContainerElement.getBoundingClientRect()
      : scrollableElement.getBoundingClientRect();
    const scrollContainerContentRect = scrollContainerElement
      ? getContentBoxRect(scrollContainerElement)
      : getContentBoxRect(scrollableElement);
    const captureCropRect = getCaptureCropRect(
      scrollContainerContentRect || scrollContainerRect
    );

    console.log("Element scroll crop rect:", {
      scrollContainerRect: scrollContainerRect ? {
        top: Math.round(scrollContainerRect.top),
        left: Math.round(scrollContainerRect.left),
        width: Math.round(scrollContainerRect.width),
        height: Math.round(scrollContainerRect.height),
      } : null,
      scrollContainerContentRect: scrollContainerContentRect ? {
        top: Math.round(scrollContainerContentRect.top),
        left: Math.round(scrollContainerContentRect.left),
        width: scrollContainerContentRect.right - scrollContainerContentRect.left,
        height: scrollContainerContentRect.bottom - scrollContainerContentRect.top,
      } : null,
      captureCropRect,
      viewportSize: { width: window.innerWidth, height: window.innerHeight },
    });

    // ** COMPREHENSIVE LOGIC FOR SCENARIO 2 **
    // In element scrolling scenario, ALL elements outside the scrollable container
    // should be treated as non-scrollable and positioned appropriately

    // Get all visible elements in the document
    const allElements = Array.from(document.querySelectorAll("*")).filter(
      (el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          style.opacity !== "0"
        );
      }
    );

    // Find elements that are outside the scrollable container
    const outsideElements = allElements.filter((el) => {
      if (scrollContainerElement && el === scrollContainerElement) return false;
      // Skip if element is inside the scrollable container
      if (scrollContainerElement && scrollContainerElement.contains(el))
        return false;

      // Skip if element contains the scrollable container (parent elements)
      if (scrollContainerElement && el.contains(scrollContainerElement))
        return false;

      // Skip script, style, meta tags
      if (["SCRIPT", "STYLE", "META", "LINK", "TITLE"].includes(el.tagName))
        return false;

      return true;
    });

    const newProblematicElements = [];
    outsideElements.forEach((el) => {
      // Check if this element is already contained within an existing problematic element
      const alreadyContained = problematicElements.some((p) =>
        p.element.contains(el)
      );
      if (!alreadyContained) {
        const computedStyle = window.getComputedStyle(el);
        const elementData = createEnhancedElementData(el, computedStyle);

        // Classify based on position relative to scrollable element
        const rect = el.getBoundingClientRect();
        const scrollableRect = scrollContainerRect;

        if (rect.bottom <= scrollableRect.top + 50) {
          // Element is above scrollable area - treat as header
          elementData.type = ElementTypes.HEADER;
        } else if (rect.top >= scrollableRect.bottom - 50) {
          // Element is below scrollable area - treat as footer
          elementData.type = ElementTypes.FOOTER;
        } else if (rect.right <= scrollableRect.left + 50) {
          // Element is to the left of scrollable area - treat as sidebar
          elementData.type = ElementTypes.SIDEBAR;
        } else if (rect.left >= scrollableRect.right - 50) {
          // Element is to the right of scrollable area - treat as sidebar
          elementData.type = ElementTypes.SIDEBAR;
        } else {
          // Element overlaps with scrollable area - treat as overlay
          elementData.type = ElementTypes.OVERLAY;
        }

        newProblematicElements.push(elementData);
      }
    });

    if (newProblematicElements.length > 0) {
      problematicElements = mergeMultipleProblematicElements([
        problematicElements,
        newProblematicElements,
      ]);
    }
    // ** END COMPREHENSIVE LOGIC **

    // Store original scroll positions (both page and element)
    const originalPageScrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const originalPageScrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const originalElementScrollTop = scrollableElement.scrollTop;

    // Calculate scroll positions for the scrollable element
    const { scrollPositions, numCaptures } = calculateElementScrollPositions(
      elementHeight,
      viewportHeight
    );

    progressIndicator.setProgress(20, "Starting element capture...");

    // Temporarily hide scrollbars during capture to avoid them appearing in screenshots
    restoreScrollbars = hideScrollbarsTemporarily();

    // Array to store captured images with metadata
    const capturedImages = [];

    // Hide progress indicator during captures
    progressIndicator.hide();

    // Capture each section of the scrollable element
    for (let i = 0; i < numCaptures; i++) {
      const scrollTop = scrollPositions[i];
      console.log(
        `Capturing element section ${
          i + 1
        }/${numCaptures} at scroll position ${scrollTop}px`
      );

      // Update progress
      const captureProgress = 25 + Math.round(((i + 1) / numCaptures) * 40);
      progressIndicator.setProgress(
        captureProgress,
        `Scrolling to section ${i + 1}/${numCaptures}...`
      );

      try {
        // Smooth scroll the element to position
        await smoothScrollElementToPosition(
          scrollableElement,
          scrollTop,
          i,
          numCaptures,
          progressIndicator
        );

        // After scrolling, detect any new dynamic fixed elements that appeared
        try {
          const newlyFixed = detectDynamicFixedElements(problematicElements);
          if (newlyFixed.length > 0) {
            problematicElements.push(...newlyFixed);
          }
        } catch (dynErr) {
          console.warn(
            "Dynamic detection failed inside element scroll loop:",
            dynErr
          );
        }

        // Determine which elements to hide for this capture
        const elementsToHide = getElementsToHideForCapture(
          problematicElements,
          i,
          numCaptures
        );
        hideProblematicElements(elementsToHide);

        // Additional safeguard: Explicitly hide all PageSaver elements during capture
        const pageSaverElements = document.querySelectorAll(
          '[id*="pagesaver"], [class*="pagesaver"]'
        );
        const originalPageSaverStyles = [];
        pageSaverElements.forEach((el, index) => {
          originalPageSaverStyles[index] = el.style.display;
          el.style.display = "none";
        });

        // Ensure style changes are rendered
        await new Promise((r) => setTimeout(r, 50));

        // Update progress to show we're now capturing
        progressIndicator.setProgress(
          captureProgress,
          `Capturing section ${i + 1}/${numCaptures}...`
        );

        // Wait for content to load
        await new Promise((resolve) =>
          setTimeout(resolve, i === 0 ? 200 : 100)
        );

        // CRITICAL: Recalculate crop rect for THIS capture after scrolling
        // The scrollable element's position may shift due to UI changes (rulers, headers, etc.)
        const currentScrollContainerRect = scrollContainerElement
          ? scrollContainerElement.getBoundingClientRect()
          : scrollableElement.getBoundingClientRect();
        const currentContentRect = scrollContainerElement
          ? getContentBoxRect(scrollContainerElement)
          : getContentBoxRect(scrollableElement);
        const currentCropRect = getCaptureCropRect(
          currentContentRect || currentScrollContainerRect
        );

        if (i > 0 && currentCropRect && captureCropRect) {
          const topDiff = Math.abs(currentCropRect.top - captureCropRect.top);
          if (topDiff > 5) {
            console.log(`Crop rect shifted by ${topDiff}px for frame ${i}:`, {
              original: captureCropRect,
              current: currentCropRect,
            });
          }
        }

        let captureDataUrl;
        try {
          // Capture using Chrome API
          captureDataUrl = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error("Capture timeout"));
            }, 10000);
            chrome.runtime.sendMessage(
              { action: "captureVisibleTab" },
              (response) => {
                clearTimeout(timeout);
                if (response && response.success) {
                  resolve(response.dataUrl);
                } else {
                  reject(
                    new Error(
                      response?.error || "Failed to capture visible tab"
                    )
                  );
                }
              }
            );
          });
        } finally {
          // Restore PageSaver elements
          pageSaverElements.forEach((el, index) => {
            el.style.display = originalPageSaverStyles[index];
          });

          // Always restore elements even if capture fails
          restoreProblematicElements(elementsToHide);
        }

        // Store captured image with metadata - use CURRENT crop rect for this frame
        capturedImages.push({
          dataUrl: captureDataUrl,
          scrollTop: scrollTop,
          actualScrollTop: scrollableElement.scrollTop,
          index: i,
          viewportHeight: viewportHeight,
          cropRect: currentCropRect || captureCropRect,
          captureViewportWidth: window.innerWidth,
          captureViewportHeight: window.innerHeight,
        });

        // Rate limiting
        if (i < numCaptures - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      } catch (captureError) {
        console.warn(
          `Failed to capture element section ${i + 1}:`,
          captureError
        );

        // Restore PageSaver elements on error
        if (
          typeof pageSaverElements !== "undefined" &&
          typeof originalPageSaverStyles !== "undefined"
        ) {
          pageSaverElements.forEach((el, index) => {
            el.style.display = originalPageSaverStyles[index];
          });
        }

        // Restore all problematic elements if an error occurs during capture
        restoreProblematicElements(problematicElements);

        // Create a placeholder
        const { viewportWidth } = getPageDimensions();
        const placeholderDataUrl = createPlaceholder(
          viewportWidth,
          viewportHeight
        );

        capturedImages.push({
          dataUrl: placeholderDataUrl,
          scrollTop: scrollTop,
          actualScrollTop: scrollableElement.scrollTop,
          index: i,
          viewportHeight: viewportHeight,
          cropRect: captureCropRect,
          captureViewportWidth: window.innerWidth,
          captureViewportHeight: window.innerHeight,
          isPlaceholder: true,
        });
      }
    }

    // Restore original scroll position
    scrollableElement.scrollTop = originalElementScrollTop;

    // Process captured images similar to document scroll
    progressIndicator.show();
    progressIndicator.setProgress(70, "Stitching images together...");

    // Calculate canvas dimensions
    const { viewportWidth } = getPageDimensions();
    const targetCanvasWidth =
      scrollableElement.clientWidth || scrollContainerRect.width || viewportWidth;
    const { canvasWidth, canvasHeight } = calculateCanvasDimensions(
      targetCanvasWidth,
      elementHeight
    );

    // Stitch images together
    const stitchedCanvas = await stitchImages(
      capturedImages,
      canvasWidth,
      canvasHeight,
      elementHeight,
      viewportHeight,
      CaptureConfig.CAPTURE.minOverlap
    );

    progressIndicator.setProgress(85, "Converting to PDF format...");

    // Convert canvas to image data using helper function
    const jpegDataUrl = convertCanvasToImageData(stitchedCanvas);

    progressIndicator.setProgress(95, "Adding content to PDF...");

    // Add image to PDF; support single-page mode
    const imgHeight =
      (stitchedCanvas.height / canvasWidth) * CaptureConfig.PDF.width;
    const imageFormat = jpegDataUrl.startsWith("data:image/png")
      ? "PNG"
      : "JPEG";

    if (PDFPaginationMode === 'single') {
      const reserveMm = estimateSourceSectionReserveMm(doc, CaptureConfig.PDF.width, window.location.href);
      const totalHeight = imgHeight + reserveMm;
      const singleDoc = new jsPDF({
        orientation: CaptureConfig.PDF.orientation,
        unit: CaptureConfig.PDF.unit,
        format: [CaptureConfig.PDF.width, Math.max(1, totalHeight)],
        compress: true,
        putOnlyUsedFonts: true,
        precision: 16,
      });
      singleDoc.addImage(jpegDataUrl, imageFormat, 0, 0, CaptureConfig.PDF.width, imgHeight, '', 'FAST');
      if (PageSaverSourceSection.enabledForPDF) {
        await addSourceSectionToPDF(singleDoc, window.location.href, 1, 'bottom');
      }
      await addWatermarkToPDF(singleDoc, 1);
      const pdfData = singleDoc.output('datauristring');
      progressIndicator.complete('PDF generated successfully!');
      return { success: true, dataUrl: pdfData, format: 'pdf' };
    } else {
      let heightLeft = imgHeight;
      let position = 0;
      let currentPage = 1;

      doc.addImage(jpegDataUrl, imageFormat, 0, position, CaptureConfig.PDF.width, imgHeight, '', 'FAST');
      heightLeft -= CaptureConfig.PDF.height;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        doc.addPage();
        currentPage++;
        doc.addImage(jpegDataUrl, imageFormat, 0, position, CaptureConfig.PDF.width, imgHeight, '', 'FAST');
        heightLeft -= CaptureConfig.PDF.height;
      }
    }

    // Add links (using original document scale since element scrolling still uses same viewport)
    const pdfScale = CaptureConfig.PDF.width / canvasWidth;
    const links = collectLinks(pdfScale);

    links.forEach((link) => {
      const pageForLink = Math.floor(link.y / CaptureConfig.PDF.height) + 1;
      if (PDFPaginationMode === 'single' || (typeof currentPage !== 'undefined' && pageForLink <= currentPage)) {
        const yOnPage = link.y % CaptureConfig.PDF.height;
        if (
          yOnPage >= 0 &&
          yOnPage <= CaptureConfig.PDF.height &&
          link.x >= 0 &&
          link.x <= CaptureConfig.PDF.width
        ) {
          if (PDFPaginationMode !== 'single') { doc.setPage(pageForLink); }
          doc.link(
            Math.max(0, Math.min(CaptureConfig.PDF.width, link.x)),
            Math.max(0, Math.min(CaptureConfig.PDF.height, yOnPage)),
            Math.max(1, Math.min(CaptureConfig.PDF.width - link.x, link.width)),
            Math.max(
              1,
              Math.min(CaptureConfig.PDF.height - yOnPage, link.height)
            ),
            { url: link.href }
          );
        }
      }
    });

    const pdfData = doc.output('datauristring');

    progressIndicator.complete('PDF generated successfully!');

    return { success: true, dataUrl: pdfData, format: 'pdf' };
  } catch (error) {
    console.error("Element scroll PDF generation failed:", error);
    progressIndicator.remove();
    throw error;
  } finally {
    try { if (typeof restoreScrollbars === 'function') restoreScrollbars(); } catch (_) {}
  }
}
// Scroll position calculation utilities
class ScrollPositionCalculator {
  // Calculate scroll positions for scrollable element
  static calculateElementScrollPositions(
    elementHeight,
    viewportHeight,
    config = CaptureConfig.CAPTURE
  ) {
    // Ensure we have reasonable values
    if (elementHeight <= viewportHeight) {
      return { scrollPositions: [0], numCaptures: 1 };
    }

    const effectiveViewportHeight = viewportHeight - config.minOverlap;
    const capturesNeeded =
      Math.ceil((elementHeight - viewportHeight) / effectiveViewportHeight) + 1;
         const numCaptures = Math.min(capturesNeeded, config.maxCaptures);
  
     const scrollPositions = this._generateScrollPositions(
       numCaptures,
       elementHeight,
       viewportHeight,
       effectiveViewportHeight
     );

    return { scrollPositions, numCaptures };
  }

  // Generate scroll positions array
  static _generateScrollPositions(
    numCaptures,
    elementHeight,
    viewportHeight,
    effectiveViewportHeight
  ) {
    const scrollPositions = [];

    for (let i = 0; i < numCaptures; i++) {
      let scrollTop;

      if (i === 0) {
        // First capture - start at top
        scrollTop = 0;
      } else if (i === numCaptures - 1) {
        // Last capture - ensure we get the absolute bottom
        scrollTop = Math.max(0, elementHeight - viewportHeight);
      } else {
        // Middle captures - calculate with overlap
        scrollTop = i * effectiveViewportHeight;
      }

      // Ensure we don't scroll beyond the element content
      if (i < numCaptures - 1) {
        scrollTop = Math.min(scrollTop, elementHeight - viewportHeight);
      }

      scrollPositions.push(scrollTop);
    }

    return scrollPositions;
  }
}

// Legacy function wrapper for backward compatibility
function calculateElementScrollPositions(
  elementHeight,
  viewportHeight,
  config = CaptureConfig.CAPTURE
) {
  return ScrollPositionCalculator.calculateElementScrollPositions(
    elementHeight,
    viewportHeight,
    config
  );
}

// Smooth scroll element to position (unified with scenario 1 speed)
async function smoothScrollElementToPosition(
  element,
  targetScrollTop,
  sectionIndex,
  totalSections,
  progressIndicator
) {
  return new Promise((resolve) => {
    const startScrollTop = element.scrollTop;
    const scrollDistance = targetScrollTop - startScrollTop;

    // Skip smooth scroll if we're already at the target position
    if (ScrollAnimationUtils.shouldSkipAnimation(scrollDistance)) {
      return resolve();
    }

    // Create scroll indicator at the start
    const scrollIndicator = createScrollIndicator(
      sectionIndex + 1,
      totalSections,
      targetScrollTop
    );

    try {
      // Use unified scroll duration calculation
      const duration =
        ScrollAnimationUtils.calculateScrollDuration(scrollDistance);
      const startTime = performance.now();

      const animateScroll = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Apply optimized easing for faster perceived speed
        const easedProgress = ScrollAnimationUtils.easeOutQuad(progress);
        const currentScrollTop =
          startScrollTop + scrollDistance * easedProgress;

        element.scrollTop = currentScrollTop;

        // Update scroll indicator less frequently for better performance
        if (Math.round(progress * 10) % 2 === 0) {
          // Update every 20% instead of every frame
          updateScrollIndicator(scrollIndicator, progress);
        }

        if (progress < 1) {
          requestAnimationFrame(animateScroll);
        } else {
          // Ensure we're exactly at the target position
          element.scrollTop = targetScrollTop;

          // Final progress update
          updateScrollIndicator(scrollIndicator, 1);

          // Clean up scroll indicator with reduced delay
          setTimeout(() => {
            removeScrollIndicator(scrollIndicator);
            resolve();
          }, 100);
        }
      };

      requestAnimationFrame(animateScroll);
    } catch (error) {
      console.warn(
        "Element smooth scroll failed, falling back to instant scroll:",
        error
      );
      // Fallback to instant scroll
      element.scrollTop = targetScrollTop;
      removeScrollIndicator(scrollIndicator);
      resolve();
    }
  });
}

// ========== SCROLL UTILITIES ==========

// Unified scroll animation utilities
class ScrollAnimationUtils {
  // Calculate optimized scroll duration based on distance
  static calculateScrollDuration(scrollDistance) {
    const baseDuration = Math.abs(scrollDistance) < 1000 ? 150 : 250;
    const maxDuration = 400;
    return Math.min(maxDuration, Math.max(150, baseDuration));
  }

  // Optimized easing function for smooth scrolling
  static easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
  }

  // Check if scroll animation should be skipped
  static shouldSkipAnimation(scrollDistance) {
    return Math.abs(scrollDistance) < 5;
  }
}

// PDF Generation Strategy Factory
class PDFGenerationStrategyFactory {
  static createStrategy(scenario, scrollingInfo) {
    console.log("Creating strategy for scenario:", scenario);
    switch (scenario) {
      case ScrollingScenarios.ELEMENT_SCROLL:
        return new ElementScrollStrategy(scrollingInfo);
      case ScrollingScenarios.DOCUMENT_SCROLL:
      default:
        return new DocumentScrollStrategy();
    }
  }
}

// Base Strategy Interface
class PDFGenerationStrategy {
  async generate(element, fullHeight, fullWidth, scale, libraries) {
    throw new Error("Strategy must implement generate method");
  }

  getStrategyName() {
    throw new Error("Strategy must implement getStrategyName method");
  }
}

// Document Scroll Strategy (Scenario 1)
class DocumentScrollStrategy extends PDFGenerationStrategy {
  getStrategyName() {
    return "Document Scrolling (Scenario 1)";
  }

  async generate(element, fullHeight, fullWidth, scale, libraries) {
    return await generateNormalModePDFCaptureStitch(
      element,
      fullHeight,
      fullWidth,
      scale,
      libraries
    );
  }
}

// Element Scroll Strategy (Scenario 2)
class ElementScrollStrategy extends PDFGenerationStrategy {
  constructor(scrollingInfo) {
    super();
    this.scrollingInfo = scrollingInfo;
  }

  getStrategyName() {
    return "Element Scrolling (Scenario 2)";
  }

  async generate(element, fullHeight, fullWidth, scale, libraries) {
    return await generateElementScrollPDF(
      this.scrollingInfo.scrollableElement,
      this.scrollingInfo.elementHeight,
      this.scrollingInfo.viewportHeight,
      scale,
      libraries
    );
  }
}

// Enhanced PDF Generation Orchestrator
class EnhancedPDFGenerator {
  async generate(element, fullHeight, fullWidth, scale, libraries) {
    // Detect scrolling scenario
    const scrollingInfo = this.detectScrollingScenario();

    // Create and execute strategy
    const strategy = PDFGenerationStrategyFactory.createStrategy(
      scrollingInfo.scenario,
      scrollingInfo
    );

    return await strategy.generate(
      element,
      fullHeight,
      fullWidth,
      scale,
      libraries
    );
  }

  detectScrollingScenario() {
    return detectScrollingScenario();
  }
}

// Main enhanced function - now simplified to use the orchestrator
async function generateNormalModePDFCaptureStitchEnhanced(
  element,
  fullHeight,
  fullWidth,
  scale,
  { html2canvas, jsPDF }
) {
  const generator = new EnhancedPDFGenerator();
  return await generator.generate(element, fullHeight, fullWidth, scale, {
    html2canvas,
    jsPDF,
  });
}

// Function to generate PNG using captureVisibleTab with scrolling and stitching (Document Scroll)
async function generatePNGCaptureStitch(html2canvas) {
  const progressIndicator = createPDFProgressIndicator();
  progressIndicator.setProgress(5, "Initializing PNG capture and stitch generation...");
  let restoreScrollbars;

  try {
    // Store original scroll position
    const originalScrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const originalScrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    progressIndicator.setProgress(15, "Identifying fixed elements...");

    // Multi-phase detection for robust element discovery
    const initialElements = detectInitialProblematicElements();
    const commonElements = detectCommonProblematicElements();

    await new Promise((resolve) => setTimeout(resolve, 500));
    const delayedElements = await detectDelayedProblematicElements();

    // Merge all detected elements
    const problematicElements = mergeMultipleProblematicElements([
      initialElements,
      commonElements,
      delayedElements,
    ]);

    // Get page dimensions after element detection
    await new Promise((resolve) => setTimeout(resolve, 100));
    const { documentHeight, documentWidth, viewportHeight, viewportWidth } = 
      getPageDimensions();

    // Calculate scroll positions
    const { scrollPositions, numCaptures } = calculateScrollPositions(
      documentHeight,
      viewportHeight
    );

    // Calculate canvas dimensions for final image
    const { canvasWidth, canvasHeight } = calculateCanvasDimensions(
      viewportWidth,
      documentHeight
    );

    progressIndicator.setProgress(20, "Starting page capture...");

    // Temporarily hide scrollbars during capture to avoid them appearing in screenshots
    restoreScrollbars = hideScrollbarsTemporarily();

    // Array to store captured images with metadata
    const capturedImages = [];

    // Hide progress indicator during captures
    progressIndicator.hide();

    // Capture each section
    var collectedToHideElements = [];
    for (let i = 0; i < numCaptures; i++) {
      const scrollTop = scrollPositions[i];
      const captureProgress = 25 + Math.round(((i + 1) / numCaptures) * 50);
      
      progressIndicator.setProgress(
        captureProgress,
        `Scrolling to section ${i + 1}/${numCaptures}...`
      );

      try {
        // Smooth scroll to position
        await smoothScrollToPosition(scrollTop, i, numCaptures, progressIndicator);

        progressIndicator.setProgress(
          captureProgress,
          `Capturing section ${i + 1}/${numCaptures}...`
        );

        // Wait for content to load
        await new Promise((resolve) => 
          setTimeout(resolve, i === 0 ? 200 : 100)
        );

        // Detect newly fixed elements
        try {
          const newlyFixedElements = detectDynamicFixedElements(problematicElements);
          if (newlyFixedElements.length > 0) {
            problematicElements.push(...newlyFixedElements);
          }
        } catch (dynamicDetectionError) {
          console.warn("Error in dynamic detection, continuing with capture:", dynamicDetectionError);
        }

        // Determine which elements to hide for this capture
        const elementsToHide = getElementsToHideForCapture(
          problematicElements,
          i,
          numCaptures
        );

        // Find visible sticky elements and adjust scroll position if needed
        const visibleElements = problematicElements.filter(
          (el) => !elementsToHide.includes(el)
        );
        const visibleStickyElements = visibleElements.filter(
          (el) => el.type === ElementTypes.STICKY
        );

        let adjustedScrollTop = scrollTop;
        if (visibleStickyElements.length > 0) {
          adjustedScrollTop = adjustScrollPositionForStickyElements(
            scrollTop,
            visibleStickyElements,
            viewportHeight
          );
          if (adjustedScrollTop !== scrollTop) {
            await smoothScrollToPosition(adjustedScrollTop, i, numCaptures, progressIndicator);
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        // Gap-guard for PNG path as well
        adjustedScrollTop = await clampScrollToAvoidGap(
          adjustedScrollTop,
          viewportHeight,
          capturedImages,
          i,
          numCaptures,
          progressIndicator
        );

        collectedToHideElements.push(...elementsToHide);
        // Hide problematic elements
        hideProblematicElements(elementsToHide);

        // Hide PageSaver elements during capture
        const pageSaverElements = document.querySelectorAll(
          '[id*="pagesaver"], [class*="pagesaver"]'
        );
        const originalPageSaverStyles = [];
        pageSaverElements.forEach((el, index) => {
          originalPageSaverStyles[index] = el.style.display;
          el.style.display = "none";
        });

        await new Promise((resolve) => setTimeout(resolve, 50));

        let captureDataUrl;
        try {
          // Capture using Chrome API
          captureDataUrl = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error("Capture timeout"));
            }, 10000);
            chrome.runtime.sendMessage(
              { action: "captureVisibleTab" },
              (response) => {
                clearTimeout(timeout);
                if (response && response.success) {
                  resolve(response.dataUrl);
                } else {
                  reject(
                    new Error(response?.error || "Failed to capture visible tab")
                  );
                }
              }
            );
          });
        } finally {
          // Restore PageSaver elements
          pageSaverElements.forEach((el, index) => {
            el.style.display = originalPageSaverStyles[index];
          });
        }

        // Store captured image with metadata
        capturedImages.push({
          dataUrl: captureDataUrl,
          scrollTop: adjustedScrollTop,
          actualScrollTop: window.pageYOffset || document.documentElement.scrollTop,
          index: i,
        });

        // Restore problematic elements
        // restoreProblematicElements(elementsToHide);
      } catch (captureError) {
        console.error(`Error capturing section ${i + 1}:`, captureError);
        
        // Restore elements even on error
        try {
          restoreProblematicElements(problematicElements);
        } catch (restoreError) {
          console.error("Error restoring elements:", restoreError);
        }
        
        throw captureError;
      }
    }

    // restore all hidden elements once the capture is complete
    restoreProblematicElements(collectedToHideElements);

    // Restore original scroll position
    window.scrollTo(originalScrollLeft, originalScrollTop);

    // Show progress indicator again
    progressIndicator.show();
    progressIndicator.setProgress(70, "Stitching images together...");

    if (capturedImages.length === 0) {
      throw new Error("No images were captured successfully");
    }

    // Calculate canvas dimensions using helper function
    const { canvasWidth: finalCanvasWidth, canvasHeight: finalCanvasHeight } = calculateCanvasDimensions(
      viewportWidth,
      documentHeight
    );

    // Create final canvas and stitch images
    const finalCanvas = await stitchImages(
      capturedImages,
      finalCanvasWidth,
      finalCanvasHeight,
      documentHeight,
      viewportHeight,
      50 // minOverlap
    );

    progressIndicator.setProgress(85, "Converting to PNG format...");

    // Convert to PNG with optional watermark
    const watermarkedCanvas = await addWatermarkToCanvas(finalCanvas);
    const dataUrl = watermarkedCanvas.toDataURL("image/png");

    progressIndicator.setProgress(95, "Finalizing PNG...");

    progressIndicator.complete("PNG generated successfully!");

    return {
      success: true,
      dataUrl,
      format: "png",
    };
  } catch (error) {
    console.error("PNG capture and stitch failed:", error);
    progressIndicator.error("PNG generation failed: " + error.message);
    throw error;
  } finally {
    try { if (typeof restoreScrollbars === 'function') restoreScrollbars(); } catch (_) {}
  }
}
// Function to generate PNG using element scroll (similar to generateElementScrollPDF)
async function generateElementScrollPNG(
  scrollableElement,
  elementHeight,
  viewportHeight,
  html2canvas
) {
  console.log("Converting to PNG using element scroll method...");
  
  const progressIndicator = createPDFProgressIndicator();
  progressIndicator.setProgress(5, "Initializing element scroll PNG generation...");
  let restoreScrollbars;

  try {
    progressIndicator.setProgress(10, "Analyzing scrollable element...");

    // Detect non-scrollable (fixed / sticky) UI so that we can hide them per capture.
    progressIndicator.setProgress(15, "Identifying fixed elements...");
    const initialElements = detectInitialProblematicElements();
    const commonElements = detectCommonProblematicElements();
    const delayedElements = await detectDelayedProblematicElements();
    let problematicElements = mergeMultipleProblematicElements([
      initialElements,
      commonElements,
      delayedElements,
    ]);

    // ** COMPREHENSIVE LOGIC FOR SCENARIO 2 **
    // In element scrolling scenario, ALL elements outside the scrollable container
    // should be treated as non-scrollable and positioned appropriately

    // Get all visible elements in the document
    const allElements = Array.from(document.querySelectorAll("*")).filter(
      (el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          style.opacity !== "0"
        );
      }
    );

    // Find elements that are outside the scrollable container
    const outsideElements = allElements.filter((el) => {
      // Skip if element is inside the scrollable container
      if (scrollableElement.contains(el)) return false;

      // Skip if element contains the scrollable container (parent elements)
      if (el.contains(scrollableElement)) return false;

      // Skip script, style, meta tags
      if (["SCRIPT", "STYLE", "META", "LINK", "TITLE"].includes(el.tagName))
        return false;

      return true;
    });

    const newProblematicElements = [];
    outsideElements.forEach((el) => {
      // Check if this element is already contained within an existing problematic element
      const alreadyContained = problematicElements.some((p) =>
        p.element.contains(el)
      );
      if (!alreadyContained) {
        const computedStyle = window.getComputedStyle(el);
        const elementData = createEnhancedElementData(el, computedStyle);

        // Classify based on position relative to scrollable element
        const rect = el.getBoundingClientRect();
        const scrollableRect = scrollableElement.getBoundingClientRect();

        if (rect.bottom <= scrollableRect.top + 50) {
          // Element is above scrollable area - treat as header
          elementData.type = ElementTypes.HEADER;
        } else if (rect.top >= scrollableRect.bottom - 50) {
          // Element is below scrollable area - treat as footer
          elementData.type = ElementTypes.FOOTER;
        } else if (rect.right <= scrollableRect.left + 50) {
          // Element is to the left of scrollable area - treat as sidebar
          elementData.type = ElementTypes.SIDEBAR;
        } else if (rect.left >= scrollableRect.right - 50) {
          // Element is to the right of scrollable area - treat as sidebar
          elementData.type = ElementTypes.SIDEBAR;
        } else {
          // Element overlaps with scrollable area - treat as overlay
          elementData.type = ElementTypes.OVERLAY;
        }

        newProblematicElements.push(elementData);
      }
    });

    if (newProblematicElements.length > 0) {
      problematicElements = mergeMultipleProblematicElements([
        problematicElements,
        newProblematicElements,
      ]);
    }
    // ** END COMPREHENSIVE LOGIC **

    // Calculate scroll container and initial crop rect (same as PDF)
    const scrollContainerElement = getScrollContainerElement(scrollableElement);
    const scrollContainerRect = scrollContainerElement
      ? scrollContainerElement.getBoundingClientRect()
      : scrollableElement.getBoundingClientRect();
    const scrollContainerContentRect = scrollContainerElement
      ? getContentBoxRect(scrollContainerElement)
      : getContentBoxRect(scrollableElement);
    const captureCropRect = getCaptureCropRect(
      scrollContainerContentRect || scrollContainerRect
    );

    console.log("Element scroll PNG crop rect:", {
      scrollContainerRect: scrollContainerRect ? {
        top: Math.round(scrollContainerRect.top),
        left: Math.round(scrollContainerRect.left),
        width: Math.round(scrollContainerRect.width),
        height: Math.round(scrollContainerRect.height),
      } : null,
      captureCropRect,
    });

    // Store original scroll positions (both page and element)
    const originalPageScrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const originalPageScrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const originalElementScrollTop = scrollableElement.scrollTop;

    progressIndicator.setProgress(18, "Calculating element scroll positions...");

    // Calculate scroll positions for the element
    const { scrollPositions, numCaptures } = calculateElementScrollPositions(
      elementHeight,
      viewportHeight
    );

    progressIndicator.setProgress(20, "Starting element capture...");

    // Temporarily hide scrollbars during capture to avoid them appearing in screenshots
    restoreScrollbars = hideScrollbarsTemporarily();

    // Array to store captured images with metadata
    const capturedImages = [];

    // Calculate canvas dimensions based on element's client dimensions
    const canvasWidth = scrollableElement.clientWidth;
    const canvasHeight = elementHeight;

    // Hide progress indicator during captures
    progressIndicator.hide();

    // Capture each section of the scrollable element
    for (let i = 0; i < numCaptures; i++) {
      const scrollTop = scrollPositions[i];
      const captureProgress = 25 + Math.round(((i + 1) / numCaptures) * 50);
      
      progressIndicator.setProgress(
        captureProgress,
        `Scrolling element to section ${i + 1}/${numCaptures}...`
      );

      try {
        // Smooth scroll the element to position
        await smoothScrollElementToPosition(
          scrollableElement,
          scrollTop,
          i,
          numCaptures,
          progressIndicator
        );

        // After scrolling, detect any new dynamic fixed elements that appeared
        try {
          const newlyFixed = detectDynamicFixedElements(problematicElements);
          if (newlyFixed.length > 0) {
            problematicElements.push(...newlyFixed);
          }
        } catch (dynErr) {
          console.warn(
            "Dynamic detection failed inside element scroll loop:",
            dynErr
          );
        }

        // Determine which elements to hide for this capture
        const elementsToHide = getElementsToHideForCapture(
          problematicElements,
          i,
          numCaptures
        );
        hideProblematicElements(elementsToHide);

        progressIndicator.setProgress(
          captureProgress,
          `Capturing element section ${i + 1}/${numCaptures}...`
        );

        // Wait for content to load
        await new Promise((resolve) => 
          setTimeout(resolve, i === 0 ? 200 : 100)
        );

        // CRITICAL: Recalculate crop rect for THIS capture after scrolling
        // The scrollable element's position may shift due to UI changes (rulers, headers, etc.)
        const currentScrollContainerRect = scrollContainerElement
          ? scrollContainerElement.getBoundingClientRect()
          : scrollableElement.getBoundingClientRect();
        const currentContentRect = scrollContainerElement
          ? getContentBoxRect(scrollContainerElement)
          : getContentBoxRect(scrollableElement);
        const currentCropRect = getCaptureCropRect(
          currentContentRect || currentScrollContainerRect
        );

        if (i > 0 && currentCropRect && captureCropRect) {
          const topDiff = Math.abs(currentCropRect.top - captureCropRect.top);
          if (topDiff > 5) {
            console.log(`PNG crop rect shifted by ${topDiff}px for frame ${i}:`, {
              original: captureCropRect,
              current: currentCropRect,
            });
          }
        }

        // Additional safeguard: Explicitly hide all PageSaver elements during capture
        const pageSaverElements = document.querySelectorAll(
          '[id*="pagesaver"], [class*="pagesaver"]'
        );
        const originalPageSaverStyles = [];
        pageSaverElements.forEach((el, index) => {
          originalPageSaverStyles[index] = el.style.display;
          el.style.display = "none";
        });

        // Ensure style changes are rendered
        await new Promise((resolve) => setTimeout(resolve, 50));

        let captureDataUrl;
        try {
          // Capture using Chrome API
          captureDataUrl = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error("Capture timeout"));
            }, 10000);
            chrome.runtime.sendMessage(
              { action: "captureVisibleTab" },
              (response) => {
                clearTimeout(timeout);
                if (response && response.success) {
                  resolve(response.dataUrl);
                } else {
                  reject(
                    new Error(response?.error || "Failed to capture visible tab")
                  );
                }
              }
            );
          });
        } finally {
          // Restore PageSaver elements
          pageSaverElements.forEach((el, index) => {
            el.style.display = originalPageSaverStyles[index];
          });

          // Always restore elements even if capture fails
          restoreProblematicElements(elementsToHide);
        }

        // Store captured image with metadata - use CURRENT crop rect for this frame
        capturedImages.push({
          dataUrl: captureDataUrl,
          scrollTop: scrollTop,
          actualScrollTop: scrollableElement.scrollTop,
          index: i,
          viewportHeight: viewportHeight,
          cropRect: currentCropRect || captureCropRect,
          captureViewportWidth: window.innerWidth,
          captureViewportHeight: window.innerHeight,
        });

        // Rate limiting
        if (i < numCaptures - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      } catch (captureError) {
        console.warn(
          `Failed to capture element section ${i + 1}:`,
          captureError
        );

        // Restore PageSaver elements on error
        if (
          typeof pageSaverElements !== "undefined" &&
          typeof originalPageSaverStyles !== "undefined"
        ) {
          pageSaverElements.forEach((el, index) => {
            el.style.display = originalPageSaverStyles[index];
          });
        }

        // Restore all problematic elements if an error occurs during capture
        restoreProblematicElements(problematicElements);

        // Create a placeholder
        const { viewportWidth } = getPageDimensions();
        const placeholderDataUrl = createPlaceholder(
          viewportWidth,
          viewportHeight
        );

        capturedImages.push({
          dataUrl: placeholderDataUrl,
          scrollTop: scrollTop,
          actualScrollTop: scrollableElement.scrollTop,
          index: i,
          viewportHeight: viewportHeight,
          cropRect: captureCropRect,
          captureViewportWidth: window.innerWidth,
          captureViewportHeight: window.innerHeight,
          isPlaceholder: true,
        });
      }
    }

    // Restore original scroll positions immediately after captures complete
    scrollableElement.scrollTop = originalElementScrollTop;
    window.scrollTo(originalPageScrollLeft, originalPageScrollTop);

    // Process captured images similar to document scroll
    progressIndicator.show();
    progressIndicator.setProgress(70, "Stitching element images together...");

    // Calculate canvas dimensions
    const { viewportWidth } = getPageDimensions();
    const canvasWidthFinal = canvasWidth;
    const canvasHeightFinal = canvasHeight;

    // Create final canvas and stitch images
    const finalCanvas = await stitchImages(
      capturedImages,
      canvasWidthFinal,
      canvasHeightFinal,
      elementHeight,
      viewportHeight,
      50 // minOverlap
    );

    progressIndicator.setProgress(85, "Converting to PNG format...");

    // Convert to PNG with optional watermark
    const watermarkedCanvas = await addWatermarkToCanvas(finalCanvas);
    const dataUrl = watermarkedCanvas.toDataURL("image/png");

    progressIndicator.setProgress(95, "Finalizing element PNG...");

    progressIndicator.complete("Element PNG generated successfully!");

    return {
      success: true,
      dataUrl,
      format: "png",
    };

  } catch (error) {
    console.error("Element PNG capture and stitch failed:", error);
    
    // Restore original scroll positions on error
    try {
      scrollableElement.scrollTop = originalElementScrollTop;
      window.scrollTo(originalPageScrollLeft, originalPageScrollTop);
    } catch (scrollError) {
      console.warn("Failed to restore scroll positions:", scrollError);
    }
    
    progressIndicator.remove();
    throw error;
  } finally {
    try { if (typeof restoreScrollbars === 'function') restoreScrollbars(); } catch (_) {}
  }
}

// PNG Generation Strategy Classes
class PNGGenerationStrategy {
  async generate(html2canvas) {
    throw new Error("Strategy must implement generate method");
  }

  getStrategyName() {
    throw new Error("Strategy must implement getStrategyName method");
  }
}

// Document Scroll Strategy for PNG (Scenario 1)
class DocumentScrollPNGStrategy extends PNGGenerationStrategy {
  getStrategyName() {
    return "Document Scrolling PNG (Scenario 1)";
  }

  async generate(html2canvas) {
    return await generatePNGCaptureStitch(html2canvas);
  }
}

// Element Scroll Strategy for PNG (Scenario 2)
class ElementScrollPNGStrategy extends PNGGenerationStrategy {
  constructor(scrollingInfo) {
    super();
    this.scrollingInfo = scrollingInfo;
  }

  getStrategyName() {
    return "Element Scrolling PNG (Scenario 2)";
  }

  async generate(html2canvas) {
    return await generateElementScrollPNG(
      this.scrollingInfo.scrollableElement,
      this.scrollingInfo.elementHeight,
      this.scrollingInfo.viewportHeight,
      html2canvas
    );
  }
}

// PNG Generation Strategy Factory
class PNGGenerationStrategyFactory {
  static createStrategy(scenario, scrollingInfo) {
    switch (scenario) {
      case ScrollingScenarios.ELEMENT_SCROLL:
        return new ElementScrollPNGStrategy(scrollingInfo);
      case ScrollingScenarios.DOCUMENT_SCROLL:
      default:
        return new DocumentScrollPNGStrategy();
    }
  }
}

// Enhanced PNG Generation Orchestrator
class EnhancedPNGGenerator {
  async generate(html2canvas) {
    // Detect scrolling scenario
    const scrollingInfo = this.detectScrollingScenario();
    console.log(`PNG Generation - Detected scenario: ${scrollingInfo.scenario}`);

    // Create and execute strategy
    const strategy = PNGGenerationStrategyFactory.createStrategy(
      scrollingInfo.scenario,
      scrollingInfo
    );

    console.log(`Using PNG strategy: ${strategy.getStrategyName()}`);
    return await strategy.generate(html2canvas);
  }

  detectScrollingScenario() {
    return detectScrollingScenario();
  }
}

// Main enhanced PNG capture and stitch function
async function generatePNGCaptureStitchEnhanced(html2canvas) {
  const generator = new EnhancedPNGGenerator();
  return await generator.generate(html2canvas);
}

// Enhanced PNG generation function with method selection
async function generateEnhancedPNG(html2canvas) {
  return await generatePNGCaptureStitchEnhanced(html2canvas);
}

// Function to handle virtual scrolling content extraction for Feishu documents
async function extractFeishuDocContentWithDynamicLoading(docClone) {
  console.log("Starting Feishu content extraction...");
  
  // Extract title and author from the original document
  let title = "Document";
  const titleElement = docClone.querySelector('h1 .ace-line span[data-leaf="true"]');
  if (titleElement) {
    const text = titleElement.textContent.trim();
    if (text && text.length > 3 && !text.includes("Add Icon") && !text.includes("Add Cover")) {
      title = text;
    }
  }

  let author = "";
  const authorElement = docClone.querySelector('.docs-info-avatar-name-text');
  if (authorElement) {
    author = authorElement.textContent.trim();
  }
  
  // Use enhanced extraction with component scrolling
  const simpleContent = await extractFeishuContentSimple(docClone);
  
  return {
    title: title,
    author: author,
    content: simpleContent,
    extractedBy: "Feishu Enhanced Extractor with Component Scrolling"
  };
}

// Enhanced Feishu content extraction function with component scrolling
async function extractFeishuContentSimple(docClone) {
  console.log("Extracting Feishu content using enhanced method...");
  
  // First, try to find scrollable components in the original document
  const originalDoc = document;
  const scrollableComponents = findScrollableFeishuComponents(originalDoc);
  
  if (scrollableComponents.length > 0) {
    console.log(`Found ${scrollableComponents.length} scrollable components with Feishu content`);
    return await extractFromScrollableComponents(scrollableComponents);
  } else {
    console.log("No scrollable components found, using fallback extraction");
    return extractFromStaticContent(docClone);
  }
}

// Function to find scrollable components with Feishu content
function findScrollableFeishuComponents(doc) {
  const scrollableElements = [];
  
  // Find all elements that might be scrollable
  const allElements = doc.querySelectorAll('*');
  
  allElements.forEach(element => {
    const style = window.getComputedStyle(element);
    const overflow = style.overflow + style.overflowY + style.overflowX;
    const hasScrollableContent = element.scrollHeight > element.clientHeight;
    
    if (hasScrollableContent && (overflow.includes('scroll') || overflow.includes('auto'))) {
      const feishuBlocks = element.querySelectorAll('[data-block-type]');
      if (feishuBlocks.length > 0) {
        scrollableElements.push({
          element: element,
          blockCount: feishuBlocks.length,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight
        });
      }
    }
  });
  
  // Sort by block count (most content first)
  scrollableElements.sort((a, b) => b.blockCount - a.blockCount);
  
  return scrollableElements;
}

// Function to extract content from scrollable components
async function extractFromScrollableComponents(components) {
  console.log("Extracting from scrollable components...");
  
  const targetComponent = components[0]; // Use the component with most content
  const element = targetComponent.element;
  
  console.log(`Targeting component with ${targetComponent.blockCount} blocks`);
  console.log(`Component size: ${targetComponent.scrollHeight}px content, ${targetComponent.clientHeight}px visible`);
  
  // Scroll to top first
  const originalScrollTop = element.scrollTop;
  element.scrollTop = 0;
  
  let allContent = new Set();
  const scrollStep = 400;
  const maxScrolls = 20;
  let scrollCount = 0;
  
  // Function to filter out unwanted content - DISABLED
  function filterContent(text, blockType) {
    // Ensure text is a string
    if (typeof text !== 'string') {
      return false;
    }
    
    // Skip completely empty content
    if (!text || text.trim().length === 0) {
      return false;
    }
    
    // Return the text as-is (no filtering)
    return text.trim();
  }
  
  // Return a Promise that resolves when extraction is complete
  return new Promise((resolve) => {
    // Extract and scroll function
    function extractAndScroll() {
      scrollCount++;
      console.log(`Scroll ${scrollCount}/${maxScrolls}`);
      
      // Extract current content
      const blocks = element.querySelectorAll('[data-block-type]');
      let newBlocks = 0;
      
            blocks.forEach((block, index) => {
        try {
          const type = block.getAttribute('data-block-type');
          const text = block.textContent?.trim();
          
          if (text && text.length > 0) {
            // Filter the content
            const filteredText = filterContent(text, type);
            
            if (filteredText && typeof filteredText === 'string') {
              // Include scroll position in the key to maintain order
              const key = `${scrollCount}-${index}:${type}:${filteredText}`;
              if (!allContent.has(key)) {
                allContent.add(key);
                newBlocks++;
                console.log(`✅ Added: [${type}] "${filteredText.substring(0, 50)}..."`);
              }
            } else {
              console.log(`❌ Filtered out: [${type}] "${text.substring(0, 50)}..." (filteredText: ${filteredText})`);
            }
          }
        } catch (error) {
          console.log(`⚠️ Error processing block:`, error);
        }
      });
      
      console.log(`Found ${blocks.length} total blocks, ${newBlocks} new filtered blocks`);
      
      // Scroll down
      const currentScroll = element.scrollTop;
      const newScroll = currentScroll + scrollStep;
      element.scrollTop = newScroll;
      
      // Continue if not at bottom and haven't reached max
      if (scrollCount < maxScrolls && newScroll < element.scrollHeight - element.clientHeight) {
        // Use setTimeout to allow content to load
        setTimeout(extractAndScroll, 500);
      } else {
        // Restore original scroll position
        element.scrollTop = originalScrollTop;
        const formattedContent = formatExtractedContent(allContent);
        console.log(`Extraction complete: ${allContent.size} unique blocks, ${formattedContent.length} characters`);
        
        // If we didn't get much content, fall back to static extraction
        if (formattedContent.length < 100) {
          console.log("Component scrolling didn't yield enough content, falling back to static extraction");
          const staticContent = extractFromStaticContent(document.cloneNode(true));
          resolve(staticContent);
        } else {
          resolve(formattedContent);
        }
      }
    }
    
    // Start extraction
    extractAndScroll();
  });
}

// Function to format extracted content
function formatExtractedContent(contentSet) {
  const contentArray = Array.from(contentSet).map(item => {
    // Parse the key format: "scrollIndex-blockIndex:type:text"
    const parts = item.split(':');
    if (parts.length >= 3) {
      const positionInfo = parts[0]; // "scrollIndex-blockIndex"
      const type = parts[1];
      const text = parts.slice(2).join(':'); // Rejoin in case text contains colons
      const [scrollIndex, blockIndex] = positionInfo.split('-').map(Number);
      return { 
        type, 
        text, 
        length: text.length,
        scrollIndex: scrollIndex || 0,
        blockIndex: blockIndex || 0
      };
    } else {
      // Fallback for old format
      const [type, text] = item.split(':', 2);
      return { type, text, length: text.length, scrollIndex: 0, blockIndex: 0 };
    }
  });
  
  // Remove duplicates and filter out unwanted content
  const uniqueContent = [];
  const seenTexts = new Set();
  
  console.log('Processing content array:', contentArray.length, 'items');
  
  contentArray.forEach((item, index) => {
    console.log(`Processing item ${index}: [${item.type}] "${item.text.substring(0, 50)}..."`);
    
    // Skip page blocks (they contain UI elements)
    if (item.type === 'page') {
      console.log(`  Skipping page block`);
      return;
    }
    
    // Skip back_ref_list blocks
    if (item.type === 'back_ref_list') {
      console.log(`  Skipping back_ref_list block`);
      return;
    }
    
    // Skip very short content
    if (item.text.length < 3) {
      console.log(`  Skipping short content (${item.text.length} chars)`);
      return;
    }
    
    // Skip UI elements (but be more specific)
    if (item.text === "Type '/' for commands" || 
        item.text === "Add Icon" || 
        item.text === "Add Cover" ||
        item.text === "Modified Today" ||
        item.text === "​") { // Empty content
      console.log(`  Skipping UI element`);
      return;
    }
    
    // Skip duplicates
    if (seenTexts.has(item.text)) {
      console.log(`  Skipping duplicate`);
      return;
    }
    
    seenTexts.add(item.text);
    uniqueContent.push(item);
    console.log(`  Added to unique content`);
  });
  
  console.log('Unique content after filtering:', uniqueContent.length, 'items');
  
  // Sort by position to maintain document flow
  uniqueContent.sort((a, b) => {
    // First sort by scroll position
    if (a.scrollIndex !== b.scrollIndex) {
      return a.scrollIndex - b.scrollIndex;
    }
    
    // Then sort by block position within the scroll
    if (a.blockIndex !== b.blockIndex) {
      return a.blockIndex - b.blockIndex;
    }
    
    // Finally, sort by type as fallback
    const typeOrder = ['heading2', 'text', 'bullet'];
    const aIndex = typeOrder.indexOf(a.type);
    const bIndex = typeOrder.indexOf(b.type);
    return aIndex - bIndex;
  });
  
  let formattedContent = '';
  let currentList = null; // Track current list state
  console.log('Formatting content:', uniqueContent.length, 'items');
  
  uniqueContent.forEach((item, index) => {
    console.log(`Formatting item ${index}: [${item.type}] "${item.text.substring(0, 50)}..."`);
    
    // Handle list state transitions
    if (item.type === 'bullet' || item.type === 'list') {
      if (currentList !== 'ul') {
        if (currentList) formattedContent += `</${currentList}>`;
        formattedContent += "<ul>";
        currentList = 'ul';
      }
      // Clean up bullet point text (remove existing bullet characters)
      const cleanedText = item.text.replace(/^[•·‣⁃▪▫‣◦‧⁌⁍]*\s*/, '').trim();
      formattedContent += `<li>${cleanedText}</li>`;
    } else if (item.type === 'numbered_list') {
      if (currentList !== 'ol') {
        if (currentList) formattedContent += `</${currentList}>`;
        formattedContent += "<ol>";
        currentList = 'ol';
      }
      // Clean up numbered list text (remove existing numbers and dots)
      const cleanedText = item.text.replace(/^\d+[\.\)]\s*/, '').trim();
      formattedContent += `<li>${cleanedText}</li>`;
    } else {
      // Close any open list
      if (currentList) {
        formattedContent += `</${currentList}>`;
        currentList = null;
      }
      
      // Add appropriate HTML formatting based on block type
      if (item.type === 'heading1' || item.type === 'heading2' || item.type === 'heading3' || 
          item.type === 'heading4' || item.type === 'heading5' || item.type === 'heading6') {
        const level = item.type.replace('heading', '');
        formattedContent += `<h${level}>${item.text}</h${level}>`;
      } else if (item.type === 'quote') {
        formattedContent += `<blockquote>${item.text}</blockquote>`;
      } else if (item.type === 'callout') {
        formattedContent += `<div class="callout">${item.text}</div>`;
      } else if (item.type === 'code') {
        formattedContent += `<pre><code>${item.text}</code></pre>`;
      } else if (item.type === 'divider') {
        formattedContent += "<hr>";
      } else {
        formattedContent += `<p>${item.text}</p>`;
      }
    }
  });
  
  // Close any remaining open list
  if (currentList) {
    formattedContent += `</${currentList}>`;
  }
  
  return formattedContent;
}
// Fallback function for static content extraction
function extractFromStaticContent(docClone) {
  console.log("Extracting from static content...");
  
  // Extract content from all data-block-type elements
  const contentBlocks = docClone.querySelectorAll('[data-block-type]');
  console.log(`Found ${contentBlocks.length} content blocks`);
  
  let content = "";
  const blockTypes = {};
  let currentList = null; // Track current list state
  let listType = null; // Track list type (ul or ol)
  
  for (const block of contentBlocks) {
    const blockType = block.getAttribute('data-block-type');
    blockTypes[blockType] = (blockTypes[blockType] || 0) + 1;
    
    // Skip page block (contains title)
    if (blockType === 'page') continue;
    
    let blockContent = "";
    
    // Handle all possible block types
    if (blockType === 'text' || blockType === 'heading2' || blockType === 'bullet' || 
        blockType === 'paragraph' || blockType === 'heading1' || blockType === 'heading3' ||
        blockType === 'heading4' || blockType === 'heading5' || blockType === 'heading6' ||
        blockType === 'list' || blockType === 'numbered_list' || blockType === 'quote' ||
        blockType === 'callout' || blockType === 'code' || blockType === 'table' ||
        blockType === 'divider' || blockType === 'embed' || blockType === 'image') {
      
      // Check if it's an empty block (for spacing)
      if (block.classList.contains('isEmpty')) {
        content += "<br>";
        continue;
      }
      
      // Extract text from data-leaf spans
      const leafSpans = block.querySelectorAll('span[data-leaf="true"]');
      let hasRealContent = false;
      
      for (const span of leafSpans) {
        const spanText = span.textContent.trim();
        if (spanText && spanText !== '​' && spanText !== '\u200B' && spanText !== '\n') {
          hasRealContent = true;
          
          // Clean up abbreviation wrappers - get the actual text
          if (span.closest('.abbreviation-inline-wrapper')) {
            const abbreviationText = span.querySelector('.abbreviation-text');
            if (abbreviationText) {
              blockContent += abbreviationText.textContent.trim() + " ";
            } else {
              blockContent += spanText + " ";
            }
          } else {
            blockContent += spanText + " ";
          }
        }
      }
      
      // If no data-leaf spans found, try to get text directly from the block
      if (!hasRealContent) {
        const directText = block.textContent.trim();
        if (directText && directText !== '​' && directText !== '\u200B' && directText !== '\n') {
          hasRealContent = true;
          blockContent = directText + " ";
        }
      }
      
      // Only add content if it's substantial
      if (hasRealContent && blockContent.trim().length > 0) {
        blockContent = blockContent.trim();
        
        // Handle list state transitions
        if (blockType === 'bullet' || blockType === 'list') {
          if (currentList !== 'ul') {
            if (currentList) content += `</${currentList}>`;
            content += "<ul>";
            currentList = 'ul';
          }
          // Clean up bullet point text (remove existing bullet characters)
          const cleanedContent = blockContent.replace(/^[•·‣⁃▪▫‣◦‧⁌⁍]*\s*/, '').trim();
          content += `<li>${cleanedContent}</li>`;
        } else if (blockType === 'numbered_list') {
          if (currentList !== 'ol') {
            if (currentList) content += `</${currentList}>`;
            content += "<ol>";
            currentList = 'ol';
          }
          // Clean up numbered list text (remove existing numbers and dots)
          const cleanedContent = blockContent.replace(/^\d+[\.\)]\s*/, '').trim();
          content += `<li>${cleanedContent}</li>`;
        } else {
          // Close any open list
          if (currentList) {
            content += `</${currentList}>`;
            currentList = null;
          }
          
          // Add appropriate HTML formatting based on block type
          if (blockType === 'heading1' || blockType === 'heading2' || blockType === 'heading3' || 
              blockType === 'heading4' || blockType === 'heading5' || blockType === 'heading6') {
            const level = blockType.replace('heading', '');
            content += `<h${level}>${blockContent}</h${level}>`;
          } else if (blockType === 'quote') {
            content += `<blockquote>${blockContent}</blockquote>`;
          } else if (blockType === 'callout') {
            content += `<div class="callout">${blockContent}</div>`;
          } else if (blockType === 'code') {
            content += `<pre><code>${blockContent}</code></pre>`;
          } else if (blockType === 'divider') {
            content += "<hr>";
          } else if (blockType === 'table') {
            // For tables, try to extract table structure
            const tableRows = block.querySelectorAll('tr');
            if (tableRows.length > 0) {
              content += "<table>";
              tableRows.forEach((row, rowIndex) => {
                const cells = row.querySelectorAll('td, th');
                content += "<tr>";
                cells.forEach(cell => {
                  const cellContent = cell.textContent.trim();
                  if (rowIndex === 0 && cell.tagName === 'TH') {
                    content += `<th>${cellContent}</th>`;
                  } else {
                    content += `<td>${cellContent}</td>`;
                  }
                });
                content += "</tr>";
              });
              content += "</table>";
            } else {
              content += `<p>${blockContent}</p>`;
            }
          } else if (blockType === 'image') {
            // For images, try to get alt text or caption
            const img = block.querySelector('img');
            if (img) {
              const altText = img.getAttribute('alt') || img.getAttribute('title') || 'Image';
              content += `<img src="${img.src}" alt="${altText}">`;
            }
          } else {
            content += `<p>${blockContent}</p>`;
          }
        }
      }
    }
  }
  
  // Close any remaining open list
  if (currentList) {
    content += `</${currentList}>`;
  }
  
  console.log("Block types found:", blockTypes);
  
  // If we don't have much content, try alternative extraction
  if (content.trim().length < 100) {
    console.log("Low content extraction, trying alternative methods...");
    
    // Try to extract from all text-containing elements
    const allTextElements = docClone.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6, li, td, th');
    let allText = "";
    
    allTextElements.forEach(element => {
      const text = element.textContent.trim();
      if (text && text.length > 10 && !text.includes("Add Icon") && !text.includes("Add Cover")) {
        allText += text + "\n\n";
      }
    });
    
    if (allText.length > content.length) {
      console.log("Using fallback text extraction method");
      content = allText;
    }
  }
  
  // Clean up the content
  content = content
    .replace(/\n{3,}/g, '\n\n')  // Replace multiple newlines with double newlines
    .replace(/\s+/g, ' ')       // Replace multiple spaces with single space
    .replace(/\n /g, '\n')      // Remove spaces after newlines
    .trim();
  
  console.log(`Extracted content length: ${content.length} characters`);
  
  return content;
}

// Function to stitch content as you scroll through virtual scrolling
async function stitchFeishuContentAsYouScroll() {
  console.log("Starting stitch-as-you-scroll content collection...");
  
  const collectedChunks = [];
  const scrollDistance = 500; // Scroll by 500px each time
  const scrollDelay = 800; // Wait 800ms between scrolls
  const maxScrolls = 100; // Maximum scrolls to prevent infinite loops
  
  // Find the main content container
  const contentSelectors = [
    '.docs-content',
    '.docs-body', 
    '.note-editor-text',
    '[data-slate-editor]',
    '.editor-content',
    '.document-content',
    'main',
    '[role="main"]',
    '.fe-doc-container',
    '[data-content]'
  ];
  
  let contentContainer = null;
  for (const selector of contentSelectors) {
    contentContainer = document.querySelector(selector);
    if (contentContainer) {
      console.log(`Found content container: ${selector}`);
      break;
    }
  }
  
  if (!contentContainer) {
    console.log("No content container found, using document body");
    contentContainer = document.body;
  }
  
  // Scroll to top first
  window.scrollTo(0, 0);
  await new Promise(resolve => setTimeout(resolve, 500));
  
  let scrollCount = 0;
  let lastScrollY = 0;
  let noChangeCount = 0;
  
  while (scrollCount < maxScrolls) {
    // Collect current visible content before scrolling
    const currentContent = extractVisibleContent(contentContainer);
    if (currentContent.trim()) {
      collectedChunks.push({
        scrollY: window.scrollY,
        content: currentContent,
        timestamp: Date.now()
      });
      console.log(`Collected chunk ${collectedChunks.length} at scrollY ${window.scrollY}`);
    }
    
    // Scroll down
    window.scrollBy(0, scrollDistance);
    await new Promise(resolve => setTimeout(resolve, scrollDelay));
    
    const currentScrollY = window.scrollY;
    
    // Check if we've reached the bottom
    if (currentScrollY === lastScrollY) {
      noChangeCount++;
      if (noChangeCount >= 3) {
        console.log("Reached bottom of page (no scroll change for 3 iterations)");
        break;
      }
    } else {
      noChangeCount = 0;
      lastScrollY = currentScrollY;
    }
    
    scrollCount++;
    
    // Additional check for reaching bottom
    if (currentScrollY + window.innerHeight >= document.documentElement.scrollHeight - 100) {
      console.log("Reached bottom of page (scroll position check)");
      break;
    }
  }
  
  // Scroll back to top
  window.scrollTo(0, 0);
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log(`Collected ${collectedChunks.length} content chunks`);
  
  // Process and deduplicate collected chunks
  const processedContent = processCollectedChunks(collectedChunks);
  
  return processedContent;
}

// Function to extract visible content from a container
function extractVisibleContent(container) {
  // Try to extract structured content first
  const contentBlocks = container.querySelectorAll('[data-block-type]');
  if (contentBlocks.length > 0) {
    return extractStructuredContent(contentBlocks);
  }
  
  // Fallback to general text extraction
  return extractGeneralContent(container);
}

// Function to extract structured content from data-block-type elements
function extractStructuredContent(blocks) {
  let content = "";
  let currentList = null; // Track current list state
  
  for (const block of blocks) {
    const blockType = block.getAttribute('data-block-type');
    
    // Skip page block (contains title)
    if (blockType === 'page') continue;
    
    let blockContent = "";
    
    // Handle all possible block types
    if (blockType === 'text' || blockType === 'heading2' || blockType === 'bullet' || 
        blockType === 'paragraph' || blockType === 'heading1' || blockType === 'heading3' ||
        blockType === 'heading4' || blockType === 'heading5' || blockType === 'heading6' ||
        blockType === 'list' || blockType === 'numbered_list' || blockType === 'quote' ||
        blockType === 'callout' || blockType === 'code' || blockType === 'table' ||
        blockType === 'divider' || blockType === 'embed' || blockType === 'image') {
      
      // Check if it's an empty block (for spacing)
      if (block.classList.contains('isEmpty')) {
        content += "<br>";
        continue;
      }
      
      // Extract text from data-leaf spans
      const leafSpans = block.querySelectorAll('span[data-leaf="true"]');
      let hasRealContent = false;
      
      for (const span of leafSpans) {
        const spanText = span.textContent.trim();
        if (spanText && spanText !== '​' && spanText !== '\u200B' && spanText !== '\n') {
          hasRealContent = true;
          
          // Clean up abbreviation wrappers - get the actual text
          if (span.closest('.abbreviation-inline-wrapper')) {
            const abbreviationText = span.querySelector('.abbreviation-text');
            if (abbreviationText) {
              blockContent += abbreviationText.textContent.trim() + " ";
            } else {
              blockContent += spanText + " ";
            }
          } else {
            blockContent += spanText + " ";
          }
        }
      }
      
      // If no data-leaf spans found, try to get text directly from the block
      if (!hasRealContent) {
        const directText = block.textContent.trim();
        if (directText && directText !== '​' && directText !== '\u200B' && directText !== '\n') {
          hasRealContent = true;
          blockContent = directText + " ";
        }
      }
      
      // Only add content if it's substantial
      if (hasRealContent && blockContent.trim().length > 0) {
        blockContent = blockContent.trim();
        
        // Handle list state transitions
        if (blockType === 'bullet' || blockType === 'list') {
          if (currentList !== 'ul') {
            if (currentList) content += `</${currentList}>`;
            content += "<ul>";
            currentList = 'ul';
          }
          // Clean up bullet point text (remove existing bullet characters)
          const cleanedContent = blockContent.replace(/^[•·‣⁃▪▫‣◦‧⁌⁍]*\s*/, '').trim();
          content += `<li>${cleanedContent}</li>`;
        } else if (blockType === 'numbered_list') {
          if (currentList !== 'ol') {
            if (currentList) content += `</${currentList}>`;
            content += "<ol>";
            currentList = 'ol';
          }
          // Clean up numbered list text (remove existing numbers and dots)
          const cleanedContent = blockContent.replace(/^\d+[\.\)]\s*/, '').trim();
          content += `<li>${cleanedContent}</li>`;
        } else {
          // Close any open list
          if (currentList) {
            content += `</${currentList}>`;
            currentList = null;
          }
          
          // Add appropriate HTML formatting based on block type
          if (blockType === 'heading1' || blockType === 'heading2' || blockType === 'heading3' || 
              blockType === 'heading4' || blockType === 'heading5' || blockType === 'heading6') {
            const level = blockType.replace('heading', '');
            content += `<h${level}>${blockContent}</h${level}>`;
          } else if (blockType === 'quote') {
            content += `<blockquote>${blockContent}</blockquote>`;
          } else if (blockType === 'callout') {
            content += `<div class="callout">${blockContent}</div>`;
          } else if (blockType === 'code') {
            content += `<pre><code>${blockContent}</code></pre>`;
          } else if (blockType === 'divider') {
            content += "<hr>";
          } else if (blockType === 'table') {
            // For tables, try to extract table structure
            const tableRows = block.querySelectorAll('tr');
            if (tableRows.length > 0) {
              content += "<table>";
              tableRows.forEach((row, rowIndex) => {
                const cells = row.querySelectorAll('td, th');
                content += "<tr>";
                cells.forEach(cell => {
                  const cellContent = cell.textContent.trim();
                  if (rowIndex === 0 && cell.tagName === 'TH') {
                    content += `<th>${cellContent}</th>`;
                  } else {
                    content += `<td>${cellContent}</td>`;
                  }
                });
                content += "</tr>";
              });
              content += "</table>";
            } else {
              content += `<p>${blockContent}</p>`;
            }
          } else if (blockType === 'image') {
            // For images, try to get alt text or caption
            const img = block.querySelector('img');
            if (img) {
              const altText = img.getAttribute('alt') || img.getAttribute('title') || 'Image';
              content += `<img src="${img.src}" alt="${altText}">`;
            }
          } else {
            content += `<p>${blockContent}</p>`;
          }
        }
      }
    }
  }
  
  // Close any remaining open list
  if (currentList) {
    content += `</${currentList}>`;
  }
  
  return content;
}

// Function to extract general content from container
function extractGeneralContent(container) {
  // Get all text-containing elements
  const textElements = container.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6, li, td, th');
  let content = "";
  
  textElements.forEach(element => {
    const text = element.textContent.trim();
    if (text && text.length > 10 && !text.includes("Add Icon") && !text.includes("Add Cover")) {
      content += text + "\n\n";
    }
  });
  
  return content;
}

// Function to process and deduplicate collected chunks
function processCollectedChunks(chunks) {
  console.log("Processing collected chunks...");
  
  // Sort chunks by scroll position
  chunks.sort((a, b) => a.scrollY - b.scrollY);
  
  // Deduplicate content (remove overlapping content)
  const uniqueContent = [];
  const seenContent = new Set();
  
  for (const chunk of chunks) {
    const lines = chunk.content.split('\n');
    const uniqueLines = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !seenContent.has(trimmedLine) && trimmedLine.length > 5) {
        seenContent.add(trimmedLine);
        uniqueLines.push(line);
      }
    }
    
    if (uniqueLines.length > 0) {
      uniqueContent.push(uniqueLines.join('\n'));
    }
  }
  
  // Join all unique content
  const finalContent = uniqueContent.join('\n\n');

    // Clean up the content
  const cleanedContent = finalContent
    .replace(/\n{3,}/g, '\n\n')  // Replace multiple newlines with double newlines
    .replace(/\s+/g, ' ')       // Replace multiple spaces with single space
    .replace(/\n /g, '\n')      // Remove spaces after newlines
    .trim();
  
  console.log(`Processed content: ${cleanedContent.length} characters`);
  
  return cleanedContent;
}

// Function to extract content from Feishu documents
async function extractFeishuDocContent(docClone) {
  console.log("Extracting Feishu document content...");

  // Find the title - look for h1 with specific structure
  let title = "Document";
  const titleElement = docClone.querySelector('h1 .ace-line span[data-leaf="true"]');
  if (titleElement) {
    const text = titleElement.textContent.trim();
    if (text && text.length > 3 && !text.includes("Add Icon") && !text.includes("Add Cover")) {
      title = text;
    }
  }

  // Find the author - look for specific author element
  let author = "";
  const authorElement = docClone.querySelector('.docs-info-avatar-name-text');
  if (authorElement) {
    author = authorElement.textContent.trim();
  }

  // Extract main content by processing each content block
  let content = "";
  const contentBlocks = docClone.querySelectorAll('[data-block-type]');
  
  console.log(`Found ${contentBlocks.length} content blocks to process`);
  
  for (const block of contentBlocks) {
    const blockType = block.getAttribute('data-block-type');
    
    // Skip page block (contains title)
    if (blockType === 'page') continue;
    
    let blockContent = "";
    
    // Handle all possible block types
    if (blockType === 'text' || blockType === 'heading2' || blockType === 'bullet' || 
        blockType === 'paragraph' || blockType === 'heading1' || blockType === 'heading3' ||
        blockType === 'heading4' || blockType === 'heading5' || blockType === 'heading6' ||
        blockType === 'list' || blockType === 'numbered_list' || blockType === 'quote' ||
        blockType === 'callout' || blockType === 'code' || blockType === 'table' ||
        blockType === 'divider' || blockType === 'embed' || blockType === 'image') {
      
      // Check if it's an empty block (for spacing)
      if (block.classList.contains('isEmpty')) {
        content += "\n";
        continue;
      }
      
      // Extract text from data-leaf spans
      const leafSpans = block.querySelectorAll('span[data-leaf="true"]');
      let hasRealContent = false;
      
      for (const span of leafSpans) {
        const spanText = span.textContent.trim();
        if (spanText && spanText !== '​' && spanText !== '\u200B' && spanText !== '\n') {
          hasRealContent = true;
          
          // Clean up abbreviation wrappers - get the actual text
          if (span.closest('.abbreviation-inline-wrapper')) {
            const abbreviationText = span.querySelector('.abbreviation-text');
            if (abbreviationText) {
              blockContent += abbreviationText.textContent.trim() + " ";
            } else {
              blockContent += spanText + " ";
            }
          } else {
            blockContent += spanText + " ";
          }
        }
      }
      
      // If no data-leaf spans found, try to get text directly from the block
      if (!hasRealContent) {
        const directText = block.textContent.trim();
        if (directText && directText !== '​' && directText !== '\u200B' && directText !== '\n') {
          hasRealContent = true;
          blockContent = directText + " ";
        }
      }
      
      // Only add content if it's substantial
      if (hasRealContent && blockContent.trim().length > 0) {
        blockContent = blockContent.trim();
        
        // Add appropriate formatting based on block type
        if (blockType === 'heading1' || blockType === 'heading2' || blockType === 'heading3' || 
            blockType === 'heading4' || blockType === 'heading5' || blockType === 'heading6') {
          const level = blockType.replace('heading', '');
          const hashes = '#'.repeat(parseInt(level));
          content += `\n${hashes} ${blockContent}\n\n`;
        } else if (blockType === 'bullet' || blockType === 'list') {
          content += "• " + blockContent + "\n";
        } else if (blockType === 'numbered_list') {
          content += "1. " + blockContent + "\n";
        } else if (blockType === 'quote') {
          content += `> ${blockContent}\n\n`;
        } else if (blockType === 'callout') {
          content += `**${blockContent}**\n\n`;
        } else if (blockType === 'code') {
          content += `\`\`\`\n${blockContent}\n\`\`\`\n\n`;
        } else if (blockType === 'divider') {
          content += "---\n\n";
        } else if (blockType === 'table') {
          // For tables, try to extract table structure
          const tableRows = block.querySelectorAll('tr');
          if (tableRows.length > 0) {
            content += "\n";
            tableRows.forEach((row, rowIndex) => {
              const cells = row.querySelectorAll('td, th');
              const rowContent = Array.from(cells).map(cell => cell.textContent.trim()).join(' | ');
              content += `| ${rowContent} |\n`;
              if (rowIndex === 0) {
                content += `| ${Array.from(cells).map(() => '---').join(' | ')} |\n`;
              }
            });
            content += "\n";
        } else {
            content += blockContent + "\n\n";
          }
        } else if (blockType === 'image') {
          // For images, try to get alt text or caption
          const img = block.querySelector('img');
          if (img) {
            const altText = img.getAttribute('alt') || img.getAttribute('title') || 'Image';
            content += `![${altText}](${img.src})\n\n`;
          }
        } else {
          content += blockContent + "\n\n";
        }
      }
    }
  }

  // If we still don't have much content, try alternative extraction methods
  if (content.trim().length < 100) {
    console.log("Low content extraction, trying alternative methods...");
    
    // Method 1: Try to find content in the main document area
    const mainContentSelectors = [
      '.docs-content',
      '.docs-body',
      '.note-editor-text',
      '[data-slate-editor]',
      '.editor-content',
      '.document-content',
      'main',
      '[role="main"]'
    ];
    
    for (const selector of mainContentSelectors) {
      const mainArea = docClone.querySelector(selector);
      if (mainArea) {
        const mainText = mainArea.textContent.trim();
        if (mainText.length > content.length) {
          console.log(`Found more content using selector: ${selector}`);
          content = mainText;
          break;
        }
      }
    }
    
    // Method 2: Try to extract from all text-containing elements
    if (content.trim().length < 100) {
      const allTextElements = docClone.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6, li, td, th');
      let allText = "";
      
      allTextElements.forEach(element => {
        const text = element.textContent.trim();
        if (text && text.length > 10 && !text.includes("Add Icon") && !text.includes("Add Cover")) {
          allText += text + "\n\n";
        }
      });
      
      if (allText.length > content.length) {
        console.log("Using fallback text extraction method");
        content = allText;
      }
    }
  }

  // Clean up the content
  content = content
    .replace(/\n{3,}/g, '\n\n')  // Replace multiple newlines with double newlines
    .replace(/\s+/g, ' ')       // Replace multiple spaces with single space
    .replace(/\n /g, '\n')      // Remove spaces after newlines
    .trim();

  // Clean up and remove unnecessary attributes from DOM elements
  const elementsToClean = docClone.querySelectorAll('*');
  elementsToClean.forEach(element => {
    // Remove attributes that don't affect layout
    const attributesToRemove = [
      'data-block-id', 'data-record-id', 'data-zone-id', 'data-node', 'data-string',
      'data-enter', 'data-leaf', 'data-inline-wrapper', 'data-link-node',
      'data-abbreviation-plugin-enabled', 'data-placeholder', 'spellcheck',
      'data-href', 'data-icon', 'data-content-editable-root', 'data-zone-container',
      'uuid', 'abbreviation-id', 'contenteditable', 'dir'
    ];
    
    attributesToRemove.forEach(attr => {
      if (element.hasAttribute(attr)) {
        element.removeAttribute(attr);
      }
    });
    
    // Clean up style attributes but keep essential layout styles
    if (element.hasAttribute('style')) {
      const style = element.getAttribute('style');
      const essentialStyles = [];
      
      // Keep only essential layout styles
      const stylesToKeep = ['display', 'position', 'float', 'clear', 'width', 'height'];
      stylesToKeep.forEach(prop => {
        const match = style.match(new RegExp(`${prop}\\s*:\\s*([^;]+)`));
        if (match) {
          essentialStyles.push(`${prop}: ${match[1]}`);
        }
      });
      
      if (essentialStyles.length > 0) {
        element.setAttribute('style', essentialStyles.join('; '));
    } else {
        element.removeAttribute('style');
      }
    }
  });

  console.log("Feishu extraction complete:", {
    title: title,
    author: author,
    contentLength: content.length
  });

  return {
    title: title,
    author: author,
    content: content,
    extractedBy: "Feishu Document Extractor"
  };
}