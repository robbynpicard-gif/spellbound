#!/usr/bin/env python3
"""
Batch 01 + 01b integration (D-094, D-096, D-098): turn the owner-approved Flow
assets into game layers in public/assets/typel/keyart/ and update
src/typel/render/keyart.json. Re-runnable; reads only approved sources.

    python3 tools/assets/build_plate.py docs/assets/plate-build.json assets-src/work/PLT/clean-plate_v1_1920.png
    python3 tools/assets/build_plate.py docs/assets/plate-build-v2.json assets-src/work/PLT/clean-plate_v2_1920.png
    python3 tools/assets/integrate_hud_rev1.py

Layers the D-093 slicer (tools/keyart) cut from the original painting and that
these edits don't touch (wizard, hands, medals, shelf scrolls, flame, CATCH!,
hammer, gear, tube textures, wisps) are kept as they are.
"""
import colorsys
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/assets/typel/keyart'
KEYART = ROOT / 'src/typel/render/keyart.json'
PLATE = ROOT / 'assets-src/work/PLT/clean-plate_v2_1920.png'
FLOW = ROOT / 'assets-src/flow'
PREP = ROOT / 'tools/assets/prep.py'
K = 1920 / 1344
SPELLS = ['slow', 'fire', 'ice', 'barrier', 'shock', 'alter', 'wind', 'harvest']
# painting parchment (ART_BIBLE) vs SCR-001's delivered parchment: the owner-recommended tone match
SCROLL_TONE = np.array([0xd4, 0xbb, 0x95]) / np.array([0xf0, 0xd9, 0xaf])


def prep(*args):
    r = subprocess.run([sys.executable, str(PREP), *map(str, args)], capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr)


def keyed_pieces(src: Path, names: list[str], tmp: Path) -> dict[str, Image.Image]:
    keyed = tmp / f'{src.stem}_keyed.png'
    prep('key', src, keyed, '--despill')
    prep('split', keyed, tmp / src.stem, '--names', ','.join(names), '--min-area', '1500')
    return {n: Image.open(tmp / src.stem / f'{n}.png').convert('RGBA') for n in names}


