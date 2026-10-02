// 《晚安被子去旅行》主程序：竖屏场景 + 贴纸角色 + 飞行晚安被 + 翻页转场 + render(t)
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as L from './lib.js';
import { clamp, lerp, seg, ss, eio, eo, back, TAU, mulberry, track, spring } from './lib.js';
import * as A from './art.js';
import { cv } from './paper.js';
import { makeBook, coverCanvases, texOf, BW, BD, PG } from './book.js';
import { pages, buildSets, updatePops, RISE, FOLD } from './sets.js';
import { makeTuanTuan, makeZaza, makeDoudou, makeGrandmaMoon, preloadSprites } from './sprites.js';
import { cutMesh, blobShadow, thread } from './cutmesh.js';
import { makePost } from './post.js';
import { DUR, OPEN, TURNS, LAMP_OFF, NIGHT_T, TITLE, SUBTITLE } from './story.js';
import * as HUD from './hud.js';

const W = 1080, H = 1920;
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setSize(W, H);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('stage').appendChild(renderer.domElement);
const ov = document.getElementById('ov'), OX = ov.getContext('2d');

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(32, W / H, .004, 30);
const post = makePost(renderer, scene, cam, W, H);

// ---------- 字体与资源预加载 ----------
const fontList = ['500 40px Fredoka', '700 40px Fredoka', '40px "ZCOOL KuaiLe"', '44px "ZCOOL KuaiLe"', '56px "ZCOOL KuaiLe"', '72px "ZCOOL KuaiLe"', '86px "ZCOOL KuaiLe"'];
await Promise.all(fontList.map(f => document.fonts.load(f, '一页纸森林晚安被子小兔团团第二夜旅行绘本故事治愈睡前每晚翻过慢一点')));
await document.fonts.ready;
const DURS = await (await fetch('assets/voices/dur.json')).json();
await preloadSprites();

// 封面角色贴纸
const [tuanFrontImg, doudouSleepImg, moonImg] = await Promise.all([
  new Promise(res => { const im = new Image(); im.onload = () => res(im); im.src = 'assets/sprites/view_front.png'; }),
  new Promise(res => { const im = new Image(); im.onload = () => res(im); im.src = 'assets/sprites/doudou_sleep.png'; }),
  new Promise(res => { const im = new Image(); im.onload = () => res(im); im.src = 'assets/sprites/grandma_moon.png'; }),
]);

// HDR 与写字台背景
const hdr = await new RGBELoader().loadAsync('assets/lythwood_lounge_2k.hdr');
hdr.mapping = THREE.EquirectangularReflectionMapping;
scene.environment = hdr;
scene.background = hdr;
scene.backgroundBlurriness = .22;
const ENV_YAW = parseFloat(new URLSearchParams(location.search).get('yaw') || '2.1');
scene.backgroundRotation.set(0, ENV_YAW, 0);
scene.environmentRotation.set(0, ENV_YAW, 0);

const tl = new THREE.TextureLoader();
const wt = n => {
  const t = tl.load(`assets/walnut_${n}.jpg`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2.2, 1.4);
  t.anisotropy = 12;
  return t;
};
const wdiff = wt('diff');
wdiff.colorSpace = THREE.SRGBColorSpace;
const desk = new THREE.Mesh(
  new THREE.BoxGeometry(2.6, .04, 1.7),
  new THREE.MeshStandardMaterial({ map: wdiff, normalMap: wt('nor'), roughnessMap: wt('rough'), color: '#8a7a68', envMapIntensity: .8 })
);
desk.position.set(0, -.02, .25);
desk.receiveShadow = true;
scene.add(desk);

const gl = new GLTFLoader();
async function prop(name, x, z, s, ry) {
  const m = (await gl.loadAsync(`assets/${name}/${name}.gltf`)).scene;
  m.position.set(x, 0, z); m.scale.setScalar(s); m.rotation.y = ry;
  m.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  scene.add(m); return m;
}

