"""More style samples (not wired into the game): inky (Darkest Dungeon-like), watercolour,
gouache storybook, charcoal and pencil, and woodcut, from the same lit tower scene.

    python3 tools/pixelart/v5/concept/styles2.py OUTDIR
"""
import math, os, sys
HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import numpy as np
from PIL import Image, ImageFilter
from px import fbm2
import styles as ST

WW, HH = 1280, 720
yy, xx = np.mgrid[0:HH, 0:WW]


def up(a):
    return np.asarray(Image.fromarray(a.astype(np.uint8)).resize((WW, HH), Image.BICUBIC), float)


def blur(a, r):
    if a.ndim == 2:
        return np.asarray(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), float)
    return np.stack([blur(a[..., k], r) for k in range(3)], -1)


def lum(a):
    return a @ np.array([0.299, 0.587, 0.114])


def edges(L, thr):
    gx = np.abs(np.diff(L, axis=1, prepend=L[:, :1])); gy = np.abs(np.diff(L, axis=0, prepend=L[:1, :]))
    return (gx + gy) > thr


def dilate(m, r=1):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= np.roll(np.roll(m, dy, 0), dx, 1)
    return out


def emissive(big):
    sat = big.max(axis=2) - big.min(axis=2)
    return np.clip((sat - 70) / 110, 0, 1) * np.clip((big.max(axis=2) - 110) / 110, 0, 1)


def paper(seed=2, base=(232, 220, 196), amount=0.1):
    t = fbm2(HH, WW, seed, 50, 5)
    grain = np.random.default_rng(seed).random((HH, WW))
    return np.array(base)[None, None, :] * (1 - amount + amount * 1.6 * t[..., None]) * (0.97 + 0.03 * grain[..., None])


def magic_mask(big):
    """Only magenta and teal light (the magic), not candle flame or skin."""
    r, g, b = big[..., 0], big[..., 1], big[..., 2]
    magenta = (r > 120) & (b > 110) & (g < 0.75 * np.minimum(r, b))
    teal = (g > 110) & (b > 100) & (r < 0.7 * np.minimum(g, b))
    return (magenta | teal).astype(float)


