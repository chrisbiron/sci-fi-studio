import { SHAPES, SHAPE_VIEWBOX, SHAPE_PATH_STRINGS } from './shapes.js';

// --- DOM refs ---
const canvas = document.getElementById('output-canvas');
const ctx = canvas.getContext('2d');
const placeholder = document.getElementById('placeholder');
const fileInput = document.getElementById('file-input');
const uploadArea = document.getElementById('upload-area');
const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('toggle-sidebar');
const showBtn = document.getElementById('show-sidebar');
const sourceVideo = document.getElementById('source-video');
const previewArea = document.getElementById('preview-area');
const previewImage = document.getElementById('preview-image');
const previewVideo = document.getElementById('preview-video');
const previewName = document.getElementById('preview-name');
const previewSwap = document.getElementById('preview-swap');

// Frame controls
const ratioButtons = document.querySelectorAll('.ratio-btn');
const imageScaleSlider = document.getElementById('image-scale');
const imageScaleValue = document.getElementById('image-scale-value');
const fitToCanvasBtn = document.getElementById('fit-to-canvas');

// Controls
const controls = {
  scale: document.getElementById('scale'),
  gamma: document.getElementById('gamma'),
  contrast: document.getElementById('contrast'),
  brightness: document.getElementById('brightness'),
  threshold1: document.getElementById('threshold1'),
  threshold2: document.getElementById('threshold2'),
  threshold3: document.getElementById('threshold3'),
  invert: document.getElementById('invert'),
  bgColor: document.getElementById('bg-color'),
  shapeColor: document.getElementById('shape-color'),
};

// Animate controls
const animateSection = document.getElementById('animate-section');
const animateToggle = document.getElementById('animate');
const animateStrengthSlider = document.getElementById('animate-strength');
const animateStrengthValue = document.getElementById('animate-strength-value');
const animateSpeedSlider = document.getElementById('animate-speed');
const animateSpeedValue = document.getElementById('animate-speed-value');

// Export buttons
const exportSvg = document.getElementById('export-svg');
const exportPng = document.getElementById('export-png');
const exportJpg = document.getElementById('export-jpg');
const exportMp4 = document.getElementById('export-mp4');

// --- State ---
let sourceImage = null;
let isVideo = false;
let animFrameId = null;
let offscreen = document.createElement('canvas');
let offCtx = offscreen.getContext('2d');
let currentRatio = 'original'; // 'original', '1:1', '16:9', '9:16'
let imageScale = 100; // percentage
let panX = 0; // pixel offset in source image space
let panY = 0;
let isDragging = false;
let animateEnabled = false;
let animateFrameId = null;
let animTime = 0;
let dragStartX = 0;
let dragStartY = 0;
let panStartX = 0;
let panStartY = 0;

// --- Canvas pan/drag ---
canvas.style.cursor = 'grab';

canvas.addEventListener('mousedown', (e) => {
  if (!sourceImage && !isVideo) return;
  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  panStartX = panX;
  panStartY = panY;
  canvas.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;

  // Convert screen delta to source-image-space delta
  const srcW = isVideo ? sourceVideo.videoWidth : sourceImage.naturalWidth;
  const srcH = isVideo ? sourceVideo.videoHeight : sourceImage.naturalHeight;
  const { canvasW, canvasH } = getCanvasDimensions(srcW, srcH);
  const settings = getSettings();
  const cellSize = settings.scale;
  const cols = Math.ceil(canvasW / cellSize);
  const rows = Math.ceil(canvasH / cellSize);
  const outW = cols * cellSize;
  const outH = rows * cellSize;

  // Get displayed size of canvas on screen
  const rect = canvas.getBoundingClientRect();
  const displayScale = rect.width / outW;

  panX = panStartX + dx / displayScale;
  panY = panStartY + dy / displayScale;
  if (!isVideo) scheduleRender();
});

window.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    canvas.style.cursor = 'grab';
  }
});

// --- Sidebar toggle ---
toggleBtn.addEventListener('click', () => {
  sidebar.classList.add('collapsed');
  showBtn.classList.remove('hidden');
});

showBtn.addEventListener('click', () => {
  sidebar.classList.remove('collapsed');
  showBtn.classList.add('hidden');
});

// --- Frame controls ---
ratioButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    ratioButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentRatio = btn.dataset.ratio;
    scheduleRender();
  });
});

imageScaleSlider.addEventListener('input', () => {
  imageScale = parseInt(imageScaleSlider.value);
  imageScaleValue.textContent = imageScale + '%';
  scheduleRender();
});

