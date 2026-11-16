import type { WordState } from './Word';

/**
 * Auto-targeting: when no word is targeted, the first keystroke picks the
 * word that starts with that letter. If several do, the one closest to the
 * ward line (largest y) wins — it is the most urgent — and ties go to the
 * oldest word (lowest id). Returns null when no word starts with the letter.
 *
 * Once a target is chosen it stays locked until it is completed, missed,
 * abandoned (Backspace) or the player clicks another word. Keystrokes never
 * silently switch targets mid-word.
 */
export function findAutoTarget(words: readonly WordState[], char: string): WordState | null {
  let best: WordState | null = null;
  for (const word of words) {
    if (word.text[0] !== char) continue;
    if (!best || word.y > best.y || (word.y === best.y && word.id < best.id)) best = word;
  }
  return best;
}
