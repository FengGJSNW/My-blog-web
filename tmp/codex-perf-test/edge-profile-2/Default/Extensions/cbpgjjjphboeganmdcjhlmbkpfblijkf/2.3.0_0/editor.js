const canvas = document.getElementById('editor-canvas');
const ctx = canvas.getContext('2d');
const canvasScroll = document.getElementById('canvas-scroll');
const stage = document.getElementById('canvas-stage');
const overlay = document.getElementById('redaction-overlay');
const dragPreview = document.getElementById('drag-preview');
const statusText = document.getElementById('status-text');
const metaText = document.getElementById('meta-text');
const zoomLabel = document.getElementById('zoom-label');
const sourceLabel = document.getElementById('source-label');
const colorInput = document.getElementById('color-input');
const sizeInput = document.getElementById('size-input');
const redactionList = document.getElementById('redaction-list');
const exportFormat = document.getElementById('export-format');
const HISTORY_LIMIT = 12;
const DONATE_URL = 'https://www.pixelstech.net/donate.php?utm_source=pagesaver&utm_action=capture_screenshot';

let activeTool = 'pen';
let zoom = 1;
let baseZoom = 1;
let fitZoom = 1;
let payload = null;
let originalDataUrl = null;
let redactionSuggestions = [];
let isPointerDown = false;
let startPoint = null;
let lastPoint = null;
let history = [];
let historyIndex = -1;
let selectedTextEntry = null;

document.addEventListener('DOMContentLoaded', initEditor);

async function initEditor() {
  bindControls();
  renderEditorInfo();
  const captureId = new URLSearchParams(location.search).get('captureId');
  if (!captureId) {
    setStatus('Missing screenshot data.');
    return;
  }

  try {
    payload = await loadScreenshotPayload(captureId);
    originalDataUrl = payload.imageDataUrl;
    redactionSuggestions = Array.isArray(payload.redactionSuggestions) ? payload.redactionSuggestions.slice() : [];
    baseZoom = getInitialDisplayScale(payload);
    zoom = baseZoom;
    await loadImageIntoCanvas(payload.imageDataUrl);
    setInitialZoomToFit();
    sourceLabel.textContent = payload.sourceUrl || payload.title || 'Captured page';
    setStatus(`${payload.mode || 'screenshot'} capture loaded`);
    pushHistory();
    renderRedactions();
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'Could not load screenshot.');
  }
}

async function loadScreenshotPayload(captureId) {
  const idbPayload = await getScreenshotPayloadFromIdb(captureId).catch(() => null);
  if (idbPayload) return idbPayload;
  const response = await chrome.runtime.sendMessage({ action: 'getScreenshotPayload', captureId });
  if (!response?.success || !response.payload) {
    throw new Error(response?.error || 'Screenshot data unavailable');
  }
  return response.payload;
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

function bindControls() {
  document.querySelectorAll('.tool').forEach((button) => {
    button.addEventListener('click', () => {
      activeTool = button.dataset.tool;
      document.querySelectorAll('.tool').forEach((item) => item.classList.toggle('active', item === button));
      if (activeTool !== 'text') clearSelectedTextEntry();
      setStatus(`${button.textContent.trim()} selected`);
      updateMetaText();
    });
  });

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);

  document.getElementById('undo-btn').addEventListener('click', undo);
  document.getElementById('redo-btn').addEventListener('click', redo);
  document.getElementById('zoom-in-btn').addEventListener('click', () => setZoom(zoom + 0.15));
  document.getElementById('zoom-out-btn').addEventListener('click', () => setZoom(zoom - 0.15));
  document.getElementById('reset-zoom-btn').addEventListener('click', () => setZoom(fitZoom));
  document.getElementById('reset-image-btn').addEventListener('click', resetImage);
  document.getElementById('download-btn').addEventListener('click', downloadImage);
  document.getElementById('apply-all-redactions').addEventListener('click', applyAllRedactions);
  document.getElementById('donate-btn')?.addEventListener('click', openDonatePage);
  sizeInput.addEventListener('input', () => {
    if (activeTool === 'text') updateSelectedTextSize();
    updateMetaText();
  });
  colorInput.addEventListener('input', () => {
    if (activeTool === 'text') updateSelectedTextColor();
    updateMetaText();
  });
  window.addEventListener('resize', handleWindowResize);
}

