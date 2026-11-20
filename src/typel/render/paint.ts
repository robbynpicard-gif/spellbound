/**
 * Typel procedural painting (prototype, D-085). Canvas 2D at 1920×1080, so
 * the look is smooth and resolution-independent. This is a REVERSIBLE
 * placeholder rendering choice: the Arcane Renaissance world is decided, the
 * medium is not (four-pillar register, Pillar 2).
 */
import type { SpellId } from '../../gameplay/SpellManager';

export const W = 1920;
export const H = 1080;
/** Battlefield rectangle on screen; the engine's field (1280×760) maps into it. */
export const FIELD_RECT = { x: 330, y: 36, w: 1260, h: 646 } as const;
export const WARD_Y = FIELD_RECT.y + FIELD_RECT.h;

export const INK = '#2a1a10';
export const RUBRIC = '#9e1b16';
export const GOLD = '#d9a441';
export const PARCHMENT = '#ecdcb6';

export const SPELL_HUE: Record<SpellId, string> = {
  slow: '#9b6fb0', // amethyst
  fire: '#d0612a', // burnt orange
  ice: '#4fb3a9', // muted teal
  barrier: '#9fb4c8', // silver-blue
  shock: '#e0bf3a', // golden yellow
  alter: '#c4708a', // rose ink
  wind: '#7fa35f', // sage green
  harvest: '#c79a3e', // aged gold
};

export const SPELL_GLYPH: Record<SpellId, string> = {
  slow: '⧗', fire: '🜂', ice: '❄', barrier: '⛨', shock: 'ϟ', alter: '✒', wind: '༄', harvest: '⚘',
};

type Ctx = CanvasRenderingContext2D;

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5) >>> 0) / 4294967296);
}

