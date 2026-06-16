const COLORS = ['#e74c3c','#f39c12','#2ecc71','#3498db','#9b59b6','#ffffff'];

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const skelCanvas = document.getElementById('skeleton-canvas');
const skelCtx = skelCanvas.getContext('2d');

const camOverlay = document.getElementById('cam-overlay');
const oCtx = camOverlay.getContext('2d');

const video = document.getElementById('webcam');
const camWrap = document.getElementById('cam-wrap');
const webcamBg = document.getElementById('webcam-bg');

let currentColor = COLORS[0];
let brushSize = 8;
let eraserSize = 24;
let brushType = 'brush';

// ── UNDO / REDO ──
const MAX_HISTORY = 30;
let undoStack = [];
let redoStack = [];

function saveState() {
  const snapshot = offCtx.getImageData(0, 0, CANVAS_W, CANVAS_H);
  undoStack.push(snapshot);
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = []; // clear redo on new action
}

function undo() {
  if (undoStack.length === 0) return;
  const current = offCtx.getImageData(0, 0, CANVAS_W, CANVAS_H);
  redoStack.push(current);
  const prev = undoStack.pop();
  offCtx.putImageData(prev, 0, 0);
  redrawMain();
}

function redo() {
  if (redoStack.length === 0) return;
  const current = offCtx.getImageData(0, 0, CANVAS_W, CANVAS_H);
  undoStack.push(current);
  const next = redoStack.pop();
  offCtx.putImageData(next, 0, 0);
  redrawMain();
}

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
}); // 'brush', 'marker', 'pen'
let isDark = true;
let mouseMode = false;
let isMouseDrawing = false;

// Height of the fixed top toolbar — used to align canvas coordinates
const TOOLBAR_HEIGHT = 56;

// ── BRUSH PREVIEW CANVAS ──
const brushPreview = document.getElementById('brush-preview');
const bpCtx = brushPreview.getContext('2d');
brushPreview.width = window.innerWidth;
brushPreview.height = window.innerHeight - TOOLBAR_HEIGHT;

// ── ERASER INDICATOR CANVAS (hand mode) ──
const eraserIndicator = document.getElementById('eraser-indicator');
const eiCtx = eraserIndicator.getContext('2d');
eraserIndicator.width = window.innerWidth;
eraserIndicator.height = window.innerHeight - TOOLBAR_HEIGHT;

function drawEraserIndicator(x, y) {
  eiCtx.clearRect(0, 0, eraserIndicator.width, eraserIndicator.height);
  const r = eraserSize / 2;

  // Outer highlight ring
  eiCtx.beginPath();
  eiCtx.arc(x, y, r + 4, 0, Math.PI * 2);
  eiCtx.strokeStyle = 'rgba(255,255,255,0.5)';
  eiCtx.lineWidth = 1.5;
  eiCtx.stroke();

  // Main round eraser circle — exact match to erase area
  eiCtx.beginPath();
  eiCtx.arc(x, y, r, 0, Math.PI * 2);
  eiCtx.strokeStyle = 'rgba(255,80,80,0.9)';
  eiCtx.lineWidth = 2;
  eiCtx.stroke();

  // Semi-transparent fill
  eiCtx.beginPath();
  eiCtx.arc(x, y, r, 0, Math.PI * 2);
  eiCtx.fillStyle = 'rgba(255,80,80,0.08)';
  eiCtx.fill();

  // Center dot
  eiCtx.beginPath();
  eiCtx.arc(x, y, 2, 0, Math.PI * 2);
  eiCtx.fillStyle = 'rgba(255,255,255,0.8)';
  eiCtx.fill();
}

function clearEraserIndicator() {
  eiCtx.clearRect(0, 0, eraserIndicator.width, eraserIndicator.height);
}

function drawBrushCursor(x, y) {
  bpCtx.clearRect(0, 0, brushPreview.width, brushPreview.height);
  const r = brushSize / 2;

  // Highlight outline
  bpCtx.beginPath();
  bpCtx.arc(x, y, r + 3, 0, Math.PI * 2);
  bpCtx.strokeStyle = 'rgba(255,255,255,0.6)';
  bpCtx.lineWidth = 1.5;
  bpCtx.stroke();

  // Colored circle matching brush color
  bpCtx.beginPath();
  bpCtx.arc(x, y, r, 0, Math.PI * 2);
  bpCtx.strokeStyle = currentColor;
  bpCtx.lineWidth = 2;
  bpCtx.stroke();

  // Sharp center dot
  bpCtx.beginPath();
  bpCtx.arc(x, y, 1.5, 0, Math.PI * 2);
  bpCtx.fillStyle = '#ffffff';
  bpCtx.fill();
}

function clearBrushCursor() {
  bpCtx.clearRect(0, 0, brushPreview.width, brushPreview.height);
}
let lastX = null, lastY = null;
let mode = 'lift';
let modelReady = false;

// ── OFFSCREEN CANVAS (fixed resolution source of truth) ──
const CANVAS_W = 1920;
const CANVAS_H = 1080;

