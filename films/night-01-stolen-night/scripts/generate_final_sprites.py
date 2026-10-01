import numpy as np
from PIL import Image
import scipy.ndimage as ndi
import os

# 1. Base front
front_path = 'films/night-01-stolen-night/assets/sprites_rembg/view_front.png'
front = Image.open(front_path).convert('RGBA')
fa = np.array(front)

# Clean paws by replacing them with blue cloth from adjacent torso, preserving outer white border:
fa_clean = fa.copy()
for y in range(800, 1055):
    # Left side:
    row_l = np.where(fa_clean[y, :350, 3] > 100)[0]
    if len(row_l) > 0:
        x_min = row_l[0]
        for x in range(x_min + 18, 280):
            sample_x = min(400, x + 85)
            fa_clean[y, x, :3] = fa[y, sample_x, :3]
            
    # Right side:
    row_r = np.where(fa_clean[y, 550:, 3] > 100)[0]
    if len(row_r) > 0:
        x_max = row_r[-1] + 550
        for x in range(650, x_max - 18):
            sample_x = max(520, x - 85)
            fa_clean[y, x, :3] = fa[y, sample_x, :3]

base_solid = Image.fromarray(fa_clean)

# 2. Process all 5 expressions
expressions = ['expr_happy', 'expr_surprised', 'expr_sleepy', 'expr_shy', 'expr_asleep']

out_dir = 'films/night-01-stolen-night/assets/sprites'

for name in expressions:
    src_path = f'films/night-01-stolen-night/assets/sprites_rembg/{name}.png'
    im_expr = Image.open(src_path).convert('RGBA')
    
    s = 578.0 / 422.0
    eb = im_expr.getbbox()
    ecrop = im_expr.crop(eb)
    nw = int(round(ecrop.width * s))
    nh = int(round(ecrop.height * s))
    eres = ecrop.resize((nw, nh), Image.LANCZOS)
    px = 460 - nw // 2
    py = 50
    
    comp_canvas = Image.new('RGBA', (920, 1240), (0, 0, 0, 0))
    comp_canvas.paste(eres, (px, py))
    ca = np.array(comp_canvas)
    
    mask = np.ones((1240, 920), dtype=np.float32)
    
    # Central star area: fade out so clean front star shows
    for y in range(870, 925):
        for x in range(330, 590):
            mask[y, x] = max(0.0, min(1.0, 1.0 - (y - 870) / 45.0))
    mask[925:, 330:590] = 0.0
    
    # Bottom fade
    for x in range(920):
        ys = np.where(ca[:, x, 3] > 0)[0]
        if len(ys) > 0:
            y_max = ys.max()
            for y in range(max(0, y_max - 50), y_max + 1):
                mask[y, x] = min(mask[y, x], (y_max - y) / 50.0)
                
    mask = ndi.gaussian_filter(mask, sigma=2.0)
    ca[:, :, 3] = (ca[:, :, 3].astype(np.float32) * mask).astype(np.uint8)
    
    im_clean = Image.fromarray(ca)
    full = Image.alpha_composite(base_solid, im_clean)
    
    dst_path = os.path.join(out_dir, f'{name}.png')
    full.save(dst_path)
    print(f'Wrote {dst_path}, size={full.size}')

