"""Step 1: the base plate. Removes every element that becomes a live game object.
All coordinates are in the reference image (1344x756)."""
import cv2, numpy as np

rng = np.random.default_rng(7)
ref = cv2.imread('ref.png', cv2.IMREAD_COLOR)
H, W = ref.shape[:2]
hsv = cv2.cvtColor(ref, cv2.COLOR_BGR2HSV)
lum = cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY).astype(int)
B, G, R = [ref[:, :, i].astype(int) for i in range(3)]
sat = hsv[:, :, 1].astype(int)


def rect(m, x0, y0, x1, y1, sub=None):
    if sub is None:
        m[y0:y1, x0:x1] = 255
    else:
        m[y0:y1, x0:x1] = np.where(sub[y0:y1, x0:x1], 255, m[y0:y1, x0:x1])


def dil(m, r):
    return cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))


out = ref.copy()

# ---- 1. small detail holes (Telea) ----
det = np.zeros((H, W), np.uint8)
velvet = (R > G * 1.55) & (R > B * 1.4)
rect(det, 108, 632, 305, 706, ~velvet)                         # medals
paper_ink = (lum < 170) | ((R > G + 40) & (R > B + 40))
rect(det, 505, 492, 770, 551, paper_ink)                        # typed letters, hammer, ink
needle = np.zeros((H, W), np.uint8)
cv2.line(needle, (1226, 674), (1271, 631), 255, 9)
cv2.circle(needle, (1236, 665), 8, 255, -1)
det |= np.where((needle > 0) & (lum < 120), 255, 0).astype(np.uint8)  # gauge needle
rect(det, 1018, 628, 1182, 728, (lum < 110) & ~((R > G + 50)))  # note handwriting, keep the red pin
det = dil(det, 2)
# rack: fill each shelf's scroll band completely (empty shelves in shadow)
shelf = np.zeros((H, W), np.uint8)
for y0, y1 in [(84, 141), (148, 206), (212, 269), (266, 336), (340, 399), (404, 463), (468, 531), (534, 597)]:
    shelf[y0:y1, 1124:1306] = 255
shelf[:] = 0
shelf[262:346, 1098:1124] = 255                                  # flying scroll's tail over the rack post
out = cv2.inpaint(out, det, 6, cv2.INPAINT_TELEA)
for y0, y1 in [(84, 141), (148, 206), (212, 269), (276, 336), (340, 399), (404, 463), (468, 531), (534, 597)]:
    h = y1 - y0
    t = np.linspace(0, 1, h)[:, None]
    top, bot = np.array([18, 26, 40.0]), np.array([34, 52, 78.0])     # BGR: shadow under the board, warmer below
    band = top * (1 - t[..., None]) + bot * t[..., None]
    band = np.repeat(band, 182, axis=1)
    grain = cv2.GaussianBlur(rng.normal(0, 1, (h, 182)).astype(np.float32), (0, 0), sigmaX=14, sigmaY=0.8)
    band = band * (1 + grain[..., None] * 0.9)
    out[y0:y1, 1124:1306] = np.clip(band, 0, 255).astype(np.uint8)
post = cv2.inpaint(out, shelf & ~(np.zeros_like(shelf)), 4, cv2.INPAINT_TELEA)
out[262:346, 1098:1124] = post[262:346, 1098:1124]

# ---- 2. brass faces: drums and plates, rebuilt from their own colours ----
def brass_face(poly, light=125, shade_cols=False):
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.array(poly, np.int32)], 255)
    ys, xs = np.nonzero(m)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    face = ref[y0:y1 + 1, x0:x1 + 1].astype(float)
    mm = m[y0:y1 + 1, x0:x1 + 1] > 0
    L = lum[y0:y1 + 1, x0:x1 + 1]
    ok = mm & (L > light)
    rows = np.zeros((face.shape[0], 3))
    last = None
    for i in range(face.shape[0]):
        px = face[i][ok[i]]
        if len(px) >= 3:
            last = np.median(px, axis=0)
        rows[i] = last if last is not None else np.median(face[ok], axis=0)
    fill = np.repeat(rows[:, None, :], face.shape[1], axis=1)
    if shade_cols:
        cols = np.array([np.median(L[:, j][ok[:, j]]) if ok[:, j].sum() >= 3 else np.nan for j in range(face.shape[1])])
        cols = np.where(np.isnan(cols), np.nanmedian(cols), cols)
        cols = cv2.GaussianBlur(cols.reshape(1, -1).astype(np.float32), (0, 0), 2).ravel()
        fill *= (cols / np.nanmax(cols))[None, :, None] ** 0.7
    fill += rng.normal(0, 2.2, fill.shape)
    region = out[y0:y1 + 1, x0:x1 + 1]
    region[mm] = np.clip(fill[mm], 0, 255).astype(np.uint8)


