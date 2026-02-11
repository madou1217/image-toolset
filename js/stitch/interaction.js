/**
 * Interaction — 交互事件
 * Mouse events, keyboard shortcuts, drag & drop, context menu
 */

import { state, SNAP_DIST } from './state.js';
import { render, screenToWorld, hitTest, hitResizeHandle, hitDeformCorner, getCanvas } from './canvas.js';
import { saveState, undo } from './undo.js';
import { toast, loadFiles, updateCount } from './utils.js';
import { stitchHorizontal, stitchVertical } from './stitcher.js';
import { exportPNG } from './exporter.js';

// ─── DOM refs ───
let cvs = null;
let fileInput = null;
let dropOverlay = null;
let ctxMenu = null;
let modeText = null;

export function initInteraction(elements) {
  cvs = elements.canvas;
  fileInput = elements.fileInput;
  dropOverlay = elements.dropOverlay;
  ctxMenu = elements.ctxMenu;
  modeText = elements.modeText;

  setupMouseEvents();
  setupKeyboard();
  setupToolbar(elements);
  setupDragDrop();
  setupContextMenu();
}

// ─── Selection helpers ───
function selectAll() {
  state.selected.clear();
  state.images.forEach((_, i) => state.selected.add(i));
  render();
}

function deleteSelected() {
  if (state.selected.size === 0) return;
  const sorted = [...state.selected].sort((a, b) => b - a);
  for (const idx of sorted) state.images.splice(idx, 1);
  state.selected.clear();
  updateCount();
  render();
  toast('已删除');
}

function toggleDeformMode() {
  state.deformMode = !state.deformMode;
  if (modeText) modeText.textContent = state.deformMode ? '变形模式' : '缩放模式';
  const btn = document.getElementById('btn-deform-toggle');
  if (btn) {
    btn.style.color = state.deformMode ? '#fd79a8' : '';
    btn.style.borderColor = state.deformMode ? 'rgba(253,121,168,0.4)' : '';
  }
  render();
  toast(state.deformMode ? '已切换到变形模式 — 拖拽控制点变形图片' : '已切换到缩放模式 — 拖拽角手柄缩放');
}

// ─── Mouse events ───
function setupMouseEvents() {
  cvs.addEventListener('mousedown', onMouseDown);
  cvs.addEventListener('mousemove', onMouseMove);
  cvs.addEventListener('mouseup', onMouseUp);
  cvs.addEventListener('mouseleave', () => { if (state.isPanning) state.isPanning = false; });
  cvs.addEventListener('wheel', onWheel, { passive: false });
}

function onMouseDown(e) {
  hideCtxMenu();
  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    state.isPanning = true;
    state.panStart = { x: e.clientX, y: e.clientY };
    cvs.style.cursor = 'grabbing';
    return;
  }
  if (e.button !== 0) return;

  const [wx, wy] = screenToWorld(e.clientX, e.clientY);

  // Check deform controls first
  if (state.deformMode) {
    for (const idx of state.selected) {
      const hit = hitDeformCorner(wx, wy, idx);
      if (hit) {
        saveState();
        const im = state.images[idx];
        state.dragging = {
          type: 'deform',
          imgIdx: idx,
          deformType: hit.type,
          deformIdx: hit.idx,
          startMX: wx, startMY: wy,
          startVal: hit.type === 'corner'
            ? [...im.corners[hit.idx]]
            : [...im.edges[hit.idx]]
        };
        return;
      }
    }
  }

  // Check resize handles
  if (!state.deformMode) {
    for (const idx of state.selected) {
      const corner = hitResizeHandle(wx, wy, idx);
      if (corner) {
        saveState();
        const im = state.images[idx];
        state.dragging = {
          type: 'resize',
          imgIdx: idx,
          corner,
          startMX: wx, startMY: wy,
          startX: im.x, startY: im.y,
          startW: im.w, startH: im.h,
        };
        return;
      }
    }
  }

  // Check image hit
  const hitIdx = hitTest(wx, wy);
  if (hitIdx >= 0) {
    if (e.shiftKey) {
      if (state.selected.has(hitIdx)) state.selected.delete(hitIdx);
      else state.selected.add(hitIdx);
    } else {
      if (!state.selected.has(hitIdx)) {
        state.selected.clear();
        state.selected.add(hitIdx);
      }
    }
    saveState();
    const im = state.images[hitIdx];
    state.dragging = {
      type: 'move',
      imgIdx: hitIdx,
      startMX: wx, startMY: wy,
      startPositions: [...state.selected].map(i => ({ i, x: state.images[i].x, y: state.images[i].y }))
    };
    // Bring to front
    if (!e.shiftKey && state.selected.size === 1) {
      const item = state.images.splice(hitIdx, 1)[0];
      state.images.push(item);
      state.selected.clear();
      state.selected.add(state.images.length - 1);
      state.dragging.imgIdx = state.images.length - 1;
      state.dragging.startPositions = [{ i: state.images.length - 1, x: item.x, y: item.y }];
    }
    render();
    return;
  }

  // Empty space -> deselect + start pan
  if (!e.shiftKey) {
    state.selected.clear();
    state.isPanning = true;
    state.panStart = { x: e.clientX, y: e.clientY };
    cvs.style.cursor = 'grabbing';
    render();
  }
}

