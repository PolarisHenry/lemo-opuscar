import numpy as np
from PIL import Image
import scipy.ndimage as ndi
import os

front_path = 'films/night-01-stolen-night/assets/sprites_rembg/view_front.png'
front = Image.open(front_path).convert('RGBA')
fa = np.array(front)

# Clean only the hanging paws from front (x < 265, x > 655)
# from y=800 to 1050:
for y in range(800, 1055):
    for x in list(range(0, 265)) + list(range(655, 920)):
        fa[y, x] = 0

base_clean = Image.fromarray(fa)

expressions = ['expr_happy', 'expr_surprised', 'expr_sleepy', 'expr_shy', 'expr_asleep']

for name in expressions:
    src_path = f'films/night-01-stolen-night/assets/sprites_rembg/{name}.png'
    im_expr = Image.open(src_path).convert('RGBA')
    
    # Scale to match front head width
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
    
    # Smooth blending mask:
    mask = np.ones((1240, 920), dtype=np.float32)
    # Fade out duplicate star area:
    for y in range(870, 925):
        for x in range(330, 590):
            mask[y, x] = max(0.0, min(1.0, 1.0 - (y - 870) / 45.0))
    mask[925:, 330:590] = 0.0
    
    # Blend bottom: fade bottom 45 pixels of ca smoothly
    for x in range(920):
        ys = np.where(ca[:, x, 3] > 0)[0]
        if len(ys) > 0:
            y_max = ys.max()
            for y in range(max(0, y_max - 50), y_max + 1):
                mask[y, x] = min(mask[y, x], (y_max - y) / 50.0)
                
    mask = ndi.gaussian_filter(mask, sigma=1.5)
    ca[:, :, 3] = (ca[:, :, 3].astype(np.float32) * mask).astype(np.uint8)
    
    im_clean = Image.fromarray(ca)
    full = Image.alpha_composite(base_clean, im_clean)
    
    out_path = f'/tmp/full_{name}.png'
    full.save(out_path)
    print(f'Generated {out_path}')

