/**
 * Canvas — 画布渲染
 * Canvas sizing, coordinate transforms, grid drawing, image rendering
 */

import { state } from './state.js';
import { drawDeformedImage } from './deform.js';

// ─── DOM refs ───
let cvs = null;
let ctx = null;
let wrap = null;

export function initCanvas(elements) {
  cvs = elements.canvas;
  ctx = cvs.getContext('2d');
  wrap = elements.wrap;

  // roundRect polyfill
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
      if (typeof r === 'number') r = [r,r,r,r];
      this.moveTo(x + r[0], y);
      this.lineTo(x + w - r[1], y);
      this.quadraticCurveTo(x + w, y, x + w, y + r[1]);
      this.lineTo(x + w, y + h - r[2]);
      this.quadraticCurveTo(x + w, y + h, x + w - r[2], y + h);
      this.lineTo(x + r[3], y + h);
      this.quadraticCurveTo(x, y + h, x, y + h - r[3]);
      this.lineTo(x, y + r[0]);
      this.quadraticCurveTo(x, y, x + r[0], y);
    };
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

export function getCanvas() { return cvs; }
export function getCtx() { return ctx; }

// ─── Canvas sizing ───
export function resizeCanvas() {
  if (!cvs || !wrap) return;
  cvs.width = wrap.clientWidth * devicePixelRatio;
  cvs.height = wrap.clientHeight * devicePixelRatio;
  render();
}

// ─── Coordinate transforms ───
export function screenToWorld(sx, sy) {
  return [
    (sx * devicePixelRatio - cvs.width/2) / state.cam.zoom - state.cam.x,
    (sy * devicePixelRatio - cvs.height/2) / state.cam.zoom - state.cam.y
  ];
}

export function worldToScreen(wx, wy) {
  return [
    ((wx + state.cam.x) * state.cam.zoom + cvs.width/2) / devicePixelRatio,
    ((wy + state.cam.y) * state.cam.zoom + cvs.height/2) / devicePixelRatio
  ];
}

// ─── Render ───
export function render() {
  if (!ctx || !cvs) return;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0, 0, cvs.width, cvs.height);

  drawGrid();

  // Apply camera
  ctx.setTransform(
    state.cam.zoom, 0, 0, state.cam.zoom,
    cvs.width/2 + state.cam.x * state.cam.zoom,
    cvs.height/2 + state.cam.y * state.cam.zoom
  );

  // Draw images
  for (let i = 0; i < state.images.length; i++) {
    drawImage(state.images[i], state.selected.has(i), i);
  }
}

// ─── Grid ───
function drawGrid() {
  const step = 50 * state.cam.zoom;
  if (step < 8) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(100,100,160,0.07)';
  ctx.lineWidth = 1;
  const ox = (cvs.width/2 + state.cam.x * state.cam.zoom) % step;
  const oy = (cvs.height/2 + state.cam.y * state.cam.zoom) % step;
  for (let x = ox; x < cvs.width; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cvs.height); ctx.stroke();
  }
  for (let y = oy; y < cvs.height; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cvs.width, y); ctx.stroke();
  }
  // Draw snap lines
  if (state.snapLines.length > 0) {
    ctx.strokeStyle = 'rgba(0,206,201,0.7)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (const sl of state.snapLines) {
      if (sl.axis === 'x') {
        const sx = sl.pos * state.cam.zoom + cvs.width/2 + state.cam.x * state.cam.zoom;
        ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, cvs.height); ctx.stroke();
      } else {
        const sy = sl.pos * state.cam.zoom + cvs.height/2 + state.cam.y * state.cam.zoom;
        ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(cvs.width, sy); ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }
  ctx.restore();
}

