import { STAGE_NAMES } from '../difficulty/Stages';
import type { CampaignMode } from '../modes/CampaignMode';
import { BONUS_TEXT } from '../render/Celebrations';
import { hex, SPELL_COLORS } from '../render/layout';
import type { BonusId } from '../gameplay/ScoringSystem';
import { SPELL_IDS } from '../gameplay/SpellManager';
import { WIZARD_IDS, WIZARDS, type WizardId } from '../gameplay/Wizards';
import {
  cosmeticsFor,
  equipped,
  isUnlocked,
  loadout,
  masteryLevel,
  masteryProgress,
  MAX_MASTERY,
  SLOT_NAMES,
  SLOTS,
  unlockText,
  type Cosmetic,
  type Slot,
  type WardrobeEntry,
} from '../gameplay/Cosmetics';
import { SPELLS } from '../spells/SpellRegistry';
import type { LifetimeStats } from '../storage/LifetimeStats';
import { formatTime, h, percent } from './dom';
import type { Screen } from './UIRoot';

const stat = (label: string, value: string | number) =>
  h('div', { class: 'stat' }, h('dt', null, label), h('dd', null, typeof value === 'number' ? value.toLocaleString() : value));

const wizardStyle = (id: WizardId) => ({ style: `--wizard-color: ${hex(WIZARDS[id].color)}` });

// ───────────────────────── Choose your wizard ─────────────────────────

const portrait = (id: WizardId, look: string) =>
  h('img', { attrs: { src: `assets/art/wizard-${id}-${look}.png`, alt: '' } });

function masteryBar(entry: Readonly<WardrobeEntry>, note = ''): HTMLElement {
  const level = masteryLevel(entry.xp);
  const progress = masteryProgress(entry.xp);
  const fill = progress ? Math.round((progress[0] / progress[1]) * 100) : 100;
  return h(
    'span',
    { class: 'mastery' },
    h('span', { class: 'mastery-label' }, `Mastery ${level}${level >= MAX_MASTERY ? ' · max' : ''}`),
    h('span', { class: 'mastery-bar' }, h('span', { class: 'mastery-fill', attrs: { style: `width: ${fill}%` } })),
    note ? h('span', { class: 'mastery-note' }, note) : null,
  );
}

