// 萤火虫（v3）：全部用 Canvas 程序化绘制，零外部贴图
// 圆点身体（暖黄绿）+ 两片半透明翅膀 + 多层径向渐变光晕 + 呼吸式明暗 + 飞舞微拖尾
import * as THREE from 'three';
import { cv } from './paper.js';

const TAU = Math.PI * 2;

// 圆形光晕贴图（供辉光/台灯窗光/拖尾复用）——绝不留直角
export function glowTexture(n = 256, rgb = '255,236,168', inner = .9) {
  const c = cv(n, n), x = c.getContext('2d'), h = n / 2;
  const g = x.createRadialGradient(h, h, 0, h, h, h);
  g.addColorStop(0, `rgba(${rgb},${inner})`);
  g.addColorStop(.28, `rgba(${rgb},${inner * .46})`);
  g.addColorStop(.62, `rgba(${rgb},${inner * .13})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.beginPath(); x.arc(h, h, h, 0, TAU); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// 萤火虫本体：紧贴身体的柔光 + 两片半透明翅膀 + 暖黄绿圆点身体（热核/腹部渐变）
export function fireflyTexture(n = 256) {
  const c = cv(n, n), x = c.getContext('2d'), cx = n / 2, cy = n / 2, S = n / 256;
  const halo = (r, a, rgb) => {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(.35, `rgba(${rgb},${a * .40})`);
    g.addColorStop(.7, `rgba(${rgb},${a * .10})`); g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
  };
  x.save(); x.globalCompositeOperation = 'lighter';
  halo(66 * S, .34, '232,255,160');
  x.restore();
  // 两片半透明翅膀（上后方展开，带薄边）
  for (const sd of [-1, 1]) {
    x.save(); x.translate(cx, cy - 4 * S); x.rotate(sd * .6);
    const wg = x.createRadialGradient(0, -42 * S, 2, 0, -42 * S, 54 * S);
    wg.addColorStop(0, 'rgba(255,255,248,.80)');
    wg.addColorStop(.42, 'rgba(244,255,220,.44)');
    wg.addColorStop(.82, 'rgba(222,255,190,.16)');
    wg.addColorStop(1, 'rgba(210,255,186,0)');
    x.fillStyle = wg; x.beginPath(); x.ellipse(0, -42 * S, 26 * S, 50 * S, 0, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(255,255,240,.42)'; x.lineWidth = 2 * S;
    x.beginPath(); x.ellipse(0, -42 * S, 26 * S, 50 * S, 0, 0, TAU); x.stroke();
    x.restore();
  }
  // 圆点身体：白热内芯 → 暖黄绿 → 边缘柔化（腹部一道渐变），整体不溢出直角
  const bx = cx, by = cy + 3 * S, brx = 34 * S, bry = 41 * S;
  const body = x.createRadialGradient(bx - 8 * S, by - 12 * S, 1, bx, by, bry);
  body.addColorStop(0, 'rgba(255,255,242,1)');
  body.addColorStop(.30, 'rgba(252,255,196,.98)');
  body.addColorStop(.62, 'rgba(232,252,132,.94)');
  body.addColorStop(.86, 'rgba(204,238,96,.72)');
  body.addColorStop(1, 'rgba(186,226,80,0)');
  x.fillStyle = body; x.beginPath(); x.ellipse(bx, by, brx, bry, 0, 0, TAU); x.fill();
  // 腹部两节（软弧，不做硬边）
  x.strokeStyle = 'rgba(226,250,150,.30)'; x.lineWidth = 3.2 * S; x.lineCap = 'round';
  for (let k = 0; k < 2; k++) { x.beginPath(); x.arc(bx, by - 2 * S, (14 + k * 11) * S, .55, Math.PI - .55); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

let TEX = null, GT = null;
export function fireflyTex() { return TEX || (TEX = fireflyTexture(256)); }
export function flyGlowTex() { return GT || (GT = glowTexture(256, '214,255,150', .85)); }

// 一组飞舞的萤火虫（圆点身体 + 微拖尾），返回 { update(t, glow) }
export function fireflyCluster(parent, o = {}) {
  const n = o.n ?? 5, R = o.radius ?? .0118, H = o.height ?? .028, scale = o.scale ?? .0075;
  const trailN = o.trail ?? 3;
  const tScale = o.trailScale ?? .42;
  const list = [];
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    const trail = [];
    for (let k = trailN - 1; k >= 0; k--) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flyGlowTex(), color: new THREE.Color('#cdf76e'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      g.add(s); trail.push(s);
    }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: flyGlowTex(), color: new THREE.Color('#e8ff9a'), transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending }));
    g.add(halo);
    const body = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireflyTex(), color: new THREE.Color('#ffffff'), transparent: true, opacity: .95, depthWrite: false }));
    g.add(body); parent.add(g);
    list.push({ g, body, halo, trail, i });
  }
  // 瓶内盘旋轨迹（与 v2 同一路径族，保证与既有动画一致）
  const pos = (i, t, out) => {
    const a = t * 1.6 + i * 1.26;
    out[0] = Math.cos(a) * R * .42;
    out[1] = Math.sin(a * 1.4 + i) * H * .30;
    out[2] = Math.sin(a * .7) * R * .26;
    return out;
  };
  const tmp = [0, 0, 0];
  return {
    list,
    update(t, glow) {
      for (const f of list) {
        const i = f.i;
        const br = .5 + .5 * Math.sin(t * 3.1 + i * 1.9);          // 呼吸式明暗
        pos(i, t, tmp);
        f.body.position.set(tmp[0], tmp[1], tmp[2]);
        f.body.scale.setScalar(scale * (.86 + .14 * br));
        f.body.material.opacity = Math.min(1, .35 + glow * .75);
        f.halo.position.set(tmp[0], tmp[1], tmp[2]);
        f.halo.scale.setScalar(scale * (.85 + .3 * br));
        f.halo.material.opacity = glow * (.2 + .34 * br);
        for (let k = 0; k < f.trail.length; k++) {
          const lag = (k + 1) * .09;
          pos(i, t - lag, tmp);
          const s = f.trail[k];
          s.position.set(tmp[0], tmp[1], tmp[2]);
          s.scale.setScalar(scale * tScale * (1.1 - k * .28) * (.9 + .1 * br));
          s.material.opacity = glow * (.4 - k * .11) * (.7 + .3 * br);
        }
      }
    },
  };
}
