"""Step 2: cut game sprites from the reference and write every layer at 1920x1080 scale.
Writes PNG/JPG assets plus keyart.json (positions in 1920-space)."""
import cv2, json, os, numpy as np

OUT = 'out'
os.makedirs(OUT, exist_ok=True)
K = 1920 / 1344
ref = cv2.imread('ref.png', cv2.IMREAD_COLOR)
plate = cv2.imread('plate_ref.png', cv2.IMREAD_COLOR)
H, W = ref.shape[:2]
hsv = cv2.cvtColor(ref, cv2.COLOR_BGR2HSV)
lum = cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY).astype(int)
B, G, R = [ref[:, :, i].astype(int) for i in range(3)]
sat = hsv[:, :, 1].astype(int)
manifest = {'scale': K, 'sprites': {}}
# The owner's full-resolution painting (4x the reference): every pixel we keep comes from it.
HI = cv2.resize(cv2.imread('ref_hi.png', cv2.IMREAD_COLOR), (1920, 1080), interpolation=cv2.INTER_AREA)
CHANGED = cv2.imread('changed.png', cv2.IMREAD_GRAYSCALE)


def hi_crop(x0, y0, shape):
    X, Y = round(x0 * K), round(y0 * K)
    c = HI[Y:Y + shape[0], X:X + shape[1]]
    if c.shape[:2] != shape[:2]:
        c = cv2.resize(HI[Y:Y + round(shape[0]) + 2, X:X + round(shape[1]) + 2], (shape[1], shape[0]))
    return c


def detail(bgr, x0, y0):
    """Upscaled working crop, with every untouched pixel replaced by the full-resolution painting."""
    big = sharpen(up(bgr))
    orig = ref[y0:y0 + bgr.shape[0], x0:x0 + bgr.shape[1]]
    touched = (np.abs(bgr.astype(int) - orig.astype(int)).sum(-1) > 6).astype(np.float32) if orig.shape == bgr.shape else np.ones(bgr.shape[:2], np.float32)
    m = cv2.GaussianBlur(cv2.resize(touched, (big.shape[1], big.shape[0])), (0, 0), 1.5)[..., None]
    return np.clip(hi_crop(x0, y0, big.shape) * (1 - m) + big * m, 0, 255).astype(np.uint8)


def up(img, interp=cv2.INTER_LANCZOS4):
    h, w = img.shape[:2]
    return cv2.resize(img, (max(1, round(w * K)), max(1, round(h * K))), interpolation=interp)


def sharpen(img):
    blur = cv2.GaussianBlur(img, (0, 0), 1.2)
    return cv2.addWeighted(img, 1.35, blur, -0.35, 0)


def save_rgba(name, bgr, alpha, x0, y0, extra=None):
    """bgr/alpha are crops at reference scale whose top-left is (x0, y0)."""
    a = cv2.GaussianBlur(alpha.astype(np.float32), (0, 0), 0.6)
    rgba = np.dstack([detail(bgr, x0, y0), np.clip(up(a), 0, 255).astype(np.uint8)])
    cv2.imwrite(f'{OUT}/{name}.png', rgba)
    info = {'x': round(x0 * K, 1), 'y': round(y0 * K, 1), 'w': rgba.shape[1], 'h': rgba.shape[0]}
    if extra:
        info.update(extra)
    manifest['sprites'][name] = info
    return info


def grabcut(x0, y0, x1, y1, iters=6, sure_fg=None):
    mask = np.zeros((H, W), np.uint8)
    rect = (x0, y0, x1 - x0, y1 - y0)
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    if sure_fg is not None:
        mask[:] = cv2.GC_BGD
        mask[y0:y1, x0:x1] = cv2.GC_PR_BGD
        mask[sure_fg > 0] = cv2.GC_FGD
        cv2.grabCut(ref, mask, None, bgd, fgd, iters, cv2.GC_INIT_WITH_MASK)
    else:
        cv2.grabCut(ref, mask, rect, bgd, fgd, iters, cv2.GC_INIT_WITH_RECT)
    fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    return largest(fg[y0:y1, x0:x1])


def largest(m, keep=1):
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m)
    if n <= 1:
        return m
    order = np.argsort(-stats[1:, cv2.CC_STAT_AREA])[:keep] + 1
    out = np.isin(lab, order).astype(np.uint8) * 255
    return fill_holes(out)


