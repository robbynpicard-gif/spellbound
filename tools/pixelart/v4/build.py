"""Builds the v4 art into public/assets/art/ (640x360 art, shown 2x).

    python3 tools/pixelart/v4/build.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image
from px import Canvas, grade, col, W, H
from scenes import SCENES
from interior import interior, study_back, typewriter_back, THEMES
from wizards import WIZARDS, draw

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'public', 'assets', 'art'))
WIZ_POS = (225, 119)   # top-left of the in-game wizard (art px); matches LAYOUT.wizard


def front(theme):
    key = np.array([1.0, 2.0, 3.0])
    c = Canvas(fill=key); typewriter_back(c, theme)
    alpha = (np.abs(c.a - key).sum(axis=2) > 0.5)
    rgba = np.dstack([np.clip(c.a, 0, 255), alpha * 255]).astype(np.uint8)
    return grade(Image.fromarray(rgba, 'RGBA'), vignette=0, grit=0.05, seed=9)


def backdrop(theme):
    c = SCENES[theme]()
    interior(c, theme); study_back(c, theme)
    return grade(c.img(), sat=0.86, bright=0.94, gamma=1.06, grit=0.05, vignette=0.45, seed=len(theme))


def main(preview=False):
    os.makedirs(OUT, exist_ok=True)
    for t in THEMES:
        backdrop(t).save(os.path.join(OUT, f'backdrop-{t}.png'), optimize=True)
        front(t).save(os.path.join(OUT, f'front-{t}.png'), optimize=True)
    for k in ('menu', 'library'):
        grade(SCENES[k]().img(), sat=0.86, bright=0.94, gamma=1.06, grit=0.05, seed=3).save(os.path.join(OUT, f'{k}.png'), optimize=True)
    for k, w in WIZARDS.items():
        for look in 'AB':
            for view in ('game', 'front'):
                grade(draw(w[look], view), vignette=0, grit=0.04, sat=0.9, bright=0.95, gamma=1.05).save(os.path.join(OUT, f'wizard-{k}-{look.lower()}-{view}.png'), optimize=True)
    print('built into', OUT)


if __name__ == '__main__':
    main()
