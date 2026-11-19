import { describe, expect, it } from 'vitest';
import { stageLevel, endlessConfig } from '../src/difficulty/Stages';
import { WORDS } from '../src/data/wordList';
import { wordComplexity, WordGenerator } from '../src/gameplay/WordGenerator';
import { SeededRandom } from '../src/core/Random';
import { GameEngine } from '../src/core/GameEngine';

const SEEDS = [1, 17, 42, 99, 2026];
const SAMPLES = 300;
const modes = ['normal', 'hardcore'] as const;

describe('deterministic campaign population audit', () => {
  it('samples all 200 levels across five seeds and reports outliers', () => {
    const outliers: string[] = [];
    const summaries: string[] = [];
    for (const mode of modes) for (let stage = 1; stage <= 5; stage++) {
      const lengths = new Map<number, number>();
      let total = 0;
      let eligibleMin = Infinity;
      let unique = new Set<string>();
      let repeatWithin8 = 0;
      for (let level = 1; level <= 20; level++) {
        const config = stageLevel(mode, stage, level);
        const eligible = WORDS.filter(w => w.length >= config.minWordLength &&
          w.length <= config.maxWordLength &&
          (config.maxComplexity == null || wordComplexity(w) <= config.maxComplexity));
        eligibleMin = Math.min(eligibleMin, eligible.length);
        if (eligible.length < 30) outliers.push(`${mode} stage ${stage} level ${level}: only ${eligible.length} eligible words`);
        const observed: string[] = [];
        for (const seed of SEEDS) {
          const generator = new WordGenerator(WORDS, config, new SeededRandom(seed + level * 1000));
          const recent: string[] = [];
          for (let i = 0; i < SAMPLES; i++) {
            const word = generator.next().toLowerCase();
            observed.push(word);
            unique.add(word);
            lengths.set(word.length, (lengths.get(word.length) ?? 0) + 1);
            total++;
            if (recent.includes(word)) repeatWithin8++;
            recent.push(word);
            if (recent.length > 8) recent.shift();
          }
        }
        const signature = mode === 'normal' ? stage + 2 : stage + 3;
        const main = observed.filter(w => w.length === signature).length / observed.length;
        if (main < 0.30 && level <= 9) outliers.push(`${mode} stage ${stage} level ${level}: signature ${signature} share ${(main*100).toFixed(1)}%`);
      }
      const distribution = [...lengths].sort((a,b)=>a[0]-b[0]).map(([n,v])=>`${n}:${(100*v/total).toFixed(1)}%`).join(' ');
      summaries.push(`${mode} stage ${stage}: eligible minimum=${eligibleMin}, unique=${unique.size}, repeat<=8=${repeatWithin8}/${total}, lengths ${distribution}`);
    }
    console.log('CAMPAIGN AUDIT\\n' + summaries.join('\\n'));
    console.log('CAMPAIGN OUTLIERS\\n' + (outliers.join('\\n') || 'none'));
    expect(outliers).toEqual([]);
  }, 120_000);

  it('keeps Endless finite and monotonically escalating across 1000 captures', () => {
    for (const mode of modes) for (let stage = 1; stage <= 5; stage++) {
      const config = endlessConfig(mode, stage);
      const engine = new GameEngine({ config, seed: 17, words: WORDS });
      let last = 0;
      for (let captured = 0; captured <= 1000; captured += 25) {
        (engine.state as { completed: number }).completed = captured;
        const pace = engine.pace;
        expect(Number.isFinite(pace.fallSpeed)).toBe(true);
        expect(Number.isFinite(pace.spawnInterval)).toBe(true);
        expect(pace.spawnInterval).toBeGreaterThan(0);
        expect(pace.fallSpeed).toBeGreaterThanOrEqual(last);
        last = pace.fallSpeed;
      }
    }
  });
});
