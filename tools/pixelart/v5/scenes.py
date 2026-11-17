"""Nine original 640x360 scenes: the menu, four chapters and four bosses.
Each is its own place; together they climb from a quiet wood to a broken sky."""
import math
import numpy as np
from PIL import Image, ImageDraw
from px import Canvas, ridge, pine, stars, noise1d, col, quantize, W, H


def forest(c, seed, base, amp, color, spacing=(5, 11), height=(18, 40), rim=None):
    rng = np.random.default_rng(seed)
    top = ridge(c, seed + 1, base, amp, color, feature=90)
    m = c.mask(); d = ImageDraw.Draw(m)
    x = rng.integers(0, 6)
    while x < W:
        h = rng.integers(*height)
        from px import pine as _p
        _p(d, x, top[min(W - 1, x)] + 2, h)
        x += rng.integers(*spacing)
    mm = np.asarray(m) > 0
    c.fill(mm, color)
    return top


def moon(c, cx, cy, r, body, dark, halo, halo_r=None, strength=0.5):
    c.glow(cx, cy, halo_r or r * 3, halo, strength, 1.6)
    c.fill(c.ellipse([cx - r, cy - r, cx + r, cy + r]), body)
    # crescent shading on the lower right, and a few craters
    sh = c.ellipse([cx - r, cy - r, cx + r, cy + r]) & ~c.ellipse([cx - r - r * 0.35, cy - r - r * 0.35, cx + r - r * 0.35, cy + r - r * 0.35])
    c.dfill(sh * 0.6, dark)
    rng = np.random.default_rng(cx)
    for _ in range(5):
        a, d = rng.random() * 6.28, rng.random() * r * 0.6
        x, y, rr = cx + math.cos(a) * d - 3, cy + math.sin(a) * d - 3, rng.integers(2, max(3, r // 4))
        c.dfill(c.ellipse([x, y, x + rr, y + rr]) * 0.55, dark)


def castle(c, x, base, color, window):
    blocks = [(0, 40, 18), (14, 64, 12), (24, 34, 30), (52, 52, 10), (60, 28, 26), (84, 44, 12)]
    for dx, h, w in blocks:
        x0 = x + dx
        c.fill(c.rect(x0, base - h, x0 + w, base), color)
        for k in range(x0, x0 + w, 4):
            c.fill(c.rect(k, base - h - 2, k + 2, base - h), color)
    for dx, h in ((14, 64), (52, 52), (84, 44)):
        c.fill(c.poly([(x + dx - 2, base - h), (x + dx + 6, base - h - 18), (x + dx + 14, base - h)]), color)
    for wx, wy in ((x + 18, base - 50), (x + 30, base - 22), (x + 56, base - 40), (x + 66, base - 16), (x + 88, base - 30)):
        c.fill(c.rect(wx, wy, wx + 2, wy + 3), window)
        c.glow(wx + 1, wy + 1, 7, window, 0.35)


def light_rays(c, angle, period, width, colr, strength, y1=H, seed=0):
    yy, xx = np.mgrid[0:c.h, 0:c.w]
    rng = np.random.default_rng(seed)
    u = (xx + yy * angle) % period
    band = np.clip(1 - np.abs(u - period / 2) / (width / 2), 0, 1)
    fade = np.clip(1 - yy / y1, 0, 1) ** 1.3
    flick = 0.6 + 0.4 * noise1d(c.w * 3, seed, 40)[((xx + yy * angle) % (c.w * 3)).astype(int)]
    al = band * fade * flick * strength
    hit = al > c.bay
    c.a[hit] = c.a[hit] * 0.55 + col(colr) * 0.45


def cloud_bank(c, seed, y, amp, color, rim, blob=(10, 26), step=(10, 22), x0=0, x1=W):
    rng = np.random.default_rng(seed)
    x = x0 - 10
    while x < x1 + 10:
        r = rng.integers(*blob)
        cy = y - rng.random() * amp
        c.fill(c.ellipse([x - r, cy - r * 0.7, x + r, cy + r * 0.7]) & (np.arange(c.h)[:, None] < cy + r * 0.2), rim)
        c.fill(c.ellipse([x - r, cy - r * 0.7 + 2, x + r, cy + r * 0.7 + 2]), color)
        x += rng.integers(*step)
    c.fill(c.rect(x0, int(y), x1, c.h), color)


def bolt(c, x, y0, y1, colr, glow, seed, width=1, branches=2):
    rng = np.random.default_rng(seed)
    pts = [(x, y0)]; yy = y0
    while yy < y1:
        yy += rng.integers(6, 14); x += rng.integers(-9, 10); pts.append((x, yy))
    c.glow(pts[len(pts) // 2][0], (y0 + y1) / 2, (y1 - y0) * 0.6, glow, 0.35, 1.5)
    c.fill(c.lines(pts, width + 1), glow); c.fill(c.lines(pts, width), colr)
    for b in range(branches):
        i = rng.integers(1, len(pts) - 1); bx, by = pts[i]; bp = [(bx, by)]
        for _ in range(rng.integers(2, 5)):
            bx += rng.integers(-12, 13); by += rng.integers(5, 11); bp.append((bx, by))
        c.fill(c.lines(bp, 1), colr)


def tentacle(c, pts_fn, n, r0, r1, color, sucker, rim):
    for k in range(n):
        t = k / (n - 1)
        x, y = pts_fn(t); r = r0 * (1 - t) + r1 * t
        c.fill(c.ellipse([x - r, y - r, x + r, y + r]), color)
    for k in range(0, n, 4):
        t = k / (n - 1); x, y = pts_fn(t); r = (r0 * (1 - t) + r1 * t) * 0.35
        c.fill(c.ellipse([x - r - 2, y - r, x + r - 2, y + r]), sucker)


# ─────────────────────────────── scenes ───────────────────────────────

def spires(c, rng, x0, x1, base, color, lit, n=14):
    """A gothic castle: clustered towers with needle roofs and a scatter of lit windows."""
    for _ in range(n):
        x = int(rng.integers(x0, x1)); w = int(rng.integers(6, 16)); h = int(rng.integers(30, 110))
        c.fill(c.rect(x, base - h, x + w, base), color)
        rh = int(w * rng.uniform(1.2, 2.6))
        c.fill(c.poly([(x - 1, base - h), (x + w / 2, base - h - rh), (x + w + 1, base - h)]), color)
        c.fill(c.rect(x + w // 2, base - h - rh - 4, x + w // 2 + 1, base - h - rh), color)
        for _ in range(int(h / 18)):
            if rng.random() < 0.6:
                wx = x + int(rng.integers(1, max(2, w - 2))); wy = base - int(rng.integers(6, h - 4))
                c.fill(c.rect(wx, wy, wx + 1, wy + 2), lit); c.glow(wx, wy, 5, lit, 0.3)
    # the right flank lit by the moon
    yy, xx = np.mgrid[0:c.h, 0:c.w]


def moon_tex(c, cx, cy, r, rng):
    c.glow(cx, cy, r * 3.2, '4a6a7a', 0.45, 1.5)
    m = c.ellipse([cx - r, cy - r, cx + r, cy + r]); c.fill(m, 'c8ccc4')
    yy, xx = np.mgrid[0:c.h, 0:c.w]
    from PIL import Image as _I
    g = (rng.random((10, 10)) * 255).astype(np.uint8)
    n = np.zeros((c.h, c.w)); big = np.asarray(_I.fromarray(g).resize((2 * r + 1, 2 * r + 1), _I.BICUBIC)) / 255.0
    fine = (np.asarray(_I.fromarray((rng.random((24, 24)) * 255).astype(np.uint8)).resize((2 * r + 1, 2 * r + 1), _I.BICUBIC)) / 255.0)
    n[cy - r:cy + r + 1, cx - r:cx + r + 1] = big * 0.7 + fine * 0.3
    bay = c.bay
    c.a[m & (n < 0.38)] = col('7a8480'); c.a[m & (n >= 0.38) & (n < 0.46) & (bay > 0.5)] = col('7a8480')
    c.a[m & (n > 0.66)] = col('e4e8dc')
    edge = m & (np.hypot(xx - cx, yy - cy) > r - 3) & (xx > cx) & (yy > cy - r / 2)
    c.a[edge & (bay > 0.4)] *= 0.72


def clouds(c, rng, n, y0, y1, dark, rim, rmin=10, rmax=30):
    for _ in range(n):
        x, y = rng.integers(-20, c.w + 20), rng.integers(y0, y1); r = rng.integers(rmin, rmax)
        for k in range(rng.integers(3, 6)):
            dx, dy, rr = rng.integers(-r, r), rng.integers(-r // 3, r // 3), r * rng.uniform(0.5, 1)
            c.fill(c.ellipse([x + dx - rr, y + dy - rr * 0.5 - 1, x + dx + rr, y + dy + rr * 0.5 - 1]), rim)
            c.fill(c.ellipse([x + dx - rr, y + dy - rr * 0.5, x + dx + rr, y + dy + rr * 0.5]), dark)


def ch1():
    """The moonlit spires: a teal-black sky, heavy clouds, a gothic castle under a huge moon."""
    c = Canvas(); rng = np.random.default_rng(11)
    c.grad(0, 236, ['0a0c12', '0e1218', '121a22', '18222c', '1e2a34', '24303a'])
    stars(c, rng, 200, 140, ['c8d8e0', '8aa0b0', 'e0e8f0'])
    moon_tex(c, 400, 64, 36, rng)
    clouds(c, rng, 22, 10, 110, '141a20', '2a3640')
    spires(c, rng, 330, 470, 236, '0e1218', 'e0a040', 18)
    spires(c, rng, 112, 280, 236, '121820', 'd09040', 12)
    clouds(c, rng, 10, 170, 236, '182028', '24303a', 12, 34)
    c.grad(236, H, ['0a0c12', '06080a'])
    return c


def boss1():
    """The Antlered King: a blood moon behind a colossal stag-shadow above the wood."""
    c = Canvas(); rng = np.random.default_rng(12)
    c.grad(0, 210, ['0a0408', '1a070e', '2e0b14', '4a1018', '6e1a1c', '8e2a20'])
    stars(c, rng, 90, 110, ['ffc0b0', 'c08070'])
    moon(c, 330, 58, 50, 'c8402c', '8a2018', 'a02020', 170, 0.6)
    # the king: a dark head and neck rising out of the far hills, crowned with branching antlers
    head = [(296, 210), (300, 110), (312, 82), (330, 72), (348, 82), (360, 110), (364, 210)]
    c.fill(c.poly(head), '160407')
    def antler(x, y, ang, length, depth):
        if depth == 0 or length < 4: return
        x2, y2 = x + math.cos(ang) * length, y - math.sin(ang) * length
        c.fill(c.lines([(x, y), (x2, y2)], max(1, depth)), '160407')
        antler(x2, y2, ang + 0.42, length * 0.68, depth - 1)
        antler(x2, y2, ang - 0.30, length * 0.72, depth - 1)
    antler(320, 78, 2.2, 44, 5); antler(340, 78, 0.94, 44, 5)
    for ex in (318, 342):
        c.fill(c.rect(ex - 3, 100, ex + 3, 103), 'ff5030'); c.glow(ex, 101, 12, 'ff3020', 0.6)
    ridge(c, 21, 176, 20, '220810', feature=90)
    forest(c, 22, 196, 10, '160609', height=(16, 34))
    c.glow(330, 200, 260, '6e1a1c', 0.3, 1.3, ry=26)
    forest(c, 23, 216, 10, '0c0305', spacing=(4, 8), height=(26, 56))
    c.grad(216, H, ['0c0305', '070203'])
    return c


def ch2():
    """The Drowned Archive: sunlight through deep water onto sunken arches and shelves."""
    c = Canvas(); rng = np.random.default_rng(21)
    c.grad(0, H, ['3aa49a', '268a86', '1a6e72', '13565e', '0e414c', '0a2f3a', '07202a'])
    light_rays(c, 0.45, 70, 14, '9fe8d8', 0.55, 230, 3)
    # far arches: a drowned colonnade
    for k, x in enumerate(range(-40, W, 104)):
        y = 70 + (k % 3) * 14
        blk = c.rect(x, y, x + 104, 230) & ~(c.rect(x + 14, y + 40, x + 90, 230) | c.ellipse([x + 14, y + 12, x + 90, y + 68]))
        c.fill(blk, '1a5a62')
        c.fill(c.rect(x, y, x + 104, y + 3), '2a7a7a')
        for bx in range(x, x + 104, 13): c.fill(c.rect(bx, y + 3, bx + 1, y + 10), '144a52')
    # sunken bookshelves, leaning
    for x, lean in ((60, -6), (230, 4), (420, -3)):
        sh = c.poly([(x, 210), (x + lean, 120), (x + lean + 46, 120), (x + 46, 210)])
        c.fill(sh, '0f4048')
        for yy in range(128, 206, 12):
            c.fill(c.lines([(x + 3 + lean * (210 - yy) / 90, yy), (x + 43 + lean * (210 - yy) / 90, yy)], 1), '0a2f36')
            for bx in range(x + 5, x + 42, 4):
                if rng.random() < 0.7:
                    o = lean * (210 - yy) / 90
                    c.fill(c.rect(int(bx + o), yy - 8, int(bx + o + 3), yy), ['1d6a6e', '3a5560', '5a4a5c'][rng.integers(3)])
    # kelp
    for x in range(10, W, 23):
        h = rng.integers(40, 120); ph = rng.random() * 6
        pts = [(x + 5 * math.sin(ph + y / 14), 230 - y) for y in range(0, h, 3)]
        c.fill(c.lines(pts, 3), '0d4a3e'); c.fill(c.lines(pts, 1), '2a7a56')
    # fish shoal
    for _ in range(40):
        fx, fy = 150 + rng.normal(0, 60), 80 + rng.normal(0, 18)
        c.fill(c.poly([(fx, fy), (fx + 5, fy - 1), (fx + 7, fy), (fx + 5, fy + 1)]), '1d5c66')
    ridge(c, 25, 222, 10, '0a2a32', '1a5a5a', feature=50)
    c.grad(228, H, ['0a2a32', '061a22'])
    return c


def boss2():
    """The Deep Warden: the abyss opens one enormous eye; tentacles coil up from below."""
    c = Canvas(); rng = np.random.default_rng(22)
    c.grad(0, H, ['0e3a44', '0a2a36', '081e2a', '06141e', '040c14'])
    light_rays(c, 0.3, 110, 10, '3a8a8a', 0.35, 150, 9)
    # a mountain of body with a lid and eye
    c.fill(c.ellipse([150, 0, 510, 260]), '061820')
    c.fill(c.ellipse([270, 55, 390, 105]), '0a2228')
    eye = c.ellipse([282, 63, 378, 97]); c.fill(eye, '8a6a1a')
    c.glow(330, 80, 70, 'b08a2a', 0.35, 1.8)
    c.fill(c.ellipse([292, 67, 368, 93]) & eye, 'a8842a')
    for k in range(14):   # veins
        a = rng.random() * 6.28
        pts = [(330 + math.cos(a) * 46, 80 + math.sin(a) * 16), (330 + math.cos(a) * 30, 80 + math.sin(a) * 10)]
        c.fill(c.lines(pts, 1) & eye, '5a2a10')
    c.fill(c.poly([(330, 63), (334, 80), (330, 97), (326, 80)]), '050806')
    c.fill(c.rect(312, 71, 315, 73), 'd8d0a0')
    c.fill(c.ellipse([270, 51, 390, 71]) & ~c.ellipse([270, 57, 390, 105]), '061418')  # heavy lid
    # bioluminescent spots
    for _ in range(60):
        a = rng.random() * 6.28; d = rng.uniform(0.55, 0.98)
        x, y = 330 + math.cos(a) * 180 * d, 130 + math.sin(a) * 130 * d
        c.fill(c.rect(int(x), int(y), int(x) + 2, int(y) + 2), 'e25cc4'); c.glow(x, y, 6, 'e25cc4', 0.4)
    for k, (bx, sway) in enumerate(((40, 1), (120, -1), (520, 1), (600, -1), (250, 1), (430, -1))):
        f = lambda t, bx=bx, sway=sway, k=k: (bx + sway * 60 * math.sin(t * 3.2 + k), 380 - t * (260 + 30 * (k % 3)))
        tentacle(c, f, 70, 16, 3, '0b2830', '2a6a6a', '1a4a50')
    c.grad(300, H, ['040c14', '02070c'], m=c.a.sum(2) < 60) if False else None
    return c


def ch3():
    """The Forge Below: a cavern of chains and cages over a river of molten iron."""
    c = Canvas(); rng = np.random.default_rng(31)
    c.grad(0, H, ['0e0806', '1a0c08', '2a120a', '44180c', '6a240e', '9a3a10', 'd2692e'])
    # far cavern wall pillars
    for x in range(-10, W, 70):
        w = rng.integers(20, 40)
        c.fill(c.poly([(x, 0), (x + w, 0), (x + w - 6, 210), (x + 6, 210)]), '24100a')
    c.glow(320, 230, 360, 'e07020', 0.45, 1.3, ry=90)
    # lava falls
    for x in (120, 470):
        c.fill(c.rect(x, 0, x + 12, 220), 'f0902a'); c.fill(c.rect(x + 3, 0, x + 6, 220), 'ffd070')
        c.glow(x + 6, 150, 50, 'f0902a', 0.5, 1.5, ry=120)
    # stalactites
    x = 0
    while x < W:
        w = rng.integers(6, 18); h = rng.integers(16, 70)
        c.fill(c.poly([(x, 0), (x + w, 0), (x + w / 2, h)]), '120806'); x += w + rng.integers(0, 10)
    # chains and cages
    for x, y1 in ((80, 120), (200, 80), (380, 140), (540, 100)):
        for y in range(0, y1, 4):
            c.fill(c.rect(x, y, x + 2, y + 3) if (y // 4) % 2 else c.rect(x - 1, y + 1, x + 3, y + 2), '2a1610')
        if x in (200, 380):
            c.fill(c.rect(x - 12, y1, x + 14, y1 + 30) & ~c.rect(x - 10, y1 + 2, x + 12, y1 + 28), '2a1610')
            for bx in range(x - 8, x + 12, 5): c.fill(c.rect(bx, y1, bx + 1, y1 + 30), '2a1610')
    # far anvil-works silhouettes on the river bank
    ridge(c, 33, 196, 18, '1a0a06', feature=60, sharp=True)
    for x in (60, 300, 520):
        c.fill(c.rect(x, 160, x + 26, 196), '1a0a06'); c.fill(c.rect(x + 8, 140, x + 14, 160), '1a0a06')
        c.fill(c.rect(x + 9, 136, x + 13, 140), 'f0a040')
    # molten river
    c.grad(204, 232, ['ffd070', 'f0902a', 'c0501a', '6a240e'])
    for _ in range(140):
        x, y = rng.integers(0, W), rng.integers(206, 230)
        c.fill(c.rect(x, y, x + rng.integers(3, 12), y + 1), ['ffe8a0', '8a2a0a'][rng.integers(2)])
    c.grad(232, H, ['2a120a', '0e0806'])
    return c


def boss3():
    """The Iron Colossus: a giant of slag rises from the river, its cracks running with fire."""
    c = Canvas(); rng = np.random.default_rng(32)
    c.grad(0, H, ['1a0604', '2e0a06', '501008', '7a1c0a', 'b0300e', 'e0601a'])
    for _ in range(200):
        x, y = rng.integers(0, W), rng.integers(0, 200)
        c.fill(c.rect(x, y, x + 1, y + 1), ['ffb050', 'ff7030'][rng.integers(2)])
    body = [(150, 230), (170, 150), (220, 120), (262, 110), (270, 60), (300, 34), (360, 34), (390, 60), (398, 110),
            (440, 120), (490, 150), (510, 230)]
    c.fill(c.poly(body), '1c0e0a')
    c.fill(c.poly([(280, 64), (380, 64), (372, 104), (288, 104)]), '120806')
    for ex, sgn in ((306, 1), (354, -1)):
        c.fill(c.poly([(ex - 8, 78 - 2 * sgn), (ex + 8, 78 + 2 * sgn), (ex + 6, 82), (ex - 6, 82)]), 'f0a040'); c.glow(ex, 80, 18, 'e07020', 0.55)
    # glowing cracks: random walks across the body
    m = c.poly(body)
    for s in range(26):
        x, y = rng.integers(170, 490), rng.integers(50, 220)
        pts = [(x, y)]
        for _ in range(rng.integers(4, 9)):
            x += rng.integers(-8, 9); y += rng.integers(-2, 9); pts.append((x, y))
        cr = c.lines(pts, 1) & m
        c.fill(cr, 'f0902a')
    c.glow(330, 160, 200, 'f06020', 0.25, 1.5, m=m)
    c.grad(214, 236, ['ffd070', 'f0902a', 'c0501a', '6a240e'])
    for _ in range(160):
        x, y = rng.integers(0, W), rng.integers(214, 236)
        c.fill(c.rect(x, y, x + rng.integers(3, 14), y + 1), ['ffe8a0', '8a2a0a'][rng.integers(2)])
    c.grad(236, H, ['2a100a', '0e0604'])
    return c


def ch4():
    """The Storm Spire: above the clouds, broken rocks drift past the last tower."""
    c = Canvas(); rng = np.random.default_rng(41)
    c.grad(0, 200, ['14121e', '1e1a2c', '2a2438', '3a3048', '524060', '6a5070'])
    for x in range(-20, W + 20, 26):   # low storm ceiling
        r = rng.integers(18, 34); y = rng.integers(4, 26)
        c.fill(c.ellipse([x - r, y - r * 0.6 + 3, x + r, y + r * 0.6 + 3]), '2e2840')
        c.fill(c.ellipse([x - r, y - r * 0.6, x + r, y + r * 0.6]), '1a1826')
    c.fill(c.rect(0, 0, W, 8), '1a1826')
    bolt(c, 470, 40, 150, 'f0e8ff', 'b090e0', 7)
    # floating rocks, lit from the storm
    for x, y, w in ((40, 108, 84), (190, 70, 36), (510, 118, 70), (410, 82, 26)):
        n = 9; pts = [(x, y), (x + w, y)]
        for k in range(1, n):
            t = k / n; pts.append((x + w - t * w + rng.integers(-3, 4), y + math.sin(t * math.pi) * w * 0.9 + rng.integers(0, 6)))
        rock = c.poly(pts); c.fill(rock, '241e30')
        c.fill(rock & c.rect(int(x + w * 0.55), 0, W, H), '1a1624')
        c.fill(c.rect(x - 1, y - 3, x + w + 1, y + 1), '3a4a3e'); c.fill(c.rect(x + 2, y - 4, x + w - 2, y - 3), '5a6a52')
        for k in range(3):
            vx = x + rng.integers(4, w - 4); c.fill(c.rect(vx, y + 1, vx + 1, y + rng.integers(6, 16)), '3a4a3e')
    # the spire, crooked, with one lit window
    sp = [(286, 210), (292, 120), (288, 112), (300, 90), (296, 84), (314, 38), (330, 86), (324, 92), (334, 114), (330, 120), (338, 210)]
    c.fill(c.poly(sp), '1a1624')
    c.fill(c.poly(sp) & c.rect(314, 0, W, H), '120f1a')
    for wy in (104, 140):
        c.fill(c.rect(308, wy, 314, wy + 9), 'e25cc4'); c.glow(311, wy + 4, 18, 'e25cc4', 0.5)
    cloud_bank(c, 5, 176, 10, '3a3050', '5a4a6c', blob=(14, 30), step=(14, 26))
    cloud_bank(c, 6, 206, 8, '2a2440', '403656', blob=(16, 34), step=(16, 28))
    c.grad(214, H, ['2a2440', '15121f'])
    return c


def boss4():
    """The Eclipse: the sky itself turns, spiralling into a black sun."""
    c = Canvas(); rng = np.random.default_rng(42)
    c.grad(0, H, ['08040e', '140a20', '220e30', '1a0a24', '0c0614'])
    yy, xx = np.mgrid[0:H, 0:W]
    cx, cy = 386, 100
    r = np.hypot(xx - cx, (yy - cy) * 1.3) + 1
    th = np.arctan2(yy - cy, xx - cx)
    arm = (np.sin(th * 3 + np.log(r) * 4.5) + 1) / 2
    al = arm ** 3 * np.clip(1 - r / 420, 0, 1) * 0.9
    c.dfill(al, '5a2a7a'); c.dfill(al * 0.6, '8a3aa0')
    c.glow(cx, cy, 90, 'e25cc4', 0.9, 1.4)
    c.glow(cx, cy, 60, 'ffd0f0', 0.7, 2)
    c.fill(c.ellipse([cx - 40, cy - 40, cx + 40, cy + 40]), '050208')
    # debris
    for _ in range(26):
        a = rng.random() * 6.28; d = rng.uniform(70, 300)
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d * 0.75
        s = rng.integers(3, 12)
        c.fill(c.poly([(x, y), (x + s, y + 1), (x + s * 0.6, y + s * 0.8), (x - 1, y + s * 0.5)]), '1a1222')
        c.fill(c.rect(int(x), int(y), int(x + s), int(y) + 1), '6a3a7a')
    bolt(c, 140, 0, 120, 'f0d0ff', 'a050c0', 3); bolt(c, 540, 10, 140, 'f0d0ff', 'a050c0', 5)
    cloud_bank(c, 8, 200, 10, '1e1230', '3a2050', blob=(16, 34), step=(16, 30))
    c.grad(214, H, ['1e1230', '0a0612'])
    return c


def menu():
    """Title scene: a lone crooked tower on a sea cliff; loose pages drift toward its lit window."""
    c = Canvas(); rng = np.random.default_rng(51)
    c.grad(0, 250, ['0b0a16', '141228', '1e1a3a', '2e2450', '48306a', '7a4078', 'b45a7a'])
    stars(c, rng, 320, 180, ['ffffff', 'c8c0f0', '9890d0', 'ffd0e8'])
    moon(c, 120, 70, 30, 'f4ecd8', 'c0b098', '7a5aa0', 110, 0.5)
    ridge(c, 4, 214, 30, '3a2a58', '5a4478', feature=110)
    # sea
    c.grad(232, H, ['2a2048', '1e1838', '141028', '0b0918'])
    for _ in range(220):
        x, y = rng.integers(0, 470), rng.integers(234, H)
        c.fill(c.rect(x, y, x + rng.integers(2, 9), y + 1), ['5a4478', '3a2e5c'][rng.integers(2)])
    c.fill(c.rect(90, 236, 150, 237) | c.rect(100, 244, 140, 245) | c.rect(110, 252, 130, 253), 'b0a0c8')  # moon on the water
    # cliff and tower
    cliff = [(470, H), (460, 300), (478, 250), (470, 224), (500, 200), (560, 190), (600, 196), (640, 186), (640, H)]
    c.fill(c.poly(cliff), '120e1e')
    c.fill(c.lines([(470, 224), (500, 200), (560, 190), (600, 196), (640, 186)], 1), '3a2e52')
    tw = [(540, 192), (544, 90), (538, 86), (560, 40), (582, 86), (576, 90), (580, 192)]
    c.fill(c.poly(tw), '161226')
    c.fill(c.poly([(534, 92), (560, 34), (586, 92)]), '201a34')
    for wx, wy, big in ((554, 104, True), (562, 150, False)):
        w, h = (10, 14) if big else (6, 8)
        c.glow(wx + w / 2, wy + h / 2, 40 if big else 16, 'f0a050', 0.55)
        c.fill(c.rect(wx, wy, wx + w, wy + h), 'ffcf7a'); c.fill(c.rect(wx + w // 2, wy, wx + w // 2 + 1, wy + h), '7a4a20')
    # drifting pages on the wind, curving toward the window
    for k in range(34):
        t = k / 33
        x = 20 + t * 530 + rng.normal(0, 10); y = 170 - math.sin(t * 3.0) * 70 - t * 20 + rng.normal(0, 14)
        s = 2 + int(rng.random() * 3)
        c.fill(c.rect(int(x), int(y), int(x) + s + 1, int(y) + s), 'e6d6b4')
        c.fill(c.rect(int(x), int(y) + s - 1, int(x) + s + 1, int(y) + s), 'a08a6a')
        if rng.random() < 0.3:
            c.fill(c.rect(int(x), int(y), int(x) + s + 1, int(y) + s), 'e25cc4'); c.glow(x, y, 6, 'e25cc4', 0.5)
    return c


def library():
    """A candlelit hall of shelves under a round window: wizard select and options."""
    c = Canvas(); rng = np.random.default_rng(61)
    c.grad(0, H, ['120e18', '1a141e', '221a24', '1a1418', '0e0a0e'])
    # round window with the night beyond
    win = c.ellipse([250, 20, 390, 160]); c.fill(win, '1e1a3a')
    c.grad(20, 160, ['141228', '2e2450', '5a3a6a'], m=win)
    stars(c, rng, 40, 150, ['e6e0ff', 'b8b0e0'], 260, 380)
    c.fill(c.ellipse([330, 44, 350, 64]) & win, 'efe6d2')
    for t in (c.rect(318, 20, 322, 160), c.rect(250, 88, 390, 92)): c.fill(t & win, '2a1e1a')
    ring = c.ellipse([244, 14, 396, 166]) & ~win; c.fill(ring, '3a2a22')
    c.glow(320, 90, 160, '6a4a8a', 0.35, 1.6)
    # shelves receding toward the window on both sides
    for side in (-1, 1):
        for k in range(6):
            t = k / 6; x0 = 320 + side * (300 - k * 36); x1 = 320 + side * (300 - (k + 1) * 36)
            top, bot = 10 + k * 14, 330 - k * 12
            xa, xb = min(x0, x1), max(x0, x1)
            c.fill(c.rect(xa, top, xb, bot), mix_hex('3a2418', '1a120e', t))
            for y in range(top + 8, bot - 6, 18 - k):
                c.fill(c.rect(xa, y, xb, y + 2), '1a0e0a')
                bx = xa + 2
                while bx < xb - 3:
                    w = rng.integers(2, 5)
                    c.fill(c.rect(bx, y - rng.integers(8, 14) + k, bx + w, y), ['6a2a2a', '2a4a4a', '5a4a2a', '3a2a4a', '7a6a4a'][rng.integers(5)])
                    bx += w + 1
    # floor, rug, and floating candles
    c.grad(300, H, ['2a1c18', '140c0a'])
    c.fill(c.poly([(200, 360), (250, 300), (390, 300), (440, 360)]), '4a1a2a')
    c.fill(c.poly([(214, 356), (256, 306), (384, 306), (426, 356)]) & ~c.poly([(222, 352), (260, 310), (380, 310), (418, 352)]), 'b48c48')
    for _ in range(14):
        x, y = rng.integers(40, 600), rng.integers(40, 200)
        c.glow(x, y, 18, 'f0a050', 0.5)
        c.fill(c.rect(x - 1, y, x + 2, y + 8), 'e6d6b4'); c.fill(c.rect(x, y - 3, x + 1, y), 'ffe8a0')
    return c


def mix_hex(a, b, t):
    return col(a) * (1 - t) + col(b) * t


SCENES = dict(library=library, menu=menu, ch1=ch1, boss1=boss1, ch2=ch2, boss2=boss2, ch3=ch3, boss3=boss3, ch4=ch4, boss4=boss4)

if __name__ == '__main__':
    import sys, os
    os.makedirs('out', exist_ok=True)
    for k, f in SCENES.items():
        quantize(f().img(), 56).save(f'out/scene-{k}.png')
    print('ok')
