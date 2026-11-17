"""Shared scene for the art-style samples: the real game layout (src/render/layout.ts,
1280x720) and one moment of play, so every style shows the same game.

Each style draws at 2x (2560x1440) and is downsampled for clean edges.
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1280, 720
K = 2  # supersampling

FONTS = '/usr/share/texmf/fonts/opentype/public/tex-gyre/'
def font(name, size):
    paths = {
        'pagella': FONTS + 'texgyrepagella-bold.otf',
        'bonum': FONTS + 'texgyrebonum-bold.otf',
        'schola': FONTS + 'texgyreschola-bold.otf',
        'chorus': FONTS + 'texgyrechorus-mediumitalic.otf',
        'termes': FONTS + 'texgyretermes-bold.otf',
        'lora': '/usr/share/fonts/truetype/google-fonts/Lora-Variable.ttf',
        'poppins': '/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf',
        'poppinsm': '/usr/share/fonts/truetype/google-fonts/Poppins-Medium.ttf',
    }
    f = ImageFont.truetype(paths[name], int(size * K))
    if name == 'lora':
        try: f.set_variation_by_name('Bold')
        except Exception: pass
    return f

# ── layout (screen px) ──
FIELD = (150, 1076)          # where words fall
SPAWN_Y, WARD_Y = 20, 506
WIZARD = (36, 388, 228, 644)  # wizard box
ROLL = (472, 512, 728, 572)   # typewriter paper roll
COUNTER = (772, 528, 900, 572)
COMBO = (772, 580, 900, 616)
RACK = (1098, 126, 1272, 610)
STATUS_Y = (654, 710)
STATUS_PANELS = [(40, 356), (376, 664), (688, 966), (990, 1250)]

# ── one moment of play ──
# (text, x centre, y centre, kind) — kind: word | target | spell:<id> | sigil
WORDS = [
    ('quill', 560, 64, 'word'),
    ('rune', 980, 104, 'word'),
    ('lantern', 330, 136, 'word'),
    ('obsidian', 800, 206, 'spell:fire'),
    ('moth', 440, 288, 'sigil'),
    ('cauldron', 690, 370, 'target'),
    ('wyrm', 252, 420, 'word'),
    ('ember', 930, 452, 'word'),
]
TYPED = 'caul'
SCORE, COMBO_TEXT = '004210', '×3 · 14'
SPELLS = [('Fire', 2, 'e8642c'), ('Slow', 1, 'b4409c'), ('Ice', 0, '6ac8e8'), ('Barrier', 1, '8ad0b0')]
STATUS = ['LEVEL 3 · THE GLASSWORKS', '14 / 22 WORDS', 'SCORE 4,210 · COMBO 14', 'WARD 72%']
PROGRESS, WARD = 14 / 22, 0.72


def S(v):
    """Screen px → canvas px."""
    if isinstance(v, list):
        return [S(x) for x in v]
    if isinstance(v, tuple):
        return tuple(S(x) for x in v)
    return int(round(v * K))


def col(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def canvas(color='000000'):
    img = Image.new('RGBA', (W * K, H * K), col(color))
    return img, ImageDraw.Draw(img)


def finish(img):
    return img.resize((W, H), Image.LANCZOS).convert('RGB')


def noise(w, h, scale, seed=0, octaves=4):
    """Smooth value noise in [0, 1], shape (h, w)."""
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w))
    amp, total = 1.0, 0.0
    for o in range(octaves):
        s = max(1, int(scale / (2 ** o)))
        gh, gw = h // s + 2, w // s + 2
        g = rng.random((gh, gw))
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((gw * s, gh * s), Image.BICUBIC)
        out += np.asarray(im, float)[:h, :w] / 255 * amp
        total += amp
        amp *= 0.5
    return out / total


def overlay(img, layer):
    img.alpha_composite(layer)
    return img


def text_center(d, xy, s, f, fill, **kw):
    d.text(S(xy), s, font=f, fill=fill, anchor='mm', **kw)


def text_w(f, s):
    b = f.getbbox(s)
    return (b[2] - b[0]) / K


def glow(img, mask_draw_fn, color, radius, strength=1.0):
    """Adds a soft glow: draws shapes into a mask, blurs it, tints and adds it."""
    m = Image.new('L', img.size, 0)
    mask_draw_fn(ImageDraw.Draw(m))
    m = m.filter(ImageFilter.GaussianBlur(radius * K))
    a = np.asarray(m, float) / 255 * strength
    layer = np.zeros((img.size[1], img.size[0], 4), np.uint8)
    c = col(color)
    layer[..., 0], layer[..., 1], layer[..., 2] = c[0], c[1], c[2]
    layer[..., 3] = np.clip(a * 255, 0, 255).astype(np.uint8)
    img.alpha_composite(Image.fromarray(layer, 'RGBA'))


def add_light(img, mask_fn, color, radius, strength=1.0):
    """Additive light (screen-like)."""
    m = Image.new('L', img.size, 0)
    mask_fn(ImageDraw.Draw(m))
    m = m.filter(ImageFilter.GaussianBlur(radius * K))
    a = np.asarray(m, float)[..., None] / 255 * strength
    base = np.asarray(img, float)
    c = np.array(col(color)[:3], float)
    base[..., :3] = np.clip(base[..., :3] + a * c, 0, 255)
    img.paste(Image.fromarray(base.astype(np.uint8), 'RGBA'))

# ── the wizard, seated at lower left, turned toward the typewriter (shared shapes) ──
HOOD = [(96, 470), (104, 430), (126, 402), (150, 390), (178, 398), (198, 424), (208, 456), (206, 490), (198, 512), (186, 522), (150, 522), (120, 512)]
FACE = [(170, 444), (199, 452), (205, 480), (197, 506), (177, 508), (165, 478)]
BODY = [(90, 480), (186, 500), (216, 560), (234, 646), (36, 646), (56, 560), (78, 512)]
ARM = [(174, 520), (230, 548), (330, 582), (432, 596), (436, 616), (326, 614), (220, 592), (168, 562)]
HAND = (424, 590, 452, 618)
FOLDS = [[(120, 540), (104, 600), (100, 646)], [(160, 548), (170, 600), (176, 646)], [(196, 580), (214, 646)]]