export function wizardSelectScreen(
  mode: CampaignMode,
  selected: WizardId,
  life: Readonly<LifetimeStats>,
  wardrobe: (id: WizardId) => Readonly<WardrobeEntry>,
  actions: { onPick(wizard: WizardId): void; onWardrobe(wizard: WizardId): void; onBack(): void },
): Screen {
  const plays: HTMLButtonElement[] = [];
  const cards = WIZARD_IDS.map((id) => {
    const w = WIZARDS[id];
    const rec = life.wizards[id];
    const entry = wardrobe(id);
    const kit = loadout(id, entry);
    const play = h(
      'button',
      {
        class: `menu-button wizard-play${id === selected ? ' primary' : ''}`,
        attrs: { 'aria-label': `Play as ${w.name}. ${w.passive.text} Power: ${w.power.name}. ${w.power.text}` },
        onClick: () => actions.onPick(id),
      },
      'Play',
    );
    plays.push(play);
    const unlocked = cosmeticsFor(id).filter((c) => isUnlocked(c, entry)).length;
    return h(
      'article',
      { class: `wizard-card${id === selected ? ' selected' : ''}`, attrs: wizardStyle(id) },
      h('span', { class: 'wizard-portrait' }, portrait(id, kit.outfit)),
      h('span', { class: 'wizard-name' }, w.name),
      kit.title ? h('span', { class: 'wizard-title' }, `“${kit.title}”`) : h('span', { class: 'wizard-epithet' }, w.epithet),
      h('span', { class: 'wizard-line' }, h('b', null, w.passive.name), ' · ', w.passive.text),
      h('span', { class: 'wizard-line power' }, h('b', null, `Sigil: ${w.power.name}`), ' · ', w.power.text),
      masteryBar(entry, rec.runs > 0 ? `best ${rec.bestRun.toLocaleString()}` : ''),
      h(
        'span',
        { class: 'wizard-actions' },
        play,
        h('button', { class: 'menu-button wizard-wardrobe', onClick: () => actions.onWardrobe(id) }, `Wardrobe ${unlocked}/${cosmeticsFor(id).length}`),
      ),
    );
  });
  const focus = plays[WIZARD_IDS.indexOf(selected)] ?? plays[0]!;
  const element = h(
    'section',
    { class: 'screen panel wizard-select', attrs: { role: 'dialog', 'aria-labelledby': 'wizard-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'wizard-title' } }, 'Choose your wizard'),
    h(
      'p',
      { class: 'screen-subtitle' },
      `${mode === 'hardcore' ? 'Hardcore' : 'Normal'} run · Type a glowing `,
      h('span', { class: 'sigil-mark' }, 'sigil scroll'),
      ' to unleash your wizard’s power',
    ),
    h('div', { class: 'wizard-grid' }, ...cards),
    h('div', { class: 'button-row' }, h('button', { class: 'menu-button', onClick: actions.onBack }, 'Back')),
  );
  return {
    element,
    focus,
    onKey: (event) => {
      if (event.key === 'Escape') actions.onBack();
      const i = plays.indexOf(document.activeElement as HTMLButtonElement);
      if (i < 0) return;
      const move = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 }[event.key];
      if (move) {
        event.preventDefault();
        plays[(i + move + plays.length) % plays.length]!.focus();
      }
    },
  };
}

// ───────────────────────── Wardrobe ─────────────────────────

/** Small preview of a cosmetic for the wardrobe grid. */
function swatch(id: WizardId, item: Cosmetic): HTMLElement {
  switch (item.slot) {
    case 'outfit':
      return h('span', { class: 'swatch outfit' }, portrait(id, String(item.value)));
    case 'familiar':
      return h('span', {
        class: 'swatch familiar',
        attrs:
          typeof item.value === 'number'
            ? { style: `--row: ${item.value}; background-image: url(assets/art/familiars.png)` }
            : { 'data-none': '' },
      });
    case 'ink':
      return h('span', { class: 'swatch ink', attrs: { style: `--ink: ${item.value || '#ff60c8'}` } }, 'Aa');
    case 'sigil':
      return h('span', { class: 'swatch glyph' }, SIGIL_SYMBOLS[String(item.value)] ?? '◆');
    case 'flourish':
      return h('span', { class: 'swatch glyph' }, FLOURISH_SYMBOLS[String(item.value)] ?? '✦');
    case 'title':
      return h('span', { class: 'swatch glyph' }, '❝');
  }
}

const SIGIL_SYMBOLS: Record<string, string> = {
  diamond: '◆', star: '★', moon: '☾', book: '▤', key: '⚷', hourglass: '⧗', spiral: '◎', flame: '♨', sun: '☀', compass: '✛', cross: '✕', quill: '✒', eye: '◉',
};
const FLOURISH_SYMBOLS: Record<string, string> = {
  sparks: '✦', stars: '✧', confetti: '❖', letters: 'Ab', dust: '∴', gears: '⚙', sand: '⋰', embers: '♨', fireworks: '✺', paper: '✉', compass: '✛', ink: '●',
};

export function wardrobeScreen(
  id: WizardId,
  entry: Readonly<WardrobeEntry>,
  actions: { onEquip(slot: Slot, itemId: string): void; onPlay(): void; onBack(): void },
  focusItem?: string,
): Screen {
  const w = WIZARDS[id];
  const kit = loadout(id, entry);
  const items = cosmeticsFor(id);
  let focusEl: HTMLElement | null = null;
  const rows = SLOTS.map((slot) => {
    const worn = equipped(id, entry, slot);
    return h(
      'div',
      { class: 'wardrobe-row' },
      h('h3', { class: 'stats-heading' }, SLOT_NAMES[slot]),
      h(
        'div',
        { class: 'wardrobe-items' },
        ...items
          .filter((c) => c.slot === slot)
          .map((c) => {
            const open = isUnlocked(c, entry);
            const on = worn.id === c.id;
            const btn = h(
              'button',
              {
                class: `wardrobe-item${on ? ' worn' : ''}${open ? '' : ' locked'}`,
                disabled: !open,
                attrs: { title: open ? c.name : `${c.name} · ${unlockText(c)}`, 'aria-pressed': String(on) },
                onClick: () => actions.onEquip(slot, c.id),
              },
              swatch(id, c),
              h('span', { class: 'wardrobe-name' }, c.name),
              h('span', { class: 'wardrobe-req' }, open ? (on ? 'Wearing' : 'Unlocked') : unlockText(c)),
            );
            if (`${slot}:${c.id}` === focusItem) focusEl = btn;
            return btn;
          }),
      ),
    );
  });
  const play = h('button', { class: 'menu-button primary', onClick: actions.onPlay }, `Play as ${w.name}`);
  const level = masteryLevel(entry.xp);
  const progress = masteryProgress(entry.xp);
  const element = h(
    'section',
    { class: 'screen panel wardrobe', attrs: { role: 'dialog', 'aria-labelledby': 'wardrobe-title', ...wizardStyle(id) } },
    h(
      'div',
      { class: 'wardrobe-head' },
      h('span', { class: 'wardrobe-portrait' }, portrait(id, kit.outfit)),
      h(
        'div',
        null,
        h('h2', { class: 'screen-title wizard-name', attrs: { id: 'wardrobe-title' } }, w.name),
        kit.title ? h('p', { class: 'wizard-title' }, `“${kit.title}”`) : null,
        masteryBar(entry),
        h(
          'p',
          { class: 'footnote' },
          progress
            ? `${(progress[1] - progress[0]).toLocaleString()} points to Mastery ${level + 1}. Every point you score with ${w.name} counts.`
            : 'Fully mastered.',
        ),
      ),
    ),
    h('div', { class: 'stats-scroll wardrobe-scroll' }, ...rows),
    h('div', { class: 'button-row' }, play, h('button', { class: 'menu-button', onClick: actions.onBack }, 'Back')),
  );
  return {
    element,
    focus: focusEl ?? play,
    onKey: (event) => {
      if (event.key === 'Escape') actions.onBack();
    },
  };
}

/** The road from the wizard's domain into the darkness, with the current stop lit (D-044). */
export function journeyStrip(stage: number, cleared = false): HTMLElement {
  const stops = STAGE_NAMES.map((name, i) => {
    const n = i + 1;
    const state = n < stage || (n === stage && cleared) ? ' done' : n === stage ? ' here' : '';
    return h('span', { class: `journey-stop${state}` }, name);
  });
  const parts: (HTMLElement | string)[] = [];
  stops.forEach((s, i) => {
    if (i > 0) parts.push(h('span', { class: 'journey-arrow' }, '→'));
    parts.push(s);
  });
  return h('p', { class: 'journey' }, ...parts);
}

/** Under a level's results: mastery gained and anything unlocked. */
export function masteryPanel(id: WizardId, entry: Readonly<WardrobeEntry>, gained: number, unlocked: readonly Cosmetic[]): HTMLElement {
  return h(
    'div',
    { class: 'mastery-panel', attrs: wizardStyle(id) },
    h('span', { class: 'mastery-gain' }, `${WIZARDS[id].name} +${gained.toLocaleString()} mastery`),
    masteryBar(entry),
    ...unlocked.map((c) =>
      h('p', { class: 'unlock-line' }, h('b', null, 'Unlocked! '), `${SLOT_NAMES[c.slot]}: ${c.name}`, swatch(id, c)),
    ),
  );
}

// ───────────────────────── Stats ─────────────────────────

function section(title: string, ...stats: HTMLElement[]): HTMLElement {
  return h('div', { class: 'stats-section' }, h('h3', { class: 'stats-heading' }, title), h('dl', { class: 'stat-grid' }, ...stats));
}

export function statsScreen(life: Readonly<LifetimeStats>, onBack: () => void, showWizards = false): Screen {
  const back = h('button', { class: 'menu-button primary', onClick: onBack }, 'Back');
  const totalKeys = life.lettersTyped + life.typos;
  const hours = life.timePlayedMs / 3_600_000;
  const time = hours >= 1 ? `${hours.toFixed(1)} h` : formatTime(life.timePlayedMs);

  const bonuses = (Object.keys(BONUS_TEXT) as BonusId[]).map((id) => stat(BONUS_TEXT[id].label, life.bonusCounts[id] ?? 0));
  const spells = SPELL_IDS.map((id) => {
    const el = stat(SPELLS[id].name, life.spellsCast[id] ?? 0);
    el.setAttribute('style', `--spell-color: ${hex(SPELL_COLORS[id])}`);
    el.classList.add('spell-stat');
    return el;
  });
  const wizards = WIZARD_IDS.map((id) => {
    const w = life.wizards[id];
    return h(
      'div',
      { class: 'stat wizard-stat', attrs: wizardStyle(id) },
      h('dt', null, WIZARDS[id].name),
      h('dd', null, w.bestRun.toLocaleString()),
      h('span', { class: 'stat-best' }, `${w.runs} runs · ${w.victories} wins · ${w.levelsCleared} levels · ${w.powersUsed} powers`),
    );
  });

  const element = h(
    'section',
    { class: 'screen panel stats-screen', attrs: { role: 'dialog', 'aria-labelledby': 'stats-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'stats-title' } }, 'Stats'),
    h('p', { class: 'screen-subtitle' }, 'Everything you have typed, in every mode. Kept in this browser.'),
    h(
      'div',
      { class: 'stats-scroll' },
      section(
        'Overall',
        stat('Time played', time),
        stat('Points earned', life.pointsEarned),
        stat('Levels won', `${life.levelsWon} / ${life.levelsPlayed}`),
        stat('Bosses beaten', life.bossesBeaten),
        stat('Runs finished', `${life.runsVictorious} won / ${life.runsFinished}`),
        stat('Practice sessions', life.practiceSessions),
      ),
      section(
        'Records',
        stat('Best run', life.bestRunScore),
        stat('Best level', life.bestLevelScore),
        stat('Best combo', life.bestCombo),
        stat('Best Clean Streak', life.bestCleanStreak),
        stat('Best multiplier', `×${life.bestMultiplier}`),
        stat('Best WPM', life.bestWpm),
        stat('Flawless levels', life.flawlessLevels),
      ),
      section(
        'Typing',
        stat('Words captured', life.wordsCaptured),
        stat('Words missed', life.wordsMissed),
        stat('Letters typed', life.lettersTyped),
        stat('Typos', life.typos),
        stat('Accuracy', totalKeys === 0 ? '—' : percent(life.lettersTyped / totalKeys)),
        ...(showWizards ? [stat('Wizard powers', life.powersUsed)] : []),
      ),
      section('Bonuses earned', ...bonuses),
      section('Spells cast', ...spells),
      showWizards ? section('Wizards (best run)', ...wizards) : null,
    ),
    h('div', { class: 'button-row' }, back),
  );
  return {
    element,
    focus: back,
    onKey: (event) => {
      if (event.key === 'Escape') onBack();
    },
  };
}
