"""Style samples (not wired into the game): the Apprentice's Tower in the character-left layout,
rendered four ways from the same lit scene: refined pixel art, engraved, painterly and cinematic.

    python3 tools/pixelart/v5/concept/styles.py OUTDIR
"""
import math, os, sys
HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import px
from px import Canvas, fbm2, col, W, H
import interior as I
import realistic as R
import apprentice as A

FIELD_X0 = 175     # art px: the field starts right of the character panel


def lit_scene():
    """The tower with the window centred over the field, the Apprentice and his typewriter at left."""
    rng = np.random.default_rng(1)
    A.WIN_X0, A.WIN_X1 = 236, 456
    I.seal = lambda *a, **k: None            # the seal no longer represents the ward
    R.LIGHTS.clear()
    saved = Canvas.glow; Canvas.glow = R._record
    try:
        c, emis_sky = A.outside(rng)
        win = A.room(c, rng)
        A.desk(c, rng)
        tw = Canvas(fill=np.array([1.0, 2.0, 3.0])); A.typewriter(tw)
    finally:
        Canvas.glow = saved
    R.LIGHTS.append((84, 250, 140, col('f0a050'), 0.5))            # lamp glow around the Apprentice
    R.LIGHTS.append((380, 58, 420, col('8aa0b8'), 0.14))
    L = R.lightmap(win)
    em = R.emissive_mask(c.a, dict(magic=A.MAGIC, candle=A.CANDLE)) & ~win
    lit = R.tone(c.a * R.texture(3) * L)
    base = np.where(em[..., None], c.a * 1.05, lit)
    base[win] = c.a[win] + emis_sky[win] * 0.7
    emis = np.where(em[..., None], c.a, 0) + emis_sky * win[..., None]
    base = np.clip(base + R.blur(emis, 1.5) * 0.6 + R.blur(emis, 6) * 0.45 + R.blur(emis, 18) * 0.3, 0, 255)
    out = Image.fromarray(base.astype(np.uint8)).convert('RGBA')
    # the Apprentice, larger, in the left panel
    A.K = 1.6
    img, ids, mats = A.apprentice()
    pos = (-10, 132)
    lights = [((150, 250, 90), A.CANDLE, 1.4), ((60, 40, 60), A.CANDLE, 0.7), ((84, 330, 60), 'c8a0c0', 0.5),
              ((340, -60, -40), '8aa0b8', 0.8), ((-40, 200, -60), A.MAGIC, 0.8)]
    spr = A.light_sprite(img, ids, mats, pos, lights)
    out.alpha_composite(Image.fromarray(spr, 'RGBA'), pos)
    # his typewriter in front of him (the score counter moves to the top-left HUD)
    fm = (np.abs(tw.a - np.array([1.0, 2.0, 3.0])).sum(axis=2) > 0.5)
    crop = np.zeros((H, W, 4), np.uint8)
    lit_tw = R.tone(tw.a * R.texture(7) * (L * 0 + np.array([0.9, 0.75, 0.62]) * 1.1))
    crop[..., :3] = np.clip(np.where(R.emissive_mask(tw.a, dict(magic=A.MAGIC, candle=A.CANDLE))[..., None], tw.a, lit_tw), 0, 255)
    crop[..., 3] = fm * 255
    t = Image.fromarray(crop, 'RGBA').crop((200, 250, 380, 320))
    out.alpha_composite(t, (-6, 262))
    o = np.asarray(out.convert('RGB')).astype(float)
    # darken the far left wall behind the character so he separates from it
    yy, xx = np.mgrid[0:H, 0:W]
    v = np.clip((FIELD_X0 - xx) / FIELD_X0, 0, 1) * np.clip((yy - 150) / 150, 0, 1) * 0.35
    return np.clip(o * (1 - v[..., None] * 0.6), 0, 255)


# ───────────────────────── four renderings ─────────────────────────
def pixel(a):
    img = px.grade(Image.fromarray(a.astype(np.uint8)), sat=0.9, bright=1.0, gamma=1.0, grit=0.02, vignette=0.4, seed=2)
    return img.resize((1280, 720), Image.NEAREST)


def kuwahara(a, r=4):
    """Painterly smoothing: each pixel takes the mean of its least-varied quadrant."""
    from numpy.lib.stride_tricks import sliding_window_view as sw
    lum = a @ np.array([0.299, 0.587, 0.114])
    pad = r
    P = np.pad(a, ((pad, pad), (pad, pad), (0, 0)), mode='edge'); PL = np.pad(lum, pad, mode='edge')
    h, w = lum.shape
    best = np.full((h, w), np.inf); out = np.zeros_like(a)
    for dy in (0, r):
        for dx in (0, r):
            win = sw(PL, (r + 1, r + 1))[dy:dy + h, dx:dx + w]
            var = win.var(axis=(2, 3))
            m = np.stack([sw(P[..., k], (r + 1, r + 1))[dy:dy + h, dx:dx + w].mean(axis=(2, 3)) for k in range(3)], -1)
            take = var < best
            best[take] = var[take]; out[take] = m[take]
    return out


