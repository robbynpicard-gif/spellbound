import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * D-107 / D-108 / D-111: during TypeL gameplay, typing is the only input.
 * The play scene is a Phaser scene (hard to drive in unit tests), so these
 * checks guard its source against non-typing input paths coming back.
 */
const scene = readFileSync(new URL('../src/typel/render/PlayScene.ts', import.meta.url), 'utf8');

describe('TypeL gameplay input is typing only', () => {
  it('has no number-key spell casting', () => {
    expect(scene).not.toMatch(/quickCast\s*\(/);
    expect(scene).not.toMatch(/\[1-8\]/);
  });

  it('has no clicking or pointer input during play', () => {
    expect(scene).not.toMatch(/setInteractive\s*\(/);
    expect(scene).not.toMatch(/gameobjectdown|pointerdown|pointerup/);
    expect(scene).not.toMatch(/selectTarget\s*\(/);
  });

  it('still casts and captures through the typed console', () => {
    expect(scene).toMatch(/this\.engine\.submit\(\)/);
    expect(scene).toMatch(/this\.engine\.typeChar\(/);
  });
});
