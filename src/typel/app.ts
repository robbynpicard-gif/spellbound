/**
 * TypeL prototype app (D-085): menus and mode flow. Production `main` is not
 * affected; this is the dev preview's entry point.
 */
import type Phaser from 'phaser';
import type { GameResult } from '../core/GameEvents';
import type { GameStats } from '../gameplay/ScoringSystem';
import { SPELLS } from '../spells/SpellRegistry';
import type { SpellCharges, SpellId } from '../gameplay/SpellManager';
import { RUNES, RUNE_BY_ID } from '../gameplay/runes/RuneCatalogue';
import {
  apprenticeshipEndless, apprenticeshipRun, BOSS_LEVEL, LEARN_CHECKPOINTS, OPENING, openingRun, sandboxRunConfig, SPELL_ORDER, TRIALS,
  type Mode, type StartPhase, type Trial,
} from './apprenticeship';
import { arcaneTrialConfig, CROSSWIND, type TrialAdaptation } from './arcaneTrials';
import { hardcoreSeed, lockReason, openingUnlocked, repertoire, startingBank, trialUnlocked } from './progression';
import { SPELL_CAP_CANDIDATES } from '../gameplay/SpellManager';
import { clearRun, loadRun, RUN_RULESET, runRecordKey, saveRun, type SavedRun } from './runSave';
import { sound, type AudioSettings } from './audio';
import { prefs } from './prefs';
import { TypeLPlayScene, type PlaySetup } from './render/PlayScene';
import { SPELL_GLYPH, SPELL_HUE } from './render/paint';
import { TypeLMenuScene } from './render/study';
import { medalDataUrl } from './render/medal';
import { voice } from './voice';
import { RUNE_CALLOUTS, SPECIAL } from './voiceLines';
import { TIER_NAMES, tierOf, TRIUMPHS } from './triumphs';
import { trialText, typingStats } from './typingTrial';

type Child = Node | string | null | undefined | false;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> | null = {}, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') e.className = String(v);
    else if (k === 'style') e.setAttribute('style', String(v));
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}
const btn = (label: string, onClick: () => void, cls = '') => el('button', { class: `t-btn ${cls}`, onClick: () => (sound.click(), onClick()) }, label);

/** D-102: one continuous apprenticeship run (Learn → Master → Boss → optional Endless). */
interface Run {
  mode: Mode;
  trial: number;
  start: StartPhase;
  seed: number;
  /** D-115: the spells this run offers (fixed at the start, so a resume replays identically). */
  spells: SpellId[];
  /** D-115 experiment: per-spell caps on for this run. */
  caps: boolean;
  endless: boolean;
  /** Resumed after the Ward fell: Flawless Perfection is no longer possible. */
  fell: boolean;
}

const recordKey = runRecordKey;

const PHASE_NAME = { learn: 'Learn', master: 'Master', boss: 'Boss Examination', endless: 'Endless' } as const;

export class TypeLApp {
  private run: Run | null = null;
  private mode: Mode = 'normal';
  private sandbox = { mode: 'normal' as Mode, tier: 3 };
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(private readonly game: Phaser.Game, private readonly root: HTMLElement) {}

  // ───────────────────────── plumbing ─────────────────────────

  private show(panel: HTMLElement, opts: { overlay?: boolean; onKey?: (e: KeyboardEvent) => void } = {}): void {
    this.root.replaceChildren(panel);
    this.root.className = opts.overlay ? 'is-overlay' : 'is-menu';
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = opts.onKey ?? null;
    if (this.keyHandler) window.addEventListener('keydown', this.keyHandler);
    (panel.querySelector('.t-btn.primary') as HTMLElement | null)?.focus();
  }

  private clearUi(): void {
    this.root.replaceChildren();
    this.root.className = '';
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = null;
  }

  private backdrop(): void {
    this.game.scene.stop(TypeLPlayScene.KEY);
    if (!this.game.scene.isActive(TypeLMenuScene.KEY)) this.game.scene.start(TypeLMenuScene.KEY);
    sound.setMood('menu');
  }

  private get play(): TypeLPlayScene {
    return this.game.scene.getScene(TypeLPlayScene.KEY) as TypeLPlayScene;
  }

  private startPlay(setup: PlaySetup): void {
    this.clearUi();
    this.game.scene.stop(TypeLMenuScene.KEY);
    this.game.scene.start(TypeLPlayScene.KEY, setup);
  }

  private panel(title: string, ...kids: Child[]): HTMLElement {
    return el('section', { class: 't-panel' }, el('h2', { class: 't-title' }, title), ...kids);
  }

  // ───────────────────────── title ─────────────────────────

  showTitle(): void {
    this.run = null;
    this.backdrop();
    const menu = el(
      'section', { class: 't-titlecard' },
      el('h1', { class: 't-logo' }, el('span', { class: 't-initial' }, 'T'), 'YPEL'),
      el('p', { class: 't-phonetic' }, '/ˈtaɪ.pəl/  ·  “tie-pull”'),
      el('p', { class: 't-tagline' }, 'Type. Cast. Survive.'),
      el('nav', { class: 't-menu' },
        btn('Academy', () => this.showApprenticeship(), 'primary'),
        btn('Arcade', () => this.showArcade()),
        btn('Practice', () => this.showPractice()),
        btn('Arcane Trials · experimental', () => this.showArcaneTrial()),
        btn('Codex', () => this.showCodex('rules')),
        btn('Options & Dev Tools', () => this.showOptions()),
      ),
      el('p', { class: 't-foot' }, 'Development preview · Arcade and Practice are experimental integrations · art and audio are placeholders'),
    );
    this.show(menu);
  }

  /** One endless Arcade experience: adaptive Casual and fixed, graduate-only Ranked. */
  private showArcade(): void {
    this.run = null;
    this.backdrop();
    const graduated = prefs.data.completed.normal.includes(9) || prefs.data.unlockAll;
    const earned = SPELL_ORDER.filter((_, i) => prefs.data.completed.normal.includes(i + 1) || prefs.data.unlockAll);
    this.show(this.panel('Arcade',
      el('p', null, 'TypeL without examinations: endless scrolls, spells, Combo and Arcane Rush. Survive and beat your score.'),
      el('div', { class: 't-menu' },
        btn('Casual · adaptive', () => this.startArcade(false), 'primary'),
        graduated ? btn('Ranked · fixed prototype', () => this.startArcade(true)) : el('p', { class: 't-small' }, 'Ranked unlocks after Academy graduation.'),
      ),
      el('p', { class: 't-small' }, `Casual repertoire: ${earned.length} of 8 spells earned. Ranked currently uses one fixed prototype profile; curated presets and verified online rankings are not yet implemented.`),
      el('p', { class: 't-small' }, `Casual best: ${(prefs.data.bestEndless['arcade:casual'] ?? 0).toLocaleString()} · Ranked prototype best: ${(prefs.data.bestEndless['arcade:ranked:prototype'] ?? 0).toLocaleString()}`),
      el('div', { class: 't-row' }, btn('Back', () => this.showTitle())),
    ), { onKey: (e) => e.key === 'Escape' && this.showTitle() });
  }