function onMouseMove(e) {
  if (state.isPanning) {
    const dx = (e.clientX - state.panStart.x) * devicePixelRatio / state.cam.zoom;
    const dy = (e.clientY - state.panStart.y) * devicePixelRatio / state.cam.zoom;
    state.cam.x += dx;
    state.cam.y += dy;
    state.panStart = { x: e.clientX, y: e.clientY };
    render();
    return;
  }

  if (!state.dragging) {
    const [wx, wy] = screenToWorld(e.clientX, e.clientY);
    let cursor = 'default';

    if (state.deformMode) {
      for (const idx of state.selected) {
        if (hitDeformCorner(wx, wy, idx)) { cursor = 'crosshair'; break; }
      }
    } else {
      for (const idx of state.selected) {
        const corner = hitResizeHandle(wx, wy, idx);
        if (corner) {
          cursor = corner === 'tl' || corner === 'br' ? 'nwse-resize' : 'nesw-resize';
          break;
        }
      }
    }
    if (cursor === 'default' && hitTest(wx, wy) >= 0) cursor = 'grab';
    cvs.style.cursor = cursor;
    return;
  }

  const [wx, wy] = screenToWorld(e.clientX, e.clientY);
  const dx = wx - state.dragging.startMX;
  const dy = wy - state.dragging.startMY;

  if (state.dragging.type === 'move') {
    for (const sp of state.dragging.startPositions) {
      state.images[sp.i].x = sp.x + dx;
      state.images[sp.i].y = sp.y + dy;
    }
    // Edge snapping
    state.snapLines = [];
    const threshold = SNAP_DIST / state.cam.zoom;
    const movingIndices = new Set(state.dragging.startPositions.map(sp => sp.i));
    let bestSnapX = null, bestDistX = threshold;
    let bestSnapY = null, bestDistY = threshold;
    for (const sp of state.dragging.startPositions) {
      const mi = state.images[sp.i];
      const mEdgesX = [mi.x, mi.x + mi.w];
      const mEdgesY = [mi.y, mi.y + mi.h];
      for (let j = 0; j < state.images.length; j++) {
        if (movingIndices.has(j)) continue;
        const oj = state.images[j];
        const oEdgesX = [oj.x, oj.x + oj.w];
        const oEdgesY = [oj.y, oj.y + oj.h];
        for (const me of mEdgesX) {
          for (const oe of oEdgesX) {
            const d = Math.abs(me - oe);
            if (d < bestDistX) { bestDistX = d; bestSnapX = { dx: oe - me, pos: oe }; }
          }
        }
        for (const me of mEdgesY) {
          for (const oe of oEdgesY) {
            const d = Math.abs(me - oe);
            if (d < bestDistY) { bestDistY = d; bestSnapY = { dy: oe - me, pos: oe }; }
          }
        }
      }
    }
    if (bestSnapX) {
      for (const sp of state.dragging.startPositions) { state.images[sp.i].x += bestSnapX.dx; }
      state.snapLines.push({axis:'x', pos: bestSnapX.pos});
    }
    if (bestSnapY) {
      for (const sp of state.dragging.startPositions) { state.images[sp.i].y += bestSnapY.dy; }
      state.snapLines.push({axis:'y', pos: bestSnapY.pos});
    }
  } else if (state.dragging.type === 'resize') {
    const im = state.images[state.dragging.imgIdx];
    const aspect = state.dragging.startW / state.dragging.startH;
    let newW, newH, newX, newY;

    if (state.dragging.corner === 'br') {
      newW = Math.max(30, state.dragging.startW + dx);
      newH = newW / aspect;
      newX = state.dragging.startX;
      newY = state.dragging.startY;
    } else if (state.dragging.corner === 'bl') {
      newW = Math.max(30, state.dragging.startW - dx);
      newH = newW / aspect;
      newX = state.dragging.startX + state.dragging.startW - newW;
      newY = state.dragging.startY;
    } else if (state.dragging.corner === 'tr') {
      newW = Math.max(30, state.dragging.startW + dx);
      newH = newW / aspect;
      newX = state.dragging.startX;
      newY = state.dragging.startY + state.dragging.startH - newH;
    } else { // tl
      newW = Math.max(30, state.dragging.startW - dx);
      newH = newW / aspect;
      newX = state.dragging.startX + state.dragging.startW - newW;
      newY = state.dragging.startY + state.dragging.startH - newH;
    }
    im.x = newX; im.y = newY;
    im.w = newW; im.h = newH;
  } else if (state.dragging.type === 'deform') {
    const im = state.images[state.dragging.imgIdx];
    const DEFORM_SNAP = 8 / state.cam.zoom;
    let newVal = [
      state.dragging.startVal[0] + dx,
      state.dragging.startVal[1] + dy,
    ];
    if (Math.abs(newVal[0]) < DEFORM_SNAP && Math.abs(newVal[1]) < DEFORM_SNAP) {
      newVal = [0, 0];
    }
    if (state.dragging.deformType === 'corner') {
      im.corners[state.dragging.deformIdx] = newVal;
    } else {
      im.edges[state.dragging.deformIdx] = newVal;
    }
  }
  render();
}

