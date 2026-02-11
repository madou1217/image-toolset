/**
 * Undo System — 撤销系统
 */

import { state, MAX_UNDO } from './state.js';
import { render } from './canvas.js';
import { toast } from './utils.js';

const undoStack = [];

export function saveState() {
  const snap = state.images.map(im => ({
    id: im.id, x: im.x, y: im.y, w: im.w, h: im.h,
    corners: im.corners.map(c => [...c]),
    edges: im.edges.map(e => [...e]),
  }));
  undoStack.push({ images: snap, selected: new Set(state.selected) });
  if (undoStack.length > MAX_UNDO) undoStack.shift();
}

export function undo() {
  if (undoStack.length === 0) { toast('没有可撤销的操作'); return; }
  const snap = undoStack.pop();
  // Restore positions / sizes for images that still exist
  for (const si of snap.images) {
    const im = state.images.find(m => m.id === si.id);
    if (im) {
      im.x = si.x; im.y = si.y; im.w = si.w; im.h = si.h;
      im.corners = si.corners; im.edges = si.edges;
    }
  }
  state.selected = snap.selected;
  render();
  toast('已撤销');
}