def painterly(a):
    big = np.asarray(Image.fromarray(a.astype(np.uint8)).resize((1280, 720), Image.BICUBIC), float)
    p = kuwahara(big, 5)
    p = kuwahara(p, 3)
    # brush grain along a gentle diagonal, and a canvas weave
    yy, xx = np.mgrid[0:720, 0:1280]
    brush = fbm2(720, 1280, 5, 18, 4)
    streak = np.sin((xx * 0.7 + yy * 0.35) * 0.35 + brush * 6) * 0.04
    weave = ((xx % 3 == 0) | (yy % 3 == 0)) * -0.015
    p = p * (1 + streak + weave)[..., None]
    img = Image.fromarray(np.clip(p, 0, 255).astype(np.uint8))
    return px.grade(img, sat=0.88, bright=1.02, gamma=1.0, grit=0.0, vignette=0.45, seed=4)


def cinematic(a):
    big = np.asarray(Image.fromarray(a.astype(np.uint8)).resize((1280, 720), Image.BICUBIC), float)
    yy, xx = np.mgrid[0:720, 0:1280]
    # god rays from the window, a cool haze and warm practical light
    ang = (xx - 760) * 0.25 + yy * 0.35
    rays = (np.sin(ang * 0.05) * 0.5 + 0.5) ** 6 * np.clip((yy - 40) / 500, 0, 1) * np.clip(1 - np.abs(xx - 740) / 420, 0, 1)
    big = big + rays[..., None] * np.array([70, 90, 110]) * 0.5
    haze = np.clip(1 - yy / 720, 0, 1) * 0.12
    big = big * (1 - haze[..., None]) + np.array([40, 52, 66]) * haze[..., None]
    soft = np.asarray(Image.fromarray(np.clip(big, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)), float)
    bright = np.clip(soft - 150, 0, 255)
    bloom = np.asarray(Image.fromarray(bright.astype(np.uint8)).filter(ImageFilter.GaussianBlur(14)), float)
    out = soft + bloom * 0.8
    # teal shadows, warm highlights (a film grade), grain
    lum = out.mean(axis=2, keepdims=True) / 255
    out = out + (1 - lum) * np.array([-4, 6, 10]) + lum * np.array([12, 4, -8])
    out += (np.random.default_rng(3).random((720, 1280, 1)) - 0.5) * 10
    img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    return px.grade(img, sat=0.8, bright=1.0, gamma=1.05, grit=0.0, vignette=0.6, seed=4)


def engraved(a):
    """Ink cross-hatching on aged paper, with restrained colour only where there is magic or flame."""
    big = np.asarray(Image.fromarray(a.astype(np.uint8)).resize((1280, 720), Image.BICUBIC), float)
    lum = (big @ np.array([0.299, 0.587, 0.114])) / 255
    lum = np.clip(lum * 1.9, 0, 1) ** 0.8                            # lift: hatching reads darker than it is
    yy0, xx0 = np.mgrid[0:720, 0:1280]
    field = (xx0 > 350) & (xx0 < 1076) & (yy0 < 600)
    lum[field] = np.clip(lum[field] * 1.35 + 0.12, 0, 1)                  # keep the field behind the words light
    yy, xx = np.mgrid[0:720, 0:1280]
    wob = fbm2(720, 1280, 9, 30, 3) * 2
    def hatch(angle, spacing, width):
        u = (xx * math.cos(angle) + yy * math.sin(angle) + wob) % spacing
        return u < width
    ink = np.zeros((720, 1280), bool)
    ink |= hatch(0.78, 6, 1.3) & (lum < 0.62)
    ink |= hatch(-0.78, 6, 1.2) & (lum < 0.42)
    ink |= hatch(0.0, 5, 1.1) & (lum < 0.24)
    ink |= (lum < 0.08)
    gx = np.abs(np.diff(lum, axis=1, prepend=lum[:, :1])); gy = np.abs(np.diff(lum, axis=0, prepend=lum[:1, :]))
    ink |= (gx + gy) > 0.16
    paper = np.array([226, 210, 176]) * (0.9 + 0.12 * fbm2(720, 1280, 2, 60, 4))[..., None]
    paper *= (1 - 0.25 * np.clip(np.hypot((xx - 640) / 640, (yy - 360) / 360) - 0.6, 0, 1))[..., None]   # foxed edges
    out = paper.copy()
    out[ink] = np.array([38, 26, 20])
    # colour wash only on magic and fire
    sat = big.max(axis=2) - big.min(axis=2)
    wash = np.clip((sat - 70) / 120, 0, 1) * np.clip((big.max(axis=2) - 90) / 120, 0, 1)
    wash = np.asarray(Image.fromarray((wash * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3)), float)[..., None] / 255
    out = out * (1 - wash * 0.7) + big * 1.2 * wash * 0.7
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