function renderEditorInfo() {
  const manifest = chrome.runtime.getManifest();
  const developerLink = document.getElementById('developer-link');
  const extensionVersion = document.getElementById('extension-version');
  if (developerLink) {
    developerLink.textContent = 'PixelsTech';
    developerLink.href = 'https://pagesaver.pixelstech.net';
  }
  if (extensionVersion) extensionVersion.textContent = manifest.version || '';
}

function openDonatePage() {
  if (chrome.tabs?.create) {
    chrome.tabs.create({ url: DONATE_URL });
    return;
  }
  window.open(DONATE_URL, '_blank', 'noopener');
}

function handleWindowResize() {
  const wasFit = Math.abs(zoom - fitZoom) < 0.005;
  fitZoom = getWorkspaceFitZoom();
  if (wasFit) zoom = fitZoom;
  updateCanvasDisplay();
}

async function loadImageIntoCanvas(dataUrl) {
  const img = await loadImage(dataUrl);
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  updateCanvasDisplay();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load screenshot image'));
    img.src = src;
  });
}

function getInitialDisplayScale(nextPayload) {
  const scale = Number(nextPayload?.displayScale);
  if (Number.isFinite(scale) && scale > 0) return Math.max(0.1, Math.min(1, scale));
  return 1;
}

function onPointerDown(event) {
  const point = getCanvasPoint(event);
  if (!point) return;
  isPointerDown = true;
  startPoint = point;
  lastPoint = point;
  canvas.setPointerCapture(event.pointerId);

  if (activeTool === 'text') {
    return;
  }

  if (activeTool === 'pen' || activeTool === 'highlight') {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = colorInput.value;
    ctx.lineWidth = Number(sizeInput.value);
    if (activeTool === 'highlight') {
      ctx.globalAlpha = 0.32;
      ctx.lineWidth = Number(sizeInput.value) * 3;
    }
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  } else {
    showDragPreview(startPoint, point);
  }
}

function onPointerMove(event) {
  if (!isPointerDown) return;
  const point = getCanvasPoint(event);
  if (!point) return;

  if (activeTool === 'pen' || activeTool === 'highlight') {
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPoint = point;
  } else {
    showDragPreview(startPoint, point);
  }
}

function onPointerUp(event) {
  if (!isPointerDown) return;
  const point = getCanvasPoint(event);
  isPointerDown = false;
  hideDragPreview();

  if (activeTool === 'pen' || activeTool === 'highlight') {
    ctx.restore();
    pushHistory();
    return;
  }

  if (!point) return;

  if (activeTool === 'text') {
    addText(point);
    return;
  }

  const rect = normalizeRect(startPoint, point);
  if (rect.width < 3 || rect.height < 3) return;

  if (activeTool === 'rect') drawRectangle(rect);
  if (activeTool === 'arrow') drawArrow(startPoint, point);
  if (activeTool === 'blur') applyBlurRect(rect);
  if (activeTool === 'pixelate') applyPixelateRect(rect);
  if (activeTool === 'crop') cropToRect(rect);

  pushHistory();
}

function onPointerLeave() {
  if (activeTool !== 'pen' && activeTool !== 'highlight') hideDragPreview();
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / zoom;
  const y = (event.clientY - rect.top) / zoom;
  if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) return null;
  return { x, y };
}

function normalizeRect(a, b) {
  const x = Math.max(0, Math.min(a.x, b.x));
  const y = Math.max(0, Math.min(a.y, b.y));
  const right = Math.min(canvas.width, Math.max(a.x, b.x));
  const bottom = Math.min(canvas.height, Math.max(a.y, b.y));
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(1, Math.round(right - x)),
    height: Math.max(1, Math.round(bottom - y))
  };
}

function showDragPreview(a, b) {
  const rect = normalizeRect(a, b);
  dragPreview.style.display = 'block';
  dragPreview.style.left = `${rect.x * zoom}px`;
  dragPreview.style.top = `${rect.y * zoom}px`;
  dragPreview.style.width = `${rect.width * zoom}px`;
  dragPreview.style.height = `${rect.height * zoom}px`;
}

function hideDragPreview() {
  dragPreview.style.display = 'none';
}

function drawRectangle(rect) {
  ctx.save();
  ctx.strokeStyle = colorInput.value;
  ctx.lineWidth = Number(sizeInput.value);
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}

