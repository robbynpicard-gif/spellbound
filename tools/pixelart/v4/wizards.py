"""Six original wizards, each with a portrait (front) and an in-game pose (three-quarter, typing to the right).
96x128 sprites, shaded by px.Sprite. Two looks (A/B) per wizard."""
import numpy as np
from PIL import Image
from px import Sprite

SKIN = ['22160f', '6a4636', '9a7058', 'b88c6e', 'cca084']
INKS = ['0b0a10', '0b0a10', '0b0a10', '0b0a10', '0b0a10']


def R(base, hi=None):
    """5-tone ramp from one base hex (dark, shadow, base, light, highlight)."""
    b = np.array([int(base[i:i + 2], 16) for i in (0, 2, 4)], float)
    b = b * 0.62 + b.mean() * 0.38          # worn, muted cloth
    h = b if hi is None else np.array([int(hi[i:i + 2], 16) for i in (0, 2, 4)], float)
    return [b * 0.3 + 3, b * 0.65, b, np.clip(b * 0.6 + h * 0.6 + 18, 0, 255), np.clip(b * 0.45 + h * 0.55 + 22, 0, 255)]


def G(base):
    b = np.array([int(base[i:i + 2], 16) for i in (0, 2, 4)], float)
    return [b * 0.5, b * 0.8, b, b, b]


WIZARDS = {
    'apprentice': dict(name='The Apprentice', mana=8, start='Fire ×1', unique='No twist: the classic game',
        A=dict(robe='3a3a8a', trim='e6a03c', hat='pointed', hatc='3a3a8a', hair='6a3a20', beard=None, eyes='ink', prop='orb', propc='e25cc4'),
        B=dict(robe='6a3a2a', trim='c8a050', hat='pointed', hatc='4a2a5a', hair='c08040', beard=None, eyes='ink', prop='candle', propc='ffd070')),
    'archivist': dict(name='The Archivist', mana=6, start='Slow ×1', unique='Recall: 3 letters + Enter',
        A=dict(robe='2e5a5a', trim='c8b48c', hat='hood', hatc='24484a', hair=None, beard='b8b0a8', eyes='specs', prop='tomes', propc='8a3a3a'),
        B=dict(robe='4a3a5a', trim='e6a03c', hat='hood', hatc='3a2c48', hair=None, beard='d8d0c8', eyes='specs', prop='quill', propc='e6d6b4')),
    'chronomancer': dict(name='The Chronomancer', mana=7, start='Ice ×1', unique='Rewind: undo the last miss',
        A=dict(robe='27306a', trim='e6c050', hat='brim', hatc='1e244e', hair=None, beard='e8e4dc', eyes='ink', prop='hourglass', propc='e6c050'),
        B=dict(robe='3a2a5a', trim='3aa49a', hat='brim', hatc='241a3a', hair=None, beard='a8a4b8', eyes='glowteal', prop='clock', propc='3aa49a')),
    'pyromancer': dict(name='The Pyromancer', mana=10, start='Fire ×2', unique='Burned scrolls count, at half',
        A=dict(robe='8a2020', trim='e0902a', hat='flame', hatc='5a1414', hair=None, beard=None, eyes='glowfire', prop='flame', propc='ffb040'),
        B=dict(robe='2a2226', trim='d2692e', hat='flame', hatc='1e1618', hair=None, beard='3a2a26', eyes='glowfire', prop='flame', propc='ff7030')),
    'hedgewitch': dict(name='The Hedge Witch', mana=12, start='—', unique='Huge mana, fewer powered scrolls',
        A=dict(robe='3e5a2e', trim='b48c48', hat='witch', hatc='2e3a24', hair='c05a2a', beard=None, eyes='ink', prop='herbs', propc='7aa050'),
        B=dict(robe='5a3a4a', trim='a8c070', hat='witch', hatc='2a1e2a', hair='e8e0d0', beard=None, eyes='ink', prop='mushroom', propc='c0392b')),
    'warden': dict(name='The Warden', mana=6, start='Barrier ×1', unique='Each level starts shielded',
        A=dict(robe='4a4e5a', trim='9aa4b8', hat='helm', hatc='6a7080', hair=None, beard=None, eyes='glowteal', prop='shield', propc='3aa49a'),
        B=dict(robe='3a2e2a', trim='c8a040', hat='helm', hatc='5a4a3a', hair=None, beard=None, eyes='glowgold', prop='lantern', propc='ffcf60')),
}


