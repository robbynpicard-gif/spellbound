"""The wizard's study around the window: gothic arches, stone, shelves, banner, candles, the rune seal.
Shared by every chapter; the chapter's light (THEMES) tints it. Layout matches src/render/layout.ts (art px = screen / 2)."""
import math
import numpy as np
from px import Canvas, col, bayer, W, H

# ── layout (art px) ──
WARD_Y = 235            # ward line = top of the sill
WIN = [(112, 288), (300, 470)]   # the two arched openings
SPRING = 120            # where the arches start to curve
SEAL = (302, 226, 70)   # rune seal behind the wizard
RACK = (542, 640)       # spell cabinet x range

THEMES = {
    'ch1':   dict(key='5a7a9a', candle='f0a050', magic='e25cc4', prop='candles'),
    'boss1': dict(key='b03a2c', candle='ff7040', magic='ff4060', prop='candles'),
    'ch2':   dict(key='3aa49a', candle='e8b060', magic='5ad0c0', prop='flask'),
    'boss2': dict(key='2a8a8a', candle='d0a060', magic='e25cc4', prop='flask'),
    'ch3':   dict(key='e07020', candle='ffb050', magic='ff8a30', prop='brazier'),
    'boss3': dict(key='f05020', candle='ffd070', magic='ffb040', prop='brazier'),
    'ch4':   dict(key='7a6aa0', candle='e8a860', magic='b090ff', prop='rod'),
    'boss4': dict(key='b040b0', candle='e8a060', magic='e25cc4', prop='rod'),
}


def opening_mask(c):
    yy, xx = np.mgrid[0:c.h, 0:c.w]
    m = np.zeros((c.h, c.w), bool)
    for x0, x1 in WIN:
        w = x1 - x0; r = 0.8 * w
        lower = (yy >= SPRING) & (yy < WARD_Y) & (xx >= x0) & (xx < x1)
        upper = (yy < SPRING) & (np.hypot(xx - (x0 + r), yy - SPRING) <= r) & (np.hypot(xx - (x1 - r), yy - SPRING) <= r) & (xx >= x0) & (xx < x1)
        m |= lower | upper
    return m


def dilate(m, k):
    out = m.copy()
    for dy in range(-k, k + 1):
        for dx in range(-k, k + 1):
            if dx * dx + dy * dy <= k * k:
                out |= np.roll(np.roll(m, dy, 0), dx, 1)
    return out


def tint(c, m, key, amt):
    c.a[m] = c.a[m] * (1 - amt) + col(key) * amt * (c.a[m].mean(axis=1, keepdims=True) / 128 + 0.3)


