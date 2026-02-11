/**
 * ImageObj — 图片对象类
 * Represents an image on the canvas with position, size, and deform data
 */

import { state } from './state.js';

export class ImageObj {
  constructor(img, x, y) {
    this.id = state.nextId++;
    this.img = img;
    this.x = x;
    this.y = y;
    this.w = img.naturalWidth;
    this.h = img.naturalHeight;

    // Fit to reasonable size
    const maxDim = 400;
    if (this.w > maxDim || this.h > maxDim) {
      const scale = maxDim / Math.max(this.w, this.h);
      this.w *= scale;
      this.h *= scale;
    }
    this.origW = this.w;
    this.origH = this.h;

    // Deform: 4 corners as offsets from default rect corners
    this.resetDeform();
  }

  resetDeform() {
    // Offsets from the rectangle corners [dx, dy]
    this.corners = [
      [0, 0], // top-left
      [0, 0], // top-right
      [0, 0], // bottom-right
      [0, 0], // bottom-left
    ];
    // Edge midpoint offsets [dx, dy]
    this.edges = [
      [0, 0], // top-mid
      [0, 0], // right-mid
      [0, 0], // bottom-mid
      [0, 0], // left-mid
    ];
  }

  // Get actual corner positions (world coords)
  getCorners() {
    return [
      [this.x + this.corners[0][0], this.y + this.corners[0][1]],                     // TL
      [this.x + this.w + this.corners[1][0], this.y + this.corners[1][1]],              // TR
      [this.x + this.w + this.corners[2][0], this.y + this.h + this.corners[2][1]],     // BR
      [this.x + this.corners[3][0], this.y + this.h + this.corners[3][1]],              // BL
    ];
  }

  getEdgeMids() {
    const c = this.getCorners();
    return [
      [(c[0][0]+c[1][0])/2 + this.edges[0][0], (c[0][1]+c[1][1])/2 + this.edges[0][1]], // top
      [(c[1][0]+c[2][0])/2 + this.edges[1][0], (c[1][1]+c[2][1])/2 + this.edges[1][1]], // right
      [(c[2][0]+c[3][0])/2 + this.edges[2][0], (c[2][1]+c[3][1])/2 + this.edges[2][1]], // bottom
      [(c[3][0]+c[0][0])/2 + this.edges[3][0], (c[3][1]+c[0][1])/2 + this.edges[3][1]], // left
    ];
  }

  getBounds() {
    const c = this.getCorners();
    const xs = c.map(p => p[0]), ys = c.map(p => p[1]);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
    };
  }

  hasDeform() {
    return this.corners.some(c => c[0] !== 0 || c[1] !== 0) ||
           this.edges.some(e => e[0] !== 0 || e[1] !== 0);
  }
}