  private startArcade(ranked: boolean): void {
    const graduated = prefs.data.completed.normal.includes(9) || prefs.data.unlockAll;
    if (ranked && !graduated) return this.showArcade();
    const spells = ranked ? [...SPELL_ORDER] : SPELL_ORDER.filter((_, i) => prefs.data.completed.normal.includes(i + 1) || prefs.data.unlockAll);
    // Reuse the existing endless Director and standard charge economy. This is
    // a test integration, not the final authored Arcade balance profile.
    const config = apprenticeshipEndless(ranked ? 'hardcore' : 'normal', ranked ? 9 : Math.max(1, spells.length), spells);
    const key = ranked ? 'arcade:ranked:prototype' : 'arcade:casual';
    this.startPlay({
      config,
      seed: Math.floor(Math.random() * 2 ** 31),
      hardcore: false,
      initialSpells: {},
      spells,
      title: 'Arcade',
      subtitle: ranked ? 'Ranked · fixed prototype · local record only' : 'Casual · adaptive · earned spells',
      trialName: 'Arcade',
      onPause: () => this.pauseMenu(() => this.startArcade(ranked), () => this.showArcade()),
      onEnd: (_result, stats) => {
        const best = prefs.data.bestEndless[key] ?? 0;
        if (stats.score > best) prefs.data.bestEndless[key] = stats.score;
        this.record(stats, 0);
        prefs.save();
        this.show(this.panel('Arcade · the Ward has fallen',
          el('div', { class: 't-bigscore' }, stats.score.toLocaleString()),
          stats.score > best ? el('p', { class: 't-small' }, 'New personal best') : null,
          el('div', { class: 't-stats' },
            stat('Scrolls', String(stats.completed)),
            stat('Accuracy', `${Math.round(stats.accuracy * 100)}%`),
            stat('WPM', String(Math.round(stats.wpm))),
            stat('Best Combo', String(stats.maxCombo))),
          el('p', { class: 't-small' }, 'Prototype records are local only, not ranked community results.'),
          el('div', { class: 't-row' }, btn('Again', () => this.startArcade(ranked), 'primary'), btn('Arcade', () => this.showArcade()), btn('Title', () => this.showTitle())),
        ), { overlay: true });
      },
    });
  }

  private showPractice(): void {
    this.backdrop();
    this.show(this.panel('Practice',
      el('p', null, 'Improve your typing or experiment with the battlefield. Practice results do not count toward ranked Arcade.'),
      el('div', { class: 't-menu' },
        btn('Free Type · coming soon', () => this.showFreeType()),
        btn('Read & Type', () => this.showTypingSetup(), 'primary'),
        btn('Battlefield Lab · prototype', () => this.showSandboxSetup()),
      ),
      el('div', { class: 't-row' }, btn('Back', () => this.showTitle())),
    ), { onKey: (e) => e.key === 'Escape' && this.showTitle() });
  }

  private showFreeType(): void {
    this.backdrop();
    this.show(this.panel('Free Type · design preview',
      el('p', null, 'A spontaneous writing-speed test is planned, but has not been implemented. Unlike Read & Type, there is no reference passage, so accuracy cannot be measured against a target.'),
      el('div', { class: 't-row' }, btn('Practice', () => this.showPractice(), 'primary')),
    ));
  }

  // ───────────────────────── apprenticeship ─────────────────────────

  showApprenticeship(): void {
    this.backdrop();
    const done = new Set(prefs.data.completed[this.mode]);
    const saved = loadRun();
    const list = el('div', { class: 't-trials' });
    // D-112: the spell-free Opening Trial comes first and is suggested on a new save, but never gates anything.
    const opened = prefs.data.opening;
    const fresh = opened.runs === 0 && done.size === 0;
    const openingBest = opened.best[this.mode];
    const openingOpen = openingUnlocked(prefs.data, this.mode);
    list.append(
      el('article', { class: `t-trial${opened.cleared[this.mode] ? ' done' : ''}`, style: '--hue:#d9a441' },
        el('div', { class: 't-trial-glyph' }, '✎'),
        el('div', { class: 't-trial-body' },
          el('h3', null, `${fresh ? 'Start here · ' : ''}${OPENING.title}`),
          el('p', null, `${OPENING.examiner} · no spells · type to claim the scrolls`),
          el('p', { class: 't-small' }, opened.cleared[this.mode] ? `Cleared ✓ · best ${openingBest?.toLocaleString() ?? '—'}` : openingBest ? `Best ${openingBest.toLocaleString()}` : 'Not yet attempted'),
        ),
        el('div', { class: 't-trial-go' }, openingOpen
          ? btn(opened.runs > 0 ? 'Replay' : 'Begin', () => this.beginOpening(), 'primary small')
          : el('span', { class: 't-small' }, '🔒 Clear it in Normal first')),
      ),
    );
    for (const t of TRIALS) {
      const pick = el('select', { class: 't-levelpick', 'aria-label': `Start ${t.title} at phase` },
        el('option', { value: 'learn' }, 'From Learn'), el('option', { value: 'master' }, 'From Master'), el('option', { value: 'boss' }, 'Boss only'));
      const best = prefs.data.bestTrialScore[recordKey(this.mode, t.index)];
      const open = trialUnlocked(prefs.data, this.mode, t.index);
      list.append(
        el('article', { class: `t-trial${done.has(t.index) ? ' done' : ''}${open ? '' : ' locked'}`, style: t.spell ? `--hue:${SPELL_HUE[t.spell]}` : '--hue:#d9a441' },
          el('div', { class: 't-trial-glyph' }, t.spell ? SPELL_GLYPH[t.spell] : '✶'),
          el('div', { class: 't-trial-body' },
            el('h3', null, `${t.index}. ${t.title}`),
            el('p', null, `${t.master}${t.spell ? ` · learn ${t.spell.toUpperCase()}` : ' · every spell'} · boss: ${t.bossName}`),
            el('p', { class: 't-small' }, !open ? `🔒 ${lockReason(this.mode, t.index)}` : done.has(t.index) ? `Completed ✓ · best ${best?.toLocaleString() ?? '—'}` : best ? `Best ${best.toLocaleString()}` : 'Not yet completed'),
          ),
          el('div', { class: 't-trial-go' }, open ? btn(done.has(t.index) ? 'Replay' : 'Begin', () => this.beginTrial(t.index, pick.value as StartPhase), 'primary small') : null, open ? pick : null),
        ),
      );
    }
    const resume = saved
      ? el('div', { class: 't-row' },
          btn(`Resume ${TRIALS[saved.trial - 1]!.title} · ${PHASE_NAME[saved.phase as keyof typeof PHASE_NAME] ?? saved.phase} · ${saved.score.toLocaleString()}`, () => this.resumeRun(saved), 'primary small'),
          btn('Discard saved run', () => (clearRun(), this.showApprenticeship()), 'small'),
          el('span', { class: 't-small' }, `${saved.mode === 'hardcore' ? 'Hardcore' : 'Normal'} · saved at its last checkpoint`))
      : null;
    this.show(this.panel('The Apprenticeship',
      resume,
      el('div', { class: 't-row' },
        btn('Normal', () => ((this.mode = 'normal'), this.showApprenticeship()), this.mode === 'normal' ? 'primary small' : 'small'),
        btn('Hardcore', () => ((this.mode = 'hardcore'), this.showApprenticeship()), this.mode === 'hardcore' ? 'primary small' : 'small'),
        el('span', { class: 't-small' }, this.mode === 'normal'
          ? 'Normal teaches: type a spell’s name and press Enter to cast it. The pressure adapts to how you play, within each examination’s limits, and the Ward is restored at every checkpoint. Replays keep their difficulty but give you every spell you have earned.'
          : 'Hardcore is optional and fixed: the same scrolls every attempt, no adaptation, and the Ward carries through the whole apprenticeship. Come back with more spells. Clearing an examination in Normal opens its Hardcore.'),
      ),
      list,
      el('p', { class: 't-small' }, 'Each apprenticeship is one continuous examination: Learn, then Master, then the Boss Examination, then Endless if you wish. Score, Combo and Arcane Rush carry all the way through. Your run is saved at every checkpoint. The phase picker is a testing tool. ' + (prefs.data.unlockAll ? 'Everything is unlocked (Options).' : 'To open everything for testing, see Options.')),
      el('div', { class: 't-row' }, btn('Back', () => this.showTitle())),
    ), { onKey: (e) => e.key === 'Escape' && this.showTitle() });
  }

