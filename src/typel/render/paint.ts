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
export const FIELD_RECT = { x: 402, y: 0, w: 1240, h: 936 } as const;
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
  // an oil lamp's warm pool over the wizard's desk
  ctx.fillStyle = radial(ctx, 230, 820, 360, [[0, 'rgba(255,180,90,0.42)'], [0.55, 'rgba(220,120,50,0.12)'], [1, 'rgba(220,120,50,0)']]);
  ctx.fillRect(0, 520, 400, 560);
  // desk top under the typewriter
  ctx.fillStyle = walnut(ctx, 900, 1080);
  ctx.fillRect(0, 900, 400, 180);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 910 + i * 17);
    ctx.bezierCurveTo(120, 905 + i * 17, 260, 918 + i * 17, 400, 910 + i * 17);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(230,180,110,0.25)';
  ctx.fillRect(0, 900, 400, 2);
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

/** Typewriter seen from behind the wizard (3/4 rear): paper stands toward us, keys slope toward him. */
export const TW = { cx: 262 } as const;
/** Key rows recede from the wizard toward the platen (perspective). */
export const KEY_ROWS = [
  { row: 'qwertyuiop', y: 834, gap: 21, scale: 0.74 },
  { row: 'asdfghjkl', y: 862, gap: 23, scale: 0.82 },
  { row: 'zxcvbnm', y: 892, gap: 25, scale: 0.9 },
] as const;
export function paintTypewriter(ctx: Ctx): void {
  const cx = TW.cx;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(cx, 948, 160, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  // body: black enamel with gilt pinstripes, wider toward the typist
  ctx.beginPath();
  ctx.moveTo(cx - 112, 808);
  ctx.lineTo(cx + 112, 808);
  ctx.lineTo(cx + 136, 944);
  ctx.lineTo(cx - 136, 944);
  ctx.closePath();
  ctx.fillStyle = grad(ctx, 0, 808, 0, 944, [[0, '#2a2622'], [0.5, '#151210'], [1, '#0a0807']]);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(200,160,80,0.8)';
  ctx.stroke();
  ctx.strokeStyle = 'rgba(200,160,80,0.35)';
  ctx.beginPath();
  ctx.moveTo(cx - 104, 818);
  ctx.lineTo(cx + 104, 818);
  ctx.stroke();
  // typebar basket fan
  ctx.save();
  ctx.translate(cx, 806);
  for (let i = -13; i <= 13; i++) {
    const a = (i / 13) * 1.1 - Math.PI / 2;
    ctx.strokeStyle = i % 2 ? '#a8885a' : '#6a5436';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 6);
    ctx.lineTo(Math.cos(a) * 66, Math.sin(a) * 22);
    ctx.stroke();
  }
  ctx.restore();
  // platen roller and nickel knobs
  ctx.fillStyle = grad(ctx, 0, 764, 0, 792, [[0, '#0c0a0a'], [0.45, '#3a3634'], [1, '#0a0808']]);
  ctx.fillRect(cx - 104, 764, 208, 28);
  for (const kx of [cx - 120, cx + 104]) {
    ctx.fillStyle = grad(ctx, kx, 0, kx + 16, 0, [[0, '#5a5a5e'], [0.5, '#e4e2dc'], [1, '#4a4a4e']]);
    roundRect(ctx, kx, 758, 16, 40, 5);
    ctx.fill();
  }
  // carriage return lever
  ctx.strokeStyle = '#c8c4bc';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 120, 764);
  ctx.quadraticCurveTo(cx - 150, 742, cx - 160, 716);
  ctx.stroke();
  // nameplate
  ctx.fillStyle = gold(ctx, cx - 40, 80);
  roundRect(ctx, cx - 40, 928, 80, 10, 3);
  ctx.fill();
}

/** Score counter housing and two glass-and-brass meter columns (fills drawn live). */
export function paintMeters(ctx: Ctx): void {
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
  for (const [x, label, c] of [[18, 'COMBO', SPELL_HUE.barrier], [218, 'ARCANE RUSH', SPELL_HUE.wind]] as const) {
    const w = 164;
    ctx.fillStyle = gold(ctx, x, w);
    roundRect(ctx, x, 196, w, 40, 8);
    ctx.fill();
    roundRect(ctx, x, 548, w, 40, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,220,230,0.06)';
    roundRect(ctx, x + 24, 232, w - 48, 320, 36);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,230,235,0.35)';
    ctx.lineWidth = 3;
    roundRect(ctx, x + 24, 232, w - 48, 320, 36);
    ctx.stroke();
    ctx.fillStyle = '#1e1208';
    ctx.font = '700 15px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, 222);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x + w / 2, 568, 8, 0, Math.PI * 2);
    ctx.fill();
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
