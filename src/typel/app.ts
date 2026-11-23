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
import { WARD_TUNING } from '../gameplay/WardScar';
import {
  apprenticeshipEndless, apprenticeshipRun, BOSS_LEVEL, LEARN_CHECKPOINTS, learnedSpells, sandboxRunConfig, SPELL_ORDER, startingCharges, TRIALS,
  type Mode, type StartPhase, type Trial,
} from './apprenticeship';
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
      el('p', { class: 't-tagline' }, 'An arcane typing apprenticeship'),
      el('nav', { class: 't-menu' },
        btn('Apprenticeship', () => this.showApprenticeship(), 'primary'),
        btn('Typing Trials', () => this.showTypingSetup()),
        btn('Sandbox', () => this.showSandboxSetup()),
        btn('Codex', () => this.showCodex('rules')),
        btn('Options', () => this.showOptions()),
      ),
      el('p', { class: 't-foot' }, 'Prototype · art cut from the key-art reference · placeholder music and voice · nothing here is final'),
    );
    this.show(menu);
  }

  // ───────────────────────── apprenticeship ─────────────────────────

  showApprenticeship(): void {
    this.backdrop();
    const done = new Set(prefs.data.completed[this.mode]);
    const saved = loadRun();
    const list = el('div', { class: 't-trials' });
    for (const t of TRIALS) {
      const pick = el('select', { class: 't-levelpick', 'aria-label': `Start ${t.title} at phase` },
        el('option', { value: 'learn' }, 'From Learn'), el('option', { value: 'master' }, 'From Master'), el('option', { value: 'boss' }, 'Boss only'));
      const best = prefs.data.bestTrialScore[recordKey(this.mode, t.index)];
      list.append(
        el('article', { class: `t-trial${done.has(t.index) ? ' done' : ''}`, style: t.spell ? `--hue:${SPELL_HUE[t.spell]}` : '--hue:#d9a441' },
          el('div', { class: 't-trial-glyph' }, t.spell ? SPELL_GLYPH[t.spell] : '✶'),
          el('div', { class: 't-trial-body' },
            el('h3', null, `${t.index}. ${t.title}`),
            el('p', null, `${t.master}${t.spell ? ` · learn ${t.spell.toUpperCase()}` : ' · every spell'} · boss: ${t.bossName}`),
            el('p', { class: 't-small' }, done.has(t.index) ? `Completed ✓ · best ${best?.toLocaleString() ?? '—'}` : best ? `Best ${best.toLocaleString()}` : 'Not yet completed'),
          ),
          el('div', { class: 't-trial-go' }, btn(done.has(t.index) ? 'Replay' : 'Begin', () => this.beginTrial(t.index, pick.value as StartPhase), 'primary small'), pick),
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
          ? 'Normal teaches: number keys 1–8 cast, and the Ward is restored at every checkpoint.'
          : 'Hardcore expects mastery: spells are typed, the Ward and its scars carry through the whole apprenticeship. (Unlocked for testing; it will require Normal.)'),
      ),
      list,
      el('p', { class: 't-small' }, 'Each apprenticeship is one continuous examination: Learn, then Master, then the Boss Examination, then Endless if you wish. Score, Combo and Arcane Rush carry all the way through. Your run is saved at every checkpoint. All unlocked for testing; the phase picker is a testing tool.'),
      el('div', { class: 't-row' }, btn('Back', () => this.showTitle())),
    ), { onKey: (e) => e.key === 'Escape' && this.showTitle() });
  }

  private beginTrial(index: number, start: StartPhase = 'learn'): void {
    const trial = TRIALS[index - 1]!;
    clearRun();
    this.run = { mode: this.mode, trial: index, start, seed: Math.floor(Math.random() * 2 ** 31), endless: false, fell: false };
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
    this.run = { mode: saved.mode, trial: saved.trial, start: saved.start, seed: saved.seed, endless: false, fell };
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
    const plan = apprenticeshipRun(run.mode, run.trial, run.start);
    const short = trial.title.replace(/^The Apprenticeship of /, '');
    this.clearUi();
    this.startPlay({
      config: plan.segments[0]!.config,
      run: plan,
      seed: run.seed,
      resume: resume ? { commands: resume.commands, tick: resume.tick } : undefined,
      hardcore: run.mode === 'hardcore',
      initialSpells: startingCharges(trial),
      spells: learnedSpells(run.trial),
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
        ruleset: RUN_RULESET, mode: run.mode, trial: run.trial, start: run.start, seed: run.seed,
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
    const checkpoints = apprenticeshipRun(run.mode, run.trial, run.start).segments.length;
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
            el('div', null, el('h3', null, 'Flawless Perfection'), el('p', null, `The Grand Wizard: “${SPECIAL.flawlessPerfection.text}”`)))
        : null,
      el('div', { class: 't-bigscore' }, stats.score.toLocaleString(), isBest ? el('span', { class: 't-best' }, ' new best') : null),
      el('div', { class: 't-stats' }, stat('Scrolls', String(stats.completed)), stat('Peak Rush', `×${(stats.peakArcaneVolleyMultiplier ?? 1).toFixed(1)}`), stat('Best Combo', String(stats.maxCombo)), stat('Accuracy', `${Math.round(stats.accuracy * 100)}%`)),
      runeText.length ? el('p', { class: 't-runes' }, `Runes this apprenticeship: ${runeText.join(' · ')}`) : null,
      el('div', { class: 't-row' },
        btn('Enter Endless', () => this.enterEndless(), 'primary'),
        nextTrial ? btn(`Next: ${nextTrial.title}`, () => this.beginTrial(nextTrial.index)) : null,
        btn('Apprenticeship', () => this.showApprenticeship())),
      el('p', { class: 't-small' }, 'Endless continues this exact field, score and Combo, and it never stops getting harder.'),
    ), { overlay: true });
  }

  private enterEndless(): void {
    const run = this.run!;
    run.endless = true;
    this.clearUi();
    this.play.continueEndless(apprenticeshipEndless(run.mode, run.trial), `Endless · ${TRIALS[run.trial - 1]!.title}`);
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
      el('div', { class: 't-stats' }, stat('Scrolls', String(stats.completed)), stat('Accuracy', `${Math.round(stats.accuracy * 100)}%`), stat('Peak Rush', `×${(stats.peakArcaneVolleyMultiplier ?? 1).toFixed(1)}`), stat('Wagers', String(stats.allInWagers ?? 0))),
      el('div', { class: 't-row' }, btn('Apprenticeship', () => this.showApprenticeship(), 'primary'), btn('Title', () => this.showTitle())),
    ), { overlay: true });
  }

  private pauseMenu(restart: () => void): void {
    const resume = () => {
      this.clearUi();
      this.play.resume();
    };
    this.show(this.panel('Paused',
      el('div', { class: 't-menu' },
        btn('Resume', resume, 'primary'),
        btn('Restart', () => restart()),
        btn('Codex (rules)', () => this.showCodex('rules', () => this.pauseMenu(restart))),
        btn('Leave', () => (this.run ? this.showApprenticeship() : this.showTitle()))),
      this.audioControls(),
    ), { overlay: true, onKey: (e) => e.key === 'Escape' && resume() });
  }

  // ───────────────────────── sandbox ─────────────────────────

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
      lines: [{ who: 'The Grand Wizard', text: 'Here nothing is at stake. Experiment. Combine. Break things.' }],
      onPause: () => this.pauseMenu(() => this.startSandbox()),
      onEnd: (_r, stats) => this.show(this.panel('Sandbox results',
        el('div', { class: 't-bigscore' }, stats.score.toLocaleString()),
        el('div', { class: 't-stats' },
          stat('Peak Rush', `×${(stats.peakArcaneVolleyMultiplier ?? 1).toFixed(1)}`), stat('Wagers', String(stats.allInWagers ?? 0)),
          stat('All-In points', String(stats.allInPoints ?? 0)), stat('Harvests in All-In', String(stats.allInHarvests ?? 0)),
          stat('Runes', String(Object.values(stats.runeCounts ?? {}).reduce((a, b) => a + b, 0))), stat('Ward max', `${stats.wardCap ?? 100}%`)),
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
        h3('Score'), p('Each captured word pays letters × 10 × Combo × Arcane Rush × All-In, rounded once. Runes pay small fixed points on top. Nothing else multiplies your score.'),
        p('In the Apprenticeship the machine shows your total and each word’s base, Combo and Rush, but never the exact points a single capture earned: that stays a mystery. The Sandbox shows them for practice.'),
        h3('Precision Combo'), p('Every perfectly typed capture adds 1 (Ice Focus adds more). Every 10 Combo raises the multiplier by ×1. A typo, a wrong Enter or a missed word breaks it. A Barrier layer can save it from one slip you correct.'),
        h3('Arcane Rush'), p('Your flow state (called Arcane Volley in older notes). Your first perfect capture opens a timing window (the gold bar on the Rush column); a second inside it starts the Rush at ×1.2. Keep capturing in time and it climbs +0.2 per capture to ×5 (Mastery), then +0.1 per ever-harder step. Longer words get longer windows. An empty field pauses the window. Slow gives it 25% more time. Harvest spends it.'),
        h3('Catch it!'), p('Submitting a wrong word sends the word you meant into a plunge. Most plunges are brisk, some urgent, and now and then one is desperate. Catch it before it reaches the Ward to earn Saving Grace (Daring Rescue for the fastest). Another wrong submission on a plunging word makes it fall faster still. A wrong letter you fix with Backspace never causes a plunge.'),
        h3('Backspace'), p('Backspace un-inks letters from the paper and the scroll. Fixing a slip is always allowed; the slip itself still broke your Combo unless a Barrier layer caught it.'),
        h3('The Ward'), p(`Words that reach the bottom crack the Ward. At 0% you fall. Wind at your Ward’s current maximum goes All-In: the Ward drops to ${WARD_TUNING.wagerStability}%, its maximum is scarred (−${WARD_TUNING.firstScar}, then ${WARD_TUNING.scarGrowth} more each time), and for ${WARD_TUNING.allInTicks / 60} seconds your score is ×${WARD_TUNING.allInMultiplier}. Healing never rises above the scar. A breach ends All-In; in Hardcore any slip does.`),
        h3('Normal and Hardcore'), p('Normal: number keys 1–8 cast, and the Ward is restored at every checkpoint of the apprenticeship. Hardcore: spells are typed (a clean typed spell earns Combo and points); the Ward and its scars carry through the whole apprenticeship, with small recoveries at two checkpoints. Hardcore starts under more pressure, builds it faster and recovers less.'),
        h3('One continuous examination'), p('Each apprenticeship is a single run in three phases: Learn (meet the spell and build momentum), Master (more frequent and overlapping pressure), and the Boss Examination, which builds to its climax in the final seconds. Nothing resets between them: your score, Combo and Arcane Rush carry through, and so does the field. Endless follows the boss if you wish; it never stops getting harder.'),
        h3('Difficulty'), p('Every apprenticeship has its own familiar range of word lengths (about 3–6 letters in the Apprenticeship of Time, 6 and up by Harvest), with the occasional longer or shorter word. Words vary in length and speed together: short and slow give you room, long and slow test precision, short and fast test reactions, long and fast are the spikes. Pressure changes often: brief pressure moments every few seconds, bigger surges every half-minute or so, each followed by a short, kinder stretch that keeps words coming. Later apprenticeships start higher. Nothing watches how well you type: the same seed and the same play give the same game. Every number behind this is an experimental prototype value.'),
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
    return el('div', { class: 't-audiobox' }, row('Music', 'music'), row('Sound effects', 'sfx'), row('Grand Wizard voice (placeholder babble)', 'voice'));
  }

  showOptions(): void {
    this.backdrop();
    const rm = el('input', { type: 'checkbox', checked: prefs.reducedMotion() }) as HTMLInputElement;
    rm.addEventListener('change', () => ((prefs.data.reducedMotion = rm.checked), prefs.save()));
    this.show(this.panel('Options',
      this.audioControls(),
      el('label', { class: 't-audio' }, rm, el('span', null, 'Reduced motion (no shakes, tilts or large bursts)')),
      el('div', { class: 't-row' },
        btn('Back', () => this.showTitle(), 'primary'),
        btn('Reset prototype progress', () => {
          if (window.confirm('Reset all TypeL prototype progress, records and Runes?')) (prefs.reset(), this.showOptions());
        })),
      el('p', { class: 't-small' }, 'The Grand Wizard speaks only when you earn a Rune. His voice is a placeholder babble until real recorded lines replace it; his words always appear as text in his speech bubble.'),
    ), { onKey: (e) => e.key === 'Escape' && this.showTitle() });
  }
}

const stat = (label: string, value: string) => el('div', { class: 't-stat' }, el('span', null, label), el('strong', null, value));
const h3 = (s: string) => el('h3', null, s);
const p = (s: string) => el('p', null, s);
