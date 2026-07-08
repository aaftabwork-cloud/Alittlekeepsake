#!/usr/bin/env python3
"""Quadrant-crop the 2x2 KIE asset sheets, luminance-key (gold/bright-on-black -> alpha),
trim, and save transparent PNG cutouts. Config-driven port of the proven heritage keyer.

    python3 process_sheets.py <theme.json>

Reads each sheet's raw PNG from <outBase>/raw/<sheet.out>, splits into 4 quadrants named
by the sheet's `names` array (TL, TR, BL, BR order), and writes <outBase>/cutouts/<name>.png.

The luminance key (alpha = max(r,g,b), RGB un-premultiplied) REQUIRES a pure-black sheet
background. Bright/gold subjects survive; dark subjects vanish. For photographic or
dark-silhouette subjects use cut.py (rembg) instead.
"""
import json, os, sys
from PIL import Image
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
CRAFT_ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
NOISE_FLOOR = 10  # below this luma -> fully transparent (kills black-bg compression noise)

if len(sys.argv) < 2:
    sys.exit('usage: python3 process_sheets.py <theme.json>')
cfg = json.load(open(sys.argv[1]))
theme = cfg.get('theme', 'theme')
out_base = os.path.abspath(cfg['outBase']) if cfg.get('outBase') \
    else os.path.join(CRAFT_ROOT, 'public', 'templates', 'assets', theme)
raw_dir = os.path.join(out_base, 'raw')
cut_dir = os.path.join(out_base, 'cutouts')
os.makedirs(cut_dir, exist_ok=True)

total = 0
for sheet in cfg.get('sheets', []):
    p = os.path.join(raw_dir, sheet['out'])
    names = sheet.get('names')
    if not names or len(names) != 4:
        print('skip (need exactly 4 names):', sheet['out']); continue
    if not os.path.exists(p):
        print('skip (raw missing):', sheet['out']); continue
    img = Image.open(p).convert('RGB')
    W, H = img.size
    quads = [(0, 0, W // 2, H // 2), (W // 2, 0, W, H // 2),
             (0, H // 2, W // 2, H), (W // 2, H // 2, W, H)]
    for box, name in zip(quads, names):
        a = np.asarray(img.crop(box)).astype(np.float32)
        luma = a.max(axis=2)
        alpha = np.clip((luma - NOISE_FLOOR) / (255 - NOISE_FLOOR), 0, 1) * 255
        scale = 255.0 / np.maximum(luma, 1)            # un-premultiply against black
        rgb = np.clip(a * scale[..., None], 0, 255)
        im = Image.fromarray(np.dstack([rgb, alpha]).astype(np.uint8))
        bbox = im.getbbox()
        if bbox:
            pad = 6
            bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad),
                    min(im.width, bbox[2] + pad), min(im.height, bbox[3] + pad))
            im = im.crop(bbox)
        dest = os.path.join(cut_dir, name + '.png')
        im.save(dest, optimize=True)
        total += 1
        print(f'  {name}.png  {im.width}x{im.height}  {os.path.getsize(dest)//1024}KB')

print(f'done — {total} cutouts -> {os.path.relpath(cut_dir, CRAFT_ROOT)}')
