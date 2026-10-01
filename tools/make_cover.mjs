#!/usr/bin/env node
/**
 * 通用 9:16 竖屏精装绘本封面海报生成工具
 * 用法：
 *   node tools/make_cover.mjs films/night-01-stolen-night
 *   node tools/make_cover.mjs films/night-02-goodnight-blanket
 * 
 * 读取目标工程下的 cover.json 生成 1080×1920 封面图 poster.jpg
 */

import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { EXE, ARGS } from '../core/render/browser.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const targetArg = process.argv[2] || '.';
const targetDir = path.resolve(process.cwd(), targetArg);

if (!fs.existsSync(targetDir)) {
  console.error(`[Error] Target directory not found: ${targetDir}`);
  process.exit(1);
}

const coverJsonPath = path.join(targetDir, 'cover.json');
let config = {};
if (fs.existsSync(coverJsonPath)) {
  config = JSON.parse(fs.readFileSync(coverJsonPath, 'utf8'));
} else {
  console.warn(`[Warn] cover.json not found in ${targetDir}, using defaults.`);
  config = {
    series: '一页纸森林',
    subSeries: '治愈绘本',
    episodeBadge: '【 治愈睡前绘本 】',
    title: '小兔团团',
    epTitle: '《睡前故事》',
    tagline: '每晚翻一页森林，把黑夜过慢一点……',
    motto: '~ 每晚翻一页森林 · 把黑夜过慢一点 ~'
  };
}

// 静态文件轻量服务
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';
  
  // 优先在 targetDir 查找，其次在 ROOT 查找
  let filePath = path.join(targetDir, reqPath);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(ROOT, reqPath);
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found: ' + reqPath);
  }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const BASE = `http://127.0.0.1:${port}`;

const browser = await chromium.launch({ executablePath: EXE, args: ARGS });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });

const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="fonts.css">
<style>
body { margin: 0; background: #070e1b; overflow: hidden; }
canvas { display: block; }
</style>
</head>
<body>
<canvas id="cv" width="1080" height="1920"></canvas>
<script type="module">
await document.fonts.load('16px "ZCOOL KuaiLe"');
await document.fonts.ready;

const cfg = ${JSON.stringify(config)};

const loadImg = src => src ? new Promise(r => {
  const i = new Image();
  i.onload = () => r(i);
  i.onerror = () => r(null);
  i.src = src;
}) : Promise.resolve(null);

const tuanSrc = cfg.sprites?.tuan || 'assets/sprites/pose_holdstar.png';
const compSrc = cfg.sprites?.companion || 'assets/sprites/zaza_holdbottle.png';
const skySrc = cfg.sprites?.sky || 'assets/sprites/grandma_moon.png';

const [tuan, companion, skyImg] = await Promise.all([
  loadImg(tuanSrc),
  loadImg(compSrc),
  loadImg(skySrc)
]);

const W = 1080, H = 1920;
const c = document.getElementById('cv');
const x = c.getContext('2d');

// 1. 午夜宝蓝天鹅绒布质背景
const bg = x.createRadialGradient(W * 0.5, H * 0.45, 120, W * 0.5, H * 0.5, W * 0.95);
bg.addColorStop(0, '#152b48');
bg.addColorStop(0.5, '#0e1d33');
bg.addColorStop(1, '#060d18');
x.fillStyle = bg;
x.fillRect(0, 0, W, H);

// 细腻布面微纤维
let seed = 12345;
const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
for (let i = 0; i < H; i += 2.5) {
  x.fillStyle = 'rgba(0,0,0,' + (0.035 + rnd() * 0.04) + ')';
  x.fillRect(0, i, W, 1.2);
}
for (let i = 0; i < W; i += 2.5) {
  x.fillStyle = 'rgba(255,255,255,' + (0.015 + rnd() * 0.025) + ')';
  x.fillRect(i, 0, 1.2, H);
}

// 散落星尘
for (let i = 0; i < 110; i++) {
  const sx = 50 + rnd() * (W - 100), sy = 50 + rnd() * (H - 100);
  const sr = 1.0 + rnd() * 2.2;
  x.fillStyle = 'rgba(255, 235, 160, ' + (0.15 + rnd() * 0.5) + ')';
  x.beginPath();
  x.arc(sx, sy, sr, 0, Math.PI * 2);
  x.fill();
  if (rnd() > 0.8) {
    x.strokeStyle = 'rgba(255, 240, 190, ' + (0.2 + rnd() * 0.35) + ')';
    x.lineWidth = 0.8;
    x.beginPath();
    x.moveTo(sx - sr * 2.5, sy); x.lineTo(sx + sr * 2.5, sy);
    x.moveTo(sx, sy - sr * 2.5); x.lineTo(sx, sy + sr * 2.5);
    x.stroke();
  }
}

// 烫金配色
const GOLD = '#f0c765';
const GOLD_HI = '#fff3b8';
const GOLD_SH = '#663e0b';
const FONT = '"ZCOOL KuaiLe", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

// 2. 烫金外双框与四角花
const pad = 44;
x.strokeStyle = GOLD;
x.lineWidth = 6;
x.strokeRect(pad, pad, W - pad * 2, H - pad * 2);
x.lineWidth = 2.5;
x.strokeRect(pad + 14, pad + 14, W - (pad + 14) * 2, H - (pad + 14) * 2);

const corners = [
  [pad + 14, pad + 14, 1, 1],
  [W - pad - 14, pad + 14, -1, 1],
  [pad + 14, H - pad - 14, 1, -1],
  [W - pad - 14, H - pad - 14, -1, -1]
];
for (const [cx, cy, sx, sy] of corners) {
  x.save();
  x.translate(cx, cy);
  x.scale(sx, sy);
  x.lineWidth = 2;
  x.beginPath(); x.arc(28, 28, 20, Math.PI, Math.PI * 1.5); x.stroke();
  x.beginPath(); x.arc(42, 42, 30, Math.PI, Math.PI * 1.5); x.stroke();
  x.fillStyle = GOLD;
  x.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, r = i % 2 ? 6 : 18;
    x.lineTo(20 + Math.cos(a) * r, 20 + Math.sin(a) * r);
  }
  x.closePath(); x.fill();
  x.restore();
}

