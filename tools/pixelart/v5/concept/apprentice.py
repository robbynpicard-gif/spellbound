"""Concept (not wired into the game): the Apprentice, his signature typewriter, and the
Apprentice's Tower (chapter 1, base state), composed at gameplay scale.

    python3 tools/pixelart/v5/concept/apprentice.py OUTDIR

Art is 640x360 (shown 2x). Keeps today's layout: ward line y 253, paper 236..364 x 256..286,
counter 386..450 x 264..308, rack 542..640, status bar 322..360 (art px).
"""
import math, os, sys
HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, '..'))
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import px
from px import Canvas, Sprite, fbm2, col, W, H
import interior as I
import realistic as R

WARD = 253
CX = 306                      # the typewriter / character centre line
K = 1.3                       # character drawing scale (design units -> art px)
MAGIC, TEAL, CANDLE = 'e25cc4', '3aa49a', 'f0a050'


def ramp(*hexes):
    return [col(h) for h in hexes]


# ───────────────────────── outside: the valley below the tower ─────────────────────────
def outside(rng):
    c = Canvas(); yy, xx = np.mgrid[0:H, 0:W]
    t = np.clip(yy / 250, 0, 1)[..., None]
    c.a[:] = col('070910') * (1 - t) + col('1c2434') * t
    emis = np.zeros((H, W, 3))
    for _ in range(140):
        x, y = rng.integers(0, W), rng.integers(0, 150)
        emis[y, x] = col('c8d4e0') * rng.uniform(0.25, 0.8)
    # moon, high and to the right, textured
    mx, my, mr = 380, 58, 22
    d = np.hypot(xx - mx, yy - my); m = d <= mr
    maria = fbm2(H, W, 4, 9, 4)
    limb = np.sqrt(np.clip(1 - (d / mr) ** 2, 0, 1))
    emis[m] = (col('d8dcd0')[None, :] * (0.55 + 0.45 * limb[m][:, None]) * (0.62 + 0.5 * np.clip((maria[m][:, None] - 0.35) * 2.2, 0, 1))) * 0.55
    c.a[m] = 0
    # thin moonlit clouds
    dens = fbm2(H, W, 21, 60, 6)
    band = np.clip(1 - np.abs(yy - 70) / 60, 0, 1)
    dn = np.clip((dens - 0.47) * 3 * band, 0, 0.85)
    lit = np.clip(dn - np.roll(np.roll(dn, 3, 0), -3, 1), 0, 1) * np.clip(1 - d / 200, 0, 1)
    c.a = c.a * (1 - dn[..., None]) + (col('161e2a') + col('7a8a9a') * lit[..., None] * 1.5) * dn[..., None]
    emis[m] *= (1 - dn[m][:, None] * 0.8)
    # mountain ranges, hazier with distance
    for k, (base, amp, colr, haze, seed) in enumerate(((175, 60, '1c2230', 0.55, 3), (200, 40, '141a24', 0.35, 5), (222, 26, '0e121a', 0.15, 8))):
        top = (base - amp * px.noise1d(W, seed, 70 - k * 15, 5, 0.5)).astype(int)
        mm = yy >= top[None, :]
        c.a[mm] = col(colr) * (1 - haze) + col('3a4658') * haze
        rim = mm & ~np.roll(mm, 1, 0) & (xx > mx - 200)
        c.a[rim] = c.a[rim] * 0.5 + col('5a6a7c') * 0.5
    # forest at the valley floor, and the village lights
    m2 = c.mask(); d2 = ImageDraw.Draw(m2)
    x = 0
    while x < W:
        h = rng.integers(8, 18); px.pine(d2, x, 240, h); x += rng.integers(3, 7)
    c.a[np.asarray(m2) > 0] = col('0a0d12')
    for _ in range(26):
        x, y = rng.integers(140, 470), rng.integers(226, 250)
        emis[y, x] = col('e8a048') * rng.uniform(0.5, 1)
    mist = fbm2(H, W, 41, 40, 4)
    mm = np.clip((yy - 205) / 40, 0, 1) * np.clip(mist * 1.4 - 0.25, 0, 1) * 0.55
    c.a = c.a * (1 - mm[..., None]) + col('3a4652') * mm[..., None]
    return c, emis


# ───────────────────────── the tower room ─────────────────────────
WIN_X0, WIN_X1, WIN_TOP, WIN_SPRING = 168, 444, 20, 118