def inky(a):
    """Darkest Dungeon-like: pooling blacks with hard edges, heavy contours, muted flat colour, hatching at the shadow line."""
    big = up(a)
    soft = blur(big, 1.8)
    L = np.clip(lum(soft) / 255 * 3.0, 0, 1)            # the scene is dark: lift hard before thresholding
    lifted = np.clip(soft * 2.6 + 18, 0, 255)
    flat = np.asarray(Image.fromarray(lifted.astype(np.uint8)).quantize(10, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB'), float)
    g = lum(flat)[..., None]
    out = g * np.array([1.0, 0.9, 0.74]) * 0.7 + flat * 0.3          # muted, sepia-leaning
    em = blur(magic_mask(big) * 255, 2)[..., None] / 255
    out = out * (1 - em) + np.array([226, 92, 196]) * em
    ink = np.array([14, 10, 12])
    black = L < 0.26
    u = (xx * 0.7 + yy * 0.7) % 6
    hatch = (L >= 0.26) & (L < 0.42) & (u < 1.8)
    line = dilate(edges(L, 0.11), 2)
    out[black | hatch | line] = ink
    out *= paper(3, (240, 232, 214), 0.12) / 240
    v = np.clip(np.hypot((xx - 640) / 640, (yy - 360) / 360) - 0.6, 0, 1)
    out *= (1 - v * 0.9)[..., None]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def watercolour(a):
    """Transparent washes that bleed, pigment pooling at the edges, a cold-pressed paper and a faint pencil underdrawing."""
    big = up(a)
    L = lum(big) / 255
    wash = blur(big, 5) * 1.7 + 25
    # pigment pools darker at the boundaries of each wash
    b1, b2 = blur(lum(wash), 2), blur(lum(wash), 8)
    pool = np.clip((b2 - b1) / 40, 0, 0.35)[..., None]
    wash = wash * (1 - pool)
    pap = paper(5, (238, 232, 216), 0.14)
    gran = (fbm2(HH, WW, 7, 3, 2) - 0.5)[..., None] * 30
    out = pap * (wash / 255) ** 0.85 + gran * (1 - L[..., None])
    pencil = edges(blur(L * 255, 1.2) / 255, 0.07) & (np.random.default_rng(1).random((HH, WW)) < 0.6)
    out[pencil] = out[pencil] * 0.55 + np.array([60, 50, 50]) * 0.45
    em = emissive(big)[..., None]
    out = out * (1 - em * 0.6) + big * 1.4 * em * 0.6
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def gouache(a):
    """Storybook gouache: opaque flat shapes with soft painted edges, brush texture and a warm brown line."""
    big = up(a)
    soft = blur(big, 3)
    lifted = np.clip(soft * 1.8 + 12, 0, 255)
    flat = np.asarray(Image.fromarray(lifted.astype(np.uint8)).quantize(18, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB'), float)
    flat = blur(flat, 1.4)
    brush = (fbm2(HH, WW, 11, 9, 4) - 0.5)
    streak = np.sin((xx * 0.5 + yy * 0.9) * 0.6 + brush * 8) * 0.05
    out = flat * (1 + streak + brush * 0.12)[..., None]
    line = dilate(edges(lum(flat) / 255, 0.06), 0)
    out[line] = out[line] * 0.45 + np.array([60, 36, 24]) * 0.55
    em = emissive(big)[..., None]
    out = out * (1 - em * 0.5) + big * 1.5 * em * 0.5
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def charcoal(a):
    """Charcoal and white chalk on toned paper, with a touch of coloured pencil on the magic."""
    big = up(a)
    L = np.clip(lum(blur(big, 1.5)) / 255 * 3.0, 0, 1)
    strokes = np.zeros((HH, WW))
    for ang, spacing in ((0.9, 5), (0.35, 6), (-0.6, 7)):
        u = (xx * math.cos(ang) + yy * math.sin(ang) + fbm2(HH, WW, abs(int(ang * 100)) + 50, 20, 3) * 6) % spacing
        strokes += (u < 2.2).astype(float)
    tooth = fbm2(HH, WW, 9, 6, 3)
    dark = np.clip((0.8 - L) * 1.4, 0, 1)
    ink = np.clip(dark * 0.55 + dark * strokes * 0.22 + (dark > 0.7) * 0.3, 0, 1) * (0.8 + 0.4 * tooth)
    base = paper(6, (206, 194, 176), 0.06)
    out = base * (1 - ink[..., None]) + np.array([24, 20, 22]) * ink[..., None]
    chalk = (L > 0.82) & (tooth > 0.45)
    out[chalk] = out[chalk] * 0.4 + np.array([245, 240, 228]) * 0.6
    em = blur(magic_mask(big) * 255, 2)[..., None] / 255
    out = out * (1 - em * 0.7) + np.array([200, 80, 170]) * em * 0.7
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def woodcut(a):
    """Two-block print: carved black lines on cream, with one magenta block for magic."""
    big = up(a)
    L = np.clip(lum(blur(big, 2.5)) / 255 * 2.6, 0, 1)
    u = (yy + np.sin(xx * 0.02) * 6 + fbm2(HH, WW, 3, 40, 3) * 10) % 8
    width = np.clip((0.85 - L) * 9, 0, 7.5)
    black = (u < width) | (L < 0.18) | dilate(edges(L, 0.12), 1)
    out = paper(8, (236, 224, 198), 0.08)
    out[black] = np.array([22, 16, 14])
    em = blur(magic_mask(big) * 255, 3) / 255
    accent = em > 0.2
    out[accent & ~black] = np.array([178, 52, 132])
    out[accent & black] = np.array([96, 20, 70])
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


if __name__ == '__main__':
    outdir = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs(outdir, exist_ok=True)
    a = ST.lit_scene()
    styles = {'inky': inky(a), 'watercolour': watercolour(a), 'gouache': gouache(a), 'charcoal': charcoal(a), 'woodcut': woodcut(a)}
    for k, img in styles.items():
        img.save(os.path.join(outdir, f'style-{k}-art.png'))
        ST.hud(img.copy(), ink_style=k in ('watercolour', 'charcoal', 'woodcut')).save(os.path.join(outdir, f'style-{k}.png'))
    print('ok')