def fill_holes(m):
    h, w = m.shape
    ff = np.zeros((h + 2, w + 2), np.uint8)
    ff[1:-1, 1:-1] = m
    pad = np.zeros((h + 4, w + 4), np.uint8)
    cv2.floodFill(ff, pad, (0, 0), 255)   # background reachable from any edge
    return m | cv2.bitwise_not(ff[1:-1, 1:-1])


def close(m, r):
    return cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))


# ── full layers ──
cm = cv2.GaussianBlur(cv2.resize(CHANGED, (1920, 1080)).astype(np.float32) / 255, (0, 0), 2)[..., None]
PLATE = np.clip(HI * (1 - cm) + sharpen(up(plate)) * cm, 0, 255).astype(np.uint8)
cv2.imwrite(f'{OUT}/plate.jpg', PLATE, [cv2.IMWRITE_JPEG_QUALITY, 90])
# foreground: everything below the paper's top edge, plus the carriage posts
fg = np.zeros((H, W), np.uint8)
fg[461:, :] = 255
fg[440:461, 424:448] = 255
fg[438:461, 893:915] = 255
front = np.dstack([PLATE, up(fg, cv2.INTER_LINEAR)])[620:]
cv2.imwrite(f'{OUT}/front.webp', front, [cv2.IMWRITE_WEBP_QUALITY, 92])
manifest['sprites']['front'] = {'x': 0, 'y': 620, 'w': 1920, 'h': 460}

# ── the rune arch (tintable glow) and Rush wisps ──
arch = np.zeros((H, W), np.uint8)
cyan = np.clip((np.minimum(G, B) - R - 18) * 3.2, 0, 255) * (lum > 105)
region = np.zeros((H, W), bool)
region[12:462, 412:1008] = True
region[75:462, 492:930] = False
region[60:120, 600:830] = False  # crest
arch = np.where(region, cyan, 0).astype(np.uint8)
glow = np.dstack([np.full((H, W, 3), 255, np.uint8), arch])[0:462, 412:1008]
cv2.imwrite(f'{OUT}/arch.png', np.dstack([np.full((round(462 * K), round(596 * K), 3), 255, np.uint8), cv2.resize(glow[..., 3], (round(596 * K), round(462 * K)))]))
manifest['sprites']['arch'] = {'x': round(412 * K, 1), 'y': 0, 'w': round(596 * K), 'h': round(462 * K)}
wisp = np.zeros((H, W), np.float32)
for (x0, y0, x1, y1) in [(392, 175, 488, 462), (858, 175, 965, 462), (185, 225, 262, 300)]:
    g = np.clip((G - np.maximum(R, B) - 12) * 3.0, 0, 255)
    wisp[y0:y1, x0:x1] = g[y0:y1, x0:x1]
crop = ref[175:462, 185:965]
wa = up(wisp[175:462, 185:965].astype(np.uint8))
cv2.imwrite(f'{OUT}/wisps.webp', np.dstack([hi_crop(185, 175, wa.shape), wa]), [cv2.IMWRITE_WEBP_QUALITY, 90])
manifest['sprites']['wisps'] = {'x': round(185 * K, 1), 'y': round(175 * K, 1), 'w': round(780 * K), 'h': round(287 * K)}

# ── characters ──
x0, y0, x1, y1 = 940, 14, 1106, 244
sure = np.zeros((H, W), np.uint8)
for poly in [[(1040, 30), (1052, 60), (1066, 92), (1012, 96), (1030, 60)],            # hat
             [(990, 98), (1060, 96), (1084, 140), (1086, 196), (976, 198), (972, 140)],  # face, beard, robes
             [(962, 204), (1096, 204), (1096, 228), (962, 228)]]:                       # cloud
    cv2.fillPoly(sure, [np.array(poly, np.int32)], 255)
