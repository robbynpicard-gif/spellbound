import type { LifetimeStats } from '../storage/LifetimeStats';
import { newlyEarnedTriumphs } from '../gameplay/Triumphs';
import { h } from './dom';

/** Celebrates only tiers unlocked by the session just completed. */
export function triumphUnlockAnnouncement(before: Readonly<LifetimeStats>, after: Readonly<LifetimeStats>): HTMLElement | null {
  const unlocked = newlyEarnedTriumphs(before, after);
  if (!unlocked.length) return null;
  return h('section', { class: 'triumph-unlocks', attrs: { role: 'status', 'aria-label': 'New Triumphs earned' } },
    h('h3', { class: 'triumph-unlocks-title' }, unlocked.length === 1 ? 'NEW TRIUMPH EARNED' : 'NEW TRIUMPHS EARNED'),
    h('div', { class: 'triumph-unlocks-list' }, ...unlocked.map((award) =>
      h('div', { class: `triumph-unlock tier-${award.tier}` },
        h('span', { class: 'triumph-unlock-medal', attrs: { 'aria-hidden': 'true' } }, award.glyph),
        h('span', { class: 'triumph-unlock-copy' },
          h('strong', null, award.title),
          h('small', { class: 'triumph-lore' }, award.lore),
          h('small', null, `${award.tierName} tier unlocked · recorded in your Trophy Case`),
        ),
      ),
    )),
  );
}
