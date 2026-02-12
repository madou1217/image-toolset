/**
 * Image Crop Tool
 * Canvas-based cropping with ratio presets, rotation, and flip
 */

const $ = (s) => document.querySelector(s);

const state = {
  img: null,
  rotation: 0,       // 0, 90, 180, 270
  flipH: false,
  flipV: false,
  ratio: null,       // null = free, or [w, h]
  // crop rect in image coordinates
  crop: { x: 0, y: 0, w: 0, h: 0 },
  // interaction
  dragging: null,     // null | 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | 'new'
  dragStart: { mx: 0, my: 0, cx: 0, cy: 0, cw: 0, ch: 0 },
  // display
  scale: 1,
  offset: { x: 0, y: 0 },
};

/* ─── DOM ─── */
const uploadArea  = $('#upload-area');
const workspaceEl = $('#crop-workspace');
const canvasWrap  = $('#crop-canvas-wrap');
const canvas      = $('#crop-canvas');
const ctx         = canvas.getContext('2d');
const fileInput   = $('#file-input');
const cropInfo    = $('#crop-info-dims');
const toast       = $('#toast');

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 2000);
}

/* ─── Load Image ─── */
function loadImage(file) {
  if (!file.type.startsWith('image/')) return;
  const img = new Image();
  img.onload = () => {
    state.img = img;
    state.rotation = 0;
    state.flipH = false;
    state.flipV = false;
    resetCrop();
    uploadArea.classList.add('hidden');
    workspaceEl.classList.add('active');
    fitToContainer();
    render();
  };
  img.src = URL.createObjectURL(file);
}

/* ─── Get effective dimensions after rotation ─── */
function getEffectiveDims() {
  if (!state.img) return { w: 0, h: 0 };
  const rotated = state.rotation % 180 !== 0;
  return {
    w: rotated ? state.img.naturalHeight : state.img.naturalWidth,
    h: rotated ? state.img.naturalWidth : state.img.naturalHeight,
  };
}

/* ─── Reset crop to full image ─── */
function resetCrop() {
  const { w, h } = getEffectiveDims();
  if (state.ratio) {
    const [rw, rh] = state.ratio;
    const scale = Math.min(w / rw, h / rh);
    const cw = rw * scale;
    const ch = rh * scale;
    state.crop = { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch };
  } else {
    state.crop = { x: 0, y: 0, w, h };
  }
}

/* ─── Fit image in container ─── */
function fitToContainer() {
  const rect = canvasWrap.getBoundingClientRect();
  const { w, h } = getEffectiveDims();
  const padding = 40;
  state.scale = Math.min((rect.width - padding * 2) / w, (rect.height - padding * 2) / h, 1);
  state.offset.x = (rect.width - w * state.scale) / 2;
  state.offset.y = (rect.height - h * state.scale) / 2;
  canvas.width = rect.width;
  canvas.height = rect.height;
}

/* ─── Render ─── */
function render() {
  if (!state.img) return;
  const { w, h } = getEffectiveDims();
  const s = state.scale;
  const ox = state.offset.x;
  const oy = state.offset.y;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw image with transforms
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(s, s);

  // Apply rotation & flip
  ctx.save();
  const iw = state.img.naturalWidth;
  const ih = state.img.naturalHeight;
  ctx.translate(w / 2, h / 2);
  ctx.rotate((state.rotation * Math.PI) / 180);
  ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
  ctx.drawImage(state.img, -iw / 2, -ih / 2);
  ctx.restore();

  // Dark overlay outside crop
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const c = state.crop;
  // Top
  ctx.fillRect(0, 0, w, c.y);
  // Bottom
  ctx.fillRect(0, c.y + c.h, w, h - c.y - c.h);
  // Left
  ctx.fillRect(0, c.y, c.x, c.h);
  // Right
  ctx.fillRect(c.x + c.w, c.y, w - c.x - c.w, c.h);

  // Crop border
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2 / s;
  ctx.strokeRect(c.x, c.y, c.w, c.h);

  // Rule of thirds
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1 / s;
  for (let i = 1; i < 3; i++) {
    const lx = c.x + (c.w * i) / 3;
    const ly = c.y + (c.h * i) / 3;
    ctx.beginPath(); ctx.moveTo(lx, c.y); ctx.lineTo(lx, c.y + c.h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c.x, ly); ctx.lineTo(c.x + c.w, ly); ctx.stroke();
  }

  // Corner handles
  const hs = 8 / s;
  const corners = [
    [c.x, c.y], [c.x + c.w, c.y],
    [c.x, c.y + c.h], [c.x + c.w, c.y + c.h],
  ];
  ctx.fillStyle = '#fff';
  for (const [cx, cy] of corners) {
    ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
  }

  ctx.restore();

  // Update info
  cropInfo.textContent = `${Math.round(c.w)} × ${Math.round(c.h)}`;
}

