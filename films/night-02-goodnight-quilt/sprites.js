// 贴纸角色与道具卡管理（纸片立体书·第二夜）
import * as THREE from 'three';
import { cv } from './paper.js';
import { cutMesh, blobShadow } from './cutmesh.js';

const PX = 4.3548e-5;                 // 贴纸画布像素 → 世界米
const FULL = { w: 920 * PX, h: 1240 * PX };
const BUST = { w: 920 * PX, h: 820 * PX };

export const SPRITES = {
  // 团团
  view_front: FULL, view_side: FULL, view_back: FULL,
  pose_holdstar: FULL, pose_earpull: FULL,
  expr_happy: FULL, expr_sleepy: FULL, expr_shy: FULL, expr_surprised: FULL, expr_asleep: FULL,
  // 扎扎（刺猬）
  zaza_stand: { w: 1051 * PX * 0.9, h: 1268 * PX * 0.9 },
  zaza_holdbottle: { w: 1035 * PX * 0.9, h: 1268 * PX * 0.9 },
  // 豆豆（小田鼠）
  doudou_stand: { w: 1162 * PX * 0.75, h: 1226 * PX * 0.75 },
  doudou_sleep: { w: 1157 * PX * 0.75, h: 1227 * PX * 0.75 },
  // 月亮婆婆
  grandma_moon: { w: 1591 * PX * 1.5, h: 1795 * PX * 1.5 },
};

const cache = new Map();

export function preloadSprites() {
  const tl = new THREE.TextureLoader();
  const jobs = [];
  for (const name of Object.keys(SPRITES)) {
    jobs.push(new Promise((res, rej) => {
      tl.load(`assets/sprites/${name}.png`, t => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        cache.set(name, t);
        res();
      }, undefined, () => rej(new Error('sprite load fail: ' + name)));
    }));
  }
  return Promise.all(jobs);
}

export function makeTuanTuan() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const cards = {};
  const tuanNames = [
    'view_front', 'view_side', 'view_back', 'pose_holdstar', 'pose_earpull',
    'expr_happy', 'expr_sleepy', 'expr_shy', 'expr_surprised', 'expr_asleep'
  ];
  for (const name of tuanNames) {
    const dim = SPRITES[name];
    const item = { c: cv(4, 4), w: dim.w, h: dim.h, ax: .5, ay: 1 };
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
      if (cur && cards[cur]) cards[cur].visible = false;
      cur = name;
      if (cards[cur]) cards[cur].visible = true;
    },
    pose(p) { if (p && p.sprite) this.setSprite(p.sprite); },
    head(v = new THREE.Vector3()) {
      const hh = SPRITES[cur] ? SPRITES[cur].h : FULL.h;
      return v.set(0, hh * .92, 0).applyMatrix4(body.matrixWorld);
    },
    palm(side, v = new THREE.Vector3()) {
      const hh = SPRITES[cur] ? SPRITES[cur].h : FULL.h;
      return v.set(side * hh * .16, hh * .34, .002).applyMatrix4(body.matrixWorld);
    },
  };
}

export function makeZaza() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const cards = {};
  for (const name of ['zaza_stand', 'zaza_holdbottle']) {
    const dim = SPRITES[name];
    const item = { c: cv(4, 4), w: dim.w, h: dim.h, ax: .5, ay: 1 };
    const g = cutMesh(item, { tex: cache.get(name), shadow: true });
    g.visible = false; body.add(g); cards[name] = g;
  }
  let cur = 'zaza_stand';
  cards[cur].visible = true;
  const dim = SPRITES[cur];
  const shadow = blobShadow(dim.h * .35, .5);
  return {
    root, body, shadow, H: dim.h,
    setSprite(name) {
      if (name === cur || !cards[name]) return;
      cards[cur].visible = false;
      cur = name;
      cards[cur].visible = true;
    }
  };
}

export function makeDoudou() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const cards = {};
  for (const name of ['doudou_stand', 'doudou_sleep']) {
    const dim = SPRITES[name];
    const item = { c: cv(4, 4), w: dim.w, h: dim.h, ax: .5, ay: 1 };
    const g = cutMesh(item, { tex: cache.get(name), shadow: true });
    g.visible = false; body.add(g); cards[name] = g;
  }
  let cur = 'doudou_stand';
  cards[cur].visible = true;
  const dim = SPRITES[cur];
  const shadow = blobShadow(dim.h * .30, .45);
  return {
    root, body, shadow, H: dim.h,
    setSprite(name) {
      if (name === cur || !cards[name]) return;
      cards[cur].visible = false;
      cur = name;
      cards[cur].visible = true;
    }
  };
}

export function makeGrandmaMoon() {
  const root = new THREE.Group();
  const dim = SPRITES.grandma_moon;
  const item = { c: cv(4, 4), w: dim.w, h: dim.h, ax: .5, ay: .5 };
  const g = cutMesh(item, { tex: cache.get('grandma_moon'), shadow: true });
  root.add(g);
  return { root, H: dim.h, W: dim.w };
}
