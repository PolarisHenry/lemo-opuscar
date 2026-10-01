// 所有纸片美术：角色（可逐帧重画的姿势）+ 场景道具 + 书页
import { mulberry, TAU, clamp, lerp } from './lib.js';
import { cv, finishCut, sh, blob, smoothClosed, smoothOpen, crescent, paperFill, INK, GRAIN, rr } from './paper.js';

const LW = 9;   // 主描边
const LW2 = 5;  // 细节线

// ============ 调色（夜灯配色：藏蓝/奶油白/暖琥珀） ============
export const CREAM = '#fdf4e3', CREAM_S = '#eddfc6';
export const NAVY = '#2e3d66', NAVY_S = '#232f52';
export const SCARF = '#f0a45a', SCARF_S = '#d9853d';
export const PINKC = '#f2b3ab', STAR_GOLD = '#f7c85c';
export const BROWN = '#8a5a32', BROWN_S = '#6a4222';

// ============ 团团 3.0（对齐定妆图）============
// 头为正圆；耳尖→脚底 = 2×头径（2头身）；左耳自中段折下耷拉、右耳竖立；
// 超大黑豆眼（每眼双高光）+ 粉腮 + 小椭圆鼻 + w 嘴；藏蓝星星睡衣（胸口线描大星）
// + 暖琥珀卷边围巾 + 奶油纸片鞋；厚奶油白描边（finishCut 21）
export const TT_W = 900, TT_H = 1560;
const TT_AY = 1500 / TT_H;              // 锚点：脚底（外扩白边后正好落在 1500）
const HC = [450, 720], HR = 371;        // 头心 / 头半径（头径 742 ≈ 身高一半）
const SOLE = 1482;                      // 脚底
const EYE_DX = 142, EYE_Y = 697, EYE_RX = 52, EYE_RY = 61;
const BLUSH = [218, 807, 47, 20], NOSE = [450, 719, 23, 15];
const BODY = [450, 1210, 236, 250];     // 睡衣蛋形（中心/半宽/半高）
const CREAM_D = '#eadcc0';              // 暗一档奶油（耳内/鞋卷边）
const STAR_GOLD_L = '#f0d9a0';          // 睡衣星点

