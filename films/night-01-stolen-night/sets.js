// 三个跨页：页面美术 + 立体弹出件（页越翻越亮 → 翻板变夜空）
import * as THREE from 'three';
import * as A from './art.js';
import { cv, paperFill, INK, blob, sh, smoothOpen, GRAIN } from './paper.js';
import { mulberry, clamp, lerp, seg, back, ss, eio, TAU, spring } from './lib.js';
import { BW, BD, texOf } from './book.js';
import { cutMesh, thread, blobShadow } from './cutmesh.js';
import { OPEN, TURNS, SIGN_TEXT } from './story.js';

const PW = 2048, PH = Math.round(2048 * BD / BW);
const gx = xm => (xm / BW + .5) * PW, gz = zm => zm / BD * PH;

export const RISE = [OPEN[0] + .85, TURNS[0][1] - .9, TURNS[1][1] - .9];
export const FOLD = [TURNS[0][0], TURNS[1][0], 1e9];

// ---------- 页面美术 ----------
function page(fn) { const c = cv(PW, PH), x = c.getContext('2d'); fn(x); x.save(); x.globalAlpha = .7; x.fillStyle = x.createPattern(GRAIN, 'repeat'); x.fillRect(0, 0, PW, PH); x.restore(); return c; }
function grad(x, stops, horiz) {
  const g = horiz ? x.createLinearGradient(0, 0, PW, 0) : x.createLinearGradient(0, 0, 0, PH);
  stops.forEach(([o, c]) => g.addColorStop(o, c)); x.fillStyle = g; x.fillRect(0, 0, PW, PH);
}
function softClouds(x, seed, col = 'rgba(255,255,255,.55)', n = 6, y0 = .08, y1 = .4) {
  const R = mulberry(seed);
  for (let i = 0; i < n; i++) { const cx = R() * PW, cy = PH * (y0 + R() * (y1 - y0)), w = 170 + R() * 240; x.fillStyle = col; for (let k = 0; k < 5; k++) { x.beginPath(); x.ellipse(cx + (k - 2) * w * .22, cy - Math.sin(k / 4 * Math.PI) * w * .12, w * .2, w * .13, 0, 0, TAU); x.fill(); } }
}
function dots(x, seed, n, cols, y0 = 0, y1 = PH, r0 = 5, r1 = 11) {
  const R = mulberry(seed);
  for (let i = 0; i < n; i++) { x.beginPath(); x.arc(R() * PW, y0 + R() * (y1 - y0), r0 + R() * (r1 - r0), 0, TAU); x.fillStyle = cols[(R() * cols.length) | 0]; x.fill(); }
}
function beams(x, n, col = 'rgba(255,252,225,.12)') {
  x.save(); x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) { const x0 = PW * (.08 + i * .84 / n); x.beginPath(); x.moveTo(x0, 0); x.lineTo(x0 + 130, 0); x.lineTo(x0 + 460, PH); x.lineTo(x0 + 250, PH); x.closePath(); x.fillStyle = col; x.fill(); }
  x.restore();
}
function sleepyMoon(x, cx, cy, r) {
  // 没故事可讲的月亮婆婆（贴纸式静态）：眯眼 + 小 zZ
  x.save(); x.translate(cx, cy); x.rotate(-.22);
  x.beginPath(); x.arc(0, 0, r, Math.PI * .42, Math.PI * 1.58, false);
  x.bezierCurveTo(-r * .55, -r * .45, -r * .55, r * .45, Math.cos(Math.PI * .42) * r, Math.sin(Math.PI * .42) * r); x.closePath();
  x.fillStyle = '#f2f5fb'; x.fill(); x.lineWidth = 10; x.strokeStyle = 'rgba(120,110,130,.5)'; x.stroke();
  x.strokeStyle = '#8a92aa'; x.lineWidth = 8; x.lineCap = 'round';
  x.beginPath(); x.moveTo(-r * .1, -r * .1); x.quadraticCurveTo(r * .05, -r * .3, r * .2, -r * .1); x.stroke();
  x.beginPath(); x.moveTo(-r * .05, r * .22); x.quadraticCurveTo(r * .1, r * .36, r * .26, r * .2); x.stroke();
  x.restore();
  x.font = 'italic 54px "IM Fell English", serif'; x.fillStyle = 'rgba(110,100,130,.65)';
  x.fillText('z', cx + r * 1.15, cy - r * .5); x.font = 'italic 40px "IM Fell English", serif'; x.fillText('z', cx + r * 1.5, cy - r * .85);
}
function awakeSun(x, cx, cy, r) {
  // 被迫营业的纸太阳：瞪圆眼
  x.save(); x.translate(cx, cy);
  x.beginPath(); for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, rad = i % 2 ? r * 1.12 : r * 1.34; x.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } x.closePath();
  x.fillStyle = '#ffd84a'; x.fill(); x.lineWidth = 9; x.strokeStyle = 'rgba(190,130,40,.55)'; x.stroke();
  x.beginPath(); x.arc(0, 0, r * .88, 0, TAU); x.fillStyle = '#ffe680'; x.fill();
  x.strokeStyle = '#a8742a'; x.lineWidth = 9; x.lineCap = 'round';
  for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * r * .3, -r * .1, r * .13, r * .17, 0, 0, TAU); x.fillStyle = '#5a4028'; x.fill(); x.beginPath(); x.moveTo(s * r * .45, -r * .4); x.lineTo(s * r * .2, -r * .32); x.stroke(); }
  x.beginPath(); x.ellipse(0, r * .3, r * .12, r * .15, 0, 0, TAU); x.fillStyle = '#5a4028'; x.fill();
  x.beginPath(); x.ellipse(-r * .55, r * .18, r * .13, r * .08, 0, 0, TAU); x.ellipse(r * .55, r * .18, r * .13, r * .08, 0, 0, TAU); x.fillStyle = 'rgba(240,140,120,.5)'; x.fill();
  x.restore();
}
function pathStroke(x, pts, w, col, edge) {
  x.lineCap = 'round'; x.lineJoin = 'round';
  if (edge) { x.beginPath(); smoothOpen(x, pts); x.lineWidth = w + 14; x.strokeStyle = edge; x.stroke(); }
  x.beginPath(); smoothOpen(x, pts); x.lineWidth = w; x.strokeStyle = col; x.stroke();
}
function stripes(x, n = 9, a = .1) { for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * .5})`; x.fillRect(0, PH * i / n, PW, PH / n); } }

export function pages() {
  const P = {};
  // 跨页0：亮如白昼的夜（奶油黄白）
  P.sky0 = page(x => {
    grad(x, [[0, '#fff3c4'], [.65, '#ffe9a4'], [1, '#f7df8e']]);
    beams(x, 5, 'rgba(255,250,220,.16)');
    awakeSun(x, PW * .76, PH * .24, 92);
    sleepyMoon(x, PW * .22, PH * .22, 74);
    softClouds(x, 3, 'rgba(255,255,255,.6)', 5, .1, .38);
  });
  P.ground0 = page(x => {
    grad(x, [[0, '#9fd57a'], [1, '#b8e392']]); stripes(x, 10, .06);
    pathStroke(x, [[gx(-.1), gz(.1)], [gx(-.02), gz(.16)], [gx(.06), gz(.22)], [gx(.02), gz(.3)]], 120, '#f2df9e', '#d6b877');
    dots(x, 5, 150, ['#ffffff', '#ffe066', '#f2b3ab'], 0, PH, 5, 10);
  });
  // 跨页1：越翻越亮（青金渐亮，右侧亮源）
  P.sky1 = page(x => {
    const g = x.createLinearGradient(0, 0, PW * .7, PH); g.addColorStop(0, '#8fd8cc'); g.addColorStop(.55, '#d8eec2'); g.addColorStop(1, '#fdf4b8'); x.fillStyle = g; x.fillRect(0, 0, PW, PH);
    const rg = x.createRadialGradient(PW * .97, PH * .5, 0, PW * .97, PH * .5, PW * .5); rg.addColorStop(0, 'rgba(255,246,200,.95)'); rg.addColorStop(1, 'rgba(255,246,200,0)'); x.fillStyle = rg; x.fillRect(0, 0, PW, PH);
    beams(x, 6, 'rgba(255,250,210,.14)');
    softClouds(x, 11, 'rgba(255,255,255,.5)', 4, .1, .35);
  });
  P.ground1 = page(x => {
    const g = x.createLinearGradient(0, 0, PW, 0); g.addColorStop(0, '#7fbf62'); g.addColorStop(.6, '#b5d178'); g.addColorStop(1, '#e5d488'); x.fillStyle = g; x.fillRect(0, 0, PW, PH);
    stripes(x, 9, .05);
    pathStroke(x, [[gx(-.22), gz(.16)], [gx(-.05), gz(.13)], [gx(.14), gz(.18)], [gx(.24), gz(.2)]], 150, '#f2df9e', '#d6b877');
    dots(x, 9, 190, ['#ffffff', '#ffe9a0', '#f2b3ab', '#b5d0ee'], 0, PH, 5, 11);
  });
  // 跨页2：最亮的一页（白金爆亮）+ 翻板背面 = 夜空
  P.sky2bright = page(x => {
    const rg = x.createRadialGradient(PW * .68, PH * .42, 0, PW * .68, PH * .42, PW * .72);
    rg.addColorStop(0, '#fffef4'); rg.addColorStop(.4, '#fff3bc'); rg.addColorStop(1, '#f2d98a');
    x.fillStyle = rg; x.fillRect(0, 0, PW, PH);
    beams(x, 7, 'rgba(255,252,230,.15)');
    const R = mulberry(23); x.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 40; i++) { x.save(); x.translate(R() * PW, R() * PH); x.rotate(R() * TAU); x.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, r = k % 2 ? 3 : 8 + R() * 6; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.globalAlpha = .3 + R() * .6; x.fill(); x.restore(); }
  });
  P.sky2night = page(x => {
    const g = x.createLinearGradient(0, 0, 0, PH); g.addColorStop(0, '#141c38'); g.addColorStop(.6, '#1f2c52'); g.addColorStop(1, '#31406b'); x.fillStyle = g; x.fillRect(0, 0, PW, PH);
    const R = mulberry(21); for (let i = 0; i < 320; i++) { x.beginPath(); x.arc(R() * PW, R() * PH * .9, .8 + R() * 2.6, 0, TAU); x.fillStyle = `rgba(255,248,220,${.25 + R() * .6})`; x.fill(); }
    x.save(); x.globalAlpha = .13; x.fillStyle = '#c8d4ff'; x.beginPath(); x.ellipse(PW * .5, PH * .32, PW * .62, 80, -.25, 0, TAU); x.fill(); x.restore();
    const rg = x.createRadialGradient(PW * .3, PH * .3, 0, PW * .3, PH * .3, 320); rg.addColorStop(0, 'rgba(240,244,255,.28)'); rg.addColorStop(1, 'rgba(240,244,255,0)'); x.fillStyle = rg; x.fillRect(0, 0, PW, PH);
  });
  P.ground2 = page(x => {
    const rg = x.createRadialGradient(PW * .66, PH * .5, 0, PW * .66, PH * .5, PW * .66);
    rg.addColorStop(0, '#fdf3cf'); rg.addColorStop(.55, '#f2e2ac'); rg.addColorStop(1, '#e2cc8e');
    x.fillStyle = rg; x.fillRect(0, 0, PW, PH); stripes(x, 8, .045);
    dots(x, 15, 90, ['#fffef0', '#ffe9a0'], 0, PH, 4, 9);
  });
  return P;
}

// ---------- 弹出件 ----------
function popper(list, spread, parent, item, x, y, z, o = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const m = cutMesh(item, o); if (o.flip) m.scale.x = -1; if (o.ry) m.rotation.y = o.ry;
  g.add(m); parent.add(g);
  const rec = { g, m, spread, d: o.d ?? 0, dir: o.dir ?? (z > .15 ? -1 : 1), sway: o.sway || 0, ph: o.ph ?? x * 40, pop: o.pop !== false, wob: o.wob || 0 };
  list.push(rec); return rec;
}
function riseOf(r, t) {
  const t0 = RISE[r.spread] + r.d, tf = FOLD[r.spread] + (.3 - r.g.position.z) * .6;
  const up = r.pop ? back(seg(t, t0, t0 + .55), 1.7) : (t >= t0 ? 1 : 0);
  const dn = 1 - ss(seg(t, tf, tf + .4));
  return Math.min(up, dn);
}

export function buildSets(book) {
  const L = [], S = book.stage, K = book.sky;
  const ex = {};
  const dz = z => (.3 - z) * 1.2;

  // ===== 跨页 0：亮如白昼的森林（失眠动物炸锅） =====
  const s0 = 0;
  popper(L, s0, S, A.hill(.24, .07, '#c2e394', '#a3cc78', 11, { bumps: 2 }), -.12, 0, .014, { d: dz(.014) });
  popper(L, s0, S, A.hill(.25, .08, '#b5dd8a', '#96c66e', 12, { bumps: 3 }), .1, 0, .016, { d: dz(.016) + .04 });
  popper(L, s0, S, A.lolliTree(.07, '#5cbf4a', '#3f9934', 21), -.05, 0, .058, { d: dz(.058), sway: .03 });
  popper(L, s0, S, A.lolliTree(.055, '#6fcc55', '#4ea93e', 22), .175, 0, .062, { d: dz(.062), sway: .03 });
  popper(L, s0, S, A.pine(.075, '#3f9f5a', '#2e7c45', 23), -.205, 0, .072, { d: dz(.072), sway: .02 });
  popper(L, s0, S, A.mushroom(.026, '#f08a2e', 1), -.145, 0, .1, { d: dz(.1) });
  popper(L, s0, S, A.mushroom(.02, '#e8a03a', 2), .21, 0, .105, { d: dz(.105) });
  ex.sign = popper(L, s0, S, A.sign(.052, SIGN_TEXT), -.165, 0, .095, { d: dz(.095) });
  // 失眠动物：猫头鹰（高处惊起）+ 小鼠×2 + 小鸟
  ex.owl = popper(L, s0, S, A.owl(.05), .06, 0, .052, { d: dz(.052) + .06, wob: .05 });
  ex.mouse1 = popper(L, s0, S, A.mousey(.032), -.065, 0, .16, { d: dz(.16) + .1, wob: .06 });
  ex.mouse2 = popper(L, s0, S, A.mousey(.026), .135, 0, .185, { d: dz(.185) + .12, wob: .06 });
  ex.bird = popper(L, s0, S, A.birdy(.03), -.155, 0, .14, { d: dz(.14) + .08, wob: .07 });
  // 前景花与灌木
  const R0 = mulberry(90);
  for (let i = 0; i < 7; i++) { const x = -.2 + i * .055 + (R0() - .5) * .02; popper(L, s0, S, A.flower(.016 + R0() * .008, ['#f2b3ab', '#ffd23f', '#ffffff', '#b5d0ee'][i % 4], i), x, 0, .21 + R0() * .05, { d: dz(.22), sway: .08 }); }
  popper(L, s0, S, A.bush(.07, .03, '#4fae4c', '#3a8a3a', 31, '#e89c3a'), -.185, 0, .265, { d: dz(.265) });
  popper(L, s0, S, A.bush(.06, .026, '#5cbb52', '#44953e', 32), .16, 0, .27, { d: dz(.27) });

  // ===== 跨页 1：循光之路（渐亮） =====
  const s1 = 1;
  popper(L, s1, S, A.hill(.26, .06, '#a3d488', '#88bd6e', 41, { bumps: 2 }), -.14, 0, .014, { d: dz(.014) });
  popper(L, s1, S, A.hill(.22, .05, '#c2e094', '#a3cc78', 42, { bumps: 2, dots: ['#fff', '#ffe9a0'] }), -.02, 0, .05, { d: dz(.05) });
  popper(L, s1, S, A.hill(.2, .045, '#e2d48e', '#c9b874', 43, { bumps: 2, dots: ['#fff', '#ffd23f'] }), .16, 0, .018, { d: dz(.018) + .04 });
  const R1 = mulberry(7);
  for (let i = 0; i < 5; i++) popper(L, s1, S, A.pine(.09 + R1() * .03, '#4aa866', '#37854f', 120 + i), -.21 + i * .055, 0, .03 + (i % 2) * .006, { d: dz(.03), sway: .015 });
  popper(L, s1, S, A.glowTuft(.03, 50), -.08, 0, .12, { d: dz(.12), sway: .04 });
  popper(L, s1, S, A.glowTuft(.024, 51), .05, 0, .15, { d: dz(.15), sway: .04 });
  popper(L, s1, S, A.glowTuft(.026, 52), .14, 0, .1, { d: dz(.1), sway: .04 });
  popper(L, s1, S, A.flower(.02, '#ffe9a0', 9), -.13, 0, .19, { d: dz(.19), sway: .07 });
  popper(L, s1, S, A.flower(.016, '#ffffff', 10), .1, 0, .21, { d: dz(.21), sway: .07 });

  // ===== 跨页 2：最亮的一页（扎扎+瓶子；靠窗结尾） =====
  const s2 = 2;
  popper(L, s2, S, A.glowTuft(.034, 60), -.02, 0, .1, { d: dz(.1), sway: .04 });
  popper(L, s2, S, A.glowTuft(.028, 61), .17, 0, .07, { d: dz(.07), sway: .04 });
  popper(L, s2, S, A.glowTuft(.024, 62), -.19, 0, .16, { d: dz(.16), sway: .04 });
  popper(L, s2, S, A.bush(.065, .028, '#8fc45e', '#74a848', 63), .2, 0, .12, { d: dz(.12) });
  popper(L, s2, S, A.mushroom(.024, '#e8a03a', 3), -.06, 0, .21, { d: dz(.21) });
  ex.window = popper(L, s2, S, A.windowCard(.085), -.155, 0, .075, { d: dz(.075) + .05, sway: .008 });
  ex.log = popper(L, s2, S, A.log(.085), -.075, 0, .19, { d: dz(.19) + .1 });
  // 挂线的纸云（夜空翻板后仍可看的暖云）
  ex.clouds = [];
  for (const [x, y, w, sd] of [[-.15, .22, .05, 1], [.14, .25, .04, 2]]) {
    const g = new THREE.Group(), it = A.cloud(w, sd); const m = cutMesh(it); g.add(m);
    const th = thread(.2); th.position.set(-w * .15, 0, -.0004); g.add(th); const th2 = thread(.2); th2.position.set(w * .2, 0, -.0004); g.add(th2);
    g.position.set(x, y, .03); K.add(g); ex.clouds.push({ g, y, ph: x * 30 });
  }
  // 纸星星（挂线垂落，萤火虫变星星）
  ex.stars = [];
  const R2 = mulberry(55);
  for (let i = 0; i < 9; i++) { const it = A.star(.0035 + R2() * .0035); const g = new THREE.Group(); g.add(cutMesh(it)); const th = thread(.3); th.position.set(0, 0, -.0004); g.add(th); g.position.set(-.2 + i * .05 + (R2() - .5) * .02, .4, .02 + R2() * .02); K.add(g); ex.stars.push({ g, y: .14 + R2() * .12, d: i * .11 + R2() * .15, ph: R2() * 9 }); }

  return { L, ex };
}

// 三面翻天空板（最亮页 → 夜空）
export function buildSlats(book, dayTex, nightTex, ex) {
  const n = 4, w = (BW - .006) / n, h = BD - .012;
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group(); g.position.set(-BW / 2 + .003 + w * (i + .5), .006 + h / 2, .004);
    const mk = (tex, side, flipU) => {
      const geo = new THREE.PlaneGeometry(w, h); const uv = geo.attributes.uv;
      for (let k = 0; k < uv.count; k++) { const u = uv.getX(k), v = uv.getY(k); const uu = (i + (flipU ? 1 - u : u)) / n; uv.setXY(k, uu, (.006 + v * h) / BD); }
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: .9, side, emissive: new THREE.Color(.42, .4, .38), emissiveMap: tex })); m.receiveShadow = true; m.castShadow = true; return m;
    };
    g.add(mk(dayTex, THREE.FrontSide, false)); g.add(mk(nightTex, THREE.BackSide, true));
    book.sky.add(g); ex.slats = ex.slats || []; ex.slats.push(g);
  }
}

export function updatePops(L, t) {
  for (const r of L) {
    const k = riseOf(r, t);
    r.g.visible = k > .002;
    if (!r.g.visible) continue;
    r.g.rotation.x = r.dir * (Math.PI / 2) * (1 - k);
    if (r.sway) r.m.rotation.z = Math.sin(t * 1.6 + r.ph) * r.sway * k;
    if (r.wob) r.m.rotation.z += Math.sin(t * 9 + r.ph) * r.wob * k * (t < 3.6 ? 1 : .25);   // 失眠小发抖
  }
}
export { riseOf };
