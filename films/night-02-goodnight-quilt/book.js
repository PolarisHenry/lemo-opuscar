// 立体书：书脊在远端（z=0），封面向后翻到 90° 立起来当舞台背景
import * as THREE from 'three';
import { cv, paperFill, GRAIN } from './paper.js';
import { mulberry, clamp } from './lib.js';

export const BW = 0.44, BD = 0.30;       // 书页宽（x）× 深（z）
export const BT = 0.0035, HB = 0.014;    // 封板厚、半本书页厚
export const PG = BT + HB;               // 下半本页面高度

export function texOf(c, o = {}) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  return t;
}

// 书页边（细横线）
function edgeCanvas() {
  const c = cv(512, 64), x = c.getContext('2d'); x.fillStyle = '#efe6d2'; x.fillRect(0, 0, 512, 64);
  const R = mulberry(9);
  for (let i = 0; i < 64; i += 1.3) { x.fillStyle = `rgba(150,130,100,${.08 + R() * .18})`; x.fillRect(0, i, 512, .6); }
  return c;
}

// 布面封面 + 烫金标题；同时生成 roughness(g)/metalness(b) 贴图
export function coverCanvases(spritesArg, meta = {}) {
  const title = meta.title || '小兔团团';
  const episode = meta.episode || '第二夜';
  const epTitle = meta.epTitle || '晚安被子去旅行';
  const series = meta.series || '一页纸森林';
  const tagline = meta.tagline || '起风了，被子飞走了！团团翻开书页追了一整夜……';

  // sprites 兼容：既支持函数 (x, px, py, w, h)，也支持对象 { tuan, zaza, moon }
  let drawPipIcon = null, tuanImg = null, zazaImg = null, moonImg = null;
  if (typeof spritesArg === 'function') {
    drawPipIcon = spritesArg;
  } else if (spritesArg && typeof spritesArg === 'object') {
    tuanImg = spritesArg.tuan || null;
    zazaImg = spritesArg.zaza || null;
    moonImg = spritesArg.moon || null;
  }

  const w = 2048, h = Math.round(2048 * BD / BW);
  const c = cv(w, h), x = c.getContext('2d');
  const m = cv(w, h), y = m.getContext('2d');

  // 1. 午夜宝蓝天鹅绒布纹背景
  const bgGrad = x.createRadialGradient(w * 0.42, h * 0.5, 100, w * 0.5, h * 0.5, w * 0.75);
  bgGrad.addColorStop(0, '#152945');   // 柔和深群青
  bgGrad.addColorStop(0.55, '#0e1c31'); // 普鲁士蓝
  bgGrad.addColorStop(1, '#070f1c');   // 极深墨夜蓝
  x.fillStyle = bgGrad;
  x.fillRect(0, 0, w, h);

  // 细致布面交错纤维质感
  const R = mulberry(42);
  for (let i = 0; i < h; i += 2.5) {
    x.fillStyle = `rgba(0,0,0,${0.04 + R() * 0.05})`;
    x.fillRect(0, i, w, 1.2);
  }
  for (let i = 0; i < w; i += 2.5) {
    x.fillStyle = `rgba(255,255,255,${0.015 + R() * 0.03})`;
    x.fillRect(i, 0, 1.2, h);
  }
  // 暗角与氛围微晕
  for (let i = 0; i < 60; i++) {
    const px = R() * w, py = R() * h, r = 80 + R() * 320;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(${R() < 0.4 ? '4,8,16' : '30,60,95'},${0.08 * R()})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(px - r, py - r, 2 * r, 2 * r);
  }

  // 漫天金色星尘（微小闪烁粒子）
  for (let i = 0; i < 90; i++) {
    const sx = 80 + R() * (w - 160), sy = 80 + R() * (h - 160);
    const sr = 1.0 + R() * 2.2;
    x.fillStyle = `rgba(255, 235, 170, ${0.15 + R() * 0.45})`;
    x.beginPath();
    x.arc(sx, sy, sr, 0, Math.PI * 2);
    x.fill();
    if (R() > 0.75) {
      x.strokeStyle = `rgba(255, 240, 190, ${0.2 + R() * 0.4})`;
      x.lineWidth = 0.8;
      x.beginPath();
      x.moveTo(sx - sr * 2.5, sy); x.lineTo(sx + sr * 2.5, sy);
      x.moveTo(sx, sy - sr * 2.5); x.lineTo(sx, sy + sr * 2.5);
      x.stroke();
    }
  }

  // PBR 贴图底色（绿色通道 roughness=0.92 磨砂布，蓝色通道 metalness=0）
  y.fillStyle = 'rgb(0,235,0)';
  y.fillRect(0, 0, w, h);

  // 烫金着色工具函数（同时绘制漫反射颜色与金属度贴图）
  const GOLD = '#f0c765';
  const GOLD_HIGHLIGHT = '#fff0a8';
  const GOLD_SHADOW = '#855512';
  const both = fn => {
    x.save(); fn(x, GOLD); x.restore();
    y.save(); fn(y, 'rgb(0,80,255)'); y.restore(); // roughness=80 (0.31), metalness=255 (1.0)
  };

  // 2. 古典童话烫金边框与华丽角花
  const pad = 64;
  both((k, col) => {
    k.strokeStyle = col;
    k.lineWidth = 8;
    k.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
    k.lineWidth = 3;
    k.strokeRect(pad + 18, pad + 18, w - (pad + 18) * 2, h - (pad + 18) * 2);

    // 四角华丽星月角花 (Corner Filigree)
    const corners = [
      [pad + 18, pad + 18, 1, 1],
      [w - pad - 18, pad + 18, -1, 1],
      [pad + 18, h - pad - 18, 1, -1],
      [w - pad - 18, h - pad - 18, -1, -1]
    ];
    for (const [cx, cy, sx, sy] of corners) {
      k.save();
      k.translate(cx, cy);
      k.scale(sx, sy);
      k.lineWidth = 2.5;
      k.beginPath();
      k.arc(36, 36, 26, Math.PI, Math.PI * 1.5);
      k.stroke();
      k.beginPath();
      k.arc(52, 52, 38, Math.PI, Math.PI * 1.5);
      k.stroke();

      k.fillStyle = col;
      k.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, r = i % 2 ? 8 : 22;
        k.lineTo(24 + Math.cos(a) * r, 24 + Math.sin(a) * r);
      }
      k.closePath();
      k.fill();

      for (const [bx, by] of [[68, 14], [14, 68], [76, 38], [38, 76]]) {
        k.beginPath();
        k.arc(bx, by, 4.5, 0, Math.PI * 2);
        k.fill();
      }
      k.restore();
    }

    // 顶边中心：烫金星月徽记
    const tcx = w * 0.5, tcy = pad + 18;
    k.fillStyle = col;
    k.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, r = i % 2 ? 6 : 18;
      k.lineTo(tcx + Math.cos(a) * r, tcy + Math.sin(a) * r);
    }
    k.closePath();
    k.fill();
    k.lineWidth = 2;
    k.beginPath();
    k.moveTo(tcx - 120, tcy); k.lineTo(tcx - 30, tcy);
    k.moveTo(tcx + 30, tcy); k.lineTo(tcx + 120, tcy);
    k.stroke();
  });

  const FONT = '"ZCOOL KuaiLe", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

  // 3. 左侧：拱形微缩童话画框 (Hero Illustration Arch Window)
  const aw = 580, ah = 780;
  const acx = w * 0.28, acy = h * 0.52;
  const ax0 = acx - aw / 2, ay0 = acy - ah / 2;

  const archPath = (ctx, pad = 0) => {
    const rx = ax0 - pad, ry = ay0 - pad, rw = aw + pad * 2, rh = ah + pad * 2;
    const r = rw / 2;
    ctx.beginPath();
    ctx.moveTo(rx, ry + rh);
    ctx.lineTo(rx, ry + r);
    ctx.arc(rx + r, ry + r, r, Math.PI, 0);
    ctx.lineTo(rx + rw, ry + rh);
    ctx.closePath();
  };

  both((k, col) => {
    k.strokeStyle = col;
    k.lineWidth = 14;
    archPath(k, 10);
    k.stroke();
    k.lineWidth = 3;
    archPath(k, 22);
    k.stroke();
    k.fillStyle = col;
    const px = acx, py = ay0 - 10;
    k.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, r = i % 2 ? 8 : 24;
      k.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r);
    }
    k.closePath();
    k.fill();
  });

  x.save();
  archPath(x, 0);
  x.clip();

  const skyGrad = x.createLinearGradient(acx, ay0, acx, ay0 + ah);
  skyGrad.addColorStop(0, '#101c32');
  skyGrad.addColorStop(0.45, '#1e3352');
  skyGrad.addColorStop(0.75, '#28464a');
  skyGrad.addColorStop(1, '#1b382d');
  x.fillStyle = skyGrad;
  x.fillRect(ax0, ay0, aw, ah);

  const IR = mulberry(88);
  for (let i = 0; i < 40; i++) {
    const sx = ax0 + IR() * aw, sy = ay0 + IR() * (ah * 0.65);
    const sr = 1.0 + IR() * 2.5;
    x.fillStyle = `rgba(255, 245, 200, ${0.3 + IR() * 0.6})`;
    x.beginPath();
    x.arc(sx, sy, sr, 0, Math.PI * 2);
    x.fill();
  }

  if (moonImg) {
    const mw = 180, mh = 180 * (moonImg.height / moonImg.width);
    const mx = ax0 + aw - mw - 25, my = ay0 + 40;
    const mg = x.createRadialGradient(mx + mw * 0.5, my + mh * 0.5, 20, mx + mw * 0.5, my + mh * 0.5, 140);
    mg.addColorStop(0, 'rgba(255, 235, 140, 0.45)');
    mg.addColorStop(1, 'rgba(255, 235, 140, 0)');
    x.fillStyle = mg;
    x.fillRect(mx - 60, my - 60, mw + 120, mh + 120);
    x.drawImage(moonImg, mx, my, mw, mh);
  }

  x.fillStyle = '#173132';
  x.beginPath();
  x.ellipse(acx - 80, ay0 + ah * 0.76, aw * 0.7, 100, 0, 0, Math.PI * 2);
  x.fill();

  x.fillStyle = '#264b38';
  x.beginPath();
  x.ellipse(acx, ay0 + ah * 0.92, aw * 0.68, 120, 0, 0, Math.PI * 2);
  x.fill();

  x.fillStyle = '#447b52';
  x.beginPath();
  x.ellipse(acx + 20, ay0 + ah * 0.95, aw * 0.45, 60, 0, 0, Math.PI * 2);
  x.fill();

  if (tuanImg && zazaImg) {
    const zw = 210, zh = zw * (zazaImg.height / zazaImg.width);
    const zx = acx + 50, zy = ay0 + ah - zh - 20;
    x.drawImage(zazaImg, zx, zy, zw, zh);

    const tw = 320, th = tw * (tuanImg.height / tuanImg.width);
    const tx = acx - 170, ty = ay0 + ah - th - 35;

    const starCenter = [tx + tw * 0.72, ty + th * 0.48];
    const sg = x.createRadialGradient(starCenter[0], starCenter[1], 10, starCenter[0], starCenter[1], 160);
    sg.addColorStop(0, 'rgba(255, 235, 110, 0.65)');
    sg.addColorStop(0.5, 'rgba(255, 210, 70, 0.25)');
    sg.addColorStop(1, 'rgba(255, 200, 50, 0)');
    x.fillStyle = sg;
    x.fillRect(starCenter[0] - 160, starCenter[1] - 160, 320, 320);

    x.drawImage(tuanImg, tx, ty, tw, th);
  } else if (drawPipIcon) {
    drawPipIcon(x, ax0 + aw * 0.2, ay0 + ah * 0.25, aw * 0.6, ah * 0.6);
  }

  const fireflies = [
    [ax0 + 80, ay0 + ah * 0.58, 4.5],
    [ax0 + 130, ay0 + ah * 0.42, 3.5],
    [ax0 + aw - 100, ay0 + ah * 0.65, 4.0],
  ];
  for (const [fx, fy, fr] of fireflies) {
    const fg = x.createRadialGradient(fx, fy, 1, fx, fy, fr * 4);
    fg.addColorStop(0, 'rgba(255, 245, 140, 0.9)');
    fg.addColorStop(0.4, 'rgba(255, 230, 80, 0.4)');
    fg.addColorStop(1, 'rgba(255, 230, 80, 0)');
    x.fillStyle = fg;
    x.fillRect(fx - fr * 4, fy - fr * 4, fr * 8, fr * 8);
    x.fillStyle = '#fffec8';
    x.beginPath();
    x.arc(fx, fy, fr, 0, Math.PI * 2);
    x.fill();
  }
  x.restore();

  // 4. 右侧：华丽烫金童话标题排版体系
  const rx = w * 0.70;

  both((k, col) => {
    k.textAlign = 'center';
    k.textBaseline = 'alphabetic';

    // 4.1 顶部品牌系列名
    k.fillStyle = col;
    k.font = `500 44px ${FONT}`;
    k.fillText(`✦   ${series} · 睡 前 治 愈 绘 本   ✦`, rx, h * 0.22);

    // 4.2 主标题《小兔团团》
    k.font = `bold 162px ${FONT}`;
    if (k === x) {
      k.fillStyle = GOLD_SHADOW;
      k.fillText(title, rx + 4, h * 0.44 + 4);
      k.fillStyle = col;
      k.fillText(title, rx, h * 0.44);
      k.fillStyle = GOLD_HIGHLIGHT;
      k.font = `bold 160px ${FONT}`;
      k.fillText(title, rx - 1, h * 0.44 - 2);
    } else {
      k.fillText(title, rx, h * 0.44);
    }

    // 4.3 烫金分隔线与星徽
    k.lineWidth = 3;
    k.strokeStyle = col;
    k.beginPath();
    k.moveTo(rx - 340, h * 0.50);
    k.lineTo(rx - 60, h * 0.50);
    k.moveTo(rx + 60, h * 0.50);
    k.lineTo(rx + 340, h * 0.50);
    k.stroke();

    k.fillStyle = col;
    k.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, r = i % 2 ? 7 : 18;
      k.lineTo(rx + Math.cos(a) * r, h * 0.50 + Math.sin(a) * r);
    }
    k.closePath();
    k.fill();

    // 4.4 分集标（第一夜 · 《谁把黑夜偷走了》）
    k.font = `bold 76px ${FONT}`;
    if (k === x) {
      k.fillStyle = GOLD_SHADOW;
      k.fillText(`${episode} · 《${epTitle}》`, rx + 3, h * 0.63 + 3);
      k.fillStyle = col;
      k.fillText(`${episode} · 《${epTitle}》`, rx, h * 0.63);
    } else {
      k.fillText(`${episode} · 《${epTitle}》`, rx, h * 0.63);
    }

    // 4.5 故事核心剧情小钩子
    if (k === x) {
      k.fillStyle = '#f5ebd7';
      k.font = `400 36px ${FONT}`;
      k.fillText(tagline, rx, h * 0.73);
    }

    // 4.6 底部治愈金句
    k.fillStyle = col;
    k.font = `500 40px ${FONT}`;
    k.fillText('~ 每晚翻一页森林 · 把黑夜过慢一点 ~', rx, h * 0.83);

    k.lineWidth = 2;
    k.beginPath();
    k.arc(rx - 40, h * 0.88, 14, 0, Math.PI);
    k.arc(rx + 40, h * 0.88, 14, 0, Math.PI);
    k.stroke();
    k.beginPath();
    k.arc(rx, h * 0.88, 5, 0, Math.PI * 2);
    k.fill();
  });

  return { c, m };
}