def window_mask():
    yy, xx = np.mgrid[0:H, 0:W]
    cxw, r = (WIN_X0 + WIN_X1) / 2, (WIN_X1 - WIN_X0) / 2
    arch = (yy < WIN_SPRING) & (np.hypot(xx - cxw, (yy - WIN_SPRING) * 1.0) <= r) & (yy >= WIN_SPRING - r)
    body = (yy >= WIN_SPRING) & (yy < WARD) & (xx >= WIN_X0) & (xx < WIN_X1)
    return arch | body


def tower_wall(c, rng):
    """Curved stone: courses run straight, block widths shrink toward the edges (a round room)."""
    yy, xx = np.mgrid[0:H, 0:W]
    u = np.arcsin(np.clip((xx - 270) / 330, -0.999, 0.999))          # angle around the tower
    bw = 0.11
    row = yy // 13
    col_id = np.floor((u + (row % 2) * bw / 2) / bw)
    tone = (np.sin((row * 131 + col_id * 17) * 12.9898) * 43758.5453) % 1
    rgb = col('2a2530')[None, None, :] * (0.72 + 0.36 * tone[..., None])
    n = rng.random((H, W)); rgb[n < 0.07] *= 0.82
    edge_u = np.abs(((u + (row % 2) * bw / 2) / bw) % 1 - 0.0) < (1.2 / (330 * bw * np.cos(u) + 1e-3))
    mortar = (yy % 13 == 0) | edge_u
    rgb[mortar] = col('131118')
    rgb[(yy % 13 == 1) & ~mortar] *= 1.15
    shade = (0.55 + 0.45 * np.cos(u))[..., None]                        # the wall turns away at the sides
    return rgb * shade


