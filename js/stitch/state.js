/**
 * State Management — 应用状态管理
 * Centralized state for the stitch tool
 */

export const state = {
  images: [],          // array of ImageObj
  selected: new Set(), // indices of selected images
  deformMode: false,
  cam: { x: 0, y: 0, zoom: 1 },
  dragging: null,      // { type, idx, startMX, startMY, ... }
  isPanning: false,
  panStart: { x: 0, y: 0 },
  nextId: 0,
  ctxTarget: -1,
  snapLines: [],       // {axis:'x'|'y', pos: world coord}
  lastStitchH: null,   // array of image ids from last horizontal stitch
  lastStitchV: null,   // array of image ids from last vertical stitch
};

// Constants
export const SNAP_DIST = 12;
export const MAX_UNDO = 50;
