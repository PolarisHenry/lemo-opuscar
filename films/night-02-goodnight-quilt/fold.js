// 从书页折出纸星星（v3 纯矢量）：平纸 → 折角 → 立起 → 成星
// 三次对折 = 铰链矩形绕折痕旋转的干净几何；成星 = 包纸轮廓与五角星轮廓按弧长重采样补间
// 全部 Canvas 程序化绘制，不用任何网格贴图/裁剪贴图
import { cv, GRAIN } from './paper.js';

export const FOLD_PX = 512;                       // 画布边长（对应世界 0.132m）
const SHEET = '#fdf4e3', BACK = '#f1e5cc', EDGE = '#cf9a52', CREASE = '#c2a271', CREASE_2 = '#a8894f';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = v => Math.max(0, Math.min(1, v));
const eio = t => { t = clamp01(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

// 矩形多边形
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
// 五角星多边形（10 点）
function starPts(cx, cy, R, rot = -Math.PI / 2, inner = .44) {
  const p = [];
  for (let i = 0; i < 10; i++) { const a = rot + i / 10 * TAU, r = i % 2 ? R * inner : R; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return p;
}
// 按弧长等分重采样成 n 点（闭合）
function resample(pts, n) {
  const m = pts.length, seg = [], L = [];
  let tot = 0;
  for (let i = 0; i < m; i++) {
    const a = pts[i], b = pts[(i + 1) % m], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    seg.push([a, b, d]); tot += d; L.push(tot);
  }
  const out = [];
  for (let k = 0; k < n; k++) {
    const s = k / n * tot;
    let i = 0; while (i < m - 1 && L[i] < s) i++;
    const [a, b, d] = seg[i], u = d > 1e-6 ? (s - L[i] + d) / d : 0;
    out.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u)]);
  }
  return out;
}
function morphPath(a, A, B, t) {
  const n = 96, pa = resample(A, n), pb = resample(B, n);
  a.beginPath();
  for (let i = 0; i < n; i++) {
    const x = lerp(pa[i][0], pb[i][0], t), y = lerp(pa[i][1], pb[i][1], t);
    i ? a.lineTo(x, y) : a.moveTo(x, y);
  }
  a.closePath();
}
function poly(a, pts) { a.beginPath(); pts.forEach(([x, y], i) => i ? a.lineTo(x, y) : a.moveTo(x, y)); a.closePath(); }
// 投影：铰链在 at 的矩形，绕折痕旋转 th（0=平躺，π=完全翻到另一侧）
// 返回 [多边形, 抬起位移]；flipSign=-1 表示翻到负方向
function foldRect(x0, y0, x1, y1, axis, at, th, lift) {
  const c = Math.cos(th), sgn = axis === 'x' ? Math.sign(at - x0) : Math.sign(at - y0);
  const w = Math.abs((axis === 'x' ? x1 - x0 : y1 - y0)) * c;
  const liftPx = lift * Math.sin(th);
  if (axis === 'x') {
    const xa = at, xb = at - Math.sign(at - x0) * w;
    return { poly: rect(Math.min(xa, xb), y0 - liftPx * .5, Math.max(xa, xb), y1 - liftPx * .5), lift: liftPx };
  }
  const ya = at, yb = at - Math.sign(at - y0) * w;
  return { poly: rect(x0 - liftPx * .5, Math.min(ya, yb), x1 - liftPx * .5, Math.max(ya, yb)), lift: liftPx };
}
const paperFill = (a, fill, lw = 5, edge = EDGE) => { a.fillStyle = fill; a.fill(); a.lineWidth = lw; a.strokeStyle = edge; a.lineJoin = 'round'; a.stroke(); };