# ───────────────────────── stand-in HUD for the new layout ─────────────────────────
def hud(im, ink_style=False):
    d = ImageDraw.Draw(im)
    F = A.F
    brass, dark, parch, txt = (176, 134, 62), (24, 16, 12), (230, 214, 180), (34, 24, 15)
    if ink_style: brass, dark = (70, 50, 36), (226, 210, 176)
    # top-left: score counter, combo, ward integrity
    d.rectangle([18, 18, 322, 74], fill=brass); d.rectangle([24, 24, 316, 68], fill=dark)
    for i, ch in enumerate('0012400'):
        d.rectangle([30 + i * 40, 28, 64 + i * 40, 64], fill=(232, 220, 192)); d.text((38 + i * 40, 32), ch, font=F(26), fill=txt)
    d.rectangle([18, 82, 200, 112], fill=brass); d.rectangle([22, 86, 196, 108], fill=dark); d.text((34, 86), 'COMBO ×7', font=F(17), fill=(226, 92, 196))
    d.rectangle([18, 120, 322, 150], fill=brass); d.rectangle([22, 124, 318, 146], fill=dark)
    d.rectangle([26, 128, 26 + int(220 * 0.82), 142], fill=(150, 70, 140)); d.text((256, 125), '82%', font=F(16), fill=parch)
    d.text((24, 152), 'WARD', font=F(12), fill=parch if not ink_style else (60, 40, 30))
    # words in the centre field
    words = [(420, 40, 'potion', None), (650, 92, 'griffin', None), (880, 58, 'moonlit', None), (400, 220, 'quill', None),
             (700, 250, 'fire', (210, 105, 46)), (900, 190, 'lantern', None), (520, 360, 'hollow', None), (800, 410, 'riddle', None),
             (420, 480, 'tome', None), (640, 520, 'ember', None)]
    for x, y, w, sp in words:
        tw = int(d.textlength(w, font=F(22))) + 28; body = (230, 214, 180) if not sp else sp
        d.rectangle([x - 2, y - 2, x + tw + 2, y + 42], fill=(20, 14, 10)); d.rectangle([x, y, x + tw, y + 40], fill=body)
        d.rectangle([x, y + 34, x + tw, y + 40], fill=tuple(int(v * .72) for v in body))
        d.text((x + 14, y + 6), w, font=F(22), fill=txt)
    # typing on the typewriter's paper
    d.rectangle([60, 536, 300, 576], fill=parch); d.line([70, 566, 290, 566], fill=(160, 140, 110), width=2)
    d.text((150, 540), 'ridd', font=F(20), fill=(168, 52, 140))
    # bottom: the advancing parchment progress roll
    d.rectangle([360, 664, 1070, 706], fill=parch); d.ellipse([348, 660, 372, 710], fill=(200, 184, 150)); d.ellipse([1058, 660, 1082, 710], fill=(200, 184, 150))
    for i in range(18): d.rectangle([386 + i * 34, 676, 410 + i * 34, 694], fill=(230, 160, 60) if i < 12 else (150, 130, 100))
    d.text((715, 645), '12 / 18', font=F(14), fill=parch if not ink_style else (60, 40, 30), anchor='mm')
    # right: the spell rack
    d.text((1150, 86), 'SPELLS', font=F(20), fill=parch if not ink_style else (60, 40, 30))
    for i, (n, c, k) in enumerate((('SLOW', 'b4409c', 2), ('ICE', '3aa49a', 1), ('BARRIER', '9aa4b8', 2), ('FIRE', 'd2692e', 1), ('WIND', '6a9a5a', 1))):
        y = 130 + i * 96; cc = tuple(int(c[j:j + 2], 16) for j in (0, 2, 4))
        d.rounded_rectangle([1104, y, 1268, y + 86], 8, fill=cc); d.text((1180, y + 48), n, font=F(16), fill=(240, 230, 210), anchor='mm'); d.text((1240, y + 20), f'×{k}', font=F(18), fill=(240, 230, 210), anchor='mm')
    return im


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs(out, exist_ok=True)
    a = lit_scene()
    styles = {'1-pixel': pixel(a), '2-engraved': engraved(a), '3-painterly': painterly(a), '4-cinematic': cinematic(a)}
    for k, img in styles.items():
        img.save(os.path.join(out, f'style-{k}-art.png'))
        hud(img.copy(), ink_style=(k == '2-engraved')).save(os.path.join(out, f'style-{k}.png'))
    m = Image.new('RGB', (1280 * 2 + 20, 720 * 2 + 20), (10, 9, 12))
    for i, k in enumerate(styles):
        m.paste(Image.open(os.path.join(out, f'style-{k}.png')), ((i % 2) * 1300, (i // 2) * 740))
    m.resize((m.width // 2, m.height // 2), Image.LANCZOS).save(os.path.join(out, 'styles-compare.png'))
    print('ok')
