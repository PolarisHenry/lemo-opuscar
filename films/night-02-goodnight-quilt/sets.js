// 五个跨页：页面美术 + 立体弹出件（纸片立体书·第二夜《晚安被子去旅行》）
import * as THREE from 'three';
import * as A from './art.js';
import { cv, paperFill, INK, blob, sh, smoothOpen, GRAIN } from './paper.js';
import { mulberry, clamp, lerp, seg, back, ss, eio, TAU, spring } from './lib.js';
import { BW, BD, texOf } from './book.js';
import { cutMesh, thread, blobShadow } from './cutmesh.js';
import { OPEN, TURNS, SIGN_TEXT } from './story.js';

const PW = 2048, PH = Math.round(2048 * BD / BW);
const gx = xm => (xm / BW + .5) * PW, gz = zm => zm / BD * PH;

export const RISE = [
  OPEN[0] + .85,           // s0: 1.95s
  TURNS[0][1] - .85,       // s1: 9.15s
  TURNS[1][1] - .85,       // s2: 15.15s
  TURNS[2][1] - .85,       // s3: 20.05s
  TURNS[3][1] - .85        // s4: 27.15s
];
export const FOLD = [
  TURNS[0][0],             // s0: 8.80s
  TURNS[1][0],             // s1: 14.80s
  TURNS[2][0],             // s2: 19.70s
  TURNS[3][0],             // s3: 26.80s
  1e9                      // s4: 常驻到片尾
];

// ---------- 页面背景美术生成 ----------
function page(fn) {
  const c = cv(PW, PH), x = c.getContext('2d');
  fn(x);
  x.save();
  x.globalAlpha = .7;
  x.fillStyle = x.createPattern(GRAIN, 'repeat');
  x.fillRect(0, 0, PW, PH);
  x.restore();
  return c;
}

function grad(x, stops, horiz) {
  const g = horiz ? x.createLinearGradient(0, 0, PW, 0) : x.createLinearGradient(0, 0, 0, PH);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  x.fillStyle = g;
  x.fillRect(0, 0, PW, PH);
}

function softClouds(x, seed, col = 'rgba(255,255,255,.55)', n = 6, y0 = .08, y1 = .4) {
  const R = mulberry(seed);
  for (let i = 0; i < n; i++) {
    const cx = R() * PW, cy = PH * (y0 + R() * (y1 - y0)), w = 170 + R() * 240;
    x.fillStyle = col;
    for (let k = 0; k < 5; k++) {
      x.beginPath();
      x.ellipse(cx + (k - 2) * w * .22, cy - Math.sin(k / 4 * Math.PI) * w * .12, w * .2, w * .13, 0, 0, TAU);
      x.fill();
    }
  }
}

function dots(x, seed, n, cols, y0 = 0, y1 = PH, r0 = 5, r1 = 11) {
  const R = mulberry(seed);
  for (let i = 0; i < n; i++) {
    x.beginPath();
    x.arc(R() * PW, y0 + R() * (y1 - y0), r0 + R() * (r1 - r0), 0, TAU);
    x.fillStyle = cols[(R() * cols.length) | 0];
    x.fill();
  }
}

function beams(x, n, col = 'rgba(255,252,225,.12)') {
  x.save();
  x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const x0 = PW * (.08 + i * .84 / n);
    x.beginPath();
    x.moveTo(x0, 0); x.lineTo(x0 + 130, 0); x.lineTo(x0 + 460, PH); x.lineTo(x0 + 250, PH);
    x.closePath();
    x.fillStyle = col;
    x.fill();
  }
  x.restore();
}

