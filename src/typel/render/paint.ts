/**
 * Typel procedural painting (prototype, D-085/D-086/D-087). Canvas 2D at 1920×1080.
 * D-087: grounded, mature fantasy look (supersedes D-086's bright funland palette).
 *
 * D-086 art direction (owner, 2026-11-21): loud, saturated, timeless and
 * magical — "Peggle for typing, with Bejeweled Blitz excitement and Balatro
 * score chasing". The darker gritty look is retired. Medium remains a
 * reversible prototype choice (smooth painted shapes, not pixel art).
 *
 * Screen zones (owner layout, 2026-11-21):
 *   blue   x 0–198,    y 0–590   Combo meter (+ arcade counter on top)
 *   green  x 198–398,  y 0–590   Arcane Rush meter
 *   red    x 0–400,    y 594–1080 the wizard at the typewriter
 *   purple field (FIELD_RECT)    gameplay
 *   orange Ward floor under the field
 *   yellow x 1648–1920 spell rack
 */
import type { SpellId } from '../../gameplay/SpellManager';

export const W = 1920;
export const H = 1080;
/** D-088: the field ends where the typewriter's paper begins; the machine itself is the Ward. */
export const FIELD_RECT = { x: 402, y: 0, w: 1240, h: 790 } as const;
export const WARD_Y = FIELD_RECT.y + FIELD_RECT.h;
export const FLOOR = { x: 402, y: WARD_Y, w: 1240, h: H - WARD_Y } as const;
export const RACK_X = 1648;

export const INK = '#24150a';
export const RUBRIC = '#b3261e';
export const GOLD = '#e0b45a';
export const PARCHMENT = '#efe2c2';

/**
 * D-087 (owner, 2026-11-21): grounded, mature fantasy, not a childish funland.
 * Spell colours stay vivid (magic is the loud thing in a grounded world) but
 * are deeper jewel tones rather than candy.
 */
export const SPELL_HUE: Record<SpellId, string> = {
  slow: '#8e5cd6',
  fire: '#e8641c',
  ice: '#3cc4d4',
  barrier: '#8aa6d8',
  shock: '#e8c21a',
  alter: '#d65a8e',
  wind: '#4fbf78',
  harvest: '#e0a030',
};

export const SPELL_GLYPH: Record<SpellId, string> = {
  slow: '⧗', fire: '✹', ice: '❄', barrier: '⛨', shock: 'ϟ', alter: '✎', wind: '༄', harvest: '❦',
};

type Ctx = CanvasRenderingContext2D;

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5) >>> 0) / 4294967296);
}

