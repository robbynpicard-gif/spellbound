import { GAME_TITLE } from '../core/GameConfig';
import { isSurvival, type DifficultyConfig } from '../difficulty/DifficultyConfig';
import type { GameStats } from '../gameplay/ScoringSystem';
import {
  poolFull,
  SPELL_IDS,
  SPELL_POOL_SIZE,
  totalCharges,
  type SpellCharges,
  type SpellId,
} from '../gameplay/SpellManager';
import {
  HARDCORE_BOSS_HEAL,
  type CampaignMode,
  type CampaignRecords,
  type CampaignRun,
  type RunOutcome,
  type RunSummary,
} from '../modes/CampaignMode';
import { hex, SPELL_COLORS } from '../render/layout';
import { SPELLS } from '../spells/SpellRegistry';
import { WIZARDS } from '../gameplay/Wizards';
import { formatTime, h, percent } from './dom';
import type { Screen } from './UIRoot';

const APP_VERSION = '0.16.0';

const MODE_TITLES: Record<CampaignMode, string> = { normal: 'Normal', hardcore: 'Hardcore' };

/** Inline colour for a spell's name in HTML screens. */
const spellStyle = (id: SpellId) => ({ style: `--spell-color: ${hex(SPELL_COLORS[id])}` });

const stat = (label: string, value: string | number) =>
  h('div', { class: 'stat' }, h('dt', null, label), h('dd', null, String(value)));

// ───────────────────────── Main menu ─────────────────────────

export interface MainMenuActions {
  onCampaign(): void;
  onPractice(): void;
  onCredits(): void;
  onOptions(): void;
  onStats(): void;
}

/** Menu entries that exist in the GDD but are built in later milestones. */
const UPCOMING: [label: string, milestone: string][] = [
  ['Multiplayer', 'Milestone 5'],
  ['Spellbook', 'Milestone 6'],
];

export function mainMenuScreen(
  actions: MainMenuActions,
  records: Readonly<CampaignRecords>,
  persistent: boolean,
): Screen {
  const campaign = h('button', { class: 'menu-button primary', onClick: actions.onCampaign }, 'Campaign');
  const best = records.bestRun;

  const element = h(
    'section',
    { class: 'screen main-menu', attrs: { 'aria-labelledby': 'title' } },
    h('h1', { class: 'game-title', attrs: { id: 'title' } }, GAME_TITLE),
    h(
      'nav',
      { class: 'menu-list', attrs: { 'aria-label': 'Main menu' } },
      campaign,
      h('button', { class: 'menu-button', onClick: actions.onPractice }, 'Endless Practice'),
      ...UPCOMING.map(([label, milestone]) =>
        h(
          'button',
          { class: 'menu-button', disabled: true, attrs: { title: `Coming in ${milestone}` } },
          label,
          h('span', { class: 'badge' }, 'Coming soon'),
        ),
      ),
      h('button', { class: 'menu-button', onClick: actions.onStats }, 'Stats'),
      h('button', { class: 'menu-button', onClick: actions.onOptions }, 'Options'),
      h('button', { class: 'menu-button', onClick: actions.onCredits }, 'Credits'),
    ),
    best &&
      h(
        'p',
        { class: 'best-run' },
        `Best run: ${best.score.toLocaleString()} · `,
        best.victory ? 'all levels cleared' : `reached level ${best.reachedLevel}`,
      ),
    h(
      'p',
      { class: 'footnote' },
      `Version ${APP_VERSION} · `,
      persistent ? 'Records save in this browser' : 'Records cannot be saved in this browser',
    ),
  );
  return { element, focus: campaign };
}

// ───────────────────────── Pause ─────────────────────────

export interface PauseOption {
  label: string;
  onClick(): void;
}

