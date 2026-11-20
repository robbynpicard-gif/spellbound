import { triumphProgress, TRIUMPH_TIERS } from '../gameplay/Triumphs';
import type { LifetimeStats } from '../storage/LifetimeStats';
import { h } from './dom';
import type { Screen } from './UIRoot';

/** The collection is intentionally limited to earned Rune seals.
 * Long-form Triumphs will have their own progression rules later. */
const RUNES = [
  { id: 'volley', glyph: '✦', name: 'Volley Rune', rule: 'Capture 3 words within 2 seconds.' },
  { id: 'precision', glyph: '❖', name: 'Precision Rune', rule: 'Reach a 10-word Clean Streak.' },
  { id: 'chain', glyph: '✧', name: 'Chain Rune', rule: 'Build a 20-word combo.' },
  { id: 'scribe', glyph: '✳', name: 'Scribe Rune', rule: 'Complete 10 words with at least 98% accuracy.' },
] as const;

export function trophyCaseScreen(counts: Readonly<Record<string, number>>, lifetime: Readonly<LifetimeStats>, featured: string | null, onFeature: (id: string | null) => void, onBack: () => void): Screen {
  const back = h('button', { class: 'menu-button primary', onClick: onBack }, 'Return to workshop');
  const unlocked = RUNES.filter((r) => (counts[r.id] ?? 0) > 0).length;
  const total = RUNES.reduce((sum, r) => sum + (counts[r.id] ?? 0), 0);
  const element = h('section', { class: 'screen panel apprentice-ledger trophy-case', attrs: { role: 'dialog', 'aria-labelledby': 'trophy-title' } },
    h('p', { class: 'score-label' }, 'THE GRAND WIZARD’S ARCHIVE'),
    h('h2', { class: 'screen-title', attrs: { id: 'trophy-title' } }, 'Trophy Case'),
    h('p', { class: 'screen-subtitle' }, `${unlocked} of ${RUNES.length} Rune types discovered · ${total} seals earned`),
    h('div', { class: 'rune-awards-grid' }, ...RUNES.map((r) => {
      const count = counts[r.id] ?? 0;
      return h('div', { class: `rune-award trophy-entry${count ? '' : ' locked'}` },
        h('span', { class: 'rune-award-seal', attrs: { 'aria-hidden': 'true' } }, count ? r.glyph : '?'),
        h('span', { class: 'rune-award-copy' },
          h('strong', null, count ? r.name : 'Undiscovered Rune'),
          h('small', null, r.rule),
          h('small', null, count ? `Seals earned: ${count}` : 'Not yet earned'),
        ),
      );
    })),
    h('p', { class: 'rune-awards-note' }, 'Runes are repeatable session awards saved in this browser.'),
    h('h3', { class: 'rune-awards-title' }, 'TRIUMPHS OF THE APPRENTICE'),
    h('p', { class: 'rune-awards-note' }, 'Cosmetic reward: choose an earned Triumph as your featured title. Titles never change scores or gameplay.'),
    h('p', { class: 'triumph-featured' }, featured
      ? `Featured title: ${triumphProgress(lifetime).find((t) => t.id === featured && t.tier > 0)?.title ?? 'None'}`
      : 'Featured title: None'),
    featured ? h('button', { class: 'menu-button', onClick: () => onFeature(null) }, 'Clear featured title') : null,
    h('p', { class: 'rune-awards-note' }, 'Lifetime feats · each Triumph advances from Bronze to Silver to Gold.'),
    h('div', { class: 'triumph-grid' }, ...triumphProgress(lifetime).map((t) =>
      h('div', { class: `triumph-entry${t.tier ? ` unlocked tier-${t.tier}` : ''}` },
        h('span', { class: 'triumph-medal', attrs: { 'aria-hidden': 'true' } }, t.tier ? t.glyph : '◇'),
        h('div', { class: 'triumph-copy' },
          h('strong', null, t.title),
          h('small', { class: 'triumph-lore' }, t.lore),
          h('small', null, t.tier ? `${TRIUMPH_TIERS[t.tier - 1]} Triumph` : 'Not yet earned'),
          h('small', null, `${t.value.toLocaleString()} ${t.unit}`),
          h('small', null, t.next === null ? 'All three tiers mastered' : `Next ${TRIUMPH_TIERS[t.tier]}: ${t.next.toLocaleString()} ${t.unit}`),
          h('progress', { attrs: { max: String(t.next ?? t.targets[2]), value: String(Math.min(t.value, t.next ?? t.targets[2])), 'aria-label': `${t.title} progress` } }),
          t.tier > 0 ? h('button', {
            class: `triumph-feature-button${featured === t.id ? ' selected' : ''}`,
            attrs: { 'aria-pressed': String(featured === t.id) },
            onClick: () => onFeature(t.id),
          }, featured === t.id ? 'Featured title ✓' : 'Feature this title') : null,
        ),
      ),
    )),
    h('div', { class: 'button-row' }, back),
  );
  return { element, focus: back, onKey: (e) => { if (e.key === 'Escape') onBack(); } };
}