// ─── Draw single image ───
function drawImage(im, isSel, idx) {
  ctx.save();

  if (im.hasDeform()) {
    drawDeformedImage(ctx, im);
  } else {
    ctx.drawImage(im.img, im.x, im.y, im.w, im.h);
  }

  // Selection highlight
  if (isSel) {
    ctx.strokeStyle = '#6c5ce7';
    ctx.lineWidth = 2 / state.cam.zoom;
    ctx.setLineDash([6/state.cam.zoom, 4/state.cam.zoom]);
    ctx.strokeRect(im.x - 2/state.cam.zoom, im.y - 2/state.cam.zoom, im.w + 4/state.cam.zoom, im.h + 4/state.cam.zoom);
    ctx.setLineDash([]);

    if (!state.deformMode) {
      // Draw resize handles
      const hs = 8 / state.cam.zoom;
      const handles = getResizeHandles(im, hs);
      for (const h of handles) {
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#6c5ce7';
        ctx.lineWidth = 2 / state.cam.zoom;
        ctx.beginPath();
        ctx.roundRect(h.x, h.y, h.s, h.s, 2/state.cam.zoom);
        ctx.fill(); ctx.stroke();
      }
    }
  }

  // Deform mode controls
  if (state.deformMode && isSel) {
    const corners = im.getCorners();
    for (let ci = 0; ci < 4; ci++) {
      const [cx, cy] = corners[ci];
      const r = 6 / state.cam.zoom;
      ctx.fillStyle = '#fd79a8';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5 / state.cam.zoom;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
    }
    const edgeMids = im.getEdgeMids();
    for (let ei = 0; ei < 4; ei++) {
      const [ex, ey] = edgeMids[ei];
      const r = 5 / state.cam.zoom;
      ctx.fillStyle = '#00cec9';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5 / state.cam.zoom;
      ctx.beginPath();
      ctx.arc(ex, ey, r, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
    }
    // Deform wireframe
    ctx.strokeStyle = 'rgba(253,121,168,0.5)';
    ctx.lineWidth = 1 / state.cam.zoom;
    ctx.setLineDash([3/state.cam.zoom, 3/state.cam.zoom]);
    ctx.beginPath();
    ctx.moveTo(corners[0][0], corners[0][1]);
    for (let i = 1; i < 4; i++) ctx.lineTo(corners[i][0], corners[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

// ─── Resize handles ───
export function getResizeHandles(im, hs) {
  return [
    { x: im.x - hs/2, y: im.y - hs/2, s: hs, corner: 'tl' },
    { x: im.x + im.w - hs/2, y: im.y - hs/2, s: hs, corner: 'tr' },
    { x: im.x + im.w - hs/2, y: im.y + im.h - hs/2, s: hs, corner: 'br' },
    { x: im.x - hs/2, y: im.y + im.h - hs/2, s: hs, corner: 'bl' },
  ];
}

// ─── Hit testing ───
export function hitTest(wx, wy) {
  for (let i = state.images.length - 1; i >= 0; i--) {
    const im = state.images[i];
    if (wx >= im.x && wx <= im.x + im.w && wy >= im.y && wy <= im.y + im.h) {
      return i;
    }
  }
  return -1;
}

export function hitResizeHandle(wx, wy, idx) {
  const im = state.images[idx];
  const hs = 12 / state.cam.zoom;
  const handles = getResizeHandles(im, hs);
  for (const h of handles) {
    if (wx >= h.x - 2/state.cam.zoom && wx <= h.x + h.s + 2/state.cam.zoom &&
        wy >= h.y - 2/state.cam.zoom && wy <= h.y + h.s + 2/state.cam.zoom) {
      return h.corner;
    }
  }
  return null;
}

export function hitDeformCorner(wx, wy, idx) {
  const im = state.images[idx];
  const r = 10 / state.cam.zoom;
  const corners = im.getCorners();
  for (let ci = 0; ci < 4; ci++) {
    const [cx, cy] = corners[ci];
    if (Math.hypot(wx-cx, wy-cy) < r) return { type: 'corner', idx: ci };
  }
  const edgeMids = im.getEdgeMids();
  for (let ei = 0; ei < 4; ei++) {
    const [ex, ey] = edgeMids[ei];
    if (Math.hypot(wx-ex, wy-ey) < r) return { type: 'edge', idx: ei };
  }
  return null;
}