const lamp = await prop('desk_lamp_arm_01', -.13, -.33, .55, 2.6);
let lampHeadPos = new THREE.Vector3(-.115, .38, -.27);
lamp.traverse(o => {
  if (o.isMesh && o.material.name.includes('light')) {
    o.material = o.material.clone();
    o.material.emissive = new THREE.Color('#ffd9a0');
    o.material.emissiveIntensity = 6;
    lampHeadPos = o.getWorldPosition(new THREE.Vector3());
  }
});
const clock = await prop('alarm_clock_01', .34, -.22, 1.05, -2.4);
clock.traverse(o => {
  if (o.isMesh && o.material.name.includes('Glass')) {
    o.material = o.material.clone();
    o.material.transparent = true;
    o.material.roughness = .05;
    o.castShadow = false;
  }
});

// 前景铅笔
{
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.0038, .0038, .15, 6), new THREE.MeshStandardMaterial({ color: '#f2b632', roughness: .5 }));
  const wood = new THREE.Mesh(new THREE.CylinderGeometry(.0038, .0008, .018, 6), new THREE.MeshStandardMaterial({ color: '#e8c79a', roughness: .8 }));
  const lead = new THREE.Mesh(new THREE.CylinderGeometry(.0008, .0001, .004, 6), new THREE.MeshStandardMaterial({ color: '#333', roughness: .4 }));
  const ferr = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .012, 12), new THREE.MeshStandardMaterial({ color: '#c9c2b0', metalness: 1, roughness: .3 }));
  const eras = new THREE.Mesh(new THREE.CylinderGeometry(.0039, .0039, .01, 12), new THREE.MeshStandardMaterial({ color: '#e88a8a', roughness: .9 }));
  wood.position.y = .084; lead.position.y = .095; ferr.position.y = -.081; eras.position.y = -.092;
  g.add(body, wood, lead, ferr, eras);
  g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  g.rotation.set(0, .4, Math.PI / 2);
  g.position.set(.09, .0038, .55);
  scene.add(g);
}

// ---------- 精装立体书 ----------
const cover = coverCanvases({ tuan: tuanFrontImg, companion: doudouSleepImg, moon: moonImg }, {
  title: TITLE,
  episode: '第二夜',
  epTitle: '晚安被子去旅行',
  series: '一页纸森林',
  tagline: '起风了，被子飞走了！团团翻开书页追了一整夜……',
});
const book = makeBook(cover);
scene.add(book.root);

const P = pages(), PT = {};
for (const k in P) PT[k] = texOf(P[k]);

// 5 个跨页页面贴图
const SPREAD = [
  { sky: PT.sky0, ground: PT.ground0 },
  { sky: PT.sky1, ground: PT.ground1 },
  { sky: PT.sky2, ground: PT.ground2 },
  { sky: PT.sky3, ground: PT.ground3 },
  { sky: PT.sky4, ground: PT.ground4 }
];

const { L: POPS, ex: EX } = buildSets(book);

// ---------- 角色卡与飞行晚安被 ----------
const tuan = makeTuanTuan();
book.stage.add(tuan.root);
book.stage.add(tuan.shadow);

const zaza = makeZaza();
book.stage.add(zaza.root);
book.stage.add(zaza.shadow);

const doudou = makeDoudou();
book.stage.add(doudou.root);
book.stage.add(doudou.shadow);

const moonActor = makeGrandmaMoon();
book.sky.add(moonActor.root);
moonActor.root.position.set(.02, .26, .03);

// ---------- 核心道具：晚安被子（飞行与盖身） ----------
const quiltCard = cutMesh(A.quilt(.11, .08), { shadow: true });
book.stage.add(quiltCard);
const quiltShadow = blobShadow(.04, .35);
book.stage.add(quiltShadow);

// ---------- 场景灯光系统 ----------
const spot = new THREE.SpotLight('#ffdfae', 0, 3, .8, .6, 2);
spot.position.copy(lampHeadPos);
spot.target.position.set(.0, .02, .1);
spot.castShadow = true;
spot.shadow.mapSize.set(4096, 4096);
spot.shadow.bias = -.00006;
spot.shadow.normalBias = .0004;
spot.shadow.radius = 5;
spot.shadow.camera.near = .05;
spot.shadow.camera.far = 2;
scene.add(spot, spot.target);

const bulb = new THREE.PointLight('#ffcf94', 0, .8, 2);
bulb.position.copy(lampHeadPos).add(new THREE.Vector3(0, -.02, .02));
scene.add(bulb);