def stone(c, m, rng, base='2a2630', dark='16141c', bw=24, bh=12, y0=0):
    """Rough block masonry inside mask m, with per-block tone, chips and grime."""
    yy, xx = np.mgrid[0:c.h, 0:c.w]
    row = (yy - y0) // bh
    off = (row % 2) * (bw // 2)
    bx = (xx + off) // bw
    block_id = row * 1000 + bx
    tone = (np.sin(block_id * 12.9898) * 43758.5453) % 1
    b, d = col(base), col(dark)
    rgb = b[None, None, :] * (0.78 + 0.32 * tone[..., None])
    n = rng.random((c.h, c.w))
    rgb[n < 0.10] *= 0.8
    rgb[n > 0.97] *= 1.18
    mortar = ((yy - y0) % bh == 0) | ((xx + off) % bw == 0)
    rgb[mortar] = d
    # chipped bottom edges lit from above
    lit = ((yy - y0) % bh == 1) & ~mortar
    rgb[lit] = rgb[lit] * 1.18
    c.a[m] = rgb[m]


def book_row(c, rng, x0, x1, ybase, hmin=10, hmax=18, tones=None):
    tones = tones or ['5a1e22', '1e3a3e', '4a3a1e', '2a2442', '3a2a1a', '6a4a2a', '24302a', '4a1a3a']
    x = x0
    while x < x1 - 2:
        w = int(rng.integers(2, 6)); h = int(rng.integers(hmin, hmax))
        if x + w > x1: break
        lean = rng.random() < 0.08
        t = col(tones[rng.integers(len(tones))]) * rng.uniform(0.8, 1.15)
        if lean and x + w + 3 < x1:
            for k in range(h):
                xs = x + int(k * 0.35)
                c.a[ybase - k, xs:xs + w] = t
            x += w + 4; continue
        c.a[ybase - h:ybase, x:x + w] = t
        c.a[ybase - h:ybase, x] = t * 1.3                 # lit spine edge
        c.a[ybase - h:ybase, x + w - 1] = t * 0.6
        if h > 11 and rng.random() < 0.7:                  # gilt bands
            for by in (ybase - h + 2, ybase - 4):
                c.a[by, x:x + w] = col('a07a38') * rng.uniform(0.7, 1.0)
        x += w + (1 if rng.random() < 0.3 else 0)


def candle(c, x, y, h, colr, glow=True, r=26):
    if glow: c.glow(x + 1, y - h - 4, r, colr, 0.75, 1.6)
    c.a[y - h:y, x - 1:x + 3] = col('d8c8a0')
    c.a[y - h:y, x + 2] = col('9a8a68')
    c.a[y - h - 1:y - h, x - 1:x + 3] = col('f0e0b8')
    c.a[y - 3:y, x - 2:x + 4] = col('c8b890')                        # pooled wax
    c.a[y - h - 2, x + 1] = col('3a2a1a')                            # wick
    c.a[y - h - 6:y - h - 2, x:x + 2] = col('ffd070')
    c.a[y - h - 5:y - h - 3, x + 1] = col('fff4c0')


def skull(c, x, y):
    c.fill(c.ellipse([x, y - 12, x + 14, y]), 'b8ac90')
    c.fill(c.rect(x + 3, y - 3, x + 11, y + 2), 'a89c80')
    c.fill(c.rect(x + 3, y - 8, x + 6, y - 5) | c.rect(x + 8, y - 8, x + 11, y - 5), '1a1410')
    c.fill(c.rect(x + 6, y - 4, x + 8, y - 2), '3a2e22')
    c.fill(c.ellipse([x + 1, y - 12, x + 7, y - 7]), 'd8ccb0')


def bottle(c, x, y, h, glass, liquid, glow=False):
    if glow: c.glow(x + 4, y - h / 3, 16, liquid, 0.55, 1.6)
    c.fill(c.ellipse([x, y - h * 0.7, x + 9, y]), glass)
    c.fill(c.ellipse([x + 1, y - h * 0.45, x + 8, y - 1]), liquid)
    c.fill(c.rect(x + 3, y - h, x + 6, y - h * 0.6), glass)
    c.fill(c.rect(x + 3, y - h - 2, x + 6, y - h), '5a3a22')
    c.a[int(y - h * 0.55), x + 2] = col('e0f0f0')


def bookshelf(c, rng, x0, x1, y0, y1, shelves):
    wood, dark = col('3a2418'), col('1c120c')
    c.a[y0:y1, x0:x1] = dark
    c.a[y0:y1, x0:x0 + 4] = wood; c.a[y0:y1, x1 - 4:x1] = wood * 0.8
    c.a[y0:y1, x0] = wood * 1.3
    for k, ys in enumerate(shelves):
        c.a[ys:ys + 3, x0:x1] = wood
        c.a[ys, x0:x1] = wood * 1.35
        c.a[ys + 3, x0:x1] = dark * 0.6
    return wood


def banner(c, x0, x1, y0, y1, cloth, sigil):
    m = c.rect(x0, y0, x1, y1)
    # tattered swallowtail bottom
    mid = (x0 + x1) / 2
    m &= ~c.poly([(x0, y1), (mid, y1 - 12), (x1, y1), (x1, y1 + 2), (x0, y1 + 2)])
    rng = np.random.default_rng(3)
    for _ in range(5):
        tx = rng.integers(x0, x1); m &= ~c.rect(tx, y1 - rng.integers(4, 14), tx + 1, y1)
    c.fill(m, cloth)
    yy, xx = np.mgrid[0:c.h, 0:c.w]
    folds = m & (((xx - x0) % 7) == 0)
    c.a[folds] *= 0.72
    c.a[m & (((xx - x0) % 7) == 1)] *= 1.15
    c.fill(c.rect(x0 - 2, y0 - 2, x1 + 2, y0 + 1), '6a4a22')
    cx, cy, r = mid, y0 + (y1 - y0) * 0.38, (x1 - x0) * 0.32
    for k in range(8):
        a = k * math.pi / 4
        c.fill(c.lines([(cx, cy), (cx + math.cos(a) * r, cy + math.sin(a) * r)], 1) & m, sigil)
    c.fill((c.ellipse([cx - r * 0.5, cy - r * 0.5, cx + r * 0.5, cy + r * 0.5]) & ~c.ellipse([cx - r * 0.35, cy - r * 0.35, cx + r * 0.35, cy + r * 0.35])) & m, sigil)
    c.glow(cx, cy, r * 2.2, sigil, 0.25, 1.5, m=m)


def seal(c, magic, rng):
    cx, cy, r = SEAL
    yy, xx = np.mgrid[0:c.h, 0:c.w]
    above = yy < WARD_Y
    # magical smoke curling up from the seal
    sm = np.zeros((c.h, c.w))
    for k in range(5):
        ph = rng.random() * 6.28; amp = rng.uniform(8, 26); xo = rng.uniform(-70, 70)
        for y in range(40, WARD_Y, 1):
            t = (WARD_Y - y) / (WARD_Y - 40)
            x = cx + xo * t + amp * math.sin(ph + y / 17) * t
            wdt = 2 + 6 * (1 - t)
            x0, x1 = int(x - wdt), int(x + wdt)
            sm[y, max(0, x0):min(c.w, x1)] += 0.22 * (1 - t) ** 1.2
    hit = (np.clip(sm, 0, 0.8) > c.bay) & above
    c.a[hit] = c.a[hit] * 0.45 + col(magic) * 0.55
    c.glow(cx, cy, r * 1.6, magic, 0.55, 1.4, m=above)
    d = np.hypot(xx - cx, (yy - cy) * 1.0)
    for rr, wdt in ((r, 2), (r - 6, 1), (r - 24, 1)):
        ring = (np.abs(d - rr) < wdt / 2 + 0.5) & above
        c.a[ring] = col(magic)
    # glyphs between the outer rings
    for k in range(18):
        a = math.pi + k * math.pi / 17.0
        gx, gy = cx + math.cos(a) * (r - 3), cy + math.sin(a) * (r - 3)
        g = c.rect(int(gx) - 1, int(gy) - 1, int(gx) + 2, int(gy) + 2) & ~c.rect(int(gx), int(gy), int(gx) + 1, int(gy) + 1)
        c.fill(g & above, magic)
    # a star of two triangles
    pts = lambda off: [(cx + math.cos(off + k * 2 * math.pi / 3) * (r - 24), cy + math.sin(off + k * 2 * math.pi / 3) * (r - 24)) for k in range(4)]
    c.fill(c.lines(pts(-math.pi / 2), 1) & above, magic)
    c.fill(c.lines(pts(math.pi / 2), 1) & above, magic)
    hot = (np.abs(d - r) < 1) & above
    c.a[hot] = np.clip(col(magic) * 1.3 + 40, 0, 255)


def interior(c, theme_id, seed=1):
    th = THEMES[theme_id]; rng = np.random.default_rng(seed)
    win = opening_mask(c)
    wall = ~win & (np.arange(c.h)[:, None] < WARD_Y) & (np.arange(c.w)[None, :] < RACK[0])
    stone(c, wall, rng)
    # arch rings (voussoirs) and the central pillar
    ring = dilate(win, 5) & ~win & wall
    yy, xx = np.mgrid[0:c.h, 0:c.w]
    rs = np.zeros_like(c.a); rs[...] = col('3a3442')
    spokes = ((np.arctan2(yy - SPRING, xx - 200) * 24).astype(int) % 2 == 0)
    rs[spokes] *= 0.85
    c.a[ring] = rs[ring]
    inner = dilate(win, 1) & ~win & wall
    c.a[inner] = col('0e0c12')
    for px0, px1 in ((104, 112), (288, 300), (470, 480)):
        pm = c.rect(px0, 0, px1, WARD_Y) & ~win
        c.a[pm] = c.a[pm] * 0.9 + col('3a3442') * 0.1
        c.fill(c.rect(px0 - 2, SPRING - 6, px1 + 2, SPRING), '4a4250')   # capitals
        c.fill(c.rect(px0 - 2, SPRING, px1 + 2, SPRING + 2), '1a1620')
    tint(c, wall, th['key'], 0.12)

    # left bookshelf, full height, with clutter
    bookshelf(c, rng, 0, 98, 0, 322, [36, 74, 112, 150, 188, 226, 264, 302])
    for ys in (36, 74, 112, 150, 188, 226, 264, 302):
        book_row(c, rng, 5, 93, ys, 10, min(30, 26))
    c.a[60:74, 5:93] = col('1c120c')   # make space for the skull shelf
    book_row(c, rng, 5, 50, 74, 8, 14)
    skull(c, 58, 74); bottle(c, 78, 74, 14, '3a5a5a', th['magic'], True)
    c.a[164:188, 40:93] = col('1c120c'); book_row(c, rng, 5, 40, 188, 8, 18)
    bottle(c, 46, 188, 16, '3a5a5a', '3aa49a', True); bottle(c, 60, 188, 11, '4a3a5a', 'c04060'); candle(c, 80, 188, 10, th['candle'])
    for x, y, h in ((30, 112, 9), (70, 150, 12), (20, 264, 10), (64, 302, 8)):
        c.a[y - 14:y, x - 3:x + 6] = col('1c120c'); candle(c, x, y, h, th['candle'], r=30)
    shelf = c.rect(0, 0, 98, 322)
    c.glow(50, 200, 140, th['candle'], 0.22, 1.2, m=shelf)
    # banner
    banner(c, 112, 132, 8, 118, '5a1640', th['magic'])
    # right pier: candelabra
    for x, h in ((484, 12), (494, 18), (504, 12)):
        candle(c, x, 162, h, th['candle'], r=30)
    c.fill(c.rect(480, 162, 512, 166), '6a4a22'); c.fill(c.rect(494, 166, 498, 200), '5a3a1a'); c.fill(c.rect(488, 198, 504, 202), '6a4a22')
    bottle(c, 520, 200, 14, '3a5a5a', '3aa49a', True); bottle(c, 530, 200, 10, '4a3a3a', 'c08040')
    c.fill(c.rect(512, 200, 542, 203), '3a2418')
    seal(c, th['magic'], rng)
    return c


def study_back(c, theme_id, seed=2):
    """Below the ward line: sill, back wall, desk clutter, status shelf, the spell cabinet."""
    th = THEMES[theme_id]; rng = np.random.default_rng(seed)
    # sill
    c.fill(c.rect(98, WARD_Y, RACK[0], WARD_Y + 4), '5a5262'); c.fill(c.rect(98, WARD_Y + 4, RACK[0], WARD_Y + 9), '2e2834')
    c.a[WARD_Y, 98:RACK[0]] = col('7a7088')
    lower = c.rect(98, WARD_Y + 9, RACK[0], 318)
    stone(c, lower, rng, '231f28', '121016', 28, 14, WARD_Y + 9)
    tint(c, lower, th['key'], 0.08)
    # desk
    c.fill(c.rect(98, 314, RACK[0], 320), '4a2e1e'); c.a[314, 98:RACK[0]] = col('7a5236'); c.fill(c.rect(98, 320, RACK[0], 324), '1e120c')
    # owl on a pile of books
    for k, (w, t) in enumerate(((52, '4a1e22'), (46, '2a3a3a'), (50, '4a3a20'), (40, '3a2a3a'))):
        y = 314 - (k + 1) * 7; x = 128 + (k % 2) * 3
        c.fill(c.rect(x, y, x + w, y + 7), t); c.a[y, x:x + w] = col(t) * 1.4; c.fill(c.rect(x + w - 3, y + 1, x + w, y + 6), 'c8b48c')
    owl(c, 142, 286)
    candle(c, 112, 314, 16, th['candle'], r=34); candle(c, 186, 314, 10, th['candle'], r=24)
    bottle(c, 196, 314, 26, '3a5a5a', th['magic'], True)
    # armillary sphere right of the counter
    armillary(c, 506, 282)
    bottle(c, 474, 314, 18, '3a5a5a', '3aa49a', True)
    prop = th['prop']
    if prop == 'brazier':
        c.glow(222, 300, 40, th['magic'], 0.7)
        c.fill(c.poly([(212, 314), (216, 300), (234, 300), (238, 314)]), '2a2228')
        for x in range(214, 236, 3): c.a[296 + (x % 4):300, x] = col('ffb040')
    if prop == 'rod':
        c.fill(c.rect(222, 268, 225, 314), 'a07a38'); c.fill(c.ellipse([216, 258, 230, 272]), th['magic']); c.glow(223, 265, 26, th['magic'], 0.6)
    # status shelf: dark wood with brass rails and gem studs
    c.fill(c.rect(0, 322, W, H), '1a100c'); c.a[322:325, :] = col('4a2e1e'); c.a[322, :] = col('7a5236')
    for x0, x1 in ((20, 179), (188, 332), (344, 483), (495, 625)):
        ornate_frame(c, x0, 327, x1, 354, th['magic'])
    for x in (8, 184, 338, 489, 632):
        gem(c, x, 340, th['magic'])
    # spell cabinet
    cab = c.rect(RACK[0], 0, RACK[1], 322)
    c.fill(cab, '2a1a12')
    yy, xx = np.mgrid[0:c.h, 0:c.w]
    grain = cab & (((xx * 7 + (yy // 5) * 3) % 11) == 0)
    c.a[grain] *= 0.75
    ornate_frame(c, 548, 62, 637, 307, th['magic'], recess=True)
    ornate_frame(c, 556, 40, 630, 58, th['magic'])          # header plate (the game writes SPELLS)
    gem(c, 593, 32, th['magic'])
    c.fill(c.poly([(542, 30), (593, 4), (640, 30), (640, 34), (542, 34)]), '3a2418')
    c.a[34, RACK[0]:] = col('7a5236')
    return c


def owl(c, x, y):
    body = c.ellipse([x, y, x + 20, y + 22]); c.fill(body, '5a3e28')
    c.fill(c.ellipse([x + 4, y + 8, x + 16, y + 22]), '8a6a48')
    for k in range(4): c.fill(c.rect(x + 6, y + 11 + k * 3, x + 14, y + 12 + k * 3), '5a3e28')
    c.fill(c.poly([(x + 2, y + 2), (x + 4, y - 4), (x + 7, y + 2)]) | c.poly([(x + 13, y + 2), (x + 16, y - 4), (x + 18, y + 2)]), '4a3220')
    for ex in (x + 4, x + 12):
        c.fill(c.ellipse([ex, y + 2, ex + 6, y + 8]), 'e0a030'); c.fill(c.rect(ex + 2, y + 4, ex + 4, y + 6), '0a0806')
    c.fill(c.poly([(x + 9, y + 7), (x + 11, y + 7), (x + 10, y + 10)]), 'c8a060')


def armillary(c, cx, cy):
    brass = 'a07a38'
    c.fill(c.rect(cx - 2, cy + 18, cx + 2, cy + 30), '6a4a22'); c.fill(c.rect(cx - 10, cy + 30, cx + 10, cy + 33), brass)
    for rx, ry, w in ((20, 20, 1), (20, 7, 1), (7, 20, 1), (16, 13, 1)):
        ring = c.ellipse([cx - rx, cy - ry, cx + rx, cy + ry]) & ~c.ellipse([cx - rx + 2, cy - ry + 2, cx + rx - 2, cy + ry - 2])
        c.fill(ring, brass)
        c.a[ring & (np.arange(c.h)[:, None] < cy)] *= 1.2
    c.fill(c.ellipse([cx - 4, cy - 4, cx + 4, cy + 4]), '3aa49a'); c.glow(cx, cy, 14, '3aa49a', 0.5)


def gem(c, x, y, magic):
    c.fill(c.poly([(x, y - 5), (x + 4, y), (x, y + 5), (x - 4, y)]), '2a1a12')
    c.fill(c.poly([(x, y - 4), (x + 3, y), (x, y + 4), (x - 3, y)]), magic)
    c.a[y - 2, x - 1] = np.clip(col(magic) + 90, 0, 255)


def ornate_frame(c, x0, y0, x1, y1, magic, recess=True):
    brass, dark = col('a07a38'), col('4a3218')
    c.a[y0 - 2:y1 + 2, x0 - 2:x1 + 2] = dark
    c.a[y0 - 1:y1 + 1, x0 - 1:x1 + 1] = brass * 0.75
    c.a[y0 - 1, x0 - 1:x1 + 1] = brass * 1.15; c.a[y0 - 1:y1 + 1, x0 - 1] = brass * 1.1
    if recess: c.a[y0:y1, x0:x1] = col('0e0b10')
    for x, y in ((x0, y0), (x1 - 1, y0), (x0, y1 - 1), (x1 - 1, y1 - 1)):
        c.a[y - 1:y + 2, x - 1:x + 2] = brass * 1.2


def typewriter_back(c, theme_id):
    """Front layer: the machine seen from behind (keys face the wizard), plus the score counter housing."""
    th = THEMES[theme_id]
    brass, bd, iron = col('a07a38'), col('5a4220'), col('2a2630')
    # paper guides and platen
    for x in (226, 375): c.a[244:272, x:x + 4] = brass; c.a[244:272, x] = brass * 1.3
    c.fill(c.rect(218, 268, 386, 280), '16141a'); c.a[269, 218:386] = col('3a3640')
    for x in (204, 384):
        c.fill(c.rect(x, 264, x + 16, 284), '7a5a2a'); c.fill(c.rect(x + 2, 266, x + 14, 282), 'a07a38'); c.a[266, x + 2:x + 14] = col('d0a860')
    # body
    body = c.poly([(210, 280), (394, 280), (402, 318), (202, 318)])
    c.fill(body, '24202a')
    yy, xx = np.mgrid[0:c.h, 0:c.w]
    c.a[body & (yy < 284)] = iron * 1.4
    c.a[body & ((xx - 202) % 7 < 3) & (yy > 288) & (yy < 312) & ((xx < 280) | (xx > 324))] = col('0e0c10')  # vents
    c.fill(c.rect(202, 314, 402, 318), '7a5a2a'); c.a[314, 202:402] = brass
    c.fill(c.rect(210, 280, 394, 282), '7a5a2a')
    for x in range(214, 394, 12): c.a[315:317, x:x + 2] = col('d0a860')   # rivets
    # gear medallion with the ward gem
    gx, gy = 302, 298
    c.fill(c.ellipse([gx - 15, gy - 15, gx + 15, gy + 15]), '7a5a2a')
    for k in range(12):
        a = k * math.pi / 6
        c.fill(c.rect(int(gx + math.cos(a) * 15) - 2, int(gy + math.sin(a) * 15) - 2, int(gx + math.cos(a) * 15) + 2, int(gy + math.sin(a) * 15) + 2), '7a5a2a')
    c.fill(c.ellipse([gx - 12, gy - 12, gx + 12, gy + 12]), 'a07a38')
    c.glow(gx, gy, 24, th['magic'], 0.7)
    c.fill(c.ellipse([gx - 7, gy - 7, gx + 7, gy + 7]), th['magic'])
    c.a[gy - 4:gy - 2, gx - 3:gx - 1] = np.clip(col(th['magic']) + 100, 0, 255)
    # pipes
    c.fill(c.lines([(202, 300), (190, 300), (186, 290)], 3), '6a4a22'); c.fill(c.lines([(402, 300), (414, 300)], 3), '6a4a22')
    # score counter housing
    c.fill(c.rect(392, 238, 470, 302), '3a2418'); c.a[238:302, 392] = col('5a3a22')
    ornate_frame(c, 397, 246, 465, 270, th['magic'])
    ornate_frame(c, 397, 274, 465, 295, th['magic'])
    c.fill(c.rect(400, 302, 462, 318), '2a1a12'); c.fill(c.rect(404, 314, 458, 318), '7a5a2a')
    for x in (396, 466): c.fill(c.rect(x - 1, 300, x + 3, 318), '5a3a1a')
    c.fill(c.rect(410, 230, 452, 240), '2a1a12'); ornate_frame(c, 412, 231, 450, 239, th['magic'])  # SCORE plate
