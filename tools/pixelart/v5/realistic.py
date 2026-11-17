"""v5 prototype: realistic, gritty lighting over the v4 layout.
Albedo (flat colours, textured) x light (candles, seal, moon, glowing glass) + bloom on emissive parts. No outlines."""
import math
import numpy as np
from PIL import Image, ImageFilter
import px
from px import Canvas, fbm2, col, W, H
import interior as I
import scenes as S

LIGHTS = []


def _record(self, cx, cy, r, c, strength=0.6, power=2.0, m=None, ry=None):
    LIGHTS.append((cx, cy, r, col(c), strength))


def blur(a, r):
    out = np.zeros_like(a)
    for k in range(3):
        im = Image.fromarray(np.clip(a[..., k], 0, 255).astype(np.uint8))
        out[..., k] = np.asarray(im.filter(ImageFilter.GaussianBlur(r)), float)
    return out


# ── outside: chapter 1, done "for real" ──
def sky_ch1():
    c = Canvas(); rng = np.random.default_rng(11)
    yy, xx = np.mgrid[0:H, 0:W]
    t = yy / 236
    c.a[:] = (col('06080c') * (1 - t[..., None]) + col('1a2630') * t[..., None])
    emis = np.zeros((H, W, 3))
    for _ in range(160):
        x, y = rng.integers(0, W), rng.integers(0, 150); b = rng.uniform(0.3, 1)
        emis[y, x] = col('c8d8e0') * b * 0.7
    mx, my, mr = 402, 62, 34
    d = np.hypot(xx - mx, yy - my)
    moon = d <= mr
    maria = fbm2(H, W, 4, 14, 4)
    limb = np.sqrt(np.clip(1 - (d / mr) ** 2, 0, 1))
    mcol = col('d8dcd0')[None, None, :] * (0.55 + 0.45 * limb[..., None]) * (0.62 + 0.55 * np.clip((maria[..., None] - 0.35) * 2.2, 0, 1))
    emis[moon] = mcol[moon] * 0.5
    c.a[moon] = 0
    # clouds: fractal density, lit on the side facing the moon
    dens = fbm2(H, W, 21, 70, 6)
    band = np.clip(1 - np.abs(yy - 80) / 80, 0, 1) * 1.0 + np.clip(1 - np.abs(yy - 205) / 40, 0, 1) * 0.6
    dn = np.clip((dens - 0.40) * 3.2 * band, 0, 0.92)
    sh = np.roll(np.roll(dn, 3, 0), -3, 1)
    lit = np.clip(dn - sh, 0, 1)
    moonfac = np.clip(1 - np.hypot(xx - mx, yy - my) / 260, 0, 1)
    cloud = col('1a242c')[None, None, :] * (0.7 + 0.6 * moonfac[..., None]) + col('8a9ca8')[None, None, :] * (lit * moonfac)[..., None] * 1.6
    c.a = c.a * (1 - dn[..., None]) + cloud * dn[..., None]
    emis[moon] *= (1 - dn[moon][..., None] * 0.85)
    # castle: two ranks of spires, the far one hazier, moonlit on its right edges
    for rank, (x0, x1, n, colr, haze) in enumerate(((112, 470, 16, '141c24', 0.55), (300, 470, 14, '0a0e12', 0.15))):
        m0 = Canvas(fill='000000'); r2 = np.random.default_rng(30 + rank)
        S.spires(m0, r2, x0, x1, 236, 'ffffff', 'ffffff', n)
        mask = m0.a[..., 0] > 128
        c.a[mask] = col(colr) * (1 + haze * (1 - yy[mask] / 236)[..., None] * 0.0)
        edge = mask & ~np.roll(mask, -1, 1) & (r2.random(mask.shape) < 0.5)
        c.a[edge] = c.a[edge] * 0.6 + col('6a7c88') * 0.4 * moonfac[edge][..., None]
        fog = np.clip((yy - 150) / 90, 0, 1) * haze
        c.a[mask] = c.a[mask] * (1 - fog[mask][..., None]) + col('2a3640') * fog[mask][..., None]
        for _ in range(30 if rank else 16):
            wx, wy = r2.integers(x0, x1), r2.integers(150, 232)
            if mask[wy, wx]: emis[wy:wy + 2, wx] = col('e8a048') * (1.0 if rank else 0.6)
    # ground mist
    mist = fbm2(H, W, 41, 50, 4)
    mm = np.clip((yy - 190) / 46, 0, 1) * np.clip(mist * 1.4 - 0.2, 0, 1) * 0.7
    c.a = c.a * (1 - mm[..., None]) + col('3a4852') * mm[..., None]
    return c, emis