  // ───────────────────────── D-112: the Opening Trial ─────────────────────────

  private beginOpening(): void {
    this.run = null;
    this.backdrop();
    this.show(this.panel(OPENING.title, this.mentor(OPENING.intro),
      el('p', null, 'Type each falling word and press Enter to claim its scroll before it reaches the Ward. Perfect words build Combo; quick perfect words build Arcane Rush. There are no spells here. The sky fills faster and faster: clear the trial if your hands can, but if the Ward falls you still move on.'),
      el('div', { class: 't-row' }, btn('Begin', () => this.launchOpening(), 'primary'), btn('Back', () => this.showApprenticeship()))),
    { onKey: (e) => e.key === 'Enter' && this.launchOpening() });
  }

  private launchOpening(): void {
    const mode = this.mode;
    const plan = openingRun(mode);
    this.clearUi();
    this.startPlay({
      config: plan.segments[0]!.config,
      run: plan,
      seed: mode === 'hardcore' ? hardcoreSeed(0) : Math.floor(Math.random() * 2 ** 31),
      hardcore: mode === 'hardcore',
      initialSpells: {},
      spells: [],
      title: OPENING.title,
      subtitle: `${mode === 'hardcore' ? 'Hardcore' : 'Normal'} · no spells`,
      trialName: OPENING.short,
      checkpointLines: (segment) => {
        const hint = OPENING.hints[segment];
        return hint ? [hint] : undefined;
      },
      onPause: () => this.pauseMenu(() => this.launchOpening(), () => this.showApprenticeship()),
      onEnd: (result, stats) => this.openingEnded(mode, result === 'won', stats),
    });
  }

  private openingEnded(mode: Mode, cleared: boolean, stats: GameStats): void {
    const o = prefs.data.opening;
    o.runs++;
    if (cleared) o.cleared[mode] = true;
    const isBest = stats.score > (o.best[mode] ?? 0);
    if (isBest) o.best[mode] = stats.score;
    this.record(stats, 0);
    if (cleared) sound.victory();
    const line = cleared ? OPENING.passed : OPENING.fell;
    this.show(this.panel(cleared ? 'Trial cleared' : 'The Ward has fallen',
      this.mentor([line]),
      el('div', { class: 't-bigscore' }, stats.score.toLocaleString()),
      isBest ? el('p', { class: 't-small' }, 'New best') : null,
      el('div', { class: 't-stats' }, stat('Scrolls', String(stats.completed)), stat('Accuracy', `${Math.round(stats.accuracy * 100)}%`), stat('WPM', String(Math.round(stats.wpm))), stat('Best Combo', String(stats.maxCombo)), stat('Peak Rush', `×${(stats.peakArcaneVolleyMultiplier ?? 1).toFixed(1)}`)),
      el('div', { class: 't-row' },
        btn(`Continue: ${TRIALS[0]!.title}`, () => this.beginTrial(1, 'learn'), 'primary'),
        btn('Try again', () => this.launchOpening()),
        btn('Leave', () => this.showApprenticeship())),
    ), { overlay: true, onKey: (e) => e.key === 'Enter' && this.beginTrial(1, 'learn') });
  }

  private beginTrial(index: number, start: StartPhase = 'learn'): void {
    const trial = TRIALS[index - 1]!;
    if (!trialUnlocked(prefs.data, this.mode, index)) return this.showApprenticeship();
    clearRun();
    // D-115/D-118: Hardcore is a fixed, reproducible challenge; Normal varies its seed.
    const seed = this.mode === 'hardcore' ? hardcoreSeed(index) : Math.floor(Math.random() * 2 ** 31);
    this.run = { mode: this.mode, trial: index, start, seed, spells: repertoire(prefs.data, index), caps: prefs.data.spellCaps, endless: false, fell: false };
    if (start === 'learn') {
      this.backdrop();
      this.show(this.panel(trial.title, this.mentor(trial.intro),
        this.spellCard(trial.spell),
        el('div', { class: 't-row' }, btn('Begin', () => this.launchRun(), 'primary'), btn('Back', () => this.showApprenticeship()))),
      { onKey: (e) => e.key === 'Enter' && this.launchRun() });
    } else this.launchRun();
  }

  private resumeRun(saved: SavedRun, fell = saved.fell): void {
    this.mode = saved.mode;
    this.run = { mode: saved.mode, trial: saved.trial, start: saved.start, seed: saved.seed, spells: saved.spells ?? repertoire(prefs.data, saved.trial), caps: saved.caps ?? false, endless: false, fell };
    this.launchRun(saved);
  }