function drawArrow(from, to) {
  const size = Number(sizeInput.value);
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const headLength = Math.max(14, size * 4);
  ctx.save();
  ctx.strokeStyle = colorInput.value;
  ctx.fillStyle = colorInput.value;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - headLength * Math.cos(angle - Math.PI / 6), to.y - headLength * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(to.x - headLength * Math.cos(angle + Math.PI / 6), to.y - headLength * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function addText(point) {
  const size = getTextSize();
  const input = document.createElement('textarea');
  input.className = 'text-entry';
  input.rows = 1;
  input.wrap = 'off';
  input.dataset.x = String(point.x);
  input.dataset.y = String(point.y);
  input.dataset.fontSize = String(size);
  input.dataset.color = colorInput.value;
  input.value = '';
  applyTextEntryDisplay(input);
  stage.appendChild(input);
  window.setTimeout(() => input.focus(), 0);

  selectTextEntry(input);
  attachTextEntryInteractions(input);

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!input.value.trim()) input.remove();
      else input.blur();
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      input.blur();
    }
  });
  input.addEventListener('focus', () => selectTextEntry(input));
  input.addEventListener('input', () => {
    applyTextEntryDisplay(input);
  });
  input.addEventListener('blur', () => {
    if (!input.value.trim()) {
      if (selectedTextEntry === input) selectedTextEntry = null;
      input.remove();
    }
    updateMetaText();
  });
}

function attachTextEntryInteractions(input) {
  let dragState = null;

  input.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    selectTextEntry(input);
    if (event.button !== 0) return;
    dragState = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: Number(input.dataset.x || 0),
      originY: Number(input.dataset.y || 0),
      moved: false
    };
    input.setPointerCapture(event.pointerId);
  });

  input.addEventListener('pointermove', (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const dx = event.clientX - dragState.startClientX;
    const dy = event.clientY - dragState.startClientY;
    if (!dragState.moved && Math.hypot(dx, dy) < 4) return;
    dragState.moved = true;
    event.preventDefault();
    event.stopPropagation();
    input.classList.add('moving');
    input.dataset.x = String(clampNumber(dragState.originX + dx / zoom, 0, canvas.width - 1));
    input.dataset.y = String(clampNumber(dragState.originY + dy / zoom, 0, canvas.height - 1));
    applyTextEntryDisplay(input);
    updateMetaText();
  });

  input.addEventListener('pointerup', (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const moved = dragState.moved;
    dragState = null;
    input.classList.remove('moving');
    try { input.releasePointerCapture(event.pointerId); } catch {}
    if (moved) {
      event.preventDefault();
      event.stopPropagation();
      input.focus();
      setStatus('Text moved');
      updateMetaText();
    }
  });

  input.addEventListener('pointercancel', () => {
    dragState = null;
    input.classList.remove('moving');
  });

  input.addEventListener('click', (event) => {
    event.stopPropagation();
    selectTextEntry(input);
  });
}

function getTextSize() {
  return Math.max(32, Number(sizeInput.value) * 9);
}

function selectTextEntry(input) {
  selectedTextEntry = input;
  activeTool = 'text';
  document.querySelectorAll('.tool').forEach((button) => {
    button.classList.toggle('active', button.dataset.tool === 'text');
  });
  document.querySelectorAll('.text-entry').forEach((entry) => entry.classList.toggle('selected', entry === input));
  updateMetaText();
}

function clearSelectedTextEntry() {
  if (selectedTextEntry && selectedTextEntry.isConnected) {
    selectedTextEntry.classList.remove('selected');
  }
  selectedTextEntry = null;
}

function updateSelectedTextSize() {
  if (!selectedTextEntry || !selectedTextEntry.isConnected) return;
  selectedTextEntry.dataset.fontSize = String(getTextSize());
  applyTextEntryDisplay(selectedTextEntry);
}

function updateSelectedTextColor() {
  if (!selectedTextEntry || !selectedTextEntry.isConnected) return;
  selectedTextEntry.dataset.color = colorInput.value;
  applyTextEntryDisplay(selectedTextEntry);
}

