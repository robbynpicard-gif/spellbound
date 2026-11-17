"""Style C — Stained Glass. The whole study is a leaded window lit from behind:
jewel-toned panes, black lead lines, light blooming through. The darkness would
show as panes going dark and cracking."""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.spatial import cKDTree
from common import *

LEAD = '0e0c12'

# region id → base colour
REGIONS = {
    0: '1c2032',   # wall: grey-blue
    1: '1a3a8a',   # sky: deep blue
    2: 'f0e0a0',   # moon
    3: '7a2a8a',   # spires: violet
    4: '7a30b8',   # robe
    5: '5a2898',   # hood
    6: 'e8a040',   # face glow
    7: 'f0c040',   # halo
    8: '8a4a1a',   # desk
    9: 'b07a2a',   # typewriter
    10: '2a6a4a',  # bookshelf green
    11: '8a1a2a',  # bookshelf red
    12: '1a1a2a',  # rack
    13: 'c83a2a',  # ward band
    14: '3a7ab0',  # sky light (near moon)
}


def label_map():
    m = Image.new('L', (W * K, H * K), 0)
    d = ImageDraw.Draw(m)
    d.rectangle(S((FIELD[0], 0, FIELD[1], WARD_Y)), fill=1)
    d.ellipse(S((760, -60, 1100, 280)), fill=14)
    d.ellipse(S((870, 50, 970, 150)), fill=2)
    for x, w_, h_ in ((220, 50, 170), (300, 34, 120), (700, 62, 210), (780, 36, 150), (980, 44, 190)):
        d.polygon(S([(x, WARD_Y), (x, WARD_Y - h_ * 0.7), (x + w_ / 2, WARD_Y - h_), (x + w_, WARD_Y - h_ * 0.7), (x + w_, WARD_Y)]), fill=3)
    d.rectangle(S((FIELD[0], WARD_Y - 6, FIELD[1], WARD_Y + 6)), fill=13)
    for i in range(7):
        y = 20 + i * 70
        d.rectangle(S((0, y, 140, y + 62)), fill=10 if i % 2 else 11)
    d.rectangle(S((1086, 0, W, WARD_Y + 120)), fill=12)
    d.rectangle(S((150, 590, 1086, 650)), fill=8)
    d.rounded_rectangle(S((440, 556, 760, 636)), radius=S(10), fill=9)
    d.ellipse(S((96, 360, 236, 500)), fill=7)   # halo behind the head
    d.polygon(S(BODY), fill=4); d.polygon(S(ARM), fill=4)
    d.polygon(S(HOOD), fill=5); d.polygon(S(FACE), fill=6)
    return np.asarray(m)


