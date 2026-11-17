"""Small pixel-art toolkit: dithered gradients, noise ridges, masks, glows, sprite shading."""
import numpy as np
from PIL import Image, ImageDraw

W, H = 640, 360
_B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16 + 1 / 32


def bayer(h, w):
    return np.tile(_B4, (h // 4 + 1, w // 4 + 1))[:h, :w]


BAY = bayer(H, W)


def hx(s):
    s = s.lstrip('#')
    return np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], float)


def mix(a, b, t):
    return hx(a) * (1 - t) + hx(b) * t if isinstance(a, str) else a * (1 - t) + b * t


def col(c):
    return hx(c) if isinstance(c, str) else np.asarray(c, float)


class Canvas:
    def __init__(self, w=W, h=H, fill='000000'):
        self.w, self.h = w, h
        self.a = np.zeros((h, w, 3), float) + col(fill)
        self.bay = bayer(h, w)

    # ── masks ──
    def mask(self):
        return Image.new('L', (self.w, self.h), 0)

    def poly(self, pts):
        m = self.mask(); ImageDraw.Draw(m).polygon([tuple(map(float, p)) for p in pts], fill=255)
        return np.asarray(m) > 0

    def ellipse(self, box):
        m = self.mask(); ImageDraw.Draw(m).ellipse(box, fill=255)
        return np.asarray(m) > 0

    def rect(self, x0, y0, x1, y1):
        x0, y0, x1, y1 = (int(round(v)) for v in (x0, y0, x1, y1))
        m = np.zeros((self.h, self.w), bool); m[max(0, y0):max(0, y1), max(0, x0):max(0, x1)] = True
        return m

    def lines(self, pts, width=1):
        m = self.mask(); ImageDraw.Draw(m).line([tuple(map(float, p)) for p in pts], fill=255, width=width)
        return np.asarray(m) > 0

    # ── painting ──
    def fill(self, m, c):
        self.a[m] = col(c)

    def dfill(self, alpha, c):
        """Dithered transparency: alpha is a float array (or scalar with a mask)."""
        hit = alpha > self.bay
        self.a[hit] = col(c)

    def grad(self, y0, y1, cols, x0=0, x1=None, m=None):
        x1 = self.w if x1 is None else x1
        pal = np.array([col(c) for c in cols])
        ys = np.arange(y0, y1)[:, None].astype(float)
        t = np.broadcast_to((ys - y0) / max(1, y1 - y0 - 1) * (len(cols) - 1), (y1 - y0, x1 - x0))
        i = np.floor(t).astype(int); f = t - i
        i2 = np.where(f > self.bay[y0:y1, x0:x1], np.minimum(i + 1, len(cols) - 1), i)
        region = pal[i2]
        if m is None:
            self.a[y0:y1, x0:x1] = region
        else:
            sub = m[y0:y1, x0:x1]; tgt = self.a[y0:y1, x0:x1]; tgt[sub] = region[sub]

    def glow(self, cx, cy, r, c, strength=0.6, power=2.0, m=None, ry=None):
        ry = r if ry is None else ry
        yy, xx = np.mgrid[0:self.h, 0:self.w]
        d = np.sqrt(((xx - cx) / r) ** 2 + ((yy - cy) / ry) ** 2)
        al = strength * np.clip(1 - d, 0, 1) ** power
        if m is not None: al = al * m
        # glow tints toward the colour rather than replacing it
        hit = al > self.bay
        self.a[hit] = self.a[hit] * 0.45 + col(c) * 0.55

    def shade(self, m, factor, c=None):
        if c is None:
            self.a[m] = self.a[m] * factor
        else:
            self.a[m] = self.a[m] * (1 - factor) + col(c) * factor

    def img(self):
        return Image.fromarray(np.clip(self.a, 0, 255).astype(np.uint8))


def noise1d(n, seed, feature=60, octaves=4, rough=0.5):
    rng = np.random.default_rng(seed)
    out = np.zeros(n); amp = 1.0; tot = 0.0; f = float(feature)
    for _ in range(octaves):
        pts = rng.random(int(n / f) + 3)
        xs = np.arange(n) / f; i = xs.astype(int); t = xs - i; t = t * t * (3 - 2 * t)
        out += amp * (pts[i] * (1 - t) + pts[i + 1] * t); tot += amp; amp *= rough; f = max(2.0, f / 2)
    return out / tot


