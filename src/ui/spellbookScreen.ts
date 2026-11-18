import { DISCOVERY_ORDER } from '../difficulty/Stages';
import type { SpellId } from '../gameplay/SpellManager';
import { hex, SPELL_COLORS } from '../render/layout';
import { SPELLS } from '../spells/SpellRegistry';
import { h } from './dom';
import type { Screen } from './UIRoot';

/**
 * Spellbook (owner, 2026-11-17): which spell sits on each number key, 1–8.
 * In Normal, pressing the key casts that spell (typing its name works too);
 * Hardcore is typing only. One layout for both modes. Main menu only.
 */
export function spellbookScreen(
  initial: readonly SpellId[],
  discovered: (spell: SpellId) => boolean,
  actions: { onSave(slots: SpellId[]): void; onBack(): void },
): Screen {
  let slots = [...initial];
  const list = h('ol', { class: 'spellbook-list' });

  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= slots.length) return;
    [slots[i], slots[j]] = [slots[j]!, slots[i]!];
    actions.onSave(slots);
    render(j, by);
  };

  function render(focusIndex = -1, dir = 0): void {
    list.replaceChildren(
      ...slots.map((id, i) => {
        const known = discovered(id);
        const spell = SPELLS[id];
        const up = h('button', { class: 'tab', onClick: () => move(i, -1), disabled: i === 0, attrs: { 'aria-label': `Move ${spell.name} up` } }, '▲');
        const down = h(
          'button',
          { class: 'tab', onClick: () => move(i, 1), disabled: i === slots.length - 1, attrs: { 'aria-label': `Move ${spell.name} down` } },
          '▼',
        );
        if (i === focusIndex) queueMicrotask(() => (dir < 0 ? up : down).focus());
        return h(
          'li',
          { class: `spellbook-row${known ? '' : ' locked'}` },
          h('span', { class: 'spellbook-key' }, String(i + 1)),
          h(
            'span',
            { class: 'spellbook-name', attrs: { style: `color: ${hex(SPELL_COLORS[id])}` } },
            id.toUpperCase(),
          ),
          h('span', { class: 'spellbook-summary' }, known ? spell.summary : 'Not discovered yet'),
          h('span', { class: 'spellbook-moves' }, up, down),
        );
      }),
    );
  }
  render();

  const reset = h(
    'button',
    {
      class: 'menu-button',
      onClick: () => {
        slots = [...DISCOVERY_ORDER];
        actions.onSave(slots);
        render();
      },
    },
    'Reset to discovery order',
  );
  const back = h('button', { class: 'menu-button primary', onClick: actions.onBack }, 'Back');
  const element = h(
    'section',
    { class: 'screen panel spellbook', attrs: { 'aria-labelledby': 'spellbook-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'spellbook-title' } }, 'Spellbook'),
    h(
      'p',
      { class: 'screen-subtitle' },
      'In Normal, press a number key to cast that spell (typing its name and Enter works too). In Hardcore, spells are cast by typing only.',
    ),
    list,
    h('div', { class: 'button-row' }, reset, back),
  );
  return {
    element,
    focus: back,
    onKey: (event) => {
      if (event.key === 'Escape') actions.onBack();
    },
  };
}
