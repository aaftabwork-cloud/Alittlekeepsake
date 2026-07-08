#!/usr/bin/env python3
"""Quadrant-crop the 2x2 KIE sheets, luminance-key (gold-on-black -> alpha), trim, save.
Copied from heritage/scripts/process_sheets.py — only BASE + SHEETS changed."""
from PIL import Image
import numpy as np, os

BASE = os.path.join(os.path.dirname(__file__), 'assets', 'gatsby')
SHEETS = {
    'sheet-ornaments.png': ['orn-sunburst', 'orn-divider', 'orn-corner', 'orn-medallion'],
    'sheet-objects.png':   ['obj-coupes', 'obj-chandelier', 'obj-gramophone', 'obj-clock'],
    'sheet-ambient.png':   ['fx-confetti', 'fx-firework', 'fx-stars', 'fx-feather'],
    'sheet-arch.png':      ['arch-proscenium', 'arch-skyline', 'arch-frame', 'arch-palm'],
}
NOISE_FLOOR = 10  # below this luma -> fully transparent (kills black-bg noise)

for sheet, names in SHEETS.items():
    p = os.path.join(BASE, 'raw', sheet)
    if not os.path.exists(p):
        print('skip (missing):', sheet); continue
    img = Image.open(p).convert('RGB')
    W, H = img.size
    quads = [(0, 0, W//2, H//2), (W//2, 0, W, H//2), (0, H//2, W//2, H), (W//2, H//2, W, H)]
    for (box, name) in zip(quads, names):
        a = np.asarray(img.crop(box)).astype(np.float32)
        luma = a.max(axis=2)
        alpha = np.clip((luma - NOISE_FLOOR) / (255 - NOISE_FLOOR), 0, 1) * 255
        scale = 255.0 / np.maximum(luma, 1)          # un-premultiply against black
        rgb = np.clip(a * scale[..., None], 0, 255)
        out = np.dstack([rgb, alpha]).astype(np.uint8)
        im = Image.fromarray(out, 'RGBA')
        bbox = im.getbbox()
        if bbox:
            pad = 6
            bbox = (max(0, bbox[0]-pad), max(0, bbox[1]-pad), min(im.width, bbox[2]+pad), min(im.height, bbox[3]+pad))
            im = im.crop(bbox)
        dest = os.path.join(BASE, 'cutouts', name + '.png')
        im.save(dest, optimize=True)
        print(f'{name}.png  {im.width}x{im.height}  {os.path.getsize(dest)//1024}KB')