wm = grabcut(x0, y0, x1, y1, iters=8, sure_fg=sure)
outer = np.zeros((H, W), np.uint8)
cv2.fillPoly(outer, [np.array([(1034, 16), (1062, 70), (1080, 92), (1090, 112), (1092, 196), (1106, 206), (1106, 244), (940, 244), (940, 196), (958, 184), (964, 104), (1004, 92), (1024, 40)], np.int32)], 255)
wm &= outer[y0:y1, x0:x1]
save_rgba('wizard', ref[y0:y1, x0:x1], largest(wm), x0, y0)
for name, (x0, y0, x1, y1) in {'hand_l': (428, 596, 616, 756), 'hand_r': (726, 596, 942, 756)}.items():
    skin = (R > 140) & (R - B > 50) & (R - B < 120) & (G - B < 55)
    sleeve = (B > R + 10) & (B > 60) & (lum < 125)
    keyish = ((R - B < 45) & (lum > 140)) | ((G - B > 60) & (R > 120)) | (lum < 45)
    gc = np.full((H, W), cv2.GC_BGD, np.uint8)
    gc[y0:y1, x0:x1] = cv2.GC_PR_BGD
    sk = cv2.erode(((skin | sleeve) & ~keyish).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    gc[y0:y1, x0:x1][((skin | sleeve) & ~keyish)[y0:y1, x0:x1]] = cv2.GC_PR_FGD
    gc[y0:y1, x0:x1][sk[y0:y1, x0:x1]] = cv2.GC_FGD
    gc[y0:y1, x0:x1][cv2.erode(keyish.astype(np.uint8), np.ones((3, 3), np.uint8))[y0:y1, x0:x1] > 0] = cv2.GC_BGD
    bgd, fgd = np.zeros((1, 65)), np.zeros((1, 65))
    cv2.grabCut(ref, gc, None, bgd, fgd, 8, cv2.GC_INIT_WITH_MASK)
    m = largest(np.where((gc == 1) | (gc == 3), 255, 0).astype(np.uint8)[y0:y1, x0:x1])
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    save_rgba(name, ref[y0:y1, x0:x1], m, x0, y0)

# ── medals (by tier: silver 1, gold 2, star-and-ribbon 3) ──
velvet = (R > G * 1.55) & (R > B * 1.4)
for name, (x0, y0, x1, y1) in {'medal_3': (110, 640, 180, 708), 'medal_2': (178, 624, 244, 694), 'medal_1': (238, 620, 304, 692)}.items():
    m = np.where(~velvet[y0:y1, x0:x1] & (lum[y0:y1, x0:x1] > 45), 255, 0).astype(np.uint8)
    m = largest(cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)))
    save_rgba(name, ref[y0:y1, x0:x1], m, x0, y0)

# ── the spell shelf: eight rolled scrolls in game order ──
SHELVES = [('slow', 86, 142), ('fire', 148, 207), ('ice', 212, 270), ('barrier', 276, 337),
           ('shock', 340, 400), ('alter', 404, 465), ('wind', 468, 532), ('harvest', 534, 598)]
X0, X1 = 1126, 1306
rack_info = {}
for sid, y0, y1 in SHELVES:
    crop = ref[y0:y1, X0:X1].copy()
    s = sat[y0:y1, X0:X1]
    l = lum[y0:y1, X0:X1]
    text = ((l > 165) & (s < 80)).astype(np.uint8) * 255
    text[:, :130] = 0
    body = ((s > 55) & (l > 45)).astype(np.uint8) * 255
    board = (l < 135) & (hsv[y0:y1, X0:X1, 0] < 22) & (s > 60)
    board[: max(0, (y1 - y0) - 12), :] = False
    m = largest(close((body & ~board) | text, 3))
    m[:, 172:] = 0
    crop = cv2.inpaint(crop, cv2.dilate(text, np.ones((3, 3), np.uint8)), 3, cv2.INPAINT_TELEA)
    rack_info[sid] = (crop, m, y0)
# Barrier's scroll is hidden behind the flying scroll in the painting: rebuild it from Ice's, in lavender.
ice_crop, ice_m, _ = rack_info['ice']
hsv_i = cv2.cvtColor(ice_crop, cv2.COLOR_BGR2HSV).astype(np.float32)
lav = ref[300:325, 1215:1260].reshape(-1, 3)
lav_h = cv2.cvtColor(lav[None].astype(np.uint8), cv2.COLOR_BGR2HSV)[0]
target_h = float(np.median(lav_h[:, 0]))
hsv_i[..., 0] = np.where(hsv_i[..., 1] > 40, target_h, hsv_i[..., 0])
hsv_i[..., 1] *= 0.55
barrier = cv2.cvtColor(hsv_i.astype(np.uint8), cv2.COLOR_HSV2BGR)
rack_info['barrier'] = (barrier, ice_m, 276 + 4)
for sid, (crop, m, y0) in rack_info.items():
    if sid != 'barrier':
        save_rgba(f'rack_{sid}', crop, m, X0, y0)
