import Phaser from 'phaser';
import { FONTS, PALETTE } from '../core/GameConfig';
import type { Bonus, BonusId } from '../gameplay/ScoringSystem';
import { hex, LAYOUT } from './layout';

/**
 * The game's sense of occasion (decisions.md D-040): bonus labels, multiplier
 * fanfares and the end-of-level finale. The world is grim; the celebrations are
 * not. Serious tone, played completely straight, until it isn't.
 */

/** Label and deadpan subtitle for each bonus. */
export const BONUS_TEXT: Record<BonusId, { label: string; quip: string }> = {
  perfect: { label: 'Perfect', quip: 'Not a single slip' },
  quick: { label: 'Quick', quip: 'Barely had time to fall' },
  clutch: { label: 'Clutch', quip: 'Unnecessarily close' },
  arcane: { label: 'Arcane Word', quip: 'Pronunciation optional' },
  long: { label: 'Long Word', quip: 'A word of some length' },
  name: { label: 'Name-Caller', quip: 'They heard you' },
  volley: { label: 'Volley', quip: 'Rapid, if not elegant' },
  alliteration: { label: 'Alliteration', quip: 'How very poetic' },
  librarian: { label: 'Librarian', quip: 'Alphabetised' },
  metronome: { label: 'Metronome', quip: 'Tick. Tock. Type.' },
  sweep: { label: 'Clean Sweep', quip: 'Spotless' },
  flawless: { label: 'Flawless', quip: 'Not one scroll lost' },
  underPar: { label: 'Under Par', quip: 'Suspiciously efficient' },
  comeback: { label: 'Comeback', quip: 'It was never in doubt' },
};

/** Which bonuses to name on screen first (rare and skilful ones), most interesting first. */
const SHOW_ORDER: BonusId[] = ['sweep', 'clutch', 'alliteration', 'librarian', 'volley', 'name', 'metronome', 'arcane', 'long', 'quick'];

const TIER_TITLES = ['', 'Double', 'Triple', 'Quintuple', 'Decuple'];

const BANNERS = [
  'ORTHOGRAPHIA EXTREMA',
  'MAGNIFICENT LITERACY',
  'SPELLING: ACHIEVED',
  'LEXICAL TRIUMPH',
  'THE WORDS HAVE BEEN SEEN TO',
  'GLORIOUS PENMANSHIP',
];
const BOSS_BANNERS = ['THE SILENCE RECEDES', 'KNOWLEDGE ENDURES', 'THE ARCHIVE STANDS'];
const QUIPS = [
  'The Apprentice nods, once.',
  'Somewhere, a choir was paid for this.',
  'Mild applause from the owl.',
  'The ink is still wet.',
  'This will be mentioned in the minutes.',
];

const style = (size: number, color: number, family: string = FONTS.heading): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: family,
  fontSize: `${size}px`,
  fontStyle: '700',
  color: hex(color),
  stroke: hex(PALETTE.midnight),
  strokeThickness: Math.max(4, Math.round(size / 6)),
  align: 'center',
});

const CONFETTI = 'confetti';

