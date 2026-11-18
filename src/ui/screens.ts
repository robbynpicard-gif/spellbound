import { GAME_TITLE } from '../core/GameConfig';
import { isSurvival, type DifficultyConfig } from '../difficulty/DifficultyConfig';
import type { GameStats } from '../gameplay/ScoringSystem';
import {
  SPELL_IDS,
  SPELL_POOL_SIZE,
  totalCharges,
  type SpellCharges,
  type SpellId,
} from '../gameplay/SpellManager';
import {
  HARDCORE_HEAL,
  HARDCORE_HEAL_LEVELS,
  type CampaignMode,
  type CampaignRecords,
  type CampaignRun,
  type RunOutcome,
  type RunSummary,
} from '../modes/CampaignMode';
import { hex, SPELL_COLORS } from '../render/layout';
import { STAGE_COUNT, STAGE_LEVELS, STAGE_NAMES } from '../difficulty/Stages';
import { SPELLS } from '../spells/SpellRegistry';
import { formatTime, h, percent } from './dom';
import type { Screen } from './UIRoot';

const APP_VERSION = '0.27.0';

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
  onSpellbook(): void;
  onCodex(): void;
}

/** Menu entries that exist in the GDD but are built in later milestones. */
const UPCOMING: [label: string, milestone: string][] = [
  ['Multiplayer', 'Milestone 5'],
];

