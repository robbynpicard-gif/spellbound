"""Style A — Ink & Wash Gothic. Heavy pooled blacks, hard-edged light, a few muted
colours (bone, ochre, oxblood, verdigris), cross-hatching in the shadows."""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from common import *

BONE, OCHRE, OX, TEAL, INK = 'd8c8a4', 'a07a3c', '7a2620', '3e6a64', '0c0a09'


def hatch_layer(size, spacing, angle, width, color=INK):
    w, h = size
    img = Image.new('RGBA', size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    dx = math.cos(math.radians(angle)); dy = math.sin(math.radians(angle))
    L = w + h
    for k in range(-L, L, spacing):
        x0, y0 = k, 0
        d.line([(x0 - dx * L, y0 - dy * L), (x0 + dx * L, y0 + dy * L)], fill=col(color), width=width)
    return img


def apply_hatching(img, dark=120, dark2=85):
    """Cross-hatch the shading: one direction below `dark`, two below `dark2` (not the pure blacks)."""
    a = np.asarray(img.convert('L'), float)
    rng = noise(img.size[0] // 4, img.size[1] // 4, 40, seed=5)
    rng = np.asarray(Image.fromarray((rng * 255).astype(np.uint8)).resize(img.size), float) / 255
    for thr, ang, sp in ((dark, 35, 9 * K // 2), (dark2, -35, 7 * K // 2)):
        m = ((a < thr + rng * 25) & (a > 30)).astype(np.uint8) * 255
        hat = hatch_layer(img.size, sp, ang, max(1, K // 2))
        mask = Image.fromarray(m).filter(ImageFilter.GaussianBlur(1))
        hat.putalpha(Image.fromarray((np.asarray(hat.split()[3], float) * np.asarray(mask, float) / 255 * 0.55).astype(np.uint8)))
        img.alpha_composite(hat)


def torn(d, box, fill, outline, seed, width=3):
    """A torn paper slip: jagged rectangle with a thick ink outline."""
    x0, y0, x1, y1 = box
    rng = np.random.default_rng(seed)
    pts = []
    n = max(6, int((x1 - x0) / 14))
    for i in range(n + 1):
        pts.append((x0 + (x1 - x0) * i / n, y0 + rng.uniform(-2, 2.5)))
    for i in range(1, 4):
        pts.append((x1 + rng.uniform(-2, 3), y0 + (y1 - y0) * i / 4))
    for i in range(n, -1, -1):
        pts.append((x0 + (x1 - x0) * i / n, y1 + rng.uniform(-3, 2)))
    for i in range(3, 0, -1):
        pts.append((x0 + rng.uniform(-3, 2), y0 + (y1 - y0) * i / 4))
    pts = [S(p) for p in pts]
    d.polygon(pts, fill=col(fill))
    d.line(pts + [pts[0]], fill=col(outline), width=S(width), joint='curve')


def render():
    img, d = canvas('0e0c0a')
    f_word = font('pagella', 25); f_ui = font('bonum', 17); f_big = font('pagella', 30)

    # ── the window: a bone-and-ochre wash sky with hard-edged ink clouds ──
    sky = np.zeros((H * K, W * K, 4), np.uint8)
    yy = np.linspace(0, 1, H * K)[:, None]
    base = np.array(col('b8a47c')[:3]) * (1 - yy[..., None] * 0.55) + np.array(col('5a4a34')[:3]) * yy[..., None] * 0.55
    n = noise(W * K // 4, H * K, 120 * K, seed=3, octaves=5)
    n = np.asarray(Image.fromarray((n * 255).astype(np.uint8)).resize((W * K, H * K), Image.BICUBIC), float) / 255
    n2 = noise(W * K, H * K, 40 * K, seed=8, octaves=4)
    clouds = np.clip(((n * 0.8 + n2 * 0.3) - 0.5) * 6, 0, 1)
    clouds = np.where(clouds > 0.5, 1.0, clouds * 0.35)
    wash = base * (1 - clouds[..., None] * 0.8) + np.array(col(INK)[:3]) * clouds[..., None] * 0.8
    wash *= (0.85 + 0.25 * noise(W * K, H * K, 30 * K, seed=9, octaves=3))[..., None]
    sky[..., :3] = np.clip(wash, 0, 255); sky[..., 3] = 255
    sky_img = Image.fromarray(sky, 'RGBA')
    m = Image.new('L', img.size, 0); md = ImageDraw.Draw(m)
    win = (FIELD[0] + 20, -40, FIELD[1] - 20, WARD_Y)
    r = (win[2] - win[0]) / 2
    md.rectangle(S((win[0], 150, win[2], WARD_Y)), fill=255)
    md.ellipse(S((win[0], 150 - r * 0.9, win[2], 150 + r * 0.9)), fill=255)
    img.paste(sky_img, (0, 0), m)
    # moon with a hard ink shadow
    d.ellipse(S((860, 70, 960, 170)), fill=col('efe2c0'))
    d.ellipse(S((880, 62, 984, 166)), fill=col('2a2218', 170))
    # distant spires, flat black
    for x, w_, h_ in ((230, 46, 170), (300, 30, 120), (700, 60, 210), (780, 34, 150), (980, 40, 190), (520, 26, 90)):
        d.polygon(S([(x, WARD_Y), (x, WARD_Y - h_ * 0.7), (x + w_ / 2, WARD_Y - h_), (x + w_, WARD_Y - h_ * 0.7), (x + w_, WARD_Y)]), fill=col(INK))
    d.rectangle(S((FIELD[0], WARD_Y - 40, FIELD[1], WARD_Y)), fill=col(INK))
    # stone frame: the mullion and tracery, heavy black
    d.rectangle(S((604, 160, 622, WARD_Y)), fill=col(INK))
    d.ellipse(S((560, 40, 666, 146)), outline=col(INK), width=S(14))
    md2 = ImageDraw.Draw(img)
    # arch edge
    d.arc(S((win[0], 150 - r * 0.9, win[2], 150 + r * 0.9)), 180, 360, fill=col(INK), width=S(26))
    d.line(S([(win[0], 150), (win[0], WARD_Y)]), fill=col(INK), width=S(26)); d.line(S([(win[2], 150), (win[2], WARD_Y)]), fill=col(INK), width=S(26))
    # hard-edged light on the stone around the window
    for k in range(9):
        y = 180 + k * 36
        d.rectangle(S((FIELD[0] - 4, y, FIELD[0] + 8, y + 26)), fill=col('3a3024'))
        d.rectangle(S((FIELD[1] - 8, y + 12, FIELD[1] + 4, y + 38)), fill=col('3a3024'))

    # ── the ward line: a cracked rune band ──
    d.rectangle(S((FIELD[0], WARD_Y - 4, FIELD[1], WARD_Y + 4)), fill=col(OX))
    add_light(img, lambda m: m.rectangle(S((FIELD[0], WARD_Y - 3, FIELD[1], WARD_Y + 3)), fill=255), 'c84030', 8, 0.9)
    for x in range(FIELD[0] + 30, FIELD[1], 64):
        d.line(S([(x, WARD_Y - 4), (x + 8, WARD_Y + 3), (x + 4, WARD_Y + 9)]), fill=col(INK), width=S(2))

    # ── the room below: desk, walls ──
    d.rectangle(S((0, WARD_Y + 4, W, H)), fill=col('17130f'))
    d.polygon(S([(0, 600), (W, 590), (W, 640), (0, 650)]), fill=col('231a12'))
    d.line(S([(0, 600), (W, 590)]), fill=col(OCHRE), width=S(3))

    # ── bookshelf, left ──
    d.rectangle(S((0, 0, 150, WARD_Y + 120)), fill=col(INK))
    rng = np.random.default_rng(4)
    for shelf in range(7):
        y1 = 70 + shelf * 72
        x = 6
        while x < 140:
            bw = int(rng.integers(8, 16)); bh = int(rng.integers(38, 60))
            c = rng.choice([OX, OCHRE, TEAL, '4a3a2a', BONE])
            d.rectangle(S((x, y1 - bh, x + bw - 2, y1)), fill=col(c))
            d.rectangle(S((x + bw - 5, y1 - bh, x + bw - 2, y1)), fill=col(INK))   # hard shadow side
            x += bw
        d.rectangle(S((0, y1, 150, y1 + 6)), fill=col('2a2016'))

    # ── typewriter, seen from behind: keys face away ──
    tx0, tx1 = 440, 760
    d.rounded_rectangle(S((tx0, 560, tx1, 640)), radius=S(14), fill=col(INK))
    d.line(S([(tx0 + 10, 562), (tx1 - 10, 562)]), fill=col(OCHRE), width=S(3))
    for row in range(2):
        for i in range(14):
            cx = tx0 + 30 + i * 19 + row * 9; cy = 600 + row * 18
            d.ellipse(S((cx - 6, cy - 6, cx + 6, cy + 6)), fill=col('2a241c'))
            d.arc(S((cx - 6, cy - 6, cx + 6, cy + 6)), 200, 330, fill=col(BONE), width=S(2))
    # the paper roll
    torn(d, ROLL, 'e6d8b4', INK, 7, 4)
    for i in range(22):
        x = ROLL[0] + 14 + i * 10.6
        d.rectangle(S((x, ROLL[1] + 10, x + 7, ROLL[1] + 18)), fill=col(INK if i < PROGRESS * 22 else 'b8a888'))
    d.text(S((ROLL[0] + 16, ROLL[1] + 44)), TYPED + '_', font=f_word, fill=col(OX), anchor='lm')

    # ── score counter and combo ──
    d.rectangle(S(COUNTER), fill=col(INK)); d.rectangle(S(COUNTER), outline=col(OCHRE), width=S(3))
    for i, ch in enumerate(SCORE):
        x = COUNTER[0] + 12 + i * 19
        d.rectangle(S((x, COUNTER[1] + 6, x + 15, COUNTER[3] - 6)), fill=col('e6d8b4'))
        text_center(d, (x + 7.5, (COUNTER[1] + COUNTER[3]) / 2), ch, font('pagella', 24), col(INK))
    d.rectangle(S(COMBO), fill=col(INK)); d.rectangle(S(COMBO), outline=col(OX), width=S(3))
    text_center(d, ((COMBO[0] + COMBO[2]) / 2, (COMBO[1] + COMBO[3]) / 2), COMBO_TEXT, f_ui, col('e8b050'))

    # ── the wizard: a hooded silhouette, hard rim light from the window and a candle ──
    d.polygon(S(BODY), fill=col(INK)); d.polygon(S(HOOD), fill=col(INK)); d.polygon(S(ARM), fill=col(INK))
    d.line(S([HOOD[3], HOOD[4], HOOD[5], HOOD[6], HOOD[7]]), fill=col(BONE), width=S(4))
    d.line(S([BODY[1], BODY[2], BODY[3]]), fill=col(OCHRE), width=S(4))
    d.line(S([ARM[0], ARM[1], ARM[2], ARM[3]]), fill=col(BONE), width=S(3))
    for fold in FOLDS: d.line(S(fold), fill=col('6a5434'), width=S(3))
    d.polygon(S(FACE), fill=col('040303'))
    d.ellipse(S((182, 470, 188, 476)), fill=col('f0c860')); d.ellipse(S((194, 471, 199, 476)), fill=col('f0c860'))
    d.ellipse(S(HAND), fill=col('9a7a52')); d.arc(S(HAND), 200, 360, fill=col(BONE), width=S(2))
    # a candle on the desk, its warm hard light
    d.rectangle(S((300, 548, 314, 592)), fill=col(BONE)); d.ellipse(S((302, 532, 312, 548)), fill=col('ffd070'))
    add_light(img, lambda m: m.ellipse(S((250, 480, 366, 600)), fill=255), 'a06020', 30, 0.7)

    # ── spell rack, right ──
    d.rectangle(S((1086, 0, W, WARD_Y + 120)), fill=col(INK))
    text_center(d, (1185, 96), 'SPELLS', f_big, col(BONE))
    for i, (name, n, c) in enumerate(SPELLS):
        y = 140 + i * 112
        torn(d, (1104, y, 1264, y + 92), 'cfc0a0' if n else '6a6050', INK, 30 + i, 3)
        d.ellipse(S((1116, y + 22, 1162, y + 68)), fill=col(c if n else '4a443a'))
        d.ellipse(S((1116, y + 22, 1162, y + 68)), outline=col(INK), width=S(3))
        d.text(S((1176, y + 34)), name, font=f_ui, fill=col(INK), anchor='lm')
        d.text(S((1176, y + 62)), f'×{n}', font=font('pagella', 22), fill=col(OX if n else '4a443a'), anchor='lm')

    # ── falling words: torn slips ──
    for k, (t, x, y, kind) in enumerate(WORDS):
        w = text_w(f_word, t) + 34
        box = (x - w / 2, y - 18, x + w / 2, y + 18)
        if kind == 'sigil':
            glow(img, lambda m: m.rectangle(S(box), fill=255), 'e8b040', 16, 0.9)
            torn(d, box, 'e8b850', INK, k, 4)
            d.polygon(S([(box[0] + 14, y), (box[0] + 20, y - 8), (box[0] + 26, y), (box[0] + 20, y + 8)]), fill=col(OX))
            d.text(S((x + 6, y)), t, font=f_word, fill=col(INK), anchor='mm')
        elif kind.startswith('spell'):
            torn(d, box, 'c8582c', INK, k, 4)
            d.ellipse(S((box[0] + 8, y - 9, box[0] + 26, y + 9)), fill=col('f0c060'))
            d.text(S((x + 8, y)), t, font=f_word, fill=col('f8e8c8'), anchor='mm')
        elif kind == 'target':
            torn(d, box, 'e6d8b4', OX, k, 5)
            tw = text_w(f_word, t); lx = x - tw / 2
            d.text(S((lx, y)), TYPED, font=f_word, fill=col(OX), anchor='lm')
            d.text(S((lx + text_w(f_word, TYPED), y)), t[len(TYPED):], font=f_word, fill=col(INK), anchor='lm')
        else:
            torn(d, box, 'd8c8a4', INK, k, 4)
            d.text(S((x, y)), t, font=f_word, fill=col(INK), anchor='mm')

    # ── status bar ──
    d.rectangle(S((0, STATUS_Y[0] - 6, W, H)), fill=col(INK))
    for (a, b), s in zip(STATUS_PANELS, STATUS):
        d.rectangle(S((a, STATUS_Y[0], b, STATUS_Y[1])), outline=col(OCHRE), width=S(2))
        text_center(d, ((a + b) / 2, STATUS_Y[0] + 20), s, f_ui, col(BONE))
    for (a, b), v, c in ((STATUS_PANELS[1], PROGRESS, OCHRE), (STATUS_PANELS[3], WARD, OX)):
        d.rectangle(S((a + 24, STATUS_Y[0] + 36, b - 24, STATUS_Y[0] + 44)), fill=col('2a221a'))
        d.rectangle(S((a + 24, STATUS_Y[0] + 36, a + 24 + (b - a - 48) * v, STATUS_Y[0] + 44)), fill=col(c))

    apply_hatching(img)
    # paper grain and a heavy vignette
    g = noise(W * K, H * K, 3 * K, seed=11, octaves=2)
    yy, xx = np.mgrid[0:H * K, 0:W * K]
    vig = np.clip(1.25 - np.hypot((xx - W * K / 2) / (W * K * 0.62), (yy - H * K / 2) / (H * K * 0.62)), 0.35, 1)
    a = np.asarray(img, float)
    a[..., :3] *= (0.9 + 0.12 * g)[..., None] * vig[..., None]
    return finish(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA'))


if __name__ == '__main__':
    render().save('/home/claude/artstyles/style-A-ink.png')
