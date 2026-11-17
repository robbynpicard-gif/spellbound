"""Style B — Illuminated Manuscript. The game is a page of a grimoire: vellum, gold
leaf, lapis and vermilion, flat tempera colour with black outlines, the wizard as a
marginal figure, words as rubricated banderoles."""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from common import *

VELLUM, GOLD, GOLD_HI, LAPIS, VERM, VERD, INK = 'eadcb8', 'c8962a', 'f6d878', '23408e', 'c43a26', '3a7a4a', '1c1410'


def gold_band(d, box, width=10):
    x0, y0, x1, y1 = box
    d.rectangle(S(box), outline=col(INK), width=S(width + 4))
    d.rectangle(S((x0 + 2, y0 + 2, x1 - 2, y1 - 2)), outline=col(GOLD), width=S(width))
    d.rectangle(S((x0 + 4, y0 + 4, x1 - 4, y1 - 4)), outline=col(GOLD_HI), width=S(2))


def banderole(d, x, y, w, fill, line=INK):
    """A medieval speech-scroll: a band with curled ends."""
    h = 34
    x0, x1 = x - w / 2, x + w / 2
    d.polygon(S([(x0 - 14, y - h / 2 + 6), (x0, y - h / 2), (x0, y + h / 2), (x0 - 14, y + h / 2 + 6), (x0 - 6, y + 3)]), fill=col('b8a478'), outline=col(line))
    d.polygon(S([(x1 + 14, y - h / 2 + 6), (x1, y - h / 2), (x1, y + h / 2), (x1 + 14, y + h / 2 + 6), (x1 + 6, y + 3)]), fill=col('b8a478'), outline=col(line))
    d.rectangle(S((x0, y - h / 2, x1, y + h / 2)), fill=col(fill), outline=col(line), width=S(2))


