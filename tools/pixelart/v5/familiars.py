"""Familiars: tiny companions that sit by the wizard (cosmetic unlocks, D-043).
24x24 art-pixel sprites, two frames each (idle, cheer), into public/assets/art/familiars.png
(a 48-wide strip per familiar: frame 0 at x 0, frame 1 at x 24; one row per familiar, in FAMILIARS order).

    python3 tools/pixelart/v5/familiars.py
"""
import os
from PIL import Image, ImageDraw

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'public', 'assets', 'art', 'familiars.png'))
S = 24
INK = (14, 10, 18, 255)

def c(h, a=255):
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)

def outline(img):
    a = img.split()[3]; out = Image.new('RGBA', img.size, (0, 0, 0, 0)); px = out.load(); ap = a.load()
    for y in range(S):
        for x in range(S):
            if ap[x, y]: continue
            if any(0 <= x + dx < S and 0 <= y + dy < S and ap[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                px[x, y] = INK
    out.alpha_composite(img)
    return out

def eyes(d, x, y, col='ffffff', gap=4):
    for ex in (x, x + gap):
        d.rectangle([ex, y, ex + 1, y + 1], fill=c(col)); d.point((ex + 1, y + 1), fill=INK)

def toad(d, f):
    d.ellipse([3, 10 - f, 20, 22], fill=c('4f8a3a')); d.ellipse([6, 14 - f, 17, 22], fill=c('8ac060'))
    d.ellipse([4, 7 - f, 9, 12 - f], fill=c('4f8a3a')); d.ellipse([14, 7 - f, 19, 12 - f], fill=c('4f8a3a'))
    d.point((6, 9 - f), fill=INK); d.point((16, 9 - f), fill=INK); d.line([8, 16 - f, 15, 16 - f], fill=c('2a4a20'))
def star(d, f):
    pts = [(12, 2 - f), (15, 9 - f), (22, 9 - f), (16, 14 - f), (18, 21 - f), (12, 17 - f), (6, 21 - f), (8, 14 - f), (2, 9 - f), (9, 9 - f)]
    d.polygon(pts, fill=c('ffd860')); d.polygon([(12, 6 - f), (14, 10 - f), (12, 14 - f), (10, 10 - f)], fill=c('fff4c0'))
    eyes(d, 9, 10 - f, '2a1a10', 5)
def bookworm(d, f):
    for k, x in enumerate(range(3, 17, 3)): d.ellipse([x, 14 - (k % 2) * f, x + 5, 19 - (k % 2) * f], fill=c('d0a0b0'))
    d.ellipse([14, 8 - f, 22, 16 - f], fill=c('e0b0c0')); d.rectangle([15, 10 - f, 21, 11 - f], fill=c('c8b48c'))
    d.point((16, 11 - f), fill=INK); d.point((20, 11 - f), fill=INK); d.rectangle([2, 19, 22, 22], fill=c('8a3a3a'))
def moth(d, f):
    w = 10 + f * 2
    d.ellipse([12 - w, 6, 12, 18], fill=c('d8d0c0')); d.ellipse([12, 6, 12 + w, 18], fill=c('d8d0c0'))
    d.ellipse([12 - w + 3, 9, 9, 14], fill=c('a89878')); d.ellipse([15, 9, 12 + w - 3, 14], fill=c('a89878'))
    d.rectangle([11, 5, 13, 20], fill=c('6a5a4a')); d.line([11, 5, 8, 1], fill=c('6a5a4a')); d.line([13, 5, 16, 1], fill=c('6a5a4a'))
def beetle(d, f):
    d.ellipse([4, 8 - f, 20, 22 - f], fill=c('b07a2a')); d.line([12, 9 - f, 12, 22 - f], fill=c('5a3a10'))
    d.ellipse([8, 12 - f, 16, 20 - f], outline=c('ffe080')); d.line([12, 16 - f, 12, 13 - f], fill=c('ffe080')); d.line([12, 16 - f, 14, 16 - f], fill=c('ffe080'))
    d.ellipse([8, 4 - f, 16, 10 - f], fill=c('7a5018')); eyes(d, 9, 6 - f, '60f0e0', 4)
def ticktock(d, f):
    d.ellipse([5, 5 - f, 19, 17 - f], fill=c('3a6a8a')); d.ellipse([8, 9 - f, 16, 17 - f], fill=c('d8e8f0'))
    d.polygon([(18, 10 - f), (23, 11 - f), (18, 12 - f)], fill=c('e6c050')); eyes(d, 9, 8 - f, 'ffffff', 5)
    sw = -3 if f else 3
    d.line([12, 17 - f, 12 + sw, 22], fill=c('e6c050')); d.ellipse([10 + sw, 20, 14 + sw, 23], fill=c('e6c050'))
def salamander(d, f):
    d.ellipse([2, 13, 18, 20], fill=c('e0602a')); d.ellipse([13, 9 - f, 22, 17 - f], fill=c('f07a3a'))
    d.line([2, 17, 0, 20 - f], fill=c('e0602a'), width=2)
    for x in (5, 9, 13): d.point((x, 14), fill=c('ffd060'))
    eyes(d, 16, 11 - f, 'ffe080', 3)
    if f: d.polygon([(17, 8), (19, 2), (21, 8)], fill=c('ffd060'))
def phoenix(d, f):
    d.ellipse([5, 8, 19, 21], fill=c('ff8a2a')); d.ellipse([8, 12, 16, 21], fill=c('ffd070'))
    for k, x in enumerate((7, 11, 15)): d.polygon([(x, 9), (x + 2, 2 - f * 2 - (k == 1) * 2), (x + 4, 9)], fill=c('ffd060' if k == 1 else 'ff5a20'))
    d.polygon([(11, 13), (13, 13), (12, 15)], fill=c('ffe060')); eyes(d, 9, 11, '2a1010', 5)
    if f: d.polygon([(2, 12), (6, 10), (6, 15)], fill=c('ff5a20')); d.polygon([(22, 12), (18, 10), (18, 15)], fill=c('ff5a20'))
def mouse(d, f):
    d.ellipse([4, 10 - f, 18, 21], fill=c('9a8a7a')); d.ellipse([12, 6 - f, 22, 15 - f], fill=c('aa9a8a'))
    d.ellipse([12, 2 - f, 16, 7 - f], fill=c('d0a0a0')); d.ellipse([18, 3 - f, 22, 8 - f], fill=c('d0a0a0'))
    d.point((19, 10 - f), fill=INK); d.point((22, 11 - f), fill=c('e07a7a')); d.line([4, 18, 0, 14 + f], fill=c('d0a0a0'))
    d.ellipse([3, 15, 9, 21], fill=c('e6c050')); d.point((6, 17), fill=c('a02a2a'))
def crane(d, f):
    d.polygon([(2, 14), (12, 8 - f * 3), (22, 14), (12, 16)], fill=c('f0e8d8')); d.polygon([(12, 8 - f * 3), (12, 16), (22, 14)], fill=c('d8ccb8'))
    d.line([12, 12, 7, 4], fill=c('f0e8d8'), width=2); d.polygon([(7, 4), (4, 5), (7, 6)], fill=c('f0e8d8')); d.rectangle([11, 16, 13, 20], fill=c('d8ccb8'))
def inkblot(d, f):
    d.ellipse([3, 7 + f, 21, 22], fill=c('1a1426')); d.ellipse([1, 15, 7, 21], fill=c('1a1426')); d.ellipse([17, 14, 23, 20], fill=c('1a1426'))
    d.ellipse([7, 10 + f, 11, 14 + f], fill=c('ffffff')); d.ellipse([13, 10 + f, 17, 14 + f], fill=c('ffffff'))
    d.point((9, 12 + f), fill=INK); d.point((15, 12 + f), fill=INK); d.ellipse([9, 3 + f * 2, 12, 6 + f * 2], fill=c('2a2236'))
def parrot(d, f):
    d.ellipse([6, 6 - f, 18, 22], fill=c('3ab04a')); d.ellipse([9, 2 - f, 19, 11 - f], fill=c('e04040'))
    d.polygon([(18, 6 - f), (23, 8 - f), (18, 10 - f)], fill=c('f0d060')); d.point((15, 5 - f), fill=INK)
    d.polygon([(6, 12), (2, 22), (9, 18)], fill=c('3a6ae0'))
    if f: d.rectangle([0, 0, 5, 4], fill=c('f0e8d8')); d.text((0, -3), '!', fill=INK)

FAMILIARS = [('toad', toad), ('star', star), ('bookworm', bookworm), ('moth', moth), ('beetle', beetle), ('ticktock', ticktock),
             ('salamander', salamander), ('phoenix', phoenix), ('mouse', mouse), ('crane', crane), ('inkblot', inkblot), ('parrot', parrot)]

if __name__ == '__main__':
    sheet = Image.new('RGBA', (S * 2, S * len(FAMILIARS)), (0, 0, 0, 0))
    for r, (name, fn) in enumerate(FAMILIARS):
        for f in (0, 1):
            img = Image.new('RGBA', (S, S), (0, 0, 0, 0)); fn(ImageDraw.Draw(img), f)
            sheet.alpha_composite(outline(img), (f * S, r * S))
    sheet.save(OUT, optimize=True)
    big = sheet.resize((sheet.width * 6, sheet.height * 6), Image.NEAREST)
    bg = Image.new('RGBA', big.size, (40, 36, 50, 255)); bg.alpha_composite(big); bg.save('/tmp/familiars.png')
    print('familiars:', [n for n, _ in FAMILIARS])