const offscreen = document.createElement('canvas');
offscreen.width = CANVAS_W;
offscreen.height = CANVAS_H;
const offCtx = offscreen.getContext('2d');

// Scale factors — how much to scale offscreen onto main canvas
let scaleX = 1;
let scaleY = 1;

// Redraw offscreen onto main canvas scaled
function redrawMain() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
}

// ── RESIZE ──
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - TOOLBAR_HEIGHT;
  skelCanvas.width = window.innerWidth;
  skelCanvas.height = window.innerHeight - TOOLBAR_HEIGHT;
  brushPreview.width = window.innerWidth;
  brushPreview.height = window.innerHeight - TOOLBAR_HEIGHT;
  eraserIndicator.width = window.innerWidth;
  eraserIndicator.height = window.innerHeight - TOOLBAR_HEIGHT;
  camOverlay.width = 200;
  camOverlay.height = 150;

  // Update scale factors
  scaleX = canvas.width / CANVAS_W;
  scaleY = canvas.height / CANVAS_H;

  // Redraw scaled from offscreen
  redrawMain();
}
resize();
window.addEventListener('resize', resize);

// ── COLOR PRESETS ──
const presetsEl = document.getElementById('color-presets');
let activeDot = null;

COLORS.forEach((c, i) => {
  const d = document.createElement('div');
  d.className = 'color-dot' + (i === 0 ? ' active' : '');
  d.style.background = c;
  d.title = c;
  d.addEventListener('click', () => {
    currentColor = c;
    setActiveDot(d);
  });
  presetsEl.appendChild(d);
  if (i === 0) activeDot = d;
});

document.getElementById('custom-color').addEventListener('input', e => {
  currentColor = e.target.value;
  document.getElementById('custom-dot').style.background = currentColor;
  setActiveDot(null);
});

document.getElementById('custom-dot').addEventListener('click', () => {
  document.getElementById('custom-color').click();
});

function setActiveDot(el) {
  document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
  if (el) { el.classList.add('active'); activeDot = el; }
}

// ── SLIDERS ──
const brushSlider = document.getElementById('brush-size');
const eraserSlider = document.getElementById('eraser-size');

brushSlider.addEventListener('input', e => {
  brushSize = +e.target.value;
  document.getElementById('brush-val').textContent = brushSize;
  // Show preview dot while sliding
  if (mouseMode) {
    const cx = brushPreview.width / 2;
    const cy = brushPreview.height / 2;
    drawBrushCursor(cx, cy);
  }
});
eraserSlider.addEventListener('input', e => {
  eraserSize = +e.target.value;
  document.getElementById('eraser-val').textContent = eraserSize;
});

// ── BRUSH TYPE SELECTOR ──
const brushTypeBtns = document.querySelectorAll('.brush-type-btn');

brushTypeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    brushTypeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (btn.id === 'btn-brush')  brushType = 'brush';
    if (btn.id === 'btn-marker') brushType = 'marker';
    if (btn.id === 'btn-pen')    brushType = 'pen';
  });
});

// ── BUTTONS ──
document.getElementById('btn-clear').addEventListener('click', () => {
  saveState();
  offCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-redo').addEventListener('click', redo);

document.getElementById('btn-theme').addEventListener('click', () => {
  isDark = !isDark;
  canvas.className = isDark ? 'dark' : 'light';
  const vt = document.getElementById('version-tag');
  if (vt) vt.className = isDark ? '' : 'light';
});

// ── SAVE DIALOG ──
const saveDialog = document.getElementById('save-dialog');
const saveFilename = document.getElementById('save-filename');
const saveCancelBtn = document.getElementById('save-cancel-btn');
const saveConfirmBtn = document.getElementById('save-confirm-btn');

function openSaveDialog() {
  saveFilename.value = 'air-canvas';
  saveDialog.classList.add('open');
  setTimeout(() => saveFilename.select(), 50);
}

function closeSaveDialog() {
  saveDialog.classList.remove('open');
}

saveCancelBtn.addEventListener('click', closeSaveDialog);

saveDialog.addEventListener('click', e => {
  if (e.target === saveDialog) closeSaveDialog();
});

saveFilename.addEventListener('keydown', e => {
  if (e.key === 'Enter') confirmSave();
  if (e.key === 'Escape') closeSaveDialog();
});

async function confirmSave() {
  const name = (saveFilename.value.trim() || 'air-canvas').replace(/\.png$/i, '');
  closeSaveDialog();

  const tmp = document.createElement('canvas');
  tmp.width = CANVAS_W;
  tmp.height = CANVAS_H;
  const tc = tmp.getContext('2d');

  const includeWebcam = webcamDrawMode && saveIncludeWebcam.checked;

  if (includeWebcam) {
    // Draw mirrored webcam frame as background
    tc.save();
    tc.translate(CANVAS_W, 0);
    tc.scale(-1, 1);
    tc.drawImage(webcamBg, 0, 0, CANVAS_W, CANVAS_H);
    tc.restore();
  } else {
    tc.fillStyle = isDark ? '#0d0d14' : '#f8f6f1';
    tc.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  tc.drawImage(offscreen, 0, 0);

  // Try native file picker first (Chrome/Edge)
  if (window.showSaveFilePicker) {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: `${name}.png`,
        types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }]
      });
      const writable = await fileHandle.createWritable();
      const blob = await new Promise(res => tmp.toBlob(res, 'image/png'));
      await writable.write(blob);
      await writable.close();
      return;
    } catch(e) {
      // User cancelled native picker — fall through to normal download
      if (e.name === 'AbortError') return;
    }
  }

  // Fallback — normal download with custom filename
  const a = document.createElement('a');
  a.download = `${name}.png`;
  a.href = tmp.toDataURL('image/png');
  a.click();
}

