/**
 * The Grand Wizard's lines (D-090). One catalogue feeds both the game and the
 * owner's recording script (docs/grand-wizard-voice-script.md), so the IDs
 * always match. Placeholder writing: the owner will rewrite and record these.
 *
 * Character (Rune design rounds 10–11, narrative rounds 1–3): a mischievous
 * magical mentor. Playful, witty, occasionally sarcastic, never mean. He
 * teases at first and grows genuinely impressed as the apprentice earns
 * bigger Runes. During play he speaks ONLY when a Rune is awarded.
 */
import { RUNES } from '../gameplay/runes/RuneCatalogue';

export interface VoiceLine {
  id: string;
  text: string;
  /** Direction for the performer. */
  note?: string;
}

/** Every Rune's name, as a callout. ID `rune.<runeId>`. */
export const RUNE_CALLOUTS: Record<string, VoiceLine> = Object.fromEntries(
  RUNES.map((r) => [
    r.id,
    {
      id: `rune.${r.id}`,
      text: `${r.name}!`,
      note: r.category === 'participation' ? 'Mock-solemn, as if announcing a tragedy.' : r.tier === 3 ? 'Big. Genuinely impressed despite himself.' : r.tier === 2 ? 'Pleased, a little theatrical.' : 'Brisk, approving.',
    },
  ]),
);

/** Remarks after good Runes (tier 2–3). Early ones tease; later ones admire. */
export const PRAISE: readonly VoiceLine[] = [
  { id: 'praise.01', text: 'Hm. Not bad.', note: 'Grudging.' },
  { id: 'praise.02', text: 'Do not let it go to your hat.' },
  { id: 'praise.03', text: 'Adequate. Barely.', note: 'Dry, a smile hidden.' },
  { id: 'praise.04', text: 'Oh, now you are showing off.' },
  { id: 'praise.05', text: 'I have seen worse. From myself, once.' },
  { id: 'praise.06', text: 'Well, well. The apprentice has teeth.' },
  { id: 'praise.07', text: 'Keep that up and I may have to learn your name.' },
  { id: 'praise.08', text: 'Again! Do it again! ...I mean. Acceptable.', note: 'Slips into delight, catches himself.' },
  { id: 'praise.09', text: 'The scrolls fear you. Good.' },
  { id: 'praise.10', text: 'That one I will tell the other Masters about.' },
  { id: 'praise.11', text: 'Ha! Splendid!', note: 'Unguarded joy.' },
  { id: 'praise.12', text: 'Careful. That almost looked like talent.' },
];

/** Remarks on Participation Runes (fumbles). Teasing, never cruel. */
export const MOCKERY: readonly VoiceLine[] = [
  { id: 'mock.01', text: 'Majestic.', note: 'Deadpan.' },
  { id: 'mock.02', text: 'I will pretend I did not see that.' },
  { id: 'mock.03', text: 'The scrolls are laughing at you.' },
  { id: 'mock.04', text: 'Was that... on purpose?' },
  { id: 'mock.05', text: 'And there it goes. Gone. Like my patience.' },
  { id: 'mock.06', text: 'Somewhere, a Master just felt a disturbance.' },
  { id: 'mock.07', text: 'Beautiful streak. Was.', note: 'Pause before "Was."' },
  { id: 'mock.08', text: 'Breathe. Then never do that again.' },
];

export const SPECIAL = {
  haFail: { id: 'special.ha-fail', text: 'HA! FAIL!', note: 'Explosive, delighted. The signature line.' },
  legacy: { id: 'special.legacy', text: 'A legacy, of sorts.', note: 'Mock-respectful.' },
  flawless: { id: 'special.flawless', text: 'Flawless! Not a blot on the page.', note: 'Proud.' },
  flawlessPerfection: { id: 'special.flawless-perfection', text: 'Flawless Perfection! ...Fine. I am impressed. Do not tell anyone.', note: 'Rare. The biggest line in the game.' },
} as const satisfies Record<string, VoiceLine>;

/**
 * Optional, outside play (menus and apprenticeship framing). NOT voiced in
 * gameplay, per the Rune-only rule; candidates for recording if the owner
 * wants the Grand Wizard present in menus.
 */
export const MENU: readonly VoiceLine[] = [
  { id: 'menu.welcome', text: 'Ah. You came back. Sit. Type.' },
  { id: 'menu.welcome-2', text: 'The darkness waits. So do I. Impatiently.' },
  { id: 'menu.apprenticeship', text: 'Choose a Master. Try not to embarrass me.' },
  { id: 'menu.trial-won', text: 'Another Master survives your education.' },
  { id: 'menu.defeat', text: 'The Ward fell. Pick it up. Again.' },
  { id: 'menu.final-exam', text: 'Eight Masters taught you. Now you face me.' },
  { id: 'menu.graduated', text: 'You are an apprentice no longer. Insufferable, but no longer an apprentice.' },
  { id: 'menu.typing-trial', text: 'No spells, no scrolls. Just your fingers and my judgement.' },
  { id: 'menu.sandbox', text: 'Here nothing is at stake. Break things. I will not look.' },
];

export const ALL_LINES: readonly VoiceLine[] = [...Object.values(RUNE_CALLOUTS), ...PRAISE, ...MOCKERY, ...Object.values(SPECIAL), ...MENU];