fitToCanvasBtn.addEventListener('click', () => {
  if (!sourceImage && !isVideo) return;
  const srcW = isVideo ? sourceVideo.videoWidth : sourceImage.naturalWidth;
  const srcH = isVideo ? sourceVideo.videoHeight : sourceImage.naturalHeight;
  const { canvasW, canvasH } = getCanvasDimensions(srcW, srcH);
  // Calculate scale needed to cover the canvas
  const scaleX = canvasW / srcW;
  const scaleY = canvasH / srcH;
  const coverScale = Math.max(scaleX, scaleY);
  const fitPercent = Math.round(coverScale * 100);
  imageScale = fitPercent;
  imageScaleSlider.value = fitPercent;
  imageScaleValue.textContent = fitPercent + '%';
  panX = 0;
  panY = 0;
  scheduleRender();
});

function getCanvasDimensions(srcW, srcH) {
  if (currentRatio === 'original') {
    return { canvasW: srcW, canvasH: srcH };
  }
  const ratios = { '1:1': 1, '16:9': 16 / 9, '9:16': 9 / 16 };
  const targetRatio = ratios[currentRatio];
  const srcRatio = srcW / srcH;
  let canvasW, canvasH;
  if (targetRatio > srcRatio) {
    canvasW = srcW;
    canvasH = Math.round(srcW / targetRatio);
  } else {
    canvasH = srcH;
    canvasW = Math.round(srcH * targetRatio);
  }
  return { canvasW, canvasH };
}

// --- File upload ---
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});

// --- Drag and drop on main canvas area ---
const canvasArea = document.getElementById('canvas-area');

canvasArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  canvasArea.classList.add('dragover');
});

canvasArea.addEventListener('dragleave', () => {
  canvasArea.classList.remove('dragover');
});

canvasArea.addEventListener('drop', (e) => {
  e.preventDefault();
  canvasArea.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

function handleFile(file) {
  cleanup();
  panX = 0;
  panY = 0;
  const url = URL.createObjectURL(file);

  // Show preview in sidebar
  showPreview(file, url);

  if (file.type.startsWith('video/')) {
    isVideo = true;
    sourceImage = null;
    // Disable animate for video
    animateSection.classList.add('hidden');
    animateToggle.checked = false;
    animateEnabled = false;
    stopAnimateLoop();
    sourceVideo.src = url;
    sourceVideo.loop = true;
    sourceVideo.play();
    sourceVideo.addEventListener('loadeddata', () => {
      placeholder.classList.add('hidden');
      enableExports(true);
      startVideoLoop();
    }, { once: true });
  } else {
    isVideo = false;
    // Show animate section for images
    animateSection.classList.remove('hidden');
    const img = new Image();
    img.onload = () => {
      sourceImage = img;
      placeholder.classList.add('hidden');
      enableExports(false);
      if (animateEnabled) {
        startAnimateLoop();
      } else {
        renderDither();
      }
    };
    img.src = url;
  }
}

function showPreview(file, url) {
  uploadArea.classList.add('hidden');
  previewArea.classList.remove('hidden');

  previewName.textContent = file.name;

  if (file.type.startsWith('video/')) {
    previewImage.classList.add('hidden');
    previewVideo.classList.remove('hidden');
    previewVideo.src = url;
    previewVideo.play();
  } else {
    previewVideo.classList.add('hidden');
    previewVideo.src = '';
    previewImage.classList.remove('hidden');
    previewImage.src = url;
  }
}

function clearPreview() {
  previewArea.classList.add('hidden');
  uploadArea.classList.remove('hidden');
  previewImage.classList.add('hidden');
  previewImage.src = '';
  previewVideo.classList.add('hidden');
  previewVideo.src = '';
  previewName.textContent = '';
}

// Remove file and reset
previewSwap.addEventListener('click', (e) => {
  e.stopPropagation();
  cleanup();
  clearPreview();
  sourceImage = null;
  isVideo = false;
  fileInput.value = '';
  canvas.width = 0;
  canvas.height = 0;
  placeholder.classList.remove('hidden');
  exportSvg.disabled = true;
  exportPng.disabled = true;
  exportJpg.disabled = true;
  exportMp4.disabled = true;
});

// Click preview area to swap file
previewArea.addEventListener('click', () => {
  fileInput.click();
});

// Drag and drop onto preview area to replace
previewArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
  previewArea.style.borderColor = 'var(--text-dim)';
});

previewArea.addEventListener('dragleave', () => {
  previewArea.style.borderColor = '';
});

previewArea.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  previewArea.style.borderColor = '';
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

