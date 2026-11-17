"""Chapter and boss backdrops derived from the cleaned gothic backdrop (gothic.png).

Each chapter re-lights the view through the windows (and grades the room to
match); each boss pushes it further. Output: public/assets/backgrounds/
gothic-ch{1..4}.png and gothic-boss{1..4}.png (640x360, shown at 2x).

    python3 tools/pixelart/gothic_chapters.py   (after gothic_backdrop.py)
"""
import math, os, random
import numpy as np
from PIL import Image, ImageFilter

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'assets', 'backgrounds'))
BASE = np.asarray(Image.open(os.path.join(OUT, 'gothic.png')).convert('RGB'), dtype=np.float32)
H, W = BASE.shape[:2]
yy, xx = np.mgrid[0:H, 0:W]

def feather_rect(x0, y0, x1, y1, f):
    m = np.clip(np.minimum.reduce([xx - x0, x1 - xx, yy - y0, y1 - yy]) / f, 0, 1)
    return m[..., None]

SKY = feather_rect(118, -40, 552, 238, 14)            # the view through the windows
MOON = (475, 55, 30)                                    # centre x, y, radius (640 space)
luma = (BASE @ np.array([0.3, 0.59, 0.11], np.float32))[..., None]

def grade(img, mask, color, strength):
    tinted = luma / 255 * np.array(color, np.float32) * 1.6
    return img * (1 - strength * mask) + tinted * strength * mask

def disc_mask(cx, cy, r, soft=3):
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    return np.clip((r - d) / soft, 0, 1)[..., None]

def glow(img, cx, cy, r, color, strength):
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    a = np.clip(1 - d / r, 0, 1) ** 2 * strength
    return img + a[..., None] * np.array(color, np.float32)

def put(img, x, y, color, a=1.0):
    if 0 <= x < W and 0 <= y < H:
        img[y, x] = img[y, x] * (1 - a) + np.array(color, np.float32) * a

def line(img, x0, y0, x1, y1, color, a=1.0, width=1):
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    for i in range(n):
        x = round(x0 + (x1 - x0) * i / max(1, n - 1)); y = round(y0 + (y1 - y0) * i / max(1, n - 1))
        for w in range(width): put(img, x + w, y, color, a)

def in_sky(x, y):
    return 120 <= x <= 550 and 0 <= y <= 232

def bolt(img, x, y0, y1, rnd, color=(235, 235, 255), branch=True):
    x0 = x
    y = y0
    while y < y1:
        nx = x + rnd.randint(-7, 7); ny = y + rnd.randint(6, 12)
        line(img, x, y, nx, ny, color, 1.0, 2)
        if branch and rnd.random() < 0.25:
            bx = nx + rnd.choice((-1, 1)) * rnd.randint(10, 24)
            line(img, nx, ny, bx, ny + rnd.randint(8, 18), color, 0.7, 1)
        x, y = nx, ny
    return glow(img, x0, (y0 + y1) / 2, 90, (90, 90, 140), 0.6)

def tentacle(img, rnd, x, base, height, color=(14, 26, 28)):
    for t in range(height):
        w = max(1, int(6 * (1 - t / height) ** 0.7))
        cx = x + int(math.sin(t / 14 + x) * 10)
        for dx in range(-w, w + 1):
            if in_sky(cx + dx, base - t): put(img, cx + dx, base - t, color)
        if t % 9 == 0 and w > 2:
            put(img, cx - w + 1, base - t, (60, 110, 100), 0.8)

