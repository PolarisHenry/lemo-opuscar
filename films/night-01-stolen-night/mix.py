# 配乐 + 旁白 + 合成音效（纸片立体书·第1夜）→ mix.wav
# 用法（项目目录）：../../.venv/bin/python mix.py [输出路径]
import json, re, os, sys, numpy as np, soundfile as sf
os.chdir(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else 'mix.wav'
from scipy.signal import butter, sosfilt, resample_poly, fftconvolve
from scipy.ndimage import maximum_filter1d

SR = 48000; DUR = 55.0; N = int(DUR * SR)   # v4.2：统一 IP 命名，放慢开场翻书节奏，延长结尾晚安留白到 55.0s
rng = np.random.default_rng(5)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def noise(n): return rng.standard_normal(n)
def pink(n):
    w = np.fft.rfft(noise(n)); f = np.arange(len(w)); f[0] = 1
    return np.fft.irfft(w / np.sqrt(f), n) * 20
def norm(x, p=1.0): return x / (np.abs(x).max() + 1e-9) * p
def st(x, pan=0.0):
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    return np.stack([x * l * 1.414, x * r * 1.414], 1)
def tt(d): return np.arange(int(d * SR)) / SR
def ex(t, a, r): return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / max(r, 1e-4))
def sweep(f0, f1, t, curve=1.0): d = t[-1] if len(t) else 1; f = f0 + (f1 - f0) * (t / d) ** curve; return np.sin(2 * np.pi * np.cumsum(f) / SR)
def fade(x, fi, fo):
    n = len(x); e = np.ones(n); a = int(fi * SR); b = int(fo * SR)
    if a: e[:a] = np.linspace(0, 1, a) ** 1.5
    if b: e[-b:] = np.minimum(e[-b:], np.linspace(1, 0, b) ** 1.5)
    return x * (e[:, None] if x.ndim == 2 else e)
def dbfs(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
IRn = int(1.4 * SR); IR = np.stack([noise(IRn), noise(IRn)], 1) * np.exp(-np.arange(IRn) / SR * 4.5)[:, None]
IR = np.stack([lp(IR[:, 0], 6000), lp(IR[:, 1], 6000)], 1); IR /= np.sqrt((IR ** 2).sum(0))
def verb(x2, wet=.25):
    y = np.stack([fftconvolve(x2[:, 0], IR[:, 0])[:len(x2)], fftconvolve(x2[:, 1], IR[:, 1])[:len(x2)]], 1)
    return x2 * (1 - wet) + y * wet

sfx = np.zeros((N, 2)); amb = np.zeros((N, 2))
def put(buf, t, x):
    i = int(t * SR); j = min(N, i + len(x))
    if j > i and i >= 0: buf[i:j] += x[:j - i]

# ---------- 音效库 ----------
def bell(f, d=.6, g=1., bright=1.):
    t = tt(d); x = sum(np.sin(2 * np.pi * f * k * t) * np.exp(-t * (4 + k * 3)) / k ** (1.6 / bright) for k in (1, 2, 3, 4.2))
    return x * ex(t, .002, d) * g
def boing(f0=300, f1=900, d=.26, g=1.):
    t = tt(d); f = f0 + (f1 - f0) * (1 - np.exp(-t * 14)); f *= 1 + .06 * np.sin(2 * np.pi * 28 * t)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) + .3 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    return x * ex(t, .005, d * .45) * g
def tap(g=1., f=900):
    t = tt(.12); x = bp(noise(len(t)), f * .6, f * 2.2) * ex(t, .001, .018) + np.sin(2 * np.pi * f * .35 * t) * ex(t, .001, .03) * .6
    return x * g
def crinkle(d, g=1., dens=180, lo=1800, hi=9000):
    n = int(d * SR); x = np.zeros(n)
    for _ in range(int(dens * d)):
        i = rng.integers(0, n - 400); L = rng.integers(40, 300); x[i:i + L] += noise(L) * np.exp(-np.arange(L) / (L / 4)) * rng.uniform(.3, 1)
    return bp(x, lo, hi) * g
