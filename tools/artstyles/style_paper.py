"""Style D — Cut-Paper Shadow Theatre. Layered paper silhouettes against a night of
pinhole stars; warm lamplight behind the cut-outs; words are paper tags let down on
threads like puppets. Darkness would show as layers going flat and grey."""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from common import *

NIGHT0, NIGHT1, CREAM, BLACK, LAMP = '141a40', '3c4c86', 'efe4c8', '0a0b16', 'ff9a3c'


def layer(img, draw_fn, color, shadow=(6, 8), blur=6, alpha=150):
    """A paper layer: its silhouette, with a soft drop shadow onto what's behind."""
    m = Image.new('L', img.size, 0)
    draw_fn(ImageDraw.Draw(m))
    sh = m.filter(ImageFilter.GaussianBlur(blur * K))
    sh = Image.fromarray((np.asarray(sh, float) * alpha / 255).astype(np.uint8))
    shadow_img = Image.new('RGBA', img.size, (0, 0, 0, 0))
    shadow_img.putalpha(sh)
    img.alpha_composite(shadow_img, (S(shadow[0]), S(shadow[1])))
    fill = Image.new('RGBA', img.size, col(color))
    tex = noise(img.size[0] // 2, img.size[1] // 2, 8, seed=hash(color) % 999, octaves=2)
    tex = np.asarray(Image.fromarray((tex * 255).astype(np.uint8)).resize(img.size), float) / 255
    f = np.asarray(fill, float); f[..., :3] *= (0.92 + 0.12 * tex)[..., None]
    fill = Image.fromarray(f.astype(np.uint8), 'RGBA')
    fill.putalpha(m)
    img.alpha_composite(fill)
    return m


def render():
    img, d = canvas(NIGHT0)
    h, w = H * K, W * K
    yy = np.linspace(0, 1, h)[:, None, None]
    sky = np.array(col(NIGHT0)[:3]) * (1 - yy) + np.array(col(NIGHT1)[:3]) * yy
    sky = np.broadcast_to(sky, (h, w, 3)).copy()
    sky *= (0.94 + 0.1 * noise(w, h, 10 * K, seed=1, octaves=2))[..., None]
    img = Image.fromarray(np.dstack([sky, np.full((h, w), 255)]).astype(np.uint8), 'RGBA')
    d = ImageDraw.Draw(img)
    rng = np.random.default_rng(3)
    # pinhole stars
    for _ in range(140):
        x, y = rng.uniform(FIELD[0], FIELD[1]), rng.uniform(10, 420)
        r = rng.choice([1, 1, 1.5, 2])
        d.ellipse(S((x - r, y - r, x + r, y + r)), fill=col('fff6d8'))
    add_light(img, lambda m: [m.ellipse(S((x - 2, y - 2, x + 2, y + 2)), fill=200) for x, y in rng.uniform([FIELD[0], 10], [FIELD[1], 420], (40, 2))], 'fff0c0', 3, 0.8)
    # the moon: cream paper with cut craters
    add_light(img, lambda m: m.ellipse(S((850, 40, 990, 180)), fill=255), 'fff0c0', 40, 0.35)
    layer(img, lambda m: (m.ellipse(S((870, 60, 970, 160)), fill=255), m.ellipse(S((900, 86, 916, 102)), fill=0), m.ellipse(S((930, 116, 944, 130)), fill=0)), CREAM, (4, 5), 4, 120)

    # far hills, then the castle, each a paper layer
    layer(img, lambda m: m.polygon(S([(FIELD[0], WARD_Y), (FIELD[0], 400), (260, 372), (400, 410), (560, 380), (720, 414), (900, 376), (FIELD[1], 404), (FIELD[1], WARD_Y)]), fill=255), '2c376a', (5, 6), 5, 110)
    def castle(m):
        for x, w_, h_ in ((220, 50, 190), (290, 34, 130), (690, 64, 230), (770, 38, 160), (960, 46, 200), (520, 30, 110)):
            m.polygon(S([(x, WARD_Y), (x, WARD_Y - h_ * 0.72), (x + w_ / 2, WARD_Y - h_), (x + w_, WARD_Y - h_ * 0.72), (x + w_, WARD_Y)]), fill=255)
            for wy in range(int(WARD_Y - h_ * 0.6), WARD_Y - 20, 34):
                m.rectangle(S((x + w_ / 2 - 4, wy, x + w_ / 2 + 4, wy + 12)), fill=0)
        m.rectangle(S((FIELD[0], WARD_Y - 46, FIELD[1], WARD_Y)), fill=255)
    cm = layer(img, castle, '1a2050', (6, 7), 6, 130)
    # lit windows show through the cut holes
    d = ImageDraw.Draw(img)

    # the ward line: a scalloped paper border with a glowing thread
    add_light(img, lambda m: m.rectangle(S((FIELD[0], WARD_Y - 2, FIELD[1], WARD_Y + 2)), fill=255), 'e070c8', 7, 1.0)

    # foreground frame: arch, shelves, floor; pure black cut-outs with scalloped edges
    def frame(m):
        m.rectangle(S((0, 0, FIELD[0], H)), fill=255); m.rectangle(S((FIELD[1], 0, W, H)), fill=255)
        m.rectangle(S((0, WARD_Y + 2, W, H)), fill=255)
        r = (FIELD[1] - FIELD[0]) / 2
        m.rectangle(S((FIELD[0], 0, FIELD[1], 40)), fill=255)
        for x in range(FIELD[0], FIELD[1], 34):
            m.ellipse(S((x, 26, x + 34, 56)), fill=255)
        for y in range(40, WARD_Y, 34):
            m.ellipse(S((FIELD[0] - 14, y, FIELD[0] + 14, y + 34)), fill=255); m.ellipse(S((FIELD[1] - 14, y, FIELD[1] + 14, y + 34)), fill=255)
        # book spines cut out of the shelf (light shows through the gaps)
        for shelf in range(7):
            y1 = 70 + shelf * 68
            x = 10
            while x < 130:
                bw = int(rng.integers(8, 15)); bh = int(rng.integers(36, 56))
                m.rectangle(S((x, y1 - bh, x + 2, y1)), fill=0)
                x += bw
            m.rectangle(S((8, y1 - 60, 140, y1 - 58)), fill=0)
    # lamplight behind the frame (seen through cuts)
    add_light(img, lambda m: m.ellipse(S((-120, 220, 300, 720)), fill=255), LAMP, 60, 0.9)
    layer(img, frame, BLACK, (0, 0), 1, 0)
    # the study wall below the window, lit by the lamp and the seal: the silhouettes stand against it
    add_light(img, lambda m: m.ellipse(S((-60, 380, 520, 760)), fill=255), LAMP, 70, 0.95)
    add_light(img, lambda m: m.ellipse(S((420, 500, 800, 700)), fill=255), 'c050c0', 50, 0.55)
    add_light(img, lambda m: m.ellipse(S((240, 460, 400, 620)), fill=255), 'ffd080', 30, 0.8)
    def wizard(m):
        m.polygon(S(BODY), fill=255); m.polygon(S(ARM), fill=255); m.ellipse(S(HAND), fill=255)
        m.polygon(S([(98, 470), (206, 470), (170, 376), (204, 330), (150, 360)]), fill=255)   # a tall hat with a crooked tip
        m.ellipse(S((86, 456, 222, 482)), fill=255)
        m.polygon(S([(150, 478), (206, 482), (210, 520), (180, 560), (152, 520)]), fill=255)  # beard
        for sx, sy in ((90, 560), (120, 600), (70, 620), (150, 590), (110, 530)):
            m.polygon(S([(sx, sy - 7), (sx + 2, sy - 2), (sx + 7, sy), (sx + 2, sy + 2), (sx, sy + 7), (sx - 2, sy + 2), (sx - 7, sy), (sx - 2, sy - 2)]), fill=0)
        m.ellipse(S((150, 400, 168, 418)), fill=0); m.ellipse(S((156, 400, 172, 416)), fill=255)   # crescent on the hat
        m.ellipse(S((190, 490, 196, 496)), fill=0)   # an eye
        # the lamp
        m.rectangle(S((304, 520, 336, 588)), fill=255); m.polygon(S([(298, 520), (320, 498), (342, 520)]), fill=255)
        m.rectangle(S((310, 532, 330, 576)), fill=0)
        # typewriter, from behind
        m.rounded_rectangle(S((440, 560, 760, 640)), radius=S(16), fill=255)
        m.rectangle(S((452, 536, 748, 560)), fill=255)
    layer(img, wizard, BLACK, (0, 0), 1, 0)
    d = ImageDraw.Draw(img)
    for row in range(2):
        for i in range(13):
            cx = 466 + i * 21 + row * 10; cy = 590 + row * 22
            d.ellipse(S((cx - 6, cy - 6, cx + 6, cy + 6)), outline=col('3a3020'), width=S(2))

    f_word = font('schola', 23); f_ui = font('schola', 16)

    def tag(box, fill, ink='1a1830', thread=True, shadow=True):
        x0, y0, x1, y1 = box
        if thread:
            d.line(S([((x0 + x1) / 2, 0), ((x0 + x1) / 2, y0)]), fill=col('c8b890', 200), width=S(1.2))
        pts = [(x0 + 8, y0), (x1 - 8, y0), (x1, y0 + 8), (x1, y1 - 8), (x1 - 8, y1), (x0 + 8, y1), (x0, y1 - 8), (x0, y0 + 8)]
        if shadow:
            layer(img, lambda m: m.polygon(S(pts), fill=255), fill, (4, 6), 4, 140)
        else:
            d.polygon(S(pts), fill=col(fill))
        d.ellipse(S(((x0 + x1) / 2 - 3, y0 + 3, (x0 + x1) / 2 + 3, y0 + 9)), fill=col(ink))   # the hole the thread goes through

    # paper roll, counter, combo
    tag(ROLL, CREAM, thread=False)
    d = ImageDraw.Draw(img)
    for i in range(22):
        x = ROLL[0] + 14 + i * 10.6
        d.rectangle(S((x, ROLL[1] + 14, x + 7, ROLL[1] + 19)), fill=col('2a2850' if i < PROGRESS * 22 else 'cfc4a8'))
    d.text(S((ROLL[0] + 18, ROLL[1] + 42)), TYPED + '_', font=f_word, fill=col('b0307a'), anchor='lm')
    tag(COUNTER, '1e2246', thread=False); d = ImageDraw.Draw(img)
    text_center(d, ((COUNTER[0] + COUNTER[2]) / 2, (COUNTER[1] + COUNTER[3]) / 2), '004210', font('schola', 26), col(CREAM))
    tag(COMBO, 'b0307a', thread=False); d = ImageDraw.Draw(img)
    text_center(d, ((COMBO[0] + COMBO[2]) / 2, (COMBO[1] + COMBO[3]) / 2), COMBO_TEXT, f_ui, col(CREAM))
    # rack: paper charms hanging in the dark cabinet
    text_center(d, (1185, 92), 'SPELLS', font('schola', 24), col(CREAM))
    for i, (name, n, c) in enumerate(SPELLS):
        y = 136 + i * 114
        d.line(S([(1150, 110), (1150, y)]), fill=col('8a7a5a'), width=S(1))
        tag((1106, y, 1262, y + 92), c if n else '3a3a50', thread=False)
        d = ImageDraw.Draw(img)
        d.text(S((1184, y + 36)), name, font=f_ui, fill=col('1a1426' if n else '8a8aa0'), anchor='mm')
        d.text(S((1184, y + 64)), f'×{n}', font=font('schola', 22), fill=col('1a1426' if n else '8a8aa0'), anchor='mm')

    # words: paper tags let down on threads
    for k, (t, x, y, kind) in enumerate(WORDS):
        wdt = text_w(f_word, t) + 34
        box = (x - wdt / 2, y - 18, x + wdt / 2, y + 20)
        if kind == 'sigil':
            add_light(img, lambda m: m.rectangle(S(box), fill=255), 'ffcf50', 18, 0.9)
            d = ImageDraw.Draw(img)
            tag(box, 'f2c24a'); d = ImageDraw.Draw(img)
            d.text(S((x, y + 2)), t, font=f_word, fill=col('3a1a00'), anchor='mm')
        elif kind.startswith('spell'):
            tag(box, 'e8642c'); d = ImageDraw.Draw(img)
            d.text(S((x, y + 2)), t, font=f_word, fill=col('fff0e0'), anchor='mm')
        elif kind == 'target':
            add_light(img, lambda m: m.rectangle(S(box), fill=255), 'e050c0', 12, 0.6)
            d = ImageDraw.Draw(img)
            tag(box, CREAM); d = ImageDraw.Draw(img)
            tw = text_w(f_word, t); lx = x - tw / 2
            d.text(S((lx, y + 2)), TYPED, font=f_word, fill=col('c0308a'), anchor='lm')
            d.text(S((lx + text_w(f_word, TYPED), y + 2)), t[len(TYPED):], font=f_word, fill=col('1a1830'), anchor='lm')
        else:
            tag(box, CREAM); d = ImageDraw.Draw(img)
            d.text(S((x, y + 2)), t, font=f_word, fill=col('1a1830'), anchor='mm')

    # status: four paper strips
    for (a, b), s in zip(STATUS_PANELS, STATUS):
        tag((a, STATUS_Y[0], b, STATUS_Y[1]), '262a50', thread=False); d = ImageDraw.Draw(img)
        text_center(d, ((a + b) / 2, STATUS_Y[0] + 19), s, f_ui, col(CREAM))
    for (a, b), v, c in ((STATUS_PANELS[1], PROGRESS, 'f2c24a'), (STATUS_PANELS[3], WARD, 'e070c8')):
        d.rectangle(S((a + 24, STATUS_Y[0] + 36, a + 24 + (b - a - 48) * v, STATUS_Y[0] + 43)), fill=col(c))
    return finish(img)


if __name__ == '__main__':
    render().save('/home/claude/artstyles/style-D-paper.png')