function cleanup() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  stopAnimateLoop();
  sourceVideo.pause();
  sourceVideo.src = '';
}

function enableExports(video) {
  exportSvg.disabled = video;
  exportPng.disabled = video;
  exportJpg.disabled = video;
  exportSvg.style.display = video ? 'none' : '';
  exportPng.style.display = video ? 'none' : '';
  exportJpg.style.display = video ? 'none' : '';
  exportMp4.disabled = false;
  exportMp4.style.display = video ? '' : 'none';
}

// --- Controls ---
function getSettings() {
  return {
    scale: parseInt(controls.scale.value),
    gamma: parseFloat(controls.gamma.value),
    contrast: parseFloat(controls.contrast.value),
    brightness: parseInt(controls.brightness.value),
    threshold1: parseFloat(controls.threshold1.value),
    threshold2: parseFloat(controls.threshold2.value),
    threshold3: parseFloat(controls.threshold3.value),
    invert: controls.invert.checked,
    bgColor: controls.bgColor.value,
    shapeColor: controls.shapeColor.value,
  };
}

// Bind slider display values
Object.keys(controls).forEach((key) => {
  const el = controls[key];
  const display = document.getElementById(`${key.replace(/([A-Z])/g, '-$1').toLowerCase()}-value`);
  if (!display) return;
  el.addEventListener('input', () => {
    display.textContent = el.value;
    scheduleRender();
  });
});

// Color hex displays
controls.bgColor.addEventListener('input', () => {
  document.getElementById('bg-color-hex').textContent = controls.bgColor.value.toUpperCase();
  scheduleRender();
});
controls.shapeColor.addEventListener('input', () => {
  document.getElementById('shape-color-hex').textContent = controls.shapeColor.value.toUpperCase();
  scheduleRender();
});

controls.invert.addEventListener('change', scheduleRender);

// Animate controls
animateStrengthSlider.addEventListener('input', () => {
  animateStrengthValue.textContent = animateStrengthSlider.value;
});

animateSpeedSlider.addEventListener('input', () => {
  animateSpeedValue.textContent = animateSpeedSlider.value;
});

animateToggle.addEventListener('change', () => {
  animateEnabled = animateToggle.checked;
  if (animateEnabled && sourceImage && !isVideo) {
    startAnimateLoop();
  } else {
    stopAnimateLoop();
    scheduleRender(); // render one clean frame
  }
});

function startAnimateLoop() {
  stopAnimateLoop();
  animTime = performance.now();
  function loop(now) {
    animTime = now;
    renderDither();
    animateFrameId = requestAnimationFrame(loop);
  }
  animateFrameId = requestAnimationFrame(loop);
}

function stopAnimateLoop() {
  if (animateFrameId) {
    cancelAnimationFrame(animateFrameId);
    animateFrameId = null;
  }
}

// --- Smooth 2D noise (value noise with smooth interpolation) ---
// Permutation table for noise
const PERM = new Uint8Array(512);
(function initPerm() {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  // Fisher-Yates shuffle with fixed seed
  let seed = 42;
  for (let i = 255; i > 0; i--) {
    seed = (seed * 16807 + 0) % 2147483647;
    const j = seed % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
})();

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + t * (b - a); }

function grad2d(hash, x, y) {
  const h = hash & 3;
  return ((h & 1) ? -x : x) + ((h & 2) ? -y : y);
}

function noise2d(x, y) {
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);
  const aa = PERM[PERM[xi] + yi];
  const ab = PERM[PERM[xi] + yi + 1];
  const ba = PERM[PERM[xi + 1] + yi];
  const bb = PERM[PERM[xi + 1] + yi + 1];
  return lerp(
    lerp(grad2d(aa, xf, yf), grad2d(ba, xf - 1, yf), u),
    lerp(grad2d(ab, xf, yf - 1), grad2d(bb, xf - 1, yf - 1), u),
    v
  );
}

// Fractal brownian motion for richer noise
function fbm(x, y, octaves) {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * noise2d(x * freq, y * freq);
    amp *= 0.5;
    freq *= 2;
  }
  return val;
}

let renderTimeout = null;
function scheduleRender() {
  if (isVideo) return; // video has its own render loop
  if (animateEnabled && animateFrameId) return; // animate loop handles rendering
  if (renderTimeout) cancelAnimationFrame(renderTimeout);
  renderTimeout = requestAnimationFrame(renderDither);
}