def swish(d, g=1., f0=500, f1=3500):
    t = tt(d); n = len(t); x = noise(n); y = np.zeros(n); B = 8
    for k in range(B):
        a, b = k * n // B, (k + 1) * n // B; fc = f0 + (f1 - f0) * (k + .5) / B
        y[a:b] = bp(x, fc * .6, min(fc * 1.6, 20000))[a:b]
    return y * np.sin(np.pi * t / t[-1]) ** 1.5 * g
def pop(g=1., f=700):
    t = tt(.16); x = sweep(f, f * .45, t) * ex(t, .001, .04) + bp(noise(len(t)), 1200, 5000) * ex(t, .004, .025) * .5
    return x * g
def blip(f, g=1., d=.055, wave='sq'):
    t = tt(d); ph = 2 * np.pi * f * t
    x = np.sign(np.sin(ph)) * .5 + np.sin(ph) * .5 if wave == 'sq' else 2 / np.pi * np.arcsin(np.sin(ph))
    return lp(x, 4500) * ex(t, .003, d * .5) * g
def arp(fs, gap=.07, g=1.):
    out = np.zeros(int((gap * len(fs) + .8) * SR))
    for i, f in enumerate(fs): b = bell(f, .7, 1, 1.4); i0 = int(i * gap * SR); out[i0:i0 + len(b)] += b
    return out * g

