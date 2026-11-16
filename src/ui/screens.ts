import { GAME_TITLE } from '../core/GameConfig';
import type { DifficultyConfig } from '../difficulty/DifficultyConfig';
import type { GameStats } from '../gameplay/ScoringSystem';
import { SPELL_IDS, type SpellCharges } from '../gameplay/SpellManager';
import type { CampaignRecords, CampaignRun, RunOutcome, RunSummary } from '../modes/CampaignMode';
import { SPELLS } from '../spells/SpellRegistry';
import { formatTime, h, percent } from './dom';
import type { Screen } from './UIRoot';

const APP_VERSION = '0.5.0';

const stat = (label: string, value: string | number) =>
  h('div', { class: 'stat' }, h('dt', null, label), h('dd', null, String(value)));

// ───────────────────────── Main menu ─────────────────────────

export interface MainMenuActions {
  onCampaign(): void;
  onPractice(): void;
  onCredits(): void;
}

/** Menu entries that exist in the GDD but are built in later milestones. */
const UPCOMING: [label: string, milestone: string][] = [
  ['Multiplayer', 'Milestone 5'],
  ['Spellbook', 'Milestone 6'],
  ['Settings', 'Milestone 7'],
];

export function mainMenuScreen(
  actions: MainMenuActions,
  records: Readonly<CampaignRecords>,
  persistent: boolean,
): Screen {
  const campaign = h('button', { class: 'menu-button primary', onClick: actions.onCampaign }, 'Campaign');
  const best = records.bestRun;

  const element = h(
    'section',
    { class: 'screen main-menu', attrs: { 'aria-labelledby': 'title' } },
    h('h1', { class: 'game-title', attrs: { id: 'title' } }, GAME_TITLE),
    h('p', { class: 'tagline' }, 'Defend the tower. Speak the counterspell.'),
    h(
      'nav',
      { class: 'menu-list', attrs: { 'aria-label': 'Main menu' } },
      campaign,
      h('button', { class: 'menu-button', onClick: actions.onPractice }, 'Endless Practice'),
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
    best &&
      h(
        'p',
        { class: 'best-run' },
        `Best run: ${best.score.toLocaleString()} · `,
        best.victory ? 'all levels cleared' : `reached level ${best.reachedLevel}`,
      ),
    h(
      'p',
      { class: 'footnote' },
      `Prototype ${APP_VERSION} · Temporary art · `,
      persistent ? 'Records save in this browser' : 'Records cannot be saved in this browser',
    ),
  );
  return { element, focus: campaign };
}

// ───────────────────────── Pause ─────────────────────────

export interface PauseOption {
  label: string;
  onClick(): void;
}

/** Pause menu: Resume plus mode-specific options (Campaign: restart/abandon; Practice: end session…). */
export function pauseScreen(label: string, onResume: () => void, options: PauseOption[], note: string): Screen {
  const resume = h('button', { class: 'menu-button primary', onClick: onResume }, 'Resume');
  const element = h(
    'section',
    { class: 'screen panel pause', attrs: { role: 'dialog', 'aria-labelledby': 'pause-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'pause-title' } }, 'Paused'),
    h('p', { class: 'screen-subtitle' }, label),
    h('p', { class: 'flavour' }, 'The words hang in the air, waiting.'),
    h(
      'div',
      { class: 'menu-list' },
      resume,
      ...options.map((o) => h('button', { class: 'menu-button', onClick: o.onClick }, o.label)),
    ),
    h('p', { class: 'footnote' }, `Esc resumes · ${note}`),
  );
  // Esc is handled by the game scene (it owns the pause state).
  return { element, focus: resume };
}

// ───────────────────────── Between levels ─────────────────────────

function spellSummary(charges: SpellCharges): HTMLElement {
  const held = SPELL_IDS.filter((id) => charges[id] > 0);
  return h(
    'p',
    { class: 'spell-summary' },
    held.length === 0
      ? 'No spell tomes carried.'
      : `Carrying: ${held.map((id) => `${SPELLS[id].book} ×${charges[id]}`).join(' · ')}`,
  );
}

export function levelClearScreen(
  cleared: DifficultyConfig,
  next: DifficultyConfig,
  stats: GameStats,
  run: Readonly<CampaignRun>,
  onContinue: () => void,
): Screen {
  const button = h('button', { class: 'menu-button primary', onClick: onContinue }, `Continue to level ${next.level}`);
  const element = h(
    'section',
    { class: 'screen panel results won', attrs: { role: 'dialog', 'aria-labelledby': 'clear-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'clear-title' } }, `Level ${cleared.level} Cleared`),
    h('p', { class: 'screen-subtitle' }, cleared.name),
    h('p', { class: 'score' }, h('span', { class: 'score-label' }, 'Run score'), run.score.toLocaleString()),
    h(
      'dl',
      { class: 'stat-grid' },
      stat('Level score', `+${stats.score.toLocaleString()}`),
      stat('Accuracy', percent(stats.accuracy)),
      stat('WPM', Math.round(stats.wpm)),
      stat('Missed', stats.missed),
      stat('Best combo', `×${stats.maxCombo}`),
      stat('Time', formatTime(stats.elapsedMs)),
    ),
    spellSummary(run.spellCharges),
    h('p', { class: 'next-up' }, `Next: Level ${next.level} · ${next.name}`),
    h('div', { class: 'button-row' }, button),
  );
  return { element, focus: button };
}

// ───────────────────────── End of run ─────────────────────────

export interface RunOverActions {
  onNewRun(): void;
  onMenu(): void;
}

export function runOverScreen(
  summary: RunSummary,
  outcome: RunOutcome,
  lastLevel: DifficultyConfig,
  totalLevels: number,
  actions: RunOverActions,
): Screen {
  const won = summary.victory;
  const title = won ? 'The Tower Stands' : 'The Wards Have Fallen';
  const subtitle = won
    ? `All ${totalLevels} levels cleared`
    : `Fell on level ${summary.reachedLevel} · ${lastLevel.name} · ${summary.levelsCleared} cleared`;

  const bestLine =
    outcome.previousBest === null
      ? 'Your first recorded run'
      : outcome.isNewBest
        ? `New best run! (was ${outcome.previousBest.toLocaleString()})`
        : `Best run: ${outcome.previousBest.toLocaleString()}`;

  const newRun = h('button', { class: 'menu-button primary', onClick: actions.onNewRun }, 'New run');
  const element = h(
    'section',
    { class: `screen panel results ${won ? 'won' : 'lost'}`, attrs: { role: 'dialog', 'aria-labelledby': 'run-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'run-title' } }, title),
    h('p', { class: 'screen-subtitle' }, subtitle),
    h('p', { class: 'score' }, h('span', { class: 'score-label' }, 'Final score'), summary.score.toLocaleString()),
    h(
      'dl',
      { class: 'stat-grid' },
      stat('Accuracy', percent(summary.accuracy)),
      stat('WPM', Math.round(summary.wpm)),
      stat('Words', summary.completed),
      stat('Missed', summary.missed),
      stat('Best combo', `×${summary.maxCombo}`),
      stat('Time', formatTime(summary.elapsedMs)),
    ),
    h('p', { class: outcome.isNewBest && outcome.previousBest !== null ? 'reward' : 'personal-best' }, bestLine),
    h(
      'div',
      { class: 'button-row' },
      newRun,
      h('button', { class: 'menu-button', onClick: actions.onMenu }, 'Main menu'),
    ),
  );
  return {
    element,
    focus: newRun,
    onKey: (event) => {
      if (event.key === 'Escape') actions.onMenu();
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
