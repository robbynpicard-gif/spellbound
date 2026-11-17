import type Phaser from 'phaser';
import type { GameResult } from '../core/GameEvents';
import type { LevelManager } from '../difficulty/LevelManager';
import type { GameStats } from '../gameplay/ScoringSystem';
import { WORDS } from '../data/wordList';
import { audio } from '../audio/Audio';
import { isSurvival } from '../difficulty/DifficultyConfig';
import { SPELL_IDS, type SpellCharges } from '../gameplay/SpellManager';
import {
  bossRewardChoices,
  claimBossReward,
  knownSpellsAt,
  recordLevel,
  startRun,
  summarizeRun,
  type CampaignMode,
  type CampaignRun,
} from '../modes/CampaignMode';
import { practiceConfig, practiceLevels, type ModifierFilter } from '../modes/PracticeMode';
import { BackdropScene } from '../scenes/BackdropScene';
import { GameScene, type GameSceneData } from '../scenes/GameScene';
import type { SaveManager } from '../storage/SaveManager';
import { FILTER_LABELS, practiceResultsScreen, practiceSetupScreen } from '../ui/practiceScreens';
import {
  campaignModeScreen,
  creditsScreen,
  levelClearScreen,
  audioToggleLabels,
  mainMenuScreen,
  optionsScreen,
  pauseScreen,
  runOverScreen,
  spellIntroScreen,
  type BossReward,
} from '../ui/screens';
import type { UIRoot } from '../ui/UIRoot';

/**
 * Top-level flow between screens.
 * - Campaign is a single run (D-016, docs/plans/campaign-v2.md), in Normal or
 *   Hardcore: Level 1 → Level cleared (boss: choose a reward) → … → Run over.
 * - Endless Practice (D-023): choose a level → play until the wards fall or
 *   you end the session → results with personal bests.
 * Game rules stay in the engine; saving stays in SaveManager.
 */
export class App {
  private run: CampaignRun | null = null;

  constructor(
    private readonly game: Phaser.Game,
    private readonly ui: UIRoot,
    private readonly save: SaveManager,
    private readonly campaign: LevelManager,
  ) {}

  showMainMenu(): void {
    this.run = null;
    this.showBackdrop();
    this.ui.show(
      mainMenuScreen(
        {
          onCampaign: () => this.showCampaignModes(),
          onPractice: () => this.showPracticeSetup(),
          onCredits: () => this.showCredits(),
          onOptions: () => this.showOptions(),
        },
        this.save.campaign,
        this.save.persistent,
      ),
    );
  }

  showOptions(focus: 'music' | 'sfx' | null = null): void {
    this.showBackdrop();
    this.ui.show(
      optionsScreen(
        this.save.audio,
        {
          onMusic: () => {
            this.toggleAudio('music');
            this.showOptions('music');
          },
          onSfx: () => {
            this.toggleAudio('sfx');
            this.showOptions('sfx');
          },
          onBack: () => this.showMainMenu(),
        },
        focus,
      ),
    );
  }

  /** Flip music or sound effects, save it, and apply it at once. */
  private toggleAudio(which: 'music' | 'sfx'): void {
    const next = this.save.setAudio({ [which]: !this.save.audio[which] });
    audio.setMusic(next.music);
    audio.setSfx(next.sfx);
  }

  /** Words for Campaign and Practice. */
  private get words(): string[] {
    return [...WORDS];
  }

  showCredits(): void {
    this.showBackdrop();
    this.ui.show(creditsScreen(() => this.showMainMenu()));
  }

  // ───────────────────────── Campaign ─────────────────────────

  showCampaignModes(): void {
    this.run = null;
    this.showBackdrop();
    this.ui.show(
      campaignModeScreen(this.save.records('normal'), this.save.records('hardcore'), this.campaign.count, {
        onStart: (mode) => this.startNewRun(mode),
        onBack: () => this.showMainMenu(),
      }),
    );
  }

  startNewRun(mode: CampaignMode = 'normal'): void {
    this.run = startRun(mode);
    this.save.noteRunStarted(mode);
    this.playCurrentLevel();
  }

  private playCurrentLevel(): void {
    const run = this.run;
    if (!run) return;
    const config = this.campaign.get(run.level);
    this.save.noteLevelReached(run.level, run.mode);
    const modeLabel = run.mode === 'hardcore' ? ' · Hardcore' : '';
    const label = `Level ${config.level} of ${this.campaign.count} · ${config.name}${modeLabel}`;
    const held = SPELL_IDS.filter((id) => run.spellCharges[id] > 0);
    const known = knownSpellsAt(this.campaign.all, run.level);

    this.startScene({
      config,
      initialSpells: run.spellCharges,
      scoreOffset: run.score,
      hardcore: run.mode === 'hardcore',
      initialInstability: run.instability,
      initialCombo: run.combo,
      knownSpells: SPELL_IDS.filter((id) => known.includes(id) || held.includes(id)),
      spellIntro: config.introducesSpell ?? null,
      words: this.words,
      hooks: {
        onPauseChanged: (paused) =>
          this.onPause(paused, label, [
            { label: 'Restart run from level 1', onClick: () => this.startNewRun(run.mode) },
            { label: 'Abandon run', onClick: () => this.showMainMenu() },
          ], 'An abandoned run is not recorded'),
        onGameOver: (result, stats, spells, instability) => this.onLevelEnd(result, stats, spells, instability),
        onSpellIntro: (spell, begin) =>
          this.ui.show(
            spellIntroScreen(spell, config, () => {
              this.ui.clear();
              begin();
            }),
          ),
      },
    });
  }