  private mentor(lines: readonly { who: string; text: string }[]): HTMLElement {
    return el('div', { class: 't-letter' }, ...lines.map((l) => el('p', null, el('strong', null, l.who), el('br'), l.text)),
      el('p', { class: 't-small' }, 'Placeholder mentor text: names, voices and dialogue are not final.'));
  }

  private spellCard(spell: SpellId | null): HTMLElement | null {
    if (!spell) return null;
    const s = SPELLS[spell];
    return el('div', { class: 't-spellcard', style: `--hue:${SPELL_HUE[spell]}` },
      el('span', { class: 't-spellglyph' }, SPELL_GLYPH[spell]),
      el('div', null, el('h3', null, `${s.book.toUpperCase()} · type “${spell}”`), el('p', null, s.description)));
  }

  /** One engine for the whole apprenticeship. Checkpoints happen inside the game; only the end of the run leaves it. */
  private launchRun(resume?: SavedRun): void {
    const run = this.run!;
    const trial = TRIALS[run.trial - 1]!;
    const plan = apprenticeshipRun(run.mode, run.trial, run.start, { spells: run.spells });
    const short = trial.title.replace(/^The Apprenticeship of /, '');
    this.clearUi();
    this.startPlay({
      config: plan.segments[0]!.config,
      run: plan,
      seed: run.seed,
      resume: resume ? { commands: resume.commands, tick: resume.tick } : undefined,
      hardcore: run.mode === 'hardcore',
      initialSpells: startingBank(trial, run.spells),
      spells: run.spells,
      spellCaps: run.caps ? SPELL_CAP_CANDIDATES : null,
      title: trial.title,
      subtitle: `${run.mode === 'hardcore' ? 'Hardcore' : 'Normal'} · ${resume ? `Resuming · ${PHASE_NAME[resume.phase as keyof typeof PHASE_NAME] ?? resume.phase}` : PHASE_NAME[run.start]}`,
      trialName: short,
      bossName: trial.bossName,
      bossLines: trial.bossIntro,
      checkpointLines: (segment) => {
        const level = Math.min(BOSS_LEVEL, (run.start === 'learn' ? 1 : run.start === 'master' ? LEARN_CHECKPOINTS + 1 : BOSS_LEVEL) + segment);
        const hint = trial.hints[level];
        return hint ? [hint] : undefined;
      },
      lines: run.start === 'learn' && !resume ? trial.intro.slice(-1) : undefined,
      boss: run.start === 'boss',
      onCheckpoint: (cp) => saveRun({
        ruleset: RUN_RULESET, mode: run.mode, trial: run.trial, start: run.start, seed: run.seed, spells: run.spells, caps: run.caps,
        tick: cp.tick, commands: cp.commands, phase: cp.phase, score: cp.score, savedAt: Date.now(), fell: run.fell,
      }),
      onPause: () => this.pauseMenu(() => this.beginTrial(run.trial, run.start)),
      onEnd: (result, stats, carry) => this.runEnded(result, stats, carry.checkpoints),
    });
  }

  private record(stats: GameStats, levels: number): void {
    const l = prefs.data.lifetime;
    l.words += stats.completed;
    l.perfect += stats.maxCombo > 0 ? Math.round(stats.completed * stats.accuracy) : 0;
    l.peakVolley = Math.max(l.peakVolley, stats.peakArcaneVolleyMultiplier ?? 1);
    l.wagers += stats.allInWagers ?? 0;
    l.levels += levels;
    prefs.save();
  }

  private runEnded(result: GameResult, stats: GameStats, checkpoints: number): void {
    const run = this.run!;
    const trial = TRIALS[run.trial - 1]!;
    // Lifetime "levels" counts checkpoints reached in this run (each was a level before D-102).
    this.record(stats, run.endless ? 0 : checkpoints + (result === 'won' ? 1 : 0));
    if (run.endless) return this.endlessOver(stats);
    if (result !== 'won') return this.runLost(stats);
    clearRun();
    this.trialWon(trial, stats);
  }

  private runLost(stats: GameStats): void {
    const run = this.run!;
    const trial = TRIALS[run.trial - 1]!;
    const saved = loadRun();
    const phase = saved ? (PHASE_NAME[saved.phase as keyof typeof PHASE_NAME] ?? saved.phase) : null;
    this.show(this.panel('The Ward has fallen',
      el('p', null, `${trial.master}: “Again. Every Master has fallen here.”`),
      el('div', { class: 't-bigscore' }, stats.score.toLocaleString()),
      el('div', { class: 't-stats' }, stat('Scrolls', String(stats.completed)), stat('Accuracy', `${Math.round(stats.accuracy * 100)}%`), stat('WPM', String(Math.round(stats.wpm))), stat('Best Combo', String(stats.maxCombo))),
      el('div', { class: 't-row' },
        saved && saved.trial === run.trial ? btn(`Retry from checkpoint (${phase} · ${saved.score.toLocaleString()})`, () => this.resumeRun(saved, true), 'primary') : null,
        btn('Restart apprenticeship', () => this.beginTrial(run.trial, run.start), saved ? '' : 'primary'),
        btn('Leave', () => this.showApprenticeship())),
      el('p', { class: 't-small' }, 'Retrying restores the run exactly as it was at its last checkpoint, with the score it had then (testing convenience).'),
    ), { overlay: true });
  }