/** `progress`: a line about campaign progress (best scores are per stage, on the stage screen). */
export function mainMenuScreen(actions: MainMenuActions, progress: string | null, persistent: boolean): Screen {
  const campaign = h('button', { class: 'menu-button primary', onClick: actions.onCampaign }, 'Campaign');

  const element = h(
    'section',
    { class: 'screen main-menu', attrs: { 'aria-labelledby': 'title' } },
    h('h1', { class: 'game-title', attrs: { id: 'title' } }, GAME_TITLE),
    h(
      'nav',
      { class: 'menu-list', attrs: { 'aria-label': 'Main menu' } },
      campaign,
      h('button', { class: 'menu-button', onClick: actions.onPractice }, 'Endless Practice'),
      h('button', { class: 'menu-button', onClick: actions.onSpellbook }, 'Spellbook'),
      h('button', { class: 'menu-button', onClick: actions.onCodex }, 'Codex'),
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
    progress !== null && h('p', { class: 'best-run' }, progress),
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

// ───────────────────────── Campaign: choose a stage ─────────────────────────

export interface StageSelectActions {
  onStart(mode: CampaignMode, stage: number): void;
  /** Testing controls (D-055). */
  testing?: { unlockAll: boolean; onToggleUnlock(): void; onReset(): void };
  onContinue(): void;
  onBack(): void;
}

export interface StageInfo {
  records: Readonly<CampaignRecords>;
  unlocked: boolean;
}

function stageBest(records: Readonly<CampaignRecords>): string {
  const best = records.bestRun;
  if (records.runsCompleted > 0 && best) return `✓ Cleared · best ${best.score.toLocaleString()}`;
  if (best) return `Best ${best.score.toLocaleString()} · reached level ${records.highestReached}`;
  return 'Not played yet';
}

/**
 * Campaign → choose a mode and a stage (D-047). Each stage is a 20-level run
 * ending in a boss; clearing it opens the next. A run in progress can be
 * continued.
 */
export function stageSelectScreen(
  info: (mode: CampaignMode, stage: number) => StageInfo,
  saved: Readonly<CampaignRun> | null,
  notice: boolean,
  actions: StageSelectActions,
): Screen {
  const column = (mode: CampaignMode, detail: string) =>
    h(
      'div',
      { class: `stage-column ${mode}` },
      h('h3', { class: 'mode-title' }, MODE_TITLES[mode]),
      h('p', { class: 'mode-detail' }, detail),
      ...Array.from({ length: STAGE_COUNT }, (_, i) => {
        const stage = i + 1;
        const { records, unlocked } = info(mode, stage);
        return h(
          'button',
          {
            class: `menu-button stage-card${records.runsCompleted > 0 ? ' cleared' : ''}`,
            disabled: !unlocked,
            attrs: unlocked ? {} : { title: `Clear stage ${stage - 1} to open` },
            onClick: () => actions.onStart(mode, stage),
          },
          h('span', { class: 'stage-name' }, `Stage ${stage} · ${STAGE_NAMES[i]}`),
          h('span', { class: 'mode-best' }, unlocked ? stageBest(records) : `Locked · clear stage ${stage - 1}`),
        );
      }),
    );
  const cont = saved
    ? h(
        'button',
        { class: 'menu-button primary continue-run', onClick: actions.onContinue },
        `Continue: ${MODE_TITLES[saved.mode]} · Stage ${saved.stage} · Level ${saved.level}`,
      )
    : null;
  const element = h(
    'section',
    { class: 'screen panel stage-select', attrs: { role: 'dialog', 'aria-labelledby': 'mode-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'mode-title' } }, 'Campaign'),
    h(
      'p',
      { class: 'screen-subtitle' },
      `Each stage is a run of ${STAGE_LEVELS} levels ending in a boss · fall and the stage starts over`,
    ),
    notice ? h('p', { class: 'reward' }, 'The campaign has been rebuilt into stages, so earlier campaign and practice records were cleared.') : null,
    cont,
    h(
      'div',
      { class: 'stage-columns' },
      column('normal', 'The ward is restored at the start of every level.'),
      column('hardcore', `Ward damage carries through the stage; levels ${HARDCORE_HEAL_LEVELS.join(', ')} heal ${HARDCORE_HEAL}%.`),
    ),
    h(
      'div',
      { class: 'button-row' },
      actions.testing &&
        h('button', { class: 'menu-button', onClick: actions.testing.onToggleUnlock }, actions.testing.unlockAll ? 'Testing: all unlocked' : 'Testing: real progress'),
      actions.testing && h('button', { class: 'menu-button', onClick: actions.testing.onReset }, 'Reset campaign'),
      h('button', { class: 'menu-button', onClick: actions.onBack }, 'Back'),
    ),
  );
  const first = cont ?? element.querySelector<HTMLElement>('.stage-card:not([disabled])')!;
  return {
    element,
    focus: first,
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

export function levelClearScreen(
  cleared: DifficultyConfig,
  next: DifficultyConfig,
  stats: GameStats,
  run: Readonly<CampaignRun>,
  onContinue: () => void,
  extra?: HTMLElement | null,
): Screen {
  const button = h('button', { class: 'menu-button primary', onClick: onContinue }, `Continue to level ${next.level}`);
  const healed = run.mode === 'hardcore' && HARDCORE_HEAL_LEVELS.includes(cleared.level);
  const element = h(
    'section',
    { class: 'screen panel results won keeps-field', attrs: { role: 'dialog', 'aria-labelledby': 'clear-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'clear-title' } }, `Level ${cleared.level} Cleared`),
    h('p', { class: 'screen-subtitle' }, `Stage ${run.stage} · ${cleared.name}${run.mode === 'hardcore' ? ' · Hardcore' : ''}`),
    h('p', { class: 'score' }, h('span', { class: 'score-label' }, 'Stage score'), run.score.toLocaleString()),
    h(
      'dl',
      { class: 'stat-grid' },
      stat('Level score', `+${stats.score.toLocaleString()}`),
      stat('Accuracy', percent(stats.accuracy)),
      stat('WPM', Math.round(stats.wpm)),
      stat('Missed', stats.missed),
      stat('Best combo', `${stats.maxCombo} words · ×${stats.peakMultiplier}`),
      stat('Clean Streak', `${stats.endCleanStreak ?? 0} (best ${stats.peakCleanStreak ?? 0})`),
      stat('Time', formatTime(stats.elapsedMs)),
    ),
    run.mode === 'hardcore' &&
      h(
        'p',
        { class: 'spell-summary' },
        `Ward instability carried: ${Math.round(run.instability)}%${healed ? ` (healed ${HARDCORE_HEAL}%)` : ''}`,
      ),
    spellSummary(run.spellCharges),
    extra ?? null,
    h('p', { class: 'next-up' }, `Next: Level ${next.level} · ${next.name}${isSurvival(next) ? ' · Boss' : ''}`),
    h('div', { class: 'button-row' }, button),
  );
  return { element, focus: button };
}

// ───────────────────────── End of run ─────────────────────────

export interface RunOverActions {
  onNewRun(): void;
  onMenu(): void;
  /** Victory: play the next stage (absent after the last stage). */
  onNextStage?(): void;
  /** After a cleared stage: keep going in endless mode at the stage's peak pace (D-055). */
  onEndless?(): void;
  /** Victory: the spell won from the boss (first playable next stage). */
  spellWon?: SpellId | null;
  /** Shown above the buttons (the stage journey). */
  extra?: HTMLElement | null;
  mode?: CampaignMode;
}

export function runOverScreen(
  summary: RunSummary,
  outcome: RunOutcome,
  lastLevel: DifficultyConfig,
  actions: RunOverActions,
): Screen {
  const won = summary.victory;
  const stage = summary.stage ?? 1;
  const title = won ? `Stage ${stage} Cleared` : 'Run Over';
  const mode = MODE_TITLES[actions.mode ?? 'normal'];
  const subtitle = (won
    ? `${mode} · ${STAGE_NAMES[stage - 1]} · ${lastLevel.name} defeated`
    : `${mode} · Stage ${stage} · fell on level ${summary.reachedLevel} · ${summary.levelsCleared} cleared`);

  const bestLine =
    outcome.previousBest === null
      ? 'Your first recorded run'
      : outcome.isNewBest
        ? `New best run! (was ${outcome.previousBest.toLocaleString()})`
        : `Best run: ${outcome.previousBest.toLocaleString()}`;

  const next = won && actions.onNextStage ? h('button', { class: 'menu-button primary', onClick: actions.onNextStage }, `Stage ${stage + 1}`) : null;
  const newRun = h('button', { class: `menu-button${next ? '' : ' primary'}`, onClick: actions.onNewRun }, won ? 'Play again' : 'Try again');
  const endless = won && actions.onEndless ? h('button', { class: 'menu-button', onClick: actions.onEndless }, 'Endless mode') : null;
  const spell = won && actions.spellWon ? SPELLS[actions.spellWon] : null;
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
    spell
      ? h(
          'p',
          { class: 'reward', attrs: spellStyle(spell.id) },
          `New spell unlocked: ${spell.name} (type ${spell.id}). You start stage ${stage + 1} with one charge.`,
        )
      : null,
    won && !actions.onNextStage ? h('p', { class: 'reward' }, 'Every stage of this mode is cleared. The world remembers.') : null,
    actions.extra ?? null,
    h(
      'div',
      { class: 'button-row' },
      next,
      newRun,
      endless,
      h('button', { class: 'menu-button', onClick: actions.onMenu }, 'Main menu'),
    ),
  );
  return {
    element,
    focus: next ?? newRun,
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

type Channel = 'music' | 'sfx' | 'voice';
const CHANNELS: { key: Channel; vol: 'musicVolume' | 'sfxVolume' | 'voiceVolume'; name: string; note?: string }[] = [
  { key: 'music', vol: 'musicVolume', name: 'Music' },
  { key: 'sfx', vol: 'sfxVolume', name: 'Sound effects' },
  { key: 'voice', vol: 'voiceVolume', name: 'Announcer', note: 'No announcer lines yet' },
];

/** Options (D-053): music, sound effects and the announcer, each with a switch and a volume slider. */
export function optionsScreen(
  a: Readonly<AudioToggles & { voice: boolean; musicVolume: number; sfxVolume: number; voiceVolume: number }>,
  actions: { onToggle(ch: Channel): void; onVolume(ch: Channel, value: number): void; onBack(): void },
  focusKey: Channel | null = null,
): Screen {
  const rows = CHANNELS.map((c) => {
    const on = a[c.key];
    const toggle = h('button', { class: `menu-button audio-toggle${on ? ' primary' : ''}`, onClick: () => actions.onToggle(c.key), attrs: { role: 'switch', 'aria-checked': String(on) } }, `${c.name}: ${on ? 'On' : 'Off'}`);
    const value = h('span', { class: 'audio-value' }, `${a[c.vol]}%`);
    const slider = h('input', { class: 'audio-slider', attrs: { type: 'range', min: '0', max: '100', step: '5', value: String(a[c.vol]), 'aria-label': `${c.name} volume` } }) as HTMLInputElement;
    slider.addEventListener('input', () => {
      value.textContent = `${slider.value}%`;
      actions.onVolume(c.key, Number(slider.value));
    });
    return { key: c.key, toggle, row: h('div', { class: 'audio-row' }, toggle, slider, value, c.note ? h('span', { class: 'audio-note' }, c.note) : null) };
  });
  const back = h('button', { class: 'menu-button', onClick: actions.onBack }, 'Back');
  const music = rows[0]!.toggle;
  const sfx = rows[1]!.toggle;
  const element = h(
    'section',
    { class: 'screen panel options', attrs: { role: 'dialog', 'aria-labelledby': 'options-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'options-title' } }, 'Options'),
    h('p', { class: 'screen-subtitle' }, 'Each channel has its own switch and volume. Music and sound effects can also be switched from the pause menu (Esc).'),
    h('div', { class: 'menu-list' }, ...rows.map((r) => r.row), back),
  );
  const voice = rows[2]!.toggle;
  return {
    element,
    focus: focusKey === 'sfx' ? sfx : focusKey === 'voice' ? voice : music,
    onKey: (event) => {
      if (event.key === 'Escape') actions.onBack();
    },
  };
}

/** Testing build (CAMPAIGN_UNLOCK_ALL): pick the level a Campaign run starts at. */
export function levelPickScreen(mode: CampaignMode, stage: number, actions: { onPick(level: number): void; onBack(): void }): Screen {
  const buttons = Array.from({ length: STAGE_LEVELS }, (_, i) => {
    const level = i + 1;
    const boss = level === STAGE_LEVELS;
    return h('button', { class: `menu-button level-pick${boss ? ' boss' : ''}`, onClick: () => actions.onPick(level) }, boss ? `${level} · Boss` : String(level));
  });
  const back = h('button', { class: 'menu-button', onClick: actions.onBack }, 'Back');
  const element = h(
    'section',
    { class: 'screen panel level-pick-screen', attrs: { role: 'dialog' } },
    h('h2', { class: 'screen-title' }, `${mode === 'hardcore' ? 'Hardcore' : 'Normal'} · Stage ${stage}`),
    h('p', { class: 'screen-subtitle' }, `${STAGE_NAMES[stage - 1]}. Testing build: start the run at any level (you get 1 charge of each spell known there).`),
    h('div', { class: 'level-pick-grid' }, ...buttons),
    h('div', { class: 'menu-list' }, back),
  );
  return { element, focus: buttons[0]!, onKey: (e) => { if (e.key === 'Escape') actions.onBack(); } };
}
