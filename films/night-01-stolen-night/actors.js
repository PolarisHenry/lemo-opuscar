// 角色：团团（正/背两面，逐帧重画姿势）、扎扎（抱玻璃瓶 + 瓶内萤火虫辉光）
import * as THREE from 'three';
import * as A from './art.js';
import { cv, INK } from './paper.js';
import { texOf } from './book.js';
import { cutMesh, blobShadow } from './cutmesh.js';
import { clamp, lerp } from './lib.js';
import { fireflyCluster, glowTexture } from './firefly.js';

function dynPlane(c, h, ax, ay, side) {
  const t = texOf(c), w = h * c.width / c.height;
  const g = new THREE.PlaneGeometry(w, h); g.translate(w / 2 - ax * w, ay * h - h / 2, 0);
  const m = new THREE.MeshStandardMaterial({ map: t, alphaTest: .5, alphaToCoverage: true, roughness: .85, side });
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true;
  mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: .5, side: THREE.DoubleSide });
  return { mesh, t };
}

export function makeTuanTuan(H = .0384) {
  const cF = cv(A.TT_W, A.TT_H), cB = cv(A.TT_W, A.TT_H);
  A.drawTuanTuan(cF.getContext('2d'), {}); A.drawTuanTuanBack(cB.getContext('2d'), {});
  const ay = 1500 / A.TT_H;   // 锚点：脚底（画布 1560 高）
  const F = dynPlane(cF, H, .5, ay, THREE.FrontSide), B = dynPlane(cB, H, .5, ay, THREE.BackSide);
  F.mesh.castShadow = true;
  const root = new THREE.Group(), body = new THREE.Group(); body.add(F.mesh, B.mesh); root.add(body);
  const shadow = blobShadow(H * .3, .5);
  let key = '';
  return {
    root, body, shadow, H,
    pose(p) {
      const k = JSON.stringify(p, (kk, v) => typeof v === 'number' ? Math.round(v * 40) / 40 : v);
      if (k === key) return; key = k;
      A.drawTuanTuan(cF.getContext('2d'), p); A.drawTuanTuanBack(cB.getContext('2d'), p); F.t.needsUpdate = B.t.needsUpdate = true;
    },
    head(v = new THREE.Vector3()) { return v.set(0, H * .55, 0).applyMatrix4(body.matrixWorld); },
    // 掌心位置（递星星的手对手交接；2头身新比例：胸口高度）
    palm(side, v = new THREE.Vector3()) { return v.set(side * H * .13, H * .3, 0).applyMatrix4(body.matrixWorld); },
  };
}

export function makeZaza(D = .04) {
  const c = cv(A.ZZ_W, A.ZZ_H); A.drawZaza(c.getContext('2d'), {});
  const ay = 762 / A.ZZ_H;
  const F = dynPlane(c, D * .92, .5, ay, THREE.DoubleSide); F.mesh.castShadow = true;
  const root = new THREE.Group(), spin = new THREE.Group(); spin.add(F.mesh); spin.position.y = 0; root.add(spin);
  const shadow = blobShadow(D * .5, .45);

  // ---- 玻璃瓶（在两爪之间） ----
  const jar = new THREE.Group();
  const JR = .0118, JH = .028;
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(JR, JR * .88, JH, 20, 1, true),
    new THREE.MeshPhysicalMaterial({ color: '#cfe8ea', transparent: true, opacity: .3, roughness: .12, metalness: 0, side: THREE.DoubleSide, depthWrite: false }));
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(JR * .88, 20), new THREE.MeshStandardMaterial({ color: '#b9d8da', transparent: true, opacity: .5, roughness: .3 }));
  bottom.rotation.x = -Math.PI / 2; bottom.position.y = -JH / 2 + .0002;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(JR * .8, JR * .92, .005, 16, 1, true), glass.material);
  neck.position.y = JH / 2 + .0025;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(JR * .92, JR * .92, .006, 16), new THREE.MeshStandardMaterial({ color: '#d9a05f', roughness: .8 }));
  lid.position.y = JH / 2 + .006;
  jar.add(glass, bottom, neck, lid);
  // 瓶内辉光（程序化圆形光晕，无外部贴图）+ 程序化萤火虫群（圆身/翅膀/拖尾）
  const glowMat = new THREE.SpriteMaterial({ map: glowTexture(256, '255,236,175', .95), color: new THREE.Color('#ffffff'), transparent: true, opacity: .85, depthWrite: false, blending: THREE.AdditiveBlending });
  const glow = new THREE.Sprite(glowMat); glow.scale.setScalar(JR * 2.3); jar.add(glow);
  const cluster = fireflyCluster(jar, { n: 5, radius: JR, height: JH, scale: .0092, trail: 3 });
  const light = new THREE.PointLight('#ffe9a0', 0, .06, 0); light.position.z = .006; jar.add(light);
  jar.position.set(0, D * .52, .013);
  root.add(jar);

  let key = '';
  return {
    root, spin, shadow, jar, lid, glow, cluster, light, JR, JH, D,
    pose(p) { const k = JSON.stringify(p, (kk, v) => typeof v === 'number' ? Math.round(v * 20) / 20 : v); if (k === key) return; key = k; A.drawZaza(c.getContext('2d'), p); F.t.needsUpdate = true; },
    head(v = new THREE.Vector3()) { return v.set(0, D * .8, .002).applyMatrix4(root.matrixWorld); },
    // 掌心（接星星）
    palm(v = new THREE.Vector3()) { return v.set(0, D * .48, .016).applyMatrix4(root.matrixWorld); },
    setGlow(g) { glowMat.opacity = .1 + g * .45; glow.scale.setScalar(JR * (1.15 + g * .75)); light.intensity = g * .45; },
    updateFlies(t, g) { cluster.update(t, g); },
  };
}
