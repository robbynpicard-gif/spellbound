"""Builds Spellbound's pixel-art PNGs into public/assets/ (1x; the game scales them 4x).

    python3 tools/pixelart/build.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from pixelart import *

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'assets'))
os.makedirs(os.path.join(ROOT, 'backgrounds'), exist_ok=True)
os.makedirs(os.path.join(ROOT, 'spells'), exist_ok=True)

def save1x(c, path):
    c.im.save(path, optimize=True)

# Play backdrops: chapter scene + ward line + study + vignette + the iron HUD plate (meters/slots are drawn by the game).
for ch in (1, 2, 3, 4):
    c = Canvas(); scenery(c, ch); ward_line(c); study(c); c.vignette(0.85); frame(c, 0, 0, 319, 15)
    save1x(c, os.path.join(ROOT, 'backgrounds', f'chapter{ch}.png'))

# Menu backdrop: the tower scene and the study, without the HUD plate.
c = Canvas(); scenery(c, 1); ward_line(c); study(c); c.vignette(0.9)
save1x(c, os.path.join(ROOT, 'backgrounds', 'menu.png'))

# Spell icons: one 12x12 frame per spell, in SPELL_IDS order.
order = ['slow', 'ice', 'barrier', 'shock', 'alter', 'fire', 'wind', 'harvest']
c = Canvas(12*len(order), 12, (0, 0, 0))
im = Image.new('RGBA', (12*len(order), 12), (0, 0, 0, 0)); c.im = im; c.px = im.load()
for i, sp in enumerate(order):
    col = SPELL[sp]; dark = tuple(int(v*0.55) for v in col)
    pal = dict(w=col + (255,), b=dark + (255,), g=P['gold'] + (255,), y=P['gold2'] + (255,))
    for j, row in enumerate(ICONS[sp]):
        for k, ch in enumerate(row):
            if ch in pal: im.putpixel((i*12+k, j), pal[ch])
im.save(os.path.join(ROOT, 'spells', 'icons.png'), optimize=True)

# Palette, for the TypeScript side (kept in sync by hand in GameConfig.ts).
print('built into', ROOT)
