import { isRuneFinishUnlocked } from '../storage/SaveManager';
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

export function trophyCaseScreen(counts: Readonly<Record<string, number>>, lifetime: Readonly<LifetimeStats>, featured: string | null, onFeature: (id: string | null) => void, featuredRune: string | null, runeFinish: 'wax' | 'bronze' | 'silver' | 'gold', onRune: (id: string | null) => void, onFinish: (finish: 'wax' | 'bronze' | 'silver' | 'gold') => void, onBack: () => void): Screen {
  const back = h('button', { class: 'menu-button primary', onClick: onBack }, 'Return to workshop');
  const unlocked = RUNES.filter((r) => (counts[r.id] ?? 0) > 0).length;
  const total = RUNES.reduce((sum, r) => sum + (counts[r.id] ?? 0), 0);
  const element = h('section', { class: 'screen panel apprentice-ledger trophy-case', attrs: { role: 'dialog', 'aria-labelledby': 'trophy-title' } },
    h('p', { class: 'score-label' }, 'THE GRAND WIZARD’S ARCHIVE'),
    h('h2', { class: 'screen-title', attrs: { id: 'trophy-title' } }, 'Trophy Case'),
    h('p', { class: 'screen-subtitle' }, `${unlocked} of ${RUNES.length} Rune types discovered · ${total} seals earned`),
    h('p', { class: 'rune-awards-note' }, 'Collect repeat Rune seals to unlock decorative finishes: Bronze at 5, Silver at 20, Gold at 50. No score or gameplay bonuses.'),
    h('p', { class: 'triumph-featured' }, featuredRune ? `Featured Rune: ${RUNES.find((r) => r.id === featuredRune)?.name ?? 'None'} · ${runeFinish} finish` : 'Featured Rune: None'),
    featuredRune ? h('button', { class: 'triumph-feature-button', onClick: () => onRune(null) }, 'Clear featured Rune') : null,
    featuredRune ? h('div', { class: 'rune-finish-picker' }, ...(['wax', 'bronze', 'silver', 'gold'] as const).map((finish) =>
      h('button', {
        class: `rune-finish-option finish-${finish}${runeFinish === finish ? ' selected' : ''}`,
        disabled: !isRuneFinishUnlocked(counts[featuredRune] ?? 0, finish),
        attrs: { 'aria-pressed': String(runeFinish === finish) },
        onClick: () => onFinish(finish),
      }, `${finish[0].toUpperCase() + finish.slice(1)}${isRuneFinishUnlocked(counts[featuredRune] ?? 0, finish) ? '' : ' 🔒'}`),
    )) : null,
    h('div', { class: 'rune-awards-grid' }, ...RUNES.map((r) => {
      const count = counts[r.id] ?? 0;
      return h('div', { class: `rune-award trophy-entry${count ? '' : ' locked'}${featuredRune === r.id ? ` featured finish-${runeFinish}` : ''}` },
        h('span', { class: 'rune-award-seal', attrs: { 'aria-hidden': 'true' } }, count ? r.glyph : '?'),
        h('span', { class: 'rune-award-copy' },
          h('strong', null, count ? r.name : 'Undiscovered Rune'),
          h('small', null, r.rule),
          h('small', null, count ? `Seals earned: ${count}` : 'Not yet earned'),
          count ? h('button', {
            class: `triumph-feature-button${featuredRune === r.id ? ' selected' : ''}`,
            attrs: { 'aria-pressed': String(featuredRune === r.id) },
            onClick: () => onRune(r.id),
          }, featuredRune === r.id ? 'Rune displayed ✓' : 'Display this Rune') : null,
        ),
      );
    })),
    h('p', { class: 'rune-awards-note' }, 'Runes are repeatable session awards saved in this browser.'),
    h('h3', { class: 'rune-awards-title' }, 'THE GRAMMARIAN’S LEDGER'),
    h('p', { class: 'rune-awards-note' }, 'A curated collection of unambiguous words from the game dictionary. Only recognized captures count; unfamiliar and ambiguous words are excluded. Counts begin when this feature is installed.'),
    h('div', { class: 'wordclass-grid' }, ...(['noun', 'verb', 'adjective', 'adverb'] as const).map((part) =>
      h('div', { class: 'wordclass-count' },
        h('strong', null, part[0]!.toUpperCase() + part.slice(1)),
        h('span', null, String(lifetime.wordClassCounts?.[part] ?? 0)),
      ),
    )),
    h('h3', { class: 'rune-awards-title' }, 'TRIUMPHS OF THE APPRENTICE'),
    h('p', { class: 'rune-awards-note' }, 'Cosmetic reward: choose an earned Triumph as your featured title. Titles never change scores or gameplay.'),
    h('p', { class: 'triumph-featured' }, featured
      ? `Featured title: ${triumphProgress(lifetime).find((t) => t.id === featured && t.tier > 0)?.title ?? 'None'}`
      : 'Featured title: None'),
    featured ? h('button', { class: 'menu-button', onClick: () => onFeature(null) }, 'Clear featured title') : null,
    h('p', { class: 'rune-awards-note' }, 'Lifetime feats · each Triumph advances from Bronze to Silver to Gold.'),
    h('p', { class: 'rune-awards-note' }, 'Rare wordcraft medals reward Alliteration, Librarian, Metronome and Clean Sweep bonuses already earned in play. No new scoring modifiers.'),
    h('div', { class: 'triumph-grid' }, ...triumphProgress(lifetime).map((t) =>
      h('div', { class: `triumph-entry${t.tier ? ` unlocked tier-${t.tier}` : ''}${['alliteration', 'librarian', 'metronome', 'sweep', 'nouns', 'verbs', 'adjectives', 'adverbs'].includes(t.id) ? ' wordcraft-triumph' : ''}` },
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
