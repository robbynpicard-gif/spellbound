import { averageWordLength, type DifficultyConfig } from '../difficulty/DifficultyConfig';
import type { GameStats } from '../gameplay/ScoringSystem';
import {
  FILTER_AVAILABLE,
  MODIFIER_FILTERS,
  practiceKey,
  type ModifierFilter,
  type PracticeOutcome,
  type PracticeRecord,
  type RecordField,
} from '../modes/PracticeMode';
import { formatTime, h, percent } from './dom';
import type { Screen } from './UIRoot';

export const FILTER_LABELS: Record<ModifierFilter, { title: string; detail: string }> = {
  all: { title: 'All specials', detail: 'Spell scrolls + alchemical modifiers (coming soon)' },
  original: { title: 'Spell scrolls', detail: "The level's spell scrolls, as in Campaign" },
  none: { title: 'Pure typing', detail: 'No scrolls, no specials' },
};

// ───────────────────────── Setup ─────────────────────────

export interface PracticeSetupActions {
  onStart(level: number, filter: ModifierFilter): void;
  onBack(): void;
}

/**
 * Choose a level (any level reached in Campaign) and which specials appear.
 * Clicking a level card starts the session straight away.
 */
export function practiceSetupScreen(
  levels: readonly DifficultyConfig[],
  highestReached: number,
  records: Readonly<Record<string, PracticeRecord>>,
  initial: { level: number; filter: ModifierFilter },
  actions: PracticeSetupActions,
): Screen {
  let filter: ModifierFilter = FILTER_AVAILABLE[initial.filter] ? initial.filter : 'original';
  const grid = h('div', { class: 'level-grid' });

  const radios = MODIFIER_FILTERS.map((f) => {
    const input = h('input', { attrs: { type: 'radio', name: 'practice-filter', value: f } });
    input.checked = f === filter;
    input.disabled = !FILTER_AVAILABLE[f];
    input.addEventListener('change', () => {
      filter = f;
      renderCards();
    });
    return h(
      'label',
      { class: `filter-option${input.disabled ? ' disabled' : ''}` },
      input,
      h('span', { class: 'filter-title' }, FILTER_LABELS[f].title),
      h('span', { class: 'filter-detail' }, FILTER_LABELS[f].detail),
    );
  });

  let focusCard: HTMLElement | null = null;
  function renderCards(): void {
    focusCard = null;
    grid.replaceChildren(
      ...levels.map((config) => {
        const locked = config.level > highestReached;
        const record = records[practiceKey(config.level, filter)];
        const pace = `${config.initialFallSpeed} px/s · every ${(config.spawnInterval / 1000).toFixed(1)} s · ~${averageWordLength(config).toFixed(1)} letters`;
        const card = h(
          'button',
          {
            class: `level-card${locked ? ' locked' : ''}${record ? ' cleared' : ''}`,
            disabled: locked,
            onClick: () => actions.onStart(config.level, filter),
            attrs: {
              'aria-label': locked
                ? `Level ${config.level}, not yet reached in Campaign`
                : `Practise level ${config.level}, ${config.name}${record ? `, best ${record.bestScore}` : ''}`,
            },
          },
          h('span', { class: 'level-number' }, config.level),
          h('span', { class: 'level-name' }, locked ? 'Sealed' : config.name),
          h('span', { class: 'level-detail' }, locked ? 'Reach it in Campaign' : pace),
          !locked &&
            h(
              'span',
              { class: 'level-detail best' },
              record ? `Best ${record.bestScore.toLocaleString()} · ${formatTime(record.longestMs)}` : 'No sessions yet',
            ),
        );
        if (config.level === initial.level && !locked) focusCard = card;
        return card;
      }),
    );
  }
  renderCards();

  const element = h(
    'section',
    { class: 'screen practice-setup', attrs: { 'aria-labelledby': 'practice-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'practice-title' } }, 'Endless Practice'),
    h(
      'p',
      { class: 'screen-subtitle' },
      'Exactly the same difficulty as the Campaign level, forever. Levels open as you reach them in Campaign.',
    ),
    h(
      'fieldset',
      { class: 'filter-group' },
      h('legend', null, 'Specials'),
      ...radios,
    ),
    grid,
    h('div', { class: 'button-row' }, h('button', { class: 'menu-button', onClick: actions.onBack }, 'Back')),
  );

  return {
    element,
    focus: focusCard,
    onKey: (event) => {
      if (event.key === 'Escape') actions.onBack();
    },
  };
}

// ───────────────────────── Results ─────────────────────────

export interface PracticeResultsActions {
  onAgain(): void;
  onChangeLevel(): void;
  onMenu(): void;
}

/** GDD §14 practice statistics, with this level's personal bests. */
export function practiceResultsScreen(
  config: DifficultyConfig,
  filter: ModifierFilter,
  stats: GameStats,
  outcome: PracticeOutcome,
  fell: boolean,
  actions: PracticeResultsActions,
): Screen {
  const best = new Set<RecordField>(outcome.improved);
  const r = outcome.record;
  const stat = (label: string, value: string, field: RecordField | null, bestText: string) =>
    h(
      'div',
      { class: `stat${field && best.has(field) ? ' new-best' : ''}` },
      h('dt', null, label),
      h('dd', null, value),
      h('span', { class: 'stat-best' }, field && best.has(field) ? 'New best!' : bestText),
    );
  const pct = (v: number) => (v > 0 ? percent(v) : '—');
  const secs = (ms: number) => (ms > 0 ? `${(ms / 1000).toFixed(1)} s` : '—');

  const again = h('button', { class: 'menu-button primary', onClick: actions.onAgain }, 'Practise again');
  const element = h(
    'section',
    { class: `screen panel results ${fell ? 'lost' : 'won'}`, attrs: { role: 'dialog', 'aria-labelledby': 'pr-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'pr-title' } }, fell ? 'The Wards Have Fallen' : 'Session Ended'),
    h('p', { class: 'screen-subtitle' }, `Practice · Level ${config.level} · ${config.name} · ${FILTER_LABELS[filter].title}`),
    h('p', { class: 'score' }, h('span', { class: 'score-label' }, 'Score'), stats.score.toLocaleString()),
    h(
      'dl',
      { class: 'stat-grid' },
      stat('Time survived', formatTime(stats.elapsedMs), 'longestMs', `Best ${formatTime(r.longestMs)}`),
      stat('Words', String(stats.completed), 'mostWords', `Best ${r.mostWords}`),
      stat('Missed', String(stats.missed), null, ''),
      stat('Accuracy', percent(stats.accuracy), 'bestAccuracy', `Best ${pct(r.bestAccuracy)}`),
      stat('WPM', String(Math.round(stats.wpm)), 'bestWpm', `Best ${Math.round(r.bestWpm)}`),
      stat('Avg. time per word', secs(stats.averageCompletionMs), 'fastestAverageMs', `Best ${secs(r.fastestAverageMs)}`),
      stat('Best combo', `×${stats.maxCombo}`, 'bestCombo', `Best ×${r.bestCombo}`),
    ),
    h(
      'p',
      { class: best.has('bestScore') ? 'reward' : 'personal-best' },
      outcome.firstSession
        ? 'First session at this level — records set.'
        : best.has('bestScore')
          ? `New best score! Sessions here: ${r.sessions}`
          : `Best score ${r.bestScore.toLocaleString()} · Sessions here: ${r.sessions}`,
    ),
    h('p', { class: 'footnote' }, 'Practice records are kept separately from Campaign.'),
    h(
      'div',
      { class: 'button-row' },
      again,
      h('button', { class: 'menu-button', onClick: actions.onChangeLevel }, 'Change level'),
      h('button', { class: 'menu-button', onClick: actions.onMenu }, 'Main menu'),
    ),
  );
  return {
    element,
    focus: again,
    onKey: (event) => {
      if (event.key === 'Escape') actions.onChangeLevel();
    },
  };
}
