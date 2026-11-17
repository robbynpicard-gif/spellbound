"""Each wizard's domain (D-044): chapter 1 is played in the chosen wizard's own study,
lit in their colours, before the journey outward into the darkness (chapters 2-4).
Writes public/assets/art/backdrop-dom-<wizard>.png and backdrop-bossdom-<wizard>.png.
The Apprentice's domain is the original tower study (backdrop-ch1 / boss1).

    python3 tools/pixelart/v5/build_domains.py
"""
import os
import build as B
import interior as I
import scenes as S

DOMAINS = {
    'archivist':    dict(key='4a8aa0', candle='d8c890', magic='70c0e0', prop='candles'),
    'chronomancer': dict(key='3aa49a', candle='e8c060', magic='60f0d0', prop='rod'),
    'pyromancer':   dict(key='e06a2a', candle='ffb050', magic='ff7a30', prop='brazier'),
    'cartographer': dict(key='5a8ad8', candle='f0c070', magic='d8b860', prop='flask'),
    'lexicant':     dict(key='8a5ab0', candle='f0a8d0', magic='e25cc4', prop='candles'),
}

if __name__ == '__main__':
    for w, th in DOMAINS.items():
        I.THEMES[f'dom-{w}'] = th
        boss = dict(th, key='b03a2c', candle='ff7040')
        I.THEMES[f'bossdom-{w}'] = boss
        S.SCENES[f'bossdom-{w}'] = S.SCENES['boss1']
        for name in (f'dom-{w}', f'bossdom-{w}'):
            img, _ = B.render(name)
            img.save(os.path.join(B.OUT, f'backdrop-{name}.png'), optimize=True)
    print('domains built:', list(DOMAINS))