// 圆头胶囊路径：两端圆弧分别朝 u / -u（修掉 v2 的“端头内凹缺口”）
function capsulePath(a, x0, y0, x1, y1, hw) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, px = -uy, py = ux;
  const aP = Math.atan2(py, px), aN = Math.atan2(-py, -px);
  const n = v => ((v % TAU) + TAU) % TAU;
  const cw = (from, to, mid) => n(mid - from) < n(to - from);   // mid 是否落在 from→to 的顺角扫描里
  a.beginPath();
  a.moveTo(x0 + px * hw, y0 + py * hw);
  a.lineTo(x1 + px * hw, y1 + py * hw);
  a.arc(x1, y1, hw, aP, aN, !cw(aP, aN, Math.atan2(uy, ux)));
  a.lineTo(x0 - px * hw, y0 - py * hw);
  a.arc(x0, y0, hw, aN, aP, !cw(aN, aP, Math.atan2(-uy, -ux)));
  a.closePath();
  return { ux, uy, px, py, len };
}
// 锥形纸片（折过去的耳尖：宽端→窄端，像一片叶子）
function taperPath(a, x0, y0, w0, x1, y1, w1) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, px = -uy, py = ux;
  const aP = Math.atan2(py, px), aN = Math.atan2(-py, -px);
  const n = v => ((v % TAU) + TAU) % TAU;
  const cw = (from, to, mid) => n(mid - from) < n(to - from);
  a.beginPath();
  a.moveTo(x0 + px * w0, y0 + py * w0);
  a.lineTo(x1 + px * w1, y1 + py * w1);
  a.arc(x1, y1, w1, aP, aN, !cw(aP, aN, Math.atan2(uy, ux)));
  a.lineTo(x0 - px * w0, y0 - py * w0);
  a.arc(x0, y0, w0, aN, aP, !cw(aN, aP, Math.atan2(-uy, -ux)));
  a.closePath();
}
// 耳片：胶囊 + 硬月牙阴影 + 墨线 + 耳内粉垫（朝内偏 .32hw，与定妆图一致）
function ttEarPiece(a, x0, y0, x1, y1, hw, o = {}) {
  const cap = () => capsulePath(a, x0, y0, x1, y1, hw);
  const g = cap();
  a.save(); // 硬月牙（外侧）
  crescent(a, cap, o.shade || CREAM_D, o.sdx ?? -26, o.sdy ?? 30, CREAM);
  a.restore();
  cap(); sh(a, null, LW);
  if (o.pink) {
    const k = o.padT ?? .34, sh2 = hw * .32;
    const cx = x1 + (x0 - x1) * k + g.px * sh2, cy = y1 + (y0 - y1) * k + g.py * sh2;
    a.save(); cap(); a.clip();
    a.beginPath(); a.ellipse(cx, cy, g.len * (o.padL ?? .36), hw * (o.padW ?? .60), Math.atan2(g.uy, g.ux), 0, TAU);
    a.fillStyle = o.pinkCol || '#f2b0a8'; a.fill();
    // 粉垫内再压一层更亮的粉（毛毡厚度）
    a.beginPath(); a.ellipse(cx - g.px * hw * .12, cy - g.py * hw * .12, g.len * (o.padL ?? .36) * .8, hw * (o.padW ?? .60) * .8, Math.atan2(g.uy, g.ux), 0, TAU);
    a.fillStyle = 'rgba(255,225,222,.42)'; a.fill();
    a.restore();
  }
  return g;
}
// 左耳：耳根在头后 → 上行到折点 → 折回左下耷拉（u=0 耷拉 … 1 竖起）
function ttEarLeft(a, u, wob) {
  const root = [386, 580], foldD = [348, 200], foldU = [356, 126];
  const tipD = [148, 392], upEnd = [334, 98];
  const fx = lerp(foldD[0], foldU[0], u), fy = lerp(foldD[1], foldU[1], u);
  const tx = lerp(tipD[0], fx, u * .92), ty = lerp(tipD[1], fy, u * .92);
  a.save(); a.translate(root[0], root[1]); a.rotate((wob || 0) + u * .06); a.translate(-root[0], -root[1]);
  if (u > .02) {   // 竖起：整只耳片（耳内粉可见）
    const ex = lerp(fx, upEnd[0], u), ey = lerp(fy, upEnd[1], u);
    ttEarPiece(a, root[0], root[1], ex, ey, 112 * (1 - .06 * u), { pink: u > .35 });
  } else {
    ttEarPiece(a, root[0], root[1], fx, fy, 102, { pink: true, padL: .40, padW: .64 });
  }
  // 折下的一段（耷拉时才有）：叶形（折点宽 → 耳尖窄），画在根段之上形成软折痕
  if (u < .98) {
    const w = 104 * (1 - u * .22);
    const leaf = () => taperPath(a, fx, fy, w, tx, ty, w * .54);
    crescent(a, leaf, CREAM_D, -20, 30, CREAM); leaf(); sh(a, null, LW2 + 3);
    // 折痕：折点处一道暗一档线
    a.save(); a.translate(fx, fy); a.rotate(Math.atan2(ty - fy, tx - fx) + Math.PI / 2);
    a.beginPath(); a.moveTo(-w * .78, -8); a.lineTo(w * .78, -8);
    a.lineWidth = LW2; a.strokeStyle = 'rgba(196,176,138,.42)'; a.lineCap = 'round'; a.stroke(); a.restore();
  }
  a.restore();
}
// 右耳竖起（耳长≈0.5 头高可见段，圆头不缺口）
function ttEarRight(a, u, wob) {
  const bx = 617, by = 578;
  const dx = 14 + 16 * u, dy = -(383 + 40 * u);
  a.save(); a.translate(bx, by); a.rotate(wob || 0); a.translate(-bx, -by);
  ttEarPiece(a, bx, by, bx + dx, by + dy, 115, { pink: true, padT: .31, padL: .40, padW: .64 });
  a.restore();
}
// 超大黑豆眼：竖椭圆（宽 .13 头径）+ 两个高光点
function ttEye(a, ex, ey, p) {
  const { blink = 0, eyes = 'open', look = [0, 0] } = p;
  const cx = ex + look[0] * 14, cy = ey + look[1] * 15;
  const lw = LW2 + 3;
  if (eyes === 'happy') { a.beginPath(); a.moveTo(cx - 34, cy + 12); a.quadraticCurveTo(cx, cy - 40, cx + 34, cy + 12); a.lineWidth = lw + 5; a.strokeStyle = INK; a.lineCap = 'round'; a.stroke(); return; }
  if (eyes === 'closed' || blink > .85) { a.beginPath(); a.moveTo(cx - 28, cy + 2); a.quadraticCurveTo(cx, cy + 18, cx + 28, cy + 2); a.lineWidth = lw + 3; a.strokeStyle = INK; a.lineCap = 'round'; a.stroke(); return; }
  if (eyes === 'sleepy') { a.beginPath(); a.ellipse(cx, cy + 6, 32, 24 * (1 - blink * .5), 0, -.3, Math.PI + .3); a.lineWidth = lw + 3; a.strokeStyle = INK; a.lineCap = 'round'; a.stroke(); return; }
  const big = eyes === 'wide' ? 1.1 : 1;
  const rx = EYE_RX * big, ry = EYE_RY * big * (1 - blink * .9);
  if (ry < 9) { a.beginPath(); a.moveTo(cx - rx, cy); a.lineTo(cx + rx, cy); a.lineWidth = lw + 2; a.strokeStyle = INK; a.lineCap = 'round'; a.stroke(); return; }
  a.beginPath(); a.ellipse(cx, cy, rx, ry, 0, 0, TAU); a.fillStyle = INK; a.fill();
  if (ry > 18) {
    // 高光 1：偏上的大白点（定妆图：几乎居中、略高）
    a.beginPath(); a.ellipse(cx + rx * .06, cy - ry * .44, 14 * big, 15.5 * big, -.2, 0, TAU); a.fillStyle = '#fff'; a.fill();
    // 高光 2：右下小豆点
    a.beginPath(); a.ellipse(cx + rx * .52, cy + ry * .40, 6.2, 7.2, .3, 0, TAU); a.fillStyle = 'rgba(255,255,255,.92)'; a.fill();
  }
}
// 手臂：藏蓝袖（画在身体之下，内缝被身体盖住）+ 奶油 mitten 掌（画在身体之上）
const ARM = { sh: [318, 1024], rot: 0.52, len: 176, hw: 58, pawY: 276 };
function armRot(ang, side) { return (ARM.rot + ang) * side; }
function ttSleeve(a, side, ang, shx) {
  const rot = armRot(ang, side);
  a.save(); a.translate(shx, ARM.sh[1]); a.rotate(rot);
  const cap = () => capsulePath(a, 0, -14, 0, ARM.len, ARM.hw);
  crescent(a, cap, NAVY_S, -16, -10, NAVY); cap(); sh(a, null, LW2 + 1);
  a.restore();
}
function ttPaw(a, side, ang, shx, holdStar) {
  const rot = armRot(ang, side);
  a.save(); a.translate(shx, ARM.sh[1]); a.rotate(rot);
  const paw = () => { a.beginPath(); a.ellipse(0, ARM.pawY, 56, 100, 0, 0, TAU); };
  crescent(a, paw, CREAM_D, -14, 24, CREAM); paw(); sh(a, null, LW2 + 1);
  a.beginPath(); a.arc(-40, ARM.pawY + 30, 28, -1.0, 1.05); a.lineWidth = LW2; a.strokeStyle = CREAM_D; a.lineCap = 'round'; a.stroke();
  a.beginPath(); a.ellipse(0, ARM.pawY - 62, 42, 15, 0, Math.PI * 1.06, Math.PI * 1.94); a.lineWidth = LW2; a.strokeStyle = CREAM_D; a.stroke();
  if (holdStar) { a.save(); a.translate(0, ARM.pawY); a.fillStyle = STAR_GOLD; a.beginPath(); for (let i = 0; i < 5; i++) { const t = -Math.PI / 2 + i / 5 * TAU, t2 = t + TAU / 10; a.lineTo(Math.cos(t) * 17, Math.sin(t) * 17); a.lineTo(Math.cos(t2) * 7.5, Math.sin(t2) * 7.5); } a.closePath(); a.fill(); a.restore(); }
  a.restore();
}
function starDot(a, x, y, r, col = STAR_GOLD_L) {
  a.beginPath();
  for (let i = 0; i < 8; i++) { const t = i / 8 * TAU - Math.PI / 2, rr2 = i % 2 ? r * .38 : r; a.lineTo(x + Math.cos(t) * rr2, y + Math.sin(t) * rr2); }
  a.closePath(); a.fillStyle = col; a.fill();
}
// 睡衣小星点（淡金散点，避开胸口大星与中缝）
const TT_STARS = [[-172, -122, 12], [-104, -196, 9], [-14, -212, 11], [96, -190, 9], [176, -104, 11],
[-196, -34, 9], [192, -22, 9], [-186, 66, 11], [186, 78, 9], [-140, 128, 9], [140, 132, 11],
[-92, -60, 7], [92, -56, 7], [-58, 92, 7], [64, 96, 7], [8, -120, 8]];
// 胸口线描大星（定妆图的“胎记”）：扁平五角星，只有描线不填充
function chestStar(a) {
  const cx = 450, cy = 1190, R = 118, sy = .70;
  const P = k => { const t = -Math.PI / 2 + k / 10 * TAU, r = (k % 2 ? .42 : 1) * R; return [cx + Math.cos(t) * r, cy + Math.sin(t) * r * sy]; };
  const path = () => { a.beginPath(); for (let k = 0; k < 10; k++) { const [x, y] = P(k); k ? a.lineTo(x, y) : a.moveTo(x, y); } a.closePath(); };
  a.save(); path();
  a.lineWidth = 7; a.lineJoin = 'round'; a.strokeStyle = 'rgba(126,92,44,.40)'; a.stroke();
  a.lineWidth = 4; a.strokeStyle = '#eccf96'; a.stroke();
  a.lineWidth = 1.6; a.strokeStyle = 'rgba(255,246,220,.8)'; a.stroke();
  a.restore();
}
// 围巾：暖琥珀厚卷领（画在头之前的位置之上，压住下巴 → 与定妆图一致）
const SCARF_IN = [166, 898, 450, 932, 734, 898];
const SCARF_OUT = [206, 1000, 450, 1052, 694, 1000];
function collarPath(a) {
  a.beginPath(); a.moveTo(SCARF_IN[0], SCARF_IN[1]);
  a.quadraticCurveTo(SCARF_IN[2], SCARF_IN[3], SCARF_IN[4], SCARF_IN[5]);
  a.quadraticCurveTo(SCARF_OUT[4], SCARF_OUT[5] - 26, SCARF_OUT[4], SCARF_OUT[5]);
  a.quadraticCurveTo(SCARF_OUT[2], SCARF_OUT[3], SCARF_OUT[0], SCARF_OUT[1]);
  a.quadraticCurveTo(SCARF_IN[0] + 14, SCARF_IN[1] + 34, SCARF_IN[0], SCARF_IN[1]);
  a.closePath();
}
function ttScarf(a, flap) {
  crescent(a, () => collarPath(a), SCARF_S, 0, 24, SCARF); collarPath(a);
  a.save(); a.lineJoin = 'round'; a.lineWidth = 8; a.strokeStyle = '#b8762f'; a.stroke();
  a.lineWidth = 3; a.strokeStyle = 'rgba(255,216,164,.45)'; a.stroke(); a.restore();
  // 上缘亮卷边（贴着顶边的一道圆滚）
  a.beginPath(); a.moveTo(SCARF_IN[0] + 24, SCARF_IN[1] + 12);
  a.quadraticCurveTo(SCARF_IN[2], SCARF_IN[3] + 26, SCARF_IN[4] - 24, SCARF_IN[5] + 12);
  a.lineWidth = 30; a.strokeStyle = 'rgba(255,210,150,.26)'; a.lineCap = 'round'; a.stroke();
  // 卷折暗线（领口内的一道软折）
  a.beginPath(); a.moveTo(232, 940); a.quadraticCurveTo(452, 1000 + flap * 6, 668, 940);
  a.lineWidth = LW2; a.strokeStyle = 'rgba(180,104,40,.38)'; a.stroke();
  // 左端垂下来的卷尾（定妆图：领口左前方一截圆头卷边）
  a.save(); a.translate(196, 946); a.rotate(.46 + flap * .22);
  const roll = () => capsulePath(a, 0, 0, 0, 138, 31);
  crescent(a, roll, SCARF_S, -10, 10, SCARF); roll(); a.lineWidth = 6; a.strokeStyle = '#b8762f'; a.lineJoin = 'round'; a.stroke();
  a.restore();
  // 琥珀领扣
  a.beginPath(); a.arc(448, 1030, 23, 0, TAU); sh(a, SCARF, LW2 - 1, '#b8762f');
  a.beginPath(); a.arc(441, 1023, 7, 0, TAU); a.fillStyle = 'rgba(255,246,224,.85)'; a.fill();
}
// 两条腿之间露出的奶油纸边
function legGap(a) {
  a.save();
  a.beginPath(); a.moveTo(448, 1292); a.quadraticCurveTo(462, 1352, 476, 1448); a.lineTo(424, 1448); a.quadraticCurveTo(438, 1352, 448, 1292); a.closePath();
  a.fillStyle = '#eee3cb'; a.fill(); a.restore();
}
// 奶油纸片鞋（圆头 + 卷边）
function ttFeet(a, walk, stride, s) {
  for (const [sx, ph] of [[-1, 0], [1, 1]]) {
    const ph2 = walk + ph * Math.PI, lift = Math.max(0, -(sx) * Math.sin(ph2)) * 14 * stride;
    const fx = 450 + sx * 180 + Math.sin(ph2) * 16 * stride, fy = SOLE - 46 - lift;
    const foot = () => { a.beginPath(); a.ellipse(fx, fy, 114, 47, sx * .05 * s, 0, TAU); };
    crescent(a, foot, CREAM_D, -16, 20, CREAM); foot(); sh(a, null, LW);
    a.beginPath(); a.ellipse(fx, fy - 24, 92, 21, 0, Math.PI * 1.06, Math.PI * 1.94);
    a.lineWidth = LW2; a.strokeStyle = CREAM_D; a.lineCap = 'round'; a.stroke();
  }
}
// 睡衣轮廓：胖梨形（肩宽、下摆圆，定妆图量得 468×~470）
function bodyPts() {
  const R = [[66, 954], [186, 970], [242, 1012], [252, 1090], [250, 1210], [232, 1322], [168, 1414], [66, 1450], [0, 1454],
  [-66, 1450], [-168, 1414], [-232, 1322], [-250, 1210], [-252, 1090], [-242, 1012], [-186, 970], [-66, 954]];
  return R.map(([dx, y]) => [BODY[0] + dx, y]);
}
function ttBody(a, back) {
  const body = () => { a.beginPath(); smoothClosed(a, bodyPts()); };
  crescent(a, body, NAVY_S, back ? -20 : 20, 30, NAVY); body(); sh(a, null, LW);
  for (const [dx, dy, r] of TT_STARS) starDot(a, BODY[0] + dx, BODY[1] + dy, r);
  if (!back) chestStar(a);
}
// 正圆头
function ttHead(a, back) {
  const head = () => { blob(a, HC[0], HC[1], HR, HR, .008, 21); };
  crescent(a, head, CREAM_D, back ? 30 : -30, 34, CREAM); head(); sh(a, null, LW);
}
// p: {walk, stride, armL, armR, ears(0耷拉..1都竖), eyes, mouth, look, blink, lean, flap, hold}
export function drawTuanTuan(x, p = {}) {
  const { walk = 0, stride = 0, armL = .25, armR = .25, ears = 0, mouth = 'smile', lean = 0, flap = 0, hold = 0 } = p;
  x.clearRect(0, 0, TT_W, TT_H);
  const W = cv(TT_W, TT_H), a = W.getContext('2d');
  a.save(); a.translate(450, SOLE); a.rotate(lean); a.translate(-450, -SOLE);
  const s = Math.sin(walk) * stride;

  // ---- 耳朵（在头之后被头压住耳根）----
  ttEarLeft(a, ears, Math.sin(walk * 2) * .05);
  ttEarRight(a, .92 + ears * .08, Math.sin(walk * 2 + 1) * .035);
  // ---- 头 ----
  ttHead(a, false);
  // ---- 脸 ----
  for (const sx of [-1, 1]) { a.beginPath(); a.ellipse(HC[0] + sx * BLUSH[0], BLUSH[1], BLUSH[2], BLUSH[3], 0, 0, TAU); a.fillStyle = 'rgba(242,146,140,.50)'; a.fill(); }
  ttEye(a, HC[0] - EYE_DX, EYE_Y, p); ttEye(a, HC[0] + EYE_DX, EYE_Y, p);
  const nose = () => { a.beginPath(); a.ellipse(NOSE[0], NOSE[1], NOSE[2], NOSE[3], 0, 0, TAU); };
  nose(); sh(a, '#ef9d96', LW2);
  a.beginPath(); a.ellipse(NOSE[0] - 6, NOSE[1] - 4, 8, 5, -.2, 0, TAU); a.fillStyle = 'rgba(255,240,238,.7)'; a.fill();
  // 嘴：人中 + w
  const mx = NOSE[0], my = NOSE[1] + 16;
  a.lineCap = 'round'; a.strokeStyle = INK;
  a.beginPath(); a.moveTo(mx, NOSE[1] + NOSE[3] - 2); a.lineTo(mx, my + 12); a.lineWidth = 6; a.stroke();
  const W2 = 38, dip = 15;
  if (mouth === 'smile') {
    a.beginPath(); a.moveTo(mx - W2, my + 6); a.quadraticCurveTo(mx - W2 * .5, my + 6 + dip, mx, my + 12);
    a.quadraticCurveTo(mx + W2 * .5, my + 6 + dip, mx + W2, my + 6); a.lineWidth = 8; a.stroke();
  } else if (mouth === 'open') {
    a.beginPath(); a.moveTo(mx - 34, my + 4); a.quadraticCurveTo(mx, my + 54, mx + 34, my + 4); a.closePath(); sh(a, '#8a4a3a', 6);
  } else if (mouth === 'o') {
    a.beginPath(); a.ellipse(mx, my + 16, 15, 19, 0, 0, TAU); sh(a, '#8a4a3a', 6);
  } else if (mouth === 'grin') {
    a.beginPath(); a.moveTo(mx - 40, my); a.quadraticCurveTo(mx, my + 56, mx + 40, my); a.closePath(); sh(a, '#8a4a3a', 6);
  } else if (mouth === 'worried') {
    a.beginPath(); a.moveTo(mx - 34, my + 18); a.bezierCurveTo(mx - 16, my + 2, mx - 4, my + 22, mx + 8, my + 10);
    a.quadraticCurveTo(mx + 20, my + 1, mx + 34, my + 16); a.lineWidth = 7; a.stroke();
  } else {
    a.beginPath(); a.moveTo(mx - 26, my + 12); a.lineTo(mx + 26, my + 10); a.lineWidth = 8; a.stroke();
  }
  // ---- 身体（画在头之后：藏蓝压住下巴，与定妆图同构）----
  ttSleeve(a, 1, armL, 318); ttSleeve(a, -1, armR, 582);
  ttBody(a, false);
  legGap(a);
  ttFeet(a, walk, stride, s);
  ttPaw(a, 1, armL, 318, 0);
  ttPaw(a, -1, armR, 582, hold);
  // ---- 围巾（最前层）----
  ttScarf(a, flap);
  a.restore();
  x.drawImage(finishCut(W, 24, { grainA: .7 }), 0, 0);
}
// 背影（结尾坐木桩看星空；背面视角左右镜像：耷拉耳在画面右侧）
export function drawTuanTuanBack(x, p = {}) {
  const { walk = 0, stride = 0, armL = .25, armR = .25, ears = 0, lean = 0, flap = 0 } = p;
  x.clearRect(0, 0, TT_W, TT_H);
  const W = cv(TT_W, TT_H), a = W.getContext('2d');
  a.save(); a.translate(450, SOLE); a.rotate(lean); a.translate(-450, -SOLE);
  const s = Math.sin(walk) * stride;
  a.save(); a.translate(900, 0); a.scale(-1, 1);
  ttEarLeft(a, ears, 0); ttEarRight(a, .92 + ears * .08, 0);
  a.restore();
  ttHead(a, true);
  ttBody(a, true);
  legGap(a);
  ttFeet(a, walk, stride, s);
  // 尾巴绒球（奶油）
  const tail = () => { a.beginPath(); a.arc(450, 1302, 44, 0, TAU); };
  crescent(a, tail, CREAM_D, -12, 16, CREAM); tail(); sh(a, null, LW2 + 1);
  ttSleeve(a, 1, armL, 318); ttSleeve(a, -1, armR, 582);
  ttPaw(a, 1, armL, 318, 0); ttPaw(a, -1, armR, 582, 0);
  // 围巾背面（垂尾在画面右侧）
  crescent(a, () => collarPath(a), SCARF_S, 0, 26, SCARF); collarPath(a);
  a.lineWidth = 7; a.lineJoin = 'round'; a.strokeStyle = '#b8762f'; a.stroke();
  a.beginPath(); a.moveTo(224, 934); a.quadraticCurveTo(450, 998, 676, 934);
  a.lineWidth = 26; a.strokeStyle = 'rgba(255,210,150,.28)'; a.lineCap = 'round'; a.stroke();
  a.save(); a.translate(568, 1006); a.rotate(-.4); rr(a, -24, 0, 48, 120, 22); sh(a, SCARF, LW2 + 1); a.restore();
  a.restore();
  x.drawImage(finishCut(W, 24, { grainA: .7 }), 0, 0);
}