G = dict(blip=3.5, page=6, hop=1.1, tink=2.2, clack=1.6, creak=1.6, sparkle=1.5, whoosh=1.5, pop=1.15, fold=2.6)
def putg(buf, t, x): put(buf, t, x * G.get(ty, 1))
EV = json.load(open('events.json'))['ev']
C5 = 523.25
for e in EV:
    t, ty = e['t'], e['type']
    if ty == 'creak':
        d = 1.0; tq = tt(d); rate = 28 + 62 * (tq / d); clk = np.sin(2 * np.pi * np.cumsum(rate) / SR) > .97
        x = bp(clk.astype(float) + noise(len(tq)) * .05, 250, 900, 3) * np.sin(np.pi * tq / d) ** .6
        putg(sfx, t, verb(st(norm(x, .2)), .3))
    elif ty == 'thump':
        tq = tt(.7); x = np.sin(2 * np.pi * 72 * tq) * ex(tq, .003, .12) + lp(noise(len(tq)), 600) * ex(tq, .002, .05) * .5
        putg(sfx, t, verb(st(norm(x, .42)), .2))
    elif ty == 'sparkle':
        d = e['d']
        for k in range(int(d * 13)): putg(sfx, t + rng.uniform(0, d), verb(st(bell(rng.choice([C5 * 4, C5 * 4 * 1.25, C5 * 4 * 1.5, C5 * 8, C5 * 6]), .5, rng.uniform(.025, .06)), rng.uniform(-.7, .7)), .45))
    elif ty == 'pop':
        putg(sfx, t + rng.uniform(-.03, .03), st(pop(rng.uniform(.05, .09), rng.uniform(500, 1100)) + np.pad(crinkle(.12, .05), (0, 1920)), rng.uniform(-.5, .5)))
    elif ty == 'page':
        d = e['d']; x = swish(d, .32, 400, 2600) + crinkle(d, .11, 60) * np.sin(np.pi * tt(d) / d)
        putg(sfx, t, verb(st(x, 0), .25))
    elif ty == 'wind':
        d = e['d']; x = lp(pink(int(d * SR)), 900) * np.sin(np.pi * tt(d) / d) ** 1.2
        putg(sfx, t, st(norm(x, .16), rng.uniform(-.2, .2)))
    elif ty == 'hop':
        f0, f1 = (420, 980) if e.get('z') else (480, 1150)
        b = boing(f0, f1, .16, .1); c = crinkle(.05, .018, 240)
        m = max(len(b), len(c)); b = np.pad(b, (0, m - len(b))); c = np.pad(c, (0, m - len(c)))
        putg(sfx, t, verb(st(b + c, rng.uniform(-.15, .15)), .12))
    elif ty == 'fold':
        d = e.get('d', .55)
        for k in range(3): putg(sfx, t + k * d / 3, st(crinkle(.1, .3, 520, 2600, 10500) * ex(tt(.1), .002, .03), rng.uniform(-.35, .35)))
        putg(sfx, t, st(sweep(1800, 900, tt(d)) * ex(tt(d), .01, d * .3) * .1, .2))
    elif ty == 'poof':
        tq = tt(.6); x = lp(noise(len(tq)), 1600) * ex(tq, .01, .16) * .8
        putg(sfx, t, verb(st(norm(x, .26)), .35))
    elif ty == 'starpop':
        putg(sfx, t + .02, verb(st(arp([C5 * 2, C5 * 2.52, C5 * 3, C5 * 4], .05, .16)), .35))
    elif ty == 'give':
        a1, b1 = tap(.09, 1400), bell(C5 * 3, .4, .05)
        m = max(len(a1), len(b1)); a1 = np.pad(a1, (0, m - len(a1))); b1 = np.pad(b1, (0, m - len(b1)))
        putg(sfx, t, st(a1 + b1))
    elif ty == 'ting':
        tq = tt(.3); x = np.sin(2 * np.pi * 3150 * tq) * ex(tq, .001, .09) + np.sin(2 * np.pi * 4700 * tq) * ex(tq, .001, .05) * .5
        putg(sfx, t, verb(st(x * .12, .3), .3))
    elif ty == 'whoosh':
        x = swish(1.1, .22, 350, 2400); putg(sfx, t, np.stack([x * np.linspace(1.2, .3, len(x)), x * np.linspace(.3, 1.2, len(x))], 1))
    elif ty == 'clack':
        tq = tt(.12); x = np.sin(2 * np.pi * 1300 * tq) * ex(tq, .001, .02) + bp(noise(len(tq)), 1500, 6000) * ex(tq, .001, .01) * .5
        putg(sfx, t, verb(st(x * .15, rng.uniform(-.5, .5)), .2))
    elif ty == 'tink':
        putg(sfx, t, verb(st(bell(rng.choice([C5 * 3, C5 * 3.36, C5 * 4, C5 * 4.5, C5 * 5]), .8, .05), rng.uniform(-.6, .6)), .4))
    elif ty == 'moon':
        putg(sfx, t, verb(st(bell(C5 * 1.5, 1.4, .06) + bell(C5 * 2, 1.4, .04)), .5))
    elif ty == 'lampon':
        putg(sfx, t, st(tap(.11, 2500)))
        tq = tt(1.0); x = sum(np.sin(2 * np.pi * f * tq) for f in (C5 / 2, C5 / 2 * 1.26, C5 / 2 * 1.5, C5)) * np.minimum(1, tq / .5) * np.exp(-np.maximum(0, tq - .5) / .28)
        putg(sfx, t + .04, verb(st(x * .035), .5))
    elif ty == 'lampoff':
        putg(sfx, t, st(tap(.09, 2100) * .9))
        tq = tt(1.2); x = sum(np.sin(2 * np.pi * f * tq) for f in (C5 / 2, C5 / 2 * 1.26, C5 / 2 * 1.5)) * np.exp(-tq / .3)
        putg(sfx, t + .02, verb(st(x * .03), .5))
    elif ty == 'night':
        putg(sfx, t, verb(st(bell(C5 * 2, 1.6, .035) + bell(C5 * 3, 1.6, .02)), .55))
    elif ty == 'blip':
        f = rng.choice([320, 350, 380, 410]); x = blip(f, .06, .07)
        putg(sfx, t, st(x))

# ---------- 环境声 ----------
def bed(t0, t1, fn, fi=1.2, fo=1.2):
    x = fn(t1 - t0); put(amb, t0, fade(x, fi, fo))
def room(d): return np.stack([lp(pink(int(d * SR)), 400), lp(pink(int(d * SR)), 400)], 1) * .0038
def ticks(d, g=.8):
    x = np.zeros((int(d * SR), 2))
    for k in range(int(d)):
        c = st(tap(.04, 2600 if k % 2 else 2300) * g, -.6); i = int(k * SR); x[i:i + len(c)] += c[:len(x) - i]
    return x