function applyTextEntryDisplay(input) {
  const x = Number(input.dataset.x || 0);
  const y = Number(input.dataset.y || 0);
  const size = Number(input.dataset.fontSize || getTextSize());
  const color = input.dataset.color || colorInput.value;
  const displayFontSize = Math.max(18, size * zoom);
  const displayLineHeight = displayFontSize * 1.25;
  const lineCount = Math.max(1, input.value.split(/\r?\n/).length);
  input.style.left = `${x * zoom}px`;
  input.style.top = `${y * zoom}px`;
  input.style.minWidth = `${Math.max(220, 320 * zoom)}px`;
  input.style.maxWidth = `${Math.max(240, (canvas.width - x) * zoom)}px`;
  input.style.fontSize = `${displayFontSize}px`;
  input.style.lineHeight = `${displayLineHeight}px`;
  input.style.color = color;
  input.style.height = `${displayLineHeight * lineCount}px`;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateTextEntriesDisplay() {
  document.querySelectorAll('.text-entry').forEach(applyTextEntryDisplay);
}

function drawTextEntryToContext(targetCtx, input) {
  const text = input.value.trim();
  if (!text) return;
  const x = Number(input.dataset.x || 0);
  const y = Number(input.dataset.y || 0);
  const size = Number(input.dataset.fontSize || getTextSize());
  const color = input.dataset.color || colorInput.value;
  targetCtx.save();
  targetCtx.fillStyle = color;
  targetCtx.font = `800 ${size}px ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  targetCtx.textBaseline = 'top';
  text.split(/\r?\n/).forEach((line, index) => {
    targetCtx.fillText(line, x, y + index * size * 1.25);
  });
  targetCtx.restore();
}

function applyBlurRect(rect) {
  const temp = document.createElement('canvas');
  temp.width = rect.width;
  temp.height = rect.height;
  const tempCtx = temp.getContext('2d');
  tempCtx.drawImage(canvas, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  ctx.save();
  ctx.filter = `blur(${Math.max(6, Number(sizeInput.value) * 1.8)}px)`;
  ctx.drawImage(temp, rect.x, rect.y);
  ctx.restore();
}

function applyPixelateRect(rect) {
  const pixelSize = Math.max(6, Number(sizeInput.value) * 2);
  const smallWidth = Math.max(1, Math.ceil(rect.width / pixelSize));
  const smallHeight = Math.max(1, Math.ceil(rect.height / pixelSize));
  const temp = document.createElement('canvas');
  temp.width = smallWidth;
  temp.height = smallHeight;
  const tempCtx = temp.getContext('2d');
  tempCtx.imageSmoothingEnabled = false;
  tempCtx.drawImage(canvas, rect.x, rect.y, rect.width, rect.height, 0, 0, smallWidth, smallHeight);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(temp, 0, 0, smallWidth, smallHeight, rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
  ctx.imageSmoothingEnabled = true;
}

function cropToRect(rect) {
  const imageData = ctx.getImageData(rect.x, rect.y, rect.width, rect.height);
  canvas.width = rect.width;
  canvas.height = rect.height;
  ctx.putImageData(imageData, 0, 0);
  document.querySelectorAll('.text-entry').forEach((input) => input.remove());
  selectedTextEntry = null;
  redactionSuggestions = [];
  updateCanvasDisplay();
  renderRedactions();
}

function renderRedactions() {
  overlay.innerHTML = '';
  redactionList.innerHTML = '';
  document.getElementById('apply-all-redactions').disabled = redactionSuggestions.length === 0;

  if (redactionSuggestions.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'redaction-empty';
    empty.textContent = 'No redaction suggestions available for this capture.';
    redactionList.appendChild(empty);
    return;
  }

  redactionSuggestions.forEach((item, index) => {
    const box = document.createElement('div');
    box.className = 'redaction-box';
    box.style.left = `${item.x * zoom}px`;
    box.style.top = `${item.y * zoom}px`;
    box.style.width = `${item.width * zoom}px`;
    box.style.height = `${item.height * zoom}px`;
    overlay.appendChild(box);

    const row = document.createElement('div');
    row.className = 'redaction-item';
    row.innerHTML = `<strong>${escapeHtml(item.label || 'Sensitive text')}</strong><span>${escapeHtml(item.reason || 'Detected on page')}</span>`;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Apply blur';
    button.addEventListener('click', () => applySingleRedaction(index));
    row.appendChild(button);
    redactionList.appendChild(row);
  });
}

function applySingleRedaction(index) {
  const item = redactionSuggestions[index];
  if (!item) return;
  applyBlurRect(clampRect(item));
  redactionSuggestions.splice(index, 1);
  pushHistory();
  renderRedactions();
  setStatus('Redaction applied');
}

function applyAllRedactions() {
  if (redactionSuggestions.length === 0) return;
  redactionSuggestions.forEach((item) => applyBlurRect(clampRect(item)));
  redactionSuggestions = [];
  pushHistory();
  renderRedactions();
  setStatus('All redactions applied');
}

function clampRect(rect) {
  const x = Math.max(0, Math.min(canvas.width - 1, Math.round(rect.x)));
  const y = Math.max(0, Math.min(canvas.height - 1, Math.round(rect.y)));
  const width = Math.max(1, Math.min(canvas.width - x, Math.round(rect.width)));
  const height = Math.max(1, Math.min(canvas.height - y, Math.round(rect.height)));
  return { x, y, width, height };
}

function pushHistory() {
  history = history.slice(0, historyIndex + 1);
  history.push(canvas.toDataURL('image/png'));
  if (history.length > HISTORY_LIMIT) history.shift();
  historyIndex = history.length - 1;
  updateHistoryButtons();
}

async function restoreHistory(index) {
  if (index < 0 || index >= history.length) return;
  historyIndex = index;
  await loadImageIntoCanvas(history[historyIndex]);
  updateHistoryButtons();
  setStatus('History restored');
}

function undo() {
  restoreHistory(historyIndex - 1);
}

function redo() {
  restoreHistory(historyIndex + 1);
}

function updateHistoryButtons() {
  document.getElementById('undo-btn').disabled = historyIndex <= 0;
  document.getElementById('redo-btn').disabled = historyIndex >= history.length - 1;
}

async function resetImage() {
  if (!originalDataUrl) return;
  await loadImageIntoCanvas(originalDataUrl);
  setInitialZoomToFit();
  document.querySelectorAll('.text-entry').forEach((input) => input.remove());
  selectedTextEntry = null;
  redactionSuggestions = Array.isArray(payload.redactionSuggestions) ? payload.redactionSuggestions.slice() : [];
  history = [];
  historyIndex = -1;
  pushHistory();
  renderRedactions();
  setStatus('Capture reset');
}

function setZoom(nextZoom) {
  const minZoom = Math.max(0.05, baseZoom * 0.25);
  const maxZoom = Math.max(3, baseZoom * 6);
  zoom = Math.max(minZoom, Math.min(maxZoom, Number(nextZoom.toFixed(3))));
  updateCanvasDisplay();
}

function setInitialZoomToFit() {
  fitZoom = getWorkspaceFitZoom();
  zoom = fitZoom;
  updateCanvasDisplay();
}

function getWorkspaceFitZoom() {
  const availableWidth = Math.max(320, canvasScroll.clientWidth - 56);
  const availableHeight = Math.max(240, canvasScroll.clientHeight - 56);
  const widthFit = availableWidth / Math.max(1, canvas.width);
  const heightFit = availableHeight / Math.max(1, canvas.height);
  const fit = Math.min(widthFit, heightFit);
  return Math.max(0.05, Math.min(baseZoom, fit));
}

function updateCanvasDisplay() {
  const displayWidth = Math.round(canvas.width * zoom);
  const displayHeight = Math.round(canvas.height * zoom);
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;
  stage.style.width = `${displayWidth}px`;
  stage.style.height = `${displayHeight}px`;
  overlay.style.width = `${displayWidth}px`;
  overlay.style.height = `${displayHeight}px`;
  const relative = Math.round((zoom / baseZoom) * 100);
  zoomLabel.textContent = Math.abs(zoom - fitZoom) < 0.005 ? `Fit ${relative}%` : `${relative}%`;
  updateTextEntriesDisplay();
  renderRedactions();
  updateMetaText();
}

function buildExportCanvas() {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;
  const exportCtx = exportCanvas.getContext('2d');
  exportCtx.drawImage(canvas, 0, 0);
  document.querySelectorAll('.text-entry').forEach((input) => drawTextEntryToContext(exportCtx, input));
  return exportCanvas;
}

function canvasToBlob(type, quality = 0.92) {
  const exportCanvas = buildExportCanvas();
  return new Promise((resolve) => {
    exportCanvas.toBlob(resolve, type, quality);
  });
}

async function downloadImage() {
  const format = exportFormat.value;
  const base = payload?.filenameBase || 'pagesaver-screenshot';

  if (format === 'pdf') {
    await downloadAsPdf(base);
    return;
  }

  const type = format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  const blob = await canvasToBlob(type);
  if (!blob) {
    setStatus('Export failed');
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${base}-${Date.now()}.${format}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  setStatus('Downloaded');
  trackSave(payload?.mode);
}

async function downloadAsPdf(base) {
  const exportCanvas = buildExportCanvas();
  const imgData = exportCanvas.toDataURL('image/jpeg', 0.92);
  const pxW = exportCanvas.width;
  const pxH = exportCanvas.height;

  const { jsPDF } = window.jspdf;
  const orientation = pxW >= pxH ? 'landscape' : 'portrait';
  // fit image to A4 (595.28 x 841.89 pt) preserving aspect ratio
  const pageW = orientation === 'landscape' ? 841.89 : 595.28;
  const pageH = orientation === 'landscape' ? 595.28 : 841.89;
  const scale = Math.min(pageW / pxW, pageH / pxH);
  const imgW = pxW * scale;
  const imgH = pxH * scale;
  const offsetX = (pageW - imgW) / 2;
  const offsetY = (pageH - imgH) / 2;

  const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
  pdf.addImage(imgData, 'JPEG', offsetX, offsetY, imgW, imgH);
  pdf.save(`${base}-${Date.now()}.pdf`);
  setStatus('Downloaded');
  trackSave(payload?.mode);
}

function trackSave(mode) {
  try {
    const manifest = chrome.runtime.getManifest();
    const captureType = `capture_${(mode || 'screenshot').toLowerCase()}`;
    const trackUrl = `https://www.pixelstech.net/application/pagesaver/?action=save&type=${encodeURIComponent(captureType)}&version=${manifest.version}`;
    fetch(trackUrl, { method: 'GET' });
  } catch (error) {
    console.error('Error tracking save:', error);
  }
}