/** Pause menu: Resume plus mode-specific options (Campaign: restart/abandon; Practice: end session…). */
export function pauseScreen(label: string, onResume: () => void, options: PauseOption[], note: string): Screen {
  const resume = h('button', { class: 'menu-button primary', onClick: onResume }, 'Resume');
  const element = h(
    'section',
    { class: 'screen panel pause', attrs: { role: 'dialog', 'aria-labelledby': 'pause-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'pause-title' } }, 'Paused'),
    h('p', { class: 'screen-subtitle' }, label),
    h(
      'div',
      { class: 'menu-list' },
      resume,
      ...options.map((o) => h('button', { class: 'menu-button', onClick: o.onClick }, o.label)),
    ),
    h('p', { class: 'footnote' }, `Esc resumes · ${note}`),
  );
  // Esc is handled by the game scene (it owns the pause state).
  return { element, focus: resume };
}

// ───────────────────────── Campaign mode choice ─────────────────────────

export interface ModeSelectActions {
  onStart(mode: CampaignMode): void;
  onBack(): void;
}

function bestLine(records: Readonly<CampaignRecords>): string {
  const best = records.bestRun;
  if (!best) return 'No runs recorded yet';
  return `Best: ${best.score.toLocaleString()} · ${best.victory ? 'all levels cleared' : `reached level ${best.reachedLevel}`}`;
}

/** Campaign → choose Normal or Hardcore. */
export function campaignModeScreen(
  normal: Readonly<CampaignRecords>,
  hardcore: Readonly<CampaignRecords>,
  totalLevels: number,
  actions: ModeSelectActions,
): Screen {
  const card = (mode: CampaignMode, detail: string, records: Readonly<CampaignRecords>) =>
    h(
      'button',
      { class: `menu-button mode-card ${mode}${mode === 'normal' ? ' primary' : ''}`, onClick: () => actions.onStart(mode) },
      h('span', { class: 'mode-title' }, MODE_TITLES[mode]),
      h('span', { class: 'mode-detail' }, detail),
      h('span', { class: 'mode-best' }, bestLine(records)),
    );
  const normalCard = card('normal', 'Wards are restored at the start of every level.', normal);
  const element = h(
    'section',
    { class: 'screen panel mode-select', attrs: { role: 'dialog', 'aria-labelledby': 'mode-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'mode-title' } }, 'Campaign'),
    h(
      'p',
      { class: 'screen-subtitle' },
      `${totalLevels} levels in 4 chapters · a boss ends each chapter · fall and the run starts over`,
    ),
    h(
      'div',
      { class: 'mode-list' },
      normalCard,
      card(
        'hardcore',
        `Ward damage carries through the whole run. Each boss heals ${HARDCORE_BOSS_HEAL}%; Wind only halves it.`,
        hardcore,
      ),
    ),
    h('div', { class: 'button-row' }, h('button', { class: 'menu-button', onClick: actions.onBack }, 'Back')),
  );
  return {
    element,
    focus: normalCard,
    onKey: (event) => {
      if (event.key === 'Escape') actions.onBack();
    },
  };
}

// ───────────────────────── New spell ─────────────────────────

/** Pop-up before a level that introduces a spell. The level waits until "Begin". */
export function spellIntroScreen(spell: SpellId, level: DifficultyConfig, onBegin: () => void): Screen {
  const def = SPELLS[spell];
  const begin = h('button', { class: 'menu-button primary', onClick: onBegin }, `Begin level ${level.level}`);
  const element = h(
    'section',
    {
      class: 'screen panel spell-intro',
      attrs: { role: 'dialog', 'aria-labelledby': 'spell-intro-title', ...spellStyle(spell) },
    },
    h('p', { class: 'score-label' }, 'New spell'),
    h('h2', { class: 'screen-title spell-name', attrs: { id: 'spell-intro-title' } }, def.name),
    h('p', { class: 'spell-effect' }, def.summary),
    h(
      'ol',
      { class: 'spell-steps' },
      h('li', null, 'Type a ', h('span', { class: 'spell-mark' }, 'powered scroll'), ' to store its mana.'),
      h('li', null, 'Type ', h('kbd', { class: 'spell-word' }, def.id), ' + Enter to cast.'),
    ),
    h('p', { class: 'footnote' }, `Powered scrolls store mana for their spell. You can hold ${SPELL_POOL_SIZE} mana.`),
    h('div', { class: 'button-row' }, begin),
  );
  return { element, focus: begin };
}

// ───────────────────────── Between levels ─────────────────────────

function spellSummary(charges: SpellCharges): HTMLElement {
  const held = SPELL_IDS.filter((id) => charges[id] > 0);
  return h(
    'p',
    { class: 'spell-summary' },
    held.length === 0
      ? 'No mana stored.'
      : `Mana ${totalCharges(charges)}/${SPELL_POOL_SIZE}: ${held.map((id) => `${SPELLS[id].book} ×${charges[id]}`).join(' · ')}`,
  );
}

/** A boss reward still to be chosen. */
export interface BossReward {
  choices: SpellId[];
  /** Take a spell; with a full pool, `discard` is the spell given up for it. */
  onClaim(spell: SpellId, discard?: SpellId): void;
}

function rewardPicker(run: Readonly<CampaignRun>, reward: BossReward, rerender: () => void): HTMLElement {
  const full = poolFull(run.spellCharges);
  let picked: SpellId | null = null;
  const box = h('div', { class: 'boss-reward' });

  const draw = () => {
    box.replaceChildren();
    if (picked && full) {
      box.append(
        h('p', { class: 'reward' }, `Your mana is full. Release one charge to take ${SPELLS[picked].name}:`),
        h(
          'div',
          { class: 'reward-choices' },
          ...SPELL_IDS.filter((id) => run.spellCharges[id] > 0).map((id) =>
            h(
              'button',
              { class: 'menu-button spell-choice', attrs: spellStyle(id), onClick: () => (reward.onClaim(picked!, id), rerender()) },
              `${SPELLS[id].book} ×${run.spellCharges[id]}`,
            ),
          ),
        ),
        h('div', { class: 'button-row' }, h('button', { class: 'menu-button', onClick: () => ((picked = null), draw()) }, 'Back')),
      );
      return;
    }
    box.append(
      h('p', { class: 'reward' }, 'Boss defeated! Choose one spell charge:'),
      h(
        'div',
        { class: 'reward-choices' },
        ...reward.choices.map((id) =>
          h(
            'button',
            {
              class: 'menu-button spell-choice',
              attrs: { ...spellStyle(id), title: SPELLS[id].summary },
              onClick: () => {
                if (full) {
                  picked = id;
                  draw();
                } else {
                  reward.onClaim(id);
                  rerender();
                }
              },
            },
            h('span', { class: 'spell-name' }, SPELLS[id].name),
            h('span', { class: 'mode-detail' }, `type ${id}`),
          ),
        ),
      ),
    );
    box.querySelector('button')?.focus({ preventScroll: true });
  };
  draw();
  return box;
}

export function levelClearScreen(
  cleared: DifficultyConfig,
  next: DifficultyConfig,
  stats: GameStats,
  run: Readonly<CampaignRun>,
  onContinue: () => void,
  reward?: BossReward | null,
  rerender?: () => void,
  extra?: HTMLElement | null,
): Screen {
  const button = h('button', { class: 'menu-button primary', onClick: onContinue }, reward ? 'Skip reward and continue' : `Continue to level ${next.level}`);
  if (reward) button.classList.remove('primary');
  const boss = isSurvival(cleared);
  const element = h(
    'section',
    { class: 'screen panel results won', attrs: { role: 'dialog', 'aria-labelledby': 'clear-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'clear-title' } }, boss ? `Boss Survived · Level ${cleared.level}` : `Level ${cleared.level} Cleared`),
    h('p', { class: 'screen-subtitle' }, `${cleared.name}${run.mode === 'hardcore' ? ' · Hardcore' : ''}`),
    h('p', { class: 'score' }, h('span', { class: 'score-label' }, 'Run score'), run.score.toLocaleString()),
    h(
      'dl',
      { class: 'stat-grid' },
      stat('Level score', `+${stats.score.toLocaleString()}`),
      stat('Accuracy', percent(stats.accuracy)),
      stat('WPM', Math.round(stats.wpm)),
      stat('Missed', stats.missed),
      stat('Best combo', `${stats.maxCombo} words · ×${stats.peakMultiplier}`),
      stat('Time', formatTime(stats.elapsedMs)),
    ),
    run.mode === 'hardcore' &&
      h(
        'p',
        { class: 'spell-summary' },
        `Ward instability carried: ${Math.round(run.instability)}%${boss ? ` (healed ${HARDCORE_BOSS_HEAL}% for surviving the boss)` : ''}`,
      ),
    spellSummary(run.spellCharges),
    reward && rerender ? rewardPicker(run, reward, rerender) : null,
    extra ?? null,
    h('p', { class: 'next-up' }, `Next: Level ${next.level} · ${next.name}${isSurvival(next) ? ' · Boss' : ''}`),
    h('div', { class: 'button-row' }, button),
  );
  const focus = reward ? (element.querySelector<HTMLElement>('.boss-reward button') ?? button) : button;
  return { element, focus };
}

// ───────────────────────── End of run ─────────────────────────

export interface RunOverActions {
  onNewRun(): void;
  onMenu(): void;
  onChangeWizard?(): void;
  /** Shown above the buttons (wizard mastery and unlocks). */
  extra?: HTMLElement | null;
  mode?: CampaignMode;
}

export function runOverScreen(
  summary: RunSummary,
  outcome: RunOutcome,
  lastLevel: DifficultyConfig,
  totalLevels: number,
  actions: RunOverActions,
): Screen {
  const won = summary.victory;
  const title = won ? 'Victory' : 'Run Over';
  const mode = MODE_TITLES[actions.mode ?? 'normal'];
  const who = summary.wizard ? `${WIZARDS[summary.wizard].name} · ` : '';
  const subtitle = who + (won
    ? `${mode} · All ${totalLevels} levels cleared`
    : `${mode} · Fell on level ${summary.reachedLevel} · ${lastLevel.name} · ${summary.levelsCleared} cleared`);

  const bestLine =
    outcome.previousBest === null
      ? 'Your first recorded run'
      : outcome.isNewBest
        ? `New best run! (was ${outcome.previousBest.toLocaleString()})`
        : `Best run: ${outcome.previousBest.toLocaleString()}`;

  const newRun = h('button', { class: 'menu-button primary', onClick: actions.onNewRun }, 'New run');
  const element = h(
    'section',
    { class: `screen panel results ${won ? 'won' : 'lost'}`, attrs: { role: 'dialog', 'aria-labelledby': 'run-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'run-title' } }, title),
    h('p', { class: 'screen-subtitle' }, subtitle),
    h('p', { class: 'score' }, h('span', { class: 'score-label' }, 'Final score'), summary.score.toLocaleString()),
    h(
      'dl',
      { class: 'stat-grid' },
      stat('Accuracy', percent(summary.accuracy)),
      stat('WPM', Math.round(summary.wpm)),
      stat('Words', summary.completed),
      stat('Missed', summary.missed),
      stat('Best combo', `${summary.maxCombo} words`),
      stat('Time', formatTime(summary.elapsedMs)),
    ),
    h('p', { class: outcome.isNewBest && outcome.previousBest !== null ? 'reward' : 'personal-best' }, bestLine),
    actions.extra ?? null,
    h(
      'div',
      { class: 'button-row' },
      newRun,
      actions.onChangeWizard && h('button', { class: 'menu-button', onClick: actions.onChangeWizard }, 'Change wizard'),
      h('button', { class: 'menu-button', onClick: actions.onMenu }, 'Main menu'),
    ),
  );
  return {
    element,
    focus: newRun,
    onKey: (event) => {
      if (event.key === 'Escape') actions.onMenu();
    },
  };
}

// ───────────────────────── Credits ─────────────────────────

export function creditsScreen(onBack: () => void): Screen {
  const back = h('button', { class: 'menu-button primary', onClick: onBack }, 'Back');
  const element = h(
    'section',
    { class: 'screen panel credits', attrs: { 'aria-labelledby': 'credits-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'credits-title' } }, 'Credits'),
    h('p', null, `${GAME_TITLE} — an original wizard-themed typing game.`),
    h('p', null, 'Gameplay inspired by classic falling-word typing games.'),
    h('p', null, 'Built with Phaser, TypeScript and Vite.'),
    h('p', { class: 'footnote' }, 'Pixel art from the Wizzy Type art direction. Fonts: Atkinson Hyperlegible and Pixelify Sans (SIL Open Font License). Music and sound are synthesised live in your browser.'),
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

// ───────────────────────── Options ─────────────────────────

export interface AudioToggles {
  music: boolean;
  sfx: boolean;
}

/** The two audio switches as menu buttons (used by Options and the pause menu). */
export function audioToggleLabels(a: Readonly<AudioToggles>): { music: string; sfx: string } {
  return { music: `Music: ${a.music ? 'On' : 'Off'}`, sfx: `Sound effects: ${a.sfx ? 'On' : 'Off'}` };
}

/** Options: music and sound effects, each on or off. */
export function optionsScreen(
  a: Readonly<AudioToggles>,
  actions: { onMusic(): void; onSfx(): void; onBack(): void },
  focusKey: 'music' | 'sfx' | null = null,
): Screen {
  const labels = audioToggleLabels(a);
  const music = h('button', { class: `menu-button${a.music ? ' primary' : ''}`, onClick: actions.onMusic, attrs: { role: 'switch', 'aria-checked': String(a.music) } }, labels.music);
  const sfx = h('button', { class: `menu-button${a.sfx ? ' primary' : ''}`, onClick: actions.onSfx, attrs: { role: 'switch', 'aria-checked': String(a.sfx) } }, labels.sfx);
  const back = h('button', { class: 'menu-button', onClick: actions.onBack }, 'Back');
  const element = h(
    'section',
    { class: 'screen panel options', attrs: { role: 'dialog', 'aria-labelledby': 'options-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'options-title' } }, 'Options'),
    h('p', { class: 'screen-subtitle' }, 'Music and sound effects can be switched separately. You can also change them from the pause menu (Esc).'),
    h('div', { class: 'menu-list' }, music, sfx, back),
  );
  return {
    element,
    focus: focusKey === 'music' ? music : focusKey === 'sfx' ? sfx : music,
    onKey: (event) => {
      if (event.key === 'Escape') actions.onBack();
    },
  };
}