def birds(d, dens=.8):
    x = np.zeros((int(d * SR), 2))
    for _ in range(int(d * dens)):
        s = rng.uniform(0, d - 1); f0 = rng.uniform(2500, 4500); n = rng.integers(2, 5)
        for k in range(n):
            q = tt(.08); c = np.sin(2 * np.pi * np.cumsum(f0 * (1 + .4 * np.sin(2 * np.pi * 30 * q)) * (1 + q * 2)) / SR) * np.sin(np.pi * q / q[-1]) ** 2
            i = int((s + k * .12) * SR); x[i:i + len(c)] += st(c * rng.uniform(.012, .028), rng.uniform(-.8, .8))[:len(x) - i]
    return x
def crickets(d, g=1.):
    q = tt(d); x = np.sin(2 * np.pi * 4400 * q) * (np.sin(2 * np.pi * 28 * q) > .3) * (np.sin(2 * np.pi * .8 * q) > -.2) * .005 * g
    y = np.sin(2 * np.pi * 4700 * q) * (np.sin(2 * np.pi * 31 * q + 1) > .3) * (np.sin(2 * np.pi * .7 * q + 2) > -.2) * .004 * g
    return np.stack([x, y], 1)
def rustle(d): return np.stack([bp(pink(int(d * SR)), 1500, 6000), bp(pink(int(d * SR)), 1500, 6000)], 1) * .0035 * (.6 + .4 * np.sin(2 * np.pi * tt(d) / 5))[:, None]
def hum(d):
    q = tt(d); x = (np.sin(2 * np.pi * 208 * q) * .5 + np.sin(2 * np.pi * 312 * q) * .3 + np.sin(2 * np.pi * 416 * q) * .2)
    x *= (1 + .25 * np.sin(2 * np.pi * 1.7 * q)) * np.stack([q * 0 + 1, q * 0 + 1], 1)[..., 0]
    x = bp(x, 150, 900, 1) * .011
    shim = lp(noise(len(q)), 6000) * .0035
    return np.stack([x + shim, x + lp(noise(len(q)), 6000) * .0035], 1)
bed(0.0, 1.35, lambda d: room(d) + ticks(d) * .9, .4, .9)          # 夜晚房间
bed(1.35, 9.65, lambda d: birds(d, .55) + crickets(d, .7), 1.2, 1.2)  # 亮夜的错乱：鸟+蟋蟀
bed(9.65, 16.78, lambda d: rustle(d) + np.stack([lp(pink(int(d * SR)), 500), lp(pink(int(d * SR)), 500)], 1) * .003, 1, 1)  # 纸页风
bed(16.78, 32.92, lambda d: hum(d) * .6, 1.5, 1.5)                  # 辉光嗡鸣（弱；到认错结束）
bed(32.92, 42.37, lambda d: hum(d) * .35, 1, 1)                     # 折纸段更弱（到翻板入夜）
bed(42.37, DUR, lambda d: crickets(d, .8) + room(d) * .8, 1.2, 2.5)  # 夜回来了（SLAT_T 起）
put(amb, 21.0, fade(hum(20.7) * .5, 2, 2))                          # 瓶中萤火虫细嗡鸣（瓶光变暗段）
put(amb, 50.68, verb(st(bell(C5 * 4 * 1.25, 1.2, .04)), .5))         # CTA 后一声极轻 tink

# ---------- 配乐 ----------
mus, sr = sf.read('music/score.wav'); assert sr == SR
mus = np.pad(mus[:N], ((0, max(0, N - len(mus))), (0, 0)))

# ---------- 旁白 ----------
dur = json.load(open('assets/voices/dur.json'))
vo_times = [(m[0], float(m[1])) for m in re.findall(r"\['(n\d\d)', ([\d.]+),", open('story.js').read())]
vo = np.zeros(N); duck = np.zeros(N)
def compress(x, thr=-24, ratio=3.0):
    e = np.sqrt(np.maximum(lp(x ** 2, 30), 0) + 1e-10); lv = 20 * np.log10(e)
    gdb = np.where(lv > thr, (thr - lv) * (1 - 1 / ratio), 0); return x * 10 ** (gdb / 20)