  private trialWon(trial: Trial, stats: GameStats): void {
    const run = this.run!;
    const key = recordKey(run.mode, run.trial);
    const list = prefs.data.completed[run.mode];
    if (!list.includes(run.trial)) list.push(run.trial);
    prefs.data.lifetime.bosses++;
    const best = prefs.data.bestTrialScore[key] ?? 0;
    const isBest = stats.score > best;
    if (isBest) prefs.data.bestTrialScore[key] = stats.score;
    prefs.save();
    sound.victory();
    // Flawless Perfection: the whole apprenticeship from the start, never fallen, every checkpoint and the boss Flawless.
    const checkpoints = apprenticeshipRun(run.mode, run.trial, run.start, { spells: run.spells }).segments.length;
    const perfection = run.start === 'learn' && !run.fell && (stats.runeCounts?.['flawless'] ?? 0) >= checkpoints;
    const perfectRune = RUNE_BY_ID.get('flawless-perfection')!;
    const runes: Record<string, number> = { ...(stats.runeCounts ?? {}) };
    if (perfection) {
      prefs.noteRune(perfectRune.id);
      runes[perfectRune.id] = (runes[perfectRune.id] ?? 0) + 1;
      window.setTimeout(() => {
        sound.rune(3);
        voice.say([RUNE_CALLOUTS[perfectRune.id]!, SPECIAL.flawlessPerfection], 4, 2);
      }, 900);
    }
    const runeText = Object.entries(runes).map(([id, n]) => `${RUNE_BY_ID.get(id)?.name ?? id}${n > 1 ? ` ×${n}` : ''}`);
    const nextTrial = TRIALS[run.trial];
    this.show(this.panel(`${trial.title} — complete`,
      this.mentor(trial.victory),
      perfection
        ? el('div', { class: 't-perfection' }, el('img', { class: 't-medal-big', src: medalDataUrl(perfectRune, 128), alt: '' }),
            el('div', null, el('h3', null, 'Flawless Perfection'), el('p', null, `The Grandmaster: “${SPECIAL.flawlessPerfection.text}”`)))
        : null,
      el('div', { class: 't-bigscore' }, stats.score.toLocaleString(), isBest ? el('span', { class: 't-best' }, ' new best') : null),
      el('div', { class: 't-stats' }, stat('Scrolls', String(stats.completed)), stat('Peak Rush', `×${(stats.peakArcaneVolleyMultiplier ?? 1).toFixed(1)}`), stat('Best Combo', String(stats.maxCombo)), stat('Accuracy', `${Math.round(stats.accuracy * 100)}%`)),
      runeText.length ? el('p', { class: 't-runes' }, `Runes this apprenticeship: ${runeText.join(' · ')}`) : null,
      el('div', { class: 't-row' },
        btn('Enter Endless', () => this.enterEndless(), 'primary'),
        nextTrial && trialUnlocked(prefs.data, run.mode, nextTrial.index) ? btn(`Next: ${nextTrial.title}`, () => this.beginTrial(nextTrial.index)) : null,
        btn('Apprenticeship', () => this.showApprenticeship())),
      el('p', { class: 't-small' }, 'Endless continues this exact field, score and Combo, and it never stops getting harder.'),
    ), { overlay: true });
  }

  private enterEndless(): void {
    const run = this.run!;
    run.endless = true;
    this.clearUi();
    this.play.continueEndless(apprenticeshipEndless(run.mode, run.trial, run.spells), `Endless · ${TRIALS[run.trial - 1]!.title}`);
  }

  private endlessOver(stats: GameStats): void {
    const run = this.run!;
    const key = recordKey(run.mode, run.trial);
    const best = prefs.data.bestEndless[key] ?? 0;
    const total = stats.score;
    if (total > best) prefs.data.bestEndless[key] = total;
    prefs.save();
    this.show(this.panel('Endless — the Ward falls at last',
      el('div', { class: 't-bigscore' }, total.toLocaleString(), total > best ? el('span', { class: 't-best' }, ' new best') : null),
      el('div', { class: 't-stats' }, stat('Scrolls', String(stats.completed)), stat('Accuracy', `${Math.round(stats.accuracy * 100)}%`), stat('Peak Rush', `×${(stats.peakArcaneVolleyMultiplier ?? 1).toFixed(1)}`), stat('Best Combo', String(stats.maxCombo))),
      el('div', { class: 't-row' }, btn('Apprenticeship', () => this.showApprenticeship(), 'primary'), btn('Title', () => this.showTitle())),
    ), { overlay: true });
  }

  private pauseMenu(restart: () => void, leave?: () => void): void {
    const resume = () => {
      this.clearUi();
      this.play.resume();
    };
    this.show(this.panel('Paused',
      el('div', { class: 't-menu' },
        btn('Resume', resume, 'primary'),
        btn('Restart', () => restart()),
        btn('Codex (rules)', () => this.showCodex('rules', () => this.pauseMenu(restart, leave))),
        btn('Leave', () => (leave ? leave() : this.run ? this.showApprenticeship() : this.showTitle()))),
      this.audioControls(),
    ), { overlay: true, onKey: (e) => e.key === 'Escape' && resume() });
  }

  // ───────────────────────── sandbox ─────────────────────────

  /** D-120 prototype: one representative Arcane Trial, playable from the title for evaluation. */
  private arcane: { seed: number; adaptation: TrialAdaptation } = { seed: Math.floor(Math.random() * 2 ** 31), adaptation: 'off' };

  private showArcaneTrial(): void {
    const t = CROSSWIND;
    const a = this.arcane;
    const best = prefs.data.bestTrialScore[`arcane:${t.id}:${a.adaptation}`];
    const label: Record<TrialAdaptation, string> = { off: 'Authored (fixed)', both: 'Academy-style adaptive', up: 'Rising only' };
    this.backdrop();
    this.show(this.panel(t.title,
      el('p', null, t.identity),
      el('p', { class: 't-small' }, `Survive ${t.quota} scrolls in one continuous trial (about 8 to 12 minutes; no checkpoints, no breaks). All eight spells can drop; you start with one of each. The Ward is not restored. Prototype: every number is experimental.`),
      el('div', { class: 't-row' }, ...(['off', 'both', 'up'] as TrialAdaptation[]).map((m) =>
        btn(label[m], () => ((a.adaptation = m), this.showArcaneTrial()), a.adaptation === m ? 'primary small' : 'small'))),
      el('p', { class: 't-small' }, a.adaptation === 'off'
        ? 'Authored: the same pressure profile for everyone. It does not ease when you struggle (the prototype default).'
        : a.adaptation === 'both'
          ? 'For comparison only: the Academy’s controller, easing when you struggle and pressing when you cruise.'
          : 'For comparison only: adds pressure when you cruise, never eases.'),
      el('p', { class: 't-small' }, `Seed ${a.seed}${best ? ` · best ${best.toLocaleString()}` : ''}`),
      el('div', { class: 't-row' },
        btn('Begin', () => this.launchArcaneTrial(), 'primary'),
        btn('New seed', () => ((a.seed = Math.floor(Math.random() * 2 ** 31)), this.showArcaneTrial()), 'small'),
        btn('Back', () => this.showTitle()))),
    { onKey: (e) => e.key === 'Enter' && this.launchArcaneTrial() });
  }

  private launchArcaneTrial(): void {
    const t = CROSSWIND;
    const a = { ...this.arcane };
    this.run = null;
    this.clearUi();
    this.startPlay({
      config: arcaneTrialConfig(t, a.adaptation),
      seed: a.seed,
      hardcore: false,
      initialSpells: { ...t.startingBank },
      spells: [...SPELL_ORDER],
      title: t.title,
      subtitle: `Arcane Trial · prototype · seed ${a.seed}`,
      trialName: 'Crosswind',
      onPause: () => this.pauseMenu(() => this.launchArcaneTrial(), () => this.showArcaneTrial()),
      onEnd: (result, stats) => this.arcaneTrialEnded(a, result === 'won', stats),
    });
  }