function onMouseUp() {
  if (state.dragging) { state.snapLines = []; }
  state.dragging = null;
  state.isPanning = false;
  cvs.style.cursor = 'default';
  render();
}

function onWheel(e) {
  e.preventDefault();
  const delta = -e.deltaY * 0.001;
  const newZoom = Math.min(5, Math.max(0.1, state.cam.zoom * (1 + delta)));
  const [wx, wy] = screenToWorld(e.clientX, e.clientY);
  state.cam.zoom = newZoom;
  const [wx2, wy2] = screenToWorld(e.clientX, e.clientY);
  state.cam.x += (wx2 - wx);
  state.cam.y += (wy2 - wy);
  render();
}

// ─── Keyboard ───
function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (state.selected.size > 0 && document.activeElement === document.body) {
        e.preventDefault();
        saveState();
        deleteSelected();
      }
    }
    if ((e.key === 'a' || e.key === 'A') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      selectAll();
    }
    if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
      e.preventDefault();
      undo();
    }
    if (e.key === 'd' || e.key === 'D') {
      if (document.activeElement === document.body) {
        toggleDeformMode();
      }
    }
  });
}

// ─── Toolbar ───
function setupToolbar(elements) {
  document.getElementById('btn-add').onclick = () => fileInput.click();
  fileInput.onchange = (e) => { loadFiles(e.target.files); fileInput.value = ''; };

  document.getElementById('btn-stitch-h').onclick = stitchHorizontal;
  document.getElementById('btn-stitch-v').onclick = stitchVertical;
  document.getElementById('btn-deform-toggle').onclick = toggleDeformMode;
  document.getElementById('btn-select-all').onclick = selectAll;
  document.getElementById('btn-delete').onclick = () => { if(state.selected.size>0){saveState();} deleteSelected(); };
  document.getElementById('btn-undo').onclick = undo;
  document.getElementById('btn-export').onclick = exportPNG;
}

// ─── Drag & Drop ───
function setupDragDrop() {
  document.addEventListener('dragover', (e) => { e.preventDefault(); dropOverlay.classList.add('active'); });
  document.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null || !document.contains(e.relatedTarget))
      dropOverlay.classList.remove('active');
  });
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    dropOverlay.classList.remove('active');
    if (e.dataTransfer.files.length > 0) loadFiles(e.dataTransfer.files);
  });
}

// ─── Context menu ───
function setupContextMenu() {
  cvs.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const [wx, wy] = screenToWorld(e.clientX, e.clientY);
    const idx = hitTest(wx, wy);
    if (idx >= 0) {
      state.ctxTarget = idx;
      if (!state.selected.has(idx)) { state.selected.clear(); state.selected.add(idx); }
      ctxMenu.style.left = e.clientX + 'px';
      ctxMenu.style.top = e.clientY + 'px';
      ctxMenu.classList.add('show');
      render();
    }
  });

  ctxMenu.addEventListener('click', (e) => {
    const action = e.target.closest('.ctx-item')?.dataset.action;
    if (!action || state.ctxTarget < 0) return;
    const im = state.images[state.ctxTarget];
    const cvs = getCanvas();
    if (action === 'front') {
      state.images.splice(state.ctxTarget, 1);
      state.images.push(im);
      state.selected.clear(); state.selected.add(state.images.length - 1);
    } else if (action === 'back') {
      state.images.splice(state.ctxTarget, 1);
      state.images.unshift(im);
      state.selected.clear(); state.selected.add(0);
    } else if (action === 'reset-deform') {
      im.resetDeform();
    } else if (action === 'fit') {
      const maxW = cvs.width / (devicePixelRatio * state.cam.zoom) * 0.6;
      const maxH = cvs.height / (devicePixelRatio * state.cam.zoom) * 0.6;
      const scale = Math.min(maxW / im.w, maxH / im.h);
      im.w *= scale; im.h *= scale;
      im.x = -im.w/2; im.y = -im.h/2;
      im.resetDeform();
    } else if (action === 'delete') {
      state.images.splice(state.ctxTarget, 1);
      state.selected.clear();
      updateCount();
    }
    hideCtxMenu();
    render();
  });

  document.addEventListener('click', (e) => {
    if (!ctxMenu.contains(e.target)) hideCtxMenu();
  });
}

function hideCtxMenu() {
  ctxMenu.classList.remove('show');
  state.ctxTarget = -1;
}
