// 《谁把黑夜偷走了》v4 主程序：竖屏场景 + 贴纸团团 + 时间轴 + render(t)
// 基于 fresh demo 引擎；沿用 v3 验证方案（萤火虫 Canvas 程序化 / 纯矢量折纸星 / 开场节奏）
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as L from './lib.js';
import { clamp, lerp, seg, ss, eio, eo, back, TAU, mulberry, track, spring } from './lib.js';
import * as A from './art.js';
import { cv } from './paper.js';
import { makeBook, coverCanvases, texOf, BW, BD, PG } from './book.js';
import { pages, buildSets, buildSlats, updatePops, RISE, FOLD } from './sets.js';
import { makeZaza } from './actors.js';
import { makeTuanTuan, preloadSprites } from './sprites.js';
import { cutMesh, particles, blobShadow, thread } from './cutmesh.js';
import { glowTexture, fireflyTexture } from './firefly.js';
import { drawFold, FOLD_PX } from './fold.js';
import { makePost } from './post.js';
import { DUR, OPEN, TURNS, SLAT_T, LID_T, MOON_T, STAR_POP, HANDOVER, FOLD_T, LAMP_OFF, NIGHT_T, TITLE, SUBTITLE } from './story.js';
import * as HUD from './hud.js';

const W = 1080, H = 1920;
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('stage').appendChild(renderer.domElement);
const ov = document.getElementById('ov'), OX = ov.getContext('2d');

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(32, W / H, .004, 30);
const post = makePost(renderer, scene, cam, W, H);

// ---------- 资源 ----------
const fontList = ['500 40px Fredoka', '700 40px Fredoka', '40px "ZCOOL KuaiLe"', '44px "ZCOOL KuaiLe"', '56px "ZCOOL KuaiLe"', '72px "ZCOOL KuaiLe"', '86px "ZCOOL KuaiLe"', '192px "ZCOOL KuaiLe"'];
await Promise.all(fontList.map(f => document.fonts.load(f, '一页纸森林晚安口袋星星小兔团团第一夜谁把黑夜偷走了绘本故事治愈睡前每晚翻过慢一点')));
await document.fonts.ready;
const DURS = await (await fetch('assets/voices/dur.json')).json();
await preloadSprites();
// 封面插图用贴纸
const coverImg = await new Promise(res => { const im = new Image(); im.onload = () => res(im); im.src = 'assets/sprites/view_front.png'; });

const hdr = await new RGBELoader().loadAsync('assets/lythwood_lounge_2k.hdr'); hdr.mapping = THREE.EquirectangularReflectionMapping;
scene.environment = hdr; scene.background = hdr; scene.backgroundBlurriness = .22;
const ENV_YAW = parseFloat(new URLSearchParams(location.search).get('yaw') || '2.1');
scene.backgroundRotation.set(0, ENV_YAW, 0); scene.environmentRotation.set(0, ENV_YAW, 0);

