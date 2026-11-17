import Phaser from 'phaser';
import { SPARK_TEXTURE } from '../render/Effects';
import { ART } from '../render/layout';

/** Game-level event fired once shared assets are ready. */
export const BOOT_COMPLETE = 'wizzytype-boot-complete';

/** Longest we wait for the web fonts before starting anyway (with fallback fonts). */
const FONT_TIMEOUT_MS = 3000;

/**
 * First scene to run. Loads the pixel art and fonts and prepares shared
 * textures, then tells the app it can show the main menu.
 */
export class BootScene extends Phaser.Scene {
  static readonly KEY = 'BootScene';

  constructor() {
    super(BootScene.KEY);
  }

  preload(): void {
    for (const t of ART.themes) {
      this.load.image(`bg-${t}`, `assets/art/backdrop-${t}.png`);
      this.load.image(`front-${t}`, `assets/art/front-${t}.png`);
    }
    this.load.image(ART.menu, 'assets/art/menu.png');
    this.load.image(ART.library, 'assets/art/library.png');
    this.load.image(ART.wizard(), 'assets/art/wizard-apprentice-a-game.png');
    this.load.spritesheet(ART.icons, 'assets/spells/icons.png', { frameWidth: 12, frameHeight: 12 });
  }

  create(): void {
    // Pixel art stays crisp when scaled up.
    const keys = [...ART.themes.flatMap((t) => [`bg-${t}`, `front-${t}`]), ART.menu, ART.library, ART.wizard()];
    for (const key of [...keys, ART.icons]) {
      if (this.textures.exists(key)) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.createSparkTexture();
    void this.waitForFonts().then(() => {
      this.scene.stop();
      this.game.events.emit(BOOT_COMPLETE);
    });
  }

  /** Phaser draws text once, so the fonts must be ready before the first word appears. */
  private async waitForFonts(): Promise<void> {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts) return;
    const load = Promise.all([
      fonts.load('700 24px "Atkinson Hyperlegible"'),
      fonts.load('400 24px "Atkinson Hyperlegible"'),
      fonts.load('600 24px "Pixelify Sans"'),
    ]).then(() => undefined);
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS));
    try {
      await Promise.race([load, timeout]);
    } catch {
      // Offline or blocked: fall back to system fonts.
    }
  }

  /** A soft white dot used by particle effects (tinted per effect). */
  private createSparkTexture(): void {
    if (this.textures.exists(SPARK_TEXTURE)) return;
    const size = 16;
    const g = this.make.graphics({}, false);
    for (let r = size / 2; r > 0; r--) {
      g.fillStyle(0xffffff, 0.15 + 0.85 * (1 - r / (size / 2)) ** 2);
      g.fillCircle(size / 2, size / 2, r);
    }
    g.generateTexture(SPARK_TEXTURE, size, size);
    g.destroy();
  }
}