// ============ 扎扎 2.0（棕圆球刺猬：圆头软纸刺、小豆眼，与团团同风格软化） ============
export const ZZ_W = 860, ZZ_H = 840;
// 圆头软纸刺：宽胖花瓣形，末端圆头不尖
function zzSpike(a, bx, by, tx, ty, shade, col) {
  const ang = Math.atan2(ty - by, tx - bx), nx = Math.cos(ang + Math.PI / 2), ny = Math.sin(ang + Math.PI / 2);
  const bw = 52, tipR = 26;
  const p = () => {
    a.beginPath();
    a.moveTo(bx + nx * bw, by + ny * bw);
    a.quadraticCurveTo(bx + (tx - bx) * .5 + nx * (bw * .8), by + (ty - by) * .5 + ny * (bw * .8), tx + nx * tipR, ty + ny * tipR);
    a.arc(tx, ty, tipR, ang + Math.PI / 2, ang - Math.PI / 2, true);
    a.quadraticCurveTo(bx + (tx - bx) * .5 - nx * (bw * .8), by + (ty - by) * .5 - ny * (bw * .8), bx - nx * bw, by - ny * bw);
    a.closePath();
  };
  crescent(a, p, shade, 6, 8, col); p(); sh(a, null, LW2 + 1);
}
export function drawZaza(x, p = {}) {
  const { mood = 'scared', blink = 0, look = [0, 0] } = p;
  x.clearRect(0, 0, ZZ_W, ZZ_H);
  const W = cv(ZZ_W, ZZ_H), a = W.getContext('2d');
  const C = [430, 470];
  // 外两圈圆头软刺（花瓣形，圆头不尖、更疏更软）
  const R0 = mulberry(31);
  for (let ring = 0; ring < 2; ring++) {
    const n = ring ? 6 : 9, rr2 = ring ? 250 : 306, col = ring ? '#7d4e28' : '#6f4523';
    for (let i = 0; i < n; i++) {
      const t = -Math.PI * .9 + (i + (ring ? .5 : 0)) / n * Math.PI * 1.8 + (R0() - .5) * .05;
      const bx = C[0] + Math.cos(t) * (rr2 - 80), by = C[1] + Math.sin(t) * (rr2 - 80);
      const tx = C[0] + Math.cos(t) * rr2, ty = C[1] + Math.sin(t) * rr2;
      zzSpike(a, bx, by, tx, ty, '#5e3a1c', col);
    }
  }
  // 身体球（棕圆球，暖化一档）
  const body = () => { blob(a, C[0], C[1], 298, 284, .028, 41); };
  crescent(a, body, '#6e4423', 22, 28, '#936640'); body(); sh(a, null, LW);
  // 小刺根点（更轻更软）
  const R1 = mulberry(17); a.fillStyle = 'rgba(122,84,48,.32)';
  for (let i = 0; i < 20; i++) { const t = -Math.PI * .9 + R1() * Math.PI * 1.8, r = 205 + R1() * 55; a.beginPath(); a.arc(C[0] + Math.cos(t) * r, C[1] + Math.sin(t) * r, 5 + R1() * 4, 0, TAU); a.fill(); }
  // 脸（奶油色大 patch，下半前侧）
  const face = () => { blob(a, C[0], C[1] + 110, 192, 158, .035, 51); };
  crescent(a, face, '#e2cea8', 16, 18, '#f6e8cc'); face(); sh(a, null, LW);
  // 小豆眼（配角缩小一号，单高光点）
  a.lineCap = 'round'; a.strokeStyle = INK;
  for (const dx of [-80, 80]) {
    const ex = C[0] + dx, ey = C[1] + 72;
    if (mood === 'happy') { a.beginPath(); a.moveTo(ex - 24, ey + 4); a.quadraticCurveTo(ex, ey - 32, ex + 24, ey + 4); a.lineWidth = 10; a.stroke(); }
    else if (mood === 'sorry') { a.beginPath(); a.moveTo(ex - 22, ey - 8); a.quadraticCurveTo(ex, ey + 10, ex + 22, ey - 8); a.lineWidth = 10; a.stroke(); }
    else {
      const ry = 21 * (1 - blink * .9);
      a.beginPath(); a.ellipse(ex + look[0] * 8, ey + look[1] * 8, 16.5, ry, 0, 0, TAU); a.fillStyle = INK; a.fill();
      if (ry > 7) { a.beginPath(); a.arc(ex + look[0] * 8 - 5, ey + look[1] * 8 - ry * .34, 4.8, 0, TAU); a.fillStyle = '#fff'; a.fill(); }
      if (mood === 'scared') { a.beginPath(); a.moveTo(ex - 24, ey - 34); a.lineTo(ex - 9, ey - 42); a.moveTo(ex + 24, ey - 34); a.lineTo(ex + 9, ey - 42); a.lineWidth = 8; a.stroke(); }
    }
  }
  // 鼻子 + 嘴 + 腮红（小一号，与团团同一套表情语言）
  a.beginPath(); a.ellipse(C[0], C[1] + 126, 17, 12.5, 0, 0, TAU); sh(a, '#4a3226', LW2 - 1);
  if (mood === 'sorry') { a.beginPath(); a.moveTo(C[0] - 20, C[1] + 164); a.quadraticCurveTo(C[0], C[1] + 150, C[0] + 20, C[1] + 164); a.lineWidth = 7; a.stroke(); }
  else if (mood === 'happy') { a.beginPath(); a.moveTo(C[0] - 22, C[1] + 156); a.quadraticCurveTo(C[0], C[1] + 180, C[0] + 22, C[1] + 156); a.lineWidth = 7; a.stroke(); }
  else { a.beginPath(); a.ellipse(C[0], C[1] + 162, 10, 13, 0, 0, TAU); sh(a, '#6a4034', 5); }
  a.beginPath(); a.ellipse(C[0] - 136, C[1] + 142, 26, 16, 0, 0, TAU); a.fillStyle = 'rgba(240,138,128,.36)'; a.fill();
  a.beginPath(); a.ellipse(C[0] + 136, C[1] + 142, 26, 16, 0, 0, TAU); a.fill();
  if (mood === 'sorry') { a.beginPath(); a.moveTo(C[0] + 80, C[1] + 108); a.quadraticCurveTo(C[0] + 86, C[1] + 128, C[0] + 78, C[1] + 136); a.lineWidth = 6; a.strokeStyle = '#9cc4de'; a.stroke(); }
  // 抱瓶的小圆前爪（瓶子是 3D，画在两爪之间）
  a.beginPath(); a.ellipse(C[0] - 62, C[1] + 236, 44, 33, .5, 0, TAU); sh(a, '#8a5c33', LW2 + 1);
  a.beginPath(); a.ellipse(C[0] + 62, C[1] + 236, 44, 33, -.5, 0, TAU); sh(a, '#8a5c33', LW2 + 1);
  a.beginPath(); a.ellipse(C[0] - 66, C[1] + 226, 15, 10.5, .5, 0, TAU); a.fillStyle = '#e8c9a4'; a.fill();
  a.beginPath(); a.ellipse(C[0] + 66, C[1] + 226, 15, 10.5, -.5, 0, TAU); a.fillStyle = '#e8c9a4'; a.fill();
  // 脚
  a.beginPath(); a.ellipse(C[0] - 108, C[1] + 292, 50, 31, .2, 0, TAU); sh(a, '#8a5c33', LW2 + 1);
  a.beginPath(); a.ellipse(C[0] + 108, C[1] + 292, 50, 31, -.2, 0, TAU); sh(a, '#8a5c33', LW2 + 1);
  x.drawImage(finishCut(W, 16, { grainA: .65 }), 0, 0);
}