const sun = new THREE.DirectionalLight('#fff3e0', 0);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -.00008;
sun.shadow.normalBias = .0003;
sun.shadow.radius = 4;
Object.assign(sun.shadow.camera, { left: -.3, right: .3, top: .3, bottom: -.3, near: .1, far: 3 });
sun.target.position.set(0, .05, .12);
scene.add(sun, sun.target);

const hemi = new THREE.HemisphereLight('#cfe6ff', '#caa27a', 0);
scene.add(hemi);

const nightFill = new THREE.PointLight('#8fa4e8', 0, .5, 2);
nightFill.position.set(0, .3, .3);
scene.add(nightFill);

// ---------- 动态状态与逻辑帧 ----------
const BUST_LIFT = .0085;
function bob(freq = 1.4, amp = .0006, t = 0) {
  return Math.sin(t * TAU * freq) * amp;
}

// 蹦跳步行插值
function hopWalk(t, t0, t1, [x0, z0], [x1, z1], lift = .007) {
  const k = clamp((t - t0) / (t1 - t0), 0, 1);
  const dist = Math.hypot(x1 - x0, z1 - z0);
  const hops = Math.max(1, Math.round(dist / .038));
  const ph = k * hops * Math.PI;
  return {
    x: lerp(x0, x1, k),
    z: lerp(z0, z1, k),
    y: Math.sin(ph % Math.PI) * lift,
    ph,
    moving: k > 0 && k < 1,
    done: k >= 1
  };
}

// 团团状态
function tuanState(t) {
  const S = {
    vis: false, x: 0, y: 0, z: .16,
    sy: 1, sx: 1, tilt: 0, rotY: 0,
    sprite: 'view_front', face: 1, hopN: 0
  };

  if (t < OPEN[0] + .85 || t >= DUR) return S;
  S.vis = true;

  // 跨页 0：0 – 8.8s（床上困倦 → 起风惊讶 → 翻窗追赶）
  if (t < TURNS[0][0]) {
    if (t < 3.0) {
      S.x = .03; S.z = .14; S.y = .015;
      S.sprite = 'expr_sleepy';
      S.tilt = .05;
      S.y += bob(1.2, .0004, t);
    } else if (t < 4.4) {
      S.x = .03; S.z = .14; S.y = .016;
      S.sprite = 'expr_surprised';
      S.tilt = -.12;
      S.sy = 1 + .06 * Math.sin(t * 14);
    } else {
      const w = hopWalk(t, 4.4, 7.8, [.03, .14], [-.03, .07], .008);
      S.x = w.x; S.z = w.z; S.y = w.y + .01;
      S.sprite = 'view_side'; S.face = -1;
      if (w.moving) {
        S.tilt = Math.sin(w.ph) * .06;
        S.hopN = Math.floor(w.ph / Math.PI);
      } else {
        S.sprite = 'view_front'; S.tilt = -.08;
      }
    }
    return S;
  }

  // 跨页 1：8.8 – 14.8s（森林草地：团团看扎扎与大被子）
  if (t < TURNS[1][0]) {
    if (t < 9.6) {
      S.vis = false;
    } else if (t < 11.8) {
      const w = hopWalk(t, 9.6, 11.6, [-.12, .17], [-.04, .17], .007);
      S.x = w.x; S.z = w.z; S.y = w.y;
      S.sprite = 'view_side'; S.face = 1;
      if (w.moving) {
        S.tilt = Math.sin(w.ph) * .05;
        S.hopN = Math.floor(w.ph / Math.PI);
      }
    } else {
      S.x = -.04; S.z = .17;
      S.sprite = t < 13.5 ? 'expr_surprised' : 'view_front';
      S.tilt = .06;
      S.y += bob(1.2, .0004, t);
    }
    return S;
  }

  // 跨页 2：14.8 – 19.7s（仰望夜空，看着被子飘向月亮婆婆）
  if (t < TURNS[2][0]) {
    if (t < 15.6) {
      S.vis = false;
    } else {
      S.x = -.04; S.z = .17;
      S.sprite = 'view_back';
      S.tilt = -.06;
      S.y += bob(1.0, .0003, t);
    }
    return S;
  }

  // 跨页 3：19.7 – 26.8s（来到古树树洞，看到小田鼠被子盖好）
  if (t < TURNS[3][0]) {
    if (t < 20.6) {
      S.vis = false;
    } else if (t < 22.8) {
      const w = hopWalk(t, 20.6, 22.6, [-.12, .13], [-.04, .09], .007);
      S.x = w.x; S.z = w.z; S.y = w.y;
      S.sprite = 'view_side'; S.face = 1;
      if (w.moving) {
        S.tilt = Math.sin(w.ph) * .05;
        S.hopN = Math.floor(w.ph / Math.PI);
      }
    } else {
      S.x = -.04; S.z = .09;
      S.sprite = 'expr_happy';
      S.tilt = .05;
      S.y += bob(1.2, .0003, t);
    }
    return S;
  }

  // 跨页 4：26.8 – 41.5s（清晨窗台，大家的新被子，甜甜睡着）
  if (t >= TURNS[3][0]) {
    if (t < 27.6) {
      S.vis = false;
    } else if (t < 29.5) {
      const w = hopWalk(t, 27.6, 29.3, [-.10, .14], [.02, .12], .007);
      S.x = w.x; S.z = w.z; S.y = w.y;
      S.sprite = 'view_side'; S.face = 1;
      if (w.moving) {
        S.tilt = Math.sin(w.ph) * .05;
        S.hopN = Math.floor(w.ph / Math.PI);
      }
    } else {
      S.x = .02; S.z = .118; S.y = .014;
      S.sprite = t > 33.5 ? 'expr_asleep' : 'expr_happy';
      S.tilt = .02;
      S.y += bob(0.8, .0003, t);
    }
  }

  return S;
}