for vid, t0 in vo_times:
    x, vsr = sf.read(f'assets/voices/{vid}.wav')
    if x.ndim > 1: x = x.mean(axis=1)
    x = resample_poly(x, SR, vsr); x = hp(x, 90); x = compress(x)
    i = int(t0 * SR); j = min(N, i + len(x)); vo[i:j] += x[:j - i]
    a = max(0, i - int(.25 * SR)); b = min(N, j + int(.4 * SR)); duck[a:b] = 1
duck = lp(np.convolve(duck, np.ones(int(.3 * SR)) / int(.3 * SR), 'same'), 5)
act = duck > .5
def limit(x, ceil):
    pk = maximum_filter1d(np.abs(x), int(.005 * SR)); g = np.minimum(1, ceil / (pk + 1e-9))
    g = np.minimum.reduce([g, np.roll(g, int(.0025 * SR))]); g = lp(g, 200); return x * np.clip(g, 0, 1)
speech = np.abs(vo) > 10 ** (-40 / 20) * np.abs(vo).max()
vr = np.sqrt(np.mean(vo[np.convolve(speech, np.ones(2400), 'same') > 0] ** 2))
vo = limit(vo, vr * 10 ** (11 / 20))
if act.any():
    mus_db = dbfs(mus[act]); vo_db = dbfs(vo[act])
    vo *= 10 ** ((mus_db + 9.5 - vo_db) / 20)
mus *= (1 - .45 * duck)[:, None]
vo2 = verb(st(vo), .07)

# ---------- 金句前全静音（窗取自 story.js SILENCE；n08 起句在窗后，不被削） ----------
import re as _re
_m = _re.search(r"SILENCE = \[([\d.]+), ([\d.]+)\]", open('story.js').read())
SILA, SILB = float(_m.group(1)), float(_m.group(2))
SIL0, SIL1 = int(SILA * SR), int(SILB * SR)
mus[SIL0:SIL1] = 0; sfx[SIL0:SIL1] = 0; amb[SIL0:SIL1] = 0
# 旁白混响尾也压掉：窗内先 0.12s 快速淡出到 0（n08 在窗后起句，不受影响）
_f = int(.12 * SR)
vo2[SIL0:SIL0 + _f] *= np.linspace(1, 0, _f)[:, None] ** 1.5
vo2[SIL0 + _f:SIL1] = 0
vo[SIL0:SIL1] = 0
# 音效尾巴不拖过静音窗：静音窗前 0.45s 起快速收干
i0 = int((SILA - .45) * SR); w = int(.45 * SR)
if i0 + w < N:
    env2 = np.ones(N - i0); env2[:w] *= np.linspace(1.0, 0.0, w) ** 1.2
    sfx[i0:, 0] *= env2; sfx[i0:, 1] *= env2
print('silence window', SILA, SILB, 'n08 t0', [m for m in vo_times if m[0] == 'n08'])

print('sfx pre', 20 * np.log10(np.abs(sfx).max() + 1e-12)); sfx = np.stack([limit(sfx[:, 0], .5), limit(sfx[:, 1], .5)], 1)
mix = mus + vo2 + sfx * .9 + amb * 2
pk = lambda x: round(20 * np.log10(np.abs(x).max() + 1e-12), 1)
print('peaks mus', pk(mus), 'vo', pk(vo2), 'sfx', pk(sfx), 'amb', pk(amb))
print('music', round(dbfs(mus), 1), 'vo(active)', round(dbfs(vo2[act]), 1), 'sfx', round(dbfs(sfx), 1), 'amb', round(dbfs(amb), 1))
# 静音窗检验
seg = mix[SIL0:SIL1]
print('silence window peak dB:', round(20 * np.log10(np.abs(seg).max() + 1e-12), 1), '(n08 起', 47.68, 's)')
mix = mix / np.abs(mix).max() * .89
sf.write(OUT, mix.astype(np.float32), SR, subtype='FLOAT')
print('written', OUT)
