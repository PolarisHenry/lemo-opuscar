# 表情面板补头：flood 掩膜(身体/描边已好) + 手工轮廓多边形(补头) → 融合 → 归一化
# 用法: .venv/bin/python cut_sprites3.py
import numpy as np, os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cut_sprites import flood_alpha, eat_neutral_shadow, largest_component

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ASSETS = os.path.join(ROOT, 'assets')
OUT = os.path.join(ASSETS, 'sprites')
from scipy import ndimage as ndi

# 手工轮廓（crop 内坐标，见 /tmp/grid_*.png 网格；顺序：右耳尖→右侧→底→左侧→左耳尖→耳内→V→颅顶→右耳内）
POLYS = {
 'expr_happy.png': [(476,64),(512,120),(530,190),(548,320),(561,460),(554,570),(535,680),(465,750),(370,795),(265,815),(165,795),(105,720),(65,600),(58,470),(60,390),(68,280),(86,180),(120,80),(160,130),(190,210),(215,300),(245,395),(310,415),(380,410),(420,390),(445,300),(462,180)],
 'expr_sleepy.png': [(485,85),(525,140),(545,210),(566,330),(580,470),(576,590),(550,700),(480,760),(380,795),(270,805),(170,770),(95,690),(40,560),(35,430),(48,330),(55,240),(60,190),(105,225),(140,290),(185,345),(250,368),(330,372),(395,360),(415,330),(450,240),(470,150)],
 'expr_shy.png': [(470,62),(505,120),(525,190),(552,320),(566,450),(559,560),(540,670),(470,740),(360,780),(250,788),(150,755),(80,665),(35,540),(30,420),(40,320),(76,176),(115,225),(150,300),(195,360),(260,385),(340,390),(400,375),(425,330),(455,230),(468,130)],
 'expr_surprised.png': [(476,72),(515,130),(535,200),(572,330),(588,470),(580,590),(550,700),(470,765),(360,800),(250,810),(160,780),(85,690),(42,555),(38,430),(45,330),(56,210),(100,250),(135,315),(180,370),(245,395),(330,400),(395,385),(420,340),(452,245),(468,140)],
 'expr_asleep.png': [(464,64),(510,150),(530,240),(548,360),(552,470),(538,580),(520,660),(528,780),(545,920),(552,1050),(545,1160),(430,1185),(290,1195),(150,1180),(55,1150),(15,1060),(8,930),(18,800),(38,690),(30,600),(36,470),(40,360),(52,250),(120,120),(150,175),(175,250),(195,330),(230,380),(280,410),(380,400),(430,370),(470,260),(455,95)],
}
BOXES = {
 'expr_happy.png': (40, 102, 655, 1315), 'expr_sleepy.png': (680, 102, 1270, 1315),
 'expr_shy.png': (1292, 102, 1888, 1315), 'expr_surprised.png': (1908, 102, 2494, 1315),
 'expr_asleep.png': (2514, 102, 3100, 1315),
}

def poly_mask(points, w, h):
    from PIL import ImageDraw
    im = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(im)
    d.polygon(points, fill=255)
    return np.asarray(im) > 127

def make(name, canvas=(920, 820), fit_h=730, baseline=792):
    src = 'tuantuan_expressions.jpg'
    box = BOXES[name]
    im = Image.open(os.path.join(ASSETS, src)).convert('RGB')
    arr = np.asarray(im)
    rgb16 = arr.astype(np.int16)
    x0, y0, x1, y1 = box
    keep, removed = flood_alpha(arr, [box], 1500)
    removed = eat_neutral_shadow(rgb16, removed.copy(), box)
    box_mask = np.zeros(arr.shape[:2], dtype=bool); box_mask[y0:y1, x0:x1] = True
    comp = (~removed) & box_mask
    # 多边形补头：在连通域选择【之前】做 —— 头部残环还在 comp 里，作为防溢出夹具
    sub = comp[y0:y1, x0:x1]
    pm = poly_mask(POLYS[name], x1 - x0, y1 - y0)
    grow = ndi.binary_dilation(sub, structure=np.ones((3, 3), bool), iterations=10)
    patch = pm & grow
    uni = sub | patch
    # 闭 6 填洞，把多边形与描边融合
    uni = ndi.binary_closing(uni, structure=np.ones((7, 7), bool))
    uni = ndi.binary_fill_holes(uni)
    uni = ndi.binary_opening(uni, structure=np.ones((3, 3), bool))
    lab, n = ndi.label(uni, structure=np.ones((3, 3), bool))
    if n == 0: raise RuntimeError('empty ' + name)
    sizes = ndi.sum(uni, lab, range(1, n + 1))
    uni = lab == (1 + int(np.argmax(sizes)))
    full = np.zeros(arr.shape[:2], dtype=bool); full[y0:y1, x0:x1] = uni
    ys, xs = np.where(full)
    bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    crop = arr[by0:by1, bx0:bx1].astype(np.uint8)
    m = full[by0:by1, bx0:bx1]
    from cut_sprites import feather
    a = feather(m)
    ch, cw = crop.shape[:2]
    scale = min(fit_h / ch, (canvas[0] - 20) / cw, 1.0)
    nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))
    crop_im = Image.fromarray(crop).resize((nw, nh), Image.LANCZOS)
    a_im = Image.fromarray(a).resize((nw, nh), Image.LANCZOS)
    out = Image.new('RGBA', canvas, (0, 0, 0, 0))
    px, py = (canvas[0] - nw) // 2, baseline - nh
    out.paste(crop_im, (px, py), a_im)
    out.save(os.path.join(OUT, name))
    print(f'{name}: crop {cw}x{ch} -> {nw}x{nh}')

if __name__ == '__main__':
    for n in POLYS: make(n)