def draw(spec, view='front', k=1.6):
    S = Sprite(96, 128, k)
    robe = S.material(R(spec['robe'], 'b0a0d0')); robe_d = S.material(R(_dk(spec['robe']), 'a090c0'))
    trim = S.material(R(spec['trim'], 'fff0c0')); hat = S.material(R(spec['hatc'], 'b0a0d0'))
    skin = S.material([np.array([int(c[i:i + 2], 16) for i in (0, 2, 4)], float) for c in SKIN])
    ink = S.material(G('0b0a10')); leather = S.material(R('4a2e1e', 'c09060'))
    prop = S.material(R(spec['propc'], 'ffffff')); glowm = S.material(G(spec['propc']))
    steel = S.material(R('6a7080', 'd0d8e8')); wood = S.material(R('5a3a22', 'd0a070'))
    hair = S.material(R(spec['hair'] or '000000', 'ffe0c0')) if spec['hair'] else None
    beard = S.material(R(spec['beard'], 'ffffff')) if spec['beard'] else None
    hi = S.material(G('fff4e0'))
    glows = [glowm, hi]
    game = view == 'game'
    fx = 0  # face turned toward the typewriter

    # things carried on the back go first
    p = spec['prop']
    if p == 'tomes':
        for k, c in enumerate((prop, leather, robe_d, prop)):
            S.rect(c, 8 + k % 2 * 3, 46 + k * 7, 34 + k % 2 * 3, 53 + k * 7)
        S.rect(leather, 30, 46, 33, 80)
    if p in ('herbs', 'mushroom'):
        S.line(wood, [(12, 18), (14, 126)], 3)
    if p == 'clock' and not game:
        S.ellipse(prop, [20, 14, 76, 70]); S.ellipse(robe_d, [24, 18, 72, 66])
        for a in range(12):
            t = a / 12 * 6.283; S.rect(glowm, int(48 + 25 * np.cos(t)), int(42 + 25 * np.sin(t)), int(50 + 25 * np.cos(t)), int(44 + 25 * np.sin(t)))
    if spec['hair'] and spec['hat'] == 'witch':
        S.poly(hair, [(30, 46), (66, 46), (72, 92), (24, 92)])

    # robe and arms
    hem = [(82, 127)] + [(x, 127 if (x // 5) % 2 else 122 + (x * 7) % 4) for x in range(80, 14, -5)] + [(14, 127)]
    S.poly(robe, [(30, 68), (66, 68)] + hem)
    S.poly(robe_d, [(48, 76), (66, 68), (82, 127), (52, 127)])
    S.rect(trim, 46, 74, 50, 122)
    S.rect(leather, 31, 92, 65, 95); S.rect(trim, 46, 91, 50, 96)
    if game:   # arms reach forward and down to the keys
        S.poly(robe, [(20, 70), (36, 68), (46, 112), (34, 118)])
        S.poly(robe_d, [(60, 68), (76, 70), (62, 118), (50, 112)])
    else:
        S.ellipse(robe, [16, 66, 40, 106]); S.ellipse(skin, [20, 98, 30, 107])
        S.ellipse(robe_d, [56, 66, 80, 106]); S.ellipse(skin, [66, 98, 76, 107])
    if p == 'shield' and not game:
        S.ellipse(steel, [4, 70, 42, 112]); S.ellipse(steel, [8, 74, 38, 108])
        S.rect(glowm, 21, 80, 25, 102); S.rect(glowm, 14, 89, 32, 93)
    if p == 'herbs' and not game:
        for k in range(5): S.line(prop, [(22 + k, 98), (16 + k * 3, 80)], 1)
        S.rect(leather, 20, 96, 28, 100)

    # head
    if spec['hat'] in ('hood', 'flame'):
        S.ellipse(hat, [28 + fx // 2, 30, 68 + fx // 2, 76]); S.poly(hat, [(30, 44), (48, 22), (66, 44)])
        S.poly(hat, [(28, 60), (68, 60), (72, 78), (24, 78)])
    if spec['hat'] == 'helm':
        S.poly(robe_d, [(24, 56), (72, 56), (78, 76), (18, 76)])
        S.ellipse(steel, [14, 60, 38, 78]); S.ellipse(steel, [58, 60, 82, 78])
    S.ellipse(skin, [38 + fx, 44, 58 + fx, 66])
    shadow = S.material(G('3a2a24'))
    S.rect(shadow, 38, 44, 59, 50)            # the hat or hood shades the brow
    if spec['hair'] and spec['hat'] == 'pointed':
        S.rect(hair, 37 + fx, 44, 59 + fx, 49); S.rect(hair, 37 + fx, 49, 40 + fx, 56)
    if spec['hat'] == 'hood':
        S.poly(hat, [(36 + fx, 44), (48 + fx, 36), (60 + fx, 44), (60 + fx, 48), (36 + fx, 48)])
    if spec['hat'] == 'flame':
        S.poly(hat, [(36 + fx, 46), (48 + fx, 38), (60 + fx, 46), (60 + fx, 49), (36 + fx, 49)])
        for x0, h in ((32, 18), (42, 28), (52, 22), (62, 14)):
            S.poly(glowm, [(x0, 34), (x0 + 4, 34 - h), (x0 + 8, 34)])
    if spec['hat'] == 'helm':
        S.ellipse(steel, [32 + fx // 2, 30, 64 + fx // 2, 68]); S.poly(steel, [(36, 36), (48, 22), (60, 36)])
        S.rect(ink, 38 + fx, 50, 58 + fx, 54); S.rect(trim, 47 + fx // 2, 24, 49 + fx // 2, 50)
    # face details
    if spec['hat'] != 'helm':
        ex = (43, 52)
        if spec['eyes'] == 'specs':
            for x in ex: S.rect(trim, x - 2, 52, x + 3, 56); S.rect(ink, x, 53, x + 1, 55)
            S.rect(trim, ex[0] + 3, 53, ex[1] - 2, 54)
        else:
            m = {'ink': ink, 'glowfire': glowm, 'glowteal': glowm, 'glowgold': glowm}[spec['eyes']]
            for x in ex: S.rect(m, x, 53, x + 2, 56)
        if spec['beard']:
            S.poly(beard, [(38 + fx, 58), (58 + fx, 58), (56 + fx, 78), (48 + fx, 90), (40 + fx, 78)])
            S.rect(skin, 45 + fx, 60, 51 + fx, 62)
        else:
            S.rect(robe_d, 46 + fx, 61, 50 + fx, 62)
    else:
        for x in (43 + fx, 51 + fx): S.rect(glowm, x, 51, x + 3, 53)
    # hats on top
    if spec['hat'] == 'pointed':
        S.ellipse(hat, [22 + fx, 38, 74 + fx, 50])
        S.poly(hat, [(32 + fx, 44), (64 + fx, 44), (58 + fx, 22), (74 + fx, 10), (70 + fx, 6), (50 + fx, 16)])
        S.rect(trim, 33 + fx, 40, 63 + fx, 44)
    if spec['hat'] == 'brim':
        S.ellipse(hat, [10, 38, 86, 50]); S.rect(hat, 32, 14, 64, 44); S.ellipse(hat, [32, 8, 64, 22])
        S.rect(trim, 32, 36, 64, 41)
        for x in range(34, 64, 6): S.rect(trim, x, 34, x + 2, 36)
    if spec['hat'] == 'witch':
        S.ellipse(hat, [14 + fx, 38, 82 + fx, 50])
        S.poly(hat, [(30 + fx, 44), (64 + fx, 44), (56 + fx, 26), (68 + fx, 14), (78 + fx, 18), (60 + fx, 2), (44 + fx, 22)])
        S.rect(trim, 31 + fx, 38, 63 + fx, 43)
        if p == 'mushroom':
            for x in (18, 70):
                S.ellipse(prop, [x + fx, 32, x + 10 + fx, 40]); S.rect(robe_d, x + 4 + fx, 38, x + 6 + fx, 42)
                S.rect(G('ffffff') and skin, x + 3 + fx, 34, x + 4 + fx, 35)
    # held / hovering props
    hx, hy = 66, 72
    if game: p = None
    if p == 'orb':
        S.ellipse(prop, [hx - 3, hy + 7, hx + 17, hy + 27]); S.ellipse(glowm, [hx - 1, hy + 9, hx + 15, hy + 25]); S.rect(hi, hx + 2, hy + 12, hx + 5, hy + 15)
    if p == 'candle':
        S.rect(prop, hx + 2, hy + 10, hx + 9, hy + 28); S.ellipse(glowm, [hx + 3, hy, hx + 8, hy + 10])
    if p == 'flame':
        S.poly(glowm, [(hx, hy + 26), (hx + 4, hy + 6), (hx + 8, hy + 16), (hx + 12, hy), (hx + 16, hy + 26)])
        S.poly(hi, [(hx + 5, hy + 26), (hx + 8, hy + 16), (hx + 11, hy + 26)])
    if p == 'hourglass':
        S.rect(prop, hx, hy + 6, hx + 16, hy + 9); S.rect(prop, hx, hy + 33, hx + 16, hy + 36)
        S.poly(steel, [(hx + 2, hy + 9), (hx + 14, hy + 9), (hx + 9, hy + 21), (hx + 14, hy + 33), (hx + 2, hy + 33), (hx + 7, hy + 21)])
        S.poly(glowm, [(hx + 4, hy + 30), (hx + 12, hy + 30), (hx + 8, hy + 24)]); S.poly(glowm, [(hx + 5, hy + 12), (hx + 11, hy + 12), (hx + 8, hy + 17)])
    if p == 'quill':
        S.poly(prop, [(hx + 2, hy + 30), (hx + 16, hy - 4), (hx + 10, hy + 18)])
    if p == 'clock' and game:
        S.ellipse(prop, [hx, hy + 8, hx + 18, hy + 26]); S.ellipse(robe_d, [hx + 3, hy + 11, hx + 15, hy + 23])
        S.rect(glowm, hx + 8, hy + 12, hx + 10, hy + 18)
    if p == 'lantern':
        S.rect(steel, hx + 2, hy + 6, hx + 14, hy + 28); S.rect(glowm, hx + 4, hy + 10, hx + 12, hy + 25); S.rect(steel, hx + 7, hy, hx + 9, hy + 6)
    if p == 'mushroom' and not game:
        S.ellipse(prop, [hx, hy + 18, hx + 14, hy + 28]); S.rect(skin, hx + 5, hy + 26, hx + 9, hy + 34)
    return S.render(light=(-1, -1), glow=tuple(glows), flat=(shadow,))


def _dk(h):
    b = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    return ''.join(f'{int(v * 0.7):02x}' for v in b)


if __name__ == '__main__':
    sheet = Image.new('RGBA', (96 * 4 * 6 // 2, 128 * 2), (20, 18, 28, 255))
    from px import grade
    S = 154
    sheet = Image.new('RGBA', (S * 4, 205 * 6), (20, 18, 28, 255))
    for r, (key, w) in enumerate(WIZARDS.items()):
        for cidx, (look, view) in enumerate((('A', 'front'), ('A', 'game'), ('B', 'front'), ('B', 'game'))):
            sheet.alpha_composite(draw(w[look], view), (cidx * S, r * 205))
    grade(sheet, vignette=0, grit=0.04).save('out/wizards.png')
    print('ok')
