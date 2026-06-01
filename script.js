const COLORS = ['#e74c3c','#f39c12','#2ecc71','#3498db','#9b59b6','#ffffff'];

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const skelCanvas = document.getElementById('skeleton-canvas');
const skelCtx = skelCanvas.getContext('2d');

const camOverlay = document.getElementById('cam-overlay');
const oCtx = camOverlay.getContext('2d');

const video = document.getElementById('webcam');
const camWrap = document.getElementById('cam-wrap');

let currentColor = COLORS[0];
let brushSize = 8;
let eraserSize = 24;
let isDark = true;
let mouseMode = false;
let isMouseDrawing = false;

// ── BRUSH PREVIEW CANVAS ──
const brushPreview = document.getElementById('brush-preview');
const bpCtx = brushPreview.getContext('2d');
brushPreview.width = window.innerWidth;
brushPreview.height = window.innerHeight;

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
  canvas.height = window.innerHeight;
  skelCanvas.width = window.innerWidth;
  skelCanvas.height = window.innerHeight;
  brushPreview.width = window.innerWidth;
  brushPreview.height = window.innerHeight;
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

// ── BUTTONS ──
document.getElementById('btn-clear').addEventListener('click', () => {
  offCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

document.getElementById('btn-theme').addEventListener('click', () => {
  isDark = !isDark;
  canvas.className = isDark ? 'dark' : 'light';
  const vt = document.getElementById('version-tag');
  if (vt) vt.className = isDark ? '' : 'light';
});

document.getElementById('btn-save').addEventListener('click', () => {
  const tmp = document.createElement('canvas');
  tmp.width = CANVAS_W;
  tmp.height = CANVAS_H;
  const tc = tmp.getContext('2d');
  tc.fillStyle = isDark ? '#0d0d14' : '#f8f6f1';
  tc.fillRect(0, 0, CANVAS_W, CANVAS_H);
  tc.drawImage(offscreen, 0, 0);
  const a = document.createElement('a');
  a.download = 'air-canvas.png';
  a.href = tmp.toDataURL();
  a.click();
});

// ── MODE TOGGLE ──
const btnMode = document.getElementById('btn-mode');
const modeIcon = document.getElementById('mode-icon');
const modeLabel = document.getElementById('mode-label');
const gestureRows = document.getElementById('gesture-rows');
const skelCanvasEl = document.getElementById('skeleton-canvas');

function setMouseMode(val) {
  mouseMode = val;
  if (mouseMode) {
    btnMode.className = 'mode-btn mouse-mode';
    modeIcon.textContent = '🖱️';
    modeLabel.textContent = 'Mouse Mode';
    gestureRows.style.display = 'none';
    skelCanvasEl.style.display = 'none';
    brushPreview.style.display = 'block';
    canvas.style.cursor = 'none';
  } else {
    btnMode.className = 'mode-btn hand-mode';
    modeIcon.textContent = '✋';
    modeLabel.textContent = 'Hand Mode';
    gestureRows.style.display = 'block';
    skelCanvasEl.style.display = 'block';
    brushPreview.style.display = 'none';
    canvas.style.cursor = 'crosshair';
    clearBrushCursor();
  }
}

btnMode.addEventListener('click', () => setMouseMode(!mouseMode));

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
  if (e.buttons === 2) drawEraserCursor(e.clientX, e.clientY);
  else drawBrushCursor(e.clientX, e.clientY);
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
  if (isMouseErasing || e.buttons === 2) {
    drawEraserCursor(e.clientX, e.clientY);
    if (isMouseErasing) eraseAt(e.clientX, e.clientY);
  } else {
    drawBrushCursor(e.clientX, e.clientY);
    if (isMouseDrawing) drawStroke(e.clientX, e.clientY);
  }
});

canvas.addEventListener('mousedown', e => {
  if (!mouseMode) return;
  if (e.button === 2) {
    // Right click — erase
    isMouseErasing = true;
    isMouseDrawing = false;
    lastX = null; lastY = null;
    eraseAt(e.clientX, e.clientY);
  } else if (e.button === 0) {
    // Left click — draw
    isMouseDrawing = true;
    isMouseErasing = false;
    lastX = null; lastY = null;
    drawStroke(e.clientX, e.clientY);
  }
});

canvas.addEventListener('mouseup', e => {
  if (!mouseMode) return;
  if (e.button === 2) { isMouseErasing = false; }
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
function drawStroke(x, y, fromMouse = false) {
  if (lastX === null) { lastX = x; lastY = y; return; }

  // Mouse coords are screen coords — convert to offscreen
  // Hand coords are also screen coords — same conversion
  const ox1 = lastX / scaleX, oy1 = lastY / scaleY;
  const ox2 = x / scaleX,    oy2 = y / scaleY;

  offCtx.beginPath();
  offCtx.moveTo(ox1, oy1);
  offCtx.lineTo(ox2, oy2);
  offCtx.strokeStyle = currentColor;
  offCtx.lineWidth = brushSize / Math.min(scaleX, scaleY);
  offCtx.lineCap = 'round';
  offCtx.lineJoin = 'round';
  offCtx.stroke();

  lastX = x; lastY = y;
  redrawMain();
}

function eraseAt(x, y) {
  const bgColor = isDark ? '#0d0d14' : '#f8f6f1';

  // Convert to offscreen coords
  const ox = x / scaleX;
  const oy = y / scaleY;
  const offHalf = (eraserSize / Math.min(scaleX, scaleY)) / 2;

  offCtx.fillStyle = bgColor;
  offCtx.fillRect(ox - offHalf, oy - offHalf, offHalf * 2, offHalf * 2);

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
const BUFFER_SIZE   = 7;
const LERP_FACTOR   = 0.3;
const MIN_MOVE      = 3;
const MAX_SPEED     = 180;
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
    // Grace period — keep last position for a few frames before resetting
    if (graceCnt > GRACE_FRAMES) {
      lastX = null; lastY = null;
      gestureBuffer = [];
      confirmedGesture = 'lift';
      mode = 'lift';
      setStatus('lift');
      resetSmoothing();
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

  // Clear opposite buffer on gesture switch — keeps buffers clean
  if (gesture !== mode) {
    if (gesture === 'draw') {
      pinkyBuffer = []; pSmoothX = null; pSmoothY = null;
      lastPinkyRawX = null; lastPinkyRawY = null;
    } else if (gesture === 'erase') {
      posBuffer = []; smoothX = null; smoothY = null;
      lastRawX = null; lastRawY = null;
      lastX = null; lastY = null;
    } else if (gesture === 'lift') {
      // Reset draw position cleanly on confirmed lift
      lastX = null; lastY = null;
    }
  }

  mode = gesture;
  setStatus(gesture);

  // Get raw tip position
  const rawTipX = lms[8].x * canvas.width;
  const rawTipY = lms[8].y * canvas.height;

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
    // Minimum movement threshold
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
    eraseAt(smoothedPinky.x, smoothedPinky.y);
    lastX = null; lastY = null;
  } else {
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

startCamera();