// 3. 顶部品牌标体系
x.textAlign = 'center';
x.textBaseline = 'middle';

// 3.1 顶标胶囊印章
const pillY = 165;
x.strokeStyle = GOLD;
x.lineWidth = 2.5;
x.beginPath();
x.roundRect(W * 0.5 - 240, pillY - 26, 480, 52, 26);
x.stroke();
x.fillStyle = 'rgba(21, 43, 72, 0.7)';
x.fill();

x.fillStyle = GOLD;
x.font = '500 32px ' + FONT;
x.fillText('✦  ' + (cfg.series || '一页纸森林') + ' · ' + (cfg.subSeries || '治愈绘本') + '  ✦', W * 0.5, pillY);

// 3.2 醒目集数徽标
const epPillY = 248;
x.fillStyle = GOLD;
x.font = 'bold 44px ' + FONT;
x.fillText(cfg.episodeBadge || '【 第一夜 · 哄睡篇 】', W * 0.5, epPillY);

// 3.3 大号主标题《小兔团团》
const titleY = 375;
const mainTitle = cfg.title ? (cfg.title.startsWith('《') ? cfg.title : '《' + cfg.title + '》') : '《小兔团团》';
x.font = 'bold 152px ' + FONT;
x.fillStyle = GOLD_SH;
x.fillText(mainTitle, W * 0.5 + 4, titleY + 5);
x.fillStyle = GOLD;
x.fillText(mainTitle, W * 0.5, titleY);
x.fillStyle = GOLD_HI;
x.font = 'bold 150px ' + FONT;
x.fillText(mainTitle, W * 0.5 - 1, titleY - 2);