# Barrier at full resolution: Ice's painted scroll, recoloured to the shelf's lavender
ice_y0 = rack_info['ice'][2]
big = detail(rack_info['ice'][0], X0, ice_y0)
hb = cv2.cvtColor(big, cv2.COLOR_BGR2HSV).astype(np.float32)
hb[..., 0] = np.where(hb[..., 1] > 40, target_h, hb[..., 0])
hb[..., 1] *= 0.55
alpha = np.clip(up(cv2.GaussianBlur(ice_m.astype(np.float32), (0, 0), 0.6)), 0, 255).astype(np.uint8)
cv2.imwrite(f'{OUT}/rack_barrier.png', np.dstack([cv2.cvtColor(hb.astype(np.uint8), cv2.COLOR_HSV2BGR), alpha]))
manifest['sprites']['rack_barrier'] = {'x': round(X0 * K, 1), 'y': round((276 + 4) * K, 1), 'w': big.shape[1], 'h': big.shape[0]}
manifest['rackCount'] = {sid: [round(1286 * K, 1), round(((y0 + y1) / 2 + 6) * K, 1)] for sid, y0, y1 in SHELVES}

# ── falling scroll templates (text removed) ──
def scroll_template(name, x0, y0, x1, y1, cap_l, cap_r, text_lum=95):
    crop = ref[y0:y1, x0:x1].copy()
    l = lum[y0:y1, x0:x1]
    m = grabcut(x0, y0, x1, y1, iters=8)
    inner = np.zeros_like(m)
    inner[:, cap_l:(x1 - x0) - cap_r] = 255
    txt = ((l < text_lum) & (m > 0) & (inner > 0)).astype(np.uint8) * 255
    txt = cv2.dilate(txt, np.ones((3, 3), np.uint8), iterations=1)
    crop = cv2.inpaint(crop, txt, 4, cv2.INPAINT_TELEA)
    mid = slice(cap_l, (x1 - x0) - cap_r)
    body = crop[:, mid].astype(np.float32)
    ok = (txt[:, mid] == 0) & (m[:, mid] > 0)
    rows = np.array([np.median(body[i][ok[i]], axis=0) if ok[i].sum() > 4 else body[i].mean(0) for i in range(body.shape[0])])
    arow = np.median(m[:, mid], axis=1)
    n = body.shape[1]
    wob = cv2.GaussianBlur(np.random.default_rng(3).normal(0, 1, (body.shape[0], n)).astype(np.float32), (0, 0), sigmaX=6, sigmaY=1.2)
    crop[:, mid] = np.clip(rows[:, None, :] * (1 + wob[..., None] * 0.05), 0, 255).astype(np.uint8)
    m[:, mid] = arow[:, None]
    save_rgba(name, crop, m, x0, y0, {'capL': round(cap_l * K), 'capR': round(cap_r * K)})


scroll_template('scroll_plain', 531, 263, 691, 310, 22, 22)

# a flame from FIREBALL's rolled end, for Fire scrolls
x0, y0, x1, y1 = 532, 76, 584, 132
fl = ((R > 200) & (G > 90) & (B < 150) & (R > B + 80) & (sat > 120) & (lum > 125))[y0:y1, x0:x1].astype(np.uint8) * 255
fl[40:, :] = 0  # nothing below the roll's top: that's the scroll
save_rgba('flame', ref[y0:y1, x0:x1], largest(close(fl, 2)), x0, y0)

# the red CATCH! stamp
x0, y0, x1, y1 = 780, 420, 866, 462
save_rgba('catch', ref[y0:y1, x0:x1], grabcut(x0, y0, x1, y1, iters=8), x0, y0)

# typebar hammer, pivoting on its arm
x0, y0, x1, y1 = 698, 486, 756, 548
hm = ((lum < 105)[y0:y1, x0:x1]).astype(np.uint8) * 255
hm = largest(close(hm, 2))
save_rgba('hammer', ref[y0:y1, x0:x1], hm, x0, y0, {'pivotX': round((748 - x0) * K), 'pivotY': round((544 - y0) * K)})

# gauge needle (pivot at the hub)
x0, y0, x1, y1 = 1218, 628, 1274, 684
nd = np.zeros((y1 - y0, x1 - x0), np.uint8)
cv2.line(nd, (1226 - x0, 674 - y0), (1271 - x0, 631 - y0), 255, 7)
cv2.circle(nd, (1236 - x0, 665 - y0), 7, 255, -1)
nd = np.where((nd > 0) & (lum[y0:y1, x0:x1] < 115), 255, 0).astype(np.uint8)
save_rgba('needle', ref[y0:y1, x0:x1], largest(close(nd, 1)), x0, y0, {'pivotX': round((1236 - x0) * K), 'pivotY': round((665 - y0) * K)})
manifest['gauge'] = {'x': round(1236 * K, 1), 'y': round(665 * K, 1), 'from': -125, 'to': 135, 'r': round(46 * K)}