// ============ 失眠小动物（钩子页：满屏黑眼圈） ============
export function owl(wm) {
  return cut(wm, wm * 1.02, (x, W, H) => {
    const cx = W / 2, cy = H * .52, r = W * .34;
    // 翅膀惊起
    for (const s of [-1, 1]) { x.save(); x.translate(cx + s * r * .78, cy + r * .18); x.rotate(s * .7); x.beginPath(); x.ellipse(0, 0, r * .38, r * .62, 0, 0, TAU); sh(x, '#a8916f', LW2 + 1); x.restore(); }
    const body = () => { blob(x, cx, cy, r, r * 1.02, .03, 61); };
    crescent(x, body, '#a8916f', 16, 22, '#c8b493'); body(); sh(x, null, LW);
    // 耳羽
    x.beginPath(); x.moveTo(cx - r * .55, cy - r * .78); x.lineTo(cx - r * .68, cy - r * 1.1); x.lineTo(cx - r * .3, cy - r * .86); x.closePath(); sh(x, '#b5a07e', LW2 + 1);
    x.beginPath(); x.moveTo(cx + r * .55, cy - r * .78); x.lineTo(cx + r * .68, cy - r * 1.1); x.lineTo(cx + r * .3, cy - r * .86); x.closePath(); sh(x, '#b5a07e', LW2 + 1);
    // 大眼圈 + 黑眼圈（熬夜袋）
    for (const s of [-1, 1]) {
      const ex = cx + s * r * .38, ey = cy - r * .12;
      x.beginPath(); x.arc(ex, ey, r * .3, 0, TAU); sh(x, '#f5ecd8', LW2 + 1);
      x.beginPath(); x.arc(ex, ey, r * .13, 0, TAU); x.fillStyle = INK; x.fill();
      x.beginPath(); x.arc(ex - r * .04, ey - r * .05, r * .04, 0, TAU); x.fillStyle = '#fff'; x.fill();
      // 眼袋月牙
      crescent(x, () => { x.beginPath(); x.arc(ex, ey + r * .18, r * .3, .15 * Math.PI, .85 * Math.PI); x.closePath(); }, 'rgba(120,96,72,.55)', 0, -r * .07, 'rgba(160,128,98,.5)');
    }
    x.beginPath(); x.moveTo(cx, cy + r * .1); x.lineTo(cx - r * .1, cy + r * .26); x.lineTo(cx + r * .1, cy + r * .26); x.closePath(); sh(x, '#e8a83a', 4);
    x.beginPath(); x.moveTo(cx - r * .3, cy + r * .48); x.quadraticCurveTo(cx, cy + r * .3, cx + r * .3, cy + r * .48); x.lineWidth = LW2; x.strokeStyle = INK; x.stroke();
    // 爪
    x.strokeStyle = '#e8a83a'; x.lineWidth = LW2 + 1;
    x.beginPath(); x.moveTo(cx - r * .3, cy + r * .95); x.lineTo(cx - r * .34, H - 4); x.moveTo(cx + r * .3, cy + r * .95); x.lineTo(cx + r * .34, H - 4); x.stroke();
  }, { ay: 1 });
}
export function mousey(wm) {
  return cut(wm, wm * .88, (x, W, H) => {
    const cx = W / 2, cy = H * .6, r = W * .3;
    for (const s of [-1, 1]) { x.beginPath(); x.arc(cx + s * r * .62, cy - r * .92, r * .34, 0, TAU); sh(x, '#b9c0d2', LW2); x.beginPath(); x.arc(cx + s * r * .62, cy - r * .92, r * .18, 0, TAU); x.fillStyle = '#e8b7bd'; x.fill(); }
    const body = () => { blob(x, cx, cy, r, r * .92, .04, 71); };
    crescent(x, body, '#848ca0', 14, 18, '#9aa3b8'); body(); sh(x, null, LW);
    for (const s of [-1, 1]) {
      const ex = cx + s * r * .34, ey = cy - r * .1;
      x.beginPath(); x.ellipse(ex, ey, r * .1, r * .13, 0, 0, TAU); x.fillStyle = INK; x.fill();
      crescent(x, () => { x.beginPath(); x.arc(ex, ey + r * .16, r * .24, .12 * Math.PI, .88 * Math.PI); x.closePath(); }, 'rgba(110,118,140,.5)', 0, -r * .06, 'rgba(140,148,168,.45)');
    }
    x.beginPath(); x.arc(cx, cy + r * .14, r * .09, 0, TAU); sh(x, '#e8a0aa', 4);
    x.beginPath(); x.moveTo(cx - r * .22, cy + r * .3); x.quadraticCurveTo(cx, cy + r * .42, cx + r * .22, cy + r * .3); x.lineWidth = LW2 - 1; x.strokeStyle = INK; x.stroke();
    x.strokeStyle = INK; x.lineWidth = 3;
    for (const s of [-1, 1]) for (let k = 0; k < 2; k++) { x.beginPath(); x.moveTo(cx + s * r * .5, cy + r * .08 + k * 10); x.lineTo(cx + s * r * .95, cy + r * .02 + k * 14); x.stroke(); }
  }, { ay: 1 });
}
export function birdy(wm) {
  return cut(wm, wm * .95, (x, W, H) => {
    const cx = W / 2, cy = H * .58, r = W * .3;
    x.strokeStyle = '#c9973f'; x.lineWidth = LW2 + 1;
    x.beginPath(); x.moveTo(cx - r * .25, cy + r * .8); x.lineTo(cx - r * .3, H - 4); x.moveTo(cx + r * .25, cy + r * .8); x.lineTo(cx + r * .3, H - 4); x.stroke();
    const body = () => { blob(x, cx, cy, r, r * .88, .04, 81); };
    crescent(x, body, '#caa258', 14, 18, '#e8c27a'); body(); sh(x, null, LW);
    // 炸毛的头羽
    x.strokeStyle = '#caa258'; x.lineWidth = LW2 + 1; x.lineCap = 'round';
    for (const [dx, dy] of [[-.2, -.95], [0, -1.05], [.2, -.95]]) { x.beginPath(); x.moveTo(cx + dx * r, cy - r * .7); x.lineTo(cx + dx * r * 1.5, cy + dy * r); x.stroke(); }
    for (const s of [-1, 1]) {
      const ex = cx + s * r * .32, ey = cy - r * .16;
      x.beginPath(); x.ellipse(ex, ey, r * .11, r * .14, 0, 0, TAU); x.fillStyle = INK; x.fill();
      crescent(x, () => { x.beginPath(); x.arc(ex, ey + r * .17, r * .23, .12 * Math.PI, .88 * Math.PI); x.closePath(); }, 'rgba(170,130,70,.5)', 0, -r * .06, 'rgba(200,160,95,.45)');
    }
    x.beginPath(); x.moveTo(cx + r * .02, cy + r * .04); x.lineTo(cx + r * .3, cy + r * .14); x.lineTo(cx + r * .02, cy + r * .24); x.closePath(); sh(x, '#e8943a', 4);
  }, { ay: 1 });
}

