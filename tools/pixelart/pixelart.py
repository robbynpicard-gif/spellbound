"""Wizzy Type pixel art (decisions.md D-028).

Everything is drawn at 1x on a 320x180 grid with a limited, gritty palette;
the game scales it up 4x with nearest-neighbour filtering. Run build.py to
regenerate the PNGs in public/assets/. Needs Python 3 and Pillow.
"""
from PIL import Image, ImageDraw
import random, math, json

# ── Palette: 16-bit night + gold + parchment ───────────────────────────────
P = dict(
    void=(10,9,8), night0=(20,18,16), night1=(32,28,24), night2=(48,42,34), night3=(66,56,44),
    haze=(92,80,62), star=(170,160,130), moon=(196,178,128), moon2=(150,132,92), moonhalo=(70,60,42),
    hill0=(16,15,13), hill1=(26,24,20), hill2=(38,34,28),
    gold=(170,128,52), gold2=(214,170,84), brass=(128,92,46), brass2=(78,56,30), brass3=(168,128,70),
    parch=(196,176,130), parch2=(160,136,94), parch3=(112,90,58), ink=(30,22,16),
    stone0=(22,20,19), stone1=(40,37,33), stone2=(54,49,43),
    wood0=(26,18,13), wood1=(48,33,23), wood2=(70,48,31), wood3=(94,66,42),
    floorA=(58,44,32), floorB=(42,32,24), floorC=(76,58,40),
    robe0=(30,26,34), robe1=(52,44,58), robe2=(76,64,82), hat=(58,48,64),
    skin=(178,140,104), skin2=(136,102,74), beard=(170,164,150), beard2=(120,114,102),
    arcane=(122,96,150), arcane2=(156,132,178), ward=(150,120,170),
    green=(120,160,70), green2=(70,96,44), red=(150,56,40), teal=(76,120,110),
    candle=(222,198,140), flame=(240,160,60), flame2=(200,90,34),
    ice=(110,170,190), fire=(206,98,46), shield=(140,150,180), light=(214,196,104), alter=(186,120,140), wind=(110,160,130), harvest=(196,160,86),
    rust=(110,58,30), rust2=(150,82,40), iron=(58,56,52), iron2=(84,80,72), iron3=(116,110,98),
    amber=(214,160,64), grime=(14,12,10),
    white=(230,220,196), black=(0,0,0),
)
SPELL = dict(slow=P['arcane'], ice=P['ice'], barrier=P['shield'], shock=P['light'], alter=P['alter'], fire=P['fire'], wind=P['wind'], harvest=P['harvest'])

W, H = 320, 180
BAYER = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]]

