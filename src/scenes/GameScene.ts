import Phaser from 'phaser';
import { GameEngine } from '../core/GameEngine';
import type { GameResult } from '../core/GameEvents';
import { PALETTE, SIMULATION_STEP_MS } from '../core/GameConfig';
import { createSeed } from '../core/Random';
import { WORDS } from '../data/wordList';
import type { DifficultyConfig } from '../difficulty/DifficultyConfig';
import { PROTOTYPE_LEVEL } from '../difficulty/LevelDefinitions';
import type { GameStats } from '../gameplay/ScoringSystem';
import { Effects } from '../render/Effects';
import { FieldBackground } from '../render/FieldBackground';
import { LAYOUT } from '../render/layout';
import { WordView } from '../render/WordView';
import { GameHUD } from '../ui/GameHUD';
import { OverlayPanel } from '../ui/OverlayPanel';

export interface GameSceneData {
  config?: DifficultyConfig;
  seed?: number;
}

/** Longest real-time gap simulated in one frame (avoids a burst after a stall). */
const MAX_FRAME_MS = 250;

/**
 * Connects the GameEngine (rules) to the screen and keyboard. The scene owns
 * no game rules: it forwards input to the engine, steps it at a fixed rate
 * and draws what the engine reports.
 */
export class GameScene extends Phaser.Scene {
  static readonly KEY = 'GameScene';

  private engine!: GameEngine;
  private config!: DifficultyConfig;
  private readonly views = new Map<number, WordView>();
  private background!: FieldBackground;
  private effects!: Effects;
  private hud!: GameHUD;
  private overlay!: OverlayPanel;
  private accumulator = 0;
  private paused = false;

  constructor() {
    super(GameScene.KEY);
  }

  init(data: GameSceneData): void {
    this.config = data.config ?? PROTOTYPE_LEVEL;
    this.engine = new GameEngine({ config: this.config, seed: data.seed ?? createSeed(), words: WORDS });
    this.views.clear();
    this.accumulator = 0;
    this.paused = false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.midnight);
    this.background = new FieldBackground(this);
    this.effects = new Effects(this);
    const levelName = `Level ${this.config.level} · ${this.config.name}`;
    this.hud = new GameHUD(this, levelName, this.config.requiredWords);
    this.overlay = new OverlayPanel(this);

    this.wireEngineEvents();

    const keyboard = this.input.keyboard!;
    keyboard.on('keydown', this.onKeyDown, this);
    // Stop the browser acting on keys the game uses.
    keyboard.addCapture('BACKSPACE,SPACE,TAB');
    this.input.on('pointerdown', this.onPointerDown, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.onBlur, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.off('keydown', this.onKeyDown, this);
      this.input.off('pointerdown', this.onPointerDown, this);
      this.game.events.off(Phaser.Core.Events.BLUR, this.onBlur, this);
      this.engine.events.clear();
      this.views.clear();
    });

    if (import.meta.env.DEV) {
      (window as unknown as { spellboundEngine: GameEngine }).spellboundEngine = this.engine;
    }
  }

  override update(_time: number, delta: number): void {
    if (this.paused || this.engine.status !== 'playing') return;

    this.accumulator += Math.min(delta, MAX_FRAME_MS);
    while (this.accumulator >= SIMULATION_STEP_MS && this.engine.status === 'playing') {
      this.engine.step();
      this.accumulator -= SIMULATION_STEP_MS;
    }

    const alpha = this.accumulator / SIMULATION_STEP_MS;
    for (const view of this.views.values()) view.sync(alpha);
    this.hud.updateStats(this.engine.stats(), this.engine.state.combo);
  }

  // ───────────────────────── engine → screen ─────────────────────────

  private wireEngineEvents(): void {
    const ev = this.engine.events;

    ev.on('wordSpawned', ({ word }) => {
      this.views.set(word.id, new WordView(this, word));
    });

    ev.on('wordCompleted', ({ word, points, combo }) => {
      const view = this.views.get(word.id);
      const x = view?.x ?? word.x;
      const y = view?.y ?? LAYOUT.spawnY + word.y;
      this.removeView(word.id);
      this.effects.wordDestroyed(x, y, word.text.length, points);
      if (combo > 1) this.hud.pulseCombo();
    });

    ev.on('wordMissed', ({ word }) => {
      this.removeView(word.id);
      this.effects.wordBrokeThrough(word.x, LAYOUT.wardY);
      this.background.flashMiss();
    });

    ev.on('typingError', ({ wordId }) => {
      if (wordId !== null) this.views.get(wordId)?.flashError();
      else this.cameras.main.shake(60, 0.0015);
    });

    ev.on('instabilityChanged', ({ value, stage }) => {
      this.hud.setInstability(value, stage);
      this.background.setStage(stage);
    });

    ev.on('gameOver', ({ result, stats }) => {
      // Let the final effect play before the panel appears.
      this.time.delayedCall(500, () => this.showGameOver(result, stats));
    });
  }

  private removeView(id: number): void {
    this.views.get(id)?.destroy();
    this.views.delete(id);
  }

  private showGameOver(result: GameResult, stats: GameStats): void {
    const won = result === 'won';
    const seconds = Math.round(stats.elapsedMs / 1000);
    this.overlay.show({
      title: won ? 'Tower Defended' : 'The Wards Have Fallen',
      titleColor: won ? PALETTE.gold : PALETTE.crimson,
      lines: [
        `Score   ${stats.score}`,
        `Words   ${stats.completed} completed · ${stats.missed} missed`,
        `Accuracy   ${Math.round(stats.accuracy * 100)}%    WPM   ${Math.round(stats.wpm)}`,
        `Best combo   ×${stats.maxCombo}    Time   ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
      ],
      hint: 'Enter  Play again        M  Main menu',
    });
  }

  // ───────────────────────── input → engine ─────────────────────────

  private onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key;

    if (this.engine.status !== 'playing') {
      if (!this.overlay.visible) return;
      if (key === 'Enter') this.scene.restart({ config: this.config });
      else if (key === 'm' || key === 'M') this.scene.start('MainMenuScene');
      return;
    }

    if (key === 'Escape') return this.setPaused(!this.paused);
    if (this.paused) {
      if (key === 'm' || key === 'M') this.scene.start('MainMenuScene');
      return;
    }

    if (event.repeat) return; // holding a key down should not type it repeatedly
    if (key === 'Backspace') return this.engine.abandon();
    if (key.length === 1) this.engine.typeChar(key);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.paused || this.engine.status !== 'playing') return;
    for (const view of this.views.values()) {
      if (view.hitTest(pointer.worldX, pointer.worldY)) {
        this.engine.selectTarget(view.word.id);
        return;
      }
    }
  }

  private onBlur(): void {
    if (this.engine.status === 'playing') this.setPaused(true);
  }

  private setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      this.tweens.pauseAll();
      this.overlay.show({
        title: 'Paused',
        lines: ['The words hang in the air, waiting.'],
        hint: 'Esc  Resume        M  Main menu',
      });
    } else {
      this.tweens.resumeAll();
      this.overlay.hide();
      this.accumulator = 0;
    }
  }
}
