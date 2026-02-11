/**
 * Exporter — PNG 导出
 */

import { state } from './state.js';
import { interpolatePoint, drawTriangle } from './deform.js';
import { toast } from './utils.js';

export function exportPNG() {
  if (state.images.length === 0) { toast('没有图片可导出'); return; }

  // Calculate bounding box of all images
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const im of state.images) {
    const b = im.getBounds();
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }

  const padding = 0;
  const w = maxX - minX + padding * 2;
  const h = maxY - minY + padding * 2;

  const offCvs = document.createElement('canvas');
  offCvs.width = Math.ceil(w);
  offCvs.height = Math.ceil(h);
  const offCtx = offCvs.getContext('2d');

  // Render each image onto offscreen canvas
  for (const im of state.images) {
    offCtx.save();
    offCtx.translate(-minX + padding, -minY + padding);

    if (im.hasDeform()) {
      const corners = im.getCorners();
      const edgeMids = im.getEdgeMids();
      const DIVS = 20; // higher quality for export

      for (let gy = 0; gy < DIVS; gy++) {
        for (let gx = 0; gx < DIVS; gx++) {
          const u0 = gx / DIVS, u1 = (gx+1) / DIVS;
          const v0 = gy / DIVS, v1 = (gy+1) / DIVS;

          const p00 = interpolatePoint(corners, edgeMids, u0, v0, im);
          const p10 = interpolatePoint(corners, edgeMids, u1, v0, im);
          const p01 = interpolatePoint(corners, edgeMids, u0, v1, im);
          const p11 = interpolatePoint(corners, edgeMids, u1, v1, im);

          const sx = u0 * im.img.naturalWidth;
          const sy = v0 * im.img.naturalHeight;
          const sw = (u1-u0) * im.img.naturalWidth;
          const sh = (v1-v0) * im.img.naturalHeight;

          drawTriangle(offCtx, im.img, sx, sy, sw, sh, p00, p10, p01);
          const vo = [p10[0]+p01[0]-p11[0], p10[1]+p01[1]-p11[1]];
          drawTriangle(offCtx, im.img, sx, sy, sw, sh, vo, p10, p01, [p10, p11, p01]);
        }
      }
    } else {
      offCtx.drawImage(im.img, im.x, im.y, im.w, im.h);
    }
    offCtx.restore();
  }

  // Download
  const link = document.createElement('a');
  link.download = `拼接_${Date.now()}.png`;
  link.href = offCvs.toDataURL('image/png');
  link.click();
  toast('已导出 PNG');
}
