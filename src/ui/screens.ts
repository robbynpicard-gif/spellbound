import { GAME_TITLE } from '../core/GameConfig';
import type { GameResult } from '../core/GameEvents';
import type { DifficultyConfig } from '../difficulty/DifficultyConfig';
import type { GameStats } from '../gameplay/ScoringSystem';
import type { CampaignOutcome, CampaignProgress } from '../modes/CampaignMode';
import { formatTime, h, percent } from './dom';
import type { Screen } from './UIRoot';

const APP_VERSION = '0.3.0';

// ───────────────────────── Main menu ─────────────────────────

export interface MainMenuActions {
  onCampaign(): void;
  onCredits(): void;
}

/** Menu entries that exist in the GDD but are built in later milestones. */
const UPCOMING: [label: string, milestone: string][] = [
  ['Endless Practice', 'Milestone 4'],
  ['Multiplayer', 'Milestone 5'],
  ['Spellbook', 'Milestone 6'],
  ['Settings', 'Milestone 7'],
];

export function mainMenuScreen(actions: MainMenuActions, persistent: boolean): Screen {
  const campaign = h('button', { class: 'menu-button primary', onClick: actions.onCampaign }, 'Campaign');

  const element = h(
    'section',
    { class: 'screen main-menu', attrs: { 'aria-labelledby': 'title' } },
    h('h1', { class: 'game-title', attrs: { id: 'title' } }, GAME_TITLE),
    h('p', { class: 'tagline' }, 'Defend the tower. Speak the counterspell.'),
    h(
      'nav',
      { class: 'menu-list', attrs: { 'aria-label': 'Main menu' } },
      campaign,
      ...UPCOMING.map(([label, milestone]) =>
        h(
          'button',
          { class: 'menu-button', disabled: true, attrs: { title: `Coming in ${milestone}` } },
          label,
          h('span', { class: 'badge' }, 'Coming soon'),
        ),
      ),
      h('button', { class: 'menu-button', onClick: actions.onCredits }, 'Credits'),
    ),
    h(
      'p',
      { class: 'footnote' },
      `Prototype ${APP_VERSION} · Temporary art · `,
      persistent ? 'Progress saves in this browser' : 'Progress cannot be saved in this browser',
    ),
  );
  return { element, focus: campaign };
}

// ───────────────────────── Level select ─────────────────────────

export interface LevelSelectActions {
  onPlay(level: number): void;
  onBack(): void;
}

