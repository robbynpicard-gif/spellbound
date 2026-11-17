import { STAGE_NAMES } from '../difficulty/Stages';
import { BONUS_TEXT } from '../render/Celebrations';
import { hex, SPELL_COLORS } from '../render/layout';
import type { BonusId } from '../gameplay/ScoringSystem';
import { SPELL_IDS } from '../gameplay/SpellManager';
import { SPELLS } from '../spells/SpellRegistry';
import type { LifetimeStats } from '../storage/LifetimeStats';
import { formatTime, h, percent } from './dom';
import type { Screen } from './UIRoot';

const stat = (label: string, value: string | number) =>
  h('div', { class: 'stat' }, h('dt', null, label), h('dd', null, typeof value === 'number' ? value.toLocaleString() : value));

/** Under a level's results: the five stages, the current one highlighted. */
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
      ),
      section('Bonuses earned', ...bonuses),
      section('Spells cast', ...spells),
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