saveConfirmBtn.addEventListener('click', confirmSave);

document.getElementById('btn-save').addEventListener('click', openSaveDialog);

// ── MODE TOGGLE ──
const btnMode = document.getElementById('btn-mode');
const modeIcon = document.getElementById('mode-icon');
const modeLabel = document.getElementById('mode-label');
const skelCanvasEl = document.getElementById('skeleton-canvas');

function setMouseMode(val) {
  mouseMode = val;
  if (mouseMode) {
    btnMode.className = 'mode-btn mouse-mode';
    modeIcon.textContent = '🖱️';
    modeLabel.textContent = 'Mouse';
    skelCanvasEl.style.display = 'none';
    brushPreview.style.display = 'block';
    canvas.style.cursor = 'none';
  } else {
    btnMode.className = 'mode-btn hand-mode';
    modeIcon.textContent = '✋';
    modeLabel.textContent = 'Hand';
    skelCanvasEl.style.display = 'block';
    brushPreview.style.display = 'none';
    canvas.style.cursor = 'crosshair';
    clearBrushCursor();
  }
}

btnMode.addEventListener('click', () => setMouseMode(!mouseMode));

// ── ERASER TOGGLE (for trackpad users) ──
let eraserMode = false;
const btnEraser = document.getElementById('btn-eraser');

btnEraser.addEventListener('click', () => {
  eraserMode = !eraserMode;
  btnEraser.classList.toggle('active-tool', eraserMode);
});

// ── INFO BUTTON ──
const btnInfo = document.getElementById('btn-info');
const infoOverlay = document.getElementById('info-overlay');
const infoCloseBtn = document.getElementById('info-close-btn');

btnInfo.addEventListener('click', () => infoOverlay.classList.add('open'));
infoCloseBtn.addEventListener('click', () => infoOverlay.classList.remove('open'));
infoOverlay.addEventListener('click', e => {
  if (e.target === infoOverlay) infoOverlay.classList.remove('open');
});

// ── WEBCAM DRAW MODE ──
let webcamDrawMode = false;
const btnWebcamBg = document.getElementById('btn-webcam-bg');
const saveWebcamOption = document.getElementById('save-webcam-option');
const saveIncludeWebcam = document.getElementById('save-include-webcam');

btnWebcamBg.addEventListener('click', () => {
  webcamDrawMode = !webcamDrawMode;
  btnWebcamBg.classList.toggle('webcam-active', webcamDrawMode);
  canvas.classList.toggle('webcam-active', webcamDrawMode);
  webcamBg.style.display = webcamDrawMode ? 'block' : 'none';
  saveWebcamOption.style.display = webcamDrawMode ? 'flex' : 'none';
  if (!webcamDrawMode) saveIncludeWebcam.checked = false;
  updateOpacityVisibility();
  applyBgOpacity();
});

// ── BACKGROUND OPACITY ──
const bgOpacitySlider = document.getElementById('bg-opacity');
const opacityVal = document.getElementById('opacity-val');
const opacityGroup = document.getElementById('opacity-group');

function applyBgOpacity() {
  const val = +bgOpacitySlider.value / 100;
  webcamBg.style.opacity = val;
}

function updateOpacityVisibility() {
  // Opacity control only makes sense for the webcam background layer
  opacityGroup.style.display = webcamDrawMode ? 'flex' : 'none';
}

bgOpacitySlider.addEventListener('input', () => {
  opacityVal.textContent = bgOpacitySlider.value;
  applyBgOpacity();
});

let isMouseErasing = false;

function drawEraserCursor(x, y) {
  bpCtx.clearRect(0, 0, brushPreview.width, brushPreview.height);
  const half = eraserSize / 2;

  // Outer highlight
  bpCtx.strokeStyle = 'rgba(255,255,255,0.6)';
  bpCtx.lineWidth = 1.5;
  bpCtx.strokeRect(x - half - 3, y - half - 3, eraserSize + 6, eraserSize + 6);

  // Eraser rectangle
  bpCtx.strokeStyle = 'rgba(255,100,100,0.9)';
  bpCtx.lineWidth = 1.5;
  bpCtx.strokeRect(x - half, y - half, eraserSize, eraserSize);

  // Center crosshair dot
  bpCtx.beginPath();
  bpCtx.arc(x, y, 1.5, 0, Math.PI * 2);
  bpCtx.fillStyle = '#ffffff';
  bpCtx.fill();
}

