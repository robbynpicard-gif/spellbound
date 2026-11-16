import Phaser from 'phaser';
import { FONTS, PALETTE } from '../core/GameConfig';
import type { InstabilityStage } from '../gameplay/InstabilityManager';
import type { GameStats } from '../gameplay/ScoringSystem';
import { hex, LAYOUT } from '../render/layout';

const METER_COLORS: Record<InstabilityStage, number> = {
  0: PALETTE.arcane,
  1: PALETTE.gold,
  2: PALETTE.fire,
  3: PALETTE.crimson,
  4: PALETTE.crimson,
};

const label = (color: number = PALETTE.parchment): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: FONTS.gameplay,
  fontSize: '20px',
  color: hex(color),
});

/**
 * Heads-up display: level, score, combo, words, accuracy, WPM, pause hint
 * and the tower instability meter.
 */
export class GameHUD {
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly comboText: Phaser.GameObjects.Text;
  private readonly wordsText: Phaser.GameObjects.Text;
  private readonly accuracyText: Phaser.GameObjects.Text;
  private readonly meter: Phaser.GameObjects.Graphics;
  private readonly meterText: Phaser.GameObjects.Text;
  private shownValue = 0;
  private readonly meterTween = { value: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    levelName: string,
    private readonly quota: number | null,
  ) {
    const bar = scene.add.graphics().setDepth(30);
    bar.fillStyle(PALETTE.midnight, 0.85);
    bar.fillRect(0, 0, LAYOUT.width, LAYOUT.hudHeight);
    bar.lineStyle(1, PALETTE.gold, 0.35);
    bar.lineBetween(0, LAYOUT.hudHeight, LAYOUT.width, LAYOUT.hudHeight);

    const y = LAYOUT.hudHeight / 2;
    const levelText = scene.add
      .text(20, y, levelName, { ...label(PALETTE.gold), fontFamily: FONTS.heading, fontSize: '22px' })
      .setOrigin(0, 0.5)
      .setDepth(31);
    // Fixed columns after the level name, so values changing width don't make the bar jitter.
    const x0 = Math.max(240, levelText.x + levelText.width + 36);
    this.scoreText = scene.add.text(x0, y, '', label()).setOrigin(0, 0.5).setDepth(31);
    this.comboText = scene.add.text(x0 + 170, y, '', label()).setOrigin(0, 0.5).setDepth(31);
    this.wordsText = scene.add.text(x0 + 300, y, '', label()).setOrigin(0, 0.5).setDepth(31);
    this.accuracyText = scene.add.text(x0 + 470, y, '', label()).setOrigin(0, 0.5).setDepth(31);
    scene.add
      .text(LAYOUT.width - 20, y, 'Esc  Pause', { ...label(), fontSize: '16px' })
      .setOrigin(1, 0.5)
      .setAlpha(0.6)
      .setDepth(31);

    this.meter = scene.add.graphics().setDepth(30);
    this.meterText = scene.add
      .text(LAYOUT.width / 2, LAYOUT.meterY, '', { ...label(), fontSize: '15px', fontStyle: '600' })
      .setOrigin(0.5)
      .setDepth(31);

    this.updateStats(null);
    this.drawMeter(0, 0);
  }

  updateStats(stats: GameStats | null, combo = 0): void {
    const s = stats;
    this.scoreText.setText(`Score  ${s?.score ?? 0}`);
    this.comboText
      .setText(`Combo  ×${combo}`)
      .setColor(hex(combo >= 5 ? PALETTE.gold : PALETTE.parchment));
    const done = s?.completed ?? 0;
    this.wordsText.setText(this.quota === null ? `Words  ${done}` : `Words  ${done} / ${this.quota}`);
    const acc = s ? Math.round(s.accuracy * 100) : 100;
    const wpm = s ? Math.round(s.wpm) : 0;
    this.accuracyText.setText(`Accuracy  ${acc}%    WPM  ${wpm}`);
  }

  pulseCombo(): void {
    this.scene.tweens.add({ targets: this.comboText, scale: { from: 1.25, to: 1 }, duration: 200 });
  }

  /** Animate the meter to a new instability value (0–100). */
  setInstability(value: number, stage: InstabilityStage): void {
    this.scene.tweens.killTweensOf(this.meterTween);
    this.meterTween.value = this.shownValue;
    this.scene.tweens.add({
      targets: this.meterTween,
      value,
      duration: 350,
      ease: 'Cubic.Out',
      onUpdate: () => this.drawMeter(this.meterTween.value, stage),
    });
  }

  private drawMeter(value: number, stage: InstabilityStage): void {
    this.shownValue = value;
    const w = 520;
    const h = 14;
    const x = (LAYOUT.width - w) / 2;
    const y = LAYOUT.meterY - h / 2;
    const g = this.meter;
    g.clear();
    g.fillStyle(PALETTE.midnight, 0.9);
    g.fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 8);
    if (value > 0) {
      g.fillStyle(METER_COLORS[stage], 0.95);
      g.fillRoundedRect(x, y, Math.max(h, (w * value) / 100), h, 6);
    }
    g.lineStyle(1, PALETTE.gold, 0.5);
    g.strokeRoundedRect(x - 2, y - 2, w + 4, h + 4, 8);
    this.meterText.setText(`WARD INSTABILITY  ${Math.round(value)}%`);
  }
}