export function makeBook(cover) {
  const root = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: '#0f1f35', roughness: .85 });
  const edge = texOf(edgeCanvas()); edge.wrapS = edge.wrapT = THREE.RepeatWrapping;
  const edgeMat = new THREE.MeshStandardMaterial({ map: edge, roughness: .95 });
  const pageTop = new THREE.MeshStandardMaterial({ color: '#f3ead6', roughness: .95 });

  // 下半本：封板 + 书页块
  const lb = new THREE.Mesh(new THREE.BoxGeometry(BW + .012, BT, BD + .006), cloth); lb.position.set(0, BT / 2, BD / 2 + .002);
  const lp = new THREE.Mesh(new THREE.BoxGeometry(BW, HB, BD - .002), [edgeMat, edgeMat, pageTop, pageTop, edgeMat, edgeMat]); lp.position.set(0, BT + HB / 2, BD / 2);
  for (const m of [lb, lp]) { m.castShadow = m.receiveShadow = true; root.add(m); }
  // 书脊
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(PG, PG, BW + .012, 24, 1, false, Math.PI, Math.PI), cloth);
  spine.rotation.z = Math.PI / 2; spine.position.set(0, PG, -.001); spine.castShadow = true; root.add(spine);

  const hinge = new THREE.Group(); hinge.position.set(0, PG, 0); root.add(hinge);
  const upper = new THREE.Group(); hinge.add(upper);
  const open = new THREE.Group(); open.rotation.x = Math.PI / 2; upper.add(open);
  // 打开状态坐标（open 帧 = 立起时的世界朝向）：背景页在 z=0 朝 +z，书块在 z<0
  const up = new THREE.Mesh(new THREE.BoxGeometry(BW, BD - .002, HB), [edgeMat, edgeMat, edgeMat, edgeMat, pageTop, pageTop]); up.position.set(0, BD / 2, -HB / 2);
  const ub = new THREE.Mesh(new THREE.BoxGeometry(BW + .012, BD + .006, BT), cloth); ub.position.set(0, BD / 2 + .002, -HB - BT / 2);
  const coverTex = texOf(cover.c), mr = texOf(cover.m, { linear: true });
  const coverMat = new THREE.MeshStandardMaterial({ map: coverTex, roughnessMap: mr, metalnessMap: mr, roughness: 1, metalness: 1 });
  const cp = new THREE.Mesh(new THREE.PlaneGeometry(BW + .008, BD + .002), coverMat); cp.rotation.x = Math.PI; cp.position.set(0, BD / 2 + .002, -HB - BT - .0003);
  for (const m of [up, ub, cp]) { m.castShadow = m.receiveShadow = true; open.add(m); }

  // 地面页（stage 帧）与背景页（open 帧），带书沟弯曲
  const groundGeo = new THREE.PlaneGeometry(BW - .006, BD - .004, 1, 30); groundGeo.rotateX(-Math.PI / 2); groundGeo.translate(0, 0, BD / 2);
  gutter(groundGeo, 'z');
  const groundMat = new THREE.MeshStandardMaterial({ roughness: .92, color: '#ffffff' });
  const ground = new THREE.Mesh(groundGeo, groundMat); ground.position.y = .0003; ground.receiveShadow = true;
  const stage = new THREE.Group(); hinge.add(stage); stage.add(ground);
  const backGeo = new THREE.PlaneGeometry(BW - .006, BD - .004, 1, 30); backGeo.translate(0, BD / 2, 0); gutter(backGeo, 'y');
  const backMat = new THREE.MeshStandardMaterial({ roughness: .92, color: '#ffffff' });
  const back = new THREE.Mesh(backGeo, backMat); back.position.z = .0003; back.receiveShadow = true; open.add(back);
  const sky = new THREE.Group(); open.add(sky);

  // 翻页：一张弯曲的纸，正面=旧地面，背面=新天空
  const NS = 40, mkLeafGeo = () => { const g = new THREE.PlaneGeometry(BW - .008, 1, 1, NS); return g; };
  const lf = mkLeafGeo(), lb2 = mkLeafGeo();
  const leafFront = new THREE.Mesh(lf, new THREE.MeshStandardMaterial({ roughness: .92, side: THREE.FrontSide }));
  const leafBack = new THREE.Mesh(lb2, new THREE.MeshStandardMaterial({ roughness: .92, side: THREE.BackSide }));
  // UV：正面 v=1 在书沟；背面 v=1 在自由端（立起后在上）
  const uvF = lf.attributes.uv, uvB = lb2.attributes.uv;
  for (let i = 0; i < uvF.count; i++) { const v = uvF.getY(i); /* v:1 顶行 → s=0 */ uvB.setY(i, 1 - v); }
  uvB.needsUpdate = true;
  for (const m of [leafFront, leafBack]) { m.material.emissive = new THREE.Color(.42, .4, .38); m.castShadow = true; m.receiveShadow = true; m.visible = false; stage.add(m); }
  function setLeaf(u, bendAmt = .55) {
    const vis = u > 0 && u < 1; leafFront.visible = leafBack.visible = vis; if (!vis) return;
    const th = Math.PI / 2 * u, L = bendAmt * Math.sin(Math.PI * u);
    for (const g of [lf, lb2]) {
      const p = g.attributes.position, n = NS + 1;
      // PlaneGeometry 顶点顺序：行 iy=0..NS（y 从 +0.5 到 -0.5），每行 2 个
      let zz = 0, yy = 0;
      const col = [];
      for (let iy = 0; iy <= NS; iy++) {
        const s = iy / NS;
        if (iy > 0) { const phi = th * (1 - L * (s - .5 / NS)) + (1 - u) * 0; zz += Math.cos(phi) * BD / NS; yy += Math.sin(phi) * BD / NS; }
        col.push([yy, zz]);
      }
      for (let iy = 0; iy <= NS; iy++) for (let ix = 0; ix < 2; ix++) { const k = iy * 2 + ix; p.setY(k, col[iy][0] + .0009); p.setZ(k, col[iy][1]); }
      p.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
    }
  }

  function setOpen(th) { upper.rotation.x = -th; }
  return { root, hinge, upper, open, stage, sky, ground, back, groundMat, backMat, leafFront, leafBack, setLeaf, setOpen, coverMat };
}

function gutter(g, axis) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const d = axis === 'z' ? p.getZ(i) : p.getY(i), dip = -.0045 * Math.exp(-d / .012);
    if (axis === 'z') p.setY(i, p.getY(i) + dip); else p.setZ(i, p.getZ(i) + dip);
  }
  g.computeVertexNormals();
}
