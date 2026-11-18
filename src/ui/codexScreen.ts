import { h } from './dom';
import type { Screen } from './UIRoot';
import { CODEX } from './codex';

/** Main menu → Codex: how the game's mechanics work (never shown during a run). */
export function codexScreen(onBack: () => void): Screen {
  const table = (t: { head: string[]; rows: (string | number)[][] }) =>
    h('table', { class: 'codex-table' }, h('thead', null, h('tr', null, ...t.head.map((c) => h('th', null, c)))), h('tbody', null, ...t.rows.map((r) => h('tr', null, ...r.map((c) => h('td', null, String(c)))))));
  const body = h('div', { class: 'codex-body' });
  const show = (i: number) => {
    const s = CODEX[i]!;
    const parts: HTMLElement[] = [];
    if (s.intro) parts.push(h('p', { class: 'codex-intro' }, s.intro));
    if (s.points) parts.push(h('ul', { class: 'codex-points' }, ...s.points.map((p) => h('li', null, p))));
    if (s.table) parts.push(table(s.table));
    if (s.table2) parts.push(table(s.table2));
    body.replaceChildren(...parts);
    tabs.forEach((t, j) => t.classList.toggle('primary', i === j));
  };
  const tabs = CODEX.map((s, i) => h('button', { class: 'menu-button tab', onClick: () => show(i) }, s.title));
  const back = h('button', { class: 'menu-button', onClick: onBack }, 'Back');
  const element = h(
    'section',
    { class: 'screen panel codex', attrs: { role: 'dialog', 'aria-labelledby': 'codex-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'codex-title' } }, 'Codex'),
    h('div', { class: 'practice-tabs' }, ...tabs),
    body,
    h('div', { class: 'button-row' }, back),
  );
  show(0);
  return { element, focus: tabs[0]!, onKey: (e) => { if (e.key === 'Escape') onBack(); } };
}