def render():
    lab = label_map()
    h, w = lab.shape
    rng = np.random.default_rng(7)
    # Voronoi panes: denser around the wizard and the moon
    pts = []
    step = 34 * K
    for y in range(-step, h + step, step):
        for x in range(-step, w + step, step):
            pts.append((x + rng.uniform(-0.45, 0.45) * step, y + rng.uniform(-0.45, 0.45) * step))
    for _ in range(140):
        pts.append((rng.uniform(40, 460) * K, rng.uniform(380, 660) * K))
    pts = np.array(pts)
    yy, xx = np.mgrid[0:h, 0:w]
    _, cell = cKDTree(pts).query(np.stack([xx.ravel(), yy.ravel()], 1), workers=-1)
    cell = cell.reshape(h, w)
    pane = cell * 32 + lab.astype(np.int64)   # a pane = one cell within one region

    # colour per pane
    base = np.zeros((h, w, 3))
    for r, c in REGIONS.items():
        base[lab == r] = col(c)[:3]
    uniq, inv = np.unique(pane, return_inverse=True)
    bright = rng.uniform(0.72, 1.18, len(uniq))[inv].reshape(h, w)
    hue = rng.uniform(-14, 14, (len(uniq), 3))[inv].reshape(h, w, 3)
    glass = base * bright[..., None] + hue
    # light coming through from the moon and from the seal under the typewriter
    light = 0.55 + 0.75 * np.exp(-(((xx / K - 920) / 420) ** 2 + ((yy / K - 100) / 300) ** 2))
    light += 0.35 * np.exp(-(((xx / K - 600) / 260) ** 2 + ((yy / K - 520) / 120) ** 2))
    streak = noise(w, h, 6 * K, seed=3, octaves=2)
    glass *= (light * (0.9 + 0.2 * streak))[..., None]
    # lead lines where panes meet
    edge = np.zeros((h, w), bool)
    edge[:, 1:] |= pane[:, 1:] != pane[:, :-1]
    edge[1:, :] |= pane[1:, :] != pane[:-1, :]
    lead = Image.fromarray((edge * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))
    leadm = np.asarray(lead, float)[..., None] / 255
    out = glass * (1 - leadm) + np.array(col(LEAD)[:3]) * leadm
    # bloom
    bright_mask = np.clip((out.mean(axis=2) - 150) / 100, 0, 1)
    bloom = np.asarray(Image.fromarray((out * bright_mask[..., None]).clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(14 * K)), float)
    out = np.clip(out + bloom * 0.55, 0, 255)
    img = Image.fromarray(np.dstack([out, np.full((h, w), 255)]).astype(np.uint8), 'RGBA')
    d = ImageDraw.Draw(img)

    f_word = font('lora', 23); f_ui = font('lora', 16)

    def plaque(box, fill, outline=LEAD, width=5):
        d.rounded_rectangle(S(box), radius=S(10), fill=col(fill), outline=col(outline), width=S(width))
        x0, y0, x1, y1 = box
        d.line(S([(x0 + 8, y0 + 5), (x1 - 8, y0 + 5)]), fill=(255, 255, 255, 90), width=S(2))

    # typewriter keys as round jewels
    for row in range(2):
        for i in range(13):
            cx = 466 + i * 21 + row * 10; cy = 586 + row * 22
            d.ellipse(S((cx - 7, cy - 7, cx + 7, cy + 7)), fill=col('f0d080'), outline=col(LEAD), width=S(2))
    # eyes
    d.ellipse(S((182, 470, 188, 476)), fill=col('fff4d0')); d.ellipse(S((194, 471, 199, 476)), fill=col('fff4d0'))
    # roll, counter, combo
    plaque(ROLL, 'f4e8c8')
    for i in range(22):
        x = ROLL[0] + 14 + i * 10.6
        d.rectangle(S((x, ROLL[1] + 9, x + 7, ROLL[1] + 15)), fill=col('c8962a' if i < PROGRESS * 22 else 'd8ccb0'))
    d.text(S((ROLL[0] + 18, ROLL[1] + 40)), TYPED + '_', font=f_word, fill=col('8a1a6a'), anchor='lm')
    plaque(COUNTER, '1a1a2a', 'c8962a', 3)
    text_center(d, ((COUNTER[0] + COUNTER[2]) / 2, (COUNTER[1] + COUNTER[3]) / 2), '004210', font('lora', 26), col('f0d080'))
    plaque(COMBO, '6a1a6a', LEAD, 3)
    text_center(d, ((COMBO[0] + COMBO[2]) / 2, (COMBO[1] + COMBO[3]) / 2), COMBO_TEXT, f_ui, col('ffd8f0'))
    # rack: roundels of coloured glass
    text_center(d, (1185, 92), 'SPELLS', font('lora', 26), col('f0d080'))
    for i, (name, n, c) in enumerate(SPELLS):
        y = 130 + i * 116
        plaque((1104, y, 1264, y + 96), '24243a', 'c8962a' if n else '3a3a4a', 3)
        cc = col(c) if n else col('3a3a48')
        d.ellipse(S((1116, y + 16, 1180, y + 80)), fill=cc, outline=col(LEAD), width=S(4))
        add_light(img, lambda m, y=y: m.ellipse(S((1124, y + 24, 1172, y + 72)), fill=255), c, 10, 0.5 if n else 0)
        d = ImageDraw.Draw(img)
        d.text(S((1190, y + 34)), name, font=f_ui, fill=col('e8e0f0'), anchor='lm')
        d.text(S((1190, y + 62)), f'×{n}', font=font('lora', 20), fill=col('f0d080' if n else '6a6a7a'), anchor='lm')

    # words: pale glass plaques, lead framed
    for k, (t, x, y, kind) in enumerate(WORDS):
        wdt = text_w(f_word, t) + 34
        box = (x - wdt / 2, y - 19, x + wdt / 2, y + 19)
        if kind == 'sigil':
            add_light(img, lambda m: m.rounded_rectangle(S(box), radius=S(10), fill=255), 'ffc040', 18, 0.9)
            d = ImageDraw.Draw(img)
            plaque(box, 'ffd860')
            d.text(S((x, y)), t, font=f_word, fill=col('3a1a00'), anchor='mm')
        elif kind.startswith('spell'):
            plaque(box, 'e8642c')
            d.text(S((x, y)), t, font=f_word, fill=col('fff0e0'), anchor='mm')
        elif kind == 'target':
            add_light(img, lambda m: m.rounded_rectangle(S(box), radius=S(10), fill=255), 'e040c0', 14, 0.6)
            d = ImageDraw.Draw(img)
            plaque(box, 'f4ecd8', 'c02a9a', 5)
            tw = text_w(f_word, t); lx = x - tw / 2
            d.text(S((lx, y)), TYPED, font=f_word, fill=col('b0207a'), anchor='lm')
            d.text(S((lx + text_w(f_word, TYPED), y)), t[len(TYPED):], font=f_word, fill=col('1a1420'), anchor='lm')
        else:
            plaque(box, 'ece4d0')
            d.text(S((x, y)), t, font=f_word, fill=col('1a1420'), anchor='mm')

    # status: a lead-framed strip of dark glass
    d.rectangle(S((0, STATUS_Y[0] - 8, W, H)), fill=col('14121c'))
    for (a, b), s in zip(STATUS_PANELS, STATUS):
        plaque((a, STATUS_Y[0], b, STATUS_Y[1]), '24223a', '8a6a2a', 3)
        text_center(d, ((a + b) / 2, STATUS_Y[0] + 19), s, f_ui, col('e8e0f0'))
    for (a, b), v, c in ((STATUS_PANELS[1], PROGRESS, 'f0c040'), (STATUS_PANELS[3], WARD, 'c83a8a')):
        d.rectangle(S((a + 24, STATUS_Y[0] + 36, a + 24 + (b - a - 48) * v, STATUS_Y[0] + 43)), fill=col(c))
    return finish(img)


if __name__ == '__main__':
    render().save('/home/claude/artstyles/style-C-glass.png')
