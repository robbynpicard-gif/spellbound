import Phaser from 'phaser';
import { FONTS, PALETTE } from '../core/GameConfig';
import type { Bonus } from '../gameplay/ScoringSystem';
import { BONUS_TEXT } from './Celebrations';
import { hex } from './layout';

/**
 * The intake (D-057): a captured word is swept off the field to the wizard's
 * desk, where its points and bonuses are read out. Keeping that text in the
 * margin instead of over the field means a bonus can never hide a falling word.
 */
const COLUMN_X = 78;
/** Where a captured word lands, and how far its readout drifts up before fading. */
const LANDING_Y = 452;
const RISE = 150;
const FLIGHT_MS = 230;

const style = (size: number, color: number, font = FONTS.gameplay) => ({
  fontFamily: font,
  fontSize: `${size}px`,
  color: hex(color),
  align: 'center' as const,
  stroke: hex(PALETTE.midnight),
  strokeThickness: 4,
});

export class Intake {
  private readonly layer: Phaser.GameObjects.Container;

  constructor(private readonly scene: Phaser.Scene) {
    // A dark strip behind the readout, so it stays legible over the shelves.
    const backing = scene.add
      .rectangle(COLUMN_X, (LANDING_Y - RISE + LANDING_Y) / 2, 140, RISE + 70, PALETTE.midnight, 0.4)
      .setOrigin(0.5)
      .setDepth(18);
    this.layer = scene.add.container(0, 0, [backing]).setDepth(19);
  }

  /**
   * Sweeps a captured word to the desk, then reads out what it was worth.
   * Returns at once; the animation runs on its own.
   */
  claim(fromX: number, fromY: number, text: string, points: number, multiplier: number, bonuses: readonly Bonus[]): void {
    const flying = this.scene.add.text(fromX, fromY, text, style(22, PALETTE.parchment)).setOrigin(0.5).setDepth(21);
    this.scene.tweens.add({
      targets: flying,
      x: COLUMN_X,
      y: LANDING_Y,
      scale: 0.55,
      alpha: 0.2,
      duration: FLIGHT_MS,
      ease: 'Quad.easeIn',
      onComplete: () => {
        flying.destroy();
        this.readout(points, multiplier, bonuses);
      },
    });
  }

  /** Points first, then any bonus names under them, all drifting up together. */
  private readout(points: number, multiplier: number, bonuses: readonly Bonus[]): void {
    const label = multiplier > 1 ? `+${points.toLocaleString()}\n×${multiplier}` : `+${points.toLocaleString()}`;
    this.rise(label, PALETTE.gold, 24, 0);
    const shown = bonuses.slice(0, 3);
    shown.forEach((b, i) => {
      const chain = b.count > 1 ? ` ×${b.count}` : '';
      const big = b.id === 'sweep' || b.id === 'clutch';
      this.rise(`${BONUS_TEXT[b.id].label.toUpperCase()}${chain}`, big ? PALETTE.magentaGlow : PALETTE.parchment, big ? 17 : 14, 70 + i * 20);
    });
  }

  private rise(text: string, color: number, size: number, offset: number): void {
    const label = this.scene.add
      .text(COLUMN_X, LANDING_Y + offset, text, style(size, color))
      .setOrigin(0.5)
      .setDepth(21)
      .setScale(0.6);
    this.layer.add(label);
    this.scene.tweens.add({ targets: label, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.scene.tweens.add({
      targets: label,
      y: LANDING_Y + offset - RISE,
      alpha: 0,
      delay: 260,
      duration: 900,
      ease: 'Sine.easeOut',
      onComplete: () => label.destroy(),
    });
  }
}