export function grad(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export function radial(ctx: Ctx, x: number, y: number, r: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const gold = (ctx: Ctx, x: number, w: number) => grad(ctx, x, 0, x + w, 0, [[0, '#5a3c14'], [0.3, '#b8904a'], [0.5, '#e8cf8e'], [0.7, '#a8803c'], [1, '#4a3010']]);
const walnut = (ctx: Ctx, y0: number, y1: number) => grad(ctx, 0, y0, 0, y1, [[0, '#4a2e1a'], [0.5, '#2e1c10'], [1, '#1a0f08']]);

function shelves(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number): void {
  const r = rng(seed);
  ctx.fillStyle = grad(ctx, x, 0, x + w, 0, [[0, '#140c07'], [0.5, '#22150c'], [1, '#140c07']]);
  ctx.fillRect(x, y, w, h);
  // leather bindings: oxblood, forest, navy, ochre, umber, plum
  const spines = ['#6b2420', '#2f4a32', '#23324e', '#8a6a2a', '#5a3a22', '#4a2a40', '#3a4a52', '#7a3a1c'];
  for (let sy = y + 12; sy + 112 <= y + h; sy += 112) {
    let bx = x + 8;
    while (bx < x + w - 14) {
      const bw = 12 + r() * 18;
      const bh = 112 * (0.62 + r() * 0.3);
      const c = spines[Math.floor(r() * spines.length)]!;
      const lean = r() < 0.07 ? (r() - 0.5) * 0.2 : 0;
      ctx.save();
      ctx.translate(bx, sy + 100);
      ctx.rotate(lean);
      ctx.fillStyle = grad(ctx, 0, 0, bw, 0, [[0, shade(c, 0.55)], [0.45, c], [1, shade(c, 0.45)]]);
      ctx.fillRect(0, -bh, bw, bh);
      if (r() < 0.75) {
        ctx.fillStyle = 'rgba(200,160,80,0.55)';
        ctx.fillRect(1, -bh + 8, bw - 2, 2);
        ctx.fillRect(1, -14, bw - 2, 2);
      }
      ctx.restore();
      bx += bw + 1 + (r() < 0.08 ? 10 : 0);
    }
    ctx.fillStyle = grad(ctx, 0, sy + 100, 0, sy + 112, [[0, '#5a3a20'], [1, '#22140a']]);
    ctx.fillRect(x, sy + 100, w, 12);
  }
}

/** The room around the field: a dark walnut library, the wizard's lamplit nook, an oak rack backing. */
export function paintRoom(ctx: Ctx): void {
  ctx.fillStyle = grad(ctx, 0, 0, 0, H, [[0, '#1a110b'], [1, '#0d0805']]);
  ctx.fillRect(0, 0, W, H);
  shelves(ctx, 0, 0, 400, 1080, 11);
  ctx.fillStyle = 'rgba(10,6,4,0.45)';
  ctx.fillRect(0, 0, 400, 1080);
  // the wizard's great desk under the window; the typewriter stands on it
  const dx = FIELD_RECT.x;
  const dw = FIELD_RECT.w;
  const dy = FIELD_RECT.y + FIELD_RECT.h;
  ctx.fillStyle = walnut(ctx, dy, H);
  ctx.fillRect(dx, dy, dw, H - dy);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  for (let i = 0; i < 16; i++) {
    ctx.beginPath();
    ctx.moveTo(dx, dy + 10 + i * 18);
    ctx.bezierCurveTo(dx + dw * 0.3, dy + 4 + i * 18, dx + dw * 0.7, dy + 18 + i * 18, dx + dw, dy + 10 + i * 18);
    ctx.stroke();
  }
  ctx.fillStyle = radial(ctx, dx + dw / 2, dy + 60, 700, [[0, 'rgba(255,180,90,0.22)'], [1, 'rgba(255,180,90,0)']]);
  ctx.fillRect(dx, dy, dw, H - dy);
  // a candle and an inkwell in the right corner of the desk
  ctx.fillStyle = '#0e0c10';
  ctx.beginPath();
  ctx.ellipse(1600, 1050, 26, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = grad(ctx, 1576, 0, 1624, 0, [[0, '#0e0c10'], [0.4, '#2a2630'], [1, '#0e0c10']]);
  ctx.fillRect(1576, 1018, 48, 32);
  // the rack's oak backing
  ctx.fillStyle = grad(ctx, RACK_X, 0, W, 0, [[0, '#2a180c'], [0.5, '#3a2212'], [1, '#22130a']]);
  ctx.fillRect(RACK_X - 6, 0, W - RACK_X + 6, H);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  for (let x = RACK_X + 30; x < W; x += 46) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 6, H);
    ctx.stroke();
  }
}

/** The field: a real dusk over mountains and a spired city. Magic lives in the effects, not the scenery. */
export function paintSky(ctx: Ctx, w: number, h: number): void {
  const r = rng(17);
  ctx.fillStyle = grad(ctx, 0, 0, 0, h, [[0, '#0b1222'], [0.35, '#16223e'], [0.65, '#2c3352'], [0.85, '#5a4656'], [1, '#9a6a52']]);
  ctx.fillRect(0, 0, w, h);
  // a faint aurora: the only overtly magical thing in the sky
  for (const [y, c] of [[0.2, 'rgba(70,190,160,0.10)'], [0.26, 'rgba(120,90,200,0.08)']] as const) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(0, y * h);
    for (let x = 0; x <= w; x += 40) ctx.lineTo(x, y * h + Math.sin(x / 160) * 40 + Math.sin(x / 47) * 8);
    for (let x = w; x >= 0; x -= 40) ctx.lineTo(x, y * h + 90 + Math.sin(x / 130) * 30);
    ctx.fill();
  }
  for (let i = 0; i < 220; i++) {
    const a = 0.15 + r() * 0.55;
    ctx.fillStyle = `rgba(235,230,215,${a})`;
    const s = r() < 0.95 ? 1.3 : 2.4;
    ctx.fillRect(r() * w, r() * h * 0.6, s, s);
  }
  // the moon: full, pale, with maria
  const mx = w * 0.8;
  const my = h * 0.15;
  ctx.fillStyle = radial(ctx, mx, my, 220, [[0, 'rgba(240,230,200,0.35)'], [0.35, 'rgba(220,210,180,0.08)'], [1, 'rgba(220,210,180,0)']]);
  ctx.fillRect(mx - 220, my - 220, 440, 440);
  ctx.fillStyle = radial(ctx, mx - 14, my - 14, 64, [[0, '#f4ecd6'], [0.8, '#d9cfb4'], [1, '#bdb294']]);
  ctx.beginPath();
  ctx.arc(mx, my, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,110,95,0.25)';
  for (const [dx, dy, rr] of [[-18, -10, 14], [10, 8, 18], [-4, 22, 9], [22, -18, 8]] as const) {
    ctx.beginPath();
    ctx.arc(mx + dx, my + dy, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  // soft cloud banks
  for (let i = 0; i < 7; i++) {
    const cy = h * (0.3 + r() * 0.3);
    const cx = r() * w;
    ctx.fillStyle = radial(ctx, cx, cy, 260, [[0, 'rgba(90,96,128,0.20)'], [1, 'rgba(90,96,128,0)']]);
    ctx.save();
    ctx.scale(1, 0.25);
    ctx.fillRect(cx - 260, cy * 4 - 260, 520, 520);
    ctx.restore();
  }
  // mountain ranges, hazier with distance
  for (const [base, col, amp, f] of [[0.62, '#2e3450', 90, 260], [0.7, '#252940', 70, 180], [0.78, '#1b1d2e', 50, 120]] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 10) ctx.lineTo(x, base * h - Math.abs(Math.sin(x / f + base * 9)) * amp - Math.sin(x / 37) * 6);
    ctx.lineTo(w, h);
    ctx.fill();
  }
  // the city: spires, a cathedral, a crag castle; warm windows
  ctx.fillStyle = '#110f18';
  ctx.beginPath();
  ctx.moveTo(0, h);
  let x = 0;
  while (x < w) {
    const bw = 18 + r() * 40;
    const bh = 40 + r() * 70;
    const spire = r() < 0.22 ? 40 + r() * 90 : 0;
    ctx.lineTo(x, h - 30 - bh);
    if (spire) {
      ctx.lineTo(x + bw / 2, h - 30 - bh - spire);
    } else ctx.lineTo(x + bw * 0.2, h - 30 - bh - 10);
    ctx.lineTo(x + bw, h - 30 - bh);
    x += bw;
  }
  ctx.lineTo(w, h);
  ctx.fill();
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = r() < 0.6 ? 'rgba(255,200,120,0.75)' : 'rgba(255,160,90,0.6)';
    ctx.fillRect(r() * w, h - 40 - r() * 80, 3, 4);
  }
  // ground haze where the Ward meets the world
  ctx.fillStyle = grad(ctx, 0, h - 90, 0, h, [[0, 'rgba(160,110,80,0)'], [1, 'rgba(160,110,80,0.25)']]);
  ctx.fillRect(0, h - 90, w, 90);
}