  private onLevelEnd(result: GameResult, stats: GameStats, spells: SpellCharges, instability: number): void {
    const run = this.run;
    if (!run) return;
    const clearedLevel = this.campaign.get(run.level);
    const { runOver, victory } = recordLevel(
      run,
      result,
      stats,
      spells,
      this.campaign.count,
      instability,
      clearedLevel,
    );

    if (!runOver) {
      // Surviving a boss: choose 1 of 3 spells (picked by rarity) as a free charge.
      let reward: BossReward | null = null;
      if (isSurvival(clearedLevel)) {
        reward = {
          choices: bossRewardChoices(knownSpellsAt(this.campaign.all, clearedLevel.level), Math.random),
          onClaim: (spell, discard) => {
            claimBossReward(run, spell, discard);
            reward = null;
          },
        };
      }
      const show = () =>
        this.ui.show(
          levelClearScreen(clearedLevel, this.campaign.get(run.level), stats, run, () => this.playCurrentLevel(), reward, show),
        );
      show();
      return;
    }

    const summary = summarizeRun(run, victory);
    const outcome = this.save.recordRun(summary, run.mode);
    this.run = null;
    this.ui.show(
      runOverScreen(summary, outcome, clearedLevel, this.campaign.count, {
        onNewRun: () => this.startNewRun(run.mode),
        onMenu: () => this.showMainMenu(),
        mode: run.mode,
      }),
    );
  }

  // ───────────────────────── Endless Practice ─────────────────────────

  showPracticeSetup(): void {
    this.run = null;
    this.showBackdrop();
    const p = this.save.practice;
    const reachable = practiceLevels(this.save.highestReached, this.campaign.count);
    const level = reachable.includes(p.lastLevel) ? p.lastLevel : reachable.at(-1)!;
    this.ui.show(
      practiceSetupScreen(
        this.campaign.all,
        reachable.at(-1)!,
        p.records,
        { level, filter: p.lastFilter },
        {
          onStart: (lvl, filter) => this.startPractice(lvl, filter),
          onBack: () => this.showMainMenu(),
        },
      ),
    );
  }

  startPractice(level: number, filter: ModifierFilter): void {
    const reachable = practiceLevels(this.save.highestReached, this.campaign.count);
    if (!reachable.includes(level)) return this.showPracticeSetup();
    this.save.notePracticeChoice(level, filter);
    const base = this.campaign.get(level);
    const label = `Practice · Level ${level} · ${base.name} · ${FILTER_LABELS[filter].title}`;

    this.startScene({
      config: practiceConfig(base, filter),
      words: this.words,
      hooks: {
        onPauseChanged: (paused) =>
          this.onPause(paused, label, [
            {
              label: 'End session and see results',
              onClick: () => {
                const { stats } = this.gameScene.snapshot();
                this.endPractice(level, filter, stats, false);
              },
            },
            { label: 'Restart session', onClick: () => this.startPractice(level, filter) },
            { label: 'Change level', onClick: () => this.showPracticeSetup() },
          ], 'Restarting or changing level discards this session'),
        // Endless sessions only end by falling (there is no quota to win).
        onGameOver: (_result, stats) => this.endPractice(level, filter, stats, true),
      },
    });
  }

  private endPractice(level: number, filter: ModifierFilter, stats: GameStats, fell: boolean): void {
    // Stop the game (so Esc can't resume it behind the results) and show the sky backdrop.
    this.showBackdrop();
    const outcome = this.save.recordPractice(level, filter, stats);
    this.ui.show(
      practiceResultsScreen(this.campaign.get(level), filter, stats, outcome, fell, {
        onAgain: () => this.startPractice(level, filter),
        onChangeLevel: () => this.showPracticeSetup(),
        onMenu: () => this.showMainMenu(),
      }),
    );
  }

  // ───────────────────────── shared ─────────────────────────

  private onPause(
    paused: boolean,
    label: string,
    options: { label: string; onClick(): void }[],
    note: string,
  ): void {
    if (!paused) return this.ui.clear();
    const labels = audioToggleLabels(this.save.audio);
    const toggles = [
      { label: labels.music, onClick: () => (this.toggleAudio('music'), this.onPause(true, label, options, note)) },
      { label: labels.sfx, onClick: () => (this.toggleAudio('sfx'), this.onPause(true, label, options, note)) },
    ];
    this.ui.show(pauseScreen(label, () => this.gameScene.resumeGame(), [...options, ...toggles], note));
  }

  private startScene(data: GameSceneData): void {
    this.ui.clear();
    this.game.scene.stop(BackdropScene.KEY);
    // start() restarts the scene if it is already running.
    this.game.scene.start(GameScene.KEY, data);
  }

  private get gameScene(): GameScene {
    return this.game.scene.getScene(GameScene.KEY) as GameScene;
  }

  private showBackdrop(): void {
    audio.setMood('menu');
    this.game.scene.stop(GameScene.KEY);
    if (!this.game.scene.isActive(BackdropScene.KEY)) this.game.scene.start(BackdropScene.KEY);
  }
}