export function levelSelectScreen(
  levels: readonly DifficultyConfig[],
  progress: Readonly<CampaignProgress>,
  actions: LevelSelectActions,
): Screen {
  let focus: HTMLElement | null = null;

  const cards = levels.map((config) => {
    const locked = config.level > progress.highestUnlocked;
    const record = progress.levels[String(config.level)];
    const cleared = (record?.completions ?? 0) > 0;
    const card = h(
      'button',
      {
        class: `level-card${locked ? ' locked' : ''}${cleared ? ' cleared' : ''}`,
        disabled: locked,
        onClick: () => actions.onPlay(config.level),
        attrs: {
          'aria-label': locked
            ? `Level ${config.level}, locked`
            : `Level ${config.level}, ${config.name}${cleared ? `, best score ${record!.bestScore}` : ''}`,
        },
      },
      h('span', { class: 'level-number' }, config.level),
      h('span', { class: 'level-name' }, locked ? 'Sealed' : config.name),
      h(
        'span',
        { class: 'level-detail' },
        locked
          ? 'Clear the previous level'
          : cleared
            ? `Best ${record!.bestScore} · ${Math.round(record!.bestWpm)} WPM`
            : `${config.requiredWords} words`,
      ),
    );
    // Focus the furthest unlocked level so Enter continues the campaign.
    if (config.level === progress.highestUnlocked) focus = card;
    return card;
  });

  const element = h(
    'section',
    { class: 'screen level-select', attrs: { 'aria-labelledby': 'levels-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'levels-title' } }, 'Campaign'),
    h('p', { class: 'screen-subtitle' }, 'Choose a chamber of the tower to defend.'),
    h('div', { class: 'level-grid' }, ...cards),
    h('div', { class: 'button-row' }, h('button', { class: 'menu-button', onClick: actions.onBack }, 'Back')),
  );

  return {
    element,
    focus,
    onKey: (event) => {
      if (event.key === 'Escape') actions.onBack();
    },
  };
}

// ───────────────────────── Pause ─────────────────────────

export interface PauseActions {
  onResume(): void;
  onRestart(): void;
  onQuit(): void;
}

export function pauseScreen(levelLabel: string, actions: PauseActions): Screen {
  const resume = h('button', { class: 'menu-button primary', onClick: actions.onResume }, 'Resume');
  const element = h(
    'section',
    { class: 'screen panel pause', attrs: { role: 'dialog', 'aria-labelledby': 'pause-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'pause-title' } }, 'Paused'),
    h('p', { class: 'screen-subtitle' }, levelLabel),
    h('p', { class: 'flavour' }, 'The words hang in the air, waiting.'),
    h(
      'div',
      { class: 'menu-list' },
      resume,
      h('button', { class: 'menu-button', onClick: actions.onRestart }, 'Restart level'),
      h('button', { class: 'menu-button', onClick: actions.onQuit }, 'Quit to level select'),
    ),
    h('p', { class: 'footnote' }, 'Esc resumes'),
  );
  // Esc is handled by the game scene (it owns the pause state).
  return { element, focus: resume };
}

// ───────────────────────── Results ─────────────────────────

export interface ResultsActions {
  onNext(): void;
  onRetry(): void;
  onLevels(): void;
  onMenu(): void;
}

export function resultsScreen(
  config: DifficultyConfig,
  result: GameResult,
  stats: GameStats,
  outcome: CampaignOutcome,
  actions: ResultsActions,
): Screen {
  const won = result === 'won';
  const finale = won && !outcome.hasNextLevel;
  const title = finale ? 'The Tower Stands' : won ? 'Level Complete' : 'The Wards Have Fallen';

  const stat = (label: string, value: string | number) =>
    h('div', { class: 'stat' }, h('dt', null, label), h('dd', null, String(value)));

  const rewards: (string | false)[] = [
    won && outcome.isNewBest && outcome.previousBest !== null && `New personal best! (was ${outcome.previousBest})`,
    outcome.unlockedLevel !== null && `Level ${outcome.unlockedLevel} unsealed`,
    finale && 'You have completed every chamber of the campaign.',
  ];
  const bestLine = won
    ? outcome.previousBest === null
      ? 'First clear of this level'
      : `Personal best: ${Math.max(outcome.previousBest, stats.score)}`
    : outcome.previousBest === null
      ? 'Not yet cleared'
      : `Personal best: ${outcome.previousBest}`;

  const nextButton =
    won && outcome.hasNextLevel
      ? h('button', { class: 'menu-button primary', onClick: actions.onNext }, 'Next level')
      : null;
  const retryButton = h(
    'button',
    { class: `menu-button${nextButton ? '' : ' primary'}`, onClick: actions.onRetry },
    won ? 'Play again' : 'Try again',
  );

  const element = h(
    'section',
    { class: `screen panel results ${won ? 'won' : 'lost'}`, attrs: { role: 'dialog', 'aria-labelledby': 'results-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'results-title' } }, title),
    h('p', { class: 'screen-subtitle' }, `Level ${config.level} · ${config.name}`),
    h('p', { class: 'score' }, h('span', { class: 'score-label' }, 'Score'), String(stats.score)),
    h(
      'dl',
      { class: 'stat-grid' },
      stat('Accuracy', percent(stats.accuracy)),
      stat('WPM', Math.round(stats.wpm)),
      stat('Words', config.requiredWords === null ? stats.completed : `${stats.completed} / ${config.requiredWords}`),
      stat('Missed', stats.missed),
      stat('Best combo', `×${stats.maxCombo}`),
      stat('Time', formatTime(stats.elapsedMs)),
    ),
    h('p', { class: 'personal-best' }, bestLine),
    ...rewards.filter((r): r is string => Boolean(r)).map((r) => h('p', { class: 'reward' }, r)),
    h(
      'div',
      { class: 'button-row' },
      nextButton,
      retryButton,
      h('button', { class: 'menu-button', onClick: actions.onLevels }, 'Level select'),
      h('button', { class: 'menu-button', onClick: actions.onMenu }, 'Main menu'),
    ),
  );

  return {
    element,
    focus: nextButton ?? retryButton,
    onKey: (event) => {
      if (event.key === 'Escape') actions.onLevels();
    },
  };
}

// ───────────────────────── Credits ─────────────────────────

export function creditsScreen(onBack: () => void): Screen {
  const back = h('button', { class: 'menu-button primary', onClick: onBack }, 'Back');
  const element = h(
    'section',
    { class: 'screen panel credits', attrs: { 'aria-labelledby': 'credits-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'credits-title' } }, 'Credits'),
    h('p', null, `${GAME_TITLE} — an original wizard-themed typing game.`),
    h('p', null, 'Gameplay inspired by classic falling-word typing games.'),
    h('p', null, 'Built with Phaser, TypeScript and Vite.'),
    h('p', { class: 'footnote' }, 'Art and audio are temporary placeholders.'),
    h('div', { class: 'button-row' }, back),
  );
  return {
    element,
    focus: back,
    onKey: (event) => {
      if (event.key === 'Escape') onBack();
    },
  };
}
