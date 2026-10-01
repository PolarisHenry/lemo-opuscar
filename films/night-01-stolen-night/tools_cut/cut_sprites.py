# 切贴纸：从三张参考图精切团团 → 透明 PNG（保留奶油白描边，只去背景）
# 用法: python3 cut_sprites.py
import numpy as np
from PIL import Image
import os
from collections import deque

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)              # 工程根
ASSETS = os.path.join(ROOT, 'assets')
OUT = os.path.join(ASSETS, 'sprites')
os.makedirs(OUT, exist_ok=True)

def flood_alpha(img_arr, boxes, t2):
    """对每个裁剪框：从框四角泛洪背景色 → 背景透明。t2=平方距离阈值（RGB 三通道和）"""
    H, W = img_arr.shape[:2]
    rgb = img_arr[..., :3].astype(np.int16)
    alpha = np.zeros((H, W), dtype=np.uint8)  # 1=背景(待删)
    for (x0, y0, x1, y1) in boxes:
        P = 28  # 内缩采样，避免垫到面板外/分隔带
        bg = np.stack([
            np.median(rgb[y0+P:y0+P+24, x0+P:x0+P+24].reshape(-1, 3), 0),
            np.median(rgb[y0+P:y0+P+24, x1-P-24:x1-P].reshape(-1, 3), 0),
            np.median(rgb[y1-P-24:y1-P, x0+P:x0+P+24].reshape(-1, 3), 0),
            np.median(rgb[y1-P-24:y1-P, x1-P-24:x1-P].reshape(-1, 3), 0),
        ])
        seen = np.zeros((H, W), dtype=bool)
        q = deque()
        for (cx, cy) in [(x0, y0), (x1-1, y0), (x0, y1-1), (x1-1, y1-1)]:
            q.append((cx, cy)); seen[cy, cx] = True
        while q:
            x, y = q.popleft()
            px = rgb[y, x]
            is_bg = np.min(np.sum((bg - px) ** 2, axis=1)) < t2
            if not is_bg:
                continue
            alpha[y, x] = 1
            for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                nx, ny = x+dx, y+dy
                if x0 <= nx < x1 and y0 <= ny < y1 and not seen[ny, nx]:
                    seen[ny, nx] = True; q.append((nx, ny))
    keep = (1 - alpha).astype(bool)  # 前景候选
    return keep, alpha.astype(bool)

def eat_neutral_shadow(rgb, removed, box, rb_max=12, gb_max=12):
    """第二阶段：从已去除区域向内蚕食『中性灰色』像素（软阴影芯）。
    奶油描边是暖色(R-B≥14)形成屏障，角色内部安全。"""
    x0, y0, x1, y1 = box
    r = rgb[..., 0].astype(np.int16); g = rgb[..., 1].astype(np.int16); b = rgb[..., 2].astype(np.int16)
    neutral = (np.abs(r - b) <= rb_max) & (np.abs(g - b) <= gb_max) & (b < 242)
    cand = neutral & ~removed
    cand[:y0, :] = False; cand[y1:, :] = False; cand[:, :x0] = False; cand[:, x1:] = False
    frontier = deque()
    nr = np.pad(removed, 1)
    adj = nr[:-2, 1:-1] | nr[2:, 1:-1] | nr[1:-1, :-2] | nr[1:-1, 2:]
    seed = cand & adj
    candset = cand.copy()
    ys, xs = np.where(seed)
    for y, x in zip(ys.tolist(), xs.tolist()):
        frontier.append((x, y)); candset[y, x] = False
    while frontier:
        x, y = frontier.popleft()
        removed[y, x] = True
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x+dx, y+dy
            if x0 <= nx < x1 and y0 <= ny < y1 and candset[ny, nx]:
                candset[ny, nx] = False; frontier.append((nx, ny))
    return removed

def largest_component(keep):
    """最大连通域（8 邻接），去掉残渣"""
    H, W = keep.shape
    lab = np.zeros((H, W), dtype=np.int32)
    cur = 0; best, bestn = 0, 0
    for sy in range(H):
        for sx in range(W):
            if keep[sy, sx] and lab[sy, sx] == 0:
                cur += 1; n = 0; q = deque([(sx, sy)]); lab[sy, sx] = cur
                while q:
                    x, y = q.popleft(); n += 1
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            nx, ny = x+dx, y+dy
                            if 0 <= nx < W and 0 <= ny < H and keep[ny, nx] and lab[ny, nx] == 0:
                                lab[ny, nx] = cur; q.append((nx, ny))
                if n > bestn: bestn, best = n, cur
    return lab == best

def feather(mask):
    """1px 羽化边缘"""
    from PIL import ImageFilter
    m = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    a = np.asarray(m).astype(np.float32) / 255.0
    a[mask] = np.maximum(a[mask], 1.0)
    return np.clip(a * 255, 0, 255).astype(np.uint8)

