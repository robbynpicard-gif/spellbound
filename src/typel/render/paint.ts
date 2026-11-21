/**
 * Typel procedural painting (prototype, D-085/D-086). Canvas 2D at 1920×1080.
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

export const INK = '#2b1606';
export const RUBRIC = '#d81e2c';
export const GOLD = '#ffc94a';
export const PARCHMENT = '#fff1cf';

/** Saturated, instantly readable spell identities. */
export const SPELL_HUE: Record<SpellId, string> = {
  slow: '#a259ff',
  fire: '#ff6a1a',
  ice: '#26d9e8',
  barrier: '#8fb8ff',
  shock: '#ffd60a',
  alter: '#ff5fa8',
  wind: '#3ddc84',
  harvest: '#ffb627',
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

const gold = (ctx: Ctx, x: number, w: number) => grad(ctx, x, 0, x + w, 0, [[0, '#8a5a12'], [0.3, '#ffd977'], [0.5, '#fff3c2'], [0.7, '#ffcf55'], [1, '#8a5a12']]);

function shelves(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number): void {
  const r = rng(seed);
  ctx.fillStyle = grad(ctx, x, 0, x + w, 0, [[0, '#3a1414'], [0.5, '#5a2018'], [1, '#3a1414']]);
  ctx.fillRect(x, y, w, h);
  const spines = ['#e0344a', '#2f8cff', '#2fcf8a', '#ffb02e', '#a35cff', '#ff6fae', '#22c6d8', '#f25f2a'];
  for (let sy = y + 12; sy + 112 <= y + h; sy += 112) {
    let bx = x + 8;
    while (bx < x + w - 14) {
      const bw = 12 + r() * 16;
      const bh = 112 * (0.6 + r() * 0.3);
      const c = spines[Math.floor(r() * spines.length)]!;
      ctx.fillStyle = grad(ctx, bx, 0, bx + bw, 0, [[0, shade(c, 0.55)], [0.4, c], [1, shade(c, 0.5)]]);
      ctx.fillRect(bx, sy + 100 - bh, bw, bh);
      ctx.fillStyle = '#ffd977';
      ctx.fillRect(bx + 1, sy + 108 - bh, bw - 2, 3);
      ctx.fillRect(bx + 1, sy + 90, bw - 2, 3);
      bx += bw + 1;
    }
    ctx.fillStyle = grad(ctx, 0, sy + 100, 0, sy + 112, [[0, '#a8632e'], [1, '#4a2210']]);
    ctx.fillRect(x, sy + 100, w, 12);
  }
}

/** The room around the field: jewel-toned library, the wizard's lamplit nook, rack backing. */
export function paintRoom(ctx: Ctx): void {
  const r = rng(3);
  ctx.fillStyle = grad(ctx, 0, 0, 0, H, [[0, '#2a0f3a'], [1, '#160822']]);
  ctx.fillRect(0, 0, W, H);
  shelves(ctx, 0, 0, 400, 1080, 11);
  ctx.fillStyle = 'rgba(30,8,40,0.5)';
  ctx.fillRect(0, 0, 400, 1080);
  ctx.fillStyle = radial(ctx, 200, 840, 330, [[0, 'rgba(255,190,90,0.55)'], [0.6, 'rgba(255,140,60,0.15)'], [1, 'rgba(255,140,60,0)']]);
  ctx.fillRect(0, 560, 400, 520);
  ctx.fillStyle = grad(ctx, 0, 1040, 0, 1080, [[0, '#5a1a6a'], [1, '#2a0a3a']]);
  ctx.fillRect(0, 1040, 400, 40);
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = '#ffd977';
    ctx.fillRect(10 + r() * 380, 1046 + r() * 28, 3, 3);
  }
  ctx.fillStyle = grad(ctx, RACK_X, 0, W, 0, [[0, '#4a1d10'], [0.5, '#6e2c16'], [1, '#3e170c']]);
  ctx.fillRect(RACK_X - 6, 0, W - RACK_X + 6, H);
}