const tl = new THREE.TextureLoader();
const wt = n => { const t = tl.load(`assets/walnut_${n}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2.2, 1.4); t.anisotropy = 12; return t; };
const wdiff = wt('diff'); wdiff.colorSpace = THREE.SRGBColorSpace;
const desk = new THREE.Mesh(new THREE.BoxGeometry(2.6, .04, 1.7), new THREE.MeshStandardMaterial({ map: wdiff, normalMap: wt('nor'), roughnessMap: wt('rough'), color: '#8a7a68', envMapIntensity: .8 }));
desk.position.set(0, -.02, .25); desk.receiveShadow = true; scene.add(desk);

const gl = new GLTFLoader();
async function prop(name, x, z, s, ry) {
  const m = (await gl.loadAsync(`assets/${name}/${name}.gltf`)).scene;
  m.position.set(x, 0, z); m.scale.setScalar(s); m.rotation.y = ry;
  m.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  scene.add(m); return m;
}
// 台灯在书后方（画面顶部），从头亮到 LAMP_OFF 咔哒熄灭
const lamp = await prop('desk_lamp_arm_01', -.13, -.33, .55, 2.6);
let lampHeadPos = new THREE.Vector3(-.115, .38, -.27);
lamp.traverse(o => { if (o.isMesh && o.material.name.includes('light')) { o.material = o.material.clone(); o.material.emissive = new THREE.Color('#ffd9a0'); o.material.emissiveIntensity = 6; lampHeadPos = o.getWorldPosition(new THREE.Vector3()); } });
const clock = await prop('alarm_clock_01', .34, -.22, 1.05, -2.4);
clock.traverse(o => { if (o.isMesh && o.material.name.includes('Glass')) { o.material = o.material.clone(); o.material.transparent = true; o.material.roughness = .05; o.castShadow = false; } });
// 铅笔（前景，画面底部）
{
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.0038, .0038, .15, 6), new THREE.MeshStandardMaterial({ color: '#f2b632', roughness: .5 }));
  const wood = new THREE.Mesh(new THREE.CylinderGeometry(.0038, .0008, .018, 6), new THREE.MeshStandardMaterial({ color: '#e8c79a', roughness: .8 }));
  const lead = new THREE.Mesh(new THREE.CylinderGeometry(.0008, .0001, .004, 6), new THREE.MeshStandardMaterial({ color: '#333', roughness: .4 }));
  const ferr = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .012, 12), new THREE.MeshStandardMaterial({ color: '#c9c2b0', metalness: 1, roughness: .3 }));
  const eras = new THREE.Mesh(new THREE.CylinderGeometry(.0039, .0039, .01, 12), new THREE.MeshStandardMaterial({ color: '#e88a8a', roughness: .9 }));
  wood.position.y = .084; lead.position.y = .095; ferr.position.y = -.081; eras.position.y = -.092;
  g.add(body, wood, lead, ferr, eras); g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  g.rotation.set(0, .4, Math.PI / 2); g.position.set(.09, .0038, .55); scene.add(g);
}

// ---------- 书 ----------
const cover = coverCanvases((x, px, py, w, h) => { x.drawImage(coverImg, px, py, w, h); }, {
  title: TITLE,
  episode: '第一夜',
  epTitle: '谁把黑夜偷走了',
  series: '一页纸森林',
});
const book = makeBook(cover);
scene.add(book.root);
const P = pages(), PT = {}; for (const k in P) PT[k] = texOf(P[k]);
const SPREAD = [{ sky: PT.sky0, ground: PT.ground0 }, { sky: PT.sky1, ground: PT.ground1 }, { sky: PT.sky2night, ground: PT.ground2, skyLeaf: PT.sky2bright }];
const { L: POPS, ex: EX } = buildSets(book);
buildSlats(book, PT.sky2bright, PT.sky2night, EX);

// ---------- 角色 ----------
const tuan = makeTuanTuan(); book.stage.add(tuan.root); book.stage.add(tuan.shadow);
const zaza = makeZaza(); book.stage.add(zaza.root); book.stage.add(zaza.shadow);

// ---------- 纸星星（礼物） ----------
const starG = new THREE.Group(); starG.add(cutMesh(A.star(.0115)));
const starLight = new THREE.PointLight('#ffd9a0', 0, .075, 2); starLight.position.set(0, 0, .01); starG.add(starLight);
{ // 星星自发光（灯灭后成为画面主光）
  const sm = starG.children[0].userData.front.material;
  sm.emissive = new THREE.Color(.55, .45, .22); sm.emissiveMap = sm.map; sm.emissiveIntensity = 0;
}
const starGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(256, '255,224,150', .9), color: new THREE.Color('#ffffff'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
starGlow.scale.setScalar(.05); starG.add(starGlow);
book.stage.add(starG);
const starShadow = blobShadow(.012, .3); book.stage.add(starShadow);

// ---------- 月亮婆婆（挂线，夜空翻出后升起） ----------
const moonG = new THREE.Group();
moonG.add(cutMesh(A.moonGrandma(.05)));
const moonThread = thread(.42); moonThread.position.set(0, 0, -.0004); moonG.add(moonThread);
moonG.position.set(-.06, .44, .03); moonG.visible = false; book.sky.add(moonG);

// ---------- 窗光（结尾：纸窗透出暖光） ----------
const winGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(256, '255,217,150', .85), color: new THREE.Color('#ffffff'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
winGlow.scale.setScalar(.085); winGlow.position.set(-.155, .052, .082); book.stage.add(winGlow);

// ---------- 从书页折星星：纯矢量折纸（v3 验证方案） ----------
const FOLD_REG = { x0: .09, x1: .215, z0: .17, z1: .30 };
const foldCv = cv(FOLD_PX, FOLD_PX), foldTex = texOf(foldCv);
{
  const FMW = .132, FMH = .132;
  const g = new THREE.PlaneGeometry(FMW, FMH); g.rotateX(-Math.PI / 2);
  const m = new THREE.MeshStandardMaterial({ map: foldTex, transparent: true, alphaTest: .04, roughness: .92, emissive: new THREE.Color(.44, .42, .39), emissiveMap: foldTex });
  var foldPlane = new THREE.Mesh(g, m);
  foldPlane.position.set((FOLD_REG.x0 + FOLD_REG.x1) / 2, .0009, (FOLD_REG.z0 + FOLD_REG.z1) / 2);
  foldPlane.castShadow = true; foldPlane.receiveShadow = true;
  foldPlane.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: foldTex, alphaTest: .5 });
  book.stage.add(foldPlane);
}

// ---------- 灯光 ----------
const spot = new THREE.SpotLight('#ffdfae', 0, 3, .8, .6, 2); spot.position.copy(lampHeadPos); spot.target.position.set(.0, .02, .1);
spot.castShadow = true; spot.shadow.mapSize.set(4096, 4096); spot.shadow.bias = -.00006; spot.shadow.normalBias = .0004; spot.shadow.radius = 5; spot.shadow.camera.near = .05; spot.shadow.camera.far = 2;
scene.add(spot, spot.target);
const bulb = new THREE.PointLight('#ffcf94', 0, .8, 2); bulb.position.copy(lampHeadPos).add(new THREE.Vector3(0, -.02, .02)); scene.add(bulb);
const sun = new THREE.DirectionalLight('#fff3e0', 0); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -.00008; sun.shadow.normalBias = .0003; sun.shadow.radius = 4;
Object.assign(sun.shadow.camera, { left: -.3, right: .3, top: .3, bottom: -.3, near: .1, far: 3 }); sun.target.position.set(0, .05, .12); scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight('#cfe6ff', '#caa27a', 0); scene.add(hemi);
const nightFill = new THREE.PointLight('#8fa4e8', 0, .5, 2); nightFill.position.set(0, .3, .3); scene.add(nightFill);

// ---------- 粒子 ----------
function spriteTex(fn, n = 64) { const c = cv(n, n), x = c.getContext('2d'); fn(x, n); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const glowTex = spriteTex((x, n) => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); });
const starTex = spriteTex((x, n) => { x.translate(n / 2, n / 2); x.fillStyle = '#fff'; x.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r = i % 2 ? n * .1 : n * .48; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill(); const g = x.createRadialGradient(0, 0, 0, 0, 0, n * .3); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(-n / 2, -n / 2, n, n); }, 128);
const puffTex = spriteTex((x, n) => { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, g = x.createRadialGradient(n / 2 + Math.cos(a) * n * .15, n / 2 + Math.sin(a) * n * .15, 0, n / 2 + Math.cos(a) * n * .15, n / 2 + Math.sin(a) * n * .15, n * .3); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); } }, 128);
const quad = new THREE.PlaneGeometry(1, 1);
const addMat = (map, col) => new THREE.MeshBasicMaterial({ map, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: true });
const camQ = new THREE.Quaternion();
function billboard(fn) { return (i, t) => { const p = fn(i, t); if (p) { const e = new THREE.Euler().setFromQuaternion(camQ); p.rx = e.x; p.ry = e.y; p.rz = e.z + (p.spin || 0); } return p; }; }
const PS = [];
// 开书金色星光
const sparkle = particles(quad, addMat(starTex, new THREE.Color(2.4, 1.9, .9)), 100, billboard((i, t) => {
  const R = mulberry(i * 13 + 5), t0 = OPEN[0] + .55 + R() * 1.7, life = 1.1 + R() * 1.0, k = (t - t0) / life; if (k < 0 || k > 1) return null;
  const x = lerp(-.2, .2, R()), z = lerp(.02, .28, R());
  return { x: x + Math.sin(k * 6 + i) * .01, y: k * (.07 + R() * .09), z, s: .006 * Math.sin(k * Math.PI) * (.5 + R()), spin: t * 2 + i };
}));
book.stage.add(sparkle); PS.push(sparkle);
// 萤火虫升空（瓶口 → 夜空，化作星星）：Canvas 程序化贴图（v3 验证方案）
const SKY_N = 11, SKY_TRAIL = 3;
PS.push(particles(quad, addMat(fireflyTexture(256), new THREE.Color(2.05, 2.25, .95)), SKY_N * SKY_TRAIL, billboard((i, t) => {
  const fi = Math.floor(i / SKY_TRAIL), tr = i % SKY_TRAIL, lag = tr * .085, tt = t - lag;
  const t0 = 31.0 + (fi % 6) * .16 + Math.floor(fi / 6) * .22, life = 1.15 + (fi % 3) * .12, k = (tt - t0) / life;
  if (k < 0 || k > 1) return null;
  const R = mulberry(fi * 5 + 3);
  const sx = .055, sy = .03, sz = .168;
  const ex = lerp(-.19, .19, R()), ey = .13 + R() * .13, ez = .02 + R() * .025;
  const a = k * TAU * 2 + fi;
  const bring = .62 + .38 * Math.sin(tt * 6 + fi * 2);
  const fade = tr === 0 ? 1 : .34 - tr * .07;
  return {
    x: lerp(sx, ex, k) + Math.cos(a) * .022 * (1 - k), y: lerp(sy, ey, eo(k)) + Math.sin(k * Math.PI * 2 + fi) * .006, z: lerp(sz, ez, k) + Math.sin(a) * .012 * (1 - k),
    s: .0082 * (tr === 0 ? 1 : .78 - tr * .16) * Math.sin(Math.min(k * 1.12, 1) * Math.PI) ** .6 * bring,
    col: new THREE.Color(2.05 * fade, 2.25 * fade, .95 * fade),
  };
})));
book.stage.add(PS[PS.length - 1]);
// 纸星星 pop 时的白烟
const puffMat = new THREE.MeshBasicMaterial({ map: puffTex, transparent: true, depthWrite: false, color: '#fff6e0' });
const puffs = particles(quad, puffMat, 7, billboard((i, t) => {
  const k = (t - STAR_POP) / .55; if (k < 0 || k > 1) return null;
  const a = i / 7 * TAU, r = .014 * eo(k);
  return { x: .13 + Math.cos(a) * r, y: .006 + Math.abs(Math.sin(a)) * r * .6, z: .215 + Math.sin(a) * r * .3, s: .014 * (.6 + k) * (1 - k * k) };
}));
book.stage.add(puffs); PS.push(puffs);
// 夜空小星星（翻板后闪烁）
const twinks = [];
{
  const R = mulberry(77);
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: new THREE.Color('#fff4d0'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.set(lerp(-.2, .2, R()), .05 + R() * .24, .012 + R() * .03);
    s.scale.setScalar(.006 + R() * .006);
    book.sky.add(s); twinks.push({ s, d: i * .06 + R() * .3, ph: R() * 9 });
  }
}

// ---------- 编舞（贴纸版：换贴纸 + 变换，不做骨骼） ----------
const blinkAt = t => { const p = t % 3.9; return p < .12 ? Math.sin(p / .12 * Math.PI) : 0; };
function hopWalk(t, t0, t1, a, b, hopH = .008) {
  const k = seg(t, t0, t1);
  const x = lerp(a[0], b[0], k), z = lerp(a[1], b[1], k);
  const dist = Math.hypot(b[0] - a[0], b[1] - a[1]) * k;
  const ph = dist / .045 * TAU;
  return { x, z, ph, y: Math.abs(Math.sin(ph)) * hopH, moving: t > t0 && t < t1 };
}

const ZAZA_POS = [.055, .155];
const BUST_LIFT = 0;   // 全身贴纸统一落地，无需额外抬升
function jarGlow(t) {
  const flare = 1 + .25 * Math.sin(t * 2.1);
  let g = seg(t, 16.52, 17.70) * flare;
  g *= 1 - .62 * seg(t, 21.00, 25.15);
  g *= 1 - .35 * seg(t, 28.19, 32.68);
  const burst = seg(t, 41.60, 41.87) * (1 - seg(t, 42.05, 43.07));
  return clamp(g + burst * 1.4, 0, 1.6);
}

function tuanState(t) {
  const S = { vis: false, x: -.03, y: 0, z: .185, face: 1, sy: 1, sx: 1, tilt: 0, sprite: 'view_front', hopN: 0 };
  const bob = (amp = .0006) => { S.y += Math.abs(Math.sin(t * 2.2)) * amp; S.tilt += Math.sin(t * 1.1) * .02; };
  const land = (t0, d = .18, amt = .25) => { const k = seg(t, t0, t0 + d); if (k > 0 && k < 1) { const s = Math.sin(k * Math.PI) * amt; S.sy *= 1 - s; S.sx *= 1 + s * .7; } };

  // ---- 跨页0：被吵醒 ----
  if (t < 2.0) return S;
  if (t < 9.45) {
    S.vis = true; S.x = -.03; S.z = .215;   // 前移：避开 z .21-.26 的前景小花（半身脸位低）
    const pop = back(seg(t, 2.0, 2.35), 1.9); S.sy *= pop; S.sx *= lerp(.7, 1, pop);
    if (t < 4.76) { S.sprite = 'expr_surprised'; S.x = -.028; S.y = BUST_LIFT; S.tilt = Math.sin(t * 2.2) * .06; }   // 惊讶四顾（半身贴纸）
    else if (t < 8.88) { S.sprite = 'expr_shy'; S.y = BUST_LIFT; S.sy *= 1 - .04 * Math.sin(t * 5); S.tilt = Math.sin(t * 1.4) * .04; }  // 委屈低头
    else { S.sprite = 'view_front'; S.tilt = -.06 * seg(t, 8.88, 9.39); }   // 下定决心
    bob();
    return S;
  }
  // ---- 跨页1：循光翻查 ----
  if (t < 10.98) return S;
  if (t < 15.03) {
    S.vis = true;
    if (t < 11.42) { const w = hopWalk(t, 11.04, 11.36, [-.16, .16], [-.14, .158], .004); S.x = w.x; S.z = w.z; S.sprite = 'view_side'; S.face = -1; }
    else if (t < 13.40) {
      const w = hopWalk(t, 11.36, 13.34, [-.14, .158], [.06, .152]);
      S.x = w.x; S.z = w.z; S.sprite = t > 12.49 ? 'pose_earpull' : 'view_side'; S.face = -1;
      if (w.moving) { S.y = w.y; S.tilt = Math.sin(w.ph) * .05; S.hopN = Math.floor(w.ph / Math.PI); }
    }
    else if (t < 14.31) { S.x = .06; S.z = .152; S.sprite = 'view_front'; S.tilt = .1; bob(); }  // 望向亮处
    else { const w = hopWalk(t, 14.31, 14.96, [.06, .152], [.13, .15]); S.x = w.x; S.z = w.z; S.sprite = 'view_side'; S.face = -1; if (w.moving) { S.y = w.y; S.tilt = Math.sin(w.ph) * .05; S.hopN = Math.floor(w.ph / Math.PI); } }
    return S;
  }
  // ---- 跨页2：发现 → 倾听 → 折星星 → 递星 ----
  if (t < 16.59) return S;
  S.vis = true;
  if (t < 18.08) { const w = hopWalk(t, 16.65, 17.89, [-.13, .17], [-.035, .16]); S.x = w.x; S.z = w.z; S.sprite = 'view_side'; S.face = -1; if (w.moving) { S.y = w.y; S.tilt = Math.sin(w.ph) * .05; S.hopN = Math.floor(w.ph / Math.PI); } }
  else if (t < 26.95) {  // 看着瓶光变暗（n04 同步）
    S.x = -.035; S.z = .16; S.sprite = t < 21.78 ? 'expr_surprised' : 'view_front';
    if (t < 21.78) { S.y = BUST_LIFT; S.tilt = Math.sin(t * 1.6) * .04; } else bob(.0004);
    if (t > 23.86) S.sx *= 1 + .02 * Math.sin(t * 3);   // 微微前倾的担忧
  }
  else if (t < 32.79) {   // 蹲下来听扎扎说（n05 同步）
    S.x = -.035; S.z = .163; S.sprite = 'view_front'; S.tilt = .12;
    S.sy *= 1 - .1 * seg(t, 27.35, 28.28);
    bob(.0003);
  }
  else if (t < 38.93) {  // ★签名：从书页上折星星（与纸张折叠深度交互）
    if (t < 33.37) {
      const w = hopWalk(t, 32.85, 33.37, [-.035, .163], [.092, .228], .005);
      S.x = w.x; S.z = w.z; S.sprite = 'view_side'; S.face = -1;
      if (w.moving) { S.y = w.y; S.tilt = Math.sin(w.ph) * .05; S.hopN = Math.floor(w.ph / Math.PI); }
    } else if (t < 37.8) {
      // 站在折纸左边缘，侧身面对纸张（face=-1），双手下倾压痕
      S.x = .092; S.z = .228; S.sprite = 'view_side'; S.face = -1;
      let press = 0;
      for (const [a, b] of FOLD_T) {
        const k = seg(t, a, b);
        if (k > 0 && k < 1) press = Math.sin(k * Math.PI);
      }
      // 每次折线翻折时：探身下压（tilt 前倾、x 前移靠近折线、y 降低贴近纸面、sy 挤压发力）
      S.tilt = -.12 - .25 * press;
      S.x = .092 + .014 * press;
      S.y = -.0028 * press;
      S.sy *= 1 - .12 * press;
      S.sx *= 1 + .06 * press;
      bob(.0002);
    } else {
      // 折完纸星成型：稍退半步，惊喜转身期待
      const bk = seg(t, 37.8, 38.5);
      S.x = lerp(.092, .085, bk); S.z = .225;
      S.sprite = bk > .4 ? 'expr_happy' : 'view_front'; S.face = 1;
      S.tilt = .08 * (1 - bk);
      S.sy *= 1 + .05 * Math.sin((t - 37.8) * 8);
    }
  }
  else if (t < 39.45) {  // 星星 pop：开心特写
    S.x = .088; S.z = .225; S.sprite = 'expr_happy'; S.y = BUST_LIFT;
    const k = spring(Math.max(0, t - STAR_POP - .1), 9, .5); S.sy *= lerp(1, 1.12, k * .5); S.tilt = -.08;
    land(STAR_POP + .05, .15, .12);
  }
  else if (t < 40.69) {  // 蹦到扎扎面前递星星（捧星）
    const w = hopWalk(t, 39.45, 40.63, [.088, .225], [-.005, .175], .006);
    S.x = w.x; S.z = w.z; S.sprite = t > 39.84 ? 'pose_holdstar' : 'view_side'; S.face = 1;
    if (w.moving) { S.y = w.y; S.tilt = Math.sin(w.ph) * .04; S.hopN = Math.floor(w.ph / Math.PI); }
    if (t > 39.84) S.tilt = -.05;
  }
  else if (t < 42.75) { S.x = -.005; S.z = .175; S.sprite = t < 41.54 ? 'pose_holdstar' : 'view_front'; S.face = 1; S.tilt = -.04; bob(.0004); }
  else if (t < 44.22) {  // 蹦上木桩
    const w = hopWalk(t, 43.13, 43.96, [-.005, .175], [-.098, .192], .009);
    S.x = w.x; S.z = w.z; S.sprite = t > 43.64 ? 'view_front' : 'view_side'; S.face = 1;
    if (w.moving) { S.y = w.y; S.tilt = Math.sin(w.ph) * .05; S.hopN = Math.floor(w.ph / Math.PI); }
  }
  else {
    // 坐木桩看星空（靠窗）
    S.x = -.098; S.z = .192; S.y = .0265; S.sprite = 'view_front';
    S.tilt = Math.sin(t * .9) * .03;
    bob(.0002);
    if (t > 46.32 && t < 47.19) { S.sprite = 'expr_sleepy'; S.y = .0265 + BUST_LIFT; }       // 打哈欠（金句前）
    else if (t > 50.91) { S.sprite = 'expr_asleep'; S.y = .0265 + BUST_LIFT; }              // 灯灭后睡着
    else if (t > 49.30) { S.sprite = 'expr_sleepy'; S.y = .0265 + BUST_LIFT; }
  }
  return S;
}

function zazaState(t) {
  const S = { vis: false, x: ZAZA_POS[0], y: 0, z: ZAZA_POS[1], sy: 1, sx: 1, pose: { mood: 'scared', blink: blinkAt(t + 1.3), look: [-.5, .1] }, rot: 0, hopN: 0 };
  if (t < 16.59 || t >= DUR) return S;
  S.vis = true;
  const k = back(seg(t, 16.59, 17.37), 1.7);
  S.sy = k; S.sx = .7 + .3 * k;
  if (t < 26.95) {
    S.pose.mood = 'scared';
    if (t > 19.12) { S.sy *= 1 - .08 * Math.sin(t * 4); }
  } else if (t < 32.79) {
    S.pose.mood = 'sorry'; S.pose.look = [-.2, -.6];
    S.sy *= lerp(1, .88, seg(t, 27.16, 28.47)); S.sx *= lerp(1, 1.06, seg(t, 27.16, 28.47));
    if (t > 31.55) S.pose.blink = 1;
  } else if (t < 39.06) {
    S.pose.mood = 'scared'; S.pose.look = [.5, .3];
    S.sy = lerp(.88, 1, seg(t, 33.57, 34.88)); S.sx = lerp(1.06, 1, seg(t, 33.57, 34.88));
    S.rot = Math.sin(t * 2.2) * .04;
  } else if (t < 43.07) {
    S.pose.mood = 'happy'; S.pose.look = [-.2, .35];
    S.rot = Math.sin(t * 3) * .03;
  } else if (t < 44.22) {
    const w = hopWalk(t, 43.26, 44.02, [.055, .155], [-.044, .188], .007);
    S.x = w.x; S.z = w.z; S.y = w.y; S.hopN = Math.floor(w.ph / Math.PI);
    S.pose.mood = 'happy'; S.pose.look = [-.3, .3];
    return S;
  }
  if (t >= 44.22) {
    S.x = -.044; S.z = .188; S.y = .026;
    S.pose.mood = 'happy'; S.pose.look = [-.25, .75];
    S.rot = Math.sin(t * 1.3) * .015;
  }
  return S;
}

// ---------- 摄像机（竖屏 1080×1920，v3 验证机位 + 结尾延长定帧） ----------
const SH = [
  [ // 1 封面特写静止展示 → 翻开绘本 → 钩子全景 → 推近团团
    [0.0, .015, .58, .88, 0, .015, .15, 40, 3.4, .75],
    [1.1, .015, .54, .82, 0, .015, .15, 39, 3.2, .70],
    [2.1, .015, .18, .47, -.005, .05, .14, 34, 2.6, .38],
    [2.8, .005, .15, .44, -.01, .055, .15, 34, 2.6, .35],
    [3.53, -.028, .105, .32, -.032, .048, .173, 31, 2.5, .26],
    [6.48, -.04, .093, .30, -.033, .046, .174, 30, 2.4, .24],
    [9.45, .0, .2, .52, 0, .07, .13, 32, 2.0, .45],
  ],
  [ // 2 跨页1 跟拍团团循光
    [10.98, -.135, .105, .46, -.1, .045, .15, 30, 2.4, .3],
    [12.81, -.04, .1, .43, -.01, .05, .155, 30, 2.4, .28],
    [14.44, .055, .1, .42, .075, .05, .152, 30, 2.4, .27],
    [15.03, .0, .19, .51, .01, .07, .13, 32, 2.0, .42],
  ],
  [ // 3 跨页2 发现 → 瓶光渐暗 → 双人认错
    [16.52, -.115, .12, .47, -.012, .05, .15, 31, 2.5, .32],
    [18.21, -.028, .115, .48, .004, .048, .156, 32, 2.5, .32],
    [20.23, -.012, .095, .46, .008, .046, .157, 34, 2.6, .31],
    [23.99, -.010, .10, .56, .002, .046, .156, 36, 2.8, .38],
    [32.79, -.010, .10, .56, .002, .046, .156, 36, 2.8, .38],
  ],
  [ // 4 ★签名机位：侧俯折纸（团团+折纸区同框） → 交接
    [32.79, .005, .15, .435, .093, .018, .238, 34, 2.8, .42],
    [34.35, .012, .122, .405, .096, .015, .234, 33, 2.7, .37],
    [38.80, .018, .105, .385, .098, .025, .23, 32, 2.6, .34],
    [40.11, .045, .175, .32, .02, .05, .18, 31, 2.7, .3],
    [41.81, .025, .17, .42, .022, .07, .155, 35, 2.6, .32],
  ],
  [ // 5 萤火虫升空 → 翻板变夜空 → 摇臂升起
    [41.81, .035, .19, .50, .015, .10, .10, 37, 2.8, .42],
    [43.39, .015, .185, .46, .0, .115, .07, 36, 2.8, .42],
    [45.42, 0.0, .17, .45, -.012, .13, .05, 36, 2.9, .40],
    [46.69, -.01, .16, .46, -.03, .13, .05, 36, 2.9, .4],
  ],
  [ // 6 金句定帧 → 台灯熄灭 → 纸星亮 → 黑场（近乎静止，定帧 >2s）
    [46.69, -.04, .12, .385, -.075, .09, .163, 45, 2.9, .34],
    [55.0, -.0415, .122, .392, -.077, .092, .163, 45, 2.9, .34],
  ],
];
const SHOTS = SH.map(keys => ({ t0: keys[0][0], f: track(keys.map(k => [k[0], [...k.slice(1)]])) }));
function camAt(t) {
  let s = SHOTS[0]; for (const S of SHOTS) if (t >= S.t0) s = S;
  const v = s.f(t);
  return { pos: new THREE.Vector3(v[0], v[1], v[2]), tgt: new THREE.Vector3(v[3], v[4], v[5]), fov: v[6], aper: v[7], focus: v[8] };
}

// ---------- 灯光时间轴（v4：台灯从头亮，LAMP_OFF 咔哒熄灭 → 纸星/星夜接管） ----------
function lightsAt(t) {
  const inStory = seg(t, OPEN[1], OPEN[1] + .5) * (1 - seg(t, SLAT_T + .2, SLAT_T + 1.3));
  const dim = seg(t, 21.00, 25.15);
  const night = seg(t, SLAT_T + .2, SLAT_T + 1.3);
  // 台灯：全程亮，38.45 咔哒熄灭（带 0.2s 挣扎闪烁）
  const offK = seg(t, LAMP_OFF, LAMP_OFF + .05);
  const flick = offK > 0 && t < LAMP_OFF + .38 ? Math.max(0, Math.sin((t - LAMP_OFF) * 46)) * (1 - seg(t, LAMP_OFF + .1, LAMP_OFF + .38)) : 0;
  const lampI = 1.0 * (1 - offK) + flick * .5;
  const sunI = inStory * (2.15 - dim * 1.35) * (1 - night);
  const sunCol = new THREE.Color('#fff3e0').lerp(new THREE.Color('#ffc978'), dim).lerp(new THREE.Color('#8fa4e8'), night);
  return {
    sunI, sunCol, lampI,
    hemiI: .16 + inStory * .42 - dim * .12 - night * .32 - offK * .1,
    envI: .3 + inStory * .16 - night * .18 - offK * .22,
    bgI: .45 + inStory * .1 - night * .2 - offK * .3,
    nightI: night * .5 + offK * .12,
    exposure: 1.02 - dim * .05 - night * .15 - offK * .1 + flick * .04,
  };
}

// ---------- 音效事件（给 mix.py） ----------
const EV = [];
EV.push({ t: OPEN[0], type: 'creak' }, { t: OPEN[1] - .12, type: 'thump' }, { t: OPEN[0] + .55, type: 'sparkle', d: 1.7 });
for (const r of POPS) { const t0 = RISE[r.spread] + r.d; EV.push({ t: t0 + .1, type: 'pop', s: r.spread }); }
for (const [a, b] of TURNS) { EV.push({ t: a + .1, type: 'wind', d: b - a }); EV.push({ t: a + .45, type: 'page', d: b - a - .7 }); }
for (const [a, b] of FOLD_T) EV.push({ t: a + .08, type: 'fold', d: b - a });
EV.push({ t: STAR_POP - .05, type: 'sparkle', d: 1.4 }, { t: STAR_POP, type: 'poof' }, { t: STAR_POP + .02, type: 'starpop' });
EV.push({ t: HANDOVER[1], type: 'give' });
EV.push({ t: LID_T, type: 'ting' }, { t: LID_T + .15, type: 'whoosh', d: 1.2 });
for (let i = 0; i < 4; i++) EV.push({ t: SLAT_T + i * .28 + .3, type: 'clack' });
EX.stars.forEach((s, i) => EV.push({ t: 43.64 + i * .09, type: 'tink' }));
EV.push({ t: MOON_T, type: 'moon' });
EV.push({ t: LAMP_OFF, type: 'lampoff' });
EV.push({ t: NIGHT_T + .1, type: 'night' });
for (const e of HUD.blipTimes()) EV.push(e);
{ let prev = 0; for (let f = 0; f < DUR * 60; f++) { const t = f / 60, s = tuanState(t); const n = s.vis ? s.hopN : 0; if (n > prev && t > 1.3) EV.push({ t: t - .03, type: 'hop' }); prev = n; } }
{ let prev = 0; for (let f = 0; f < DUR * 60; f++) { const t = f / 60, s = zazaState(t); const n = s.vis ? s.hopN : 0; if (n > prev && t > 12) EV.push({ t: t - .03, type: 'hop', z: 1 }); prev = n; } }
EV.sort((a, b) => a.t - b.t);
window.EV = EV; window.DUR = DUR;

// ---------- 渲染 ----------
const tmpV = new THREE.Vector3();
function toScreen(v) { const p = v.clone().project(cam); if (p.z > 1) return null; return [(p.x * .5 + .5) * W, (-p.y * .5 + .5) * H]; }

window.render = function (t) {
  // ---- 书 ----
  const op = eio(seg(t, OPEN[0], OPEN[1])), wob = t > OPEN[0] - .15 && t < OPEN[0] ? Math.sin(t * 60) * .002 * seg(t, OPEN[0] - .15, OPEN[0]) : 0;
  book.setOpen(Math.PI / 2 * op + wob - Math.sin(seg(t, OPEN[1] - .1, OPEN[1] + .4) * Math.PI) * .04);
  let spread = 0; for (let i = 0; i < 2; i++) if (t >= TURNS[i][0] + .45) spread = i + 1;
  let turning = -1; for (let i = 0; i < 2; i++) if (t >= TURNS[i][0] + .45 && t < TURNS[i][1] - .3) turning = i;
  book.groundMat.map = SPREAD[spread].ground; book.groundMat.needsUpdate = true;
  const skyIdx = turning >= 0 ? turning : spread; book.backMat.map = SPREAD[skyIdx].sky; book.backMat.needsUpdate = true;
  if (turning >= 0) {
    const a = TURNS[turning][0] + .45, b = TURNS[turning][1] - .3;
    book.leafFront.material.map = SPREAD[turning].ground; book.leafBack.material.map = SPREAD[turning + 1].skyLeaf || SPREAD[turning + 1].sky;
    book.leafFront.material.emissiveMap = book.leafFront.material.map; book.leafBack.material.emissiveMap = book.leafBack.material.map;
    book.leafFront.material.needsUpdate = book.leafBack.material.needsUpdate = true;
    book.setLeaf(eio(seg(t, a, b)));
  } else book.setLeaf(0);
  updatePops(POPS, t);
  // 翻板：跨页2 到达后盖住背景（日亮面），SLAT_T 起逐条翻成夜空
  const s2vis = t > RISE[2] - .1;
  EX.slats.forEach((g, i) => {
    g.visible = s2vis;
    g.rotation.y = Math.PI * eio(seg(t, SLAT_T + i * .28, SLAT_T + i * .28 + .7));
  });
  // 月亮婆婆升起
  moonG.visible = t > MOON_T - .4;
  moonG.position.y = .44 - spring(Math.max(0, t - MOON_T), 5, .5) * .255;
  moonG.rotation.z = Math.sin(t * 1.1) * .03;
  // 挂线纸星星垂落 + 摇曳
  for (const s of EX.stars) {
    const k = t - 43.64 - s.d; s.g.visible = t > 43.51;
    s.g.position.y = .4 - (k > 0 ? spring(k, 5, .4) * (.4 - s.y) : 0);
    s.g.rotation.z = Math.sin(t * 1.5 + s.ph) * .08;
  }
  // 纸云（翻板后飘高退场）
  for (const c of EX.clouds) { c.g.visible = t > RISE[2] && t < SLAT_T + 1.6; c.g.position.y = c.y + ss(seg(t, SLAT_T + .6, SLAT_T + 1.6)) * .18; c.g.rotation.z = Math.sin(t * .8 + c.ph) * .03; }
  // 夜空小星星闪烁（灯灭后更亮）
  const offK = seg(t, LAMP_OFF, LAMP_OFF + .05);
  for (const tw of twinks) { const on = seg(t, SLAT_T + .5 + tw.d, SLAT_T + 1.1 + tw.d); tw.s.material.opacity = on * (.35 + .45 * Math.abs(Math.sin(t * 2.1 + tw.ph))) * (1 + offK * .6); }
  // 窗光（灯灭后窗光变主光）
  winGlow.material.opacity = .5 * seg(t, 45.17, 46.44) + offK * .35;
  moonG.children[0].userData.moonGlow && (moonG.children[0].userData.moonGlow.material.opacity = .5 + offK * .4);

  // ---- 扎扎 ----
  const zs = zazaState(t);
  zaza.root.visible = zaza.shadow.visible = zs.vis;
  if (zs.vis) {
    zaza.pose(zs.pose);
    zaza.root.position.set(zs.x, zs.y, zs.z);
    zaza.root.scale.set(zs.sx, zs.sy, 1);
    zaza.spin.rotation.z = zs.rot;
    zaza.shadow.position.set(zs.x, .0004, zs.z);
    zaza.shadow.scale.setScalar(clamp(1 - zs.y * 10, .4, 1));
    const g = jarGlow(t);
    zaza.setGlow(g); zaza.updateFlies(t, clamp(g, 0, 1));
    const lk = back(seg(t, LID_T, LID_T + .3), 2.0);
    if (t < LID_T) { zaza.lid.position.set(0, zaza.JH / 2 + .006, 0); zaza.lid.rotation.set(0, 0, 0); zaza.lid.visible = true; }
    else if (t < LID_T + .9) { zaza.lid.position.set(lk * .012, zaza.JH / 2 + .006 + lk * .05, lk * .028); zaza.lid.rotation.set(-lk * 1.9, 0, lk * .5); zaza.lid.visible = lk < .96; }
    else zaza.lid.visible = false;
    if (t > 42.75) zaza.setGlow(0);
  }

  // ---- 团团（贴纸卡） ----
  const ts = tuanState(t);
  tuan.root.visible = tuan.shadow.visible = ts.vis;
  if (ts.vis) {
    tuan.setSprite(ts.sprite);
    tuan.root.position.set(ts.x, ts.y, ts.z);
    tuan.body.scale.set(ts.sx * ts.face, ts.sy, 1);
    tuan.body.rotation.z = ts.tilt || 0;
    tuan.shadow.position.set(ts.x, .0004, ts.z);
    tuan.shadow.scale.setScalar(clamp(1 - ts.y * 10, .4, 1) * clamp(tuan.H * (.55 / Math.max(.02, SPR_H(ts.sprite))), .6, 1.2));
  }

  // ---- 折纸机构 ----
  scene.updateMatrixWorld(true);
  const foldVis = t > 33.57;
  const fa = eio(seg(t, FOLD_T[0][0], FOLD_T[0][1]));
  const fb = eio(seg(t, FOLD_T[1][0], FOLD_T[1][1]));
  const fc = eio(seg(t, FOLD_T[2][0], FOLD_T[2][1]));
  const fpuff = eio(seg(t, FOLD_T[2][1] + .18, FOLD_T[2][1] + .85));
  const fappear = eio(seg(t, 33.57, 34.07));
  const shrink = 1 - ss(seg(t, STAR_POP - .25, STAR_POP + .05));
  const lift = ss(seg(t, FOLD_T[2][0] + .1, FOLD_T[2][1])) * (1 - eio(seg(t, FOLD_T[2][1] + .18, FOLD_T[2][1] + .62)));
  foldPlane.visible = foldVis;
  if (foldVis) {
    drawFold(foldCv.getContext('2d'), { f1: fa, f2: fb, f3: fc, pf: fpuff, appear: fappear, lift });
    foldTex.needsUpdate = true;
    foldPlane.scale.setScalar(shrink * .999 + .001);
  }
  foldPlane.position.y = .0009 + .0042 * lift;

  // ---- 纸星星（礼物） ----
  const st = seg(t, STAR_POP, STAR_POP + .4);
  starG.visible = st > 0;
  if (starG.visible) {
    const pop = back(st, 2.1);
    let p;
    if (t < HANDOVER[0]) p = tuan.palm(1, new THREE.Vector3()).add(new THREE.Vector3(0, .012, .004));
    else if (t < HANDOVER[1]) {
      const a = tuan.palm(-1, new THREE.Vector3()), b = zaza.palm(new THREE.Vector3());
      const k = eio(seg(t, HANDOVER[0], HANDOVER[1]));
      p = a.lerp(b, k).add(new THREE.Vector3(0, .01 + Math.sin(k * Math.PI) * .012, .002));
    } else { p = zaza.palm(new THREE.Vector3()).add(new THREE.Vector3(0, .014 + Math.sin(t * 2.2) * .001, .002)); }
    starG.position.copy(p);
    starG.scale.setScalar(Math.max(.001, pop));
    starG.rotation.z = t < HANDOVER[1] ? Math.sin(t * 3) * .15 : Math.sin(t * 1.5) * .08 + .15;
    // 灯灭后纸星成为主角：辉光呼吸
    starGlow.material.opacity = .55 * seg(t, HANDOVER[1], HANDOVER[1] + .5) * (0.75 + .25 * Math.sin(t * 2.4)) + offK * .45 * (0.7 + .3 * Math.sin(t * 2.8)) * seg(t, LAMP_OFF, LAMP_OFF + .3);
    starLight.intensity = .12 * seg(t, STAR_POP, STAR_POP + .4) + offK * .13;
    starG.children[0].userData.front.material.emissiveIntensity = offK * .85 + .2 * seg(t, HANDOVER[1], HANDOVER[1] + .5);
    starShadow.visible = t > HANDOVER[1] && !offK;
    starShadow.position.set(p.x, .0004, p.z);
  } else starShadow.visible = false;

  // ---- 灯光 ----
  const Lt = lightsAt(t);
  sun.intensity = Lt.sunI; sun.color.copy(Lt.sunCol); sun.position.set(-.28, .5, .72);
  spot.intensity = Lt.lampI * 2.2; bulb.intensity = Lt.lampI * .35; hemi.intensity = Lt.hemiI;
  nightFill.intensity = Lt.nightI;
  scene.environmentIntensity = Lt.envI; scene.backgroundIntensity = Lt.bgI;
  renderer.toneMappingExposure = Lt.exposure;
  lamp.traverse(o => { if (o.isMesh && o.material.emissive) o.material.emissiveIntensity = 6 * Lt.lampI; });
  scene.updateMatrixWorld(true);

  // ---- 摄像机 + 后期 ----
  const C = camAt(t);
  cam.position.copy(C.pos); cam.fov = C.fov; cam.lookAt(C.tgt); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  camQ.copy(cam.quaternion);
  post.dof.focus = C.focus > .001 ? C.focus : C.pos.distanceTo(C.tgt); post.dof.aper = C.aper; post.dof.maxCoc = 14;
  post.vig.uniforms.fade.value = 1 - offK * .18;
  post.vig.uniforms.warm.value = .1 + Lt.lampI * .08 + offK * .12;
  post.bloom.strength = .24 + seg(t, STAR_POP, STAR_POP + .3) * .18 + Lt.nightI * .1 + offK * .12;
  for (const p of PS) p.userData.update(t);
  scene.updateMatrixWorld(true);
  post.composer.render();

  // ---- 2D 叠加 ----
  OX.clearRect(0, 0, W, H);
  const an = {};
  if (zs.vis) an.zaza = toScreen(zaza.head(tmpV));
  if (ts.vis) an.tuan = toScreen(tuan.head(tmpV));
  if (t > 2.0 && t < 3.8) HUD.drawBang(OX, t, 2.25, toScreen(new THREE.Vector3(EX.owl.g.position.x, .062, EX.owl.g.position.z)));
  HUD.drawBubbles(OX, t, an);
  HUD.drawSubs(OX, t, DURS);
  HUD.drawGolden(OX, t);
  // 开场淡入 / 台灯熄灭：先暗一半让纸星亮，再入黑场 → 晚安
  if (t < .25) { OX.fillStyle = `rgba(6,8,16,${1 - seg(t, 0, .25)})`; OX.fillRect(0, 0, W, H); }
  const darkK = .55 * seg(t, LAMP_OFF + .15, NIGHT_T) + .44 * seg(t, NIGHT_T, NIGHT_T + .45);
  if (darkK > 0) { OX.fillStyle = `rgba(6,9,20,${darkK})`; OX.fillRect(0, 0, W, H); }
  HUD.drawNight(OX, t);
  if (t > DUR - .6) { OX.fillStyle = `rgba(2,3,8,${seg(t, DUR - .6, DUR)})`; OX.fillRect(0, 0, W, H); }
};
function SPR_H(name) { return name && name.startsWith('expr') ? .0357 : .054; }
window.DBG = { tuan, zaza, book, cam, EX, starG, post, foldPlane, scene, renderer };
window.DBG.V = (x, y, z) => { const p = new THREE.Vector3(x, y, z).project(cam); return [Math.round((p.x * .5 + .5) * W), Math.round((-p.y * .5 + .5) * H)]; };
window.render(0);
window.READY = true;
