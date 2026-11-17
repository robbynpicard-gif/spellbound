"""Builds the gothic play backdrop from the art-direction reference (docs/mockups/gothic-reference.png).

The reference is scaled to 640x360 (the game shows it at 2x), then everything
the game draws live is removed: the four sample words in the sky are patched
with nearby sky, and the insides of the spell rack, progress roll, score wheels,
combo plate and status-bar panels are cleared. Run:

    python3 tools/pixelart/gothic_backdrop.py
"""
import os
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(ROOT, 'docs', 'mockups', 'gothic-reference.png')
OUT = os.path.join(ROOT, 'public', 'assets', 'backgrounds')

im = Image.open(SRC).convert('RGB').resize((640, 360), Image.LANCZOS)

def patch(box, src_dx, src_dy):
    """Fill box (x0,y0,x1,y1, inclusive) smoothly from its surroundings, then add back the
    fine texture of a nearby region (offset dx,dy) so it doesn't look blurred."""
    global im
    a = np.asarray(im, dtype=np.float32).copy()
    x0, y0, x1, y1 = box
    m = 6
    sub = a[y0 - m:y1 + m + 1, x0 - m:x1 + m + 1].copy()
    inside = np.zeros(sub.shape[:2], bool)
    inside[m:-m, m:-m] = True
    sub[inside] = sub[~inside].mean(axis=0)
    for _ in range(400):  # diffuse the border inwards
        avg = (np.roll(sub, 1, 0) + np.roll(sub, -1, 0) + np.roll(sub, 1, 1) + np.roll(sub, -1, 1)) / 4
        sub[inside] = avg[inside]
    src = a[y0 + src_dy:y1 + 1 + src_dy, x0 + src_dx:x1 + 1 + src_dx]
    blur = np.asarray(Image.fromarray(src.astype(np.uint8)).filter(ImageFilter.BoxBlur(3)), dtype=np.float32)
    sub[m:-m, m:-m] += (src - blur) * 0.9
    a[y0 - m:y1 + m + 1, x0 - m:x1 + m + 1] = sub
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def fill(box, color):
    x0, y0, x1, y1 = box
    im.paste(color, (x0, y0, x1 + 1, y1 + 1))

# Sample words in the sky.
patch((233, 19, 316, 58), -80, 0)    # potion
patch((150, 69, 225, 104), 78, 0)    # griffin
patch((359, 91, 437, 126), -78, 0)   # moonlit
patch((243, 134, 309, 167), -66, 0)  # quill

# Live parts: cleared so the game can draw them.
fill((548, 62, 637, 306), (22, 15, 13))      # spell rack inside
fill((231, 219, 374, 254), (214, 186, 140))  # progress roll
fill((390, 241, 459, 265), (16, 11, 9))      # score wheels
fill((390, 270, 459, 291), (16, 11, 9))      # combo plate
for x0, x1 in ((20, 179), (188, 332), (344, 483), (495, 625)):
    fill((x0, 327, x1, 354), (15, 10, 9))    # status bar panels

os.makedirs(OUT, exist_ok=True)
im.save(os.path.join(OUT, 'gothic.png'), optimize=True)
print('wrote', os.path.join(OUT, 'gothic.png'))
