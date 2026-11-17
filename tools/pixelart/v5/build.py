"""Builds the realistic art (D-037) into public/assets/art/: 640x360 art shown 2x.

    python3 tools/pixelart/v5/build.py

Layout (art px = screen px / 2) must match src/render/layout.ts:
  ward line y 253 · paper 236..364 x 256..286 · counter 386..450 x 264..286, combo 290..308
  seal (300, 250) r 75 · wizard top-left (18, 194) · rack 548..637 x 63..307 · status y 327..354
"""
import math, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image, ImageFilter
import px
from px import Canvas, fbm2, col, W, H
import interior as I
import scenes as S
import realistic as R
import wizards as WZ

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'public', 'assets', 'art'))

# new layout, shared by the interior helpers
I.WARD_Y = 253
I.WIN = [(92, 360), (372, 536)]
I.SPRING = 112
I.SEAL = (300, 250, 75)
WIZ = (18, 194)


def interior6(c, th, rng):
    win = I.opening_mask(c)
    wall = ~win & (np.arange(H)[:, None] < I.WARD_Y) & (np.arange(W)[None, :] < 542)
    I.stone(c, wall, rng)
    ring = I.dilate(win, 5) & ~win & wall
    yy, xx = np.mgrid[0:H, 0:W]
    c.a[ring] = col('34303c') * (0.85 + 0.15 * ((np.arctan2(yy - I.SPRING, xx - 300) * 24).astype(int) % 2))[ring][..., None]
    c.a[I.dilate(win, 1) & ~win & wall] = col('0e0c12')
    for p0, p1 in ((84, 92), (360, 372), (536, 542)):
        c.fill(c.rect(p0 - 2, I.SPRING - 6, p1 + 2, I.SPRING), '4a4250'); c.fill(c.rect(p0 - 2, I.SPRING, p1 + 2, I.SPRING + 2), '1a1620')
    # bookshelf on the left, full height
    shelves = [30, 64, 98, 132, 166, 200, 234, 268, 302]
    I.bookshelf(c, rng, 0, 80, 0, 322, shelves)
    for ys in shelves: I.book_row(c, rng, 5, 75, ys, 9, 24)
    c.a[46:64, 5:75] = col('1c120c'); I.book_row(c, rng, 5, 38, 64, 8, 14); I.skull(c, 44, 64); I.bottle(c, 62, 64, 13, '3a5a5a', th['magic'], True)
    c.a[150:166, 30:75] = col('1c120c'); I.book_row(c, rng, 5, 30, 166, 8, 14)
    I.bottle(c, 36, 166, 14, '3a5a5a', '3aa49a', True); I.candle(c, 58, 166, 9, th['candle'], r=26)
    for x, y, h in ((20, 98, 8), (52, 132, 10), (14, 234, 9)):
        c.a[y - 13:y, x - 3:x + 6] = col('1c120c'); I.candle(c, x, y, h, th['candle'], r=26)
    I.banner(c, 100, 118, 8, 104, '5a1640', th['magic'])
    # candelabra on the right pier, bottles on a ledge
    for x, h in ((500, 11), (510, 16), (520, 11)): I.candle(c, x, 150, h, th['candle'], r=30)
    c.fill(c.rect(496, 150, 528, 153), '6a4a22'); c.fill(c.rect(510, 153, 513, 186), '5a3a1a'); c.fill(c.rect(504, 184, 520, 187), '6a4a22')
    I.seal(c, th['magic'], rng)