// ============ 月亮婆婆（银白剪纸弯月，眯眯眼+云朵披肩+星杖） ============
export function moonGrandma(wm) {
  return cut(wm, wm * 1.05, (x, W, H) => {
    const cx = W * .46, cy = H * .46, r = W * .38;
    const cres = () => { x.beginPath(); x.arc(cx, cy, r, Math.PI * .42, Math.PI * 1.58, false); x.bezierCurveTo(cx + r * .18, cy - r * .5, cx + r * .18, cy + r * .5, cx + Math.cos(Math.PI * .42) * r, cy + Math.sin(Math.PI * .42) * r); x.closePath(); };
    crescent(x, cres, '#c9d4e8', 10, 12, '#eef2fa'); cres(); sh(x, null, LW);
    // 眯眯眼 + 微笑
    x.strokeStyle = '#6a7896'; x.lineCap = 'round'; x.lineWidth = 8;
    for (const s of [-1, 1]) { const ex = cx - r * .02 + s * r * .2, ey = cy - r * .14; x.beginPath(); x.moveTo(ex - r * .15, ey + 2); x.quadraticCurveTo(ex, ey - r * .2, ex + r * .15, ey + 2); x.stroke(); }
    x.beginPath(); x.moveTo(cx + r * .05, cy + r * .18); x.quadraticCurveTo(cx + r * .22, cy + r * .32, cx + r * .36, cy + r * .16); x.stroke();
    x.beginPath(); x.ellipse(cx + r * .12, cy + r * .42, r * .12, r * .07, .3, 0, TAU); x.fillStyle = 'rgba(214,160,170,.5)'; x.fill();
    // 云朵披肩
    const shawl = () => { x.beginPath(); x.moveTo(cx - r * .75, cy + r * .75); for (let i = 0; i < 4; i++) x.arc(cx - r * .6 + i * r * .42, cy + r * .78, r * .26, Math.PI * 1.05, Math.PI * 1.95); x.closePath(); };
    shawl(); sh(x, '#fbfdff', LW2 + 1);
    // 星杖
    x.save(); x.translate(cx + r * .72, cy + r * .1); x.rotate(.5);
    rr(x, -5, -r * .5, 10, r, 5); sh(x, '#b9a06a', 3);
    x.translate(0, -r * .55); x.fillStyle = STAR_GOLD; x.beginPath();
    for (let i = 0; i < 10; i++) { const t = -Math.PI / 2 + i / 10 * TAU, rr2 = i % 2 ? r * .1 : r * .24; x.lineTo(Math.cos(t) * rr2, Math.sin(t) * rr2); }
    x.closePath(); x.fill(); x.lineWidth = 4; x.strokeStyle = '#c9973f'; x.stroke(); x.restore();
  }, { ay: .5, border: 12 });
}