// 刺猬扎扎状态（跨页 1）
function zazaState(t) {
  const S = { vis: false, x: .03, y: .022, z: .16, sy: 1, sx: 1, rot: 0 };
  if (t >= TURNS[0][1] && t < TURNS[1][0]) {
    S.vis = true;
    if (t >= 11.0 && t <= 14.0) {
      S.rot = Math.sin(t * 8) * .06;
      S.sy = .94 + .04 * Math.sin(t * 12);
    }
  }
  return S;
}

// 小田鼠豆豆状态（跨页 3）
function doudouState(t) {
  const S = { vis: false, x: .02, y: .032, z: .065, sprite: 'doudou_stand', sy: 1 };
  if (t >= TURNS[2][1] && t < TURNS[3][0]) {
    S.vis = true;
    if (t < 22.4) {
      S.sprite = 'doudou_stand';
      S.sy = 1 + .04 * Math.sin(t * 16);
    } else {
      S.sprite = 'doudou_sleep';
      S.sy = 1 + .03 * Math.sin(t * 1.5);
    }
  }
  return S;
}

// 晚安被子飞行状态
function quiltState(t) {
  const Q = { vis: true, x: .03, y: .018, z: .14, rx: 0, ry: 0, rz: 0, s: 1 };

  // 跨页 0：卧室起飞
  if (t < TURNS[0][0]) {
    if (t < 1.7) {
      Q.x = .03; Q.y = .018; Q.z = .14;
    } else {
      const k = seg(t, 1.7, 4.5);
      Q.x = lerp(.03, -.04, k);
      Q.y = lerp(.018, .20, Math.pow(k, 1.2)) + Math.sin(t * 9) * .015;
      Q.z = lerp(.14, .04, k);
      Q.rz = Math.sin(t * 8) * .25;
      Q.rx = -.2 + Math.sin(t * 6) * .2;
      Q.ry = k * .8;
    }
  }
  // 跨页 1：降落在扎扎身上（太大啦）
  else if (t < TURNS[1][0]) {
    if (t < 10.2) {
      const k = seg(t, 9.2, 10.8);
      Q.x = lerp(.10, .03, k);
      Q.y = lerp(.24, .014, k) + Math.sin(t * 6) * .02;
      Q.z = lerp(.08, .164, k);
      Q.rz = Math.sin(t * 5) * .2;
      Q.s = 1.15;
    } else if (t < 13.8) {
      Q.x = .03; Q.y = .014; Q.z = .164;
      Q.rz = Math.sin(t * 8) * .04;
      Q.s = 1.15;
    } else {
      const k = seg(t, 13.8, 14.8);
      Q.x = lerp(.03, .08, k);
      Q.y = lerp(.014, .24, k);
      Q.z = lerp(.164, .05, k);
      Q.rz = k * .4;
      Q.s = 1.0;
    }
  }
  // 跨页 2：挂在月亮角上（太小啦）
  else if (t < TURNS[2][0]) {
    if (t < 16.2) {
      const k = seg(t, 15.0, 16.2);
      Q.x = lerp(-.08, .01, k);
      Q.y = lerp(.08, .14, k);
      Q.z = lerp(.15, .025, k);
      Q.s = .7;
    } else if (t < 18.5) {
      Q.x = .01 + Math.sin(t * 3) * .006;
      Q.y = .14 + Math.cos(t * 3) * .004;
      Q.z = .025;
      Q.rz = -.35 + Math.sin(t * 4) * .08;
      Q.s = .7;
    } else {
      const k = seg(t, 18.5, 19.7);
      Q.x = lerp(.01, -.03, k);
      Q.y = lerp(.14, .06, k);
      Q.z = lerp(.025, .08, k);
      Q.rz = Math.sin(t * 6) * .25;
      Q.s = .8;
    }
  }
  // 跨页 3：盖住小田鼠豆豆
  else if (t < TURNS[3][0]) {
    if (t < 21.8) {
      Q.x = .02 + Math.sin(t * 2.5) * .02;
      Q.y = .16 + Math.cos(t * 2.5) * .015;
      Q.z = .06;
      Q.rz = Math.sin(t * 4) * .12;
      Q.s = .9;
    } else {
      const k = seg(t, 21.8, 23.2);
      Q.x = .02;
      Q.y = lerp(.16, .018, k);
      Q.z = lerp(.06, .068, k);
      Q.rz = lerp(0, .05, k);
      Q.s = .9;
    }
  }
  // 跨页 4：被子已留给田鼠，窗台上展示新被子
  else {
    Q.vis = false;
  }

  return Q;
}