def diaper(img, box, c1, c2, step=26):
    """A gold-on-colour diaper pattern (small quatrefoils), as in miniature backgrounds."""
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = box
    d.rectangle(S(box), fill=col(c1))
    for j, y in enumerate(range(int(y0), int(y1), step)):
        for x in range(int(x0) + (step // 2 if j % 2 else 0), int(x1), step):
            r = 3
            for dx, dy in ((0, -r), (r, 0), (0, r), (-r, 0)):
                d.ellipse(S((x + dx - 2, y + dy - 2, x + dx + 2, y + dy + 2)), fill=col(c2))
            d.ellipse(S((x - 1, y - 1, x + 1, y + 1)), fill=col(GOLD_HI))


def render():
    img, d = canvas(VELLUM)
    # vellum: warm, uneven, with foxing
    n = noise(W * K, H * K, 90 * K, seed=2, octaves=5)
    a = np.asarray(img, float)
    a[..., :3] *= (0.9 + 0.12 * n)[..., None]
    fox = noise(W * K, H * K, 14 * K, seed=4, octaves=2) > 0.78
    a[fox, :3] *= 0.92
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA'); d = ImageDraw.Draw(img)
    f_word = font('chorus', 30); f_ui = font('termes', 17); f_cap = font('pagella', 54); f_small = font('termes', 15)

    # ── the miniature: the night sky behind the falling words ──
    mini = (FIELD[0], 14, FIELD[1], WARD_Y)
    diaper(img, mini, LAPIS, GOLD)
    d = ImageDraw.Draw(img)
    # stylised hills and a tower, flat colours with black outline
    d.polygon(S([(FIELD[0], WARD_Y), (FIELD[0], 430), (300, 400), (470, 440), (640, 410), (820, 446), (FIELD[1], 404), (FIELD[1], WARD_Y)]), fill=col(VERD), outline=col(INK))
    for x, h_ in ((250, 120), (880, 160)):
        d.rectangle(S((x, WARD_Y - h_, x + 50, WARD_Y)), fill=col('d8c8a8'), outline=col(INK), width=S(2))
        d.polygon(S([(x - 8, WARD_Y - h_), (x + 25, WARD_Y - h_ - 46), (x + 58, WARD_Y - h_)]), fill=col(VERM), outline=col(INK))
        for wy in range(int(WARD_Y - h_ + 16), WARD_Y - 12, 30):
            d.rectangle(S((x + 19, wy, x + 31, wy + 14)), fill=col(INK))
    # a gold-leaf moon with a face (marginalia humour)
    d.ellipse(S((900, 36, 990, 126)), fill=col(GOLD), outline=col(INK), width=S(2))
    d.ellipse(S((906, 42, 984, 120)), outline=col(GOLD_HI), width=S(2))
    d.arc(S((928, 70, 944, 80)), 0, 180, fill=col(INK), width=S(2)); d.arc(S((952, 70, 968, 80)), 0, 180, fill=col(INK), width=S(2))
    d.arc(S((936, 86, 962, 104)), 20, 160, fill=col(INK), width=S(2))
    gold_band(d, mini, 10)
    # the ward line: a vermilion and gold border band with a running pattern
    d.rectangle(S((FIELD[0], WARD_Y - 6, FIELD[1], WARD_Y + 6)), fill=col(VERM), outline=col(INK))
    for x in range(FIELD[0] + 10, FIELD[1] - 10, 22):
        d.polygon(S([(x, WARD_Y), (x + 6, WARD_Y - 4), (x + 12, WARD_Y), (x + 6, WARD_Y + 4)]), fill=col(GOLD_HI))

    # ── left margin: a column of interlace and the wizard as a marginal figure ──
    d.rectangle(S((14, 14, 136, WARD_Y)), fill=col(VERM), outline=col(INK), width=S(3))
    for i in range(10):
        cy = 40 + i * 47
        d.ellipse(S((40, cy - 18, 110, cy + 18)), outline=col(GOLD), width=S(5))
        d.ellipse(S((40, cy - 18, 110, cy + 18)), outline=col(INK), width=S(1))
        d.ellipse(S((62, cy - 6, 88, cy + 6)), fill=col(LAPIS), outline=col(INK))
    # the wizard: flat lapis robe, gold-trimmed, a tall pointed hat (very much a marginal doodle)
    d.polygon(S(BODY), fill=col(LAPIS), outline=col(INK))
    d.line(S([(130, 500), (128, 646)]), fill=col(GOLD), width=S(6))
    d.polygon(S([(108, 440), (196, 440), (152, 330), (176, 300), (142, 318)]), fill=col(VERM), outline=col(INK))   # the hat, with a droop
    d.ellipse(S((96, 430, 208, 452)), fill=col(VERM), outline=col(INK))
    d.ellipse(S((140, 446, 196, 506)), fill=col('f0d0b0'), outline=col(INK), width=S(2))   # face
    d.polygon(S([(146, 482), (190, 482), (184, 540), (168, 560), (152, 540)]), fill=col('f4f0e8'), outline=col(INK))   # beard
    d.ellipse(S((172, 466, 178, 472)), fill=col(INK)); d.ellipse(S((184, 466, 190, 472)), fill=col(INK))
    d.polygon(S(ARM), fill=col(LAPIS), outline=col(INK))
    d.ellipse(S(HAND), fill=col('f0d0b0'), outline=col(INK))
    for fold in FOLDS: d.line(S(fold), fill=col('162a66'), width=S(3))

    # ── the writing desk and the typewriter (an illuminated contraption) ──
    d.rectangle(S((150, 590, 1080, 640)), fill=col('a0743c'), outline=col(INK), width=S(2))
    d.rectangle(S((440, 556, 760, 630)), fill=col(GOLD), outline=col(INK), width=S(3))
    for row in range(2):
        for i in range(13):
            cx = 462 + i * 21 + row * 10; cy = 584 + row * 22
            d.ellipse(S((cx - 7, cy - 7, cx + 7, cy + 7)), fill=col(VELLUM), outline=col(INK))
    d.rectangle(S(ROLL), fill=col('f4ead0'), outline=col(INK), width=S(2))
    for i in range(22):
        x = ROLL[0] + 14 + i * 10.6
        d.rectangle(S((x, ROLL[1] + 8, x + 7, ROLL[1] + 14)), fill=col(VERM if i < PROGRESS * 22 else 'd8c8a8'))
    d.text(S((ROLL[0] + 18, ROLL[1] + 40)), TYPED + '|', font=f_word, fill=col(VERM), anchor='lm')

    # ── score in a framed cartouche, combo in a vermilion roundel ──
    gold_band(d, COUNTER, 4)
    d.rectangle(S((COUNTER[0] + 6, COUNTER[1] + 6, COUNTER[2] - 6, COUNTER[3] - 6)), fill=col(VELLUM))
    text_center(d, ((COUNTER[0] + COUNTER[2]) / 2, (COUNTER[1] + COUNTER[3]) / 2), '4,210', font('pagella', 28), col(INK))
    d.ellipse(S((COMBO[0] + 20, COMBO[1] - 4, COMBO[2] - 20, COMBO[3] + 4)), fill=col(VERM), outline=col(INK), width=S(2))
    text_center(d, ((COMBO[0] + COMBO[2]) / 2, (COMBO[1] + COMBO[3]) / 2), COMBO_TEXT, f_ui, col(GOLD_HI))

    # ── the spell rack as illuminated initials ──
    d.text(S((1185, 90)), 'Spells', font=font('chorus', 40), fill=col(VERM), anchor='mm')
    for i, (name, n, c) in enumerate(SPELLS):
        y = 130 + i * 116
        box = (1106, y, 1196, y + 90)
        d.rectangle(S(box), fill=col(c if n else 'a89878'), outline=col(INK), width=S(3))
        d.rectangle(S((box[0] + 6, box[1] + 6, box[2] - 6, box[3] - 6)), outline=col(GOLD), width=S(4))
        text_center(d, ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2 + 2), name[0], f_cap, col(GOLD_HI if n else 'd8c8a8'))
        d.text(S((1204, y + 30)), name, font=f_ui, fill=col(INK), anchor='lm')
        d.text(S((1204, y + 58)), f'×{n}', font=font('pagella', 22), fill=col(VERM if n else '8a7a60'), anchor='lm')

    # ── falling words: rubricated banderoles ──
    for k, (t, x, y, kind) in enumerate(WORDS):
        w = text_w(f_word, t) + 26
        if kind == 'sigil':
            glow(img, lambda m: m.rectangle(S((x - w / 2 - 20, y - 22, x + w / 2 + 20, y + 22)), fill=255), 'ffd860', 14, 1.0)
            d = ImageDraw.Draw(img)
            banderole(d, x, y, w + 18, GOLD)
            d.polygon(S([(x - w / 2 - 2, y), (x - w / 2 + 6, y - 9), (x - w / 2 + 14, y), (x - w / 2 + 6, y + 9)]), fill=col(VERM), outline=col(INK))
            d.text(S((x + 8, y + 2)), t, font=f_word, fill=col(INK), anchor='mm')
        elif kind.startswith('spell'):
            banderole(d, x, y, w + 30, 'e8a080')
            box = (x - w / 2 - 12, y - 15, x - w / 2 + 16, y + 15)
            d.rectangle(S(box), fill=col(VERM), outline=col(INK)); text_center(d, ((box[0] + box[2]) / 2, y + 1), 'F', font('pagella', 22), col(GOLD_HI))
            d.text(S((x + 12, y + 2)), t, font=f_word, fill=col(INK), anchor='mm')
        elif kind == 'target':
            banderole(d, x, y, w, 'f4ead0', VERM)
            tw = text_w(f_word, t); lx = x - tw / 2
            d.text(S((lx, y + 2)), TYPED, font=f_word, fill=col(VERM), anchor='lm')
            d.text(S((lx + text_w(f_word, TYPED), y + 2)), t[len(TYPED):], font=f_word, fill=col(INK), anchor='lm')
        else:
            banderole(d, x, y, w, 'f4ead0')
            d.text(S((x, y + 2)), t, font=f_word, fill=col(INK), anchor='mm')

    # ── footer: ruled text like a colophon ──
    d.line(S([(30, STATUS_Y[0] - 4), (W - 30, STATUS_Y[0] - 4)]), fill=col(VERM), width=S(2))
    for (a, b), s in zip(STATUS_PANELS, STATUS):
        text_center(d, ((a + b) / 2, STATUS_Y[0] + 18), s.title() if not s.startswith('LEVEL') else s.title(), f_ui, col(INK))
    for (a, b), v, c in ((STATUS_PANELS[1], PROGRESS, GOLD), (STATUS_PANELS[3], WARD, VERM)):
        d.rectangle(S((a + 30, STATUS_Y[0] + 34, b - 30, STATUS_Y[0] + 42)), outline=col(INK), width=S(1))
        d.rectangle(S((a + 31, STATUS_Y[0] + 35, a + 30 + (b - a - 60) * v, STATUS_Y[0] + 41)), fill=col(c))
    for x in (366, 676, 978):
        d.text(S((x, STATUS_Y[0] + 22)), '❦', font=font('termes', 18), fill=col(VERM), anchor='mm')
    # page edge darkening
    a = np.asarray(img, float)
    yy, xx = np.mgrid[0:H * K, 0:W * K]
    edge = np.clip(1.15 - 0.35 * np.maximum(np.abs(xx / (W * K) - 0.5), np.abs(yy / (H * K) - 0.5)) ** 1.5 * 4, 0.7, 1)
    a[..., :3] *= edge[..., None]
    return finish(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA'))


if __name__ == '__main__':
    render().save('/home/claude/artstyles/style-B-manuscript.png')
