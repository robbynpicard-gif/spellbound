/** Conservative, hand-reviewed grammatical examples from the shipped word bank.
 * English words often have multiple parts of speech; ambiguous entries are
 * deliberately omitted rather than guessed. Unknown words are unclassified.
 * This lexicon is a starting point, not a comprehensive English parser. */
export const WORD_CLASSES = ['noun', 'verb', 'adjective', 'adverb'] as const;
export type WordClass = typeof WORD_CLASSES[number];

const EXAMPLES: Record<WordClass, readonly string[]> = {
  noun: ['wizard', 'dragon', 'castle', 'lantern', 'parchment', 'tower', 'forest', 'river', 'mountain', 'library', 'kingdom', 'village', 'knight', 'sword', 'crystal', 'potion', 'thunder', 'moon', 'star', 'quill', 'feather', 'ember', 'portal', 'merchant', 'apprentice', 'scholar', 'alchemist', 'abbey', 'acorn', 'anvil', 'attic', 'banner', 'barrel', 'beacon', 'blanket', 'blossom', 'bracelet', 'canyon', 'caravan', 'cathedral', 'cellar', 'chapel', 'chimney', 'cottage', 'courtyard', 'dagger', 'diamond', 'dungeon', 'eagle', 'emperor', 'falcon', 'fortress', 'fountain', 'goblin', 'helmet', 'hermit', 'island', 'jewel', 'labyrinth', 'meadow', 'monastery', 'orchard', 'palace', 'peasant', 'pilgrim', 'pirate', 'rabbit', 'raven', 'relic', 'serpent', 'skeleton', 'spider', 'temple', 'throne', 'unicorn', 'valley', 'vineyard', 'volcano', 'warrior', 'willow', 'actor', 'airplane', 'airport', 'album', 'alphabet', 'ambulance', 'angel', 'apartment', 'aquarium', 'architect', 'asteroid', 'astronaut', 'athlete', 'avocado', 'bacteria', 'bakery', 'balloon', 'banana', 'bandit', 'barn', 'basil', 'basket', 'bathroom', 'beaver', 'beetle', 'bicycle', 'biscuit', 'blacksmith', 'blueberry', 'bookcase', 'bookshelf', 'broccoli', 'butterfly', 'cabbage', 'cactus', 'calendar', 'camel', 'camera', 'captain', 'carrot', 'cavern', 'centaur', 'chandelier', 'cheetah', 'chicken', 'citadel', 'citizen', 'cobweb', 'coconut', 'comet', 'computer', 'crocodile', 'cucumber', 'curtain', 'daffodil', 'daisy', 'dentist', 'dinosaur', 'dolphin', 'donkey', 'doorway', 'encyclopedia', 'envelope', 'festival', 'flamingo', 'glacier', 'gorilla', 'granite', 'grasshopper', 'guitar', 'hedgehog', 'hospital', 'hyena', 'instrument', 'inventor', 'jellyfish', 'jester', 'journalist', 'kangaroo', 'kettle', 'kitten', 'laboratory', 'leopard', 'lighthouse', 'lobster', 'mammoth', 'manuscript', 'marigold', 'marmalade', 'mermaid', 'meteor', 'minotaur', 'mushroom', 'museum', 'necklace', 'octopus', 'omelet', 'orchestra', 'ostrich', 'otter', 'pancake', 'panther', 'parrot', 'penguin', 'pineapple', 'planet', 'pumpkin', 'pyramid', 'raccoon', 'raspberry', 'refrigerator', 'salamander', 'sapphire', 'satchel', 'satellite', 'scarecrow', 'scorpion', 'staircase', 'submarine', 'sunflower', 'telescope', 'thunderstorm', 'tortoise', 'tulip', 'vampire', 'violin', 'walrus', 'waterfall', 'werewolf', 'wizardry'],
  verb: ['tremble', 'gather', 'protect', 'discover', 'imagine', 'explore', 'summon', 'conjure', 'defend', 'remember', 'listen', 'climb', 'believe', 'calculate', 'celebrate', 'compare', 'consider', 'continue', 'decorate', 'deliver', 'describe', 'forgive', 'observe', 'organize', 'persuade', 'prepare', 'recover', 'reflect', 'rejoice', 'retreat', 'reveal', 'translate', 'understand', 'activate', 'adapt', 'adjust', 'announce', 'assemble', 'complain', 'confirm', 'connect', 'convince', 'cooperate', 'determine', 'educate', 'eliminate', 'evaluate', 'hesitate', 'illustrate', 'improve', 'include', 'initiate', 'innovate', 'introduce', 'predict', 'preserve', 'prevent', 'proceed', 'recognize', 'recommend', 'repair', 'replace', 'resolve', 'restore', 'stimulate', 'tolerate', 'transform', 'validate', 'volunteer'],
  adjective: ['ancient', 'arcane', 'golden', 'silver', 'crimson', 'emerald', 'gentle', 'fierce', 'clever', 'mighty', 'noble', 'sacred', 'enchanted', 'mysterious', 'magical', 'agile', 'bitter', 'brilliant', 'delicate', 'elegant', 'enormous', 'glorious', 'grateful', 'humble', 'innocent', 'loyal', 'majestic', 'marvelous', 'peaceful', 'precious', 'radiant', 'reckless', 'splendid', 'timid', 'vibrant', 'wicked', 'adequate', 'adventurous', 'apparent', 'authentic', 'beautiful', 'charming', 'circular', 'colorful', 'comfortable', 'complex', 'curious', 'delightful', 'diligent', 'dramatic', 'efficient', 'electric', 'essential', 'excellent', 'exciting', 'fantastic', 'flexible', 'generous', 'genuine', 'gigantic', 'immense', 'impressive', 'incredible', 'invisible', 'luminous', 'miniature', 'moderate', 'numerous', 'peculiar', 'pleasant', 'profound', 'remarkable', 'ridiculous', 'romantic', 'spontaneous', 'suitable', 'temporary', 'unusual', 'valuable', 'wonderful'],
  adverb: ['quickly', 'quietly', 'suddenly', 'rapidly', 'readily', 'honestly', 'smoothly', 'strongly', 'directly', 'recently', 'commonly', 'especially', 'totally', 'usually', 'aptly', 'badly', 'dimly', 'dryly', 'duly', 'fully', 'madly', 'newly', 'sadly', 'truly', 'wryly'],
};
/** All classified entries are explicitly reviewed and must occur in the shipped bank. */
export const WORD_CLASS_EXAMPLES: Readonly<Record<WordClass, readonly string[]>> = EXAMPLES;

/** Explicitly excluded context-dependent words: never infer a part of speech
 * from spelling alone. A future contextual parser may handle these safely. */
export const AMBIGUOUS_WORDS: readonly string[] = [
  'scroll', 'garden', 'shield', 'crown', 'storm', 'shadow', 'book', 'ink',
  'stone', 'flame', 'mirror', 'treasure', 'wander', 'whisper', 'shimmer',
  'sparkle', 'travel', 'dance', 'leap', 'glide', 'hover', 'quiet',
  'bright', 'dark', 'swift', 'hidden',
];

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
