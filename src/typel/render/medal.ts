/**
 * Rune medals (D-089). Every Rune has its own visual identity:
 *  - shape by category: typing = milled coin, wordplay = lozenge,
 *    spellcraft = heater shield, participation = cracked wooden token;
 *  - metal by tier: bronze, silver, gold (with ribbon tails at tier 3);
 *  - enamel by family (spell colour for spellcraft) and a unique emblem.
 * Pure Canvas 2D so the game and the Codex draw the same medal.
 */
import type { RuneDef } from '../../gameplay/runes/RuneCatalogue';
import { SPELL_HUE } from './paint';

const METAL: Record<1 | 2 | 3, [string, string, string]> = {
  1: ['#5a3418', '#c88a4a', '#f0c08a'],
  2: ['#4a4c54', '#b8bcc6', '#f4f6fa'],
  3: ['#6a4a10', '#e0b040', '#fff0b0'],
};
const ENAMEL: Record<string, string> = {
  Quill: '#1e2c5a', Timing: '#22404a', Catch: '#6a2a10', Flawless: '#5a0e16', Nouns: '#1e4a2a', Letters: '#3a2a5a', Fumble: '#4a3a2a',
};

export function medalEnamel(rune: RuneDef): string {
  if (rune.spell) return SPELL_HUE[rune.spell];
  return ENAMEL[rune.family] ?? '#2a2a3a';
}

function path(ctx: CanvasRenderingContext2D, kind: RuneDef['category'], c: number, r: number): void {
  ctx.beginPath();
  if (kind === 'wordplay') {
    ctx.moveTo(c, c - r);
    ctx.lineTo(c + r * 0.86, c);
    ctx.lineTo(c, c + r);
    ctx.lineTo(c - r * 0.86, c);
    ctx.closePath();
  } else if (kind === 'spellcraft') {
    ctx.moveTo(c - r * 0.85, c - r * 0.8);
    ctx.lineTo(c + r * 0.85, c - r * 0.8);
    ctx.lineTo(c + r * 0.85, c);
    ctx.quadraticCurveTo(c + r * 0.8, c + r * 0.7, c, c + r);
    ctx.quadraticCurveTo(c - r * 0.8, c + r * 0.7, c - r * 0.85, c);
    ctx.closePath();
  } else if (kind === 'participation') {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const rr = r * (i % 3 === 1 ? 0.88 : 1);
      ctx.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr);
    }
    ctx.closePath();
  } else ctx.arc(c, c, r, 0, Math.PI * 2);
}

export function paintMedal(ctx: CanvasRenderingContext2D, size: number, rune: RuneDef): void {
  const c = size / 2;
  const r = size * 0.4;
  const wood = rune.category === 'participation';
  const [dark, mid, light] = wood ? ['#3a2412', '#7a5230', '#b0805a'] : METAL[rune.tier];
  // ribbon tails for the rarest
  if (rune.tier === 3 && !wood) {
    for (const s of [-1, 1]) {
      ctx.fillStyle = s < 0 ? '#7a1a1a' : '#1a2a6a';
      ctx.beginPath();
      ctx.moveTo(c + s * r * 0.2, c + r * 0.4);
      ctx.lineTo(c + s * r * 0.75, c + r * 1.2);
      ctx.lineTo(c + s * r * 0.5, c + r * 1.05);
      ctx.lineTo(c + s * r * 0.35, c + r * 1.25);
      ctx.lineTo(c, c + r * 0.5);
      ctx.fill();
    }
  }
  // rim
  const g = ctx.createLinearGradient(c - r, c - r, c + r, c + r);
  g.addColorStop(0, light);
  g.addColorStop(0.5, mid);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  path(ctx, rune.category, c, r);
  ctx.fill();
  // milled edge on coins
  if (rune.category === 'typing') {
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * r * 0.92, c + Math.sin(a) * r * 0.92);
      ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
      ctx.stroke();
    }
  }
  // enamel field
  const e = ctx.createRadialGradient(c - r * 0.2, c - r * 0.25, 0, c, c, r * 0.75);
  const enamel = wood ? '#5a3a20' : medalEnamel(rune);
  e.addColorStop(0, '#ffffff55');
  e.addColorStop(0.25, enamel);
  e.addColorStop(1, '#00000088');
  ctx.save();
  ctx.translate(c, c);
  ctx.scale(0.74, 0.74);
  ctx.translate(-c, -c);
  path(ctx, rune.category, c, r);
  ctx.fillStyle = enamel;
  ctx.fill();
  ctx.fillStyle = e;
  ctx.fill();
  ctx.restore();
  // a crack across the wooden fumble tokens
  if (wood) {
    ctx.strokeStyle = '#1a0e06';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c - r * 0.6, c - r * 0.5);
    ctx.lineTo(c - r * 0.1, c - r * 0.05);
    ctx.lineTo(c - r * 0.25, c + r * 0.2);
    ctx.lineTo(c + r * 0.5, c + r * 0.65);
    ctx.stroke();
  }
  // emblem
  ctx.fillStyle = wood ? '#e8d0a8' : light;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = Math.max(1, size / 60);
  ctx.font = `700 ${Math.round(size * 0.36)}px "Segoe UI Symbol", "Noto Sans Symbols", "DejaVu Sans", Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(rune.glyph, c, c + size * 0.02);
  ctx.fillText(rune.glyph, c, c + size * 0.02);
  // tier pips
  for (let i = 0; i < rune.tier; i++) {
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.arc(c + (i - (rune.tier - 1) / 2) * size * 0.09, c - r * 0.92 + (rune.category === 'spellcraft' ? size * 0.06 : 0), size * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A data URL of a Rune's medal, for the Codex. */
export function medalDataUrl(rune: RuneDef, size = 72): string {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  paintMedal(cv.getContext('2d')!, size, rune);
  return cv.toDataURL();
}