def cut(src_file, box, t2, out_name, canvas, fit_h, baseline, pad=10):
    """裁剪 → 紧公差泛洪去底 → 中性阴影蚕食 → 最大连通域 → bbox → 归一化画布"""
    im = Image.open(os.path.join(ASSETS, src_file)).convert('RGB')
    arr = np.asarray(im)
    rgb16 = arr.astype(np.int16)
    x0, y0, x1, y1 = box
    keep, removed = flood_alpha(arr, [box], t2)
    removed = eat_neutral_shadow(rgb16, removed.copy(), box)
    box_mask = np.zeros(arr.shape[:2], dtype=bool)
    box_mask[y0:y1, x0:x1] = True
    comp = (~removed) & box_mask
    comp = largest_component(comp)
    comp[:y0, :] = False; comp[y1:, :] = False; comp[:, :x0] = False; comp[:, x1:] = False
    ys, xs = np.where(comp)
    bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max()
    crop = arr[by0:by1+1, bx0:bx1+1]
    m = comp[by0:by1+1, bx0:bx1+1]
    a = feather(m)
    ch, cw = crop.shape[:2]
    scale = min(fit_h / ch, (canvas[0] - pad*2) / cw, 1.0)
    nw, nh = max(1, round(cw*scale)), max(1, round(ch*scale))
    crop_im = Image.fromarray(crop.astype(np.uint8)).resize((nw, nh), Image.LANCZOS)
    a_im = Image.fromarray(a).resize((nw, nh), Image.LANCZOS)
    out = Image.new('RGBA', canvas, (0, 0, 0, 0))
    px = (canvas[0] - nw) // 2
    py = baseline - nh
    region = np.asarray(out.crop((px, py, px + nw, py + nh))).copy()
    cr = np.asarray(crop_im.convert('RGBA')).astype(np.float32)
    am = (np.asarray(a_im).astype(np.float32) / 255.0)[..., None]
    comp_rgba = (cr * am + region.astype(np.float32) * (1 - am)).astype(np.uint8)
    comp_rgba[..., 3] = np.maximum(comp_rgba[..., 3], np.asarray(a_im))
    out.paste(Image.fromarray(comp_rgba), (px, py))
    out.save(os.path.join(OUT, out_name))
    print(f'{out_name}: crop {cw}x{ch} scale {scale:.3f} -> {nw}x{nh} @ ({px},{py})')
    return out_name

def checker(size=18):
    s = size
    def at(x, y):
        return (255, 255, 255) if ((x//s + y//s) % 2 == 0) else (204, 210, 218)
    return at

def contact_sheet(names, cols, cell, out_name):
    """审校用拼图：棋盘格底"""
    rows = (len(names) + cols - 1) // cols
    W, H = cols*cell[0], rows*cell[1]
    sheet = Image.new('RGB', (W, H))
    px = sheet.load()
    for y in range(H):
        for x in range(W):
            px[x, y] = checker()(x, y)
    for i, n in enumerate(names):
        im = Image.open(os.path.join(OUT, n))
        r = min((cell[0]-16)/im.width, (cell[1]-16)/im.height, 1.0)
        im = im.resize((max(1,round(im.width*r)), max(1,round(im.height*r))), Image.LANCZOS)
        cx, cy = (i % cols)*cell[0], (i // cols)*cell[1]
        sheet.paste(im, (cx + (cell[0]-im.width)//2, cy + (cell[1]-im.height)//2), im)
    sheet.save(os.path.join(OUT, out_name))
    print('sheet:', out_name)

# ---- 三视图（灰底, t2 紧公差平方距离）----
VIEWS = [('tuantuan_ref.jpg', (200, 40, 930, 1490), 'view_front.png'),
         ('tuantuan_ref.jpg', (1020, 40, 1710, 1490), 'view_side.png'),
         ('tuantuan_ref.jpg', (1870, 40, 2630, 1490), 'view_back.png')]
# ---- 表情五连（框收在灰面板内，避免角点采到白色分隔带）----
EXPRS = [('tuantuan_expressions.jpg', (40, 102, 655, 1315), 'expr_happy.png'),
         ('tuantuan_expressions.jpg', (680, 102, 1270, 1315), 'expr_sleepy.png'),
         ('tuantuan_expressions.jpg', (1292, 102, 1888, 1315), 'expr_shy.png'),
         ('tuantuan_expressions.jpg', (1908, 102, 2494, 1315), 'expr_surprised.png'),
         ('tuantuan_expressions.jpg', (2514, 102, 3100, 1315), 'expr_asleep.png')]
# ---- 动作（纯白底 255，头填兖250 与底仅差 5：t2=27 只吃纯白）----
POSES = [('tuantuan_poses.jpg', (320, 40, 1210, 1490), 'pose_holdstar.png'),
         ('tuantuan_poses.jpg', (1450, 40, 2310, 1490), 'pose_earpull.png')]

FULL = (920, 1240)   # 全身卡画布
BUST = (920, 820)    # 半身表情卡画布

if __name__ == '__main__':
    import sys
    which = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if which in ('all', 'views'):
        for f, b, n in VIEWS: cut(f, b, 1100, n, FULL, 1160, 1212)
    if which in ('all', 'exprs'):
        for f, b, n in EXPRS: cut(f, b, 1500, n, BUST, 730, 792)
    if which in ('all', 'poses'):
        for f, b, n in POSES: cut(f, b, 27, n, FULL, 1160, 1212)
    if which == 'all':
        contact_sheet(['view_front.png', 'view_side.png', 'view_back.png', 'pose_holdstar.png', 'pose_earpull.png'], 5, (360, 480), '_sheet_full.png')
        contact_sheet(['expr_happy.png', 'expr_sleepy.png', 'expr_shy.png', 'expr_surprised.png', 'expr_asleep.png'], 5, (360, 320), '_sheet_expr.png')
