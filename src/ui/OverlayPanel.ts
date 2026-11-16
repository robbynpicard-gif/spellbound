import Phaser from 'phaser';
import { FONTS, PALETTE } from '../core/GameConfig';
import { hex, LAYOUT } from '../render/layout';

export interface OverlayContent {
  title: string;
  titleColor?: number;
  lines?: string[];
  hint: string;
}

/**
 * A centred modal panel used for Pause and the end-of-game summary.
 * (The full Results screen arrives in Milestone 2.)
 */
export class OverlayPanel {
  private readonly container: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const cx = LAYOUT.width / 2;
    const cy = LAYOUT.height / 2;
    const shade = scene.add.rectangle(cx, cy, LAYOUT.width, LAYOUT.height, PALETTE.midnight, 0.78);
    const panel = scene.add.graphics();
    panel.fillStyle(PALETTE.charcoal, 0.96);
    panel.fillRoundedRect(cx - 300, cy - 190, 600, 380, 16);
    panel.lineStyle(2, PALETTE.gold, 0.7);
    panel.strokeRoundedRect(cx - 300, cy - 190, 600, 380, 16);

    this.title = scene.add
      .text(cx, cy - 140, '', { fontFamily: FONTS.heading, fontSize: '44px', color: hex(PALETTE.gold) })
      .setOrigin(0.5);
    this.body = scene.add
      .text(cx, cy - 10, '', {
        fontFamily: FONTS.gameplay,
        fontSize: '22px',
        color: hex(PALETTE.parchment),
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5);
    this.hint = scene.add
      .text(cx, cy + 150, '', { fontFamily: FONTS.gameplay, fontSize: '18px', color: hex(PALETTE.parchment) })
      .setOrigin(0.5)
      .setAlpha(0.75);

    this.container = scene.add
      .container(0, 0, [shade, panel, this.title, this.body, this.hint])
      .setDepth(100)
      .setVisible(false);
  }

  get visible(): boolean {
    return this.container.visible;
  }

  show(content: OverlayContent): void {
    this.title.setText(content.title).setColor(hex(content.titleColor ?? PALETTE.gold));
    this.body.setText((content.lines ?? []).join('\n'));
    this.hint.setText(content.hint);
    // Shown instantly: Pause freezes all tweens, so a fade-in would never finish.
    this.container.setVisible(true);
  }

  hide(): void {
    this.container.setVisible(false);
  }
}