def room(c, rng):
    win = window_mask()
    wall = ~win & (np.arange(H)[:, None] < 322) & (np.arange(W)[None, :] < 542)
    c.a[wall] = tower_wall(c, rng)[wall]
    yy, xx = np.mgrid[0:H, 0:W]
    # window: deep stone reveal, iron tracery, and a sill (the ward line)
    reveal = I.dilate(win, 6) & ~win & wall
    c.a[reveal] = col('1a1720') * (0.8 + 0.4 * fbm2(H, W, 9, 6, 3)[reveal][:, None])
    ring = I.dilate(win, 9) & ~I.dilate(win, 6) & wall
    c.a[ring] = col('3a3442')
    vs = ring & ((np.arctan2(yy - WIN_SPRING, xx - 306) * 30).astype(int) % 2 == 0)
    c.a[vs] *= 0.82
    lead = win & ((((xx - 168) % 46) == 0) | ((yy - 20) % 58 == 0) & (yy > WIN_SPRING - 40))
    c.a[lead] = col('0c0b10')
    c.fill(c.rect(WIN_X0 - 10, WARD, WIN_X1 + 10, WARD + 4), '5a5262'); c.a[WARD, WIN_X0 - 10:WIN_X1 + 10] = col('8a8098')
    c.fill(c.rect(WIN_X0 - 12, WARD + 4, WIN_X1 + 12, WARD + 8), '24202a')
    # roof beams and a corbel post on each side
    c.fill(c.rect(0, 0, 542, 9), '2a1a12'); c.a[8, :542] = col('120a06'); c.a[1, :542] = col('4a3020')
    for x in (96, 504):
        c.fill(c.rect(x, 9, x + 9, 322), '2e1c12'); c.a[9:322, x] = col('4a3020'); c.a[9:322, x + 8] = col('140c08')
        c.fill(c.poly([(x - 10, 9), (x + 19, 9), (x + 9, 28), (x, 28)]), '2e1c12')
    # left: shelves of books and scrolls, a ladder
    shelves = [44, 84, 124, 164, 204, 244, 284]
    I.bookshelf(c, rng, 0, 92, 9, 322, shelves)
    for k, ys in enumerate(shelves):
        if k == 2:                       # a cubby of rolled scrolls
            for j in range(10):
                sx = 6 + j * 8; c.fill(c.ellipse([sx, ys - 9, sx + 7, ys - 2]), 'c8b48c'); c.fill(c.ellipse([sx + 2, ys - 7, sx + 5, ys - 4]), '7a6a4a')
        else:
            I.book_row(c, rng, 4, 88, ys, 8, 30)
    c.a[188:204, 52:88] = col('1c120c'); I.bottle(c, 56, 204, 13, '3a5a5a', TEAL, True); I.bottle(c, 70, 204, 10, '4a3a3a', 'c08040'); I.candle(c, 82, 204, 8, CANDLE, r=24)
    for x0 in (62, 82):                  # ladder rails and rungs
        c.fill(c.lines([(x0, 322), (x0 + 22, 30)], 2), '4a3020')
    for k in range(12):
        t = k / 12; y = 312 - t * 280
        c.fill(c.lines([(62 + t * 22, y), (82 + t * 22, y)], 1), '3a2418')
    # a chandelier of candles, hanging left of the window
    c.fill(c.lines([(136, 9), (136, 34)], 1), '3a3a40')
    c.fill(c.ellipse([116, 34, 156, 42]) & ~c.ellipse([119, 36, 153, 41]), '3a3a40')
    for x in (118, 128, 136, 144, 154): I.candle(c, x, 38, 7, CANDLE, r=34)
    # right: a star chart pinned to the wall, and a brass telescope aimed out of the window
    chart = c.rect(456, 40, 498, 96); c.fill(chart, 'a8946c')
    c.a[chart] *= (0.8 + 0.3 * fbm2(H, W, 13, 8, 3)[chart][:, None])
    for _ in range(14):
        sx, sy = rng.integers(460, 494), rng.integers(44, 92); c.a[sy, sx] = col('2a2018')
    c.fill(c.lines([(462, 52), (470, 60), (480, 56), (488, 70), (476, 84)], 1), '5a4a38')
    for x, y in ((457, 41), (497, 41), (457, 95), (497, 95)): c.a[y, x] = col('c0a060')
    c.fill(c.lines([(466, 250), (478, 196)], 2) | c.lines([(494, 250), (478, 196)], 2) | c.lines([(478, 250), (478, 196)], 2), '3a2a1a')
    tube = c.poly([(440, 166), (446, 160), (494, 194), (488, 200)]); c.fill(tube, '8a6a32')
    c.fill(c.poly([(436, 160), (446, 154), (450, 162), (440, 168)]), 'a07a38')
    c.a[tube & ((xx + yy) % 9 == 0)] = col('c09a50')
    # hanging herbs (foreground silhouettes) from the left beam
    for x, l in ((110, 30), (118, 22), (126, 34)):
        c.fill(c.lines([(x, 9), (x, 9 + l)], 1), '1a1410')
        c.fill(c.poly([(x - 4, 9 + l), (x + 4, 9 + l), (x + 1, 9 + l + 14), (x - 1, 9 + l + 14)]), '1e2416')
    # cobweb in the top right corner of the room
    for k in range(5):
        a = k * 0.35 + 1.6
        c.fill(c.lines([(541, 10), (541 + math.cos(a) * 36, 10 + math.sin(a) * 36)], 1), '3a3a42')
    I.SEAL = (CX, 238, 64); I.WARD_Y = WARD
    I.seal(c, MAGIC, rng)
    return win