// cfg: { f1, f2, f3, pf, appear }
export function drawFold(a, cfg) {
  const { f1 = 0, f2 = 0, f3 = 0, pf = 0, appear = 1, lift = 0 } = cfg;
  a.setTransform(1, 0, 0, 1, 0, 0);
  a.clearRect(0, 0, FOLD_PX, FOLD_PX);
  if (appear <= 0.001) return;
  a.save();
  a.globalAlpha = appear;
  a.translate(FOLD_PX / 2, FOLD_PX / 2);
  a.rotate(-.06);                                  // 纸片与书页成一丁点角度，避免死板
  a.translate(-FOLD_PX / 2, -FOLD_PX / 2);
  const F = 158, C = FOLD_PX / 2;                  // 半边长 / 中心
  const L = C - F, R = C + F, T = C - F, B = C + F;
  // 全部折完后的包纸（左上象限→再对折一半）
  const H3 = C - F / 2;                            // 第三折的折痕 x
  const pk = rect(H3, T, C, C);                    // 79×158 的纸包

  // ---- 阴影（软） ----
  a.save();
  a.filter = 'blur(9px)'; a.fillStyle = 'rgba(70,48,22,.20)';
  const shp = pf > .02 ? starPts(C - F / 2, T + F / 2, 46) : pk;
  poly(a, shp.map(([x, y]) => [x + 7 + 22 * lift, y + 12 + 26 * lift])); a.fill();
  a.restore();

  // ---- 1. 底层：折 1 之后的左半张纸（折角阶段的高光面）----
  if (f1 < .999) {
    // 平纸：整张
    const th = f1 * Math.PI;
    // 基座（右半被折走后剩下的左半）
    a.save();
    poly(a, rect(L, T, C, B)); paperFill(a, SHEET, 5.5);
    a.restore();
    // 折片：右半绕 x=C 旋转
    const sgn = th < Math.PI / 2 ? 1 : -1;
    const wpx = F * Math.abs(Math.cos(th));
    const liftPx = 16 * Math.sin(th);
    const xa = C, xb = C + sgn * wpx;
    a.save();
    // 折起时略微垂直拉伸（纸片离页）
    const st = 1 + .05 * Math.sin(th);
    a.translate(C, C); a.scale(1, st); a.translate(-C, -C);
    poly(a, rect(Math.min(xa, xb), T - liftPx, Math.max(xa, xb), B - liftPx));
    paperFill(a, th < Math.PI / 2 ? SHEET : BACK, 5.5);
    a.restore();
  } else if (f2 < .999) {
    // ---- 2. 折角后：左半张（158×316），下缘绕 y=C 折上 ----
    poly(a, rect(L, T, C, C)); paperFill(a, SHEET, 5.5);
    const th = f2 * Math.PI;
    const sgn = th < Math.PI / 2 ? 1 : -1;
    const hpx = F * Math.abs(Math.cos(th));
    const liftPx = 16 * Math.sin(th);
    const ya = C, yb = C + sgn * hpx;
    a.save();
    const st = 1 + .05 * Math.sin(th);
    a.translate(C, C); a.scale(st, 1); a.translate(-C, -C);
    poly(a, rect(L - liftPx, Math.min(ya, yb), C - liftPx, Math.max(ya, yb)));
    paperFill(a, th < Math.PI / 2 ? SHEET : BACK, 5.5);
    a.restore();
  } else if (f3 < .999) {
    // ---- 3. 折两次后：158×158，左半绕 x=H3 折到右边 ----
    poly(a, rect(H3, T, C, C)); paperFill(a, SHEET, 5.5);
    const th = f3 * Math.PI;
    const sgn = th < Math.PI / 2 ? -1 : 1;
    const wpx = (C - H3) * Math.abs(Math.cos(th));
    const liftPx = 14 * Math.sin(th);
    const xa = H3, xb = H3 + sgn * wpx;
    a.save();
    const st = 1 + .05 * Math.sin(th);
    a.translate(H3, C); a.scale(1, st); a.translate(-H3, -C);
    poly(a, rect(Math.min(xa, xb), T - liftPx, Math.max(xa, xb), C - liftPx));
    paperFill(a, th < Math.PI / 2 ? SHEET : BACK, 5.5);
    a.restore();
  } else if (lift > .02 && pf < .02) {
    // ---- 3.5 立起：纸包离页（厚纸投影 + 上缘高光）----
    const dx = 16 * lift, dy = 26 * lift;
    poly(a, [[H3 + dx * .3, T + dy], [C + dx * .3, T + dy], [C, C], [H3, C]]);
    a.fillStyle = '#e6d7b6'; a.fill();
    poly(a, rect(H3, T + dy * .55, C, C)); paperFill(a, SHEET, 6);
    a.save(); a.globalAlpha = .5 * lift; a.strokeStyle = '#fffdf5'; a.lineWidth = 7;
    a.beginPath(); a.moveTo(H3 + 9, T + 6 + dy * .55); a.lineTo(C - 9, T + 6 + dy * .55); a.stroke(); a.restore();
    a.save(); a.globalAlpha = .25;
    a.lineWidth = 1.5; a.strokeStyle = '#c4b396';
    a.beginPath(); a.moveTo(H3, T + dy * .55 + 4); a.lineTo(H3, C); a.stroke(); a.restore();
  } else {
    // ---- 4. 纸包 → 星（轮廓补间）----
    const cx0 = (H3 + C) / 2, cy0 = (T + C) / 2, R0 = 46;
    const puff = 1 + .16 * Math.sin(Math.min(1, pf * 1.15) * Math.PI);
    const S = starPts(FOLD_PX / 2 - F / 2, FOLD_PX / 2 - F / 2, R0);
    a.save();
    a.translate(cx0, cy0); a.scale(puff, puff); a.translate(-cx0, -cy0);
    morphPath(a, pk, S, eio(pf));
    paperFill(a, SHEET, 6);
    a.restore();
  }
  // ---- 折痕：微弱纸张压痕（纯净纸张质感，去除黑褐色粗印痕） ----
  a.save();
  a.lineCap = 'round';
  const crease = (x1, y1, x2, y2, al = .25) => {
    // 纸张微凹阴影
    a.globalAlpha = al * appear * .4;
    a.lineWidth = 1.6; a.strokeStyle = '#c4b396';
    a.beginPath(); a.moveTo(x1, y1); a.lineTo(x2, y2); a.stroke();
    // 纸张微凸高光边
    a.globalAlpha = al * appear * .3;
    a.lineWidth = 1.0; a.strokeStyle = '#fffdf7';
    a.beginPath(); a.moveTo(x1 + .8, y1 + .8); a.lineTo(x2 + .8, y2 + .8); a.stroke();
  };
  if (f1 > .05 && f1 < .999) crease(C, T, C, B, .3);
  if (f1 >= .999 && f2 > .05) crease(L, C, C, C, .35);
  if (f2 >= .999 && f3 > .05) crease(H3, T, H3, C, .35);
  // 成星时：纸张自然折楞微高光（告别脏褐线）
  if (pf > .05) {
    const S = starPts(FOLD_PX / 2 - F / 2, FOLD_PX / 2 - F / 2, 46, -Math.PI / 2, .44);
    const cx0 = FOLD_PX / 2 - F / 2, cy0 = FOLD_PX / 2 - F / 2;
    a.globalAlpha = appear * clamp01(pf * 1.4) * .22;
    for (let i = 0; i < 5; i++) {
      const p = S[i * 2 + 1];
      a.lineWidth = 1.2; a.strokeStyle = '#fffdf5';
      a.beginPath(); a.moveTo(cx0, cy0); a.lineTo(lerp(p[0], cx0, .25), lerp(p[1], cy0, .25)); a.stroke();
    }
  }
  a.restore();
  a.restore();
  // 纸纹（整张叠一层，保持与其它纸片同一材质）
  a.save();
  a.globalCompositeOperation = 'source-atop';
  a.globalAlpha = .55 * appear;
  a.fillStyle = a.createPattern(GRAIN, 'repeat');
  a.fillRect(0, 0, FOLD_PX, FOLD_PX);
  a.restore();
}
