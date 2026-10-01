// 团团 = 贴纸卡（v4 核心）：参考图精切贴纸 → 剪纸卡片（白边贴纸自带）+ 引擎变换（呼吸/弹跳/微旋转）
// 情绪/姿势 = 换贴纸；不做骨骼。接口与 v3 makeTuanTuan 兼容：{root, body, shadow, H, setSprite, pose, head, palm}
import * as THREE from 'three';
import { cv } from './paper.js';
import { texOf } from './book.js';
import { cutMesh, blobShadow } from './cutmesh.js';

const PX = 4.3548e-5;                 // 贴纸画布像素 → 世界米（全身卡 1240px = 0.054m）
const FULL = { w: 920 * PX, h: 1240 * PX };   // 0.0400 × 0.0540
const BUST = { w: 920 * PX, h: 820 * PX };    // 0.0400 × 0.0357

const SPRITES = {
  view_front: FULL, view_side: FULL, view_back: FULL,
  pose_holdstar: FULL, pose_earpull: FULL,
  expr_happy: FULL, expr_sleepy: FULL, expr_shy: FULL, expr_surprised: FULL, expr_asleep: FULL,
};

const cache = new Map();
export function preloadSprites() {
  const tl = new THREE.TextureLoader();
  const jobs = [];
  for (const name of Object.keys(SPRITES)) {
    jobs.push(new Promise((res, rej) => {
      tl.load(`assets/sprites/${name}.png`, t => {
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
        cache.set(name, t); res();
      }, undefined, () => rej(new Error('sprite load fail: ' + name)));
    }));
  }
  return Promise.all(jobs);
}

export function makeTuanTuan() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const cards = {};
  for (const [name, dim] of Object.entries(SPRITES)) {
    const item = { c: cv(4, 4), w: dim.w, h: dim.h, ax: .5, ay: 1 };   // 锚点：底中心（ay=1 = 根在卡底）
    const g = cutMesh(item, { tex: cache.get(name), shadow: true });
    g.visible = false; body.add(g); cards[name] = g;
  }
  let cur = '';
  const shadow = blobShadow(FULL.h * .30, .5);
  const H = FULL.h;
  return {
    root, body, shadow, H, cards,
    get sprite() { return cur; },
    setSprite(name) {
      if (name === cur || !SPRITES[name]) return;
      if (cur) cards[cur].visible = false;
      cur = name; cards[cur].visible = true;
    },
    // 兼容旧调用：pose({sprite:'view_front', ...})
    pose(p) { if (p && p.sprite) this.setSprite(p.sprite); },
    head(v = new THREE.Vector3()) {
      const hh = SPRITES[cur] ? SPRITES[cur].h : FULL.h;
      return v.set(0, hh * .92, 0).applyMatrix4(body.matrixWorld);
    },
    // 掌心（递星星）：胸口高度
    palm(side, v = new THREE.Vector3()) {
      const hh = SPRITES[cur] ? SPRITES[cur].h : FULL.h;
      return v.set(side * hh * .16, hh * .34, .002).applyMatrix4(body.matrixWorld);
    },
  };
}