// ============ 纸窗（结尾靠窗） ============
export function windowCard(wm) {
  return cut(wm, wm * 1.15, (x, W, H) => {
    const fw = W * .82, fh = H * .78, fx = (W - fw) / 2, fy = H * .06;
    const frame = () => { x.beginPath(); x.moveTo(fx, fy + fw / 2); x.arc(fx + fw / 2, fy + fw / 2, fw / 2, Math.PI, 0); x.lineTo(fx + fw, fy + fh); x.lineTo(fx, fy + fh); x.closePath(); };
    crescent(x, frame, '#b98d58', 12, 14, '#d9b98c'); frame(); sh(x, null, LW);
    // 窗格（2×2）
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const px = fx + fw * .08 + i * fw * .46, py = fy + fw * .3 + j * fh * .32, pw = fw * .38, ph = fh * .26;
      rr(x, px, py, pw, ph, 6); sh(x, '#fdf3d8', LW2);
      x.beginPath(); x.moveTo(px + pw * .5, py); x.lineTo(px + pw * .5, py + ph); x.lineWidth = LW2 - 1; x.strokeStyle = '#b98d58'; x.stroke();
    }
    // 窗台 + 小盆栽
    rr(x, fx - fw * .08, fy + fh, fw * 1.16, H * .07, 6); sh(x, '#c9a06a', LW2 + 1);
    rr(x, fx + fw * .6, fy + fh - H * .12, W * .12, H * .1, 4); sh(x, '#c97f4a', 4);
    x.beginPath(); x.ellipse(fx + fw * .66, fy + fh - H * .14, W * .07, W * .05, 0, 0, TAU); sh(x, '#6fae62', 4);
  }, { ay: 1 });
}