function setStatus(text) {
  statusText.textContent = text;
}

function updateMetaText() {
  if (!metaText) return;
  const hasTextSelection = activeTool === 'text' && selectedTextEntry && selectedTextEntry.isConnected;
  const color = hasTextSelection ? selectedTextEntry.dataset.color || colorInput.value : colorInput.value;
  const rawSize = Number(sizeInput.value);
  const toolLabels = {
    pen: 'Pen',
    highlight: 'Highlighter',
    rect: 'Rectangle',
    arrow: 'Arrow',
    text: 'Text',
    blur: 'Blur',
    pixelate: 'Pixelate',
    crop: 'Crop'
  };

  if (hasTextSelection) {
    const fontSize = Math.round(Number(selectedTextEntry.dataset.fontSize || getTextSize()));
    const x = Math.round(Number(selectedTextEntry.dataset.x || 0));
    const y = Math.round(Number(selectedTextEntry.dataset.y || 0));
    metaText.textContent = `Editing text | Color ${color.toUpperCase()} | Font ${fontSize}px | X ${x}, Y ${y}`;
    return;
  }

  if (activeTool === 'text') {
    metaText.textContent = `Text | Color ${color.toUpperCase()} | Font ${Math.round(getTextSize())}px`;
  } else if (activeTool === 'blur') {
    metaText.textContent = `Blur | Strength ${Math.round(Math.max(6, rawSize * 1.8))}px`;
  } else if (activeTool === 'pixelate') {
    metaText.textContent = `Pixelate | Block ${Math.round(Math.max(6, rawSize * 2))}px`;
  } else if (activeTool === 'pen') {
    metaText.textContent = `Pen | Color ${color.toUpperCase()} | Stroke ${rawSize}px`;
  } else if (activeTool === 'highlight') {
    metaText.textContent = `Highlighter | Color ${color.toUpperCase()} | Stroke ${rawSize * 3}px | Opacity 32%`;
  } else if (activeTool === 'rect' || activeTool === 'arrow') {
    metaText.textContent = `${toolLabels[activeTool]} | Color ${color.toUpperCase()} | Stroke ${rawSize}px`;
  } else {
    metaText.textContent = `${toolLabels[activeTool] || 'Tool'} selected`;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
