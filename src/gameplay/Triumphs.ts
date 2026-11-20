import type { LifetimeStats } from '../storage/LifetimeStats';

/** Long-term Triumphs are derived from authoritative lifetime counters.
 * Tiers are earned once, never spent or repeatedly awarded. */
export const TRIUMPH_TIERS = ['Bronze', 'Silver', 'Gold'] as const;
export const TRIUMPH_DEFINITIONS = [
  { glyph: '✒', lore: 'Every word leaves its mark.', id: 'scribe', title: 'The Patient Scribe', metric: 'wordsCaptured', targets: [100, 1000, 10000], unit: 'words captured' },
  { glyph: '⌛', lore: 'Every lesson becomes a legend.', id: 'journey', title: 'The Long Apprenticeship', metric: 'levelsPlayed', targets: [10, 100, 500], unit: 'levels played' },
  { glyph: '♜', lore: 'The wards endure through your resolve.', id: 'victory', title: 'Keeper of the Wards', metric: 'levelsWon', targets: [5, 50, 250], unit: 'levels won' },
  { glyph: '❖', lore: 'The flawless line is forged in focus.', id: 'precision', title: 'Unbroken Quill', metric: 'bestCleanStreak', targets: [10, 25, 50], unit: 'best clean streak' },
  { glyph: '⛓', lore: 'One word binds the next.', id: 'chain', title: 'Weaver of Words', metric: 'bestCombo', targets: [20, 50, 100], unit: 'best combo' },
  { glyph: 'ϟ', lore: 'The storm answers swift hands.', id: 'volley', title: 'Storm of Letters', metric: 'volleyBonuses', targets: [10, 100, 500], unit: 'Volley bonuses' },
  { glyph: 'ᴀ', lore: 'Kindred initials march together.', id: 'alliteration', title: 'The Alliterative Art', metric: 'alliterationBonuses', targets: [10, 75, 300], unit: 'Alliteration bonuses' },
  { glyph: '▤', lore: 'Every volume returns to its rightful shelf.', id: 'librarian', title: 'Keeper of the Lexicon', metric: 'librarianBonuses', targets: [10, 75, 300], unit: 'Librarian bonuses' },
  { glyph: '♫', lore: 'Every keystroke finds its rhythm.', id: 'metronome', title: 'The Clockwork Quill', metric: 'metronomeBonuses', targets: [10, 75, 300], unit: 'Metronome bonuses' },
  { glyph: '✺', lore: 'A clear field is its own reward.', id: 'sweep', title: 'Warden of the Empty Sky', metric: 'sweepBonuses', targets: [5, 30, 150], unit: 'Clean Sweep bonuses' },
  { glyph: '♧', lore: 'Give every thing its true name.', id: 'nouns', title: 'The Namer of Things', metric: 'nounCaptures', targets: [10, 50, 200], unit: 'classified nouns' },
  { glyph: '➶', lore: 'Every action begins with a word.', id: 'verbs', title: 'The Spell of Action', metric: 'verbCaptures', targets: [10, 50, 200], unit: 'classified verbs' },
  { glyph: '❀', lore: 'Color the world with precise language.', id: 'adjectives', title: 'The Illuminator', metric: 'adjectiveCaptures', targets: [10, 50, 200], unit: 'classified adjectives' },
  { glyph: '◷', lore: 'Master the manner of every motion.', id: 'adverbs', title: 'The Subtle Scribe', metric: 'adverbCaptures', targets: [5, 25, 100], unit: 'classified adverbs' },
  { glyph: '⚔', lore: 'A name awakens an action.', id: 'awakening', title: 'The Awakening', metric: 'awakeningPhrases', targets: [3, 15, 60], unit: 'noun → verb phrases' },
  { glyph: '✧', lore: 'The description illuminates its subject.', id: 'illumination', title: 'The Illuminated Phrase', metric: 'illuminationPhrases', targets: [3, 15, 60], unit: 'adjective → noun phrases' },
  { glyph: '✦', lore: 'Manner and motion become one.', id: 'incantation', title: 'The Precise Incantation', metric: 'incantationPhrases', targets: [3, 15, 60], unit: 'adverb → verb phrases' },
] as const;

export function triumphProgress(lifetime: Readonly<LifetimeStats>) {
  return TRIUMPH_DEFINITIONS.map((definition) => {
    const value = definition.metric === 'volleyBonuses' ? (lifetime.bonusCounts.volley ?? 0)
      : definition.metric === 'alliterationBonuses' ? (lifetime.bonusCounts.alliteration ?? 0)
      : definition.metric === 'librarianBonuses' ? (lifetime.bonusCounts.librarian ?? 0)
      : definition.metric === 'metronomeBonuses' ? (lifetime.bonusCounts.metronome ?? 0)
      : definition.metric === 'sweepBonuses' ? (lifetime.bonusCounts.sweep ?? 0)
      : definition.metric === 'nounCaptures' ? (lifetime.wordClassCounts.noun ?? 0)
      : definition.metric === 'verbCaptures' ? (lifetime.wordClassCounts.verb ?? 0)
      : definition.metric === 'adjectiveCaptures' ? (lifetime.wordClassCounts.adjective ?? 0)
      : definition.metric === 'adverbCaptures' ? (lifetime.wordClassCounts.adverb ?? 0)
      : definition.metric === 'awakeningPhrases' ? (lifetime.phraseCounts.awakening ?? 0)
      : definition.metric === 'illuminationPhrases' ? (lifetime.phraseCounts.illumination ?? 0)
      : definition.metric === 'incantationPhrases' ? (lifetime.phraseCounts.incantation ?? 0)
      : lifetime[definition.metric];
    const tier = definition.targets.filter((target) => value >= target).length;
    const next = tier < definition.targets.length ? definition.targets[tier] : null;
    return { ...definition, value, tier, next };
  });
}

/** Compare before and after lifetime snapshots; only newly crossed tiers are announced.
 * If a single session crosses several thresholds, announce every tier in order. */
export function newlyEarnedTriumphs(before: Readonly<LifetimeStats>, after: Readonly<LifetimeStats>) {
  const previous = triumphProgress(before);
  return triumphProgress(after).flatMap((current, index) => {
    const oldTier = previous[index]!.tier;
    return Array.from({ length: Math.max(0, current.tier - oldTier) }, (_, i) => ({
      id: current.id,
      title: current.title,
      glyph: current.glyph,
      lore: current.lore,
      tier: oldTier + i + 1,
      tierName: TRIUMPH_TIERS[oldTier + i]!,
    }));
  });
}