// 3.4 分集名
const subY = 480;
const epTitle = cfg.epTitle ? (cfg.epTitle.startsWith('《') ? cfg.epTitle : '《' + cfg.epTitle + '》') : '《谁把黑夜偷走了》';
x.font = 'bold 74px ' + FONT;
x.fillStyle = GOLD_SH;
x.fillText(epTitle, W * 0.5 + 3, subY + 3);
x.fillStyle = GOLD;
x.fillText(epTitle, W * 0.5, subY);

// 烫金分割饰线
x.lineWidth = 2.5;
x.strokeStyle = GOLD;
x.beginPath();
x.moveTo(W * 0.5 - 320, 535); x.lineTo(W * 0.5 - 50, 535);
x.moveTo(W * 0.5 + 50, 535); x.lineTo(W * 0.5 + 320, 535);
x.stroke();
x.fillStyle = GOLD;
x.beginPath();
for (let i = 0; i < 8; i++) {
  const a = i * Math.PI / 4, r = i % 2 ? 5 : 14;
  x.lineTo(W * 0.5 + Math.cos(a) * r, 535 + Math.sin(a) * r);
}
x.closePath(); x.fill();

// 4. 中央巨型童话拱形画框
const aw = 780, ah = 900;
const ax0 = (W - aw) / 2, ay0 = 575;
const acx = W * 0.5;

const arch = (ctx, pad = 0) => {
  const rx = ax0 - pad, ry = ay0 - pad, rw = aw + pad * 2, rh = ah + pad * 2;
  const r = rw / 2;
  ctx.beginPath();
  ctx.moveTo(rx, ry + rh);
  ctx.lineTo(rx, ry + r);
  ctx.arc(rx + r, ry + r, r, Math.PI, 0);
  ctx.lineTo(rx + rw, ry + rh);
  ctx.closePath();
};

x.strokeStyle = GOLD;
x.lineWidth = 14;
arch(x, 12);
x.stroke();
x.lineWidth = 3;
arch(x, 24);
x.stroke();

// 拱顶北极星
x.fillStyle = GOLD;
x.beginPath();
for (let i = 0; i < 8; i++) {
  const a = i * Math.PI / 4, r = i % 2 ? 8 : 26;
  x.lineTo(acx + Math.cos(a) * r, (ay0 - 12) + Math.sin(a) * r);
}
x.closePath(); x.fill();

// 拱内内容
x.save();
arch(x, 0);
x.clip();

const inSky = x.createLinearGradient(acx, ay0, acx, ay0 + ah);
inSky.addColorStop(0, '#0e182a');
inSky.addColorStop(0.5, '#1b2f48');
inSky.addColorStop(0.8, '#264245');
inSky.addColorStop(1, '#1a3328');
x.fillStyle = inSky;
x.fillRect(ax0, ay0, aw, ah);

// 拱内星光
for (let i = 0; i < 55; i++) {
  const sx = ax0 + rnd() * aw, sy = ay0 + rnd() * (ah * 0.7);
  x.fillStyle = 'rgba(255, 245, 190, ' + (0.35 + rnd() * 0.6) + ')';
  x.beginPath();
  x.arc(sx, sy, 1.2 + rnd() * 2.4, 0, Math.PI * 2);
  x.fill();
}

// 天空客串（如月亮婆婆/太阳/云朵）
if (skyImg) {
  const mw = 220, mh = mw * (skyImg.height / skyImg.width);
  const mx = ax0 + aw - mw - 30, my = ay0 + 50;
  const mg = x.createRadialGradient(mx + mw * 0.5, my + mh * 0.5, 30, mx + mw * 0.5, my + mh * 0.5, 170);
  mg.addColorStop(0, 'rgba(255, 235, 140, 0.45)');
  mg.addColorStop(1, 'rgba(255, 235, 140, 0)');
  x.fillStyle = mg;
  x.fillRect(mx - 80, my - 80, mw + 160, mh + 160);
  x.drawImage(skyImg, mx, my, mw, mh);
}

// 远景纸艺山坡与近景草地
x.fillStyle = '#173132';
x.beginPath();
x.ellipse(acx - 100, ay0 + ah * 0.78, aw * 0.75, 120, 0, 0, Math.PI * 2);
x.fill();

