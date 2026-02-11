/**
 * Utils — 工具函数
 * Toast notifications, file loading, count updates
 */

import { state } from './state.js';
import { ImageObj } from './ImageObj.js';
import { render } from './canvas.js';

// ─── DOM references (set during init) ───
let toastEl = null;
let emptyStateEl = null;
let imgCountEl = null;
let toastTimer = null;

export function initUtils(elements) {
  toastEl = elements.toastEl;
  emptyStateEl = elements.emptyState;
  imgCountEl = elements.imgCount;
}

// ─── Toast ───
export function toast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2500);
}

// ─── Update image count ───
export function updateCount() {
  if (imgCountEl) imgCountEl.textContent = `${state.images.length} 张图片`;
  if (emptyStateEl) emptyStateEl.classList.toggle('hidden', state.images.length > 0);
}

// ─── Load image files ───
export function loadFiles(files) {
  let loaded = 0;
  const startX = state.images.length * 50 - 200;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const iObj = new ImageObj(img, startX + loaded * 30, -150 + loaded * 30);
        state.images.push(iObj);
        loaded++;
        updateCount();
        render();
        toast(`已加载: ${file.name}`);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}
