import type { Lesson, Line } from '../app/Apprenticeship';
import type { GameStats } from '../gameplay/ScoringSystem';
import { h } from './dom';
import type { Screen } from './UIRoot';

type Button = { label: string; onClick(): void; primary?: boolean };

function buttons(list: Button[]): HTMLElement[] {
  return list.map((b) => h('button', { class: `menu-button${b.primary ? ' primary' : ''}`, onClick: b.onClick }, b.label));
}

function escapable(element: HTMLElement, focus: HTMLElement | null, onBack: () => void): Screen {
  return { element, focus, onKey: (e) => e.key === 'Escape' && onBack() };
}

export function apprenticeshipMenuScreen(
  lessons: readonly Lesson[],
  done: ReadonlySet<string>,
  actions: { onPlay(index: number): void; onSandbox(): void; onBack(): void },
): Screen {
  const next = Math.max(0, lessons.findIndex((l) => !done.has(l.id)));
  const rows = lessons.map((l, i) =>
    h(
      'button',
      { class: `menu-button${i === next ? ' primary' : ''}`, onClick: () => actions.onPlay(i) },
      `${i + 1}. ${l.title}`,
      done.has(l.id) ? h('span', { class: 'badge' }, '✓ Replay') : null,
    ),
  );
  const element = h(
    'section',
    { class: 'screen panel credits', attrs: { 'aria-labelledby': 'appr-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'appr-title' } }, 'Apprenticeship · The Wind Master'),
    h('p', null, 'A short training course. Every lesson can be played, replayed or skipped in any order. Nothing here affects Campaign records.'),
    h('nav', { class: 'menu-list' }, ...rows),
    h('div', { class: 'button-row' }, ...buttons([{ label: 'Spell Sandbox', onClick: actions.onSandbox }, { label: 'Back', onClick: actions.onBack }])),
    h('p', { class: 'footnote' }, 'Prototype: placeholder mentors, lines and tuning.'),
  );
  return escapable(element, rows[next] ?? null, actions.onBack);
}

/** Mentor dialogue: a few short lines and a choice. */
export function mentorScreen(title: string, lines: readonly Line[], choices: Button[], onBack: () => void): Screen {
  const row = buttons(choices);
  const element = h(
    'section',
    { class: 'screen panel credits', attrs: { 'aria-labelledby': 'mentor-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'mentor-title' } }, title),
    ...lines.map((l) => h('p', null, h('strong', null, `${l.speaker}: `), l.text)),
    h('div', { class: 'button-row' }, ...row),
  );
  return escapable(element, row[0] ?? null, onBack);
}

export function sandboxSetupScreen(
  mode: 'normal' | 'hardcore',
  actions: { onMode(mode: 'normal' | 'hardcore'): void; onStart(stage: number): void; onBack(): void },
): Screen {
  const stages = [1, 2, 3, 4, 5].map((n) => h('button', { class: `menu-button${n === 3 ? ' primary' : ''}`, onClick: () => actions.onStart(n) }, `Stage ${n} pace`));
  const element = h(
    'section',
    { class: 'screen panel credits', attrs: { 'aria-labelledby': 'sandbox-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'sandbox-title' } }, 'Spell Sandbox'),
    h('p', null, 'Endless field with every spell and a large stock of charges (6 Wind, 4 each of Harvest, Shock, Ice and Slow, 3 Barrier, 2 Alter and Fire). Try Wind + Harvest, Wind + Shock, Ice Focus and Barrier insurance on purpose.'),
    h('p', null, `Rules: ${mode === 'hardcore' ? 'Hardcore (spells typed; any slip breaks All-In)' : 'Normal (number keys cast; a breach breaks All-In)'}.`),
    h('div', { class: 'button-row' }, ...buttons([
      { label: 'Normal rules', onClick: () => actions.onMode('normal'), primary: mode === 'normal' },
      { label: 'Hardcore rules', onClick: () => actions.onMode('hardcore'), primary: mode === 'hardcore' },
    ])),
    h('nav', { class: 'menu-list' }, ...stages),
    h('div', { class: 'button-row' }, ...buttons([{ label: 'Back', onClick: actions.onBack }])),
    h('p', { class: 'footnote' }, 'Sandbox scores are not saved and do not count for records, Runes or Triumphs.'),
  );
  return escapable(element, stages[2] ?? null, actions.onBack);
}

export function sandboxResultScreen(stats: GameStats, actions: { onAgain(): void; onBack(): void }): Screen {
  const rows: [string, string][] = [
    ['Score', String(stats.score)],
    ['All-In wagers', String(stats.allInWagers ?? 0)],
    ['Points inside All-In', String(stats.allInPoints ?? 0)],
    ['  of which typed', String(stats.allInTypedPoints ?? 0)],
    ['Harvests in All-In', String(stats.allInHarvests ?? 0)],
    ['Shocks in All-In', String(stats.allInShocks ?? 0)],
    ['Final Ward maximum', `${stats.wardCap ?? 100}%`],
    ['Peak Volley', `×${stats.peakArcaneVolleyMultiplier ?? 1}`],
  ];
  const row = buttons([{ label: 'Again (refill charges)', onClick: actions.onAgain, primary: true }, { label: 'Back', onClick: actions.onBack }]);
  const element = h(
    'section',
    { class: 'screen panel credits', attrs: { 'aria-labelledby': 'sb-res' } },
    h('h2', { class: 'screen-title', attrs: { id: 'sb-res' } }, 'Sandbox results'),
    h('table', { class: 'codex-table' }, h('tbody', null, ...rows.map(([k, v]) => h('tr', null, h('td', null, k), h('td', null, v))))),
    h('div', { class: 'button-row' }, ...row),
  );
  return escapable(element, row[0] ?? null, actions.onBack);
}