// ---------- 摄像机轨迹与镜头机位 ----------
const SH = [
  [ // 0 封面特写静止展示 → 翻开绘本 → 卧室起风被子飞出
    [0.0, 0.0, .52, .72, 0, .015, .16, 46, 3.4, .68],
    [1.1, 0.0, .48, .70, 0, .015, .16, 45, 3.2, .65],
    [2.1, 0.0, .18, .46, 0, .05, .14, 35, 2.6, .38],
    [4.5, -.01, .16, .45, -.01, .06, .12, 34, 2.5, .35],
    [8.8, 0.0, .20, .52, 0, .07, .13, 33, 2.0, .45],
  ],
  [ // 1 翻页到刺猬扎扎（被子太大啦）
    [8.8, 0.0, .20, .52, 0, .07, .13, 33, 2.0, .45],
    [10.2, 0.0, .15, .46, 0, .05, .16, 34, 2.5, .32],
    [12.5, 0.0, .14, .45, 0, .048, .165, 33, 2.5, .30],
    [14.8, 0.0, .19, .51, 0, .07, .13, 33, 2.0, .42],
  ],
  [ // 2 翻页到月亮婆婆（太小啦）
    [14.8, 0.0, .19, .51, 0, .07, .13, 33, 2.0, .42],
    [16.2, 0.0, .18, .49, 0, .10, .09, 35, 2.6, .35],
    [18.5, 0.0, .18, .49, 0, .10, .09, 35, 2.6, .34],
    [19.7, 0.0, .19, .51, 0, .07, .13, 33, 2.0, .42],
  ],
  [ // 3 翻页到小田鼠树洞（刚刚好）
    [19.7, 0.0, .19, .51, 0, .07, .13, 33, 2.0, .42],
    [21.2, 0.0, .16, .45, 0, .05, .08, 34, 2.5, .33],
    [24.5, 0.0, .15, .44, 0, .045, .07, 33, 2.4, .30],
    [26.8, 0.0, .19, .51, 0, .07, .13, 33, 2.0, .42],
  ],
  [ // 4 翻页到清晨窗台（百家拼织新被）与金句定帧
    [26.8, 0.0, .19, .51, 0, .07, .13, 33, 2.0, .42],
    [28.5, 0.0, .14, .44, 0, .045, .12, 34, 2.6, .32],
    [34.2, 0.0, .14, .44, 0, .045, .12, 34, 2.6, .32],
    [35.3, -.04, .12, .385, -.075, .09, .163, 45, 2.9, .34],
    [41.5, -.0415, .122, .392, -.077, .092, .163, 45, 2.9, .34],
  ],
];