  private arcaneTrialEnded(a: { seed: number; adaptation: TrialAdaptation }, survived: boolean, stats: GameStats): void {
    const key = `arcane:${CROSSWIND.id}:${a.adaptation}`;
    const isBest = stats.score > (prefs.data.bestTrialScore[key] ?? 0);
    if (isBest) prefs.data.bestTrialScore[key] = stats.score;
    this.record(stats, 0);
    if (survived) sound.victory();
    const minutes = Math.floor(stats.elapsedMs / 60000);
    const seconds = Math.floor((stats.elapsedMs % 60000) / 1000);
    this.show(this.panel(survived ? 'Trial survived' : 'The Ward has fallen',
      el('div', { class: 't-bigscore' }, stats.score.toLocaleString()),
      isBest ? el('p', { class: 't-small' }, 'New best') : null,
      el('div', { class: 't-stats' },
        stat('Time', `${minutes}:${String(seconds).padStart(2, '0')}`), stat('Scrolls', `${stats.completed} / ${CROSSWIND.quota}`),
        stat('Accuracy', `${Math.round(stats.accuracy * 100)}%`), stat('WPM', String(Math.round(stats.wpm))),
        stat('Best Combo', String(stats.maxCombo)), stat('Peak Rush', `×${(stats.peakArcaneVolleyMultiplier ?? 1).toFixed(1)}`)),
      el('p', { class: 't-small' }, `Seed ${a.seed}. "Same seed" replays the same sky.`),
      el('div', { class: 't-row' },
        btn('Same seed', () => ((this.arcane = { ...a }), this.launchArcaneTrial()), 'primary'),
        btn('New seed', () => ((this.arcane = { ...a, seed: Math.floor(Math.random() * 2 ** 31) }), this.launchArcaneTrial())),
        btn('Title', () => this.showTitle()))),
    { overlay: true });
  }

  showSandboxSetup(): void {
    this.run = null;
    this.backdrop();
    const sb = this.sandbox;
    this.show(this.panel('Sandbox',
      el('p', null, 'Practice anything. Every spell, a deep stock of charges (6 Wind, 4 of each other), an endless field at the pace you choose. Nothing is recorded.'),
      el('div', { class: 't-row' },
        btn('Normal rules', () => ((sb.mode = 'normal'), this.showSandboxSetup()), sb.mode === 'normal' ? 'primary small' : 'small'),
        btn('Hardcore rules', () => ((sb.mode = 'hardcore'), this.showSandboxSetup()), sb.mode === 'hardcore' ? 'primary small' : 'small')),
      el('div', { class: 't-row' }, ...[1, 2, 3, 4, 5].map((n) => btn(`Pace ${n}`, () => ((sb.tier = n), this.showSandboxSetup()), sb.tier === n ? 'primary small' : 'small'))),
      el('p', { class: 't-small' }, `Pace ${sb.tier} plays the Endless of apprenticeship ${1 + (sb.tier - 1) * 2} of 9: it keeps getting harder until the Ward falls.`),
      el('div', { class: 't-row' }, btn('Start', () => this.startSandbox(), 'primary'), btn('Back', () => this.showTitle())),
      el('p', { class: 't-small' }, 'Try: Wind at full Ward then Harvest · Ice and type perfectly · Shock into a crowd · Fire on a cluster · Barrier then slip and correct · submit a wrong word on purpose and catch the plunge.'),
    ), { onKey: (e) => e.key === 'Escape' && this.showTitle() });
  }

  private startSandbox(): void {
    const sb = this.sandbox;
    const charges: Partial<SpellCharges> = Object.fromEntries(SPELL_ORDER.map((s) => [s, s === 'wind' ? 6 : 4]));
    this.startPlay({
      config: sandboxRunConfig(sb.mode, sb.tier),
      hardcore: sb.mode === 'hardcore',
      initialSpells: charges,
      poolLimitOverride: 60,
      spells: SPELL_ORDER,
      title: 'Sandbox',
      showSequenceScore: true,
      stage: `Sandbox · Pace ${sb.tier}`,
      subtitle: `${sb.mode === 'hardcore' ? 'Hardcore' : 'Normal'} rules · pace ${sb.tier} · not recorded`,
      lines: [{ who: 'The Grandmaster', text: 'Here nothing is at stake. Experiment. Combine. Break things.' }],
      onPause: () => this.pauseMenu(() => this.startSandbox()),
      onEnd: (_r, stats) => this.show(this.panel('Sandbox results',
        el('div', { class: 't-bigscore' }, stats.score.toLocaleString()),
        el('div', { class: 't-stats' },
          stat('Peak Rush', `×${(stats.peakArcaneVolleyMultiplier ?? 1).toFixed(1)}`), stat('Best Combo', String(stats.maxCombo)),
          stat('Scrolls', String(stats.completed)), stat('Accuracy', `${Math.round(stats.accuracy * 100)}%`),
          stat('Runes', String(Object.values(stats.runeCounts ?? {}).reduce((a, b) => a + b, 0)))),
        el('div', { class: 't-row' }, btn('Again', () => this.startSandbox(), 'primary'), btn('Sandbox', () => this.showSandboxSetup()), btn('Title', () => this.showTitle())),
      ), { overlay: true }),
    });
  }

  // ───────────────────────── typing trials ─────────────────────────

  showTypingSetup(): void {
    this.run = null;
    this.backdrop();
    const best = prefs.data.typing.bestWpm;
    const modes: [string, number][] = [['15 seconds', 15], ['30 seconds', 30], ['60 seconds', 60]];
    this.show(this.panel('Typing Trials',
      el('p', null, 'Raw speed on the typewriter: clear the passage as quickly and accurately as you can. No scrolls, no spells, just your hands.'),
      el('div', { class: 't-menu' }, ...modes.map(([label, s], i) => btn(`${label}${best[s] ? `  ·  best ${Math.round(best[s]!)} WPM` : ''}`, () => this.typingTrial(s), i === 1 ? 'primary' : ''))),
      el('div', { class: 't-row' }, btn('Back', () => this.showTitle())),
      el('p', { class: 't-small' }, 'Net WPM counts correct characters only (5 characters = 1 word). Mistakes stay red until fixed.'),
    ), { onKey: (e) => e.key === 'Escape' && this.showTitle() });
  }