def desk(c, rng):
    c.fill(c.rect(0, 306, 542, 314), '4a2e1e'); c.a[306, :542] = col('7a5236'); c.fill(c.rect(0, 314, 542, 322), '1e120c')
    # left of the typewriter: books, inkwell and quill, candles
    for k, (w, t) in enumerate(((46, '4a1e22'), (40, '24343a'), (44, '4a3a20'))):
        y = 306 - (k + 1) * 6; x = 110 + (k % 2) * 4
        c.fill(c.rect(x, y, x + w, y + 6), t); c.a[y, x:x + w] = col(t) * 1.4; c.fill(c.rect(x + w - 3, y + 1, x + w, y + 5), 'c8b48c')
    c.fill(c.ellipse([166, 296, 178, 306]), '14141a'); c.fill(c.lines([(172, 298), (186, 270)], 1), 'd8ccb0'); c.fill(c.poly([(184, 272), (192, 262), (188, 276)]), 'e8e0d0')
    I.candle(c, 104, 306, 16, CANDLE, r=40); I.candle(c, 196, 306, 9, CANDLE, r=26)
    # right of the counter: hourglass and vials
    hx = 474
    c.fill(c.rect(hx, 276, hx + 16, 279), '6a4a22'); c.fill(c.rect(hx, 303, hx + 16, 306), '6a4a22')
    c.fill(c.poly([(hx + 2, 279), (hx + 14, 279), (hx + 9, 291), (hx + 14, 303), (hx + 2, 303), (hx + 7, 291)]), '5a6a74')
    c.fill(c.poly([(hx + 4, 300), (hx + 12, 300), (hx + 8, 294)]), 'c8a060')
    I.bottle(c, 500, 306, 18, '3a5a5a', TEAL, True); I.bottle(c, 514, 306, 12, '4a3a5a', MAGIC, True)
    # status shelf and spell cabinet (unchanged frames)
    c.fill(c.rect(0, 322, W, H), '1a100c'); c.a[322:325, :] = col('4a2e1e'); c.a[322, :] = col('7a5236')
    for x0, x1 in ((20, 179), (188, 332), (344, 483), (495, 625)): I.ornate_frame(c, x0, 327, x1, 354, MAGIC)
    for x in (8, 184, 338, 489, 632): I.gem(c, x, 340, MAGIC)
    cab = c.rect(542, 0, 640, 322); c.fill(cab, '2a1a12')
    yy, xx = np.mgrid[0:H, 0:W]
    c.a[cab & (((xx * 7 + (yy // 5) * 3) % 11) == 0)] *= 0.75
    I.ornate_frame(c, 548, 62, 637, 307, MAGIC); I.ornate_frame(c, 556, 40, 630, 58, MAGIC); I.gem(c, 593, 32, MAGIC)
    c.fill(c.poly([(542, 30), (593, 4), (640, 30), (640, 34), (542, 34)]), '3a2418'); c.a[34, 542:] = col('7a5236')


# ───────────────────────── the signature typewriter ─────────────────────────
def typewriter(c):
    """Seen from the far side and slightly above: the keys face the Apprentice; we see the carriage,
    the fan of typebars, ribbon spools, an exposed gear train and the ward crystal."""
    yy, xx = np.mgrid[0:H, 0:W]
    # deck (dark walnut with brass edging), widest at the bottom
    deck = c.poly([(214, 278), (398, 278), (408, 304), (204, 304)])
    c.fill(deck, '3a2216'); c.a[deck & (((xx * 5 + yy * 2) % 13) == 0)] *= 0.8
    c.a[278, 214:398] = col('c09a50')
    # key-tops on the Apprentice's side, peeking out either side of the paper
    for row, y in enumerate((280, 285)):
        for x in list(range(218 + row * 3, 234, 6)) + list(range(368 + row * 3, 396, 6)):
            c.fill(c.ellipse([x, y, x + 5, y + 4]), '1a1418'); c.fill(c.ellipse([x, y, x + 4, y + 3]), 'c8bca0'); c.a[y, x + 1] = col('ece4d0')
    # the typebar fan (visible mechanism) under the paper's foot
    for k in range(29):
        a = math.pi * (0.08 + 0.84 * k / 28)
        c.fill(c.lines([(CX, 300), (CX + math.cos(a) * 30, 300 - math.sin(a) * 12)], 1), '8a8a94' if k % 2 else '6a6a74')
    c.fill(c.ellipse([CX - 32, 286, CX + 32, 302]) & ~c.ellipse([CX - 28, 288, CX + 28, 300]) & (yy < 296), 'a07a38')
    # carriage: platen and knurled knobs, return lever on the Apprentice's left (our right)
    c.fill(c.rect(226, 280, 378, 290), '141218'); c.a[281, 226:378] = col('3a3640'); c.a[288, 226:378] = col('08070a')
    for x in (208, 380):
        c.fill(c.ellipse([x, 276, x + 18, 294]), '6a4a22'); c.fill(c.ellipse([x + 2, 278, x + 16, 292]), 'a07a38')
        for k in range(8): c.a[278 + 2 * k:279 + 2 * k, x + 3:x + 15] = col('7a5a2a') if k % 2 else col('c8a050')
    c.fill(c.lines([(370, 278), (392, 262), (398, 262)], 2), 'b08a40')
    # ribbon spools
    for x, r in ((246, MAGIC), (366, TEAL)):
        c.fill(c.ellipse([x - 9, 290, x + 9, 302]), '6a4a22'); c.fill(c.ellipse([x - 7, 291, x + 7, 300]), '2a1a2a')
        c.fill(c.ellipse([x - 4, 293, x + 4, 298]), r); c.a[295, x] = col('f0e0f0')
    # front face toward the player: walnut panel, brass trim, gear window, ward crystal
    face = c.poly([(204, 304), (408, 304), (412, 318), (200, 318)]); c.fill(face, '2a1810')
    c.a[304, 204:408] = col('d0a860'); c.a[317, 200:412] = col('7a5a2a')
    gear_win = c.ellipse([214, 305, 252, 318]); c.fill(gear_win, '0e0a0c')
    for gx, gy, r in ((224, 312, 6), (238, 310, 5), (246, 314, 4)):
        g = c.ellipse([gx - r, gy - r, gx + r, gy + r]) & gear_win
        c.fill(g, '8a6a32')
        for k in range(10):
            a = k * math.pi / 5; px_, py_ = int(gx + math.cos(a) * r), int(gy + math.sin(a) * r)
            if gear_win[py_, px_]: c.a[py_, px_] = col('c09a50')
        c.a[gy, gx] = col('2a1a10')
    for x in range(262, 400, 14): c.a[310:312, x:x + 2] = col('c09a50')     # rivets
    c.fill(c.poly([(CX - 9, 304), (CX + 9, 304), (CX + 6, 318), (CX - 6, 318)]), '6a4a22')
    c.fill(c.poly([(CX, 305), (CX + 5, 311), (CX, 317), (CX - 5, 311)]), MAGIC)
    c.a[307, CX - 1] = col('ffe0f8')
    # the score counter housing, bolted to the right of the machine
    c.fill(c.rect(382, 258, 456, 306), '3a2418'); c.a[258:306, 382] = col('5a3a22'); c.a[258, 382:456] = col('7a5236')
    I.ornate_frame(c, 386, 264, 450, 286, MAGIC); I.ornate_frame(c, 386, 290, 450, 302, MAGIC)
    c.fill(c.rect(398, 251, 438, 259), '2a1a12'); I.ornate_frame(c, 400, 252, 436, 258, MAGIC)
    c.fill(c.ellipse([452, 266, 466, 280]), '6a4a22'); c.fill(c.ellipse([455, 269, 463, 277]), 'a07a38')   # winding key


# ───────────────────────── the Apprentice ─────────────────────────
def apprentice():
    """Hooded adult scholar, long rough beard, face mostly in shadow, worn leather gloves, a teal
    crystal pendant and a magenta rune ring. Drawn as material regions, shaded from a height field."""
    S = Sprite(120, 96, K)
    hood = S.material(ramp('0c0a10', '1a1622', '2a2434', '3c3448', '544862'))
    hood_in = S.material(ramp('050407', '08070b', '0c0a10', '100e14', '141218'))
    skin = S.material(ramp('1a100c', '3a281e', '6a4a38', '8a644e', 'a88066'))
    beard = S.material(ramp('2a2624', '5a5450', '8a847c', 'b4aca0', 'd8d0c4'))
    beard_d = S.material(ramp('201c1a', '4a4440', '6e6862', '948c84', 'b8b0a6'))
    robe = S.material(ramp('0a090c', '16141c', '221e2a', '322c3c', '463e52'))
    leather = S.material(ramp('140c08', '2e1e12', '4a3220', '664830', '84603e'))
    brass = S.material(ramp('3a2810', '6a4a22', 'a07a38', 'c8a050', 'e8c878'))
    crystal = S.material(ramp('1a4a44', '2a7a72', TEAL, '6ad0c4', 'b0f0e8'))
    ring = S.material(ramp('4a1440', '8a2a78', MAGIC, 'f080e0', 'ffd0f8'))
    cx = 60
    # shoulders and robe under the hood's drape
    S.poly(robe, [(10, 96), (12, 70), (24, 58), (72, 58), (84, 70), (86, 96)])
    # hood: a deep cowl, slightly peaked, falling onto the shoulders
    S.poly(hood, [(cx, 4), (cx + 9, 7), (cx + 16, 14), (cx + 20, 26), (cx + 22, 40), (cx + 28, 52), (cx + 38, 60), (cx + 40, 70),
                  (cx - 40, 70), (cx - 38, 60), (cx - 28, 52), (cx - 22, 40), (cx - 20, 26), (cx - 16, 14), (cx - 9, 7)])
    S.poly(hood_in, [(cx, 13), (cx + 9, 17), (cx + 13, 27), (cx + 13, 40), (cx + 10, 50), (cx, 55), (cx - 10, 50), (cx - 13, 40), (cx - 13, 27), (cx - 9, 17)])
    # face: only the lower half catches light
    S.poly(skin, [(cx, 22), (cx + 7, 25), (cx + 9, 32), (cx + 8, 40), (cx + 4, 45), (cx - 4, 45), (cx - 8, 40), (cx - 9, 32), (cx - 7, 25)])
    # long, rough beard spilling over the chest, with strands
    S.poly(beard, [(cx - 8, 38), (cx - 3, 41), (cx + 3, 41), (cx + 8, 38), (cx + 11, 50), (cx + 13, 64), (cx + 10, 80), (cx + 6, 92), (cx + 2, 86),
                   (cx - 1, 95), (cx - 4, 86), (cx - 8, 92), (cx - 11, 78), (cx - 13, 62), (cx - 11, 50)])
    for k, x in enumerate(range(cx - 10, cx + 11, 3)):
        S.line(beard_d, [(x, 46 + k % 3), (x + (k % 3) - 1, 70 + (k * 7) % 14)], 1)
    S.poly(beard, [(cx - 7, 37), (cx - 2, 36), (cx, 38), (cx + 2, 36), (cx + 7, 37), (cx + 9, 42), (cx + 3, 41), (cx, 43), (cx - 3, 41), (cx - 9, 42)])  # moustache
    # leather strap and buckle across the chest, teal pendant on a cord
    S.line(leather, [(cx - 30, 62), (cx + 22, 96)], 4)
    S.rect(brass, cx - 6, 74, cx - 1, 79)
    S.line(leather, [(cx + 12, 52), (cx + 17, 66)], 1)
    S.poly(crystal, [(cx + 17, 65), (cx + 20, 69), (cx + 17, 76), (cx + 14, 69)])
    # worn leather gloves: both hands reach down to the keys; the right one wears the rune ring
    S.poly(robe, [(cx - 40, 64), (cx - 28, 60), (cx - 44, 80), (cx - 54, 78)])          # sleeves reaching down to the keys
    S.poly(robe, [(cx + 40, 64), (cx + 28, 60), (cx + 44, 80), (cx + 54, 78)])
    S.poly(leather, [(cx - 56, 76), (cx - 45, 76), (cx - 44, 86), (cx - 55, 87)])
    S.poly(leather, [(cx + 56, 76), (cx + 45, 76), (cx + 44, 86), (cx + 55, 87)])
    S.line(leather, [(cx - 55, 79), (cx - 45, 79)], 1); S.line(leather, [(cx + 55, 79), (cx + 45, 79)], 1)
    S.rect(ring, cx + 47, 82, cx + 50, 84)
    img, ids = S.render(light=(-1, -1), glow=(crystal, ring), flat=tuple(range(1, len(S.mats))), outline=False), S.id
    return img, ids, dict(hood=hood, hood_in=hood_in, skin=skin, beard=beard, crystal=crystal, ring=ring)


def light_sprite(img, ids, mats, pos, lights, ambient=(0.035, 0.035, 0.05), gain=2.2):
    a = np.asarray(img, float); alpha = a[..., 3] > 0; h, w = alpha.shape
    height = np.sqrt(R.dist(alpha, 20)) * 1.5
    for mi in np.unique(ids[ids > 0]): height += np.sqrt(R.dist(ids == mi, 8)) * 1.1
    yy, xx = np.mgrid[0:h, 0:w]
    strands = px.noise1d(w, 31, 2.2, 3, 0.6)[None, :] * 0.7 + fbm2(h, w, 33, 3, 2) * 0.3
    height += (strands * (ids == mats['beard'])) * 2.4     # rough, uneven beard strands
    gy, gx = np.gradient(height)
    n = np.dstack([-gx, -gy, np.ones_like(height) * 1.2]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    P = np.dstack([xx, yy, np.zeros((h, w))]).astype(float)
    lit = np.zeros((h, w, 3)) + np.array(ambient)
    for (p, c, s) in lights:
        v = np.array([p[0] - pos[0], p[1] - pos[1], p[2]], float)[None, None, :] - P
        d = np.linalg.norm(v, axis=2, keepdims=True); v /= d
        lit += np.clip((n * v).sum(axis=2, keepdims=True), 0, 1) * (col(c) / 255)[None, None, :] * s / (1 + (d / 170) ** 2)
    # the cowl shades the upper face; the inside of the hood stays near-black
    occ = np.ones((h, w, 1))
    face = ids == mats['skin']
    occ[face] = np.clip((yy[face] / K - 26) / 20.0, 0.05, 0.8)[:, None]
    occ[ids == mats['hood_in']] = 0.25
    tex = 0.88 + 0.24 * fbm2(h, w, 12, 4, 3)[..., None]
    out = (a[..., :3] / 255) * lit * occ * tex * 255 * gain
    glow = (ids == mats['crystal']) | (ids == mats['ring'])
    out[glow] = a[glow, :3]
    gy_ = int(31 * K); out[gy_, int(56 * K)] = out[gy_, int(64 * K)] = [150, 130, 120]       # two glints in the shadow of the hood
    rim = alpha & ~(np.roll(alpha, 2, 0) & np.roll(alpha, -2, 1) & np.roll(alpha, 2, 1))
    hr = rim & (ids == mats['hood'])
    out[hr] = out[hr] * 0.55 + col(MAGIC) * 0.4
    return np.dstack([np.clip(out, 0, 255), alpha * 255]).astype(np.uint8)


# ───────────────────────── compose ─────────────────────────
def compose():
    rng = np.random.default_rng(1)
    R.LIGHTS.clear()
    saved = Canvas.glow; Canvas.glow = R._record
    try:
        c, emis_sky = outside(rng)
        win = room(c, rng); desk(c, rng); typewriter(c)
    finally:
        Canvas.glow = saved
    R.LIGHTS.append((CX, 236, 120, col(MAGIC), 0.8))            # the seal
    R.LIGHTS.append((380, 58, 420, col('8aa0b8'), 0.12))        # the moon
    L = R.lightmap(win)
    th = dict(magic=MAGIC, candle=CANDLE)
    em = R.emissive_mask(c.a, th) & ~win
    lit = R.tone(c.a * R.texture(3) * L)
    base = np.where(em[..., None], c.a * 1.05, lit)
    base[win] = c.a[win] + emis_sky[win] * 0.7
    emis = np.where(em[..., None], c.a, 0) + emis_sky * win[..., None]
    bloom = R.blur(emis, 1.5) * 0.6 + R.blur(emis, 6) * 0.45 + R.blur(emis, 18) * 0.3
    scene = np.clip(base + bloom, 0, 255)
    # the Apprentice, behind the machine; then the machine again on top of him
    img, ids, mats = apprentice()
    pos = (CX - int(60 * K), 166)
    lights = [((CX, 238, -70), MAGIC, 0.9), ((104, 280, 90), CANDLE, 1.4), ((136, 30, 60), CANDLE, 0.7),
              ((CX, 310, 60), 'c8a0c0', 0.5), ((380, -60, -40), '8aa0b8', 0.7), ((500, 290, 70), TEAL, 0.35)]
    spr = light_sprite(img, ids, mats, pos, lights)
    out = Image.fromarray(scene.astype(np.uint8)).convert('RGBA')
    out.alpha_composite(Image.fromarray(spr, 'RGBA'), pos)
    front = Canvas(fill=np.array([1.0, 2.0, 3.0])); saved = Canvas.glow; Canvas.glow = R._record
    try:
        typewriter(front)
    finally:
        Canvas.glow = saved
    fm = (np.abs(front.a - np.array([1.0, 2.0, 3.0])).sum(axis=2) > 0.5) & (np.arange(H)[:, None] >= 262)
    o = np.asarray(out).astype(float).copy()
    o[fm, :3] = scene[fm]
    out = Image.fromarray(o.astype(np.uint8), 'RGBA').convert('RGB')
    return px.grade(out, sat=0.9, bright=1.0, gamma=1.0, grit=0.02, vignette=0.4, seed=2), spr


F = lambda s, b=True: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf' % ('-Bold' if b else ''), s)


def hud(im):
    d = ImageDraw.Draw(im)
    words = [(230, 40, 'potion', None), (520, 92, 'griffin', None), (820, 58, 'moonlit', None), (300, 200, 'quill', None),
             (660, 250, 'fire', (210, 105, 46)), (900, 170, 'lantern', None), (420, 330, 'hollow', None), (760, 380, 'riddle', None),
             (200, 420, 'tome', None), (560, 440, 'ember', None)]
    for x, y, w, sp in words:
        tw = int(d.textlength(w, font=F(22))) + 28; body = (230, 214, 180) if not sp else sp
        d.rectangle([x - 2, y - 2, x + tw + 2, y + 42], fill=(20, 14, 10)); d.rectangle([x, y, x + tw, y + 40], fill=body)
        d.rectangle([x, y + 34, x + tw, y + 40], fill=tuple(int(v * .72) for v in body))
        for sx in (x + 4, x + tw - 8): d.rectangle([sx, y + 4, sx + 4, y + 8], fill=(160, 122, 56))
        d.text((x + 14, y + 6), w, font=F(22), fill=(34, 24, 15))
    d.rectangle([472, 512, 728, 572], fill=(230, 214, 180))
    for i in range(18): d.rectangle([482 + i * 13, 522, 491 + i * 13, 532], fill=(230, 160, 60) if i < 12 else (120, 100, 80))
    d.line([480, 544, 720, 544], fill=(160, 140, 110), width=2); d.text((570, 550), 'ridd', font=F(18), fill=(168, 52, 140))
    for i, ch in enumerate('001240'): d.rectangle([776 + i * 20, 532, 792 + i * 20, 568], fill=(232, 220, 192)); d.text((778 + i * 20, 536), ch, font=F(22), fill=(34, 24, 15))
    d.text((790, 582), 'COMBO ×4', font=F(17), fill=(226, 92, 196)); d.text((818, 504), 'SCORE', font=F(10), fill=(230, 214, 180))
    d.text((1150, 86), 'SPELLS', font=F(20), fill=(230, 214, 180))
    for i, (n, c, k) in enumerate((('SLOW', 'b4409c', 2), ('ICE', '3aa49a', 1), ('BARRIER', '9aa4b8', 2), ('FIRE', 'd2692e', 1), ('WIND', '6a9a5a', 1))):
        y = 130 + i * 96; cc = tuple(int(c[j:j + 2], 16) for j in (0, 2, 4))
        d.rounded_rectangle([1104, y, 1268, y + 86], 8, fill=cc); d.text((1180, y + 48), n, font=F(16), fill=(240, 230, 210), anchor='mm'); d.text((1240, y + 20), f'×{k}', font=F(18), fill=(240, 230, 210), anchor='mm')
    for (x0, x1), tx in zip(((40, 358), (376, 664), (688, 966), (990, 1250)), ('LEVEL 3 · WHISPERING STACKS', '12 / 18 WORDS', 'SCORE 1,240 · COMBO ×4', 'WARD 82%')):
        d.text(((x0 + x1) / 2, 670), tx, font=F(16, False), fill=(230, 214, 180), anchor='mm')
    return im


def sheet(scene, spr, out):
    """Character + typewriter sheet: the Apprentice at 5x and at true size, the typewriter at 3x."""
    S = Image.new('RGB', (1600, 900), (14, 12, 18)); d = ImageDraw.Draw(S)
    d.text((30, 20), 'The Apprentice · concept', font=F(30), fill=(230, 160, 60))
    a = Image.fromarray(spr, 'RGBA'); bg = Image.new('RGBA', a.size, (30, 26, 36, 255)); bg.alpha_composite(a)
    S.paste(bg.resize((a.width * 5, a.height * 5), Image.NEAREST), (30, 80))
    d.text((30, 80 + a.height * 5 + 10), 'Sprite at 5× (in game: 96×96 art px, shown 2×)', font=F(16, False), fill=(200, 190, 170))
    crop = scene.crop((196, 150, 476, 322))
    S.paste(crop.resize((crop.width * 3, crop.height * 3), Image.NEAREST), (560, 80))
    d.text((560, 80 + crop.height * 3 + 10), 'Apprentice at his typewriter, 3× (gameplay scale is 2×)', font=F(16, False), fill=(200, 190, 170))
    S.paste(scene.crop((196, 150, 476, 322)).resize((560, 344), Image.NEAREST), (1000, 80))
    d.text((1000, 434), 'Same crop at actual gameplay scale (2×)', font=F(16, False), fill=(200, 190, 170))
    S.save(out)


if __name__ == '__main__':
    outdir = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs(outdir, exist_ok=True)
    scene, spr = compose()
    scene.save(os.path.join(outdir, 'tower-art-640.png'))
    big = scene.resize((1280, 720), Image.NEAREST)
    big.save(os.path.join(outdir, 'tower-scene-art-only.png'))
    hud(big.copy()).save(os.path.join(outdir, 'tower-gameplay-mockup.png'))
    sheet(scene, spr, os.path.join(outdir, 'apprentice-sheet.png'))
    print('ok')