/* ─── Screen → Image coordinate conversion ─── */
function screenToImage(sx, sy) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (sx - rect.left - state.offset.x) / state.scale,
    y: (sy - rect.top - state.offset.y) / state.scale,
  };
}

/* ─── Hit test for handles/edges ─── */
function hitTest(mx, my) {
  const { x, y, w, h } = state.crop;
  const threshold = 10 / state.scale;

  // Corners
  if (Math.abs(mx - x) < threshold && Math.abs(my - y) < threshold) return 'nw';
  if (Math.abs(mx - (x + w)) < threshold && Math.abs(my - y) < threshold) return 'ne';
  if (Math.abs(mx - x) < threshold && Math.abs(my - (y + h)) < threshold) return 'sw';
  if (Math.abs(mx - (x + w)) < threshold && Math.abs(my - (y + h)) < threshold) return 'se';

  // Edges
  if (Math.abs(mx - x) < threshold && my > y && my < y + h) return 'w';
  if (Math.abs(mx - (x + w)) < threshold && my > y && my < y + h) return 'e';
  if (Math.abs(my - y) < threshold && mx > x && mx < x + w) return 'n';
  if (Math.abs(my - (y + h)) < threshold && mx > x && mx < x + w) return 's';

  // Inside
  if (mx > x && mx < x + w && my > y && my < y + h) return 'move';

  return 'new';
}

/* ─── Constrain crop to ratio ─── */
function constrainCrop(handle) {
  if (!state.ratio) return;
  const [rw, rh] = state.ratio;
  const c = state.crop;

  if (handle === 'move') return;

  // Adjust height to match ratio based on width
  const targetH = (c.w / rw) * rh;
  if (['n', 'nw', 'ne'].includes(handle)) {
    c.y = c.y + c.h - targetH;
  }
  c.h = targetH;
}

/* ─── Clamp crop to image bounds ─── */
function clampCrop() {
  const { w, h } = getEffectiveDims();
  const c = state.crop;
  c.w = Math.max(20, Math.min(c.w, w));
  c.h = Math.max(20, Math.min(c.h, h));
  c.x = Math.max(0, Math.min(c.x, w - c.w));
  c.y = Math.max(0, Math.min(c.y, h - c.h));
}

/* ─── Mouse interactions ─── */
canvas.addEventListener('mousedown', (e) => {
  const pt = screenToImage(e.clientX, e.clientY);
  const handle = hitTest(pt.x, pt.y);

  state.dragging = handle;
  state.dragStart = {
    mx: pt.x, my: pt.y,
    cx: state.crop.x, cy: state.crop.y,
    cw: state.crop.w, ch: state.crop.h,
  };

  if (handle === 'new') {
    state.crop.x = pt.x;
    state.crop.y = pt.y;
    state.crop.w = 0;
    state.crop.h = 0;
    state.dragging = 'se';
    state.dragStart.cx = pt.x;
    state.dragStart.cy = pt.y;
    state.dragStart.cw = 0;
    state.dragStart.ch = 0;
  }
});

