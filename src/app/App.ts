import type Phaser from 'phaser';
import type { GameResult } from '../core/GameEvents';
import type { LevelManager } from '../difficulty/LevelManager';
import type { GameStats } from '../gameplay/ScoringSystem';
import type { SpellCharges } from '../gameplay/SpellManager';
import { recordLevel, startRun, summarizeRun, type CampaignRun } from '../modes/CampaignMode';
import { practiceConfig, practiceLevels, type ModifierFilter } from '../modes/PracticeMode';
import { BackdropScene } from '../scenes/BackdropScene';
import { GameScene, type GameSceneData } from '../scenes/GameScene';
import type { SaveManager } from '../storage/SaveManager';
import { FILTER_LABELS, practiceResultsScreen, practiceSetupScreen } from '../ui/practiceScreens';
import { creditsScreen, levelClearScreen, mainMenuScreen, pauseScreen, runOverScreen } from '../ui/screens';
import type { UIRoot } from '../ui/UIRoot';

/**
 * Top-level flow between screens.
 * - Campaign is a single run (D-016): Level 1 → Level cleared → … → Run over.
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
          onCampaign: () => this.startNewRun(),
          onPractice: () => this.showPracticeSetup(),
          onCredits: () => this.showCredits(),
        },
        this.save.campaign,
        this.save.persistent,
      ),
    );
  }

  showCredits(): void {
    this.showBackdrop();
    this.ui.show(creditsScreen(() => this.showMainMenu()));
  }

  // ───────────────────────── Campaign ─────────────────────────

  startNewRun(): void {
    this.run = startRun();
    this.save.noteRunStarted();
    this.playCurrentLevel();
  }

  private playCurrentLevel(): void {
    const run = this.run;
    if (!run) return;
    const config = this.campaign.get(run.level);
    this.save.noteLevelReached(run.level);
    const label = `Level ${config.level} of ${this.campaign.count} · ${config.name}`;

    this.startScene({
      config,
      initialSpells: run.spellCharges,
      scoreOffset: run.score,
      hooks: {
        onPauseChanged: (paused) =>
          this.onPause(paused, label, [
            { label: 'Restart run from level 1', onClick: () => this.startNewRun() },
            { label: 'Abandon run', onClick: () => this.showMainMenu() },
          ], 'An abandoned run is not recorded'),
        onGameOver: (result, stats, spells) => this.onLevelEnd(result, stats, spells),
      },
    });
  }

  private onLevelEnd(result: GameResult, stats: GameStats, spells: SpellCharges): void {
    const run = this.run;
    if (!run) return;
    const clearedLevel = this.campaign.get(run.level);
    const { runOver, victory } = recordLevel(run, result, stats, spells, this.campaign.count);

    if (!runOver) {
      this.ui.show(
        levelClearScreen(clearedLevel, this.campaign.get(run.level), stats, run, () => this.playCurrentLevel()),
      );
      return;
    }

    const summary = summarizeRun(run, victory);
    const outcome = this.save.recordRun(summary);
    this.run = null;
    this.ui.show(
      runOverScreen(summary, outcome, clearedLevel, this.campaign.count, {
        onNewRun: () => this.startNewRun(),
        onMenu: () => this.showMainMenu(),
      }),
    );
  }

  // ───────────────────────── Endless Practice ─────────────────────────

  showPracticeSetup(): void {
    this.run = null;
    this.showBackdrop();
    const p = this.save.practice;
    const reachable = practiceLevels(this.save.campaign.highestReached, this.campaign.count);
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
    const reachable = practiceLevels(this.save.campaign.highestReached, this.campaign.count);
    if (!reachable.includes(level)) return this.showPracticeSetup();
    this.save.notePracticeChoice(level, filter);
    const base = this.campaign.get(level);
    const label = `Practice · Level ${level} · ${base.name} · ${FILTER_LABELS[filter].title}`;

    this.startScene({
      config: practiceConfig(base, filter),
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
    this.ui.show(pauseScreen(label, () => this.gameScene.resumeGame(), options, note));
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
    this.game.scene.stop(GameScene.KEY);
    if (!this.game.scene.isActive(BackdropScene.KEY)) this.game.scene.start(BackdropScene.KEY);
  }
}
