// 字幕导出：node make_srt.mjs [out.srt]（默认 ./ep01.srt）
// 只含旁白 8 句（气泡与金句是画面内文字，不重复进 srt）
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { VO } = await import('data:text/javascript;base64,' + fs.readFileSync(path.join(HERE, 'story.js')).toString('base64'));
const dur = JSON.parse(fs.readFileSync(path.join(HERE, 'assets/voices/dur.json'), 'utf8'));
const cues = VO.map(([id, t0, text]) => ({ t0, t1: t0 + (dur[id] || 3) + .45, text }));
for (let k = 0; k < cues.length - 1; k++) cues[k].t1 = Math.min(cues[k].t1, cues[k + 1].t0 - .05);
const fmt = s => { const ms = Math.round(s * 1000); return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
const out = process.argv[2] ? path.resolve(process.argv[2]) : path.join(HERE, 'ep01.srt');
fs.writeFileSync(out, cues.map((c, i) => `${i + 1}\n${fmt(c.t0)} --> ${fmt(c.t1)}\n${c.text}\n`).join('\n'));
console.log(out, cues.length, 'cues');