canvas.addEventListener('mousemove', (e) => {
  const pt = screenToImage(e.clientX, e.clientY);

  if (!state.dragging) {
    const handle = hitTest(pt.x, pt.y);
    const cursors = {
      nw: 'nw-resize', ne: 'ne-resize', sw: 'sw-resize', se: 'se-resize',
      n: 'n-resize', s: 's-resize', w: 'w-resize', e: 'e-resize',
      move: 'move', new: 'crosshair',
    };
    canvas.style.cursor = cursors[handle] || 'crosshair';
    return;
  }

  const dx = pt.x - state.dragStart.mx;
  const dy = pt.y - state.dragStart.my;
  const d = state.dragStart;
  const c = state.crop;

  switch (state.dragging) {
    case 'move':
      c.x = d.cx + dx;
      c.y = d.cy + dy;
      break;
    case 'se':
      c.w = d.cw + dx;
      c.h = d.ch + dy;
      break;
    case 'sw':
      c.x = d.cx + dx;
      c.w = d.cw - dx;
      c.h = d.ch + dy;
      break;
    case 'ne':
      c.w = d.cw + dx;
      c.y = d.cy + dy;
      c.h = d.ch - dy;
      break;
    case 'nw':
      c.x = d.cx + dx;
      c.y = d.cy + dy;
      c.w = d.cw - dx;
      c.h = d.ch - dy;
      break;
    case 'n':
      c.y = d.cy + dy;
      c.h = d.ch - dy;
      break;
    case 's':
      c.h = d.ch + dy;
      break;
    case 'w':
      c.x = d.cx + dx;
      c.w = d.cw - dx;
      break;
    case 'e':
      c.w = d.cw + dx;
      break;
  }

  // Handle negative dimensions (dragging past origin)
  if (c.w < 0) { c.x += c.w; c.w = -c.w; }
  if (c.h < 0) { c.y += c.h; c.h = -c.h; }

  constrainCrop(state.dragging);
  clampCrop();
  render();
});

window.addEventListener('mouseup', () => { state.dragging = null; });

/* ─── Rotation / Flip ─── */
$('#btn-rotate-cw').addEventListener('click', () => {
  state.rotation = (state.rotation + 90) % 360;
  resetCrop();
  fitToContainer();
  render();
});
$('#btn-rotate-ccw').addEventListener('click', () => {
  state.rotation = (state.rotation + 270) % 360;
  resetCrop();
  fitToContainer();
  render();
});
$('#btn-flip-h').addEventListener('click', () => {
  state.flipH = !state.flipH;
  render();
});
$('#btn-flip-v').addEventListener('click', () => {
  state.flipV = !state.flipV;
  render();
});
$('#btn-reset').addEventListener('click', () => {
  state.rotation = 0;
  state.flipH = false;
  state.flipV = false;
  state.ratio = null;
  document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
  $('.ratio-btn[data-ratio="free"]').classList.add('active');
  resetCrop();
  fitToContainer();
  render();
});

/* ─── Ratio presets ─── */
document.querySelectorAll('.ratio-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const val = btn.dataset.ratio;
    if (val === 'free') {
      state.ratio = null;
    } else {
      const [w, h] = val.split(':').map(Number);
      state.ratio = [w, h];
    }
    resetCrop();
    render();
  });
});

/* ─── Export ─── */
$('#btn-export').addEventListener('click', () => {
  if (!state.img) return;
  const c = state.crop;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = Math.round(c.w);
  outCanvas.height = Math.round(c.h);
  const outCtx = outCanvas.getContext('2d');

  // Need to apply same transforms then crop
  const { w, h } = getEffectiveDims();
  const iw = state.img.naturalWidth;
  const ih = state.img.naturalHeight;

  outCtx.save();
  outCtx.translate(-c.x, -c.y);
  outCtx.translate(w / 2, h / 2);
  outCtx.rotate((state.rotation * Math.PI) / 180);
  outCtx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
  outCtx.drawImage(state.img, -iw / 2, -ih / 2);
  outCtx.restore();

  outCanvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cropped_${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('裁剪图片已导出');
  }, 'image/png');
});

/* ─── New Image ─── */
$('#btn-new').addEventListener('click', () => fileInput.click());

/* ─── File input & upload area ─── */
fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) loadImage(e.target.files[0]);
  fileInput.value = '';
});
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) loadImage(e.dataTransfer.files[0]);
});

// Page-level drop when workspace is active
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  if (workspaceEl.classList.contains('active') && e.dataTransfer.files[0]) {
    loadImage(e.dataTransfer.files[0]);
  }
});

/* ─── Resize ─── */
window.addEventListener('resize', () => {
  if (state.img) { fitToContainer(); render(); }
});