export class Celebrations {
  constructor(private readonly scene: Phaser.Scene) {
    if (!scene.textures.exists(CONFETTI)) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1).fillRect(0, 0, 6, 4);
      g.generateTexture(CONFETTI, 6, 4);
      g.destroy();
    }
  }

  /** Names the most interesting bonuses of a captured word under its points. */
  wordBonuses(x: number, y: number, bonuses: readonly Bonus[]): void {
    const shown = SHOW_ORDER.map((id) => bonuses.find((b) => b.id === id)).filter((b): b is Bonus => !!b).slice(0, 2);
    shown.forEach((b, i) => {
      const t = BONUS_TEXT[b.id];
      const chain = b.count > 1 ? ` ×${b.count}` : '';
      const big = b.id === 'sweep' || b.id === 'clutch' || (b.count >= 3 && b.id !== 'volley');
      const text = big ? `${t.label.toUpperCase()}${chain}\n${t.quip}` : `${t.label.toUpperCase()}${chain}`;
      this.rise(x, y + 26 + i * 24, text, big ? PALETTE.magentaGlow : PALETTE.parchment, big ? 18 : 15, 160 * i, 1300);
    });
  }

  /** A new multiplier tier: a proclamation across the field. */
  tierUp(multiplier: number, tier: number): void {
    const cx = (LAYOUT.fieldLeft + LAYOUT.fieldRight) / 2;
    const cy = LAYOUT.wardY * 0.45;
    const color = [PALETTE.parchment, 0x5ad0c0, PALETTE.gold, PALETTE.magentaGlow, 0xff5a4a][tier] ?? PALETTE.gold;
    const title = this.scene.add.text(cx, cy, `×${multiplier}`, style(64 + tier * 10, color)).setOrigin(0.5).setDepth(38);
    const sub = this.scene.add
      .text(cx, cy + 50 + tier * 5, `${TIER_TITLES[tier] ?? ''} Multiplier`.toUpperCase(), style(20, PALETTE.parchment, FONTS.gameplay))
      .setOrigin(0.5)
      .setDepth(38);
    for (const t of [title, sub]) {
      t.setScale(0.4).setAlpha(0);
      this.scene.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 260, ease: 'Back.Out' });
      this.scene.tweens.add({ targets: t, alpha: 0, y: t.y - 30, delay: 900, duration: 500, onComplete: () => t.destroy() });
    }
    this.flash(color, 0.12 + tier * 0.04);
    if (tier >= 3) this.scene.cameras.main.shake(180, 0.003);
  }

  /** The level is won. Slow, operatic, unnecessary. Returns its length in ms. */
  finale(boss: boolean, levelBonuses: readonly Bonus[], levelScore: number): number {
    const scene = this.scene;
    const cam = scene.cameras.main;
    const cx = LAYOUT.width / 2;
    const cy = LAYOUT.wardY * 0.4;
    cam.zoomTo(1.06, 500, 'Sine.Out');
    this.flash(0xfff4d8, 0.5);
    cam.shake(250, 0.004);

    // Parchment confetti from the top of the window.
    const confetti = scene.add
      .particles(0, -10, CONFETTI, {
        x: { min: LAYOUT.fieldLeft, max: LAYOUT.fieldRight },
        speedY: { min: 80, max: 220 },
        speedX: { min: -60, max: 60 },
        rotate: { start: 0, end: 540 },
        lifespan: 2800,
        gravityY: 120,
        scale: { min: 1, max: 2.2 },
        tint: [PALETTE.parchment, PALETTE.gold, PALETTE.magentaGlow, 0x5ad0c0],
        quantity: 6,
        frequency: 30,
      })
      .setDepth(37);
    scene.time.delayedCall(1300, () => confetti.stop());
    scene.time.delayedCall(4200, () => confetti.destroy());

    const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;
    const banner = scene.add.text(cx, cy, pick(boss ? BOSS_BANNERS : BANNERS), style(56, PALETTE.gold)).setOrigin(0.5).setDepth(39);
    const quip = scene.add.text(cx, cy + 52, pick(QUIPS), style(18, PALETTE.parchment, FONTS.gameplay)).setOrigin(0.5).setDepth(39).setAlpha(0);
    banner.setScale(3).setAlpha(0);
    scene.tweens.add({ targets: banner, scale: 1, alpha: 1, duration: 420, ease: 'Back.Out' });
    scene.tweens.add({ targets: banner, scale: 1.04, yoyo: true, repeat: 3, duration: 380, delay: 420 });
    scene.tweens.add({ targets: quip, alpha: 0.9, delay: 700, duration: 400 });

    // The tally: each end-of-level bonus, then the level's total.
    let t = 1100;
    levelBonuses.forEach((b, i) => {
      const line = `${BONUS_TEXT[b.id].label.toUpperCase()}  +${b.points.toLocaleString()}`;
      const label = scene.add
        .text(cx, cy + 100 + i * 34, line, style(24, PALETTE.magentaGlow, FONTS.gameplay))
        .setOrigin(0.5)
        .setDepth(39)
        .setAlpha(0);
      scene.tweens.add({ targets: label, alpha: 1, x: { from: cx - 40, to: cx }, delay: t, duration: 260 });
      t += 380;
    });
    const total = scene.add
      .text(cx, cy + 110 + levelBonuses.length * 34, `LEVEL SCORE  ${levelScore.toLocaleString()}`, style(28, PALETTE.parchment, FONTS.gameplay))
      .setOrigin(0.5)
      .setDepth(39)
      .setAlpha(0);
    scene.tweens.add({ targets: total, alpha: 1, scale: { from: 1.4, to: 1 }, delay: t, duration: 320, ease: 'Back.Out' });
    return t + 1600;
  }

  private flash(color: number, alpha: number): void {
    const f = this.scene.add.rectangle(0, 0, LAYOUT.width, LAYOUT.height, color, alpha).setOrigin(0).setDepth(36);
    f.setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: f, alpha: 0, duration: 450, onComplete: () => f.destroy() });
  }

  private rise(x: number, y: number, text: string, color: number, size: number, delay: number, life: number): void {
    const label = this.scene.add.text(x, y, text, style(size, color, FONTS.gameplay)).setOrigin(0.5).setDepth(22).setAlpha(0);
    this.scene.tweens.add({ targets: label, alpha: 1, delay, duration: 120 });
    this.scene.tweens.add({
      targets: label,
      y: y - 40,
      alpha: 0,
      delay: delay + life * 0.6,
      duration: life * 0.4,
      ease: 'Cubic.In',
      onComplete: () => label.destroy(),
    });
  }
}