def chapter(n, boss=False):
    rnd = random.Random(n * 10 + boss)
    img = BASE.copy()
    if n == 1:
        if boss:  # blood moon over a magenta storm
            img = grade(img, SKY, (130, 30, 90), 0.55)
            m = disc_mask(*MOON)
            img = img * (1 - m * 0.8) + m * 0.8 * (luma / 255 * np.array([255, 70, 60], np.float32) * 1.4)
            img = glow(img, MOON[0], MOON[1], 120, (120, 20, 40), 0.7)
    elif n == 2:  # the Sunken Library: drowned, teal water, light shafts, bubbles
        img = grade(img, np.ones_like(SKY), (40, 130, 120), 0.28)
        img = grade(img, SKY, (30, 120, 115), 0.7)
        m = disc_mask(*MOON); img = img * (1 - m * 0.6) + m * 0.6 * np.array([120, 200, 180], np.float32)
        for sx in (160, 250, 330, 430, 520):  # light shafts
            for y in range(0, 232):
                for x in range(sx - 10 + y // 6, sx + y // 6):
                    if in_sky(x, y) and (x + y) % 3: put(img, x, y, (150, 230, 210), 0.07)
        for y in range(0, 232, 1):  # caustic ripples
            for x in range(120, 551):
                if math.sin(x / 9 + math.sin(y / 7) * 2) > 0.985 and (x * 7 + y * 3) % 5 == 0: put(img, x, y, (160, 240, 220), 0.18)
        for _ in range(140 if boss else 60):
            x, y = rnd.randint(122, 548), rnd.randint(4, 230); r = rnd.choice((1, 1, 2))
            put(img, x, y, (190, 250, 240), 0.7)
            if r > 1: put(img, x + 1, y, (190, 250, 240), 0.5); put(img, x, y - 1, (190, 250, 240), 0.5)
        if boss:  # something vast moves past the windows
            img = grade(img, SKY, (10, 50, 50), 0.45)
            for x in (170, 260, 410, 500): tentacle(img, rnd, x + rnd.randint(-8, 8), 232, rnd.randint(140, 210))
            img = glow(img, 330, 140, 50, (80, 200, 160), 0.6)
            img = glow(img, 360, 140, 50, (80, 200, 160), 0.6)
    elif n == 3:  # the Alchemist's Vault: furnace light, smoke, embers
        img = grade(img, np.ones_like(SKY), (200, 110, 50), 0.22)
        img = grade(img, SKY, (210, 90, 40), 0.65)
        m = disc_mask(*MOON); img = img * (1 - m * 0.85) + m * 0.85 * np.array([255, 150, 60], np.float32)
        img = glow(img, MOON[0], MOON[1], 110, (160, 70, 20), 0.6)
        for _ in range(26):  # smoke
            cx, cy = rnd.randint(120, 550), rnd.randint(10, 200)
            img = img * (1 - 0.35 * disc_mask(cx, cy, rnd.randint(10, 24), 10)) + 0.35 * disc_mask(cx, cy, 18, 10) * np.array([30, 22, 20], np.float32)
        for _ in range(160 if boss else 70):
            x, y = rnd.randint(122, 548), rnd.randint(30, 232)
            put(img, x, y, (255, rnd.randint(120, 200), 60), 0.9)
        if boss:  # the vault becomes an inferno
            img = grade(img, SKY, (230, 60, 20), 0.5)
            for x in range(120, 551):
                top = 232 - int(18 + 22 * abs(math.sin(x / 11)) + 14 * abs(math.sin(x / 4.3)) + rnd.randint(0, 6))
                for y in range(top, 233):
                    t = (y - top) / max(1, 232 - top)
                    if t < 0.35 and (x + y) % 2: continue          # ragged, dithered tips
                    put(img, x, y, (255, int(210 - 150 * t), 50), 0.25 + 0.4 * t)
    elif n == 4:  # the Storm Spire: cold storm light, rain, lightning
        img = grade(img, np.ones_like(SKY), (110, 120, 150), 0.25)
        img = grade(img, SKY, (90, 100, 130), 0.6)
        img = img * (1 - 0.15 * SKY)
        m = disc_mask(*MOON); img = img * (1 - m * 0.7) + m * 0.7 * np.array([60, 64, 80], np.float32)
        for _ in range(500 if boss else 260):  # rain
            x, y = rnd.randint(120, 550), rnd.randint(0, 226)
            for k in range(5): put(img, x - k // 2, y + k, (170, 180, 210), 0.35)
        img = bolt(img, rnd.randint(200, 260), 0, 200, rnd)
        if boss:
            img = grade(img, SKY, (120, 70, 170), 0.35)
            img = bolt(img, rnd.randint(380, 440), 0, 230, rnd)
            img = bolt(img, rnd.randint(140, 180), 10, 160, rnd)
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))

for n in (1, 2, 3, 4):
    chapter(n).save(os.path.join(OUT, f'gothic-ch{n}.png'), optimize=True)
    chapter(n, True).save(os.path.join(OUT, f'gothic-boss{n}.png'), optimize=True)
print('ok')