def fit_h(im: Image.Image, h: int) -> Image.Image:
    return im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp())
    ka = json.loads(KEYART.read_text())
    S = ka['sprites']

    # ── the clean plate and the layer in front of the scrolls ──
    plate = cv2.imread(str(PLATE), cv2.IMREAD_COLOR)
    cv2.imwrite(str(OUT / 'plate.jpg'), plate, [cv2.IMWRITE_JPEG_QUALITY, 90])
    fg = np.zeros((1080, 1920), np.uint8)
    ward_y = round(ka['paper']['top'])
    fg[ward_y:, :] = 255
    for x0, y0, x1, y1 in [(424, 440, 448, 461), (893, 438, 915, 461)]:  # carriage posts (painting space)
        fg[round(y0 * K):ward_y, round(x0 * K):round(x1 * K)] = 255
    fg = cv2.GaussianBlur(fg, (0, 0), 0.8)
    front = np.dstack([plate, fg])[620:]
    cv2.imwrite(str(OUT / 'front.webp'), front, [cv2.IMWRITE_WEBP_QUALITY, 92])
    S['front'] = {'x': 0, 'y': 620, 'w': 1920, 'h': 460}

    # ── the rune arch glow, re-cut now that the title no longer interrupts it ──
    small = cv2.resize(plate, (1344, 756), interpolation=cv2.INTER_AREA)
    B, G, R = [small[:, :, i].astype(int) for i in range(3)]
    lum = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY).astype(int)
    cyan = np.clip((np.minimum(G, B) - R - 18) * 3.2, 0, 255) * (lum > 105)
    region = np.zeros((756, 1344), bool)
    region[0:462, 412:1008] = True
    region[75:462, 492:930] = False
    arch = np.where(region, cyan, 0).astype(np.uint8)[0:462, 412:1008]
    aw, ah = round(596 * K), round(462 * K)
    a = cv2.resize(arch, (aw, ah))
    cv2.imwrite(str(OUT / 'arch.png'), np.dstack([np.full((ah, aw, 3), 255, np.uint8), a]))
    S['arch'] = {'x': round(412 * K, 1), 'y': 0, 'w': aw, 'h': ah}

    # ── SCR-001: the plain word scroll, toned to the painting's parchment, 2x for sharpness ──
    keyed = tmp / 'scr_keyed.png'
    prep('key', FLOW / 'SCR-001/SCR-001_word-scroll_v1.png', keyed, '--despill')
    prep('trim', keyed, tmp / 'scr_trim.png', '--pad', '2')
    sc = np.asarray(Image.open(tmp / 'scr_trim.png').convert('RGBA')).astype(np.float32)
    sc[..., :3] *= SCROLL_TONE
    scroll = fit_h(Image.fromarray(sc.clip(0, 255).astype(np.uint8), 'RGBA'), 134)
    scroll.save(OUT / 'scroll_plain.png', optimize=True)
    cap = round(scroll.width * 0.088)  # rolled ends (measured: ~8.8% of the width on each side)
    S['scroll_plain'] = {**S['scroll_plain'], 'w': scroll.width, 'h': scroll.height, 'capL': cap, 'capR': cap}

    # ── RIB-001 shelf ribbons, KEY-001 spell gems, MIX-001 lock bar / seals / orb liquid ──
    ribs = keyed_pieces(FLOW / 'RIB-001/RIB-001_shelf-ribbons_v1.png', SPELLS, tmp)
    for s, im in ribs.items():
        fit_h(im, 96).save(OUT / f'ribbon_{s}.png', optimize=True)
    gems = keyed_pieces(FLOW / 'KEY-001/KEY-001_spell-gems_v1.png', SPELLS, tmp)
    for s, im in gems.items():
        g = fit_h(im, 64)
        if s == 'shock':  # owner-visible clash with Harvest's amber: shift Shock towards lemon yellow
            arr = np.asarray(g).astype(np.float32) / 255
            hsv = cv2.cvtColor((arr[..., :3] * 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
            hsv[..., 0] = np.clip(hsv[..., 0] + 8, 0, 179)  # +16 degrees
            rgb = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
            g = Image.fromarray(np.dstack([rgb, (arr[..., 3] * 255).astype(np.uint8)]), 'RGBA')
        g.save(OUT / f'gem_{s}.png', optimize=True)
    mix = keyed_pieces(FLOW / 'MIX-001/MIX-001_lock-seals-orb_v1.png', ['lockbar', 'seal_normal', 'seal_hardcore', 'orb_liquid'], tmp)
    fit_h(mix['lockbar'], 72).save(OUT / 'lockbar.png', optimize=True)
    # the lock bar stretches across the spell keys: split into a stretchable bar (padlock painted out with
    # plain bar from beside it) and the padlock on its own, so nothing distorts (measured on the 72-px bar)
    lb = np.asarray(Image.open(OUT / 'lockbar.png').convert('RGBA')).copy()
    bar = lb.copy()
    bar[:, 120:166] = lb[:, 62:108]
    Image.fromarray(bar, 'RGBA').save(OUT / 'lockbar_bar.png', optimize=True)
    Image.fromarray(lb[34:, 118:166].copy(), 'RGBA').save(OUT / 'lockbar_lock.png', optimize=True)
    fit_h(mix['seal_normal'], 96).save(OUT / 'seal_normal.png', optimize=True)
    fit_h(mix['seal_hardcore'], 96).save(OUT / 'seal_hardcore.png', optimize=True)
    fit_h(mix['orb_liquid'], 160).save(OUT / 'orb_liquid.png', optimize=True)

    # ── layout measured on the approved plate (clean-plate_v2) ──
    ka['field'] = {'x': 548, 'y': 0, 'w': 1034, 'h': 655}  # D-096: 10% wider and taller
    ka['tubes']['combo']['bottom'] = 705
    ka['tubes']['rush']['bottom'] = 700
    boards = [412, 475, 538, 600, 660, 720, 780, 838]
    ka['shelf'] = {'boards': boards, 'top': 362, 'left': 1612, 'right': 1850, 'scrollX': 1738, 'countX': 1826, 'ribbonX': 1628}
    ka['rackCount'] = {s: [1826, b - 26] for s, b in zip(SPELLS, boards)}
    ka['spellKeys'] = [[round(701 + 74.3 * i, 1), 780] for i in range(8)]
    ka['orb'] = {'x': 1442, 'y': 860, 'r': 58}
    ka['runeDisplay'] = {'x': 132, 'y': 750, 'w': 268, 'h': 137, 'lens': [275, 735], 'strip': [276, 898]}
    ka['banner'] = {'x': 1758, 'y': 238, 'w': 150, 'seal': [1868, 238]}
    ka['pool'] = [1731, 862]
    ka['pipe'] = [1828, 942]
    KEYART.write_text(json.dumps(ka, indent=1) + '\n')
    print('layers written to', OUT)


if __name__ == '__main__':
    main()