class Canvas:
    def __init__(s, w=W, h=H, bg=P['void']):
        s.im = Image.new('RGB', (w, h), bg); s.px = s.im.load(); s.w, s.h = w, h
    def p(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.px[int(x), int(y)] = c
    def rect(s, x0, y0, x1, y1, c):  # inclusive
        for y in range(int(y0), int(y1)+1):
            for x in range(int(x0), int(x1)+1): s.p(x, y, c)
    def hline(s, x0, x1, y, c): s.rect(x0, y, x1, y, c)
    def vline(s, x, y0, y1, c): s.rect(x, y0, x, y1, c)
    def blend(s, x, y, c, a):
        if 0 <= x < s.w and 0 <= y < s.h:
            o = s.px[int(x), int(y)]; s.px[int(x), int(y)] = tuple(int(o[i]*(1-a)+c[i]*a) for i in range(3))
    def disc(s, cx, cy, r, c):
        for y in range(int(cy-r), int(cy+r)+1):
            for x in range(int(cx-r), int(cx+r)+1):
                if (x-cx)**2+(y-cy)**2 <= r*r+0.5: s.p(x, y, c)
    def glow(s, cx, cy, r, c, strength=0.5):
        """Dithered radial glow (no smooth gradients: stays pixel-honest)."""
        for y in range(int(cy-r), int(cy+r)+1):
            for x in range(int(cx-r), int(cx+r)+1):
                d = math.hypot(x-cx, y-cy)/r
                if d < 1:
                    a = (1-d)**2*strength
                    if a*16 > BAYER[y%4][x%4]*0.9: s.blend(x, y, c, min(0.55, a+0.15))
    def sprite(s, x, y, rows, pal):
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != '.' and ch in pal: s.p(x+i, y+j, pal[ch])
    def grit(s, x0, y0, x1, y1, amount=0.12, seed=1, dark=None):
        """Per-pixel noise and soot: worn, dirty surfaces."""
        rnd = random.Random(seed); dark = dark or P['grime']
        for y in range(int(y0), int(y1)+1):
            for x in range(int(x0), int(x1)+1):
                r = rnd.random()
                if r < amount: s.blend(x, y, dark, 0.35 + rnd.random()*0.3)
                elif r > 1-amount*0.35: s.blend(x, y, (255, 240, 210), 0.06)
    def vignette(s, strength=0.75):
        cx, cy = s.w/2, s.h*0.55
        for y in range(s.h):
            for x in range(s.w):
                d = math.hypot((x-cx)/(s.w*0.62), (y-cy)/(s.h*0.72))
                if d > 0.55:
                    a = min(1, (d-0.55)/0.55)*strength
                    if a*16 > BAYER[y%4][x%4]*0.6: s.blend(x, y, P['void'], min(0.8, a))
    def save(s, path, scale=4):
        s.im.resize((s.w*scale, s.h*scale), Image.NEAREST).save(path)

def dither_band(c, y0, y1, top, bottom, x0=0, x1=W-1):
    """Vertical gradient between two palette colours using a 4x4 ordered dither."""
    for y in range(y0, y1+1):
        t = (y-y0)/max(1, y1-y0)
        for x in range(x0, x1+1):
            c.p(x, y, bottom if t*16 > BAYER[y%4][x%4] else top)

# ── Chapter scenery ────────────────────────────────────────────────────────
CHAPTERS = {
    1: dict(name='The Apprentice\'s Tower', sky=[(10,9,8),(22,19,16),(40,33,26),(68,54,38)], hill=[P['hill0'], P['hill1'], P['hill2']], accent=P['moon']),
    2: dict(name='The Sunken Library', sky=[(8,12,10),(14,22,18),(22,34,28),(36,50,40)], hill=[(10,14,12),(16,24,20),(24,34,28)], accent=(120,150,110)),
    3: dict(name='The Alchemist\'s Vault', sky=[(14,9,6),(30,16,10),(52,26,14),(80,40,18)], hill=[(20,12,8),(34,18,10),(50,26,14)], accent=(230,140,50)),
    4: dict(name='The Storm Spire', sky=[(9,9,10),(18,18,20),(30,30,32),(46,44,44)], hill=[(12,12,13),(20,20,22),(30,30,32)], accent=(200,200,180)),
}

def sky(c, ch, top=0, bottom=127, seed=3):
    s = CHAPTERS[ch]['sky']; n = len(s)-1; span = (bottom-top)/n
    for i in range(n): dither_band(c, int(top+i*span), int(top+(i+1)*span), s[i], s[i+1], 0, c.w-1)
    rnd = random.Random(seed)
    if ch in (1, 4):
        for _ in range(int(c.w*0.28)):
            x, y = rnd.randrange(c.w), rnd.randrange(top, int(bottom*0.7))
            c.p(x, y, P['star'] if rnd.random() < 0.35 else P['haze'])
        for _ in range(6):  # twinkles
            x, y = rnd.randrange(8, c.w-8), rnd.randrange(top+4, int(bottom*0.55))
            c.p(x, y, P['white']); [c.p(x+dx, y+dy, P['star']) for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))]

def moon(c, x, y, r=10):
    c.glow(x, y, r*2.6, P['moonhalo'], 0.8)
    c.disc(x, y, r, P['moon'])
    for dx, dy, rr in ((-3,-2,2),(3,3,1.5),(1,-5,1),(-4,4,1)): c.disc(x+dx, y+dy, rr, P['moon2'])
    for yy in range(int(y-r), int(y+r)+1):  # shade the right limb
        for xx in range(int(x+r*0.4), int(x+r)+1):
            if (xx-x)**2+(yy-y)**2 <= r*r and BAYER[yy%4][xx%4] < 8: c.p(xx, yy, P['moon2'])

