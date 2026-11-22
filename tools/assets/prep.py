#!/usr/bin/env python3
"""
TypeL asset preparation (docs/assets/REFERENCE_GUIDE.md, "Processing").

Turns an approved Flow output (kept untouched in assets-src/) into a game-ready
file in public/assets/typel/. Every step is non-destructive: it reads one file
and writes a new one. Requires Pillow, numpy and scipy (no network).

    python3 tools/assets/prep.py inspect FILE
    python3 tools/assets/prep.py key IN OUT [--color ff00ff] [--tol 70] [--soft 40] [--despill]
    python3 tools/assets/prep.py trim IN OUT [--pad 4]
    python3 tools/assets/prep.py fit IN OUT --w 400 --h 1080 [--mode contain|cover|width|height]
    python3 tools/assets/prep.py crop IN OUT --box x0 y0 x1 y1
    python3 tools/assets/prep.py split IN OUTDIR [--min-area 2000] [--names a,b,c]
    python3 tools/assets/prep.py slice3 IN OUTDIR --left PX --right PX
    python3 tools/assets/prep.py export IN OUT [--quality 90]      (.webp / .png / .jpg by extension)
    python3 tools/assets/prep.py compare IN [--palette docs/assets/palette.json]
    python3 tools/assets/prep.py align EDIT REF OUT [--w 1920 --h 1080]       (needs opencv)
    python3 tools/assets/prep.py composite BASE PATCH OUT --regions JSON --name NAME [--feather 24]
    python3 tools/assets/prep.py diff A B OUT                                (where two frames differ)

Plate edits (D-094): Flow is asked to EDIT the concept painting so that only
one region changes. `align` registers the edit back onto the painting (feature
matching + a similarity transform, so small shifts/zoom from the generator are
undone) and `composite` copies only that region's rectangles, feathered, onto
the base plate. `diff` shows everything the edit changed, so unrequested
changes inside the region are caught in review.

Chroma key: Flow cannot output real transparency, so isolated assets are
generated on flat magenta (#FF00FF). `key` measures each pixel's distance from
the key colour in RGB, makes near pixels transparent, feathers the edge band
(--soft) and, with --despill, pulls leftover magenta tint out of edge pixels.
Always inspect the result over dark AND light backgrounds (`inspect` writes a
preview) before approving it.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]


def load(p: str | Path) -> Image.Image:
    im = Image.open(p)
    im.load()
    return im


def rgba(im: Image.Image) -> np.ndarray:
    return np.asarray(im.convert('RGBA')).astype(np.float32)


def save(arr_or_im, out: str | Path, quality: int = 92) -> None:
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    im = arr_or_im if isinstance(arr_or_im, Image.Image) else Image.fromarray(np.clip(arr_or_im, 0, 255).astype(np.uint8), 'RGBA')
    ext = out.suffix.lower()
    if ext == '.webp':
        im.save(out, 'WEBP', quality=quality, method=6, lossless=False, exact=False)
    elif ext in ('.jpg', '.jpeg'):
        im.convert('RGB').save(out, 'JPEG', quality=quality, optimize=True, progressive=True)
    else:
        im.save(out, 'PNG', optimize=True)
    print(f'wrote {out}  {im.size[0]}x{im.size[1]}  {out.stat().st_size / 1024:.0f} KB')


def hex_rgb(h: str) -> np.ndarray:
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32)


# ───────────────────────── commands ─────────────────────────

def cmd_inspect(a) -> None:
    im = load(a.file)
    arr = rgba(im)
    h, w = arr.shape[:2]
    alpha = arr[..., 3]
    corners = [arr[:16, :16], arr[:16, -16:], arr[-16:, :16], arr[-16:, -16:]]
    cmeans = [c[..., :3].reshape(-1, 3).mean(0) for c in corners]
    cstd = [c[..., :3].reshape(-1, 3).std(0).mean() for c in corners]
    g = np.gcd(w, h)
    info = {
        'file': str(a.file), 'size': [w, h], 'aspect': f'{w // g}:{h // g} ({w / h:.3f})', 'mode': im.mode,
        'has_real_alpha': bool((alpha < 255).any()),
        'transparent_pct': round(float((alpha < 8).mean() * 100), 2),
        'corner_colours': ['#%02x%02x%02x' % tuple(int(v) for v in c) for c in cmeans],
        'corner_flatness_std': [round(float(s), 1) for s in cstd],
    }
    bg = np.mean(cmeans, axis=0)
    info['looks_like_flat_background'] = bool(max(cstd) < 6 and np.ptp(np.array(cmeans), axis=0).max() < 12)
    info['background_estimate'] = '#%02x%02x%02x' % tuple(int(v) for v in bg)
    print(json.dumps(info, indent=1))
    # preview over dark and light checker so edge halos are visible
    if a.preview:
        prev = preview_sheet(im)
        out = Path(a.preview)
        prev.save(out)
        print('preview', out)


def preview_sheet(im: Image.Image, maxw: int = 900) -> Image.Image:
    im = im.convert('RGBA')
    s = min(1.0, maxw / im.width)
    im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
    out = Image.new('RGB', (im.width * 2 + 20, im.height), (0, 0, 0))
    for i, bg in enumerate(((24, 20, 18), (236, 226, 200))):
        tile = Image.new('RGBA', im.size, bg + (255,))
        tile.alpha_composite(im)
        out.paste(tile.convert('RGB'), (i * (im.width + 20), 0))
    return out


def cmd_key(a) -> None:
    arr = rgba(load(a.inp))
    key = hex_rgb(a.color)
    rgb = arr[..., :3]
    dist = np.sqrt(((rgb - key) ** 2).sum(-1))
    # alpha ramps from 0 at `tol` to 1 at `tol + soft`
    t = np.clip((dist - a.tol) / max(1.0, a.soft), 0, 1)
    # keep only background regions connected to the border, so magenta-ish
    # details inside the object (rare) are not punched out
    bgmask = dist < a.tol + a.soft
    lab, _ = ndimage.label(bgmask)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    border = border[border > 0]
    connected = np.isin(lab, border)
    # enclosed pockets of near-exact key colour (e.g. inside a padlock shackle) are background too:
    # pure magenta never occurs in TypeL art, so a strict threshold is safe there
    pocket = (~connected) & (dist < a.tol * 0.8)
    pocket = ndimage.binary_dilation(pocket, iterations=1) & (dist < a.tol + a.soft)
    alpha = np.where(connected | pocket, t, 1.0) * (arr[..., 3] / 255)
    connected = connected | pocket
    if a.despill:
        # remove the key colour's contribution from semi-transparent edge pixels
        # edge band: semi-transparent pixels plus a few opaque pixels next to the cut-out
        edge = ndimage.binary_dilation(alpha < 0.999, iterations=a.band) & (alpha > 0)
        k = key / 255
        if k[0] > 0.5 and k[2] > 0.5 and k[1] < 0.5:      # magenta: remove R+B excess over G
            r, g_, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
            excess = np.clip(np.minimum(r, b) - g_, 0, None)
            rgb[..., 0] = np.where(edge, r - excess, r)
            rgb[..., 2] = np.where(edge, b - excess, b)
        elif k[1] > 0.5 and k[0] < 0.5 and k[2] < 0.5:    # green
            rgb[..., 1] = np.where(edge, np.minimum(rgb[..., 1], (rgb[..., 0] + rgb[..., 2]) / 2 + 20), rgb[..., 1])
    if a.erode:
        hard = alpha > 0.5
        hard = ndimage.binary_erosion(hard, iterations=a.erode)
        alpha = np.where(hard, alpha, np.minimum(alpha, 0.0))
    out = np.dstack([rgb, alpha * 255])
    save(out, a.out)
    if a.preview:
        preview_sheet(Image.fromarray(out.clip(0, 255).astype(np.uint8), 'RGBA')).save(a.preview)
        print('preview', a.preview)


def cmd_trim(a) -> None:
    im = load(a.inp).convert('RGBA')
    bbox = im.getchannel('A').point(lambda v: 255 if v > a.threshold else 0).getbbox()
    if not bbox:
        sys.exit('image is fully transparent')
    x0, y0, x1, y1 = bbox
    p = a.pad
    box = (max(0, x0 - p), max(0, y0 - p), min(im.width, x1 + p), min(im.height, y1 + p))
    print('bbox', box)
    save(im.crop(box), a.out)


def cmd_crop(a) -> None:
    save(load(a.inp).convert('RGBA').crop(tuple(a.box)), a.out)


def cmd_fit(a) -> None:
    im = load(a.inp).convert('RGBA')
    tw, th = a.w, a.h
    if a.mode == 'width':
        s = tw / im.width
    elif a.mode == 'height':
        s = th / im.height
    elif a.mode == 'cover':
        s = max(tw / im.width, th / im.height)
    else:
        s = min(tw / im.width, th / im.height)
    nw, nh = max(1, round(im.width * s)), max(1, round(im.height * s))
    r = im.resize((nw, nh), Image.LANCZOS)
    if a.mode in ('width', 'height') and not a.canvas:
        save(r, a.out)
        return
    canvas = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
    canvas.alpha_composite(r, ((tw - nw) // 2, (th - nh) // 2)) if a.mode != 'cover' else canvas.paste(r.crop(((nw - tw) // 2, (nh - th) // 2, (nw - tw) // 2 + tw, (nh - th) // 2 + th)))
    save(canvas, a.out)


def cmd_split(a) -> None:
    """Split a sprite sheet into separate images by connected opaque regions (left-to-right, top-to-bottom)."""
    im = load(a.inp).convert('RGBA')
    alpha = np.asarray(im)[..., 3] > 16
    alpha = ndimage.binary_closing(alpha, iterations=6)
    lab, n = ndimage.label(alpha)
    objs = [s for s in ndimage.find_objects(lab) if s is not None]
    boxes = [(s[1].start, s[0].start, s[1].stop, s[0].stop) for s in objs]
    boxes = [b for b in boxes if (b[2] - b[0]) * (b[3] - b[1]) >= a.min_area]
    rowh = max(1, int(np.median([b[3] - b[1] for b in boxes])) if boxes else 1)
    boxes.sort(key=lambda b: (round(((b[1] + b[3]) / 2) / rowh), b[0]))
    names = a.names.split(',') if a.names else [f'{i + 1:02d}' for i in range(len(boxes))]
    if len(names) != len(boxes):
        print(f'warning: found {len(boxes)} pieces but {len(names)} names; using numbers', file=sys.stderr)
        names = [f'{i + 1:02d}' for i in range(len(boxes))]
    out = Path(a.outdir)
    for nm, (x0, y0, x1, y1) in zip(names, boxes):
        p = a.pad
        save(im.crop((max(0, x0 - p), max(0, y0 - p), min(im.width, x1 + p), min(im.height, y1 + p))), out / f'{nm}.png')


def cmd_slice3(a) -> None:
    """Three-slice a horizontal banner: fixed left cap, stretchable middle, fixed right cap."""
    im = load(a.inp).convert('RGBA')
    out = Path(a.outdir)
    save(im.crop((0, 0, a.left, im.height)), out / 'left.png')
    save(im.crop((a.left, 0, im.width - a.right, im.height)), out / 'middle.png')
    save(im.crop((im.width - a.right, 0, im.width, im.height)), out / 'right.png')


def cmd_export(a) -> None:
    save(load(a.inp).convert('RGBA'), a.out, a.quality)


def cmd_compare(a) -> None:
    """Report the asset's dominant colours next to the art-bible palette (nearest swatch and distance)."""
    pal = json.loads(Path(a.palette).read_text())
    swatches = [(p['name'], hex_rgb(p['median'])) for p in pal]
    arr = rgba(load(a.inp))
    px = arr[arr[..., 3] > 200][:, :3]
    if len(px) > 200_000:
        px = px[np.random.default_rng(1).choice(len(px), 200_000, replace=False)]
    q = (px // 24).astype(int)
    keys, counts = np.unique(q[:, 0] * 10000 + q[:, 1] * 100 + q[:, 2], return_counts=True)
    order = np.argsort(-counts)[:a.top]
    print(f'{"dominant":10s} {"share":>6s}  nearest art-bible swatch')
    for i in order:
        k = keys[i]
        c = np.array([k // 10000, (k // 100) % 100, k % 100]) * 24 + 12
        name, sw = min(swatches, key=lambda s: float(((s[1] - c) ** 2).sum()))
        d = float(np.sqrt(((sw - c) ** 2).sum()))
        print('#%02x%02x%02x  %5.1f%%  %s (dist %.0f)' % (*c.astype(int), counts[i] / len(q) * 100, name, d))


def _cv():
    try:
        import cv2  # noqa: F401
        return cv2
    except ImportError:
        sys.exit('this command needs opencv: pip install opencv-python')


def cmd_align(a) -> None:
    """Register EDIT onto REF (both resized to --w x --h) with ORB features and a partial-affine (similarity) fit."""
    cv2 = _cv()
    ref = np.asarray(load(a.ref).convert('RGB').resize((a.w, a.h), Image.LANCZOS))
    ed_im = load(a.edit).convert('RGB')
    # bring the edit to roughly the same scale first (generators return their own size)
    ed = np.asarray(ed_im.resize((a.w, round(ed_im.height * a.w / ed_im.width)), Image.LANCZOS))
    g1, g2 = cv2.cvtColor(ref, cv2.COLOR_RGB2GRAY), cv2.cvtColor(ed, cv2.COLOR_RGB2GRAY)
    orb = cv2.ORB_create(8000)
    k1, d1 = orb.detectAndCompute(g1, None)
    k2, d2 = orb.detectAndCompute(g2, None)
    if d1 is None or d2 is None:
        sys.exit('no features found')
    m = sorted(cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True).match(d2, d1), key=lambda x: x.distance)[:1500]
    src = np.float32([k2[x.queryIdx].pt for x in m])
    dst = np.float32([k1[x.trainIdx].pt for x in m])
    M, inl = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=2.0, maxIters=5000)
    if M is None:
        sys.exit('alignment failed')
    scale = float(np.hypot(M[0, 0], M[1, 0]))
    out = cv2.warpAffine(ed, M, (a.w, a.h), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
    # residual check on matched inliers
    pts = (np.c_[src, np.ones(len(src))] @ M.T)[inl.ravel() == 1]
    err = float(np.median(np.linalg.norm(pts - dst[inl.ravel() == 1], axis=1)))
    print(json.dumps({'inliers': int(inl.sum()), 'matches': len(m), 'scale': round(scale, 4), 'rotation_deg': round(float(np.degrees(np.arctan2(M[1, 0], M[0, 0]))), 3),
                      'shift_px': [round(float(M[0, 2]), 1), round(float(M[1, 2]), 1)], 'median_residual_px': round(err, 2)}))
    if inl.sum() < 40 or err > 3:
        print('WARNING: weak alignment; check the diff before using this edit', file=sys.stderr)
    save(Image.fromarray(out).convert('RGBA'), a.out)


def _region_mask(regions: dict, name: str, w: int, h: int, feather: int) -> np.ndarray:
    from PIL import ImageDraw, ImageFilter
    reg = regions['regions'][name]
    m = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(m)
    for r in reg['rects']:
        d.rectangle(r, fill=255)
    for poly in reg.get('polygons', []):
        d.polygon([tuple(p) for p in poly], fill=255)
    for r in reg.get('exclude', []):
        d.rectangle(r, fill=0)
    if feather:
        m = m.filter(ImageFilter.GaussianBlur(feather / 2))
    return np.asarray(m).astype(np.float32) / 255


def cmd_composite(a) -> None:
    regions = json.loads(Path(a.regions).read_text())
    base = rgba(load(a.base).convert('RGB').resize((regions['width'], regions['height']), Image.LANCZOS))
    patch = rgba(load(a.patch).convert('RGB').resize((regions['width'], regions['height']), Image.LANCZOS))
    m = _region_mask(regions, a.name, regions['width'], regions['height'], a.feather)[..., None]
    out = base * (1 - m) + patch * m
    out[..., 3] = 255
    save(out, a.out)


def cmd_diff(a) -> None:
    A = rgba(load(a.a).convert('RGB'))
    B = rgba(load(a.b).convert('RGB').resize((A.shape[1], A.shape[0]), Image.LANCZOS))
    d = np.abs(A[..., :3] - B[..., :3]).mean(-1)
    heat = np.clip(d * 4, 0, 255)
    dim = A[..., :3] * 0.35
    vis = dim.copy()
    vis[..., 0] = np.maximum(dim[..., 0], heat)
    print(f'changed pixels (>24 levels): {(d > 24).mean() * 100:.1f}%')
    save(np.dstack([vis, np.full(d.shape, 255.0)]), a.out)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('inspect'); s.add_argument('file'); s.add_argument('--preview')
    s = sub.add_parser('key'); s.add_argument('inp'); s.add_argument('out'); s.add_argument('--color', default='ff00ff')
    s.add_argument('--tol', type=float, default=70); s.add_argument('--soft', type=float, default=40)
    s.add_argument('--despill', action='store_true'); s.add_argument('--band', type=int, default=3); s.add_argument('--erode', type=int, default=0); s.add_argument('--preview')
    s = sub.add_parser('trim'); s.add_argument('inp'); s.add_argument('out'); s.add_argument('--pad', type=int, default=4); s.add_argument('--threshold', type=int, default=8)
    s = sub.add_parser('crop'); s.add_argument('inp'); s.add_argument('out'); s.add_argument('--box', type=int, nargs=4, required=True)
    s = sub.add_parser('fit'); s.add_argument('inp'); s.add_argument('out'); s.add_argument('--w', type=int, required=True); s.add_argument('--h', type=int, required=True)
    s.add_argument('--mode', choices=['contain', 'cover', 'width', 'height'], default='contain'); s.add_argument('--canvas', action='store_true')
    s = sub.add_parser('split'); s.add_argument('inp'); s.add_argument('outdir'); s.add_argument('--min-area', type=int, default=2000)
    s.add_argument('--names'); s.add_argument('--pad', type=int, default=4)
    s = sub.add_parser('slice3'); s.add_argument('inp'); s.add_argument('outdir'); s.add_argument('--left', type=int, required=True); s.add_argument('--right', type=int, required=True)
    s = sub.add_parser('export'); s.add_argument('inp'); s.add_argument('out'); s.add_argument('--quality', type=int, default=90)
    s = sub.add_parser('compare'); s.add_argument('inp'); s.add_argument('--palette', default=str(ROOT / 'docs/assets/palette.json')); s.add_argument('--top', type=int, default=12)
    s = sub.add_parser('align'); s.add_argument('edit'); s.add_argument('ref'); s.add_argument('out'); s.add_argument('--w', type=int, default=1920); s.add_argument('--h', type=int, default=1080)
    s = sub.add_parser('composite'); s.add_argument('base'); s.add_argument('patch'); s.add_argument('out'); s.add_argument('--regions', default=str(ROOT / 'docs/assets/plate-regions.json'))
    s.add_argument('--name', required=True); s.add_argument('--feather', type=int, default=24)
    s = sub.add_parser('diff'); s.add_argument('a'); s.add_argument('b'); s.add_argument('out')
    a = ap.parse_args()
    globals()[f'cmd_{a.cmd}'](a)


if __name__ == '__main__':
    main()
