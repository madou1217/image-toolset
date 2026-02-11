/**
 * Stitcher — 拼接逻辑
 * Horizontal and vertical stitching with position swap
 */

import { state } from './state.js';
import { render } from './canvas.js';
import { saveState } from './undo.js';
import { toast } from './utils.js';

function getSelectedSorted() {
  return [...state.selected].sort((a, b) => a - b);
}

export function stitchHorizontal() {
  const sel = getSelectedSorted();
  if (sel.length < 2) { toast('请先选中至少 2 张图片 (Shift+点击多选)'); return; }

  saveState();
  const currentIds = sel.map(i => state.images[i].id);

  // Check if same set was just stitched — swap order
  if (state.lastStitchH && sel.length === 2 &&
      currentIds.length === state.lastStitchH.length &&
      currentIds.every(id => state.lastStitchH.includes(id))) {
    const a = state.images[sel[0]], b = state.images[sel[1]];
    const baseX = Math.min(a.x, b.x);
    const baseY = Math.min(a.y, b.y);
    if (a.x <= b.x) {
      b.x = baseX; b.y = baseY;
      a.x = baseX + b.w; a.y = baseY;
    } else {
      a.x = baseX; a.y = baseY;
      b.x = baseX + a.w; b.y = baseY;
    }
    state.lastStitchH = currentIds.slice().reverse();
    toast('已交换位置');
    render();
    return;
  }

  // Normal stitch: find max height, scale all to same height
  const maxH = Math.max(...sel.map(i => state.images[i].h));
  let curX = Math.min(...sel.map(i => state.images[i].x));
  const startY = Math.min(...sel.map(i => state.images[i].y));

  for (const idx of sel) {
    const im = state.images[idx];
    const scale = maxH / im.h;
    im.w *= scale;
    im.h = maxH;
    im.x = curX;
    im.y = startY;
    im.resetDeform();
    curX += im.w;
  }
  state.lastStitchH = currentIds;
  state.lastStitchV = null;
  toast('已水平拼接 — 再次点击可交换位置');
  render();
}

export function stitchVertical() {
  const sel = getSelectedSorted();
  if (sel.length < 2) { toast('请先选中至少 2 张图片 (Shift+点击多选)'); return; }

  saveState();
  const currentIds = sel.map(i => state.images[i].id);

  // Check if same set was just stitched — swap order
  if (state.lastStitchV && sel.length === 2 &&
      currentIds.length === state.lastStitchV.length &&
      currentIds.every(id => state.lastStitchV.includes(id))) {
    const a = state.images[sel[0]], b = state.images[sel[1]];
    const baseX = Math.min(a.x, b.x);
    const baseY = Math.min(a.y, b.y);
    if (a.y <= b.y) {
      b.x = baseX; b.y = baseY;
      a.x = baseX; a.y = baseY + b.h;
    } else {
      a.x = baseX; a.y = baseY;
      b.x = baseX; b.y = baseY + a.h;
    }
    state.lastStitchV = currentIds.slice().reverse();
    toast('已交换位置');
    render();
    return;
  }

  const maxW = Math.max(...sel.map(i => state.images[i].w));
  let curY = Math.min(...sel.map(i => state.images[i].y));
  const startX = Math.min(...sel.map(i => state.images[i].x));

  for (const idx of sel) {
    const im = state.images[idx];
    const scale = maxW / im.w;
    im.h *= scale;
    im.w = maxW;
    im.x = startX;
    im.y = curY;
    im.resetDeform();
    curY += im.h;
  }
  state.lastStitchV = currentIds;
  state.lastStitchH = null;
  toast('已垂直拼接 — 再次点击可交换位置');
  render();
}
