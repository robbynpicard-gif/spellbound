import Phaser from 'phaser';
import { audio } from '../audio/Audio';
import { GameEngine } from '../core/GameEngine';
import type { GameResult } from '../core/GameEvents';
import { FONTS, PALETTE, SIMULATION_STEP_MS } from '../core/GameConfig';
import { createSeed } from '../core/Random';
import { WORDS } from '../data/wordList';
import { isSurvival, type DifficultyConfig } from '../difficulty/DifficultyConfig';
import { tierOf, type GameStats } from '../gameplay/ScoringSystem';
import { SPELL_IDS, type SpellCharges, type SpellId } from '../gameplay/SpellManager';
import { Effects } from '../render/Effects';
import { Celebrations } from '../render/Celebrations';
import { FieldBackground } from '../render/FieldBackground';
import { hex, LAYOUT, screenX, screenY, SPELL_COLORS } from '../render/layout';
import { SpellEffects } from '../render/SpellEffects';
import { WordView } from '../render/WordView';
import { SPELLS } from '../spells/SpellRegistry';
import { GameHUD } from '../ui/GameHUD';
import { instabilityStage } from '../gameplay/InstabilityManager';

/** How the scene reports back to the app (menus are HTML, outside Phaser). */
export interface GameSceneHooks {
  onPauseChanged(paused: boolean): void;
  /** `instability` is the final value (Hardcore carries it to the next level). */
  onGameOver(result: GameResult, stats: GameStats, spells: SpellCharges, instability: number): void;
  /**
   * Campaign: show the pop-up introducing a new spell. The level waits
   * until `begin` is called.
   */
  onSpellIntro?(spell: SpellId, begin: () => void): void;
}

export interface GameSceneData {
  config: DifficultyConfig;
  hooks: GameSceneHooks;
  seed?: number;
  /** Spell charges carried in from earlier in the run. */
  initialSpells?: SpellCharges;
  /** Run score from earlier levels (shown in the HUD). */
  scoreOffset?: number;
  /** Hardcore campaign (instability carries over; Arcane Purge halves it). */
  hardcore?: boolean;
  /** Instability carried in (Hardcore). */
  initialInstability?: number;
  /** Combo carried from the previous Campaign level. */
  initialCombo?: number;
  /** Spells to show in the HUD (default: those this level can drop, plus any held). */
  knownSpells?: readonly SpellId[];
  /** Campaign: introduce this spell with a pop-up before the level starts. */
  spellIntro?: SpellId | null;
  /** Words to play with (the player's chosen banks). Duels always use the default list. */
  words?: readonly string[];
  /** Present only in a Wizard Duel. */
  duel?: DuelOptions;
}

/**
 * Wizard Duel mode (decisions.md D-024). The game follows a shared clock
 * instead of frame time, cannot pause, and streams commands to the server.
 */
export interface DuelOptions {
  /** performance.now() at which tick 0 begins (end of the countdown). */
  startPerf: number;
  durationMs: number;
  rivalName: string;
  /** Called every frame (used to stream commands to the server). */
  onFrame(engine: GameEngine, now: number): void;
  /** Esc: open the duel menu. */
  onMenu(): void;
}

