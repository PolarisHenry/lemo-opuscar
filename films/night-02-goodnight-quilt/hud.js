// 2D 叠加层（1080×1920 竖屏）：旁白字幕、扎扎纸气泡（中文打字机）、金句定帧、CTA、感叹号
import { VO, BUB, GOLDEN, CTA, DUR, NIGHT_T } from './story.js';
import { clamp, seg, back, ss, lerp, TAU, mulberry } from './lib.js';

const INK = '#3a2a24';
const W = 1080, H = 1920;
const ZH = '"ZCOOL KuaiLe", Fredoka, sans-serif';
export const CPS = 6.5;   // 中文打字速度（字/秒）
function wrapZh(x, text, maxW) {
  const lines = []; let cur = '';
  for (const ch of text) {
    if (ch === '\n') { lines.push(cur); cur = ''; continue; }
    const t = cur + ch;
    if (x.measureText(t).width > maxW && cur) { lines.push(cur); cur = ch; } else cur = t;
  }
  if (cur) lines.push(cur); return lines;
}

// 旁白字幕：底部居中，奶油白 + 暗棕描边；行间直接交接
export function drawSubs(x, t, dur) {
  for (let k = 0; k < VO.length; k++) {
    const [id, t0, text] = VO[k];
    if (t0 >= GOLDEN.t0 - .01) continue;   // 金句由 drawGolden 放大呈现，不重复底部字幕
    const d = dur[id] || 3;
    const next = VO[k + 1] ? VO[k + 1][1] : DUR;
    const t1 = Math.min(t0 + d + .45, next - .06);
    if (t1 <= t0 + d * .4) { /* 间隙太小：干脆延到下一句 */ }
    const a = Math.min(seg(t, t0 - .15, t0 + .02), 1 - seg(t, t1 - .18, t1));
    if (a <= 0) continue;
    x.save(); x.globalAlpha = a; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.lineJoin = 'round';
    x.font = `44px ${ZH}`;
    const lines = wrapZh(x, text, 940);
    let y = 1806 - (lines.length - 1) * 60;
    x.shadowColor = 'rgba(10,8,20,.5)'; x.shadowBlur = 14; x.shadowOffsetY = 3;
    for (const l of lines) {
      x.font = `44px ${ZH}`; x.lineWidth = 9; x.strokeStyle = 'rgba(30,20,14,.82)'; x.strokeText(l, 540, y);
      x.fillStyle = '#fff6e4'; x.fillText(l, 540, y);
      y += 60;
    }
    x.restore();
  }
}

// 气泡：anchor=[sx,sy] 说话者头顶屏幕坐标；中文打字机
export function drawBubbles(x, t, anchors) {
  for (const [who, t0, t1, text] of BUB) {
    if (t < t0 - .05 || t > t1 + .25) continue;
    const an = anchors[who]; if (!an) continue;
    const kin = back(seg(t, t0, t0 + .22), 2.2), kout = 1 - ss(seg(t, t1, t1 + .2)), k = kin * kout;
    if (k <= 0) continue;
    const n = Math.floor(clamp((t - t0 - .1) * CPS, 0, text.length));
    x.save(); x.font = `42px ${ZH}`;
    const tw = Math.max(x.measureText(text).width, 300), bw = tw + 84, bh = 128;
    let bx = clamp(an[0] - bw * .5, 36, W - 36 - bw), by = clamp(an[1] - bh - 84, 60, 1500);
    const tx = clamp(an[0], bx + 54, bx + bw - 54);
    x.translate(tx, by + bh); x.scale(k, k); x.translate(-tx, -(by + bh));
    x.globalAlpha = clamp(kout * 1.5);
    x.fillStyle = 'rgba(40,25,15,.22)'; x.beginPath(); x.roundRect(bx + 8, by + 12, bw, bh, 38); x.fill();
    x.beginPath(); x.roundRect(bx, by, bw, bh, 38);
    x.moveTo(tx - 24, by + bh - 2); x.lineTo(lerp(tx, an[0], .7), Math.min(an[1] - 16, by + bh + 52)); x.lineTo(tx + 18, by + bh - 2);
    x.fillStyle = '#fffdf8'; x.fill(); x.lineWidth = 6; x.strokeStyle = INK; x.lineJoin = 'round';
    x.beginPath(); x.roundRect(bx, by, bw, bh, 38); x.stroke();
    x.beginPath(); x.moveTo(tx - 24, by + bh); x.lineTo(lerp(tx, an[0], .7), Math.min(an[1] - 16, by + bh + 52)); x.lineTo(tx + 18, by + bh); x.stroke();
    x.fillStyle = '#fffdf8'; x.fillRect(tx - 20, by + bh - 8, 36, 9);
    x.fillStyle = '#2d2018'; x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.font = `42px ${ZH}`;
    x.fillText(text.slice(0, n), bx + 42, by + 62);
    if (n < text.length) { const yy = by + 76; x.fillStyle = '#e8a03a'; x.beginPath(); x.arc(bx + 42 + x.measureText(text.slice(0, n)).width + 12, yy - 34 + Math.sin(t * 9) * 4, 6, 0, TAU); x.fill(); }
    x.restore();
  }
}
export function blipTimes() {
  const ev = [];
  for (const [who, t0, t1, text] of BUB) for (let i = 0; i < text.length; i++) { if (/[\u4e00-\u9fff…！？，。]/.test(text[i])) ev.push({ t: t0 + .1 + i / CPS, type: 'blip', who }); }
  return ev;
}

