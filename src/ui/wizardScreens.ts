import type { CampaignMode } from '../modes/CampaignMode';
import { BONUS_TEXT } from '../render/Celebrations';
import { hex, SPELL_COLORS } from '../render/layout';
import type { BonusId } from '../gameplay/ScoringSystem';
import { SPELL_IDS } from '../gameplay/SpellManager';
import { WIZARD_IDS, WIZARDS, type WizardId } from '../gameplay/Wizards';
import { SPELLS } from '../spells/SpellRegistry';
import type { LifetimeStats } from '../storage/LifetimeStats';
import { formatTime, h, percent } from './dom';
import type { Screen } from './UIRoot';

const stat = (label: string, value: string | number) =>
  h('div', { class: 'stat' }, h('dt', null, label), h('dd', null, typeof value === 'number' ? value.toLocaleString() : value));

const wizardStyle = (id: WizardId) => ({ style: `--wizard-color: ${hex(WIZARDS[id].color)}` });

// ───────────────────────── Choose your wizard ─────────────────────────

export function wizardSelectScreen(
  mode: CampaignMode,
  selected: WizardId,
  life: Readonly<LifetimeStats>,
  actions: { onPick(wizard: WizardId): void; onBack(): void },
): Screen {
  const cards = WIZARD_IDS.map((id) => {
    const w = WIZARDS[id];
    const rec = life.wizards[id];
    return h(
      'button',
      {
        class: `menu-button wizard-card${id === selected ? ' selected' : ''}`,
        attrs: { ...wizardStyle(id), 'aria-label': `${w.name}. ${w.passive.text} Power: ${w.power.name}. ${w.power.text}` },
        onClick: () => actions.onPick(id),
      },
      h('span', { class: 'wizard-portrait' }, h('img', { attrs: { src: `assets/art/wizard-${id}-a.png`, alt: '' } })),
      h('span', { class: 'wizard-name' }, w.name),
      h('span', { class: 'wizard-epithet' }, w.epithet),
      h('span', { class: 'wizard-line' }, h('b', null, w.passive.name), ' · ', w.passive.text),
      h('span', { class: 'wizard-line power' }, h('b', null, `Sigil: ${w.power.name}`), ' · ', w.power.text),
      h('span', { class: 'mode-best' }, rec.runs > 0 ? `Best run ${rec.bestRun.toLocaleString()} · ${rec.runs} run${rec.runs === 1 ? '' : 's'}` : 'Not played yet'),
    );
  });
  const focus = cards[WIZARD_IDS.indexOf(selected)] ?? cards[0]!;
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
      const i = cards.indexOf(document.activeElement as HTMLButtonElement);
      if (i < 0) return;
      const move = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 }[event.key];
      if (move) {
        event.preventDefault();
        cards[(i + move + cards.length) % cards.length]!.focus();
      }
    },
  };
}

// ───────────────────────── Stats ─────────────────────────

function section(title: string, ...stats: HTMLElement[]): HTMLElement {
  return h('div', { class: 'stats-section' }, h('h3', { class: 'stats-heading' }, title), h('dl', { class: 'stat-grid' }, ...stats));
}

export function statsScreen(life: Readonly<LifetimeStats>, onBack: () => void): Screen {
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
        stat('Wizard powers', life.powersUsed),
      ),
      section('Bonuses earned', ...bonuses),
      section('Spells cast', ...spells),
      section('Wizards (best run)', ...wizards),
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
