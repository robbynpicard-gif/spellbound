import Phaser from 'phaser';
import { GameEngine } from '../core/GameEngine';
import type { GameResult } from '../core/GameEvents';
import { FONTS, PALETTE, SIMULATION_STEP_MS } from '../core/GameConfig';
import { createSeed } from '../core/Random';
import { WORDS } from '../data/wordList';
import type { DifficultyConfig } from '../difficulty/DifficultyConfig';
import type { GameStats } from '../gameplay/ScoringSystem';
import type { SpellCharges } from '../gameplay/SpellManager';
import { Effects } from '../render/Effects';
import { FieldBackground } from '../render/FieldBackground';
import { hex, LAYOUT, SPELL_COLORS } from '../render/layout';
import { SpellEffects } from '../render/SpellEffects';
import { WordView } from '../render/WordView';
import { SPELLS } from '../spells/SpellRegistry';
import { GameHUD } from '../ui/GameHUD';

/** How the scene reports back to the app (menus are HTML, outside Phaser). */
export interface GameSceneHooks {
  onPauseChanged(paused: boolean): void;
  onGameOver(result: GameResult, stats: GameStats, spells: SpellCharges): void;
}

export interface GameSceneData {
  config: DifficultyConfig;
  hooks: GameSceneHooks;
  seed?: number;
  /** Spell charges carried in from earlier in the run. */
  initialSpells?: SpellCharges;
  /** Run score from earlier levels (shown in the HUD). */
  scoreOffset?: number;
}

/** Longest real-time gap simulated in one frame (avoids a burst after a stall). */
const MAX_FRAME_MS = 250;
/** Time the level-intro banner holds before words start falling. */
const INTRO_MS = 1400;
/** Pause after the last word so the final effect is seen before results. */
const RESULTS_DELAY_MS = 700;
/** Keys the game uses that the browser would otherwise act on. */
const CAPTURED_KEYS = 'BACKSPACE,SPACE,ENTER,DELETE';

/**
 * Connects the GameEngine (rules) to the screen and keyboard. The scene owns
 * no game rules: it forwards input to the engine, steps it at a fixed rate
 * and draws what the engine reports.
 */
export class GameScene extends Phaser.Scene {
  static readonly KEY = 'GameScene';

  private engine!: GameEngine;
  private config!: DifficultyConfig;
  private hooks!: GameSceneHooks;
  private scoreOffset = 0;
  private readonly views = new Map<number, WordView>();
  private background!: FieldBackground;
  private effects!: Effects;
  private spellFx!: SpellEffects;
  private hud!: GameHUD;
  private accumulator = 0;
  private introRemainingMs = 0;
  private paused = false;

  constructor() {
    super(GameScene.KEY);
  }

  init(data: GameSceneData): void {
    this.config = data.config;
    this.hooks = data.hooks;
    this.scoreOffset = data.scoreOffset ?? 0;
    this.engine = new GameEngine({
      config: this.config,
      seed: data.seed ?? createSeed(),
      words: WORDS,
      initialSpells: data.initialSpells,
    });
    this.views.clear();
    this.accumulator = 0;
    this.introRemainingMs = INTRO_MS;
    this.paused = false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.midnight);
    this.background = new FieldBackground(this);
    this.effects = new Effects(this);
    this.spellFx = new SpellEffects(this);
    this.hud = new GameHUD(
      this,
      `Level ${this.config.level} · ${this.config.name}`,
      this.config.requiredWords,
      this.scoreOffset,
    );
    this.hud.setSpells(this.engine.state.spells);
    this.showIntro();

    this.wireEngineEvents();

    const keyboard = this.input.keyboard!;
    keyboard.on('keydown', this.onKeyDown, this);
    keyboard.addCapture(CAPTURED_KEYS);
    keyboard.enableGlobalCapture();
    this.input.on('pointerdown', this.onPointerDown, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.onBlur, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.off('keydown', this.onKeyDown, this);
      keyboard.removeCapture(CAPTURED_KEYS);
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

    const frame = Math.min(delta, MAX_FRAME_MS);
    if (this.introRemainingMs > 0) {
      this.introRemainingMs -= frame;
      return;
    }

    this.accumulator += frame;
    while (this.accumulator >= SIMULATION_STEP_MS && this.engine.status === 'playing') {
      this.engine.step();
      this.accumulator -= SIMULATION_STEP_MS;
    }

    const alpha = this.accumulator / SIMULATION_STEP_MS;
    for (const view of this.views.values()) view.sync(alpha);
    this.hud.updateStats(this.engine.stats(), this.engine.state.combo);
  }

  /** Called by the app's Resume button. */
  resumeGame(): void {
    this.setPaused(false);
  }

  /** Current results, for ending a Practice session from the pause menu. */
  snapshot(): { stats: GameStats; spells: SpellCharges } {
    return { stats: this.engine.stats(), spells: { ...this.engine.state.spells } };
  }

  // ───────────────────────── engine → screen ─────────────────────────