// --- Core dither rendering ---
function renderDither() {
  if (!sourceImage && !isVideo) return;

  const settings = getSettings();
  const cellSize = settings.scale;
  const source = isVideo ? sourceVideo : sourceImage;
  const srcW = isVideo ? sourceVideo.videoWidth : sourceImage.naturalWidth;
  const srcH = isVideo ? sourceVideo.videoHeight : sourceImage.naturalHeight;

  if (!srcW || !srcH) return;

  // Get frame dimensions based on aspect ratio
  const { canvasW, canvasH } = getCanvasDimensions(srcW, srcH);

  const cols = Math.ceil(canvasW / cellSize);
  const rows = Math.ceil(canvasH / cellSize);

  // Sample: draw source image scaled and centered onto offscreen canvas
  offscreen.width = cols;
  offscreen.height = rows;
  offCtx.fillStyle = '#000000';
  offCtx.fillRect(0, 0, cols, rows);

  const scale = imageScale / 100;
  const drawW = (srcW / canvasW) * cols * scale;
  const drawH = (srcH / canvasH) * rows * scale;
  const panXCells = panX / cellSize;
  const panYCells = panY / cellSize;
  const drawX = (cols - drawW) / 2 + panXCells;
  const drawY = (rows - drawH) / 2 + panYCells;
  offCtx.drawImage(source, drawX, drawY, drawW, drawH);

  const imageData = offCtx.getImageData(0, 0, cols, rows);
  const pixels = imageData.data;

  // Set output canvas size
  const outW = cols * cellSize;
  const outH = rows * cellSize;
  canvas.width = outW;
  canvas.height = outH;

  // Fill background
  ctx.fillStyle = settings.bgColor;
  ctx.fillRect(0, 0, outW, outH);

  // Set shape color
  ctx.fillStyle = settings.shapeColor;

  const scaleFactor = cellSize / SHAPE_VIEWBOX;

  // Pre-compute values that are constant across all cells
  const brightnessOffset = settings.brightness / 255;
  const contrastVal = settings.contrast;
  const invGamma = 1 / settings.gamma;
  const doInvert = settings.invert;
  const t1 = settings.threshold1;
  const t2 = settings.threshold2;
  const t3 = settings.threshold3;

  // Pre-compute animation values once per frame
  let doAnimate = false, animStrength, animT, animNoiseScale;
  if (animateEnabled && !isVideo) {
    doAnimate = true;
    animStrength = parseFloat(animateStrengthSlider.value) * 0.5;
    const speed = parseInt(animateSpeedSlider.value) / 50;
    animT = animTime * 0.001 * speed;
    animNoiseScale = 0.15;
  }

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      let lum = (0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]) / 255;

      // Apply brightness + contrast + gamma in one pass with minimal clamping
      lum = ((lum + brightnessOffset - 0.5) * contrastVal) + 0.5;
      if (lum < 0) lum = 0; else if (lum > 1) lum = 1;
      if (invGamma !== 1) lum = lum ** invGamma;

      if (doInvert) lum = 1 - lum;

      // Apply animated noise to luminance
      if (doAnimate) {
        const nx = x * animNoiseScale;
        const ny = y * animNoiseScale;
        const n1 = fbm(nx + animT * 0.3, ny + animT * 0.2, 3);
        const n2 = fbm(nx * 1.3 - animT * 0.25, ny * 1.3 + animT * 0.15, 2);
        lum += (n1 + n2) * animStrength;
        if (lum < 0) lum = 0; else if (lum > 1) lum = 1;
      }

      // Inline shape index lookup — avoid function call overhead
      let shapeIndex;
      if (lum >= t1) shapeIndex = 0;
      else if (lum >= t2) shapeIndex = 1;
      else if (lum >= t3) shapeIndex = 2;
      else continue; // blank

      // setTransform is faster than save/translate/scale/restore
      ctx.setTransform(scaleFactor, 0, 0, scaleFactor, x * cellSize, y * cellSize);
      ctx.fill(SHAPES[shapeIndex]);
    }
  }

  // Reset transform for any subsequent drawing
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function getShapeIndex(darkness, settings) {
  // darkness: 0 = white, 1 = black
  if (darkness >= settings.threshold1) return 0; // most dense
  if (darkness >= settings.threshold2) return 1; // medium
  if (darkness >= settings.threshold3) return 2; // least dense
  return -1; // blank
}

// --- Video loop ---
function startVideoLoop() {
  function loop() {
    if (!isVideo) return;
    renderDither();
    animFrameId = requestAnimationFrame(loop);
  }
  loop();
}

// --- Export functions ---
exportPng.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'dither-output.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