// ── MOUSE DRAWING ──
canvas.addEventListener('mouseenter', e => {
  if (!mouseMode) return;
  const y = e.clientY - TOOLBAR_HEIGHT;
  if (e.buttons === 2) drawEraserCursor(e.clientX, y);
  else drawBrushCursor(e.clientX, y);
});

canvas.addEventListener('mouseleave', () => {
  if (!mouseMode) return;
  clearBrushCursor();
  isMouseDrawing = false;
  isMouseErasing = false;
  lastX = null; lastY = null;
});

canvas.addEventListener('mousemove', e => {
  if (!mouseMode) return;
  const x = e.clientX;
  const y = e.clientY - TOOLBAR_HEIGHT;
  if (isMouseErasing || e.buttons === 2 || (eraserMode && e.buttons === 1)) {
    drawEraserCursor(x, y);
    if (isMouseErasing) eraseAt(x, y);
  } else {
    drawBrushCursor(x, y);
    if (isMouseDrawing) drawStroke(x, y, true);
  }
});

canvas.addEventListener('mousedown', e => {
  if (!mouseMode) return;
  const x = e.clientX;
  const y = e.clientY - TOOLBAR_HEIGHT;
  if (e.button === 2 || (eraserMode && e.button === 0)) {
    isMouseErasing = true;
    isMouseDrawing = false;
    lastX = null; lastY = null;
    eraseAt(x, y);
  } else if (e.button === 0) {
    isMouseDrawing = true;
    isMouseErasing = false;
    lastX = null; lastY = null;
    drawStroke(x, y, true);
  }
});

canvas.addEventListener('mouseup', e => {
  if (!mouseMode) return;
  if (e.button === 2 || eraserMode) { isMouseErasing = false; }
  if (e.button === 0) { isMouseDrawing = false; lastX = null; lastY = null; }
});

// Prevent right click context menu on canvas
canvas.addEventListener('contextmenu', e => e.preventDefault());
let dragging = false, dragStartX, dragStartY, camStartL, camStartT;

camWrap.addEventListener('mousedown', e => {
  dragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  const r = camWrap.getBoundingClientRect();
  camStartL = r.left;
  camStartT = r.top;
  camWrap.style.right = 'auto';
  camWrap.style.bottom = 'auto';
  camWrap.style.left = camStartL + 'px';
  camWrap.style.top = camStartT + 'px';
  e.preventDefault();
});

document.addEventListener('mousemove', e => {
  if (!dragging) return;
  const newL = camStartL + e.clientX - dragStartX;
  const newT = camStartT + e.clientY - dragStartY;
  const maxL = window.innerWidth - camWrap.offsetWidth;
  const maxT = window.innerHeight - camWrap.offsetHeight;
  camWrap.style.left = Math.min(Math.max(0, newL), maxL) + 'px';
  camWrap.style.top  = Math.min(Math.max(0, newT), maxT) + 'px';
});

document.addEventListener('mouseup', () => dragging = false);

// ── STATUS UPDATE ──
function setStatus(m) {
  const dot = document.getElementById('s-dot');
  const txt = document.getElementById('s-text');
  dot.className = 'status-dot';
  if (m === 'draw')       { dot.classList.add('draw');  txt.textContent = 'Drawing'; }
  else if (m === 'erase') { dot.classList.add('erase'); txt.textContent = 'Erasing'; }
  else if (m === 'lift')  { dot.classList.add('lift');  txt.textContent = 'Pen lifted'; }
  else { txt.textContent = m; }
}

// ── DRAWING ──
function applyBrushStyle(ctx, size) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (brushType === 'brush') {
    // Soft edges, slightly transparent
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = size;
    ctx.shadowBlur = size * 0.6;
    ctx.shadowColor = currentColor;
  } else if (brushType === 'marker') {
    // Hard edges, fully opaque, flat
    ctx.globalAlpha = 1.0;
    ctx.lineWidth = size;
    ctx.shadowBlur = 0;
    ctx.lineCap = 'square';
  } else if (brushType === 'pen') {
    // Thin, precise, hard edges
    ctx.globalAlpha = 1.0;
    ctx.lineWidth = Math.max(1, size * 0.4);
    ctx.shadowBlur = 0;
  }
}

