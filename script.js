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

// Convert main canvas coords to offscreen coords
function toOff(x, y) {
  return { x: x / scaleX, y: y / scaleY };
}

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

// ── DRAGGABLE WEBCAM ──
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
function drawStroke(x, y) {
  if (lastX === null) { lastX = x; lastY = y; return; }

  // Convert to offscreen coords
  const ox1 = lastX / scaleX, oy1 = lastY / scaleY;
  const ox2 = x / scaleX,    oy2 = y / scaleY;

  // Draw on offscreen
  offCtx.beginPath();
  offCtx.moveTo(ox1, oy1);
  offCtx.lineTo(ox2, oy2);
  offCtx.strokeStyle = currentColor;
  offCtx.lineWidth = brushSize / Math.min(scaleX, scaleY);
  offCtx.lineCap = 'round';
  offCtx.lineJoin = 'round';
  offCtx.stroke();

  lastX = x; lastY = y;

  // Redraw main canvas from offscreen
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
const CONFIRM_FRAMES  = 5;      // frames needed to confirm a gesture switch
const COOLDOWN_MS     = 300;    // ms before another gesture switch is allowed
const MIN_VISIBILITY  = 0.6;    // minimum landmark visibility score
const MIN_HAND_CONF   = 0.75;   // minimum overall hand confidence

let gestureBuffer     = [];     // last N raw gestures
let confirmedGesture  = 'lift'; // currently active confirmed gesture
let lastSwitchTime    = 0;      // timestamp of last gesture switch

function getConfirmedGesture(rawGesture) {
  gestureBuffer.push(rawGesture);
  if (gestureBuffer.length > CONFIRM_FRAMES) gestureBuffer.shift();

  // All frames in buffer must agree
  const allSame = gestureBuffer.every(g => g === gestureBuffer[0]);
  if (!allSame) return confirmedGesture;

  const candidate = gestureBuffer[0];
  if (candidate === confirmedGesture) return confirmedGesture;

  // Check cooldown
  const now = Date.now();
  if (now - lastSwitchTime < COOLDOWN_MS) return confirmedGesture;

  // Switch confirmed
  confirmedGesture = candidate;
  lastSwitchTime = now;
  return confirmedGesture;
}

function landmarksVisible(raw) {
  // Check key landmarks — fingertips and base joints
  const keyPoints = [4, 8, 12, 16, 20, 0, 5, 9, 13, 17];
  return keyPoints.every(i => {
    const lm = raw[i];
    return lm && (lm.visibility === undefined || lm.visibility >= MIN_VISIBILITY);
  });
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
    lastX = null; lastY = null;
    gestureBuffer = [];
    confirmedGesture = 'lift';
    mode = 'lift';
    setStatus('lift');
    return;
  }

  const raw = results.multiHandLandmarks[0];

  // Filter weak detections
  if (!landmarksVisible(raw)) {
    lastX = null; lastY = null;
    return;
  }

  // Mirror landmarks for natural feel
  const lms = raw.map(lm => ({ x: 1 - lm.x, y: lm.y, z: lm.z }));

  const rawGesture = detectGesture(lms);
  const gesture    = getConfirmedGesture(rawGesture);

  mode = gesture;
  setStatus(gesture);

  const tipX = lms[8].x * canvas.width;
  const tipY = lms[8].y * canvas.height;

  // Cam overlay skeleton (un-mirrored, since video is CSS-mirrored)
  const camLms = raw.map(lm => ({ x: lm.x, y: lm.y, z: lm.z }));
  drawSkeleton(camLms, false, 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0.9)');

  // Canvas skeleton (mirrored, color-synced)
  drawSkeleton(lms, true, currentColor + 'aa', currentColor);

  if (gesture === 'draw') {
    drawStroke(tipX, tipY);
  } else if (gesture === 'erase') {
    const pinkyTipX = lms[20].x * canvas.width;
    const pinkyTipY = lms[20].y * canvas.height;
    eraseAt(pinkyTipX, pinkyTipY);
    lastX = null; lastY = null;
  } else {
    lastX = null; lastY = null;
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

