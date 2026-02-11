/**
 * Deform — 变形渲染
 * Triangle-based mesh deformation with bilinear interpolation
 */

/**
 * Interpolate a point on the deformed mesh
 */
export function interpolatePoint(corners, edgeMids, u, v, im) {
  const [tl, tr, br, bl] = corners;
  const [tm, rm, bm, lm] = edgeMids;

  // Default edge midpoints (without offset)
  const dtm = [(tl[0]+tr[0])/2, (tl[1]+tr[1])/2];
  const drm = [(tr[0]+br[0])/2, (tr[1]+br[1])/2];
  const dbm = [(br[0]+bl[0])/2, (br[1]+bl[1])/2];
  const dlm = [(bl[0]+tl[0])/2, (bl[1]+tl[1])/2];

  // Edge offsets
  const topOff = [tm[0]-dtm[0], tm[1]-dtm[1]];
  const rightOff = [rm[0]-drm[0], rm[1]-drm[1]];
  const bottomOff = [bm[0]-dbm[0], bm[1]-dbm[1]];
  const leftOff = [lm[0]-dlm[0], lm[1]-dlm[1]];

  // Bilinear from corners
  let x = tl[0]*(1-u)*(1-v) + tr[0]*u*(1-v) + br[0]*u*v + bl[0]*(1-u)*v;
  let y = tl[1]*(1-u)*(1-v) + tr[1]*u*(1-v) + br[1]*u*v + bl[1]*(1-u)*v;

  // Add edge warp
  const topW = (1-v) * 4*u*(1-u);
  const bottomW = v * 4*u*(1-u);
  const leftW = (1-u) * 4*v*(1-v);
  const rightW = u * 4*v*(1-v);

  x += topOff[0]*topW + bottomOff[0]*bottomW + leftOff[0]*leftW + rightOff[0]*rightW;
  y += topOff[1]*topW + bottomOff[1]*bottomW + leftOff[1]*leftW + rightOff[1]*rightW;

  return [x, y];
}

/**
 * Draw a single triangle of texture
 */
export function drawTriangle(ctx, img, sx, sy, sw, sh, p0, p1, p2, clipTri) {
  const t = ctx.getTransform();
  const tp = (x, y) => [t.a*x + t.c*y + t.e, t.b*x + t.d*y + t.f];
  const sp0 = tp(p0[0], p0[1]);
  const sp1 = tp(p1[0], p1[1]);
  const sp2 = tp(p2[0], p2[1]);

  const cv = clipTri ? clipTri.map(v => tp(v[0], v[1])) : [sp0, sp1, sp2];

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath();
  ctx.moveTo(cv[0][0], cv[0][1]);
  ctx.lineTo(cv[1][0], cv[1][1]);
  ctx.lineTo(cv[2][0], cv[2][1]);
  ctx.closePath();
  ctx.clip();

  const dx1 = sp1[0]-sp0[0], dy1 = sp1[1]-sp0[1];
  const dx2 = sp2[0]-sp0[0], dy2 = sp2[1]-sp0[1];
  ctx.setTransform(dx1, dy1, dx2, dy2, sp0[0], sp0[1]);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 1, 1);
  ctx.restore();
}

/**
 * Draw a deformed image using triangle mesh
 */
export function drawDeformedImage(ctx, im) {
  const corners = im.getCorners();
  const edgeMids = im.getEdgeMids();
  const DIVS = 12;

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

      // Triangle 1
      drawTriangle(ctx, im.img, sx, sy, sw, sh, p00, p10, p01);
      // Triangle 2
      const vo = [p10[0]+p01[0]-p11[0], p10[1]+p01[1]-p11[1]];
      drawTriangle(ctx, im.img, sx, sy, sw, sh, vo, p10, p01, [p10, p11, p01]);
    }
  }
}