exportJpg.addEventListener('click', () => {
  // JPG needs white bg if canvas has transparency, but ours is already filled
  const link = document.createElement('a');
  link.download = 'dither-output.jpg';
  link.href = canvas.toDataURL('image/jpeg', 0.95);
  link.click();
});

exportSvg.addEventListener('click', () => {
  const settings = getSettings();
  const cellSize = settings.scale;
  const srcW = sourceImage.naturalWidth;
  const srcH = sourceImage.naturalHeight;
  const { canvasW, canvasH } = getCanvasDimensions(srcW, srcH);
  const cols = Math.ceil(canvasW / cellSize);
  const rows = Math.ceil(canvasH / cellSize);

  offscreen.width = cols;
  offscreen.height = rows;
  offCtx.fillStyle = '#000000';
  offCtx.fillRect(0, 0, cols, rows);
  const scale = imageScale / 100;
  const drawW = (srcW / canvasW) * cols * scale;
  const drawH = (srcH / canvasH) * rows * scale;
  const panXCells = panX / cellSize;
  const panYCells = panY / cellSize;
  const drawX = (cols - drawW) / 2 + panXCells;
  const drawY = (rows - drawH) / 2 + panYCells;
  offCtx.drawImage(sourceImage, drawX, drawY, drawW, drawH);
  const imageData = offCtx.getImageData(0, 0, cols, rows);
  const pixels = imageData.data;

  const outW = cols * cellSize;
  const outH = rows * cellSize;
  // Note: outW/outH now reflect the frame dimensions

  const scaleFactor = cellSize / SHAPE_VIEWBOX;
  const paths = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      let lum = (0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]) / 255;

      lum += settings.brightness / 255;
      lum = Math.max(0, Math.min(1, lum));
      lum = ((lum - 0.5) * settings.contrast) + 0.5;
      lum = Math.max(0, Math.min(1, lum));
      lum = Math.pow(Math.max(0, Math.min(1, lum)), 1 / settings.gamma);
      if (settings.invert) lum = 1 - lum;

      const shapeIndex = getShapeIndex(lum, settings);
      if (shapeIndex < 0) continue;

      const tx = x * cellSize;
      const ty = y * cellSize;
      paths.push(`<g transform="translate(${tx},${ty}) scale(${scaleFactor})"><path d="${SHAPE_PATH_STRINGS[shapeIndex]}" fill="${settings.shapeColor}"/></g>`);
    }
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}" viewBox="0 0 ${outW} ${outH}">
<rect width="${outW}" height="${outH}" fill="${settings.bgColor}"/>
${paths.join('\n')}
</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  link.download = 'dither-output.svg';
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
});

// --- MP4 Export ---
exportMp4.addEventListener('click', async () => {
  if (!isVideo) return;

  exportMp4.disabled = true;
  exportMp4.textContent = 'Encoding...';

  try {
    // Pause live rendering during export
    const wasPlaying = !sourceVideo.paused;
    if (animFrameId) cancelAnimationFrame(animFrameId);

    const fps = 30;
    const duration = sourceVideo.duration;
    const totalFrames = Math.floor(duration * fps);

    // Use MediaRecorder with canvas captureStream
    const stream = canvas.captureStream(0); // 0 = manual frame control
    const track = stream.getVideoTracks()[0];

    const chunks = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: getSupportedMimeType(),
      videoBitsPerSecond: 8_000_000,
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const done = new Promise((resolve) => {
      recorder.onstop = resolve;
    });

    recorder.start();

    for (let frame = 0; frame < totalFrames; frame++) {
      sourceVideo.currentTime = frame / fps;
      await new Promise((r) => {
        sourceVideo.onseeked = r;
      });
      renderDither();
      // Request a frame from the stream
      if (track.requestFrame) track.requestFrame();
      // Small delay to let MediaRecorder capture the frame
      await new Promise((r) => setTimeout(r, 1000 / fps));
    }

    recorder.stop();
    await done;

    const blob = new Blob(chunks, { type: chunks[0]?.type || 'video/webm' });
    const link = document.createElement('a');
    link.download = 'dither-output.' + (blob.type.includes('mp4') ? 'mp4' : 'webm');
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);

    // Resume playback
    if (wasPlaying) {
      sourceVideo.currentTime = 0;
      sourceVideo.play();
      startVideoLoop();
    }
  } catch (err) {
    console.error('Export failed:', err);
    alert('Video export failed. Try a shorter clip or use Chrome for best compatibility.');
  } finally {
    exportMp4.disabled = false;
    exportMp4.textContent = 'MP4';
  }
});

function getSupportedMimeType() {
  const types = [
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'video/webm';
}