const SHOTS = SH.map(keys => ({ t0: keys[0][0], f: track(keys.map(k => [k[0], [...k.slice(1)]])) }));
function camAt(t) {
  let s = SHOTS[0];
  for (const S of SHOTS) if (t >= S.t0) s = S;
  const v = s.f(t);
  return {
    pos: new THREE.Vector3(v[0], v[1], v[2]),
    tgt: new THREE.Vector3(v[3], v[4], v[5]),
    fov: v[6], aper: v[7], focus: v[8]
  };
}

// ---------- 灯光系统 ----------
function lightsAt(t) {
  const inStory = seg(t, OPEN[1], OPEN[1] + .5);
  const morning = seg(t, 26.8, 28.5);
  const offK = seg(t, LAMP_OFF, LAMP_OFF + .05);
  const flick = offK > 0 && t < LAMP_OFF + .38 ? Math.max(0, Math.sin((t - LAMP_OFF) * 46)) * (1 - seg(t, LAMP_OFF + .1, LAMP_OFF + .38)) : 0;
  const lampI = 1.0 * (1 - offK) + flick * .5;
  const sunI = inStory * (1.2 + morning * 1.5) * (1 - offK);
  const sunCol = new THREE.Color('#fff3e0').lerp(new THREE.Color('#ffe2a8'), morning);

  return {
    sunI, sunCol, lampI,
    hemiI: .18 + inStory * .38 + morning * .25 - offK * .2,
    envI: .32 + inStory * .15 + morning * .2 - offK * .25,
    bgI: .45 + inStory * .1 - offK * .35,
    exposure: 1.02 + morning * .08 - offK * .15 + flick * .04,
  };
}

// ---------- 音效事件（输出给 mix.py） ----------
const EV = [];
EV.push({ t: OPEN[0], type: 'creak' }, { t: OPEN[1] - .12, type: 'thump' });
for (const r of POPS) {
  const t0 = RISE[r.spread] + r.d;
  EV.push({ t: t0 + .1, type: 'pop', s: r.spread });
}
for (const [a, b] of TURNS) {
  EV.push({ t: a + .1, type: 'wind', d: b - a });
  EV.push({ t: a + .45, type: 'page', d: b - a - .7 });
}
EV.push({ t: 1.7, type: 'whoosh', d: 1.8 });   // 起风刮走被子
EV.push({ t: 11.2, type: 'thump' });          // 落在刺猬身上
EV.push({ t: 16.8, type: 'ting' });           // 挂在月亮尖角
EV.push({ t: 22.8, type: 'sparkle', d: 1.5 }); // 落在小田鼠身上
EV.push({ t: LAMP_OFF, type: 'lampoff' });
EV.push({ t: NIGHT_T + .1, type: 'night' });
for (const e of HUD.blipTimes()) EV.push(e);
EV.sort((a, b) => a.t - b.t);
window.EV = EV;
window.DUR = DUR;

