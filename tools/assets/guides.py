#!/usr/bin/env python3
"""
TypeL asset production: composition guide images for Flow (docs/assets/guides/).

Each guide is a flat-colour layout map attached to Flow next to the concept art,
so a generated asset comes back with the proportions the game layout needs.
Guides deliberately contain NO text (generators copy text into the output);
`--labelled` also writes annotated copies for humans (*_labelled.png).

The play layout and edit regions come from src/typel/render/keyart.json (the
D-093 layout, i.e. the painting's own 1920x1080 space) and
docs/assets/plate-regions.json. Re-run after either changes:

    python3 tools/assets/guides.py --labelled
"""
from __future__ import annotations
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[2] / 'docs' / 'assets' / 'guides'
KEY = (255, 0, 255)          # flat magenta: "this becomes transparent"
DARK = (58, 52, 60)          # object silhouette
MID = (120, 112, 104)        # secondary parts
LIGHT = (225, 214, 190)      # parchment / paper
GLASS = (150, 190, 205)      # glass
CALM = (52, 62, 110)         # open sky where words fall
WALL = (40, 34, 30)
DESK = (96, 62, 40)

REF = Path(__file__).resolve().parents[2] / 'assets-src/reference/REF-001_typel-concept-primary_v1_1920x1080.png'
KEYART = Path(__file__).resolve().parents[2] / 'src/typel/render/keyart.json'
REGIONS = Path(__file__).resolve().parents[2] / 'docs/assets/plate-regions.json'
W, H = 1920, 1080


def font(size: int):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'):
        if Path(f).exists():
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


class Guide:
    def __init__(self, name: str, size: tuple[int, int], bg):
        self.name, self.im = name, Image.new('RGB', size, bg)
        self.d = ImageDraw.Draw(self.im)
        self.labels: list[tuple[tuple[int, int], str]] = []

    def rect(self, box, fill, label: str | None = None, r: int = 0):
        self.d.rounded_rectangle(box, r, fill=fill) if r else self.d.rectangle(box, fill=fill)
        if label:
            self.labels.append(((box[0] + 8, box[1] + 6), label))

    def ellipse(self, box, fill, label=None):
        self.d.ellipse(box, fill=fill)
        if label:
            self.labels.append(((box[0], box[1] - 22), label))

    def save(self, labelled: bool):
        OUT.mkdir(parents=True, exist_ok=True)
        self.im.save(OUT / f'{self.name}.png', optimize=True)
        if labelled:
            lab = self.im.copy()
            d = ImageDraw.Draw(lab)
            f = font(max(16, self.im.width // 70))
            for (x, y), s in self.labels:
                d.text((x, y), s, fill=(255, 255, 255), font=f, stroke_width=3, stroke_fill=(0, 0, 0))
            lab.save(OUT / f'{self.name}_labelled.png', optimize=True)


def _over_ref(name: str) -> Guide:
    g = Guide(name, (W, H), (0, 0, 0))
    ref = Image.open(REF).convert('RGB').resize((W, H))
    g.im.paste(Image.blend(ref, Image.new('RGB', (W, H), (0, 0, 0)), 0.55))
    g.d = ImageDraw.Draw(g.im)
    return g


def play_layout() -> Guide:
    """The live D-093 layout (keyart.json) drawn over the dimmed concept: for people, not for Flow."""
    import json
    k = json.loads(KEYART.read_text())
    g = _over_ref('G-000_play-layout_1920x1080')
    f = k['field']
    g.d.rectangle((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']), outline=(80, 200, 255), width=4)
    g.labels.append(((f['x'] + 8, f['y'] + 8), 'FIELD: words fall here'))
    p = k['paper']
    g.d.line((p['left'], p['top'], p['right'], p['top']), fill=(255, 80, 80), width=5)
    g.labels.append(((p['left'], p['top'] - 30), 'WARD LINE = paper top'))
    for name, sp in ((n, s) for n, s in k['sprites'].items() if 'x' in s and n not in ('front', 'wisps')):
        g.d.rectangle((sp['x'], sp['y'], sp['x'] + sp['w'], sp['y'] + sp['h']), outline=(255, 210, 90), width=2)
        g.labels.append(((sp['x'] + 4, sp['y'] + sp['h'] - 26), name))
    return g


def region_map() -> Guide:
    """Which part of the painting each plate edit (PLT-00x) may change."""
    import json
    r = json.loads(REGIONS.read_text())
    g = _over_ref('G-PLT_edit-regions_1920x1080')
    cols = {'PLT-001': (90, 200, 255), 'PLT-002': (255, 200, 80), 'PLT-003': (255, 110, 110), 'PLT-004': (140, 255, 140)}
    for name, reg in r['regions'].items():
        for i, box in enumerate(reg['rects']):
            g.d.rectangle(box, outline=cols.get(name, (255, 255, 255)), width=5)
            if i == 0:
                g.labels.append(((box[0] + 8, box[1] + 8), name))
    return g


def scroll_banner() -> Guide:
    g = Guide('G-SCR-001_word-scroll_16x9', (W, H), KEY)
    cy = H // 2
    g.rect((330, cy - 110, 1590, cy + 110), LIGHT, 'flat parchment banner, EMPTY centre', r=10)
    for x in (250, 1590):
        g.rect((x, cy - 150, x + 80, cy + 150), (200, 180, 140), 'rolled end' if x == 250 else None, r=36)
    return g


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--labelled', action='store_true', help='also write annotated *_labelled.png copies')
    a = ap.parse_args()
    for make in (play_layout, region_map, scroll_banner):
        gd = make()
        gd.save(a.labelled)
        print('wrote', OUT / f'{gd.name}.png')