function resetBrushStyle(ctx) {
  ctx.globalAlpha = 1.0;
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

function drawStroke(x, y, fromMouse = false) {
  if (lastX === null) {
    saveState();
    // Draw a dot on tap/first touch
    const ox = x / scaleX;
    const oy = y / scaleY;
    const offSize = brushSize / Math.min(scaleX, scaleY);
    offCtx.beginPath();
    offCtx.arc(ox, oy, offSize / 2, 0, Math.PI * 2);
    applyBrushStyle(offCtx, offSize);
    offCtx.fillStyle = currentColor;
    offCtx.fill();
    resetBrushStyle(offCtx);
    lastX = x; lastY = y;
    redrawMain();
    return;
  }

  // Mouse gap fix — interpolate between points for fast movement
  if (fromMouse) {
    const dist = Math.hypot(x - lastX, y - lastY);
    if (dist > 4) {
      const steps = Math.ceil(dist / 4);
      for (let i = 1; i <= steps; i++) {
        const ix = lastX + (x - lastX) * (i / steps);
        const iy = lastY + (y - lastY) * (i / steps);
        const ox = ix / scaleX, oy = iy / scaleY;
        const offSize = brushSize / Math.min(scaleX, scaleY);
        offCtx.beginPath();
        offCtx.moveTo(ox, oy);
        offCtx.lineTo(ox, oy);
        offCtx.strokeStyle = currentColor;
        applyBrushStyle(offCtx, offSize);
        offCtx.stroke();
        resetBrushStyle(offCtx);
      }
      lastX = x; lastY = y;
      redrawMain();
      return;
    }
  }

  const ox1 = lastX / scaleX, oy1 = lastY / scaleY;
  const ox2 = x / scaleX,    oy2 = y / scaleY;
  const offSize = brushSize / Math.min(scaleX, scaleY);

  offCtx.beginPath();
  offCtx.moveTo(ox1, oy1);
  offCtx.lineTo(ox2, oy2);
  offCtx.strokeStyle = currentColor;
  applyBrushStyle(offCtx, offSize);
  offCtx.stroke();
  resetBrushStyle(offCtx);

  lastX = x; lastY = y;
  redrawMain();
}

function eraseAt(x, y) {
  saveState();
  const bgColor = isDark ? '#0d0d14' : '#f8f6f1';

  // Convert screen coords to offscreen
  const ox = x / scaleX;
  const oy = y / scaleY;
  // Convert screen-space eraser radius to offscreen radius
  const offR = (eraserSize / 2) / Math.min(scaleX, scaleY);

  offCtx.save();
  offCtx.beginPath();
  offCtx.arc(ox, oy, offR, 0, Math.PI * 2);
  offCtx.clip();
  offCtx.fillStyle = bgColor;
  offCtx.fillRect(ox - offR, oy - offR, offR * 2, offR * 2);
  offCtx.restore();

  redrawMain();
}

// ── HAND SKELETON ──
const CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17]
];

function drawSkeleton(landmarks, onCanvas, strokeCol, dotCol) {
  const tgt = onCanvas ? skelCtx : oCtx;
  const scaleX = onCanvas ? skelCanvas.width : 200;
  const scaleY = onCanvas ? skelCanvas.height : 150;

  tgt.save();
  tgt.globalAlpha = onCanvas ? 0.55 : 0.85;

  // connections
  tgt.strokeStyle = strokeCol;
  tgt.lineWidth = onCanvas ? 2 : 1.5;
  CONNECTIONS.forEach(([a, b]) => {
    const la = landmarks[a], lb = landmarks[b];
    tgt.beginPath();
    tgt.moveTo(la.x * scaleX, la.y * scaleY);
    tgt.lineTo(lb.x * scaleX, lb.y * scaleY);
    tgt.stroke();
  });

  // dots
  landmarks.forEach((lm, i) => {
    const x = lm.x * scaleX;
    const y = lm.y * scaleY;
    const r = (i === 8 || i === 20) ? (onCanvas ? 8 : 5) : (onCanvas ? 4 : 3);
    tgt.beginPath();
    tgt.arc(x, y, r, 0, Math.PI * 2);
    tgt.fillStyle = (i === 8 || i === 20) ? dotCol : strokeCol;
    tgt.fill();
  });

  tgt.restore();
}

// ── GESTURE DETECTION ──
function fingerUp(lms, tip, mcp) {
  return lms[tip].y < lms[mcp].y;
}

function detectGesture(lms) {
  const index  = fingerUp(lms, 8, 6);
  const middle = fingerUp(lms, 12, 10);
  const ring   = fingerUp(lms, 16, 14);
  const pinky  = fingerUp(lms, 20, 18);

  if (index && !middle && !ring && !pinky) return 'draw';
  if (!index && !middle && !ring && pinky) return 'erase';
  if (index && middle && ring && pinky)    return 'lift';
  return 'lift';
}

// ── STABILIZATION ──
const CONFIRM_FRAMES  = 5;
const LIFT_FRAMES     = 2;    // lift confirms faster than draw/erase
const COOLDOWN_MS     = 300;
const MIN_VISIBILITY  = 0.6;
const MIN_HAND_CONF   = 0.75;

let gestureBuffer     = [];
let confirmedGesture  = 'lift';
let lastSwitchTime    = 0;

function getConfirmedGesture(rawGesture) {
  gestureBuffer.push(rawGesture);

  // Use shorter window for lift, longer for draw/erase
  const window = rawGesture === 'lift' ? LIFT_FRAMES : CONFIRM_FRAMES;
  if (gestureBuffer.length > window) gestureBuffer.shift();

  const allSame = gestureBuffer.every(g => g === gestureBuffer[0]);
  if (!allSame) return confirmedGesture;

  const candidate = gestureBuffer[0];
  if (candidate === confirmedGesture) return confirmedGesture;

  const now = Date.now();
  if (now - lastSwitchTime < COOLDOWN_MS) return confirmedGesture;

  confirmedGesture = candidate;
  lastSwitchTime = now;
  return confirmedGesture;
}

