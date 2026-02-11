/**
 * App — 主入口
 * Initializes all modules for the stitch tool
 */

import { initCanvas, render } from './canvas.js';
import { initInteraction } from './interaction.js';
import { initUtils, updateCount } from './utils.js';

function init() {
  // Gather DOM references
  const elements = {
    canvas: document.getElementById('canvas'),
    wrap: document.getElementById('canvas-wrap'),
    fileInput: document.getElementById('file-input'),
    dropOverlay: document.getElementById('drop-overlay'),
    emptyState: document.getElementById('empty-state'),
    toastEl: document.getElementById('toast'),
    ctxMenu: document.getElementById('ctx-menu'),
    modeText: document.getElementById('mode-text'),
    imgCount: document.getElementById('img-count'),
  };

  // Initialize modules
  initUtils(elements);
  initCanvas(elements);
  initInteraction(elements);

  // Initial state
  updateCount();
  render();
}

// Boot
init();