function stripes(x, n = 9, a = .1) {
  for (let i = 0; i < n; i++) {
    x.fillStyle = i % 2 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * .5})`;
    x.fillRect(0, PH * i / n, PW, PH / n);
  }
}

export function pages() {
  const P = {};

  // 跨页0：团团卧室起风（夜幕降临、温馨木屋室内）
  P.sky0 = page(x => {
    grad(x, [[0, '#1c2844'], [.5, '#253556'], [1, '#34456a']]);
    // 卧室窗棂透出的月光与壁灯暖黄
    const rg = x.createRadialGradient(PW * .35, PH * .45, 20, PW * .35, PH * .45, 600);
    rg.addColorStop(0, 'rgba(255, 240, 180, .3)');
    rg.addColorStop(1, 'rgba(255, 240, 180, 0)');
    x.fillStyle = rg; x.fillRect(0, 0, PW, PH);
    // 墙纸细小星星印花
    const R = mulberry(101);
    x.fillStyle = 'rgba(255, 245, 210, .2)';
    for (let i = 0; i < 60; i++) {
      x.beginPath();
      x.arc(R() * PW, R() * PH, 3.5, 0, TAU);
      x.fill();
    }
  });
  P.ground0 = page(x => {
    // 温暖木地板
    grad(x, [[0, '#b8895b'], [1, '#d4a373']]);
    stripes(x, 14, .06);
    // 地板上的圆形编织地毯
    x.fillStyle = '#efe3c3';
    x.beginPath();
    x.ellipse(PW * .5, PH * .6, PW * .3, PH * .25, 0, 0, TAU);
    x.fill();
    x.strokeStyle = '#d4be88';
    x.lineWidth = 6;
    x.stroke();
  });

  // 跨页1：森林草地（被子落到刺猬扎扎身上，太大啦）
  P.sky1 = page(x => {
    grad(x, [[0, '#131e33'], [.6, '#1e2f4c'], [1, '#2c4366']]);
    beams(x, 5, 'rgba(210, 235, 255, .08)');
    softClouds(x, 12, 'rgba(180, 205, 240, .25)', 4, .1, .35);
  });
  P.ground1 = page(x => {
    grad(x, [[0, '#386638'], [.6, '#4f854b'], [1, '#6ea660']]);
    stripes(x, 9, .04);
    dots(x, 77, 120, ['#ffffff', '#ffe9a0', '#f2b3ab'], 0, PH, 4, 8);
  });

  // 跨页2：夜空云海（被子落到月亮婆婆身上，太小啦）
  P.sky2 = page(x => {
    grad(x, [[0, '#0a1020'], [.5, '#121c35'], [1, '#1b2a4c']]);
    const R = mulberry(44);
    for (let i = 0; i < 200; i++) {
      x.beginPath();
      x.arc(R() * PW, R() * PH * .85, .8 + R() * 2.2, 0, TAU);
      x.fillStyle = `rgba(255, 248, 220, ${.25 + R() * .65})`;
      x.fill();
    }
    softClouds(x, 88, 'rgba(230, 240, 255, .35)', 5, .2, .5);
  });
  P.ground2 = page(x => {
    grad(x, [[0, '#1e2c4f'], [.5, '#2e416d'], [1, '#435b8e']]);
    softClouds(x, 99, 'rgba(255, 255, 255, .6)', 8, .1, .9);
  });

  // 跨页3：古树树梢（小田鼠豆豆的新家，刚好盖住）
  P.sky3 = page(x => {
    grad(x, [[0, '#0e172a'], [.5, '#182440'], [1, '#243454']]);
    const R = mulberry(55);
    for (let i = 0; i < 150; i++) {
      x.beginPath();
      x.arc(R() * PW, R() * PH * .8, .8 + R() * 2.0, 0, TAU);
      x.fillStyle = `rgba(255, 248, 220, ${.2 + R() * .55})`;
      x.fill();
    }
  });
  P.ground3 = page(x => {
    // 粗壮古树树干与树皮层次
    grad(x, [[0, '#4a331e'], [.5, '#694829'], [1, '#855b33']]);
    stripes(x, 10, .07);
    dots(x, 33, 90, ['#a8c77f', '#d9e8a0', '#e3a85b'], 0, PH, 4, 7);
  });

  // 跨页4：清晨暖阳窗台（大家连夜织的花瓣毛线新被子）
  P.sky4 = page(x => {
    // 温暖晨曦破晓金光
    const g = x.createLinearGradient(0, 0, 0, PH);
    g.addColorStop(0, '#fcefd2');
    g.addColorStop(.4, '#fcdbb0');
    g.addColorStop(.8, '#f7b88e');
    g.addColorStop(1, '#eda582');
    x.fillStyle = g; x.fillRect(0, 0, PW, PH);
    beams(x, 7, 'rgba(255, 255, 240, .25)');
    softClouds(x, 77, 'rgba(255, 255, 255, .7)', 4, .1, .3);
  });
  P.ground4 = page(x => {
    // 温暖阳光洒满的窗台原木
    grad(x, [[0, '#d9a86c'], [.5, '#eec48e'], [1, '#f7d8a8']]);
    stripes(x, 12, .05);
    dots(x, 88, 140, ['#ffffff', '#ffd23f', '#f2b3ab', '#8ecae6'], 0, PH, 5, 10);
  });

  return P;
}

// ---------- 弹出件管理 ----------
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

  // ===== 跨页 0：团团卧室起风 =====
  const s0 = 0;
  ex.sign = popper(L, s0, S, A.sign(.052, SIGN_TEXT), -.165, 0, .095, { d: dz(.095) });
  ex.window0 = popper(L, s0, S, A.cozyWindow(.12, .15), -.02, 0, .03, { d: dz(.03) });
  // 床铺与枕头
  popper(L, s0, S, A.log(.09), .12, 0, .14, { d: dz(.14) });
  // 绿植小盆栽
  popper(L, s0, S, A.flower(.018, '#f2b3ab', 1), -.12, 0, .20, { d: dz(.20), sway: .06 });
  popper(L, s0, S, A.flower(.016, '#ffe9a0', 2), -.07, 0, .22, { d: dz(.22), sway: .06 });

  // ===== 跨页 1：刺猬扎扎（被子太大） =====
  const s1 = 1;
  popper(L, s1, S, A.hill(.26, .06, '#386638', '#2b502b', 41, { bumps: 2 }), -.14, 0, .014, { d: dz(.014) });
  popper(L, s1, S, A.hill(.22, .05, '#4f854b', '#3b6638', 42, { bumps: 2 }), -.02, 0, .05, { d: dz(.05) });
  popper(L, s1, S, A.pine(.09, '#2f6942', '#214e30', 121), -.18, 0, .03, { d: dz(.03), sway: .02 });
  popper(L, s1, S, A.pine(.075, '#3b7a4d', '#295b38', 122), .17, 0, .04, { d: dz(.04), sway: .02 });
  popper(L, s1, S, A.glowTuft(.03, 50), -.08, 0, .12, { d: dz(.12), sway: .04 });
  popper(L, s1, S, A.glowTuft(.024, 51), .14, 0, .15, { d: dz(.15), sway: .04 });
  popper(L, s1, S, A.mushroom(.024, '#f08a2e', 1), .18, 0, .20, { d: dz(.20) });

  // ===== 跨页 2：月亮婆婆（被子太小） =====
  const s2 = 2;
  popper(L, s2, S, A.cloud(.15, 60, '#eaf2f8'), -.12, 0, .04, { d: dz(.04), sway: .02 });
  popper(L, s2, S, A.cloud(.14, 61, '#d8e6f3'), .13, 0, .06, { d: dz(.06), sway: .02 });
  popper(L, s2, S, A.cloud(.11, 62, '#ffffff'), -.02, 0, .12, { d: dz(.12), sway: .03 });

  // ===== 跨页 3：古树树梢与小田鼠豆豆（刚搬新家） =====
  const s3 = 3;
  ex.nest = popper(L, s3, S, A.treeNest(.16, .18), .04, 0, .05, { d: dz(.05) });
  popper(L, s3, S, A.pine(.085, '#2e5a3c', '#1f3e29', 133), -.19, 0, .03, { d: dz(.03), sway: .02 });
  popper(L, s3, S, A.mushroom(.022, '#e8a03a', 4), -.12, 0, .15, { d: dz(.15) });
  popper(L, s3, S, A.glowTuft(.026, 72), .16, 0, .14, { d: dz(.14), sway: .04 });

  // ===== 跨页 4：清晨暖阳窗台（百家拼织新被子） =====
  const s4 = 4;
  ex.morningWindow = popper(L, s4, S, A.cozyWindow(.13, .16), -.05, 0, .02, { d: dz(.02) });
  ex.patchQuilt = popper(L, s4, S, A.patchworkQuilt(.13, .09), .06, 0, .12, { d: dz(.12) });
  // 窗台花瓶与盛开花朵
  popper(L, s4, S, A.flower(.022, '#f2b3ab', 91), -.15, 0, .16, { d: dz(.16), sway: .05 });
  popper(L, s4, S, A.flower(.018, '#ffd23f', 92), -.11, 0, .18, { d: dz(.18), sway: .05 });
  popper(L, s4, S, A.flower(.020, '#8ecae6', 93), .18, 0, .17, { d: dz(.17), sway: .05 });

  return { L, ex };
}

export function updatePops(L, t) {
  for (const r of L) {
    const k = riseOf(r, t);
    r.g.visible = k > .002;
    if (!r.g.visible) continue;
    r.g.rotation.x = r.dir * (Math.PI / 2) * (1 - k);
    if (r.sway) r.m.rotation.z = Math.sin(t * 1.6 + r.ph) * r.sway * k;
    if (r.wob) r.m.rotation.z += Math.sin(t * 9 + r.ph) * r.wob * k;
  }
}
export { riseOf };