function landmarksVisible(raw) {
  const keyPoints = [4, 8, 12, 16, 20, 0, 5, 9, 13, 17];
  return keyPoints.every(i => {
    const lm = raw[i];
    return lm && (lm.visibility === undefined || lm.visibility >= MIN_VISIBILITY);
  });
}

// ── ADVANCED SMOOTHING ──
const BUFFER_SIZE   = 4;      // reduced from 7 — less lag
const LERP_FACTOR   = 0.5;    // increased from 0.3 — more responsive
const MIN_MOVE      = 2;      // reduced from 3 — more precise
const MAX_SPEED     = 200;    // increased from 180 — less aggressive filtering
const GRACE_FRAMES  = 3;

let posBuffer  = [];
let smoothX    = null;
let smoothY    = null;
let graceCnt   = 0;
let lastRawX   = null;
let lastRawY   = null;

// Separate buffer for pinky/eraser
let pinkyBuffer  = [];
let pSmoothX     = null;
let pSmoothY     = null;
let lastPinkyRawX = null;
let lastPinkyRawY = null;

function addToBuffer(x, y) {
  posBuffer.push({ x, y });
  if (posBuffer.length > BUFFER_SIZE) posBuffer.shift();
}

function getWeightedAverage(buf) {
  const len = buf.length;
  if (len === 0) return null;
  let wx = 0, wy = 0, wSum = 0;
  buf.forEach((p, i) => {
    const w = i + 1;
    wx += p.x * w;
    wy += p.y * w;
    wSum += w;
  });
  return { x: wx / wSum, y: wy / wSum };
}

function getSmoothed(rawX, rawY) {
  if (lastRawX !== null) {
    const speed = Math.hypot(rawX - lastRawX, rawY - lastRawY);
    if (speed > MAX_SPEED) return smoothX !== null ? { x: smoothX, y: smoothY } : null;
  }
  lastRawX = rawX;
  lastRawY = rawY;

  posBuffer.push({ x: rawX, y: rawY });
  if (posBuffer.length > BUFFER_SIZE) posBuffer.shift();

  const avg = getWeightedAverage(posBuffer);
  if (!avg) return null;

  if (smoothX === null) { smoothX = avg.x; smoothY = avg.y; }
  else {
    smoothX += (avg.x - smoothX) * LERP_FACTOR;
    smoothY += (avg.y - smoothY) * LERP_FACTOR;
  }
  return { x: smoothX, y: smoothY };
}

function getPinkySmoothed(rawX, rawY) {
  if (lastPinkyRawX !== null) {
    const speed = Math.hypot(rawX - lastPinkyRawX, rawY - lastPinkyRawY);
    if (speed > MAX_SPEED) return pSmoothX !== null ? { x: pSmoothX, y: pSmoothY } : null;
  }
  lastPinkyRawX = rawX;
  lastPinkyRawY = rawY;

  pinkyBuffer.push({ x: rawX, y: rawY });
  if (pinkyBuffer.length > BUFFER_SIZE) pinkyBuffer.shift();

  const avg = getWeightedAverage(pinkyBuffer);
  if (!avg) return null;

  if (pSmoothX === null) { pSmoothX = avg.x; pSmoothY = avg.y; }
  else {
    pSmoothX += (avg.x - pSmoothX) * LERP_FACTOR;
    pSmoothY += (avg.y - pSmoothY) * LERP_FACTOR;
  }
  return { x: pSmoothX, y: pSmoothY };
}

function resetSmoothing() {
  posBuffer    = [];
  smoothX      = null;
  smoothY      = null;
  lastRawX     = null;
  lastRawY     = null;
  pinkyBuffer  = [];
  pSmoothX     = null;
  pSmoothY     = null;
  lastPinkyRawX = null;
  lastPinkyRawY = null;
  graceCnt     = 0;
}

// ── MEDIAPIPE ──
const hands = new Hands({
  locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: MIN_HAND_CONF,
  minTrackingConfidence: 0.6
});