def ridge(c, base, amp, color, seed, step=1, rough=0.35):
    rnd = random.Random(seed); y = base; heights = []
    for x in range(c.w):
        y += rnd.uniform(-rough, rough) + (base - y)*0.02 + math.sin(x/37+seed)*amp*0.04
        heights.append(y)
        c.vline(x, int(y), 127, color)
    return heights

def tower_silhouette(c, x, ground, color, lit):
    c.rect(x-3, ground-34, x+3, ground, color)          # shaft
    c.rect(x-5, ground-38, x+5, ground-34, color)       # parapet
    for i in range(-5, 6, 2): c.p(x+i, ground-39, color)
    for i in range(9):  # cone roof
        c.hline(x-4+i//2, x+4-i//2, ground-40-i, color)
    c.p(x, ground-50, lit)
    c.rect(x-1, ground-28, x, ground-26, lit); c.glow(x, ground-27, 6, lit, 0.5)

def scenery(c, ch):
    sky(c, ch)
    h = CHAPTERS[ch]['hill']
    if ch == 1:
        moon(c, 262, 28)
        for cx, cy, w in ((60,40,46),(190,22,38),(120,62,30)):  # thin cloud wisps
            for i in range(w): 
                if BAYER[cy%4][i%4] < 10: c.p(cx+i, cy+ (1 if i%9<4 else 0), P['night3'])
        ridge(c, 100, 8, h[0], 2); tower_silhouette(c, 74, 104, h[0], P['gold2'])
        ridge(c, 110, 6, h[1], 5); ridge(c, 119, 4, h[2], 9)
    elif ch == 2:  # underwater library: light shafts, drowned shelves, bubbles
        for sx in (40, 120, 230, 290):
            for y in range(0, 110):
                for x in range(sx-6+y//8, sx+2+y//8):
                    if BAYER[y%4][x%4] < 3: c.blend(x, y, CHAPTERS[2]['accent'], 0.25)
        for bx in range(0, c.w, 34):  # sunken bookcase silhouettes
            top = 70 + (bx*7) % 18
            c.rect(bx+4, top, bx+26, 127, h[1])
            for sy in range(top+6, 127, 9): c.hline(bx+5, bx+25, sy, h[0])
        rnd = random.Random(4)
        for _ in range(28):
            x, y = rnd.randrange(c.w), rnd.randrange(10, 120); c.p(x, y, CHAPTERS[2]['accent']); c.p(x+1, y-1, (60,140,150))
        ridge(c, 121, 2, h[2], 7)
    elif ch == 3:  # alchemist's vault: arches, pipes, glowing vats
        for ax in range(-10, c.w, 70):
            for y in range(20, 128):
                half = 30 if y > 50 else int(math.sqrt(max(0, 900-(50-y)**2*1.0)))
                c.hline(ax+35-half, ax+35-half+3, y, h[1]); c.hline(ax+35+half-3, ax+35+half, y, h[1])
        for py in (34, 58): c.rect(0, py, c.w-1, py+2, P['brass2']); [c.rect(x, py-1, x+2, py+3, P['brass']) for x in range(10, c.w, 40)]
        for vx in (40, 150, 260):
            c.rect(vx-14, 96, vx+14, 127, h[0]); c.rect(vx-12, 100, vx+12, 106, (255,140,50)); c.glow(vx, 102, 22, (255,150,60), 0.5)
    elif ch == 4:  # storm spire: dark clouds, lightning, rain
        rnd = random.Random(11)
        for _ in range(9):
            cx, cy = rnd.randrange(c.w), rnd.randrange(6, 50)
            for i in range(-26, 27):
                for j in range(-6, 7):
                    if i*i/700 + j*j/40 < 1 and BAYER[(cy+j)%4][(cx+i)%4] < 12: c.p(cx+i, cy+j, CHAPTERS[4]['sky'][2])
        x, y = 210, 20
        while y < 100:  # lightning bolt
            nx = x + rnd.choice((-3,-2,2,3)); 
            for t in range(6): c.p(int(x+(nx-x)*t/6), y+t, P['white']); c.p(int(x+(nx-x)*t/6)+1, y+t, CHAPTERS[4]['accent'])
            x, y = nx, y+6
        c.glow(210, 50, 40, CHAPTERS[4]['accent'], 0.35)
        for _ in range(140):
            x, y = rnd.randrange(c.w), rnd.randrange(0, 125); c.p(x, y, CHAPTERS[4]['sky'][3]); c.p(x-1, y+1, CHAPTERS[4]['sky'][3])
        ridge(c, 104, 10, h[1], 3); tower_silhouette(c, 160, 110, h[0], CHAPTERS[4]['accent'])

def ward_line(c, y=126):
    for x in range(c.w):
        c.p(x, y, P['ward']); c.blend(x, y-1, P['arcane'], 0.5); c.blend(x, y-2, P['arcane'], 0.25)
    for x in range(6, c.w, 18):  # rune ticks
        c.p(x, y-3, P['arcane2']); c.p(x+1, y-4, P['arcane2']); c.p(x+2, y-3, P['arcane2'])

# ── The study (bottom strip, 3/4 isometric) ────────────────────────────────
def iso_floor(c, y0=146, y1=179):
    for y in range(y0, y1+1):
        for x in range(c.w):
            u = (x + 2*(y-y0)) // 16; v = (x - 2*(y-y0)) // 16
            col = P['floorA'] if (u+v) % 2 == 0 else P['floorB']
            if (x + 2*(y-y0)) % 16 == 0 or (x - 2*(y-y0)) % 16 == 0: col = P['wood0']
            c.p(x, y, col)
    c.hline(0, c.w-1, y0, P['wood3'])

def back_wall(c, y0=127, y1=145):
    for y in range(y0, y1+1):
        for x in range(c.w):
            row = (y-y0)//5; off = 6 if row % 2 else 0
            mortar = (y-y0) % 5 == 4 or (x+off) % 12 == 0
            c.p(x, y, P['stone0'] if mortar else (P['stone1'] if (x//12+row) % 3 else P['stone2']))
    c.hline(0, c.w-1, y1+1, P['wood1'])

def iso_box(c, x, y, w, h, d, top, front, side):
    """Box in 3/4 view: front face w x h at (x,y); depth d rises up-right (2:1)."""
    for i in range(d):
        c.hline(x+i*2//2+i, x+w-1+i, y-1-i, top) if False else None
    for i in range(d):  # top face (parallelogram)
        c.hline(x+i, x+w-1+i, y-1-i, top)
    c.rect(x, y, x+w-1, y+h-1, front)
    for i in range(d):  # side face
        c.vline(x+w+i, y-i, y+h-1-i, side)

def bookcase(c, x, y, w, h, flip=False):
    iso_box(c, x, y, w, h, 4, P['wood3'], P['wood1'], P['wood0'])
    rnd = random.Random(x)
    for sy in range(y+3, y+h-3, 9):
        c.rect(x+2, sy, x+w-3, sy+6, P['wood0'])
        c.hline(x+1, x+w-2, sy+7, P['wood2'])
        bx = x+3
        while bx < x+w-5:
            kind = rnd.random()
            if kind < 0.55:  # stacked scroll ends (circles)
                c.rect(bx, sy+3, bx+2, sy+5, P['parch2']); c.p(bx+1, sy+4, P['parch3'])
                c.rect(bx+1, sy+1, bx+3, sy+3, P['parch']); c.p(bx+2, sy+2, P['parch3']); bx += 5
            elif kind < 0.85:  # book spines
                col = rnd.choice([P['red'], P['robe1'], P['green2'], P['brass2'], P['teal']])
                hh = rnd.randint(4, 6); c.rect(bx, sy+7-hh, bx+1, sy+6, col); c.p(bx, sy+7-hh+1, P['gold']); bx += 3
            else:  # potion
                col = rnd.choice([P['green'], P['arcane'], P['red'], P['ice']])
                c.rect(bx, sy+3, bx+2, sy+6, col); c.p(bx+1, sy+2, P['parch2']); c.p(bx, sy+4, P['white']); bx += 4

def candle(c, x, y):
    c.glow(x, y-4, 16, P['flame'], 0.6)
    c.rect(x-1, y-2, x+1, y+4, P['candle']); c.p(x+1, y-2, P['parch2'])
    c.p(x, y-3, P['flame2']); c.p(x, y-4, P['flame']); c.p(x, y-5, P['candle'])
    c.rect(x-2, y+5, x+2, y+5, P['brass']); c.rect(x-3, y+6, x+3, y+6, P['brass2'])

def flask(c, x, y, liquid, tall=7):
    c.glow(x, y-tall//2, 9, liquid, 0.45)
    c.rect(x-1, y-tall-3, x+1, y-tall, P['parch2'])  # neck
    for j in range(tall):
        hw = 1 + min(j, tall-j, 3)
        c.hline(x-hw, x+hw, y-tall+j, liquid if j > 1 else P['stone2'])
    c.p(x-1, y-tall+2, P['white']); c.p(x+1, y-3, P['white'])

WIZARD = [
"........hh........",
".......hhh........",
"......hhhhh.......",
"......hhshh.......",
".....hhhhhhh......",
"....hhhhhhhhh.....",
"..ggggggggggggg...",
"....fffffffff.....",
"....fFfeffeFf.....",
"....fffffffff.....",
"....bbbffbbbb.....",
"...bbbbbbbbbbb....",
"...bBbbbbbbbbbb...",
"..rrbbbbbbbbbrr...",
".rrRrbbbbbbbrRrr..",
".rrRrrbbbbbrrRrr..",
"rrRRrrrbbbrrrRRrr.",
"rrRRrrrrrrrrrRRrrr",
"rrRRrrrrrrrrrrRRrr",
".rrrrrrrrrrrrrrrr.",
]
WIZ_PAL = dict(h=P['hat'], s=P['gold2'], g=P['gold'], f=P['skin'], F=P['skin2'], e=P['ink'], b=P['beard'], B=P['beard2'], r=P['robe1'], R=P['robe0'])

OWL = [
".o.o.",
"ooooo",
"oeoeo",
"ooyoo",
".ooo.",
".o.o.",
]
OWL_PAL = dict(o=P['wood2'], e=P['gold2'], y=P['brass3'])

def typewriter(c, x, y):
    """Alchemic typewriter: brass body, paper sheet, key rows, flasks and a coil."""
    # paper sheet rising out of the platen
    c.rect(x-2, y-17, x+61, y-2, P['parch']); c.vline(x+61, y-17, y-2, P['parch2']); c.hline(x-2, x+61, y-17, P['parch2'])
    for ly in (y-6,): c.hline(x+1, x+58, ly, P['parch2'])
    # platen roller
    c.rect(x+6, y-2, x+53, y+1, P['wood0']); c.rect(x+4, y-1, x+5, y, P['brass3']); c.rect(x+54, y-1, x+55, y, P['brass3'])
    # body (iso box)
    iso_box(c, x+2, y+2, 56, 10, 3, P['brass3'], P['brass'], P['brass2'])
    for row in range(3):  # keys
        for k in range(10 - row):
            kx = x+7 + row*2 + k*5; ky = y+4 + row*3
            c.rect(kx, ky, kx+2, ky+1, P['parch']); c.hline(kx, kx+2, ky+2, P['brass2'])
    c.rect(x+18, y+13, x+41, y+13, P['parch2'])  # space bar
    # alchemical extras: coil and flasks on the sides
    for i in range(6): c.p(x+60+(i%2), y-2+i*2, P['brass3']); c.p(x+60+((i+1)%2), y-1+i*2, P['brass2'])
    flask(c, x-4, y+10, P['green'], 8); flask(c, x+64, y+10, P['arcane'], 9)
    c.hline(x-3, x+1, y-1, P['brass2'])  # tube

def desk(c, x, y, w):
    iso_box(c, x, y, w, 12, 5, P['wood3'], P['wood1'], P['wood0'])
    c.hline(x, x+w-1, y, P['wood2'])
    c.rect(x+3, y+12, x+5, y+22, P['wood0']); c.rect(x+w-6, y+12, x+w-4, y+22, P['wood0'])

def floor_scrolls(c):
    for x, y in ((92, 168), (214, 172), (232, 165)):
        c.rect(x, y, x+9, y+2, P['parch']); c.hline(x, x+9, y+2, P['parch2']); c.rect(x-1, y-1, x, y+3, P['parch2']); c.rect(x+10, y-1, x+11, y+3, P['parch2'])
        c.p(x+4, y+1, P['red'])

def study(c):
    back_wall(c); iso_floor(c)
    bookcase(c, 4, 131, 58, 44); bookcase(c, 258, 131, 56, 44)
    c.rect(70, 138, 84, 140, P['wood2']); candle(c, 77, 133)       # wall sconce + candle
    c.rect(236, 138, 250, 140, P['wood2']); c.sprite(240, 131, OWL, OWL_PAL)
    candle(c, 300, 125)
    desk(c, 116, 158, 92)
    c.sprite(98, 140, WIZARD, WIZ_PAL)
    typewriter(c, 134, 148)
    floor_scrolls(c)

# ── Scroll-words ───────────────────────────────────────────────────────────
def scroll_word(c, x, y, nchars, spell=None, target=False):
    """Unrolled parchment strip with rolled ends. Returns (x0, y0, x1, y1) of the paper in base px."""
    w = max(14, int(nchars*2.9)+6); x0 = x - w//2; x1 = x0 + w; y0, y1 = y-4, y+4
    if target: c.rect(x0-4, y0-2, x1+4, y1+2, P['arcane']); c.rect(x0-3, y0-1, x1+3, y1+1, P['robe0'])
    c.rect(x0, y0, x1, y1, P['parch']); c.hline(x0, x1, y1, P['parch2']); c.hline(x0, x1, y0, P['parch2'])
    for e in (x0-2, x1+1):  # rolled ends
        c.rect(e, y0-1, e+1, y1+1, P['parch2']); c.vline(e, y0-1, y1+1, P['parch3'])
        c.p(e, y0-2, P['parch3']); c.p(e+1, y1+2, P['parch3'])
    if spell:
        col = SPELL[spell]
        c.rect(x0+1, y0, x0+2, y1, col)                 # ribbon
        c.disc(x0+2, y1+1, 2, col); c.p(x0+2, y1+1, P['white'])  # wax seal
        c.p(x0+1, y1+4, col); c.p(x0+3, y1+4, col)
    return x0, y0, x1, y1

# ── Spell icons (12x12) ────────────────────────────────────────────────────
ICONS = {
 'slow': ["..gggggggg..","..g......g..","...wbbbbw...","....wbbw....",".....bb.....","......w.....",".....w......","....w..w....","...w.bb.w...","..w.bbbb.w..","..g......g..","..gggggggg.."],
 'ice': [".....w......","..w..w..w...","...w.w.w....","....www.....","wwwwwwwwwww.","....www.....","...w.w.w....","..w..w..w...",".....w......","............","............","............"],
 'barrier': ["..wwwwwwww..",".wbbbbbbbbw.",".wbbwwwwbbw.",".wbbwbbwbbw.",".wbbwbbwbbw.",".wbbwwwwbbw.","..wbbbbbbw..","..wbbbbbbw..","...wbbbbw...","....wbbw....",".....ww.....","............"],
 'shock': ["......ww....",".....ww.....","....ww......","...wwwwww...","......ww....",".....ww.....","....ww......","...ww.......","..ww........","..w.........","............","............"],
 'alter': ["....wwww....","...w....w...","..w..bb..w..",".w..bbbb..w.",".w.bbbbbb.w.",".w..bbbb..w.","..w..bb..w..","...w....w...","....wwww....","....w..w....","...w....w...","............"],
 'fire': [".....w......","....ww......","....wbw.....","...wbbw..w..","..wbbbbw.w..","..wbbybbww..",".wbbyyybbw..",".wbbyyybbw..",".wbbbyybbw..","..wbbbbbw...","...wwwww....","............"],
 'wind': ["............","wwwwwww.....","......ww....","wwwwwwwww...","........ww..","..wwwwwwwww.",".........w..",".wwwwwww....","............","............","............","............"],
 'harvest': ["......w.....",".....wbw....","....w.b.w...",".....wbw....","....w.b.w...",".....wbw....","....w.b.w...","......b.....","......b.....",".....bbb....","............","............"],
}
def icon(c, x, y, spell, scale=1):
    col = SPELL[spell]; dark = tuple(int(v*0.55) for v in col)
    pal = dict(w=col, b=dark, g=P['gold'], y=P['gold2'])
    for j, row in enumerate(ICONS[spell]):
        for i, ch in enumerate(row):
            if ch in pal: c.rect(x+i*scale, y+j*scale, x+i*scale+scale-1, y+j*scale+scale-1, pal[ch])

# ── HUD ────────────────────────────────────────────────────────────────────
def frame(c, x0, y0, x1, y1, fill=P['wood0']):
    c.rect(x0, y0, x1, y1, fill)
    c.hline(x0, x1, y0, P['gold']); c.hline(x0, x1, y1, P['brass2']); c.vline(x0, y0, y1, P['gold']); c.vline(x1, y0, y1, P['brass2'])
    for (x, y) in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)): c.p(x, y, P['gold2'])

def meter(c, x0, y, w, frac, col):
    c.rect(x0, y, x0+w, y+3, P['void']); c.hline(x0, x0+w, y-1, P['brass2']); c.hline(x0, x0+w, y+4, P['brass2'])
    fill = int(w*frac)
    if fill > 0: c.rect(x0+1, y, x0+fill, y+3, col); c.hline(x0+1, x0+fill, y, tuple(min(255, v+50) for v in col))

# ═══ Gritty pass (overrides) ═══════════════════════════════════════════════
_scenery, _study, _scroll_word = scenery, study, scroll_word

def smog(c, y0, y1, color, seed):
    rnd = random.Random(seed)
    for band in range(5):
        by = rnd.randrange(y0, y1); amp = rnd.uniform(2, 5); ph = rnd.uniform(0, 6)
        for x in range(c.w):
            yy = int(by + math.sin(x/23 + ph)*amp)
            for t in range(4):
                if BAYER[(yy+t)%4][x%4] < 6 - t: c.blend(x, yy+t, color, 0.35)

def scenery(c, ch):
    _scenery(c, ch)
    smog(c, 50, 120, CHAPTERS[ch]['sky'][3], ch*7)
    c.grit(0, 0, c.w-1, 125, 0.10, seed=ch)

def ward_line(c, y=126):
    rnd = random.Random(5)
    for x in range(c.w):
        if rnd.random() < 0.08: continue          # broken, sputtering ward
        c.p(x, y, P['ward']); c.blend(x, y-1, P['arcane'], 0.35)
    for x in range(6, c.w, 22):                    # scratched rune marks
        c.p(x, y-3, P['arcane2']); c.p(x+1, y-4, P['arcane']); c.p(x+2, y-3, P['arcane'])

def soot_streak(c, x, y0, length, seed):
    rnd = random.Random(seed)
    for i in range(length):
        a = 0.6*(1 - i/length)
        c.blend(x + (1 if rnd.random() < 0.2 else 0), y0+i, P['grime'], a)
        c.blend(x+1, y0+i, P['grime'], a*0.5)

def cobweb(c, x, y, flip=1):
    for i in range(9):
        c.blend(x + i*flip, y, P['beard2'], 0.35); c.blend(x, y+i, P['beard2'], 0.35)
        c.blend(x + i*flip, y + 8 - i, P['beard2'], 0.3)
    for i in range(5): c.blend(x + (i+2)*flip, y+2, P['beard2'], 0.25)

def study(c):
    _study(c)
    c.grit(0, 127, c.w-1, 179, 0.16, seed=9)
    for x, l in ((40, 14), (118, 10), (205, 12), (300, 9)): soot_streak(c, x, 127, l, x)
    for x in range(30, c.w, 47):  # cracked bricks
        c.p(x, 133, P['grime']); c.p(x+1, 134, P['grime']); c.p(x+1, 135, P['grime']); c.p(x+2, 136, P['grime'])
    cobweb(c, 4, 127); cobweb(c, 315, 127, -1)
    for x0, x1 in ((112, 212),):  # cast shadow under the desk
        for y in range(171, 176):
            for x in range(x0, x1):
                if BAYER[y%4][x%4] < 9: c.blend(x, y, P['grime'], 0.5)
    # the typewriter's sheet stays clean enough to read
    c.rect(132, 131, 195, 146, P['parch']); c.vline(195, 131, 146, P['parch2']); c.hline(132, 195, 131, P['parch2'])
    c.grit(133, 132, 194, 145, 0.04, seed=77, dark=P['parch2'])
    # warm pool of candlelight on the desk: the only real light in the room
    c.glow(166, 152, 46, P['flame'], 0.32)
    candle(c, 124, 156)

def scroll_word(c, x, y, nchars, spell=None, target=False):
    """Stained, singed parchment with torn edges."""
    w = max(14, int(nchars*2.9)+6); x0 = x - w//2; x1 = x0 + w; y0, y1 = y-4, y+4
    rnd = random.Random(x*31 + y)
    if target:
        c.rect(x0-4, y0-2, x1+4, y1+2, P['rust2']); c.rect(x0-3, y0-1, x1+3, y1+1, P['grime'])
    c.rect(x0, y0, x1, y1, P['parch'])
    c.grit(x0+1, y0+1, x1-1, y1-1, 0.07, seed=x+y, dark=P['parch2'])
    for _ in range(2):  # tea/water stains
        sx, sy = rnd.randrange(x0+2, x1-2), rnd.randrange(y0+1, y1)
        for dx in range(-2, 3): c.blend(sx+dx, sy, P['parch2'], 0.6)
    for xx in range(x0, x1+1):  # torn top/bottom edges
        if rnd.random() < 0.18: c.p(xx, y0, P['grime'] if not target else P['grime'])
        if rnd.random() < 0.18: c.p(xx, y1, P['parch3'])
    c.hline(x0, x1, y1, P['parch2'])
    for cx_ in (x1-1,):  # singed corner
        c.p(cx_, y0, P['grime']); c.p(cx_-1, y0, P['parch3']); c.p(cx_, y0+1, P['parch3'])
    for e in (x0-2, x1+1):  # rolled ends, darker and grubby
        c.rect(e, y0-1, e+1, y1+1, P['parch3']); c.vline(e, y0-1, y1+1, P['wood1'])
        c.p(e, y0-2, P['wood1']); c.p(e+1, y1+2, P['wood1'])
    if spell:
        col = SPELL[spell]
        c.rect(x0+1, y0, x0+2, y1, col)
        c.disc(x0+2, y1+1, 2, tuple(int(v*0.8) for v in col)); c.p(x0+2, y1+1, col)
        c.p(x0+1, y1+4, col); c.p(x0+3, y1+4, col)
    return x0, y0, x1, y1

def frame(c, x0, y0, x1, y1, fill=None):
    """Riveted iron plate, rusted at the edges."""
    c.rect(x0, y0, x1, y1, P['iron'])
    c.grit(x0, y0, x1, y1, 0.22, seed=x0*3+y0, dark=P['grime'])
    rnd = random.Random(x0+y1)
    for x in range(x0, x1+1):
        if rnd.random() < 0.3: c.blend(x, y1-1, P['rust'], 0.6)
        if rnd.random() < 0.15: c.blend(x, y0+1, P['rust'], 0.5)
    c.hline(x0, x1, y0, P['iron3']); c.vline(x0, y0, y1, P['iron2'])
    c.hline(x0, x1, y1, P['grime']); c.vline(x1, y0, y1, P['grime'])
    step = 16 if (x1-x0) > 40 else max(4, x1-x0-2)
    for x in range(x0+3, x1-1, step):
        for yy in (y0+2, y1-2):
            c.p(x, yy, P['iron3']); c.p(x+1, yy+1, P['grime'])

def meter(c, x0, y, w, frac, col):
    c.rect(x0-1, y-1, x0+w+1, y+4, P['grime']); c.rect(x0, y, x0+w, y+3, P['void'])
    fill = int(w*frac)
    for x in range(x0+1, x0+fill+1):  # segmented, like an old gauge
        if (x - x0) % 4 != 0: c.rect(x, y+1, x, y+2, col)
    c.hline(x0, x0+w, y+4, P['iron2'])