// ============ 静态剪纸（一次性生成） ============
const PPM = 5200;
function cut(wm, hm, draw, o = {}) {
  const pad = o.pad ?? 30, w = Math.ceil(wm * PPM) + pad * 2, h = Math.ceil(hm * PPM) + pad * 2;
  const c = cv(w, h), x = c.getContext('2d'); x.translate(pad, pad);
  draw(x, w - pad * 2, h - pad * 2);
  const out = o.raw ? c : finishCut(c, o.border ?? 14, o);
  return { c: out, w: w / PPM, h: h / PPM, ax: o.ax ?? .5, ay: o.ay ?? 1 - pad / h, pad };
}
export { cut, PPM };
const pickc = (R, a) => a[(R() * a.length) | 0];

// 山丘
export function hill(wm, hm, col, shade, seed, o = {}) {
  return cut(wm, hm, (x, W, H) => {
    const R = mulberry(seed), n = o.bumps ?? 3, pts = [[0, H]];
    for (let i = 0; i <= n * 2; i++) {
      const u = i / (n * 2), top = i % 2 === 0 ? (.25 + R() * .45) : (.05 + R() * .2);
      pts.push([u * W, H * (i % 2 ? top : top + .1) + (i === 0 || i === n * 2 ? H * .35 : 0)]);
    }
    pts.push([W, H]);
    const path = () => { x.beginPath(); x.moveTo(0, H + 40); x.lineTo(pts[1][0], pts[1][1]); smoothOpen(x, pts.slice(1, -1), false); x.lineTo(W, H + 40); x.closePath(); };
    crescent(x, path, shade, 40, 30, col); path(); sh(x, null, LW);
    x.strokeStyle = shade; x.lineWidth = 6; x.lineCap = 'round';
    for (let i = 0; i < (o.tufts ?? 10); i++) { const px = W * (.08 + R() * .84), py = H * (.45 + R() * .45); x.beginPath(); x.moveTo(px - 14, py); x.lineTo(px - 6, py - 22); x.moveTo(px, py); x.lineTo(px + 2, py - 30); x.moveTo(px + 12, py); x.lineTo(px + 12, py - 20); x.stroke(); }
    if (o.dots) { for (let i = 0; i < 14; i++) { x.beginPath(); x.arc(W * (.1 + R() * .8), H * (.5 + R() * .4), 8 + R() * 6, 0, TAU); x.fillStyle = pickc(R, o.dots); x.fill(); } }
  }, { ay: 1, ...o });
}
// 棒棒糖树
export function lolliTree(hm, col, shade, seed) {
  return cut(hm * .62, hm, (x, W, H) => {
    const R = mulberry(seed), r = W * .46, cy = r + 6;
    rr(x, W / 2 - 16, cy, 32, H - cy, 8); sh(x, '#a8733f', LW2 + 1);
    x.strokeStyle = '#7c5129'; x.lineWidth = 3; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(W / 2 - 6 + (i % 2) * 10, cy + 40 + i * (H - cy) / 6); x.lineTo(W / 2 - 4 + (i % 2) * 8, cy + 80 + i * (H - cy) / 6); x.stroke(); }
    const can = () => blob(x, W / 2, cy, r, r * .96, .06, seed);
    crescent(x, can, shade, 30, 26, col); can(); sh(x, null, LW);
    x.strokeStyle = shade; x.lineWidth = 6; x.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const a = R() * TAU, d = r * (.3 + R() * .45), px = W / 2 + Math.cos(a) * d, py = cy + Math.sin(a) * d; x.beginPath(); x.arc(px, py, 18, .3, 2.2); x.stroke(); }
    x.beginPath(); x.ellipse(W / 2 - r * .4, cy - r * .45, r * .22, r * .12, -.6, 0, TAU); x.fillStyle = 'rgba(255,255,255,.35)'; x.fill();
  });
}
// 松树
export function pine(hm, col, shade, seed, tiers = 3) {
  return cut(hm * .55, hm, (x, W, H) => {
    rr(x, W / 2 - 18, H * .72, 36, H * .28, 6); sh(x, '#7d5230', LW2 + 1);
    for (let k = 0; k < tiers; k++) {
      const top = H * (.02 + k * .2), bot = H * (.38 + k * .2), hw = W * (.26 + k * .12);
      const p = () => { x.beginPath(); x.moveTo(W / 2, top); x.quadraticCurveTo(W / 2 + hw * .5, (top + bot) / 2, W / 2 + hw, bot); x.quadraticCurveTo(W / 2, bot + 26, W / 2 - hw, bot); x.quadraticCurveTo(W / 2 - hw * .5, (top + bot) / 2, W / 2, top); x.closePath(); };
      crescent(x, p, shade, 26, 0, col); p(); sh(x, null, LW);
    }
  });
}
// 灌木
export function bush(wm, hm, col, shade, seed, berries) {
  return cut(wm * 1.12, hm, (x, W, H) => {
    const seedR = mulberry(seed);
    const pad = W * .06;
    const pp = () => {
      const RR = mulberry(seed);
      x.beginPath();
      x.moveTo(pad, H);
      const innerW = W - pad * 2;
      for (let i = 0; i < 4; i++) {
        const cx = pad + innerW * (i + .5) / 4, r = innerW / 4 * (.68 + RR() * .1);
        x.arc(cx, H * .96 - r * .95 - (i % 2 ? H * .14 : 0), r, Math.PI * 1.05, Math.PI * 1.95);
      }
      x.lineTo(W - pad, H);
      x.closePath();
    };
    crescent(x, pp, shade, 24, 24, col); pp(); sh(x, null, LW);
    if (berries) for (let i = 0; i < 7; i++) { x.beginPath(); x.arc(W * (.18 + seedR() * .64), H * (.35 + seedR() * .45), 14, 0, TAU); sh(x, berries, 4); }
  }, { border: 12 });
}
// 花
export function flower(hm, petal, seed) {
  return cut(hm * .5, hm, (x, W, H) => {
    const cy = W * .45;
    x.beginPath(); x.moveTo(W / 2, cy); x.quadraticCurveTo(W / 2 + 14, H * .6, W / 2, H); x.lineWidth = 12; x.strokeStyle = INK; x.stroke(); x.lineWidth = 6; x.strokeStyle = '#4ea83d'; x.stroke();
    x.beginPath(); x.ellipse(W / 2 + 30, H * .72, 34, 14, -.5, 0, TAU); sh(x, '#5cbf48', 4);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; x.beginPath(); x.ellipse(W / 2 + Math.cos(a) * W * .22, cy + Math.sin(a) * W * .22, W * .17, W * .12, a, 0, TAU); sh(x, petal, 5); }
    x.beginPath(); x.arc(W / 2, cy, W * .13, 0, TAU); sh(x, '#ffd23f', 5);
  }, { border: 10 });
}
// 蘑菇
export function mushroom(hm, col, seed) {
  return cut(hm * .9, hm, (x, W, H) => {
    rr(x, W * .38, H * .4, W * .24, H * .6, 20); sh(x, '#fbefd3', LW2 + 1);
    const cap = () => { x.beginPath(); x.moveTo(W * .02, H * .5); x.bezierCurveTo(W * .02, H * .05, W * .98, H * .05, W * .98, H * .5); x.quadraticCurveTo(W * .5, H * .58, W * .02, H * .5); x.closePath(); };
    crescent(x, cap, shadeOf(col), 26, 18, col); cap(); sh(x, null, LW);
    const R = mulberry(seed); for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(W * (.25 + i * .25), H * (.26 + R() * .1), W * .06, 0, TAU); sh(x, '#fff7ea', 4); }
  });
}
// 木桩（结尾坐）
export function log(wm) {
  return cut(wm, wm * .34, (x, W, H) => {
    rr(x, H * .2, H * .1, W - H * .4, H * .9, H * .4); sh(x, '#9a6236', LW);
    x.strokeStyle = '#6d4222'; x.lineWidth = 5; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(W * (.2 + i * .18), H * .3); x.lineTo(W * (.3 + i * .18), H * .35); x.stroke(); }
    x.beginPath(); x.ellipse(W * .5, H * .5, H * .3, H * .42, 0, 0, TAU); sh(x, '#e8c28e', LW2 + 2);
    x.beginPath(); x.ellipse(W * .5, H * .5, H * .15, H * .22, 0, 0, TAU); x.lineWidth = 4; x.strokeStyle = '#b88a5a'; x.stroke();
  }, { ay: 1 });
}
// 发光草丛（亮页，宽画布防止两翼草尖被裁切）
export function glowTuft(hm, seed) {
  return cut(hm * 1.5, hm, (x, W, H) => {
    const R = mulberry(seed);
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k - 2.5) * .26, len = H * (.68 + R() * .22);
      const ex = W / 2 + Math.cos(a) * len, ey = H + Math.sin(a) * len;
      x.beginPath(); x.moveTo(W / 2, H); x.quadraticCurveTo(W / 2 + Math.cos(a) * len * .4, H + Math.sin(a) * len * .6, ex, ey); x.lineWidth = 14; x.strokeStyle = INK; x.stroke();
      x.lineWidth = 7; x.strokeStyle = '#8fae62'; x.stroke();
      x.beginPath(); x.arc(ex, ey - 4, 11, 0, TAU); sh(x, '#ffe9a0', 3);
    }
  }, { border: 12 });
}
// 纸牌（系列名牌 / 路引）：中文字体
export function sign(wm, text, font = '58px "ZCOOL KuaiLe"') {
  return cut(wm, wm * .62, (x, W, H) => {
    rr(x, W / 2 - 16, H * .3, 32, H * .7, 8); sh(x, '#8d5a31', LW2 + 1);
    const b = () => { x.beginPath(); x.moveTo(W * .04, H * .08); x.lineTo(W * .96, H * .04); x.lineTo(W * .98, H * .52); x.lineTo(W * .02, H * .56); x.closePath(); };
    crescent(x, b, '#e8c27a', 0, 20, '#f7df9e'); b(); sh(x, null, LW);
    x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#5a3417'; x.save(); x.translate(W / 2, H * .3); x.rotate(-.02);
    let fs = parseInt(font.match(/(\d+)px/)[1]); while (x.measureText(text).width > W * .84 && fs > 18) { fs -= 4; x.font = font.replace(/\d+px/, fs + 'px'); }
    x.fillText(text, 0, 0); x.restore();
  });
}
// 纸星星（礼物 / 满天星）
export function star(rm, col = STAR_GOLD) {
  return cut(rm * 2, rm * 2, (x, W, H) => {
    const p = () => { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i / 10 * TAU, r = (i % 2 ? .42 : 1) * W / 2 * .96; x.lineTo(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r * 1.02); } x.closePath(); };
    crescent(x, p, '#d9a53c', 12, 12, col); p(); sh(x, null, LW - 2);
    x.beginPath(); x.moveTo(W / 2, H / 2 - W * .18); x.lineTo(W / 2, H / 2 + W * .18); x.moveTo(W / 2 - W * .18, H / 2); x.lineTo(W / 2 + W * .18, H / 2); x.lineWidth = 4; x.strokeStyle = 'rgba(217,165,60,.7)'; x.stroke();
  }, { ay: .5, border: 10 });
}
// 云
export function cloud(wm, seed, col = '#ffffff') {
  return cut(wm, wm * .55, (x, W, H) => {
    const p = () => { x.beginPath(); x.moveTo(W * .1, H * .9); x.arc(W * .22, H * .66, H * .28, Math.PI * .6, Math.PI * 1.55); x.arc(W * .45, H * .42, H * .38, Math.PI * 1.1, Math.PI * 1.85); x.arc(W * .72, H * .5, H * .32, Math.PI * 1.25, Math.PI * .1); x.arc(W * .82, H * .72, H * .2, Math.PI * 1.6, Math.PI * .5); x.closePath(); };
    crescent(x, p, '#d7e6f2', 0, -22, col); p(); sh(x, null, LW);
  }, { ay: 0 });
}
// 感叹号小牌
export function bang() {
  return cut(.012, .016, (x, W, H) => {
    x.font = `900 ${H * 1.05}px "Lilita One"`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 16; x.strokeStyle = INK; x.strokeText('!', W / 2, H * .55); x.fillStyle = '#ff4b3a'; x.fillText('!', W / 2, H * .55);
  }, { border: 12, ay: 1 });
}
export function shadeOf(hex) { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = n >> 8 & 255, b = n & 255, f = .78; return `rgb(${r * f | 0},${g * f | 0},${b * f | 0})`; }
export { paperFill, pencil2 };

function pencil2() {}
