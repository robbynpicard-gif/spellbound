/** Conservative, hand-reviewed grammatical examples from the shipped word bank.
 * English words often have multiple parts of speech; ambiguous entries are
 * deliberately omitted rather than guessed. Unknown words are unclassified.
 * This lexicon is a starting point, not a comprehensive English parser. */
export const WORD_CLASSES = ['noun', 'verb', 'adjective', 'adverb'] as const;
export type WordClass = typeof WORD_CLASSES[number];

const EXAMPLES: Record<WordClass, readonly string[]> = {
  noun: ['wizard', 'dragon', 'castle', 'lantern', 'scroll', 'parchment', 'tower', 'forest', 'river', 'mountain', 'garden', 'library', 'kingdom', 'village', 'knight', 'sword', 'shield', 'crown', 'crystal', 'potion', 'thunder', 'storm', 'shadow', 'moon', 'star', 'book', 'quill', 'ink', 'feather', 'stone', 'flame', 'ember', 'mirror', 'portal', 'treasure', 'merchant', 'apprentice', 'scholar', 'alchemist'],
  verb: ['wander', 'whisper', 'shimmer', 'tremble', 'sparkle', 'gather', 'protect', 'discover', 'imagine', 'explore', 'summon', 'conjure', 'defend', 'remember', 'travel', 'listen', 'dance', 'climb', 'leap', 'glide', 'hover'],
  adjective: ['ancient', 'arcane', 'golden', 'silver', 'crimson', 'emerald', 'quiet', 'gentle', 'fierce', 'bright', 'dark', 'swift', 'clever', 'mighty', 'noble', 'sacred', 'hidden', 'enchanted', 'mysterious', 'magical'],
  adverb: ['quickly', 'quietly', 'suddenly', 'rapidly', 'readily', 'honestly', 'smoothly', 'strongly', 'directly', 'recently', 'commonly', 'especially', 'totally', 'usually', 'aptly', 'badly', 'dimly', 'dryly', 'duly', 'fully', 'madly', 'newly', 'sadly', 'truly', 'wryly'],
};
const LOOKUP = new Map<string, WordClass>();
for (const category of WORD_CLASSES) for (const word of EXAMPLES[category]) {
  if (LOOKUP.has(word)) throw new Error(`Ambiguous word in Wordcraft lexicon: ${word}`);
  LOOKUP.set(word, category);
}

/** Returns null for words we cannot classify confidently. No suffix guessing. */
export function classifyWord(word: string): WordClass | null {
  return LOOKUP.get(word.trim().toLowerCase()) ?? null;
}

export function emptyWordClassCounts(): Record<WordClass, number> {
  return { noun: 0, verb: 0, adjective: 0, adverb: 0 };
}