  private wireEngineEvents(): void {
    const ev = this.engine.events;

    ev.on('wordSpawned', ({ word }) => {
      this.views.set(word.id, new WordView(this, word));
    });

    ev.on('wordCompleted', ({ word, points, combo }) => {
      const { x, y } = this.viewPosition(word.id, word.x, word.y);
      this.removeView(word.id);
      this.effects.wordDestroyed(x, y, word.text.length, points);
      this.hud.console.flash(PALETTE.gold);
      if (combo > 1) this.hud.pulseCombo();
    });

    ev.on('wordsBurned', ({ words, points }) => {
      for (const word of words) {
        const { x, y } = this.viewPosition(word.id, word.x, word.y);
        this.removeView(word.id);
        this.spellFx.burnWord(x, y);
      }
      this.effects.floatText(LAYOUT.width / 2, LAYOUT.spawnY + 300, `+${points}`, PALETTE.fire, 30);
    });

    ev.on('wordMissed', ({ word }) => {
      this.removeView(word.id);
      this.effects.wordBrokeThrough(word.x, LAYOUT.wardY);
      this.background.flashMiss();
    });

    ev.on('typingError', ({ wordId }) => {
      if (wordId !== null) this.views.get(wordId)?.flashError();
    });

    ev.on('inputChanged', () => this.refreshConsole());

    ev.on('submitMissed', ({ wordId }) => {
      this.hud.console.reject();
      if (wordId !== null) this.views.get(wordId)?.flashError();
    });

    ev.on('instabilityChanged', ({ value, stage }) => {
      this.hud.setInstability(value, stage);
      this.background.setStage(stage);
    });

    ev.on('progressChanged', ({ completed }) => this.hud.setProgress(completed));

    ev.on('spellCollected', ({ spell, stored, charges }) => {
      this.hud.setSpells(charges, stored ? spell : undefined);
      const book = SPELLS[spell].book;
      this.effects.floatText(
        LAYOUT.width / 2,
        LAYOUT.panelY - 24,
        stored ? `+1 ${book} tome` : `${book} tomes full`,
        stored ? SPELL_COLORS[spell] : PALETTE.parchment,
        20,
      );
    });

    ev.on('spellCast', ({ spell, charges }) => {
      this.hud.setSpells(charges, spell);
      this.hud.console.flash(SPELL_COLORS[spell]);
      this.spellFx.cast(spell);
      if (spell === 'ice') for (const view of this.views.values()) view.setFrozen(true);
    });

    ev.on('spellEnded', ({ spell }) => {
      this.spellFx.ended(spell);
      if (spell === 'ice') for (const view of this.views.values()) view.setFrozen(false);
    });

    ev.on('spellFizzled', ({ spell }) => {
      this.hud.denySpell(spell);
      this.hud.console.reject();
    });

    // Charges change the console's "↵ cast" hint.
    ev.on('spellCollected', () => this.refreshConsole());

    ev.on('gameOver', ({ result, stats }) => {
      this.hud.updateStats(stats, this.engine.state.combo);
      this.input.keyboard!.disableGlobalCapture();
      const spells = { ...this.engine.state.spells };
      this.time.delayedCall(RESULTS_DELAY_MS, () => this.hooks.onGameOver(result, stats, spells));
    });
  }

  private refreshConsole(): void {
    const s = this.engine.state;
    this.hud.console.update(s.input, this.engine.validPrefixLength, s.spells, this.engine.inputIsCompleteWord);
  }

  private viewPosition(id: number, fieldX: number, fieldY: number): { x: number; y: number } {
    const view = this.views.get(id);
    return { x: view?.x ?? fieldX, y: view?.y ?? LAYOUT.spawnY + fieldY };
  }

  private removeView(id: number): void {
    this.views.get(id)?.destroy();
    this.views.delete(id);
  }

  /** "Level 3 · Whispering Stacks — Complete 35 words", then fades. */
  private showIntro(): void {
    const cx = LAYOUT.width / 2;
    const cy = LAYOUT.spawnY + 200;
    const title = this.add
      .text(cx, cy, `Level ${this.config.level}\n${this.config.name}`, {
        fontFamily: FONTS.heading,
        fontSize: '44px',
        color: hex(PALETTE.gold),
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5)
      .setShadow(0, 0, hex(PALETTE.arcane), 18, false, true)
      .setDepth(40);
    const goal =
      this.config.requiredWords === null
        ? 'Endless practice: survive as long as you can'
        : `Complete ${this.config.requiredWords} words`;
    const sub = this.add
      .text(cx, cy + 80, goal, { fontFamily: FONTS.gameplay, fontSize: '22px', color: hex(PALETTE.parchment) })
      .setOrigin(0.5)
      .setDepth(40);
    this.tweens.add({
      targets: [title, sub],
      alpha: 0,
      delay: INTRO_MS - 300,
      duration: 500,
      onComplete: () => {
        title.destroy();
        sub.destroy();
      },
    });
  }

  // ───────────────────────── input → engine ─────────────────────────

  /**
   * Keyboard → typing console. Letters type (any case), Backspace deletes
   * one character (held down it repeats, like a normal text box),
   * Ctrl+Backspace or Delete clears, Enter submits, Esc pauses.
   */
  private onKeyDown(event: KeyboardEvent): void {
    if (this.engine.status !== 'playing') return;
    const key = event.key;

    if (key === 'Escape') return this.setPaused(!this.paused);
    if (this.paused || this.introRemainingMs > 0) return;

    if (key === 'Backspace') {
      if (event.ctrlKey || event.altKey || event.metaKey) this.engine.clearInput();
      else this.engine.backspace();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (key === 'Delete') return this.engine.clearInput();
    if (event.repeat) return; // holding a letter or Enter should not repeat it
    if (key === 'Enter') return this.engine.submit();
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
    if (this.paused === paused || this.engine.status !== 'playing') return;
    this.paused = paused;
    const keyboard = this.input.keyboard!;
    if (paused) {
      this.tweens.pauseAll();
      // Let Space/Backspace work normally on the HTML pause buttons.
      keyboard.disableGlobalCapture();
    } else {
      this.tweens.resumeAll();
      keyboard.enableGlobalCapture();
      this.accumulator = 0;
    }
    this.hooks.onPauseChanged(paused);
  }
}