function grad(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

function radial(ctx: Ctx, x: number, y: number, r: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

function bookshelf(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number): void {
  const r = rng(seed);
  ctx.fillStyle = grad(ctx, x, 0, x + w, 0, [[0, '#1a110c'], [0.5, '#24180f'], [1, '#170f0a']]);
  ctx.fillRect(x, y, w, h);
  const shelfH = 128;
  const spines = ['#5a1f1c', '#3b4a2c', '#2b3550', '#5b4423', '#4a2a3e', '#6a3a1e', '#2f4440', '#55301f'];
  for (let sy = y + 16; sy + shelfH <= y + h; sy += shelfH) {
    let bx = x + 10;
    while (bx < x + w - 16) {
      const bw = 12 + r() * 20;
      const bh = shelfH * (0.62 + r() * 0.3);
      const lean = r() < 0.08 ? (r() - 0.5) * 0.25 : 0;
      ctx.save();
      ctx.translate(bx, sy + shelfH - 14);
      ctx.rotate(lean);
      const c = spines[Math.floor(r() * spines.length)]!;
      ctx.fillStyle = grad(ctx, 0, 0, bw, 0, [[0, shade(c, 0.6)], [0.4, c], [1, shade(c, 0.5)]]);
      ctx.fillRect(0, -bh, bw, bh);
      ctx.fillStyle = 'rgba(217,164,65,0.35)';
      if (r() < 0.7) {
        ctx.fillRect(1, -bh + 10, bw - 2, 2);
        ctx.fillRect(1, -18, bw - 2, 2);
      }
      ctx.restore();
      bx += bw + 1 + (r() < 0.1 ? 14 : 0);
    }
    // the shelf board
    ctx.fillStyle = grad(ctx, 0, sy + shelfH - 14, 0, sy + shelfH, [[0, '#4a3020'], [1, '#22150d']]);
    ctx.fillRect(x, sy + shelfH - 14, w, 14);
  }
}

export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

/** The study behind everything: wall, leaded window, shelves. */
export function paintStudy(ctx: Ctx): void {
  const r = rng(7);
  ctx.fillStyle = grad(ctx, 0, 0, 0, H, [[0, '#17100c'], [0.6, '#21160f'], [1, '#120b08']]);
  ctx.fillRect(0, 0, W, H);
  // Stone courses on the upper wall.
  ctx.globalAlpha = 0.18;
  for (let y = 0; y < 720; y += 46) {
    const off = (y / 46) % 2 ? 0 : 60;
    for (let x = -off; x < W; x += 120) {
      ctx.fillStyle = r() < 0.5 ? '#2c2018' : '#251a13';
      ctx.fillRect(x + 2, y + 2, 116, 42);
    }
  }
  ctx.globalAlpha = 1;

  // The great window behind the battlefield.
  const wx = 470;
  const ww = 980;
  const top = 10;
  const bottom = 700;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(wx, bottom);
  ctx.lineTo(wx, 300);
  ctx.quadraticCurveTo(wx, top, wx + ww / 2, top);
  ctx.quadraticCurveTo(wx + ww, top, wx + ww, 300);
  ctx.lineTo(wx + ww, bottom);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = grad(ctx, 0, top, 0, bottom, [[0, '#0d1824'], [0.55, '#1a2c3a'], [0.85, '#3a3a40'], [1, '#4a3a32']]);
  ctx.fillRect(wx, top, ww, bottom - top);
  // stars
  for (let i = 0; i < 140; i++) {
    ctx.fillStyle = `rgba(240,230,210,${0.15 + r() * 0.45})`;
    const s = r() < 0.9 ? 1.2 : 2.2;
    ctx.fillRect(wx + r() * ww, top + r() * 380, s, s);
  }
  // moon
  ctx.fillStyle = radial(ctx, wx + ww * 0.74, 150, 140, [[0, 'rgba(250,236,200,0.55)'], [0.18, 'rgba(250,236,200,0.35)'], [0.2, 'rgba(240,220,180,0.12)'], [1, 'rgba(240,220,180,0)']]);
  ctx.fillRect(wx, top, ww, 400);
  // distant hills and a town
  for (const [y0, col, amp] of [[520, '#1d2a33', 50], [580, '#18222a', 40], [640, '#141b20', 30]] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(wx, bottom);
    for (let x = 0; x <= ww; x += 20) ctx.lineTo(wx + x, y0 - Math.sin(x / 140 + y0) * amp - r() * 8);
    ctx.lineTo(wx + ww, bottom);
    ctx.fill();
  }
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(230,170,80,${0.35 + r() * 0.4})`;
    ctx.fillRect(wx + 120 + r() * (ww - 240), 610 + r() * 50, 2, 2);
  }
  // leaded glass: diamond cames, kept faint so words stay readable
  ctx.strokeStyle = 'rgba(10,8,6,0.55)';
  ctx.lineWidth = 2;
  for (let d = -ww; d < ww * 2; d += 70) {
    ctx.beginPath();
    ctx.moveTo(wx + d, top);
    ctx.lineTo(wx + d + 700, bottom);
    ctx.moveTo(wx + d + 700, top);
    ctx.lineTo(wx + d, bottom);
    ctx.stroke();
  }
  // a darkening veil so the parchment scrolls pop
  ctx.fillStyle = 'rgba(12,9,7,0.38)';
  ctx.fillRect(wx, top, ww, bottom - top);
  ctx.restore();
  // stone frame and mullions
  ctx.strokeStyle = '#3a2c22';
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.moveTo(wx, bottom);
  ctx.lineTo(wx, 300);
  ctx.quadraticCurveTo(wx, top, wx + ww / 2, top);
  ctx.quadraticCurveTo(wx + ww, top, wx + ww, 300);
  ctx.lineTo(wx + ww, bottom);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(58,44,34,0.85)';
  ctx.lineWidth = 10;
  for (const fx of [wx + ww / 3, wx + (2 * ww) / 3]) {
    ctx.beginPath();
    ctx.moveTo(fx, 60);
    ctx.lineTo(fx, bottom);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(wx, 330);
  ctx.lineTo(wx + ww, 330);
  ctx.stroke();

  bookshelf(ctx, 0, 0, 320, 690, 11);
  bookshelf(ctx, 1600, 0, 320, 690, 23);
  // pilasters framing the window
  for (const px of [330, 1450]) {
    ctx.fillStyle = grad(ctx, px, 0, px + 140, 0, [[0, '#1b120d'], [0.5, '#2e2017'], [1, '#160f0a']]);
    ctx.fillRect(px, 0, 140, 700);
  }
  // hanging astrolabe silhouette, top left of the window
  ctx.strokeStyle = 'rgba(190,140,70,0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(400, 0);
  ctx.lineTo(400, 70);
  ctx.stroke();
  for (const [rx, ry, rot] of [[38, 38, 0], [38, 14, 0.6], [38, 14, -0.6]] as const) {
    ctx.beginPath();
    ctx.ellipse(400, 110, rx, ry, rot, 0, Math.PI * 2);
    ctx.stroke();
  }

  // The desk: dark walnut across the bottom.
  const deskTop = 694;
  ctx.fillStyle = grad(ctx, 0, deskTop, 0, H, [[0, '#5a3a24'], [0.06, '#3e2717'], [0.5, '#2c1b10'], [1, '#170e08']]);
  ctx.fillRect(0, deskTop, W, H - deskTop);
  ctx.strokeStyle = 'rgba(20,12,7,0.35)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 70; i++) {
    const y = deskTop + 20 + r() * (H - deskTop - 20);
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= W; x += 60) ctx.lineTo(x, y + Math.sin(x / 210 + i) * 4);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(240,200,140,0.18)';
  ctx.fillRect(0, deskTop, W, 3);

  // a stack of books by the apprentice
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = ['#4a1e1a', '#2c3a28', '#3a2a18', '#28304a'][i]!;
    ctx.fillRect(40 + i * 6, 1010 - i * 26, 230 - i * 14, 24);
    ctx.fillStyle = 'rgba(217,164,65,0.4)';
    ctx.fillRect(40 + i * 6, 1010 - i * 26 + 10, 230 - i * 14, 2);
  }

  // corner vignette
  ctx.fillStyle = radial(ctx, W / 2, H * 0.42, W * 0.75, [[0.55, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.55)']]);
  ctx.fillRect(0, 0, W, H);
}

/** The typewriter body (keys, paper and counters are drawn live on top). */
export function paintTypewriter(ctx: Ctx): void {
  const cx = 960;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(cx, 1066, 360, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  // body: walnut trapezoid with brass trim
  ctx.beginPath();
  ctx.moveTo(cx - 300, 864);
  ctx.lineTo(cx + 300, 864);
  ctx.lineTo(cx + 350, 1064);
  ctx.lineTo(cx - 350, 1064);
  ctx.closePath();
  ctx.fillStyle = grad(ctx, 0, 864, 0, 1064, [[0, '#5b3a22'], [0.5, '#3d2616'], [1, '#26170d']]);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = grad(ctx, cx - 350, 0, cx + 350, 0, [[0, '#7a5a26'], [0.5, '#e2b860'], [1, '#7a5a26']]);
  ctx.stroke();
  // rivets
  ctx.fillStyle = '#d9b060';
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    ctx.beginPath();
    ctx.arc(cx - 330 + t * 660, 1050, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // typebar basket: a brass fan behind the platen
  ctx.save();
  ctx.translate(cx, 892);
  for (let i = -18; i <= 18; i++) {
    const a = (i / 18) * 1.05 - Math.PI / 2;
    ctx.strokeStyle = i % 2 ? 'rgba(170,130,60,0.9)' : 'rgba(120,90,45,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 30, Math.sin(a) * 30);
    ctx.lineTo(Math.cos(a) * 92, Math.sin(a) * 52);
    ctx.stroke();
  }
  ctx.restore();
  // platen roller and knobs
  ctx.fillStyle = grad(ctx, 0, 808, 0, 846, [[0, '#2a2420'], [0.4, '#4a423a'], [1, '#141110']]);
  ctx.fillRect(cx - 250, 808, 500, 38);
  for (const kx of [cx - 272, cx + 248]) {
    ctx.fillStyle = grad(ctx, kx, 0, kx + 24, 0, [[0, '#6a4a1a'], [0.5, '#f0c870'], [1, '#6a4a1a']]);
    ctx.fillRect(kx, 800, 24, 54);
    ctx.strokeStyle = 'rgba(40,25,10,0.6)';
    ctx.lineWidth = 1;
    for (let y = 804; y < 852; y += 4) {
      ctx.beginPath();
      ctx.moveTo(kx, y);
      ctx.lineTo(kx + 24, y);
      ctx.stroke();
    }
  }
  // carriage return lever
  ctx.strokeStyle = '#d8ac58';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx - 272, 812);
  ctx.quadraticCurveTo(cx - 330, 790, cx - 350, 760);
  ctx.stroke();
  // nameplate
  ctx.fillStyle = grad(ctx, cx - 70, 0, cx + 70, 0, [[0, '#7a5a26'], [0.5, '#f2cf7a'], [1, '#7a5a26']]);
  ctx.fillRect(cx - 70, 1034, 140, 16);
  ctx.fillStyle = '#3a2410';
  ctx.font = 'bold 12px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('TYPEL · ARCANA', cx, 1046);
}

/** Brass instruments on the desk: score counter, Combo dial, Volley tube and Ward vessel frames. */
export function paintInstruments(ctx: Ctx): void {
  const brass = (x: number) => grad(ctx, x, 0, x + 200, 0, [[0, '#6e4f1f'], [0.5, '#e6bd66'], [1, '#6e4f1f']]);
  // Score counter: a bolted brass box with a recessed window.
  ctx.fillStyle = brass(420);
  roundRect(ctx, 420, 726, 220, 86, 10);
  ctx.fill();
  ctx.fillStyle = '#120c08';
  roundRect(ctx, 434, 742, 192, 54, 6);
  ctx.fill();
  // Combo dial
  ctx.fillStyle = brass(440);
  ctx.beginPath();
  ctx.arc(530, 930, 92, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = grad(ctx, 0, 850, 0, 1010, [[0, '#f1e3c4'], [1, '#cdb88f']]);
  ctx.beginPath();
  ctx.arc(530, 930, 78, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3a2410';
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    ctx.lineWidth = i % 5 === 0 ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(530 + Math.cos(a) * 62, 930 + Math.sin(a) * 62);
    ctx.lineTo(530 + Math.cos(a) * 74, 930 + Math.sin(a) * 74);
    ctx.stroke();
  }
  // Volley tube frame
  ctx.fillStyle = brass(1330);
  roundRect(ctx, 1336, 728, 70, 20, 6);
  ctx.fill();
  roundRect(ctx, 1336, 1010, 70, 22, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(200,230,240,0.08)';
  roundRect(ctx, 1346, 746, 50, 266, 22);
  ctx.fill();
  ctx.strokeStyle = 'rgba(220,240,250,0.35)';
  ctx.lineWidth = 2;
  roundRect(ctx, 1346, 746, 50, 266, 22);
  ctx.stroke();
  // Ward vessel: a round-bottomed flask on a brass stand
  ctx.fillStyle = brass(1440);
  ctx.fillRect(1444, 1022, 130, 14);
  ctx.strokeStyle = 'rgba(220,240,250,0.4)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(1490, 760);
  ctx.lineTo(1490, 860);
  ctx.arc(1509, 945, 84, -Math.PI / 2 - 0.23, Math.PI * 1.5 + 0.23, true);
  ctx.lineTo(1528, 760);
  ctx.stroke();
  ctx.fillStyle = brass(1480);
  ctx.fillRect(1484, 748, 50, 14);
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

/** The apprentice: a hooded scholar seen from the side, lower left. */
export function paintApprentice(ctx: Ctx): void {
  ctx.save();
  ctx.translate(150, 760);
  // robe
  ctx.fillStyle = grad(ctx, -120, 0, 140, 0, [[0, '#120d14'], [0.6, '#2a1e2e'], [1, '#3b2b3c']]);
  ctx.beginPath();
  ctx.moveTo(-110, 330);
  ctx.quadraticCurveTo(-130, 120, -60, 20);
  ctx.quadraticCurveTo(-20, -40, 40, -30);
  ctx.quadraticCurveTo(120, 0, 130, 120);
  ctx.quadraticCurveTo(150, 240, 140, 330);
  ctx.closePath();
  ctx.fill();
  // hood
  ctx.fillStyle = grad(ctx, -60, -150, 80, 0, [[0, '#1c1420'], [1, '#3e2c40']]);
  ctx.beginPath();
  ctx.moveTo(-50, -10);
  ctx.quadraticCurveTo(-70, -120, 10, -160);
  ctx.quadraticCurveTo(90, -150, 92, -60);
  ctx.quadraticCurveTo(96, -10, 60, 10);
  ctx.closePath();
  ctx.fill();
  // face deep in the hood's shadow: only a cheek, a nose and two eye glints catch the light
  ctx.fillStyle = radial(ctx, 64, -72, 40, [[0, '#2a1c16'], [0.7, '#140d0d'], [1, 'rgba(20,13,13,0)']]);
  ctx.beginPath();
  ctx.ellipse(62, -70, 26, 36, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,214,150,0.75)';
  ctx.fillRect(70, -82, 3, 2);
  ctx.fillRect(80, -80, 3, 2);
  // a long grey beard spilling over the chest
  ctx.fillStyle = grad(ctx, 40, -50, 100, 40, [[0, '#8a8578'], [1, '#4a463e']]);
  ctx.beginPath();
  ctx.moveTo(48, -48);
  ctx.quadraticCurveTo(96, -50, 92, -10);
  ctx.quadraticCurveTo(86, 40, 70, 60);
  ctx.quadraticCurveTo(56, 20, 48, -48);
  ctx.fill();
  ctx.fillStyle = 'rgba(232,170,90,0.55)';
  ctx.beginPath();
  ctx.ellipse(80, -66, 6, 20, 0.2, -1.2, 1.4);
  ctx.fill();
  // arm reaching to the keys
  ctx.strokeStyle = '#2f2234';
  ctx.lineWidth = 34;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(60, 60);
  ctx.quadraticCurveTo(150, 120, 240, 150);
  ctx.stroke();
  ctx.fillStyle = '#6b4a35';
  ctx.beginPath();
  ctx.ellipse(252, 152, 18, 12, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // rim light along the hood
  ctx.strokeStyle = 'rgba(232,170,90,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(10, -158);
  ctx.quadraticCurveTo(90, -150, 92, -60);
  ctx.stroke();
  ctx.restore();
}

/** A parchment scroll body for a word of `w` screen pixels (rolled ends, optional wax seal). */
export function paintScroll(ctx: Ctx, w: number, h: number, spell: SpellId | null): void {
  const end = 14;
  const body = w - end * 2;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, end + 4, 8, body, h - 6, 4);
  ctx.fill();
  // sheet
  ctx.fillStyle = grad(ctx, 0, 0, 0, h, [[0, '#f3e6c4'], [0.5, PARCHMENT], [1, '#d6c095']]);
  ctx.fillRect(end, 4, body, h - 8);
  // aged edges
  ctx.fillStyle = 'rgba(120,80,40,0.18)';
  ctx.fillRect(end, 4, body, 3);
  ctx.fillRect(end, h - 7, body, 3);
  // rolled ends
  for (const x of [0, w - end * 2]) {
    ctx.fillStyle = grad(ctx, x, 0, x + end * 2, 0, [[0, '#a88a5c'], [0.45, '#f6ead0'], [1, '#8a6c42']]);
    roundRect(ctx, x, 0, end * 2, h, end);
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,45,20,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  if (spell) {
    const c = SPELL_HUE[spell];
    // ribbon band and wax seal
    ctx.fillStyle = c;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(end, h - 9, body, 5);
    ctx.globalAlpha = 1;
    ctx.fillStyle = radial(ctx, w - end, h / 2, 16, [[0, shade(c, 1.35)], [0.7, c], [1, shade(c, 0.55)]]);
    ctx.beginPath();
    ctx.arc(w - end, h / 2, 15, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Soft round glow used for candles, sparks and highlights. */
export function paintGlow(ctx: Ctx, size: number, color: string): void {
  ctx.fillStyle = radial(ctx, size / 2, size / 2, size / 2, [[0, color], [0.25, color.replace(/[\d.]+\)$/, '0.45)')], [1, color.replace(/[\d.]+\)$/, '0)')]]);
  ctx.fillRect(0, 0, size, size);
}

export function paintFlame(ctx: Ctx): void {
  ctx.fillStyle = radial(ctx, 16, 30, 26, [[0, 'rgba(255,248,220,1)'], [0.35, 'rgba(255,200,90,0.95)'], [0.7, 'rgba(230,110,40,0.6)'], [1, 'rgba(200,60,20,0)']]);
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.quadraticCurveTo(30, 26, 24, 40);
  ctx.quadraticCurveTo(16, 48, 8, 40);
  ctx.quadraticCurveTo(2, 26, 16, 0);
  ctx.fill();
}

export function paintKey(ctx: Ctx, pressed: boolean): void {
  ctx.fillStyle = grad(ctx, 0, 0, 40, 0, [[0, '#6e4f1f'], [0.5, '#e6bd66'], [1, '#6e4f1f']]);
  ctx.beginPath();
  ctx.arc(20, 20, 19, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pressed ? '#cdb88f' : grad(ctx, 0, 4, 0, 36, [[0, '#fbf1da'], [1, '#d8c59c']]);
  ctx.beginPath();
  ctx.arc(20, 20, 15, 0, Math.PI * 2);
  ctx.fill();
}