def emissive_mask(a, th):
    keys = [col(k) for k in ('ffd070', 'fff4c0', 'f0e0b8', th['magic'], '3aa49a', 'c04060', th['candle'], 'ff8a30', 'ffb040')]
    keys.append(np.clip(col(th['magic']) * 1.3 + 40, 0, 255))
    m = np.zeros(a.shape[:2], bool)
    for k in keys:
        m |= np.abs(a - k).sum(axis=2) < 10
    return m


def lightmap(win_mask):
    yy, xx = np.mgrid[0:H, 0:W]
    L = np.zeros((H, W, 3)) + np.array([0.10, 0.11, 0.15])
    # moonlight spilling in through the windows
    wm = Image.fromarray((win_mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(28))
    spill = np.asarray(wm, float)[..., None] / 255.0
    L += spill * np.array([0.35, 0.45, 0.55]) * 1.6
    for (cx, cy, r, c, s) in LIGHTS:
        d = np.hypot(xx - cx, yy - cy)
        f = s / (1 + (d / (r * 0.55)) ** 2)
        L += (c / 255.0)[None, None, :] * f[..., None] * 1.5
    return L


def texture(seed):
    big = fbm2(H, W, seed, 24, 5)
    fine = np.random.default_rng(seed).random((H, W))
    return (0.72 + 0.5 * big + 0.12 * (fine - 0.5))[..., None]


def tone(x):
    return 255 * (1 - np.exp(-x / 255 * 1.25)) / (1 - math.exp(-1.25))


def prototype(theme='ch1'):
    th = I.THEMES[theme]
    LIGHTS.clear()
    Canvas.glow, saved = _record, Canvas.glow
    try:
        c, emis_sky = sky_ch1()
        I.interior(c, theme); I.study_back(c, theme)
        f = Canvas(fill=np.array([1.0, 2.0, 3.0])); I.typewriter_back(f, theme)
    finally:
        Canvas.glow = saved
    LIGHTS.append((302, 200, 120, col(th['magic']), 0.9))      # the seal, behind the wizard
    LIGHTS.append((402, 62, 400, col('9ab0c0'), 0.12))           # the moon, faintly
    win = I.opening_mask(c)
    L = lightmap(win)

    def shade(a, mask_alpha, seed):
        em = emissive_mask(a, th) & mask_alpha
        lit = tone(a * texture(seed) * L)
        out = np.where(em[..., None], a * 1.05, lit)
        return out, np.where(em[..., None], a, 0)

    base, e1 = shade(c.a, ~win, 3)
    base[win] = c.a[win]
    emis = e1 + emis_sky * win[..., None]
    base[win] = base[win] + emis_sky[win]

    wl, fa = wizard_real(th, L)
    base[fa] = wl[fa]

    fal = np.abs(f.a - np.array([1.0, 2.0, 3.0])).sum(axis=2) > 0.5
    fl, e2 = shade(f.a, fal, 7)
    base[fal] = fl[fal]; emis = emis + e2 * fal[..., None]

    bloom = blur(emis, 2) * 0.9 + blur(emis, 7) * 0.7 + blur(emis, 20) * 0.5
    out = np.clip(base + bloom, 0, 255)
    img = px.grade(Image.fromarray(out.astype(np.uint8)), sat=0.9, bright=1.0, gamma=1.0, grit=0.05, vignette=0.5, seed=2)
    return img




def erode(m):
    return m & np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1)