// ---------- 主渲染更新循环 ----------
window.render = function (t) {
  // 1. 书本翻开与翻页动画
  const opK = clamp((t - OPEN[0]) / (OPEN[1] - OPEN[0]), 0, 1);
  book.setOpen(Math.PI / 2 * opK);

  // 翻页机关：判断当前落在哪次翻页
  let activeTurn = -1;
  for (let i = 0; i < TURNS.length; i++) {
    const [a, b] = TURNS[i];
    if (t >= a && t <= b) {
      activeTurn = i;
      const u = (t - a) / (b - a);
      book.setLeaf(u);
      book.leafFront.material.map = SPREAD[i].ground;
      book.leafBack.material.map = SPREAD[i + 1].sky;
      book.leafFront.material.needsUpdate = true;
      book.leafBack.material.needsUpdate = true;
      if (u < .5) {
        book.groundMat.map = SPREAD[i].ground;
        book.backMat.map = SPREAD[i].sky;
      } else {
        book.groundMat.map = SPREAD[i + 1].ground;
        book.backMat.map = SPREAD[i + 1].sky;
      }
      book.groundMat.needsUpdate = true;
      book.backMat.needsUpdate = true;
      break;
    }
  }

  if (activeTurn === -1) {
    book.setLeaf(0);
    let curSpread = 0;
    for (let i = 0; i < TURNS.length; i++) {
      if (t > TURNS[i][1]) curSpread = i + 1;
    }
    curSpread = Math.min(curSpread, SPREAD.length - 1);
    book.groundMat.map = SPREAD[curSpread].ground;
    book.backMat.map = SPREAD[curSpread].sky;
    book.groundMat.needsUpdate = true;
    book.backMat.needsUpdate = true;
  }

  // 2. 更新立体弹出件
  updatePops(POPS, t);

  // 3. 更新角色姿势与位置
  const ts = tuanState(t);
  tuan.root.visible = ts.vis;
  tuan.shadow.visible = ts.vis;
  if (ts.vis) {
    tuan.root.position.set(ts.x, ts.y, ts.z);
    tuan.shadow.position.set(ts.x, .0005, ts.z);
    tuan.setSprite(ts.sprite);
    tuan.body.scale.set(ts.face * ts.sx, ts.sy, 1);
    tuan.body.rotation.z = ts.tilt;
  }

  const zs = zazaState(t);
  zaza.root.visible = zs.vis;
  zaza.shadow.visible = zs.vis;
  if (zs.vis) {
    zaza.root.position.set(zs.x, zs.y, zs.z);
    zaza.shadow.position.set(zs.x, .0005, zs.z);
    zaza.body.scale.set(zs.sx, zs.sy, 1);
    zaza.body.rotation.z = zs.rot;
  }

  const ds = doudouState(t);
  doudou.root.visible = ds.vis;
  doudou.shadow.visible = ds.vis;
  if (ds.vis) {
    doudou.root.position.set(ds.x, ds.y, ds.z);
    doudou.shadow.position.set(ds.x, .0005, ds.z);
    doudou.setSprite(ds.sprite);
    doudou.body.scale.set(1, ds.sy, 1);
  }

  // 月亮婆婆呼吸微动
  if (t >= TURNS[1][0] && t < TURNS[2][1]) {
    moonActor.root.visible = true;
    moonActor.root.position.set(0, .135 + Math.sin(t * 1.5) * .006, .02);
  } else {
    moonActor.root.visible = false;
  }

  // 4. 更新晚安被子
  const qs = quiltState(t);
  quiltCard.visible = qs.vis;
  quiltShadow.visible = qs.vis && qs.y < .08;
  if (qs.vis) {
    quiltCard.position.set(qs.x, qs.y, qs.z);
    quiltCard.rotation.set(qs.rx, qs.ry, qs.rz);
    quiltCard.scale.setScalar(qs.s);
    quiltShadow.position.set(qs.x, .0005, qs.z);
    quiltShadow.scale.setScalar(qs.s * clamp(1 - qs.y * 5, .2, 1));
  }

  // 5. 摄像机更新
  const C = camAt(t);
  cam.position.copy(C.pos);
  cam.lookAt(C.tgt);
  cam.fov = C.fov;
  cam.updateProjectionMatrix();

  // 6. 灯光与后处理参数
  const Lt = lightsAt(t);
  sun.intensity = Lt.sunI;
  sun.color.copy(Lt.sunCol);
  spot.intensity = Lt.lampI * 2.2;
  bulb.intensity = Lt.lampI * .35;
  hemi.intensity = Lt.hemiI;
  scene.environmentIntensity = Lt.envI;
  scene.backgroundIntensity = Lt.bgI;
  renderer.toneMappingExposure = Lt.exposure;
  lamp.traverse(o => { if (o.isMesh && o.material.emissive) o.material.emissiveIntensity = 6 * Lt.lampI; });

  // 7. 渲染 3D 场景
  post.dof.focus = C.focus > .001 ? C.focus : C.pos.distanceTo(C.tgt);
  post.dof.aper = C.aper;
  post.dof.maxCoc = 14;
  post.vig.uniforms.warm.value = .1 + Lt.lampI * .08;
  post.composer.render();

  // 8. 绘制 2D HUD（字幕、气泡、金句、晚安黑场）
  OX.clearRect(0, 0, W, H);
  HUD.drawSubs(OX, t, DURS);
  const anchors = {
    zaza: [540, 920],
  };
  HUD.drawBubbles(OX, t, anchors);
  HUD.drawGolden(OX, t);
  HUD.drawNight(OX, t);
};

window.READY = true;
console.log('[System] Episode 2 Engine Ready! DUR =', DUR);