x.fillStyle = '#264c39';
x.beginPath();
x.ellipse(acx, ay0 + ah * 0.94, aw * 0.7, 130, 0, 0, Math.PI * 2);
x.fill();

x.fillStyle = '#447f54';
x.beginPath();
x.ellipse(acx + 30, ay0 + ah * 0.96, aw * 0.48, 65, 0, 0, Math.PI * 2);
x.fill();

// 角色：伴随角色与团团
if (tuan) {
  if (companion) {
    const zw = 280, zh = zw * (companion.height / companion.width);
    const zx = acx + 65, zy = ay0 + ah - zh - 25;
    x.drawImage(companion, zx, zy, zw, zh);
  }

  const tw = 440, th = tw * (tuan.height / tuan.width);
  const tx = companion ? acx - 245 : acx - tw / 2, ty = ay0 + ah - th - 40;

  // 纸星星金光漫射
  const starX = tx + tw * 0.72, starY = ty + th * 0.48;
  const sg = x.createRadialGradient(starX, starY, 15, starX, starY, 220);
  sg.addColorStop(0, 'rgba(255, 235, 110, 0.75)');
  sg.addColorStop(0.45, 'rgba(255, 210, 70, 0.25)');
  sg.addColorStop(1, 'rgba(255, 200, 50, 0)');
  x.fillStyle = sg;
  x.fillRect(starX - 220, starY - 220, 440, 440);

  x.drawImage(tuan, tx, ty, tw, th);
}

// 漫天发光萤火虫
const ffs = [
  [ax0 + 110, ay0 + ah * 0.58, 5.0],
  [ax0 + 180, ay0 + ah * 0.42, 4.0],
  [ax0 + aw - 140, ay0 + ah * 0.65, 4.5],
  [acx - 40, ay0 + ah * 0.48, 4.2]
];
for (const [fx, fy, fr] of ffs) {
  const fg = x.createRadialGradient(fx, fy, 1, fx, fy, fr * 4);
  fg.addColorStop(0, 'rgba(255, 245, 140, 0.95)');
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

// 5. 底部文案
const botStoryY = 1580;
x.fillStyle = '#f5e9d3';
x.font = '400 42px ' + FONT;
x.fillText(cfg.tagline || '小刺猬偷走了黑夜，整座森林亮得睡不着……', W * 0.5, botStoryY);

const botMottoY = 1680;
x.fillStyle = GOLD;
x.font = '500 46px ' + FONT;
x.fillText(cfg.motto || '~ 每晚翻一页森林 · 把黑夜过慢一点 ~', W * 0.5, botMottoY);

// 底部烫金精致花尾
x.lineWidth = 2;
x.strokeStyle = GOLD;
x.beginPath();
x.arc(W * 0.5 - 50, 1735, 16, 0, Math.PI);
x.arc(W * 0.5 + 50, 1735, 16, 0, Math.PI);
x.stroke();
x.beginPath();
x.arc(W * 0.5, 1735, 6, 0, Math.PI * 2);
x.fillStyle = GOLD;
x.fill();

window.READY = true;
</script>
</body>
</html>
`;

// 写入临时 HTML
const tempHtmlPath = path.join(targetDir, '_temp_cover.html');
fs.writeFileSync(tempHtmlPath, html);

await page.goto(`${BASE}/_temp_cover.html`);
await page.waitForFunction(() => window.READY === true, null, { timeout: 30000 });

fs.mkdirSync(path.join(targetDir, 'stills'), { recursive: true });
const outPosterPath = path.join(targetDir, 'poster.jpg');
const outStillPath = path.join(targetDir, 'stills', 'cover_1080x1920.jpg');

await page.screenshot({ path: outPosterPath, type: 'jpeg', quality: 95 });
await page.screenshot({ path: outStillPath, type: 'jpeg', quality: 95 });
console.log(`[Success] Generated cover for: ${targetDir}`);
console.log(`  -> ${outPosterPath}`);
console.log(`  -> ${outStillPath}`);

// 清理临时文件
fs.unlinkSync(tempHtmlPath);

server.close();
await browser.close();
process.exit(0);