def dist(m, n=14):
    d = np.zeros(m.shape); cur = m.copy()
    for _ in range(n):
        d += cur; cur = erode(cur)
    return d


def wizard_real(th, L, wiz='apprentice', look='A', pos=(225, 119)):
    """Rounded, lit, untextured-outline wizard: normals from a height field, real light directions."""
    import wizards as WZ
    spec = dict(WZ.WIZARDS[wiz][look])
    spec['robe'] = '2a2840'; spec['hatc'] = '24223a'; spec['trim'] = '4a3a28'; spec['eyes'] = 'none'
    img, ids = WZ.draw(spec, 'game', outline=False, ids=True)
    a = np.asarray(img, float); alpha = a[..., 3] > 0
    h, w = alpha.shape
    # height: whole-body roundness plus each part's own bulge, plus cloth folds
    height = np.sqrt(dist(alpha, 30)) * 1.6
    for mi in np.unique(ids[ids > 0]):
        height += np.sqrt(dist(ids == mi, 10)) * 1.2
    xx = np.arange(w)[None, :]; yy = np.arange(h)[:, None]
    folds = (np.sin(xx * 0.55 + 3 * np.sin(yy * 0.05)) * 0.5 + 0.5) * (yy > 105)
    height += folds * 1.4
    gy, gx = np.gradient(height)
    n = np.dstack([-gx, -gy, np.ones_like(height) * 1.4]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    albedo = a[..., :3] / 255.0
    cx = 77
    lights = [((cx, 230, 60), col(th['magic']) / 255, 1.3),        # the ward gem, below and in front
              ((-260, 140, 120), col(th['candle']) / 255, 0.75),    # candles, left
              ((420, 60, 90), col(th['candle']) / 255, 0.55),       # candelabra, right
              ((cx, 80, -90), col(th['magic']) / 255, 1.6),         # the seal behind: rim light
              ((300, -200, -40), np.array([0.55, 0.65, 0.75]), 0.5)]  # moon, behind
    lit = np.zeros((h, w, 3)) + np.array([0.035, 0.035, 0.05])
    px_ = np.dstack([np.broadcast_to(xx, (h, w)), np.broadcast_to(yy, (h, w)), np.zeros((h, w))])
    for p, c, s in lights:
        v = np.array(p, float)[None, None, :] - px_
        dlen = np.linalg.norm(v, axis=2, keepdims=True); v /= dlen
        lam = np.clip((n * v).sum(axis=2, keepdims=True), 0, 1)
        lit += lam * c[None, None, :] * s * (1 / (1 + (dlen / 220) ** 2))
    # the brim shades the face from everything but the uplight
    face = (yy > 62) & (yy < 104) & (np.abs(xx - cx) < 24)
    occl = np.ones((h, w, 1)); occl[face] = np.clip((yy - 62) / 44, 0.12, 0.8)[np.broadcast_to(face, (h, w))][..., None] if False else 1
    fy = np.broadcast_to(np.clip((yy - 66) / 40.0, 0.1, 0.75), (h, w))
    occl[face] = fy[face][:, None]
    tex = 0.85 + 0.3 * fbm2(h, w, 12, 6, 3)[..., None]
    out = albedo * lit * occl * tex * 255 * 2.4
    for ex in (cx - 9, cx + 6):
        out[86, ex:ex + 2] = [120, 100, 110]
    full = np.zeros((H, W, 3)); fa = np.zeros((H, W), bool)
    x0, y0 = pos
    full[y0:y0 + h, x0:x0 + w] = out; fa[y0:y0 + h, x0:x0 + w] = alpha
    return np.clip(full, 0, 255), fa


if __name__ == '__main__':
    prototype().save('/home/claude/art2/v5-ch1.png')
    print(len(LIGHTS), 'lights')