// 金句：弹入后完全定帧
export function drawGolden(x, t) {
  if (t < GOLDEN.t0) return;
  const k = back(seg(t, GOLDEN.t0, GOLDEN.t0 + .4), 1.6);
  x.save(); x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
  x.translate(540, 1010); x.scale(k, k);
  x.shadowColor = 'rgba(8,8,22,.55)'; x.shadowBlur = 22; x.shadowOffsetY = 4;
  x.font = `72px ${ZH}`; x.lineWidth = 13; x.strokeStyle = 'rgba(30,20,14,.88)'; x.strokeText(GOLDEN.text, 0, 0);
  const g = x.createLinearGradient(0, -50, 0, 50); g.addColorStop(0, '#ffe9a8'); g.addColorStop(1, '#ffca5f');
  x.fillStyle = g; x.fillText(GOLDEN.text, 0, 0);
  x.shadowBlur = 0;
  for (const s of [-1, 1]) { x.save(); x.translate(s * (x.measureText(GOLDEN.text).width / 2 + 52), -4); x.rotate(s * .3);
    x.fillStyle = '#ffe9a8'; x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i / 10 * TAU, r = i % 2 ? 9 : 22; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill(); x.restore(); }
  x.restore();
}

// 右下角 CTA 小字幕（已禁用）
export function drawCTA(x, t) {
  return;
}

// 感叹号（钩子页猫头鹰头顶）
export function drawBang(x, t, t0, p) {
  if (!p || t < t0 || t > t0 + 1.0) return;
  const k = back(seg(t, t0, t0 + .15), 3), fo = 1 - seg(t, t0 + .8, t0 + 1.0);
  x.save(); x.translate(p[0] + 8, p[1] - 26); x.scale(k, k); x.globalAlpha = fo;
  x.font = '110px "ZCOOL KuaiLe", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.lineJoin = 'round';
  x.lineWidth = 22; x.strokeStyle = '#fffaf0'; x.strokeText('!', 0, 0); x.lineWidth = 9; x.strokeStyle = INK; x.strokeText('!', 0, 0); x.fillStyle = '#e8513f'; x.fillText('!', 0, 0);
  x.restore();
}

// 黑场晚安字卡：一弯月亮 + 「晚安，一页纸森林」（稍微停留更久，治愈舒适）
export function drawNight(x, t) {
  if (t < NIGHT_T) return;
  const a = seg(t, NIGHT_T, NIGHT_T + .55) * (1 - seg(t, DUR - .7, DUR - .1));
  if (a <= 0) return;
  x.save(); x.globalAlpha = a; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
  const cy = 960;
  x.save(); x.translate(540, cy - 130); x.rotate(-.35); x.fillStyle = '#ffe9a8';
  x.beginPath(); x.arc(0, 0, 34, .6, Math.PI * 2 - .6); x.arc(14, -6, 30, Math.PI * 2 - .7, .7, true); x.closePath(); x.fill();
  x.restore();
  x.shadowColor = 'rgba(255,233,168,.35)'; x.shadowBlur = 26;
  x.font = '64px "ZCOOL KuaiLe", sans-serif'; x.lineWidth = 10; x.strokeStyle = 'rgba(20,24,44,.9)';
  x.strokeText('晚安，一页纸森林', 540, cy + 10);
  const g = x.createLinearGradient(0, cy - 40, 0, cy + 50); g.addColorStop(0, '#fff6e4'); g.addColorStop(1, '#ffd9a0');
  x.fillStyle = g; x.fillText('晚安，一页纸森林', 540, cy + 10);
  x.shadowBlur = 0;
  for (const sd of [-1, 1]) { x.save(); x.translate(540 + sd * 300, cy + 10); x.fillStyle = '#ffd9a0';
    x.beginPath(); for (let i = 0; i < 10; i++) { const ag = -Math.PI / 2 + i / 10 * Math.PI * 2, r = i % 2 ? 6 : 15; x.lineTo(Math.cos(ag) * r, Math.sin(ag) * r); } x.closePath(); x.fill(); x.restore(); }
  x.restore();
}
