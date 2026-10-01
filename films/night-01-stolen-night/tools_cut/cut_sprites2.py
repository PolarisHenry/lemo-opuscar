# 表情五连 + earpull 终版切割（scipy 形态学：强前景闭合 → 背景连通域 → 孔洞回填）
# 用法: .venv/bin/python cut_sprites2.py
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ASSETS = os.path.join(ROOT, 'assets')
OUT = os.path.join(ASSETS, 'sprites')

def dist2(arr, bg):
    d = arr.astype(np.int16) - np.array(bg, np.int16)
    return (d * d).sum(-1)

def cut_expr(src_file, box, out_name, canvas=(920, 820), fit_h=730, baseline=792):
    im = Image.open(os.path.join(ASSETS, src_file)).convert('RGB')
    arr = np.asarray(im)
    x0, y0, x1, y1 = box
    sub = arr[y0:y1, x0:x1]
    # 背景中值（四角内缩）
    P = 30
    meds = [np.median(sub[:P, :P].reshape(-1, 3), 0), np.median(sub[:P, -P:].reshape(-1, 3), 0),
            np.median(sub[-P:, :P].reshape(-1, 3), 0), np.median(sub[-P:, -P:].reshape(-1, 3), 0)]
    dmin = np.minimum.reduce([dist2(sub, m) for m in meds])
    strong = dmin > 2600                      # 明确不是背景（奶油描边/白头/深色服）
    # 闭合：封住耳间缝等细背景通道
    st = ndi.iterate_structure(ndi.generate_binary_structure(2, 2), 10)
    closed = ndi.binary_closing(strong, structure=st)
    closed = ndi.binary_closing(closed, structure=st)
    # 背景 = closed 的补集中与边界连通的部分
    lab, n = ndi.label(~closed)
    border = set(lab[0]) | set(lab[-1]) | set(lab[:, 0]) | set(lab[:, -1])
    border.discard(0)
    bg = np.isin(lab, list(border))
    char = ndi.binary_fill_holes(~bg)
    char = ndi.binary_opening(char, structure=ndi.generate_binary_structure(2, 2), iterations=1)
    lab2, n2 = ndi.label(char)
    if n2 == 0: raise RuntimeError('empty ' + out_name)
    sizes = ndi.sum(char, lab2, range(1, n2 + 1))
    char = lab2 == (1 + int(np.argmax(sizes)))
    # 轻微腐蚀去晕 + 羽化
    char = ndi.binary_erosion(char, structure=ndi.generate_binary_structure(2, 2), iterations=1, border_value=0) \
        if False else char
    alpha = ndi.gaussian_filter(char.astype(np.float32), 1.0)
    alpha = np.clip(alpha * 1.4, 0, 1)
    alpha[char] = 1.0
    ys, xs = np.where(char)
    bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    crop = sub[by0:by1, bx0:bx1].astype(np.uint8)
    a = (alpha[by0:by1, bx0:bx1] * 255).astype(np.uint8)
    ch, cw = crop.shape[:2]
    scale = min(fit_h / ch, (canvas[0] - 20) / cw, 1.0)
    nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))
    crop_im = Image.fromarray(crop).resize((nw, nh), Image.LANCZOS)
    a_im = Image.fromarray(a).resize((nw, nh), Image.LANCZOS)
    out = Image.new('RGBA', canvas, (0, 0, 0, 0))
    px, py = (canvas[0] - nw) // 2, baseline - nh
    out.paste(crop_im, (px, py), a_im)
    out.save(os.path.join(OUT, out_name))
    print(f'{out_name}: crop {cw}x{ch} -> {nw}x{nh}')

def clean_precut(src_name, out_name, canvas=(920, 1240), fit_h=1160, baseline=1212):
    """清理预切贴纸：最大 alpha 连通域 + 去半透明雾 + 裁 bbox + 归一化"""
    im = Image.open(os.path.join(OUT, src_name)).convert('RGBA')
    a = np.asarray(im).copy()
    alpha = a[..., 3]
    solid = alpha > 140
    lab, n = ndi.label(solid, structure=np.ones((3, 3)))
    if n == 0: raise RuntimeError('empty ' + src_name)
    sizes = ndi.sum(solid, lab, range(1, n + 1))
    keep = lab == (1 + int(np.argmax(sizes)))
    # 回填内部孔洞（眼睛高光等被误删的）
    keep = ndi.binary_fill_holes(keep)
    # alpha 限制在主连通域内，并压掉边缘雾（保留 3px 过渡）
    edge = keep & ~ndi.binary_erosion(keep, structure=np.ones((3, 3)), iterations=1)
    band = ndi.binary_dilation(keep, structure=np.ones((3, 3)), iterations=2) & ~keep
    newa = np.where(keep, alpha, np.where(band, np.minimum(alpha, 120), 0)).astype(np.uint8)
    a[..., 3] = newa
    ys, xs = np.where(newa > 40)
    bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    crop = a[by0:by1, bx0:bx1]
    ch, cw = crop.shape[:2]
    scale = min(fit_h / ch, (canvas[0] - 20) / cw, 1.6)
    nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))
    crop_im = Image.fromarray(crop).resize((nw, nh), Image.LANCZOS)
    out = Image.new('RGBA', canvas, (0, 0, 0, 0))
    px, py = (canvas[0] - nw) // 2, baseline - nh
    out.paste(crop_im, (px, py))
    out.save(os.path.join(OUT, out_name))
    print(f'{out_name}: crop {cw}x{ch} scale {scale:.3f} -> {nw}x{nh}')

if __name__ == '__main__':
    P = 'tuantuan_expressions.jpg'
    cut_expr(P, (40, 102, 655, 1315), 'expr_happy.png')
    cut_expr(P, (680, 102, 1270, 1315), 'expr_sleepy.png')
    cut_expr(P, (1292, 102, 1888, 1315), 'expr_shy.png')
    cut_expr(P, (1908, 102, 2494, 1315), 'expr_surprised.png')
    cut_expr(P, (2514, 102, 3100, 1315), 'expr_asleep.png')
    clean_precut('pose_r0c2.png', 'pose_earpull.png')
