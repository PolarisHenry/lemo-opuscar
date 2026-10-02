# 配乐 + 旁白 + 合成音效（纸片立体书·第二夜《晚安被子去旅行》）→ mix.wav
# 用法：../../.venv/bin/python mix.py [输出路径]
import json, re, os, sys, numpy as np, soundfile as sf
os.chdir(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else 'mix.wav'
from scipy.signal import butter, sosfilt, resample_poly, fftconvolve
from scipy.ndimage import maximum_filter1d

# 从 story.js 读取精确时长
story_text = open('story.js').read()
DUR = float(re.search(r"DUR = ([\d.]+)", story_text).group(1))
SR = 48000; N = int(DUR * SR)
rng = np.random.default_rng(42)

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
def sweep(f0, f1, t, curve=1.0):
    d = t[-1] if len(t) else 1; f = f0 + (f1 - f0) * (t / d) ** curve
    return np.sin(2 * np.pi * np.cumsum(f) / SR)
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

# ---------- 合成音效库 ----------
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

G = dict(blip=3.5, page=5.5, hop=1.1, tink=2.2, clack=1.6, creak=1.6, sparkle=1.5, whoosh=1.5, pop=1.15)
def putg(buf, t, x, ty): put(buf, t, x * G.get(ty, 1))

EV = json.load(open('events.json'))['ev']
C5 = 523.25
for e in EV:
    t, ty = e['t'], e['type']
    if ty == 'creak':
        d = 1.0; tq = tt(d); rate = 28 + 62 * (tq / d); clk = np.sin(2 * np.pi * np.cumsum(rate) / SR) > .97
        x = bp(clk.astype(float) + noise(len(tq)) * .05, 250, 900, 3) * np.sin(np.pi * tq / d) ** .6
        putg(sfx, t, verb(st(norm(x, .2)), .3), ty)
    elif ty == 'thump':
        tq = tt(.7); x = np.sin(2 * np.pi * 72 * tq) * ex(tq, .003, .12) + lp(noise(len(tq)), 600) * ex(tq, .002, .05) * .5
        putg(sfx, t, verb(st(norm(x, .35)), .2), ty)
    elif ty == 'sparkle':
        d = e.get('d', 1.2)
        for k in range(int(d * 12)):
            putg(sfx, t + rng.uniform(0, d), verb(st(bell(rng.choice([C5 * 4, C5 * 4 * 1.25, C5 * 4 * 1.5, C5 * 6]), .5, rng.uniform(.025, .05)), rng.uniform(-.6, .6)), .45), ty)
    elif ty == 'pop':
        putg(sfx, t + rng.uniform(-.03, .03), st(pop(rng.uniform(.05, .08), rng.uniform(500, 1100)) + np.pad(crinkle(.12, .04), (0, 1920)), rng.uniform(-.4, .4)), ty)
    elif ty == 'page':
        d = e.get('d', .8); x = swish(d, .28, 400, 2600) + crinkle(d, .10, 60) * np.sin(np.pi * tt(d) / d)
        putg(sfx, t, verb(st(x, 0), .25), ty)
    elif ty == 'wind':
        d = e.get('d', 1.0); x = lp(pink(int(d * SR)), 900) * np.sin(np.pi * tt(d) / d) ** 1.2
        putg(sfx, t, st(norm(x, .14), rng.uniform(-.2, .2)), ty)
    elif ty == 'whoosh':
        d = e.get('d', 1.5); x = swish(d, .35, 300, 2200) + lp(pink(int(d * SR)), 800) * .006
        putg(sfx, t, verb(st(x, 0), .3), ty)
    elif ty == 'ting':
        putg(sfx, t, verb(st(bell(C5 * 3, 1.2, .06, 1.4)), .4), ty)
    elif ty == 'lampoff':
        putg(sfx, t, st(tap(.09, 2100) * .9), ty)
        tq = tt(1.2); x = sum(np.sin(2 * np.pi * f * tq) for f in (C5 / 2, C5 / 2 * 1.26, C5 / 2 * 1.5)) * np.exp(-tq / .3)
        putg(sfx, t + .02, verb(st(x * .03), .5), ty)
    elif ty == 'night':
        putg(sfx, t, verb(st(bell(C5 * 2, 1.6, .035) + bell(C5 * 3, 1.6, .02)), .55), ty)
    elif ty == 'blip':
        f = rng.choice([320, 350, 380, 410]); x = blip(f, .05, .06)
        putg(sfx, t, st(x), ty)

# ---------- 环境声 ----------
def bed(t0, t1, fn, fi=1.2, fo=1.2):
    x = fn(t1 - t0); put(amb, t0, fade(x, fi, fo))
def room(d): return np.stack([lp(pink(int(d * SR)), 400), lp(pink(int(d * SR)), 400)], 1) * .0035
def ticks(d, g=.8):
    x = np.zeros((int(d * SR), 2))
    for k in range(int(d)):
        c = st(tap(.04, 2600 if k % 2 else 2300) * g, -.6); i = int(k * SR); x[i:i + len(c)] += c[:len(x) - i]
    return x
def crickets(d, g=1.):
    q = tt(d); x = np.sin(2 * np.pi * 4400 * q) * (np.sin(2 * np.pi * 28 * q) > .3) * (np.sin(2 * np.pi * .8 * q) > -.2) * .004 * g
    y = np.sin(2 * np.pi * 4700 * q) * (np.sin(2 * np.pi * 31 * q + 1) > .3) * (np.sin(2 * np.pi * .7 * q + 2) > -.2) * .0035 * g
    return np.stack([x, y], 1)
def rustle(d): return np.stack([bp(pink(int(d * SR)), 1500, 6000), bp(pink(int(d * SR)), 1500, 6000)], 1) * .003 * (.6 + .4 * np.sin(2 * np.pi * tt(d) / 5))[:, None]
def birds(d, dens=.7):
    x = np.zeros((int(d * SR), 2))
    for _ in range(int(d * dens)):
        s = rng.uniform(0, max(0.1, d - 1)); f0 = rng.uniform(2500, 4500); n = rng.integers(2, 5)
        for k in range(n):
            q = tt(.08); c = np.sin(2 * np.pi * np.cumsum(f0 * (1 + .4 * np.sin(2 * np.pi * 30 * q)) * (1 + q * 2)) / SR) * np.sin(np.pi * q / q[-1]) ** 2
            i = int((s + k * .12) * SR); x[i:i + len(c)] += st(c * rng.uniform(.010, .022), rng.uniform(-.8, .8))[:len(x) - i]
    return x

bed(0.0, 2.0, lambda d: room(d) + ticks(d) * .7, .4, .8)
bed(2.0, 9.0, lambda d: rustle(d) * .7 + np.stack([lp(pink(int(d * SR)), 500), lp(pink(int(d * SR)), 500)], 1) * .0025, .8, .8)
bed(9.0, 15.0, lambda d: rustle(d) * .6 + crickets(d, .4), .8, .8)
bed(15.0, 20.0, lambda d: crickets(d, .5) + room(d) * .4, 1.0, 1.0)
bed(20.0, 27.0, lambda d: crickets(d, .6) + room(d) * .4, 1.0, 1.0)
bed(27.0, DUR, lambda d: birds(d, .6) + room(d) * .5, 1.5, 2.0)

# ---------- 配乐加载与处理 ----------
mus_raw, sr = sf.read('music/Heartwarming.wav'); assert sr == SR
mus = np.zeros((N, 2))
# 取最具哄睡感的柔和前半段
copy_len = min(N, len(mus_raw))
mus[:copy_len] = mus_raw[:copy_len]
mus = fade(mus, 1.5, 3.0) * .85

# ---------- 旁白加载与压限 ----------
dur_json = json.load(open('assets/voices/dur.json'))
vo_times = [(m[0], float(m[1])) for m in re.findall(r"\['(n\d\d)', ([\d.]+),", story_text)]
vo = np.zeros(N); duck = np.zeros(N)

def compress(x, thr=-24, ratio=3.0):
    e = np.sqrt(np.maximum(lp(x ** 2, 30), 0) + 1e-10); lv = 20 * np.log10(e)
    gdb = np.where(lv > thr, (thr - lv) * (1 - 1 / ratio), 0)
    return x * 10 ** (gdb / 20)

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

mus *= (1 - .42 * duck)[:, None]
vo2 = verb(st(vo), .07)

# ---------- 金句前 1 秒静音窗（严格保证哄睡宁静感） ----------
_m = re.search(r"SILENCE = \[([\d.]+), ([\d.]+)\]", story_text)
if _m:
    SILA, SILB = float(_m.group(1)), float(_m.group(2))
    SIL0, SIL1 = int(SILA * SR), int(SILB * SR)
    mus[SIL0:SIL1] = 0; sfx[SIL0:SIL1] = 0; amb[SIL0:SIL1] = 0
    _f = int(.12 * SR)
    if SIL0 + _f <= len(vo2):
        vo2[SIL0:SIL0 + _f] *= np.linspace(1, 0, _f)[:, None] ** 1.5
    vo2[SIL0 + _f:SIL1] = 0
    vo[SIL0:SIL1] = 0
    i0 = int((SILA - .40) * SR); w = int(.40 * SR)
    if i0 + w < N and i0 >= 0:
        env2 = np.ones(N - i0); env2[:w] *= np.linspace(1.0, 0.0, w) ** 1.2
        sfx[i0:, 0] *= env2; sfx[i0:, 1] *= env2
    print(f"[Mix] Applied silence window: {SILA}s to {SILB}s")

# 限制各音轨峰值
sfx = np.stack([limit(sfx[:, 0], .45), limit(sfx[:, 1], .45)], 1)
mix = mus + vo2 + sfx * .85 + amb * 1.8

# 归一化响度至大约 -14 LUFS（峰值控制在 -1.0 dBFS）
pk_val = np.abs(mix).max()
if pk_val > 0:
    mix = mix / pk_val * 0.747

sf.write(OUT, mix.astype(np.float32), SR, subtype='FLOAT')
print(f"[Mix] Successfully rendered {OUT} ({DUR}s at {SR}Hz)")