/** The sky inside the field: indigo to magenta, nebulae, moon, islands, a tower town. */
export function paintSky(ctx: Ctx, w: number, h: number): void {
  const r = rng(17);
  ctx.fillStyle = grad(ctx, 0, 0, 0, h, [[0, '#120a46'], [0.35, '#2e1478'], [0.7, '#6a1f8e'], [0.9, '#b83a8a'], [1, '#ff8a5c']]);
  ctx.fillRect(0, 0, w, h);
  for (const [x, y, rad, c] of [[0.2, 0.25, 420, 'rgba(46,211,198,0.22)'], [0.75, 0.18, 380, 'rgba(255,95,168,0.2)'], [0.55, 0.55, 520, 'rgba(162,89,255,0.22)'], [0.15, 0.7, 360, 'rgba(47,140,255,0.18)'], [0.85, 0.65, 400, 'rgba(255,182,39,0.14)']] as const) {
    ctx.fillStyle = radial(ctx, x * w, y * h, rad, [[0, c], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(0, 0, w, h);
  }
  for (let i = 0; i < 360; i++) {
    const a = 0.3 + r() * 0.7;
    const s = r() < 0.92 ? 1.6 : 3;
    ctx.fillStyle = `rgba(255,${230 + Math.floor(r() * 25)},${200 + Math.floor(r() * 55)},${a})`;
    ctx.fillRect(r() * w, r() * h * 0.8, s, s);
  }
  const mx = w * 0.8;
  const my = h * 0.17;
  ctx.fillStyle = radial(ctx, mx, my, 240, [[0, 'rgba(255,240,200,0.5)'], [0.3, 'rgba(255,220,170,0.15)'], [1, 'rgba(255,220,170,0)']]);
  ctx.fillRect(mx - 240, my - 240, 480, 480);
  ctx.save();
  ctx.beginPath();
  ctx.arc(mx, my, 70, 0, Math.PI * 2);
  ctx.arc(mx + 32, my - 18, 62, 0, Math.PI * 2, true);
  ctx.fillStyle = '#fff4d6';
  ctx.fill('evenodd');
  ctx.restore();
  for (const [x, y, s] of [[0.12, 0.42, 1], [0.38, 0.3, 0.7], [0.62, 0.44, 0.85]] as const) {
    ctx.fillStyle = 'rgba(40,14,70,0.75)';
    ctx.beginPath();
    ctx.ellipse(x * w, y * h, 90 * s, 18 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x * w - 70 * s, y * h);
    ctx.lineTo(x * w, y * h + 70 * s);
    ctx.lineTo(x * w + 70 * s, y * h);
    ctx.fill();
    ctx.fillStyle = 'rgba(61,220,132,0.4)';
    ctx.fillRect(x * w - 60 * s, y * h - 20 * s, 120 * s, 6 * s);
  }
  ctx.fillStyle = '#2a0b3e';
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 8) {
    const tower = Math.sin(x * 0.07) > 0.93 ? 120 : Math.sin(x * 0.021) > 0.7 ? 60 : 0;
    ctx.lineTo(x, h - 70 - Math.sin(x / 90) * 18 - tower);
  }
  ctx.lineTo(w, h);
  ctx.fill();
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = r() < 0.5 ? '#ffd977' : '#ff9a5c';
    ctx.fillRect(r() * w, h - 60 - r() * 90, 4, 5);
  }
}