hands.onResults(results => {
  oCtx.clearRect(0, 0, 200, 150);
  skelCtx.clearRect(0, 0, skelCanvas.width, skelCanvas.height);

  // Hide loading overlay on first real MediaPipe frame
  if (!modelReady) {
    modelReady = true;
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 600);
      setStatus('lift');
    }
  }

  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    graceCnt++;
    if (graceCnt > GRACE_FRAMES) {
      lastX = null; lastY = null;
      gestureBuffer = [];
      confirmedGesture = 'lift';
      mode = 'lift';
      setStatus('lift');
      resetSmoothing();
      clearEraserIndicator();
    }
    return;
  }

  graceCnt = 0;
  const raw = results.multiHandLandmarks[0];

  // Filter weak detections
  if (!landmarksVisible(raw)) {
    lastX = null; lastY = null;
    return;
  }

  // In mouse mode, skip all hand drawing
  if (mouseMode) return;

  // Mirror landmarks for natural feel
  const lms = raw.map(lm => ({ x: 1 - lm.x, y: lm.y, z: lm.z }));

  const rawGesture = detectGesture(lms);
  const gesture    = getConfirmedGesture(rawGesture);

  // Clear opposite buffer on gesture switch — only clear if gesture is stable
  if (gesture !== mode) {
    if (gesture === 'erase') {
      // Switching to erase — only clear lastX/lastY not the whole buffer
      lastX = null; lastY = null;
    } else if (gesture === 'draw') {
      // Switching to draw — only clear pinky tip vars
      pSmoothX = null; pSmoothY = null;
      lastPinkyRawX = null; lastPinkyRawY = null;
    } else if (gesture === 'lift') {
      lastX = null; lastY = null;
    }
  }

  mode = gesture;
  setStatus(gesture);

  // Get raw tip position with corner padding
  // Map landmarks from [PADDING, 1-PADDING] range to full canvas
  const PADDING = 0.05; // 5% padding on each edge
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const mappedX = (clamp(lms[8].x, PADDING, 1 - PADDING) - PADDING) / (1 - 2 * PADDING);
  const mappedY = (clamp(lms[8].y, PADDING, 1 - PADDING) - PADDING) / (1 - 2 * PADDING);
  const rawTipX = mappedX * canvas.width;
  const rawTipY = mappedY * canvas.height;

  // Apply smoothing
  const smoothed = getSmoothed(rawTipX, rawTipY);
  if (!smoothed) return;

  const tipX = smoothed.x;
  const tipY = smoothed.y;

  // Cam overlay skeleton
  const camLms = raw.map(lm => ({ x: lm.x, y: lm.y, z: lm.z }));
  drawSkeleton(camLms, false, 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0.9)');

  // Canvas skeleton
  drawSkeleton(lms, true, currentColor + 'aa', currentColor);

  if (gesture === 'draw') {
    clearEraserIndicator();
    if (lastX !== null) {
      const dist = Math.hypot(tipX - lastX, tipY - lastY);
      if (dist < MIN_MOVE) return;
    }
    drawStroke(tipX, tipY);
  } else if (gesture === 'erase') {
    const rawPinkyX = lms[20].x * canvas.width;
    const rawPinkyY = lms[20].y * canvas.height;
    const smoothedPinky = getPinkySmoothed(rawPinkyX, rawPinkyY);
    if (!smoothedPinky) return;
    drawEraserIndicator(smoothedPinky.x, smoothedPinky.y);
    eraseAt(smoothedPinky.x, smoothedPinky.y);
    lastX = null; lastY = null;
  } else {
    clearEraserIndicator();
    lastX = null; lastY = null;
    resetSmoothing();
  }
});

// ── CAMERA SETUP ──
async function startCamera() {
  const msgEl = document.getElementById('loading-msg');
  msgEl.textContent = 'Starting camera...';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    video.srcObject = stream;
    webcamBg.srcObject = stream;
    await new Promise(r => video.onloadedmetadata = r);

    msgEl.innerHTML = 'Downloading hand model...<br><span style="font-size:11px;opacity:0.5;">First time only — this will not happen again</span>';

    // Slow network warning after 15 seconds
    const slowTimer = setTimeout(() => {
      if (!modelReady) {
        msgEl.innerHTML = 'Taking longer than usual...<br><span style="font-size:11px;opacity:0.5;">Please check your connection</span>';
      }
    }, 15000);

    const camera = new Camera(video, {
      onFrame: async () => { await hands.send({ image: video }); },
      width: 640, height: 480
    });
    camera.start();

  } catch(e) {
    document.getElementById('loading-msg').textContent = 'Camera access denied. Please allow camera.';
  }
}

// ── GESTURE TUTORIAL SLIDER ──
let currentSlide = 0;
const totalSlides = 3;
const slides = document.querySelectorAll('.tutorial-slide');
const dots = document.querySelectorAll('.tutorial-dot');
const prevBtn = document.getElementById('tutorial-prev');
const nextBtn = document.getElementById('tutorial-next');
const startBtn = document.getElementById('tutorial-start-btn');
const tutorial = document.getElementById('gesture-tutorial');

function goToSlide(n) {
  slides[currentSlide].classList.remove('active');
  dots[currentSlide].classList.remove('active');
  currentSlide = n;
  slides[currentSlide].classList.add('active');
  dots[currentSlide].classList.add('active');
  prevBtn.disabled = currentSlide === 0;
  nextBtn.style.display = currentSlide === totalSlides - 1 ? 'none' : 'flex';
  startBtn.style.display = currentSlide === totalSlides - 1 ? 'block' : 'none';
}

prevBtn.addEventListener('click', () => { if (currentSlide > 0) goToSlide(currentSlide - 1); });
nextBtn.addEventListener('click', () => { if (currentSlide < totalSlides - 1) goToSlide(currentSlide + 1); });
dots.forEach((dot, i) => dot.addEventListener('click', () => goToSlide(i)));

startBtn.addEventListener('click', () => {
  tutorial.style.opacity = '0';
  tutorial.style.transition = 'opacity 0.5s';
  setTimeout(() => {
    tutorial.remove();
    startCamera();
  }, 500);
});