def ridge(c, seed, base, amp, color, rim=None, feature=60, rough=0.5, x0=0, x1=None, sharp=False):
    x1 = c.w if x1 is None else x1
    n = noise1d(x1 - x0, seed, feature, 5, rough)
    if sharp: n = 1 - np.abs(n * 2 - 1)
    top = (base - amp * n).astype(int)
    yy = np.arange(c.h)[:, None]
    m = np.zeros((c.h, c.w), bool); m[:, x0:x1] = yy >= top[None, :]
    c.fill(m, color)
    if rim is not None:
        r = np.zeros_like(m); r[:, x0:x1] = (yy >= top[None, :]) & (yy < top[None, :] + 1)
        c.fill(r, rim)
    return top


def pine(draw, x, base, h, w=None):
    w = w or max(3, h // 3)
    tiers = max(2, h // 6)
    for k in range(tiers):
        ty = base - h + k * h / tiers
        bw = w * (0.45 + 0.55 * (k + 1) / tiers)
        draw.polygon([(x, ty), (x - bw, ty + h / tiers * 1.6), (x + bw, ty + h / tiers * 1.6)], fill=255)
    draw.rectangle([x - 1, base - 2, x + 1, base + 2], fill=255)


def stars(c, rng, n, y1, cols, x0=0, x1=None):
    x1 = c.w if x1 is None else x1
    for _ in range(n):
        x = rng.integers(x0, x1); y = rng.integers(0, y1)
        k = cols[rng.integers(len(cols))]
        c.a[y, x] = col(k)
        if rng.random() < 0.08 and 0 < x < c.w - 1 and 0 < y < c.h - 1:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                c.a[y + dy, x + dx] = c.a[y + dy, x + dx] * 0.4 + col(k) * 0.6


def quantize(im, n=48):
    return im.quantize(colors=n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')


# ── sprite layer (RGBA) with material shading ──
class Sprite:
    """Draw flat material regions, then shade() adds rim light (upper-left), shadow (lower-right) and outline."""

    def __init__(self, w, h, k=1.0):
        self.k = k
        w, h = int(round(w * k)), int(round(h * k))
        self.w, self.h = w, h
        self.id = np.zeros((h, w), int)  # material index, 0 = empty
        self.mats = [None]
        self.order = []

    def material(self, ramp):
        """ramp: [dark, shadow, base, light, highlight] hex."""
        self.mats.append([col(c) for c in ramp]); return len(self.mats) - 1

    def _m(self):
        return Image.new('L', (self.w, self.h), 0)

    def poly(self, mat, pts):
        k = self.k
        m = self._m(); ImageDraw.Draw(m).polygon([(float(p[0]) * k, float(p[1]) * k) for p in pts], fill=255); self.id[np.asarray(m) > 0] = mat

    def ellipse(self, mat, box):
        k = self.k
        m = self._m(); ImageDraw.Draw(m).ellipse([v * k for v in box], fill=255); self.id[np.asarray(m) > 0] = mat

    def rect(self, mat, x0, y0, x1, y1):
        k = self.k
        self.id[int(round(y0 * k)):int(round(y1 * k)), int(round(x0 * k)):int(round(x1 * k))] = mat

    def line(self, mat, pts, width=1):
        k = self.k
        m = self._m(); ImageDraw.Draw(m).line([(float(p[0]) * k, float(p[1]) * k) for p in pts], fill=255, width=max(1, int(round(width * k)))); self.id[np.asarray(m) > 0] = mat

    def px(self, mat, x, y):
        if 0 <= x < self.w and 0 <= y < self.h: self.id[y, x] = mat

    def render(self, light=(-1, -1), flat=(), glow=(), outline=True):
        h, w = self.h, self.w
        out = np.zeros((h, w, 4), float)
        bay = bayer(h, w)
        def sh(a, dx, dy):
            r = np.zeros_like(a)
            ys = slice(max(0, dy), h + min(0, dy)); yd = slice(max(0, -dy), h + min(0, -dy))
            xs = slice(max(0, dx), w + min(0, dx)); xd = slice(max(0, -dx), w + min(0, -dx))
            r[ys, xs] = a[yd, xd]; return r
        lx, ly = light
        for mi in range(1, len(self.mats)):
            m = self.id == mi
            if not m.any(): continue
            ramp = self.mats[mi]
            tone = np.full((h, w), 2.0)
            if mi not in flat and mi not in glow:
                # distance-ish from lit edge using shifted masks
                lit1 = m & ~sh(m, -lx, -ly)
                lit2 = m & ~sh(m, -2 * lx, -2 * ly) & ~lit1
                dark1 = m & ~sh(m, lx, ly)
                dark2 = m & ~sh(m, 2 * lx, 2 * ly) & ~dark1
                dark3 = m & ~sh(m, 4 * lx, 4 * ly) & ~dark1 & ~dark2
                tone[lit2] = np.where(bay[lit2] > 0.5, 3, 2)
                tone[lit1] = 3
                tone[dark3] = np.where(bay[dark3] > 0.5, 1, 2)
                tone[dark2] = 1
                tone[dark1] = 1
            if mi in glow:
                tone[:] = 3
            t = tone.astype(int)
            pal = np.array(ramp)
            out[m, :3] = pal[t[m]]
            out[m, 3] = 255
        filled = self.id > 0
        if not outline:
            return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')
        # selective outline: darkest ramp tone of the neighbour material, or ink at the silhouette
        edge = filled & (~sh(filled, 1, 0) | ~sh(filled, -1, 0) | ~sh(filled, 0, 1) | ~sh(filled, 0, -1))
        for mi in range(1, len(self.mats)):
            e = edge & (self.id == mi)
            out[e, :3] = self.mats[mi][0]
        # internal borders between materials: darker of the two on the shadow side
        for dx, dy in ((1, 0), (0, 1)):
            nb = sh(self.id, -dx, -dy)
            b = filled & (nb > 0) & (nb != self.id)
            for mi in range(1, len(self.mats)):
                e = b & (self.id == mi)
                if mi in glow: continue
                out[e, :3] = self.mats[mi][1]
        return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')


def paste(base: Image.Image, spr: Image.Image, x, y, scale=1):
    if scale != 1: spr = spr.resize((spr.width * scale, spr.height * scale), Image.NEAREST)
    base.alpha_composite(spr, (int(x), int(y))) if base.mode == 'RGBA' else base.paste(spr, (int(x), int(y)), spr)


def grade(im, sat=0.74, bright=0.88, gamma=1.10, tint=(0.96, 0.97, 1.06), grit=0.07, vignette=0.55, seed=1):
    """Darker, grittier: desaturate, crush toward cold shadows, add 1-px grime and a vignette."""
    rgba = im.mode == 'RGBA'
    a = np.asarray(im.convert('RGBA')).astype(float)
    rgb = a[..., :3] / 255.0
    lum = (rgb @ np.array([0.299, 0.587, 0.114]))[..., None]
    rgb = lum + (rgb - lum) * sat
    rgb = np.clip(rgb, 0, 1) ** gamma * bright
    rgb = rgb * np.array(tint)
    h, w = rgb.shape[:2]
    rng = np.random.default_rng(seed)
    n = rng.random((h, w))
    rgb[n < grit] *= 0.72                       # grime specks
    rgb[(n > 1 - grit * 0.25)] *= 1.10          # dust glints
    # blotchy stains from low-frequency noise
    lo = rng.random((h // 16 + 2, w // 16 + 2))
    lo = np.kron(lo, np.ones((16, 16)))[:h, :w]
    bay = bayer(h, w)
    rgb[(lo * 0.35) > bay + 0.1] *= 0.86
    if vignette:
        yy, xx = np.mgrid[0:h, 0:w]
        d = np.hypot((xx - w / 2) / (w / 2), (yy - h / 2) / (h / 2))
        v = np.clip((d - 0.55) * vignette * 1.6, 0, 0.8)
        rgb[v > bay] *= 0.62
    a[..., :3] = np.clip(rgb * 255, 0, 255)
    out = Image.fromarray(a.astype(np.uint8), 'RGBA')
    return out if rgba else out.convert('RGB')


def fbm2(h, w, seed, scale=64, octaves=5, rough=0.55):
    """2D fractal value noise in 0..1 (bicubic-upsampled random grids)."""
    rng = np.random.default_rng(seed); out = np.zeros((h, w)); amp = 1.0; tot = 0.0; s = float(scale)
    for _ in range(octaves):
        gh, gw = max(2, int(h / s) + 2), max(2, int(w / s) + 2)
        g = Image.fromarray((rng.random((gh, gw)) * 255).astype(np.uint8))
        up = np.asarray(g.resize((int(gw * s), int(gh * s)), Image.BICUBIC), float)[:h, :w] / 255.0
        out += amp * up; tot += amp; amp *= rough; s = max(1.0, s / 2)
    return out / tot