/** Gilded frame around the field, studded with jewels. */
export function paintFrame(ctx: Ctx): void {
  const { x, y, w, h } = FIELD_RECT;
  ctx.lineWidth = 14;
  ctx.strokeStyle = gold(ctx, x, w);
  roundRect(ctx, x - 2, y - 40, w + 4, h + 44, 56);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,240,200,0.8)';
  roundRect(ctx, x + 8, y - 30, w - 16, h + 26, 48);
  ctx.stroke();
  const jewels = ['#e0344a', '#2f8cff', '#2fcf8a', '#a35cff'];
  for (let i = 0; i < 4; i++) {
    for (const jy of [180, 420, 660]) {
      const jx = i < 2 ? x - 2 : x + w + 2;
      if (i % 2) continue;
      ctx.fillStyle = radial(ctx, jx - 2, jy - 2, 10, [[0, '#ffffff'], [0.35, jewels[(jy / 240) % 4 | 0]!], [1, '#20103a']]);
      ctx.beginPath();
      ctx.arc(jx, jy, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Compact rosewood-and-brass typewriter for the wizard's nook (keys and paper drawn live). */
export function paintTypewriter(ctx: Ctx): void {
  const cx = 214;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(cx, 1062, 190, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 150, 930);
  ctx.lineTo(cx + 150, 930);
  ctx.lineTo(cx + 182, 1058);
  ctx.lineTo(cx - 182, 1058);
  ctx.closePath();
  ctx.fillStyle = grad(ctx, 0, 930, 0, 1058, [[0, '#c4483a'], [0.5, '#86281c'], [1, '#4a120a']]);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = gold(ctx, cx - 182, 364);
  ctx.stroke();
  ctx.fillStyle = grad(ctx, 0, 898, 0, 930, [[0, '#2a2030'], [0.45, '#7a6a8a'], [1, '#1a1220']]);
  ctx.fillRect(cx - 140, 898, 280, 32);
  for (const kx of [cx - 160, cx + 140]) {
    ctx.fillStyle = gold(ctx, kx, 20);
    roundRect(ctx, kx, 892, 20, 44, 6);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(cx, 944);
  for (let i = -12; i <= 12; i++) {
    const a = (i / 12) * 1.05 - Math.PI / 2;
    ctx.strokeStyle = i % 2 ? '#ffd977' : '#c8902a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 14, Math.sin(a) * 10);
    ctx.lineTo(Math.cos(a) * 60, Math.sin(a) * 26);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = gold(ctx, cx - 50, 100);
  roundRect(ctx, cx - 50, 1040, 100, 14, 4);
  ctx.fill();
}

/** Arcade counter housing plus two glass-and-brass meter columns (fills drawn live). */
export function paintMeters(ctx: Ctx): void {
  ctx.fillStyle = gold(ctx, 8, 384);
  roundRect(ctx, 8, 8, 384, 176, 18);
  ctx.fill();
  ctx.fillStyle = grad(ctx, 0, 20, 0, 172, [[0, '#1a0830'], [1, '#2e0f4e']]);
  roundRect(ctx, 20, 20, 360, 152, 12);
  ctx.fill();
  for (const [x, label, c] of [[18, 'COMBO', '#2f8cff'], [218, 'ARCANE RUSH', '#3ddc84']] as const) {
    const w = 164;
    ctx.fillStyle = gold(ctx, x, w);
    roundRect(ctx, x, 196, w, 40, 10);
    ctx.fill();
    roundRect(ctx, x, 548, w, 40, 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    roundRect(ctx, x + 24, 232, w - 48, 320, 40);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    roundRect(ctx, x + 24, 232, w - 48, 320, 40);
    ctx.stroke();
    ctx.fillStyle = '#2a0f0a';
    ctx.font = 'bold 15px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, 222);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x + w / 2, 568, 9, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A bright parchment scroll with rolled ends and an optional spell seal. */
export function paintScroll(ctx: Ctx, w: number, h: number, spell: SpellId | null): void {
  const end = 15;
  const body = w - end * 2;
  ctx.fillStyle = 'rgba(20,0,40,0.35)';
  roundRect(ctx, end + 4, 9, body, h - 6, 5);
  ctx.fill();
  ctx.fillStyle = grad(ctx, 0, 0, 0, h, [[0, '#fffaf0'], [0.5, PARCHMENT], [1, '#f2d9a6']]);
  ctx.fillRect(end, 4, body, h - 8);
  for (const x of [0, w - end * 2]) {
    ctx.fillStyle = grad(ctx, x, 0, x + end * 2, 0, [[0, '#c98b3c'], [0.45, '#fff2d0'], [1, '#a8682a']]);
    roundRect(ctx, x, 0, end * 2, h, end);
    ctx.fill();
  }
  if (spell) {
    const c = SPELL_HUE[spell];
    ctx.fillStyle = c;
    ctx.fillRect(end, 4, body, 6);
    ctx.fillRect(end, h - 10, body, 6);
    ctx.fillStyle = radial(ctx, w - end, h / 2, 17, [[0, '#ffffff'], [0.3, c], [1, shade(c, 0.45)]]);
    ctx.beginPath();
    ctx.arc(w - end, h / 2, 16, 0, Math.PI * 2);
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
  ctx.fillStyle = grad(ctx, 0, 0, 28, 0, [[0, '#8a5a12'], [0.5, '#ffe08a'], [1, '#8a5a12']]);
  ctx.beginPath();
  ctx.arc(14, 14, 13.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = grad(ctx, 0, 3, 0, 25, [[0, '#ffffff'], [1, '#f0dcb4']]);
  ctx.beginPath();
  ctx.arc(14, 14, 10.5, 0, Math.PI * 2);
  ctx.fill();
}