def study6(c, th, rng):
    W0 = I.WARD_Y
    c.fill(c.rect(80, W0, 542, W0 + 3), '5a5262'); c.fill(c.rect(80, W0 + 3, 542, W0 + 7), '2e2834'); c.a[W0, 80:542] = col('7a7088')
    lower = c.rect(80, W0 + 7, 542, 318)
    I.stone(c, lower, rng, '231f28', '121016', 28, 14, W0 + 7)
    c.fill(c.rect(0, 316, 542, 322), '4a2e1e'); c.a[316, 0:542] = col('7a5236')
    # owl on books, candles, a bottle (left of the typewriter, right of the wizard)
    for k, (w, t) in enumerate(((44, '4a1e22'), (40, '2a3a3a'), (42, '4a3a20'))):
        y = 316 - (k + 1) * 6; x = 132 + (k % 2) * 3
        c.fill(c.rect(x, y, x + w, y + 6), t); c.a[y, x:x + w] = col(t) * 1.4; c.fill(c.rect(x + w - 3, y + 1, x + w, y + 5), 'c8b48c')
    I.owl(c, 146, 276)
    I.candle(c, 124, 316, 14, th['candle'], r=34); I.candle(c, 186, 316, 9, th['candle'], r=24)
    I.bottle(c, 200, 316, 22, '3a5a5a', th['magic'], True)
    I.armillary(c, 490, 286); I.bottle(c, 462, 316, 16, '3a5a5a', '3aa49a', True)
    if th['prop'] == 'brazier':
        c.fill(c.poly([(516, 316), (520, 304), (536, 304), (540, 316)]), '2a2228'); I.Canvas.glow(c, 528, 302, 30, th['magic'], 0.7)
        for x in range(518, 538, 3): c.a[300 + (x % 4):304, x] = col('ffb040')
    if th['prop'] == 'rod':
        c.fill(c.rect(530, 270, 533, 316), 'a07a38'); c.fill(c.ellipse([524, 260, 538, 274]), th['magic']); I.Canvas.glow(c, 531, 267, 22, th['magic'], 0.6)
    # status shelf
    c.fill(c.rect(0, 322, W, H), '1a100c'); c.a[322:325, :] = col('4a2e1e'); c.a[322, :] = col('7a5236')
    for x0, x1 in ((20, 179), (188, 332), (344, 483), (495, 625)): I.ornate_frame(c, x0, 327, x1, 354, th['magic'])
    for x in (8, 184, 338, 489, 632): I.gem(c, x, 340, th['magic'])
    # spell cabinet
    cab = c.rect(542, 0, 640, 322); c.fill(cab, '2a1a12')
    yy, xx = np.mgrid[0:H, 0:W]
    c.a[cab & (((xx * 7 + (yy // 5) * 3) % 11) == 0)] *= 0.75
    I.ornate_frame(c, 548, 62, 637, 307, th['magic']); I.ornate_frame(c, 556, 40, 630, 58, th['magic']); I.gem(c, 593, 32, th['magic'])
    c.fill(c.poly([(542, 30), (593, 4), (640, 30), (640, 34), (542, 34)]), '3a2418'); c.a[34, 542:] = col('7a5236')


def typewriter_front(c, th):
    """The enchanted typewriter facing the player: carriage and paper above, three rows of keys, brass base."""
    yy, xx = np.mgrid[0:H, 0:W]
    # carriage: platen and knobs either side of the paper
    c.fill(c.rect(226, 280, 374, 290), '16141a'); c.a[281, 226:374] = col('3a3640')
    for x in (214, 372):
        c.fill(c.rect(x, 276, x + 14, 292), '7a5a2a'); c.fill(c.rect(x + 2, 278, x + 12, 290), 'a07a38'); c.a[278, x + 2:x + 12] = col('d0a860')
    for x in (232, 364): c.fill(c.rect(x, 258, x + 3, 282), '8a6a32')
    # body, slightly wider at the base
    body = c.poly([(222, 290), (378, 290), (392, 318), (208, 318)])
    c.fill(body, '2a2028'); c.a[body & (yy < 293)] = col('5a4232')
    c.fill(c.rect(206, 314, 394, 320), '7a5a2a'); c.a[314, 206:394] = col('c09a50')
    for x in range(212, 392, 12): c.a[316:318, x:x + 2] = col('e0c070')
    for row, y in enumerate((294, 301, 308)):
        x0 = 230 + row * 4
        for x in range(x0, 372 - row * 3, 9):
            c.fill(c.ellipse([x - 1, y - 1, x + 7, y + 6]), '1a1418'); c.fill(c.ellipse([x, y, x + 6, y + 5]), 'b8ac90')
            c.a[y + 1, x + 1:x + 4] = col('e0d8c0')
    c.fill(c.rect(270, 315, 330, 317), 'b8ac90')   # space bar
    # score counter housing
    c.fill(c.rect(382, 258, 456, 316), '3a2418'); c.a[258:316, 382] = col('5a3a22')
    I.ornate_frame(c, 386, 264, 450, 286, th['magic']); I.ornate_frame(c, 386, 290, 450, 308, th['magic'])
    c.fill(c.rect(398, 251, 438, 259), '2a1a12'); I.ornate_frame(c, 400, 252, 436, 258, th['magic'])


def outside(theme):
    if theme == 'ch1':
        return R.sky_ch1()
    c = S.SCENES[theme]()
    a = c.a
    lum = a @ np.array([0.299, 0.587, 0.114])
    sat = a.max(axis=2) - a.min(axis=2)
    emis = np.where(((lum > 170) | ((sat > 90) & (lum > 110)))[..., None], a, 0)
    # atmospheric texture and haze toward the horizon
    a *= (0.82 + 0.3 * fbm2(H, W, 77, 40, 5))[..., None]
    yy = np.arange(H)[:, None]
    haze = np.clip((yy - 140) / 120, 0, 0.35)[..., None]
    a[:] = a * (1 - haze) + a.mean(axis=(0, 1)) * 1.2 * haze
    return c, emis


def render(theme):
    th = I.THEMES[theme]; rng = np.random.default_rng(len(theme))
    R.LIGHTS.clear()
    saved = Canvas.glow; Canvas.glow = R._record
    try:
        c, emis_sky = outside(theme)
        interior6(c, th, rng); study6(c, th, rng); typewriter_front(c, th)
    finally:
        Canvas.glow = saved
    R.LIGHTS.append((300, 230, 130, col(th['magic']), 0.9))
    R.LIGHTS.append((420, 70, 420, col(th['key']), 0.10))
    win = I.opening_mask(c)
    L = R.lightmap(win)
    em = R.emissive_mask(c.a, th) & ~win
    lit = R.tone(c.a * R.texture(3) * L)
    base = np.where(em[..., None], c.a * 1.05, lit)
    base[win] = c.a[win] + emis_sky[win] * (0.6 if theme == 'ch1' else 0.15)
    emis = np.where(em[..., None], c.a, 0) + emis_sky * win[..., None] * (1 if theme == 'ch1' else 0.5)
    bloom = R.blur(emis, 2) * 0.8 + R.blur(emis, 7) * 0.6 + R.blur(emis, 20) * 0.45
    out = np.clip(base + bloom, 0, 255)
    img = px.grade(Image.fromarray(out.astype(np.uint8)), sat=0.9, bright=1.0, gamma=1.0, grit=0.05, vignette=0.45, seed=2)
    return img, L


def wizard(L, th, wiz='apprentice', look='A'):
    """The wizard seated at lower left, turned toward the typewriter, lit by the room."""
    spec = dict(WZ.WIZARDS[wiz][look])
    spec['robe'] = '2a2840'; spec['hatc'] = '24223a'; spec['trim'] = '2e2a3a'; spec['eyes'] = 'none'; spec['hair'] = None
    img, ids = WZ.draw(spec, 'side', k=1.0, outline=False, ids=True)
    a = np.asarray(img, float); alpha = a[..., 3] > 0
    h, w = alpha.shape
    height = np.sqrt(R.dist(alpha, 20)) * 1.6
    for mi in np.unique(ids[ids > 0]): height += np.sqrt(R.dist(ids == mi, 8)) * 1.2
    xx = np.arange(w)[None, :]; yy = np.arange(h)[:, None]
    height += (np.sin(xx * 0.7 + 2 * np.sin(yy * 0.08)) * 0.5 + 0.5) * (yy > 70) * 0.45
    gy, gx = np.gradient(height)
    n = np.dstack([-gx, -gy, np.ones_like(height) * 1.3]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    x0, y0 = WIZ
    lights = [((124 - x0, 290 - y0, 40), col(th['candle']) / 255, 1.3),      # candle by the owl, in front-right
              ((300 - x0, 250 - y0, -60), col(th['magic']) / 255, 1.4),      # the seal, behind-right: rim
              ((40 - x0, 100 - y0, 60), col(th['candle']) / 255, 0.6),       # shelf candles, above-left
              ((300 - x0, -100, -40), col(th['key']) / 255 + 0.2, 0.5)]      # window light
    lit = np.zeros((h, w, 3)) + np.array([0.04, 0.04, 0.055])
    P = np.dstack([np.broadcast_to(xx, (h, w)), np.broadcast_to(yy, (h, w)), np.zeros((h, w))]).astype(float)
    for p, c, s in lights:
        v = np.array(p, float)[None, None, :] - P
        d = np.linalg.norm(v, axis=2, keepdims=True); v /= d
        lit += np.clip((n * v).sum(axis=2, keepdims=True), 0, 1) * c[None, None, :] * s * (1 / (1 + (d / 160) ** 2))
    face = (yy > 40) & (yy < 68) & (np.abs(xx - 50) < 14)
    occ = np.ones((h, w, 1)); fy = np.broadcast_to(np.clip((yy - 50) / 30.0, 0.06, 0.45), (h, w)); occ[face] = fy[face][:, None]
    out = (a[..., :3] / 255) * lit * occ * (0.85 + 0.3 * fbm2(h, w, 12, 5, 3)[..., None]) * 255 * 1.9
    for ex in (50, 57): out[54, ex] = [150, 120, 110]
    out[58:61, 61] = out[58:61, 61] * 1.8   # the nose catches the candle
    rgba = np.dstack([np.clip(out, 0, 255), alpha * 255]).astype(np.uint8)
    return px.grade(Image.fromarray(rgba, 'RGBA'), vignette=0, grit=0.04, sat=0.95, bright=1.0, gamma=1.0)


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        os.remove(os.path.join(OUT, f))
    for t in I.THEMES:
        img, L = render(t)
        img.save(os.path.join(OUT, f'backdrop-{t}.png'), optimize=True)
        if t == 'ch1':
            for k in WZ.WIZARDS:
                for look in 'AB':
                    wizard(L, I.THEMES[t], k, look).save(os.path.join(OUT, f'wizard-{k}-{look.lower()}.png'), optimize=True)
    for k in ('menu', 'library'):
        px.grade(S.SCENES[k]().img(), sat=0.86, bright=0.94, gamma=1.06, grit=0.05, seed=3).save(os.path.join(OUT, f'{k}.png'), optimize=True)
    print('built into', OUT)


if __name__ == '__main__':
    main()