# gear (fully visible one)
cx, cy, r = 52, 363, 25
x0, y0 = cx - r, cy - r
gm = np.zeros((2 * r, 2 * r), np.uint8)
cv2.circle(gm, (r, r), r - 1, 255, -1)
save_rgba('gear', ref[y0:y0 + 2 * r, x0:x0 + 2 * r], gm, x0, y0)

# tubes: painted empty glass and painted liquid, tiled vertically in game
def tile_src(name, x0, x1, y0, y1):
    crop = ref[y0:y1, x0:x1]
    cv2.imwrite(f'{OUT}/{name}.png', hi_crop(x0, y0, up(crop).shape))
    manifest['sprites'][name] = {'w': round((x1 - x0) * K), 'h': round((y1 - y0) * K)}

tile_src('combo_empty', 106, 165, 300, 385)
tile_src('combo_liquid', 106, 165, 405, 515)
tile_src('combo_surface', 106, 165, 390, 404)
tile_src('rush_liquid', 194, 252, 395, 515)
# Rush's empty glass: the painted liquid drained to dim green glass
gl = hi_crop(194, 395, up(ref[395:515, 194:252]).shape).astype(np.float32)
gh = cv2.cvtColor(gl.astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
gh[..., 1] *= 0.35
gh[..., 2] = gh[..., 2] * 0.32 + 18
cv2.imwrite(f'{OUT}/rush_empty.png', cv2.cvtColor(gh.astype(np.uint8), cv2.COLOR_HSV2BGR))
manifest['sprites']['rush_empty'] = manifest['sprites']['rush_liquid'].copy()
band = ref[370:393, 190:256]
save_rgba('rush_band', band, np.full(band.shape[:2], 255, np.uint8), 190, 370)
manifest['tubes'] = {
    'combo': {'x': round(106 * K, 1), 'top': round(290 * K, 1), 'bottom': round(522 * K, 1), 'w': round(59 * K)},
    'rush': {'x': round(194 * K, 1), 'top': round(285 * K, 1), 'bottom': round(519 * K, 1), 'w': round(58 * K), 'band': [round(370 * K, 1), round(393 * K, 1)]},
}

# ── coordinates for live elements ──
P = lambda x, y: [round(x * K, 1), round(y * K, 1)]
manifest['drums'] = {'y': round(121 * K, 1), 'top': round(80 * K, 1), 'bottom': round(160 * K, 1),
                     'cells': [[round(a * K, 1), round(b * K, 1)] for a, b in [(98, 129), (133, 163), (167, 195), (206, 236), (239, 269), (271, 304)]],
                     'comma': P(200, 141)}
manifest['plates'] = {'base': P(116, 192.5), 'combo': P(200, 194.5), 'rush': P(279, 197.5), 'level': P(187, 597), 'levelAngle': -5}
manifest['tray'] = [P(145, 672), P(210, 657), P(271, 652)]
manifest['paper'] = {'strikeX': round(703 * K, 1), 'baseline': round(532 * K, 1), 'left': round(500 * K, 1), 'right': round(858 * K, 1), 'top': round(463 * K, 1), 'bottom': round(551 * K, 1)}
rows = {'qwertyuiop': (595, 500, 38.3), 'asdfghjkl': (631, 487, 37.75), 'zxcvbnm': (665, 499, 38.8)}
manifest['keys'] = {ch: P(x0 + i * gap, y) for row, (y, x0, gap) in rows.items() for i, ch in enumerate(row)}
manifest['note'] = {'x': round(1100 * K, 1), 'y': round(672 * K, 1), 'angle': 7, 'w': round(150 * K)}
manifest['candles'] = [P(300, 455), P(1072, 464)]
manifest['steam'] = {'vent': P(300, 280), 'cup': P(1003, 152), 'pipe': P(976, 120)}
manifest['field'] = {'x': 610, 'y': 60, 'w': 940, 'h': 595}
json.dump(manifest, open(f'{OUT}/keyart.json', 'w'), indent=1)
print('sprites:', len(manifest['sprites']))
