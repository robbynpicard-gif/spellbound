"""Builds the spell icon strip into public/assets/spells/ (12x12 per spell, scaled up in game).

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

# The play backdrop comes from gothic_backdrop.py (art-direction reference).

# Spell icons: one 12x12 frame per spell, in SPELL_IDS order.
order = ['slow', 'ice', 'barrier', 'shock', 'alter', 'fire', 'wind', 'harvest']
c = Canvas(12*len(order), 12, (0, 0, 0))
im = Image.new('RGBA', (12*len(order), 12), (0, 0, 0, 0)); c.im = im; c.px = im.load()
for i, sp in enumerate(order):
    col = (238, 228, 210); dark = (40, 26, 30)  # pale symbol with a dark core: reads on any spell colour
    pal = dict(w=col + (255,), b=dark + (255,), g=P['gold'] + (255,), y=P['gold2'] + (255,))
    for j, row in enumerate(ICONS[sp]):
        for k, ch in enumerate(row):
            if ch in pal: im.putpixel((i*12+k, j), pal[ch])
im.save(os.path.join(ROOT, 'spells', 'icons.png'), optimize=True)

# Palette, for the TypeScript side (kept in sync by hand in GameConfig.ts).
print('built into', ROOT)