// ── CARTOON HAND ANIMATIONS ──
// Shared hand drawing function
function drawHand(ctx, cx, cy, scale, fingers) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Palm
  ctx.beginPath();
  ctx.ellipse(0, 20, 28, 32, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#f5c89a';
  ctx.fill();
  ctx.strokeStyle = '#e0a870';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Finger positions [x, y, height, up]
  const fingerDefs = [
    { x: -20, baseY: -8,  h: 38, up: fingers[0] }, // index
    { x: -7,  baseY: -14, h: 42, up: fingers[1] }, // middle
    { x: 7,   baseY: -12, h: 40, up: fingers[2] }, // ring
    { x: 20,  baseY: -6,  h: 34, up: fingers[3] }, // pinky
  ];

  fingerDefs.forEach(f => {
    const tipY = f.up ? f.baseY - f.h : f.baseY - 10;
    ctx.beginPath();
    ctx.roundRect(f.x - 7, tipY, 14, f.h - (f.up ? 0 : f.h - 18), 7);
    ctx.fillStyle = '#f5c89a';
    ctx.fill();
    ctx.strokeStyle = '#e0a870';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Fingertip circle for up fingers
    if (f.up) {
      ctx.beginPath();
      ctx.arc(f.x, tipY + 6, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#e0a870';
      ctx.fill();
    }
  });

  // Thumb
  ctx.beginPath();
  ctx.ellipse(-36, 10, 10, 16, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = '#f5c89a';
  ctx.fill();
  ctx.strokeStyle = '#e0a870';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

// Animation 1 — Index finger drawing
const c1 = document.getElementById('anim-canvas-1');
const cx1 = c1.getContext('2d');
let t1 = 0;
let trail1 = [];

function animSlide1() {
  cx1.clearRect(0, 0, 260, 260);
  t1 += 0.025;

  // Draw trail
  const px = 80 + Math.sin(t1) * 60;
  const py = 90 + Math.sin(t1 * 1.5) * 30;
  trail1.push({ x: px, y: py });
  if (trail1.length > 60) trail1.shift();

  if (trail1.length > 1) {
    cx1.beginPath();
    cx1.moveTo(trail1[0].x, trail1[0].y);
    trail1.forEach(p => cx1.lineTo(p.x, p.y));
    cx1.strokeStyle = '#a78bfa';
    cx1.lineWidth = 3;
    cx1.lineCap = 'round';
    cx1.lineJoin = 'round';
    cx1.stroke();
  }

  // Fingertip dot
  cx1.beginPath();
  cx1.arc(px, py, 6, 0, Math.PI * 2);
  cx1.fillStyle = '#a78bfa';
  cx1.fill();

  // Hand — index up only
  drawHand(cx1, 130, 185, 0.85, [true, false, false, false]);
  requestAnimationFrame(animSlide1);
}
animSlide1();

// Animation 2 — Open palm lift
const c2 = document.getElementById('anim-canvas-2');
const cx2 = c2.getContext('2d');
let t2 = 0;

function animSlide2() {
  cx2.clearRect(0, 0, 260, 260);
  t2 += 0.02;

  // Floating upward animation
  const floatY = Math.sin(t2) * 12;

  // Pause indicator lines
  cx2.globalAlpha = 0.3 + Math.abs(Math.sin(t2)) * 0.4;
  cx2.strokeStyle = '#22c55e';
  cx2.lineWidth = 2;
  cx2.setLineDash([6, 4]);
  [-30, 0, 30].forEach(x => {
    cx2.beginPath();
    cx2.moveTo(130 + x, 60 + floatY);
    cx2.lineTo(130 + x, 80 + floatY);
    cx2.stroke();
  });
  cx2.setLineDash([]);
  cx2.globalAlpha = 1;

  // Hand — all fingers up
  drawHand(cx2, 130, 175 + floatY, 0.85, [true, true, true, true]);
  requestAnimationFrame(animSlide2);
}
animSlide2();

// Animation 3 — Pinky erasing
const c3 = document.getElementById('anim-canvas-3');
const cx3 = c3.getContext('2d');
let t3 = 0;

function animSlide3() {
  cx3.clearRect(0, 0, 260, 260);
  t3 += 0.03;

  const px = 80 + Math.sin(t3) * 60;
  const py = 100;

  // Fake drawing to erase
  cx3.globalAlpha = 0.3;
  cx3.fillStyle = '#a78bfa';
  cx3.beginPath();
  cx3.arc(120, 95, 25, 0, Math.PI * 2);
  cx3.fill();
  cx3.globalAlpha = 1;

  // Eraser area
  cx3.save();
  cx3.beginPath();
  cx3.arc(px, py, 18, 0, Math.PI * 2);
  cx3.clip();
  cx3.clearRect(px - 20, py - 20, 40, 40);
  cx3.restore();

  // Eraser outline
  cx3.beginPath();
  cx3.arc(px, py, 18, 0, Math.PI * 2);
  cx3.strokeStyle = 'rgba(255,80,80,0.8)';
  cx3.lineWidth = 2;
  cx3.stroke();

  // Hand — pinky up only
  drawHand(cx3, 130, 185, 0.85, [false, false, false, true]);
  requestAnimationFrame(animSlide3);
}
animSlide3();