  private typingTrial(seconds: number): void {
    const text = trialText(Math.floor(Math.random() * 1e9), seconds * 12);
    const spans = [...text].map((ch) => el('span', { class: 't-ch' }, ch));
    const passage = el('div', { class: 't-passage' }, ...spans);
    const clock = el('div', { class: 't-clock' }, `${seconds}`);
    const live = el('div', { class: 't-live' }, '— WPM');
    let typed = '';
    let errors = 0;
    let start = 0;
    let timer = 0;
    const paint = () => {
      spans.forEach((s, i) => {
        const t = typed[i];
        s.className = `t-ch${t === undefined ? '' : t === text[i] ? ' ok' : ' bad'}${i === typed.length ? ' caret' : ''}`;
      });
      spans[typed.length]?.scrollIntoView({ block: 'nearest' });
    };
    const correct = () => [...typed].filter((c, i) => c === text[i]).length;
    const finish = () => {
      window.clearInterval(timer);
      const s = typingStats(correct(), typed.length, errors, seconds * 1000);
      const b = prefs.data.typing.bestWpm;
      const isBest = s.wpm > (b[seconds] ?? 0);
      if (isBest) b[seconds] = s.wpm;
      prefs.data.typing.runs++;
      prefs.save();
      sound.levelClear();
      this.show(this.panel('Typing Trial',
        el('div', { class: 't-bigscore' }, `${Math.round(s.wpm)} WPM`, isBest ? el('span', { class: 't-best' }, ' new best') : null),
        el('div', { class: 't-stats' }, stat('Accuracy', `${Math.round(s.accuracy * 100)}%`), stat('Raw', `${Math.round(s.raw)} WPM`), stat('Correct', String(s.correct)), stat('Mistakes', String(s.errors))),
        el('div', { class: 't-row' }, btn('Again', () => this.typingTrial(seconds), 'primary'), btn('Other lengths', () => this.showTypingSetup()), btn('Title', () => this.showTitle())),
      ), { onKey: (e) => e.key === 'Enter' && this.typingTrial(seconds) });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.clearInterval(timer);
        return this.showTypingSetup();
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (typed.length) (typed = typed.slice(0, -1)), sound.backspace();
        return paint();
      }
      if (e.key.length !== 1) return;
      e.preventDefault();
      if (!start) {
        start = performance.now();
        timer = window.setInterval(() => {
          const ms = performance.now() - start;
          const left = Math.max(0, seconds - ms / 1000);
          clock.textContent = left.toFixed(0);
          live.textContent = `${Math.round(typingStats(correct(), typed.length, errors, ms).wpm)} WPM`;
          if (left <= 0) finish();
        }, 100);
      }
      if (typed.length >= text.length) return;
      if (e.key === text[typed.length]) sound.key(e.key === ' ' ? 'k' : e.key);
      else (errors++, sound.typo());
      typed += e.key;
      paint();
      if (typed.length >= text.length) finish();
    };
    this.show(el('section', { class: 't-panel t-typing' },
      el('div', { class: 't-row spread' }, el('h2', { class: 't-title' }, `Typing Trial · ${seconds}s`), clock, live),
      el('div', { class: 't-sheet' }, passage),
      el('p', { class: 't-small' }, 'Start typing to begin · Backspace fixes mistakes · Esc to leave'),
    ), { onKey });
    paint();
  }

  // ───────────────────────── codex ─────────────────────────

  showCodex(tab: 'rules' | 'spells' | 'runes' | 'triumphs', back?: () => void): void {
    if (!back) this.backdrop();
    const goBack = back ?? (() => this.showTitle());
    const tabs = el('div', { class: 't-row' }, ...(['rules', 'spells', 'runes', 'triumphs'] as const).map((t) =>
      btn(t[0]!.toUpperCase() + t.slice(1), () => this.showCodex(t, back), t === tab ? 'primary small' : 'small')));
    let body: HTMLElement;
    if (tab === 'rules') {
      body = el('div', { class: 't-codex' },
        h3('Score'), p('Each captured word pays letters × 10 × Combo × Arcane Rush, rounded once. Shock pays base × Combo; Harvest pays base × Combo × Rush and spends the Rush; Fire pays nothing. Runes pay small fixed points on top. Nothing else multiplies your score.'),
        p('In the Apprenticeship the machine shows your total and each word’s base, Combo and Rush, but never the exact points a single capture earned: that stays a mystery. The Sandbox shows them for practice.'),
        h3('Precision Combo'), p('Every perfectly typed capture adds 1 (Ice Focus adds more). Every 10 Combo raises the multiplier by ×1. A typo, a wrong Enter or a missed word breaks it. Nothing protects it from a slip: Barrier guards the Ward, not your hands.'),
        h3('Arcane Rush'), p('Your flow state. Your first perfect capture opens a timing window (the gold bar on the Rush column); a second inside it starts the Rush at ×1.2. Keep capturing in time and it climbs +0.2 per capture to ×5 (Mastery), then +0.1 per ever-harder step. Longer words get longer windows. An empty field pauses the window. Slow gives it 25% more time. Harvest spends it.'),
        h3('Catch it!'), p('Submitting a wrong word sends the word you meant into a plunge. Most plunges are brisk, some urgent, and now and then one is desperate. Catch it before it reaches the Ward to earn Saving Grace (Daring Rescue for the fastest). Another wrong submission on a plunging word makes it fall faster still. A wrong letter you fix with Backspace never causes a plunge.'),
        h3('Backspace'), p('Backspace un-inks letters from the paper and the scroll. Fixing a slip is always allowed; the slip itself still broke your Combo.'),
        h3('The Ward'), p('Scrolls that reach the bottom crack the Ward. At 0% you fall. Barrier layers stop breaches for a few seconds. Nothing heals the Ward during a run: Normal restores it at every checkpoint; Hardcore carries it through the apprenticeship with two small recoveries.'),
        h3('The Academy'), p('The Opening Trial comes first, with no spells. Then each apprenticeship teaches one spell, in this order: Slow, Barrier, Wind, Fire, Ice, Shock, Alter, Harvest, then the Final Examination with all eight. Clearing an apprenticeship’s Normal examination opens the next one and its optional Hardcore. Replaying an earlier apprenticeship keeps its difficulty, but every spell you have earned can drop there.'),
        h3('Normal and Hardcore'), p('In every mode, spells are cast by typing their names and pressing Enter. Normal adapts: it watches your pace, accuracy and how close scrolls get, and adds or eases pressure within each examination’s limits, so the field stays busy without becoming unfair. Hardcore is fixed: the same scrolls every attempt, no adaptation, more pressure, and the Ward carries through. A clean typed spell also earns Combo in Hardcore. It is meant for returning with more spells, and it never blocks progress.'),
        h3('One continuous examination'), p('Each apprenticeship is a single run in three phases: Learn (meet the spell and build momentum), Master (more frequent and overlapping pressure), and the Boss Examination, which builds to its climax in the final seconds. Nothing resets between them: your score, Combo and Arcane Rush carry through, and so does the field. Endless follows the boss if you wish; it never stops getting harder.'),
        h3('Difficulty'), p('The challenge is the battlefield: how many scrolls fall at once, how fast, and how close together they arrive. Easy to type, hard to keep up: the Opening Trial and the first apprenticeships use mostly two- and three-letter words, with the odd four-letter one, so captures, Combo and Arcane Rush come quickly. Longer words arrive gradually (6 and up by Harvest), and short words never disappear. Two scrolls on the field never share the same word. Pressure changes often: brief bursts every few seconds, bigger surges every half-minute or so, each followed by a short, kinder stretch that keeps words coming. Scrolls are spaced so two rarely reach the Ward at the same instant. Later apprenticeships start higher and fill the sky faster. In Normal and Endless the pressure also responds to how you are playing; the same seed and the same play still give exactly the same game. Every number behind this is an experimental prototype value.'),
        h3('Rune sequences'), p('Some Runes belong to spells. Casting opens that spell’s opportunity window; only what you type inside it counts. Casting alone never earns a Rune.'),
        p('Every number on this page is a prototype value.'),
      );
    } else if (tab === 'spells') {
      body = el('div', { class: 't-codex' }, ...SPELL_ORDER.map((id) => el('div', { class: 't-spellcard', style: `--hue:${SPELL_HUE[id]}` },
        el('span', { class: 't-spellglyph' }, SPELL_GLYPH[id]),
        el('div', null, el('h3', null, `${SPELLS[id].book.toUpperCase()} · type “${id}”`), el('p', null, SPELLS[id].description)))));
    } else if (tab === 'runes') {
      const have = prefs.data.runes;
      const groups = ['typing', 'wordplay', 'spellcraft', 'participation'] as const;
      const title = { typing: 'Typing mastery', wordplay: 'Wordplay', spellcraft: 'Spellcraft (rune sequences)', participation: 'Participation (comedic mishaps · always 0 points)' } as const;
      body = el('div', { class: 't-codex' }, ...groups.flatMap((g) => [
        h3(title[g]),
        el('div', { class: 't-runegrid' }, ...RUNES.filter((r) => r.category === g).map((r) => el('div', { class: `t-rune tier${r.tier}${have[r.id] ? ' got' : ''}` },
          el('img', { class: 't-medal', src: medalDataUrl(r), alt: '' }),
          el('strong', null, r.name), el('span', { class: 't-small' }, `${r.how}${r.points ? ` · +${r.points}` : ''}`),
          el('span', { class: 't-small' }, have[r.id] ? `Earned ×${have[r.id]}` : 'Not yet earned')))),
      ]), p('Runes observe real play; word generation is never bent to make them happen. Names, thresholds and points are provisional.'));
    } else {
      const pr = prefs.data;
      body = el('div', { class: 't-codex' }, el('div', { class: 't-runegrid' }, ...TRIUMPHS.map((t) => {
        const tier = tierOf(t, pr);
        const v = t.value(pr);
        const next = t.tiers[tier];
        const fmt = t.format ?? ((x: number) => Math.round(x).toLocaleString());
        return el('div', { class: `t-rune tier${Math.max(1, tier)}${tier ? ' got' : ''}` },
          el('strong', null, `${t.name}${tier ? ` · ${TIER_NAMES[tier - 1]}` : ''}`),
          el('span', { class: 't-small' }, t.what),
          el('span', { class: 't-small' }, next !== undefined ? `${fmt(v)} / ${fmt(next)}` : `${fmt(v)} · complete`));
      })), p('Triumphs are long-term milestones. Rewards for them are not designed yet.'));
    }
    this.show(this.panel('Codex', tabs, body, el('div', { class: 't-row' }, btn('Back', goBack))), { overlay: !!back, onKey: (e) => e.key === 'Escape' && goBack() });
  }

  // ───────────────────────── options ─────────────────────────

  private audioControls(): HTMLElement {
    const s = sound.settings;
    const row = (label: string, ch: keyof AudioSettings) => {
      const box = el('input', { type: 'checkbox', checked: s[ch].on }) as HTMLInputElement;
      const slider = el('input', { type: 'range', min: '0', max: '100', value: String(Math.round(s[ch].volume * 100)) }) as HTMLInputElement;
      box.addEventListener('change', () => sound.apply({ ...sound.settings, [ch]: { ...sound.settings[ch], on: box.checked } }));
      slider.addEventListener('input', () => sound.apply({ ...sound.settings, [ch]: { ...sound.settings[ch], volume: Number(slider.value) / 100 } }));
      return el('label', { class: 't-audio' }, box, el('span', null, label), slider);
    };
    return el('div', { class: 't-audiobox' }, row('Music', 'music'), row('Sound effects', 'sfx'), row('Grandmaster voice (placeholder babble)', 'voice'));
  }

  showOptions(): void {
    this.backdrop();
    const rm = el('input', { type: 'checkbox', checked: prefs.reducedMotion() }) as HTMLInputElement;
    rm.addEventListener('change', () => ((prefs.data.reducedMotion = rm.checked), prefs.save()));
    const ua = el('input', { type: 'checkbox', checked: prefs.data.unlockAll }) as HTMLInputElement;
    ua.addEventListener('change', () => ((prefs.data.unlockAll = ua.checked), prefs.save()));
    const caps = el('input', { type: 'checkbox', checked: prefs.data.spellCaps }) as HTMLInputElement;
    caps.addEventListener('change', () => ((prefs.data.spellCaps = caps.checked), prefs.save()));
    this.show(this.panel('Options',
      this.audioControls(),
      el('label', { class: 't-audio' }, rm, el('span', null, 'Reduced motion (no shakes, tilts or large bursts)')),
      el('label', { class: 't-audio' }, ua, el('span', null, 'Playtesting: unlock every apprenticeship, every Hardcore and every spell')),
      el('label', { class: 't-audio' }, caps, el('span', null, 'Experiment: per-spell bank caps (Slow 4, Barrier 2, Wind 2, Fire 3, Ice 2, Shock 2, Alter 2, Harvest 1)')),
      el('div', { class: 't-row' },
        btn('Back', () => this.showTitle(), 'primary'),
        btn('Reset prototype progress', () => {
          if (window.confirm('Reset all TypeL prototype progress, records and Runes?')) (prefs.reset(), this.showOptions());
        })),
      el('p', { class: 't-small' }, 'The Grandmaster speaks only when you earn a Rune. His voice is a placeholder babble until real recorded lines replace it; his words always appear as text in his speech bubble.'),
    ), { onKey: (e) => e.key === 'Escape' && this.showTitle() });
  }
}

const stat = (label: string, value: string) => el('div', { class: 't-stat' }, el('span', null, label), el('strong', null, value));
const h3 = (s: string) => el('h3', null, s);
const p = (s: string) => el('p', null, s);