# one shared drum surface, measured on the cleanest cell (the narrow "1")
cell = ref[80:161, 133:164].astype(float)
L1 = lum[80:161, 133:164]
ok1 = L1 > 140
rows1 = np.array([np.median(cell[i][ok1[i]], axis=0) if ok1[i].sum() >= 3 else np.median(cell[ok1], axis=0) for i in range(cell.shape[0])])
cols1 = np.array([np.median(L1[:, j][ok1[:, j]]) if ok1[:, j].sum() >= 3 else np.nan for j in range(cell.shape[1])])
cols1 = np.where(np.isnan(cols1), np.nanmedian(cols1), cols1)
cols1 = cols1 / cols1.max()
for x0, x1 in [(98, 129), (133, 163), (167, 195), (206, 236), (239, 269), (271, 304)]:
    w = x1 - x0
    prof = np.interp(np.linspace(0, len(cols1) - 1, w), np.arange(len(cols1)), cols1) ** 0.8
    blk = rows1[:, None, :] * prof[None, :, None] + rng.normal(0, 2, (81, w, 3))
    out[80:161, x0:x1] = np.clip(blk, 0, 255).astype(np.uint8)
# the comma's gap between the thousands drums: shadowed brass
gap = rows1[:, None, :] * 0.55 + rng.normal(0, 2, (81, 11, 3))
out[80:161, 195:206] = np.clip(gap, 0, 255).astype(np.uint8)
brass_face([(84, 183), (148, 183), (148, 202), (84, 202)])
brass_face([(165, 184), (235, 184), (235, 205), (165, 205)])
brass_face([(251, 187), (307, 187), (307, 208), (251, 208)])
brass_face([(108, 592), (262, 579), (266, 602), (113, 616)])

# ---- 3. the central sky: smooth nebula fill plus stars ----
sky = np.zeros((H, W), np.uint8)
for r in [(533, 80, 674, 146), (672, 138, 828, 212), (512, 174, 680, 242), (693, 213, 800, 272),
          (528, 260, 692, 312), (666, 303, 822, 354), (506, 322, 672, 410), (688, 328, 872, 459),
          (938, 266, 1100, 344)]:
    rect(sky, *r)
hole = dil(sky, 9) > 0
valid = (~hole).astype(np.float32)
valid[458:, 380:1000] = 0                     # never borrow from the typewriter
valid[(G > R + 30) & (G > B - 10)] = 0        # nor from the green wisps
valid[(R > B + 20)] = 0                       # nor from leftover flame glow
img = out.astype(np.float32)
def pullpush(im, w):
    """Membrane-like fill: pull known colours down a pyramid, push them back up into the holes."""
    if min(im.shape[:2]) < 4 or w.min() > 0.99:
        return im
    small_w = cv2.resize(w, (im.shape[1] // 2, im.shape[0] // 2), interpolation=cv2.INTER_AREA)
    small_i = cv2.resize(im * w[..., None], (im.shape[1] // 2, im.shape[0] // 2), interpolation=cv2.INTER_AREA)
    small_i = small_i / np.maximum(small_w, 1e-6)[..., None]
    coarse = pullpush(small_i, np.clip(small_w * 4, 0, 1))
    up = cv2.resize(coarse, (im.shape[1], im.shape[0]), interpolation=cv2.INTER_LINEAR)
    return im * w[..., None] + up * (1 - w[..., None])
fill = pullpush(img, valid)
# texture: fine painterly grain plus soft nebula mottling, matched to the intact sky
fine = cv2.GaussianBlur(rng.normal(0, 1, (H, W)).astype(np.float32), (0, 0), 1.1) * 9
blot = cv2.GaussianBlur(rng.normal(0, 1, (H, W)).astype(np.float32), (0, 0), 7) * 22
fill = fill + (fine + blot)[..., None] * np.array([1.0, 0.85, 0.9])
# a few new stars
for _ in range(70):
    x, y = int(rng.integers(500, 940)), int(rng.integers(70, 450))
    if hole[y, x]:
        r = float(rng.choice([0.6, 0.8, 1.1, 1.6], p=[0.45, 0.3, 0.17, 0.08]))
        cv2.circle(fill, (x, y), 1, (235, 225, 255), -1) if r > 1 else None
        fill[y, x] = np.maximum(fill[y, x], 200 + 40 * r)
soft = np.maximum(hole.astype(np.float32), cv2.GaussianBlur(hole.astype(np.float32), (0, 0), 5))[..., None]
out = np.clip(img * (1 - soft) + fill * soft, 0, 255).astype(np.uint8)

cv2.imwrite('plate_ref.png', out)
changed = (np.abs(out.astype(int) - ref.astype(int)).sum(-1) > 6).astype(np.uint8) * 255
cv2.imwrite('changed.png', cv2.dilate(changed, np.ones((3, 3), np.uint8)))
print('done')