/** Most ticks a duel catches up in one frame (e.g. after the tab was hidden). */
const MAX_CATCH_UP_TICKS = 600;

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
  private celebrate!: Celebrations;
  private spellFx!: SpellEffects;
  private hud!: GameHUD;
  private accumulator = 0;
  private introRemainingMs = 0;
  private paused = false;
  /** Waiting for the player to dismiss the new-spell pop-up. */
  private awaitingIntro = false;
  private spellIntro: SpellId | null = null;
  private knownSpells: readonly SpellId[] = SPELL_IDS;
  private duel: DuelOptions | null = null;
  private duelMenuOpen = false;
  private countdownText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super(GameScene.KEY);
  }

  init(data: GameSceneData): void {
    this.config = data.config;
    this.hooks = data.hooks;
    this.duel = data.duel ?? null;
    this.duelMenuOpen = false;
    this.countdownText = null;
    this.scoreOffset = data.scoreOffset ?? 0;
    this.engine = new GameEngine({
      config: this.config,
      seed: data.seed ?? createSeed(),
      // A duel must use the shared default list so the server can check it.
      words: data.duel ? WORDS : (data.words ?? WORDS),
      initialSpells: data.initialSpells,
      hardcore: data.hardcore,
      initialInstability: data.initialInstability,
      initialCombo: data.initialCombo,
    });
    this.views.clear();
    this.accumulator = 0;
    this.introRemainingMs = this.duel ? 0 : INTRO_MS;
    this.paused = false;
    this.spellIntro = this.duel ? null : (data.spellIntro ?? null);
    this.awaitingIntro = false;
    const held = SPELL_IDS.filter((id) => (data.initialSpells?.[id] ?? 0) > 0);
    this.knownSpells =
      data.knownSpells ?? SPELL_IDS.filter((id) => this.config.availableSpells.includes(id) || held.includes(id));
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.midnight);
    // The chapter's scene; weather builds level by level, and bosses get their own scene.
    const chapter = this.config.chapter ?? Math.ceil(this.config.level / 5);
    const boss = isSurvival(this.config);
    audio.setMood(boss ? 'boss' : 'calm');
    audio.setStress(instabilityStage(this.engine.state.instability));
    audio.setHeat(tierOf(this.engine.state.combo));
    audio.levelStart();
    this.background = new FieldBackground(this, chapter, boss ? 4 : (this.config.level - 1) % 5, boss);
    this.effects = new Effects(this);
    this.celebrate = new Celebrations(this);
    this.spellFx = new SpellEffects(this);
    this.hud = new GameHUD(
      this,
      this.duel ? this.duelTitle(this.duel.durationMs) : `Level ${this.config.level} · ${this.config.name}`,
      this.config.requiredWords,
      this.scoreOffset,
      this.duel?.rivalName,
      this.knownSpells,
    );
    this.hud.setSpells(this.engine.state.spells);
    const startInstability = this.engine.state.instability;
    if (startInstability > 0) {
      const stage = instabilityStage(startInstability);
      this.hud.setInstability(startInstability, stage);
      this.background.setStage(stage);
    }
    if (isSurvival(this.config)) this.hud.setSurvival(this.config.survivalMs!, this.config.survivalMs!);
    if (this.duel) this.showCountdown();
    else if (this.spellIntro && this.hooks.onSpellIntro) {
      this.awaitingIntro = true;
      this.hooks.onSpellIntro(this.spellIntro, () => {
        if (!this.awaitingIntro || !this.scene.isActive()) return;
        this.awaitingIntro = false;
        this.input.keyboard?.enableGlobalCapture();
        this.showIntro();
      });
    } else this.showIntro();

    this.wireEngineEvents();

    const keyboard = this.input.keyboard!;
    keyboard.on('keydown', this.onKeyDown, this);
    keyboard.addCapture(CAPTURED_KEYS);
    keyboard.enableGlobalCapture();
    // Let Enter/Space reach the pop-up's HTML button until it is dismissed.
    if (this.awaitingIntro) keyboard.disableGlobalCapture();
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
      (window as unknown as { wizzyEngine: GameEngine }).wizzyEngine = this.engine;
    }
  }

  override update(_time: number, delta: number): void {
    if (this.duel) return this.updateDuel(this.duel);
    if (this.paused || this.awaitingIntro || this.engine.status !== 'playing') return;

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
    const left = this.engine.survivalRemainingMs;
    if (left !== null) this.hud.setSurvival(this.config.survivalMs!, left);
  }

  /** Called by the app's Resume button. */
  resumeGame(): void {
    this.setPaused(false);
  }

  // ───────────────────────── Wizard Duel ─────────────────────────

  /**
   * Duel time follows the shared clock: the engine is stepped until its tick
   * matches the time since the start, so both players' games (and the
   * server's copies) advance at the same rate. If the tab was hidden, the
   * game catches up rather than pausing — a duel cannot be paused.
   */
  private updateDuel(duel: DuelOptions): void {
    const now = performance.now();
    const elapsed = now - duel.startPerf;
    this.updateCountdown(elapsed);

    if (elapsed >= 0 && this.engine.status === 'playing') {
      const target = Math.floor(elapsed / SIMULATION_STEP_MS);
      let steps = 0;
      while (this.engine.state.tick < target && this.engine.status === 'playing' && steps++ < MAX_CATCH_UP_TICKS) {
        this.engine.step();
      }
      const alpha = Phaser.Math.Clamp(elapsed / SIMULATION_STEP_MS - this.engine.state.tick, 0, 1);
      for (const view of this.views.values()) view.sync(alpha);
      this.hud.updateStats(this.engine.stats(), this.engine.state.combo);
      this.hud.setTitle(this.duelTitle(duel.durationMs - elapsed));
    }
    duel.onFrame(this.engine, now);
  }

  private duelTitle(remainingMs: number): string {
    const s = Math.max(0, Math.ceil(remainingMs / 1000));
    return `Duel · Level ${this.config.level} · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  private showCountdown(): void {
    this.countdownText = this.add
      .text(LAYOUT.width / 2, LAYOUT.spawnY + 230, '', {
        fontFamily: FONTS.heading,
        fontSize: '96px',
        color: hex(PALETTE.gold),
        align: 'center',
      })
      .setOrigin(0.5)
      .setShadow(0, 0, hex(PALETTE.arcane), 24, false, true)
      .setDepth(40);
    this.add
      .text(LAYOUT.width / 2, LAYOUT.spawnY + 330, `vs ${this.duel!.rivalName}`, {
        fontFamily: FONTS.heading,
        fontSize: '28px',
        color: hex(PALETTE.parchment),
      })
      .setOrigin(0.5)
      .setDepth(40)
      .setName('rival-banner');
  }

  private updateCountdown(elapsed: number): void {
    const text = this.countdownText;
    if (!text) return;
    if (elapsed < 0) {
      text.setText(String(Math.ceil(-elapsed / 1000)));
    } else if (elapsed < 700) {
      text.setText('Duel!');
    } else {
      text.destroy();
      this.children.getByName('rival-banner')?.destroy();
      this.countdownText = null;
    }
  }

  /** The app's "Keep fighting" button. */
  closeDuelMenu(): void {
    this.duelMenuOpen = false;
  }

  /** Live rival state from the server. */
  setRival(score: number, instability: number, alive: boolean): void {
    this.hud?.setRival(score, instability, alive);
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

    ev.on('wordCompleted', ({ word, points, combo, multiplier, bonuses }) => {
      audio.capture(combo, bonuses.map((b) => b.id));
      const { x, y } = this.viewPosition(word.id, word.x, word.y);
      this.removeView(word.id);
      this.effects.wordDestroyed(x, y, word.text.length, points, multiplier);
      this.celebrate.wordBonuses(x, y, bonuses);
      this.hud.console.flash(PALETTE.gold);
      if (combo > 1) this.hud.pulseCombo();
    });

    ev.on('wordsBurned', ({ words }) => {
      for (const word of words) {
        const { x, y } = this.viewPosition(word.id, word.x, word.y);
        this.removeView(word.id);
        this.spellFx.burnWord(x, y);
      }
    });

    ev.on('wordsShocked', ({ words, points }) => {
      const at = words.map((w) => this.viewPosition(w.id, w.x, w.y));
      for (const word of words) this.removeView(word.id);
      this.spellFx.lightning(at);
      if (points > 0) this.effects.floatText(LAYOUT.width / 2, LAYOUT.spawnY + 300, `+${points}`, PALETTE.lightning, 30);
    });

    ev.on('wordsHarvested', ({ words, points }) => {
      for (const word of words) {
        const { x, y } = this.viewPosition(word.id, word.x, word.y);
        this.removeView(word.id);
        this.spellFx.burst(x, y, PALETTE.harvest, 24);
      }
      if (points > 0) this.effects.floatText(LAYOUT.width / 2, LAYOUT.spawnY + 300, `+${points}`, PALETTE.harvest, 30);
    });

    ev.on('wordsTransmuted', ({ words }) => {
      for (const word of words) {
        const view = this.views.get(word.id);
        if (!view) continue;
        view.refreshText();
        this.spellFx.burst(view.x, view.y, PALETTE.transmute, 14);
      }
    });

    ev.on('wordBlocked', ({ word }) => {
      audio.blocked();
      this.removeView(word.id);
      this.spellFx.burst(screenX(word.x), LAYOUT.wardY - 10, PALETTE.shield, 26);
      this.background.flashBlocked();
    });

    ev.on('barrierChanged', ({ remaining }) => {
      this.background.setShield(remaining > 0);
      this.hud.setShield(remaining);
    });

    ev.on('slowChanged', ({ stacks }) => this.spellFx.setSlowStacks(stacks));

    ev.on('wordMissed', ({ word }) => {
      audio.miss();
      this.removeView(word.id);
      this.effects.wordBrokeThrough(screenX(word.x), LAYOUT.wardY);
      this.background.flashMiss();
    });

    ev.on('typingError', ({ wordId }) => {
      audio.typo();
      if (wordId !== null) this.views.get(wordId)?.flashError();
    });

    ev.on('inputChanged', () => this.refreshConsole());

    ev.on('submitMissed', ({ wordId }) => {
      audio.wrongEntry();
      this.hud.console.reject();
      if (wordId !== null) this.views.get(wordId)?.flashError();
    });

    ev.on('instabilityChanged', ({ value, stage }) => {
      this.hud.setInstability(value, stage);
      this.background.setStage(stage);
      audio.setStress(stage);
    });

    ev.on('progressChanged', ({ completed }) => this.hud.setProgress(completed));

    ev.on('spellCollected', ({ spell, stored, charges }) => {
      audio.pickup();
      this.hud.setSpells(charges, stored ? spell : undefined);
      const book = SPELLS[spell].book;
      this.effects.floatText(
        LAYOUT.width / 2,
        LAYOUT.panelY - 24,
        stored ? `+1 ${book} mana` : 'Mana full',
        stored ? SPELL_COLORS[spell] : PALETTE.parchment,
        20,
      );
    });

    ev.on('spellCast', ({ spell, charges }) => {
      audio.cast(spell);
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
      audio.error();
      this.hud.denySpell(spell);
      this.hud.console.reject();
    });

    // Charges change the console's "↵ cast" hint.
    ev.on('spellCollected', () => this.refreshConsole());

    ev.on('tierChanged', ({ tier, multiplier, up }) => {
      this.hud.tierChanged(up);
      if (up) {
        audio.tierUp(tier);
        this.celebrate.tierUp(multiplier, tier);
      } else audio.tierDown(tier);
    });

    ev.on('gameOver', ({ result, stats }) => {
      let finaleMs = 0;
      if (result === 'won' && !this.duel) {
        audio.finale(isSurvival(this.config));
        finaleMs = this.celebrate.finale(isSurvival(this.config), stats.levelBonuses, stats.score);
      } else if (result === 'won') audio.fanfare();
      else audio.defeat();
      this.hud.updateStats(stats, this.engine.state.combo);
      this.input.keyboard!.disableGlobalCapture();
      if (this.duel) {
        // In a duel the server decides the result; wait for it.
        this.add
          .text(LAYOUT.width / 2, LAYOUT.spawnY + 250, 'Your wards have fallen…\nwaiting for the referee', {
            fontFamily: FONTS.heading,
            fontSize: '34px',
            color: hex(PALETTE.parchment),
            align: 'center',
          })
          .setOrigin(0.5)
          .setDepth(40);
        return;
      }
      const spells = { ...this.engine.state.spells };
      const instability = this.engine.state.instability;
      this.time.delayedCall(Math.max(RESULTS_DELAY_MS, finaleMs), () => this.hooks.onGameOver(result, stats, spells, instability));
    });
  }

  private refreshConsole(): void {
    const s = this.engine.state;
    this.hud.console.update(s.input, this.engine.validPrefixLength, s.spells, this.engine.inputIsCompleteWord);
  }

  private viewPosition(id: number, fieldX: number, fieldY: number): { x: number; y: number } {
    const view = this.views.get(id);
    return { x: view?.x ?? screenX(fieldX), y: view?.y ?? screenY(fieldY) };
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
      .text(cx, cy, `LEVEL ${this.config.level}\n${this.config.name.toUpperCase()}`, {
        fontFamily: FONTS.heading,
        fontSize: '48px',
        color: hex(PALETTE.gold),
        align: 'center',
        lineSpacing: 2,
      })
      .setOrigin(0.5)
      .setShadow(4, 4, hex(PALETTE.midnight), 0, false, true)
      .setDepth(40);
    const goal = isSurvival(this.config)
      ? `Boss · Survive for ${Math.round(this.config.survivalMs! / 1000)} seconds`
      : this.config.requiredWords === null
        ? 'Endless practice: survive as long as you can'
        : `Complete ${this.config.requiredWords} words`;
    const sub = this.add
      .text(cx, cy + 86, goal, { fontFamily: FONTS.gameplay, fontSize: '26px', fontStyle: '700', color: hex(PALETTE.parchment) })
      .setShadow(3, 3, hex(PALETTE.midnight), 0, false, true)
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

    if (this.duel) {
      // A duel can't pause: Esc opens the forfeit menu while the game runs on.
      if (key === 'Escape' && !this.duelMenuOpen) {
        this.duelMenuOpen = true;
        this.duel.onMenu();
      }
      if (this.duelMenuOpen || performance.now() < this.duel.startPerf) return;
    } else {
      // The new-spell pop-up (HTML) has the keyboard until it is dismissed.
      if (this.awaitingIntro) return;
      if (key === 'Escape') return this.setPaused(!this.paused);
      if (this.paused || this.introRemainingMs > 0) return;
    }

    if (key === 'Backspace') {
      if (event.ctrlKey || event.altKey || event.metaKey) this.engine.clearInput();
      else this.engine.backspace();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (key === 'Delete') return this.engine.clearInput();
    if (event.repeat) return; // holding a letter or Enter should not repeat it
    if (key === 'Enter') return this.engine.submit();
    if (key.length === 1) {
      audio.key();
      this.engine.typeChar(key);
    }
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.paused || this.awaitingIntro || this.duelMenuOpen || this.engine.status !== 'playing') return;
    for (const view of this.views.values()) {
      if (view.hitTest(pointer.worldX, pointer.worldY)) {
        this.engine.selectTarget(view.word.id);
        return;
      }
    }
  }

  private onBlur(): void {
    if (this.duel || this.awaitingIntro) return; // duels never pause; the pop-up already waits
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
