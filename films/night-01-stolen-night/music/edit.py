# 配乐拼接 v4（40s 时间轴）：Fluffing a Duck(钩子·80.7bpm) → Sneaky Adventure(追查·107.7bpm)
# → Heartwarming(发现→折星→星夜)，金句前全静音（窗 [34.70, 35.68] 在 mix.py 硬静音），金句下一条轻乐句
import numpy as np, soundfile as sf, os, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else 'score.wav'
SR = 48000; DUR = 40.0
out = np.zeros((int(DUR * SR), 2))
def load(f): y, sr = sf.read(f); assert sr == SR, (f, sr); return y
def place(y, t_video, t0, t1, fin=.02, fout=.02, gain=1.0):
    seg = y[int(t0 * SR):int(t1 * SR)].copy() * gain
    n = len(seg); fi, fo = int(fin * SR), int(fout * SR)
    if fi: seg[:fi] *= np.sin(np.linspace(0, np.pi / 2, fi))[:, None] ** 2
    if fo: seg[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo))[:, None] ** 2
    a = int(t_video * SR); b = min(len(out), a + n); out[a:b] += seg[:b - a]
FD, SA, HW = load('Fluffing_a_Duck.wav'), load('Sneaky_Adventure.wav'), load('Heartwarming.wav')
place(FD, 0.95, 0.0, 7.10, fin=.7, fout=.5, gain=.60)           # A 钩子：失眠的森林（亮如白昼）
place(SA, 8.10, 0.0, 4.95, fin=.35, fout=.45, gain=.52)         # B 追查：循光一页页翻
place(HW, 13.05, 0.0, 21.55, fin=.6, fout=1.6, gain=.85)        # C 发现→认错→折星→释放→满天星（34.6 收干）
place(HW, 35.75, 24.2, 27.2, fin=.35, fout=1.4, gain=.42)       # D 金句下的轻乐句（静音窗后进入）
sf.write(OUT, out.astype(np.float32), SR)
print('score written', OUT)