/** Carved dark-wood frame with a tarnished brass bead and corner fittings. */
export function paintFrame(ctx: Ctx): void {
  const { x, y, w, h } = FIELD_RECT;
  ctx.lineWidth = 18;
  ctx.strokeStyle = grad(ctx, x, 0, x + w, 0, [[0, '#2a180c'], [0.5, '#4a2e18'], [1, '#2a180c']]);
  roundRect(ctx, x - 4, y - 40, w + 8, h + 46, 40);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = gold(ctx, x, w);
  roundRect(ctx, x + 6, y - 30, w - 12, h + 26, 34);
  ctx.stroke();
  for (const jy of [200, 470, 740]) {
    for (const jx of [x - 4, x + w + 4]) {
      ctx.fillStyle = gold(ctx, jx - 12, 24);
      roundRect(ctx, jx - 12, jy - 22, 24, 44, 6);
      ctx.fill();
      ctx.fillStyle = radial(ctx, jx - 2, jy - 3, 8, [[0, '#d88a7a'], [0.5, '#7a1e1a'], [1, '#2a0808']]);
      ctx.beginPath();
      ctx.arc(jx, jy, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * D-088: the great arcane typewriter, centred under the battlefield. Its
 * paper (drawn live) stands along the Ward line; the platen, typebar basket
 * and keys sit below, seen from behind the wizard.
 */
export const TW = { cx: 1022, paperX: 682, paperW: 680, paperTop: 792, paperBottom: 904 } as const;
/** Key rows recede from the wizard toward the platen (perspective). */
export const KEY_ROWS = [
  { row: 'qwertyuiop', y: 970, gap: 44, scale: 1.25 },
  { row: 'asdfghjkl', y: 1010, gap: 48, scale: 1.37 },
  { row: 'zxcvbnm', y: 1052, gap: 52, scale: 1.5 },
] as const;

export function paintTypewriter(ctx: Ctx): void {
  const cx = TW.cx;
  // body: blackened iron with gilt pinstripes and riveted brass rails, wider toward the typist
  ctx.beginPath();
  ctx.moveTo(cx - 330, 930);
  ctx.lineTo(cx + 330, 930);
  ctx.lineTo(cx + 410, 1080);
  ctx.lineTo(cx - 410, 1080);
  ctx.closePath();
  ctx.fillStyle = grad(ctx, 0, 930, 0, 1080, [[0, '#2c2824'], [0.5, '#171411'], [1, '#0b0908']]);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = gold(ctx, cx - 410, 820);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(200,160,80,0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 316, 942);
  ctx.lineTo(cx + 316, 942);
  ctx.stroke();
  ctx.fillStyle = '#c8a050';
  for (let i = 0; i <= 16; i++) {
    ctx.beginPath();
    ctx.arc(cx - 320 + i * 40, 936, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // typebar basket: a fan of steel arms behind the keys, converging on the strike point
  ctx.save();
  ctx.translate(cx, 934);
  for (let i = -30; i <= 30; i++) {
    const a = (i / 30) * 1.25 - Math.PI / 2;
    ctx.strokeStyle = i % 2 ? '#a8885a' : '#6a5436';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 18, Math.sin(a) * 6);
    ctx.lineTo(Math.cos(a) * 300, Math.sin(a) * 26 + 16);
    ctx.stroke();
  }
  ctx.restore();
  // platen roller with nickel knobs, and the carriage rail
  ctx.fillStyle = grad(ctx, 0, 900, 0, 934, [[0, '#0c0a0a'], [0.45, '#403a36'], [1, '#0a0808']]);
  ctx.fillRect(cx - 360, 900, 720, 34);
  for (const kx of [cx - 392, cx + 360]) {
    ctx.fillStyle = grad(ctx, kx, 0, kx + 32, 0, [[0, '#5a5a5e'], [0.5, '#e8e6e0'], [1, '#4a4a4e']]);
    roundRect(ctx, kx, 890, 32, 54, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    for (let y = 894; y < 942; y += 4) {
      ctx.beginPath();
      ctx.moveTo(kx, y);
      ctx.lineTo(kx + 32, y);
      ctx.stroke();
    }
  }
  ctx.fillStyle = gold(ctx, cx - 380, 760);
  ctx.fillRect(cx - 380, 884, 760, 6);
  // carriage return lever, sweeping out to the left
  ctx.strokeStyle = '#d8d4cc';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 392, 900);
  ctx.quadraticCurveTo(cx - 450, 868, cx - 470, 830);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/** A brass gear (rotated live). */
export function paintGear(ctx: Ctx, size: number, teeth: number): void {
  const c = size / 2;
  ctx.fillStyle = gold(ctx, 0, size);
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const r = i % 2 ? c * 0.82 : c;
    ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
  }
  ctx.fill();
  ctx.fillStyle = '#2a1c10';
  ctx.beginPath();
  ctx.arc(c, c, c * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,24,10,0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(c, c, c * 0.55, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * D-088: the typewriter's engine, filling the left column. Score drum on top,
 * stamped multiplier plates, the Combo and Arcane Rush glass tubes, a level
 * plate, and a gear housing piped into the typewriter. Fills drawn live.
 */
export const MACHINE = { tubeTop: 236, tubeBottom: 740, plateY: 800 } as const;
export function paintMeters(ctx: Ctx): void {
  // iron cabinet with brass edging and rivets
  ctx.fillStyle = grad(ctx, 0, 0, 400, 0, [[0, '#14110e'], [0.5, '#221d18'], [1, '#14110e']]);
  ctx.fillRect(0, 0, 400, 1080);
  ctx.fillStyle = gold(ctx, 392, 10);
  ctx.fillRect(392, 0, 10, 1080);
  ctx.fillStyle = '#b89048';
  for (let y = 20; y < 1080; y += 60) {
    for (const x of [8, 384]) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // score drum window
  ctx.fillStyle = gold(ctx, 8, 384);
  roundRect(ctx, 8, 8, 384, 176, 14);
  ctx.fill();
  ctx.fillStyle = grad(ctx, 0, 20, 0, 172, [[0, '#0e0d0a'], [1, '#1c1912']]);
  roundRect(ctx, 20, 20, 360, 152, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  for (let i = 1; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(20 + i * 60, 24);
    ctx.lineTo(20 + i * 60, 100);
    ctx.stroke();
  }
  // tubes
  for (const [x, label, c] of [[18, 'COMBO', SPELL_HUE.barrier], [218, 'ARCANE RUSH', SPELL_HUE.wind]] as const) {
    const w = 164;
    ctx.fillStyle = gold(ctx, x, w);
    roundRect(ctx, x, 196, w, 40, 8);
    ctx.fill();
    roundRect(ctx, x, MACHINE.tubeBottom, w, 40, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,220,230,0.06)';
    roundRect(ctx, x + 24, MACHINE.tubeTop - 4, w - 48, MACHINE.tubeBottom - MACHINE.tubeTop + 8, 36);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,230,235,0.35)';
    ctx.lineWidth = 3;
    roundRect(ctx, x + 24, MACHINE.tubeTop - 4, w - 48, MACHINE.tubeBottom - MACHINE.tubeTop + 8, 36);
    ctx.stroke();
    ctx.fillStyle = '#1e1208';
    ctx.font = '700 15px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, 222);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x + w / 2, MACHINE.tubeBottom + 20, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  // level plate
  ctx.fillStyle = gold(ctx, 18, 364);
  roundRect(ctx, 18, MACHINE.plateY - 6, 364, 70, 8);
  ctx.fill();
  ctx.fillStyle = '#1a140e';
  roundRect(ctx, 26, MACHINE.plateY + 2, 348, 54, 5);
  ctx.fill();
  // gear housing and the pipes that drive the typewriter
  ctx.fillStyle = grad(ctx, 0, 880, 0, 1080, [[0, '#1c1813'], [1, '#0c0a08']]);
  ctx.fillRect(10, 880, 384, 200);
  for (const [y, h] of [[972, 16], [1010, 12]] as const) {
    ctx.fillStyle = grad(ctx, 0, y, 0, y + h, [[0, '#6e4f1f'], [0.5, '#e8cf8e'], [1, '#5a3c14']]);
    ctx.fillRect(330, y, 380, h);
    for (const jx of [400, 520, 640]) {
      ctx.fillStyle = gold(ctx, jx - 6, 12);
      ctx.fillRect(jx - 6, y - 4, 12, h + 8);
    }
  }
}

/** An aged parchment scroll with rolled ends and an optional wax seal and ribbon. */
export function paintScroll(ctx: Ctx, w: number, h: number, spell: SpellId | null): void {
  const end = 15;
  const body = w - end * 2;
  const r = rng(w * 31 + (spell ? spell.length : 0));
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(ctx, end + 4, 9, body, h - 6, 4);
  ctx.fill();
  ctx.fillStyle = grad(ctx, 0, 0, 0, h, [[0, '#f6ecd2'], [0.5, PARCHMENT], [1, '#d9c497']]);
  ctx.fillRect(end, 4, body, h - 8);
  // foxing and age stains
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = radial(ctx, end + r() * body, 6 + r() * (h - 12), 10 + r() * 14, [[0, 'rgba(150,100,50,0.16)'], [1, 'rgba(150,100,50,0)']]);
    ctx.fillRect(end, 4, body, h - 8);
  }
  ctx.fillStyle = 'rgba(110,70,30,0.22)';
  ctx.fillRect(end, 4, body, 2);
  ctx.fillRect(end, h - 6, body, 2);
  for (const x of [0, w - end * 2]) {
    ctx.fillStyle = grad(ctx, x, 0, x + end * 2, 0, [[0, '#8a6a3a'], [0.45, '#efe0bc'], [1, '#6e5028']]);
    roundRect(ctx, x, 0, end * 2, h, end);
    ctx.fill();
  }
  if (spell) {
    const c = SPELL_HUE[spell];
    ctx.fillStyle = c;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(end, h - 10, body, 5);
    ctx.globalAlpha = 1;
    // a wax seal with a rough edge
    ctx.fillStyle = radial(ctx, w - end - 3, h / 2 - 3, 18, [[0, shade(c, 1.25)], [0.55, c], [1, shade(c, 0.4)]]);
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const rr = 15 + (i % 2 ? 1.8 : -0.6);
      ctx.lineTo(w - end + Math.cos(a) * rr, h / 2 + Math.sin(a) * rr);
    }
    ctx.fill();
  }
}

export function paintGlow(ctx: Ctx, size: number, color: string): void {
  ctx.fillStyle = radial(ctx, size / 2, size / 2, size / 2, [[0, color], [0.25, color.replace(/[\d.]+\)$/, '0.45)')], [1, color.replace(/[\d.]+\)$/, '0)')]]);
  ctx.fillRect(0, 0, size, size);
}

export function paintStar(ctx: Ctx, size: number): void {
  const c = size / 2;
  ctx.fillStyle = radial(ctx, c, c, c, [[0, '#ffffff'], [0.3, 'rgba(255,240,180,0.95)'], [1, 'rgba(255,200,80,0.2)']]);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? c * 0.4 : c;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
  }
  ctx.fill();
}

export function paintFlame(ctx: Ctx): void {
  ctx.fillStyle = radial(ctx, 16, 30, 26, [[0, 'rgba(255,255,230,1)'], [0.35, 'rgba(255,210,80,0.95)'], [0.7, 'rgba(255,100,30,0.7)'], [1, 'rgba(230,40,20,0)']]);
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.quadraticCurveTo(30, 26, 24, 40);
  ctx.quadraticCurveTo(16, 48, 8, 40);
  ctx.quadraticCurveTo(2, 26, 16, 0);
  ctx.fill();
}

export function paintKey(ctx: Ctx): void {
  ctx.fillStyle = grad(ctx, 0, 0, 28, 0, [[0, '#5a4420'], [0.5, '#d8b870'], [1, '#5a4420']]);
  ctx.beginPath();
  ctx.arc(14, 14, 13.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = radial(ctx, 11, 10, 14, [[0, '#4a4644'], [0.6, '#1a1816'], [1, '#0a0908']]);
  ctx.beginPath();
  ctx.arc(14, 14, 10.5, 0, Math.PI * 2);
  ctx.fill();
}
