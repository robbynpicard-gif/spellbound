import { describe, expect, it } from 'vitest';
import { sustainedVolleyMultiplier } from './SustainedVolley';

describe('fixed-tick sustained Volley for Normal and Hardcore', () => {
  it('does not activate from one fast word or an instantaneous burst', () => {
    expect(sustainedVolleyMultiplier([{tick:10,letters:8}],10,false)).toBe(1);
    expect(sustainedVolleyMultiplier([{tick:10,letters:5},{tick:11,letters:5},{tick:12,letters:5}],12,false)).toBe(1);
  });
  it('awards easier tiers in Normal and higher thresholds in Hardcore', () => {
    const captures = [{tick:0,letters:5},{tick:60,letters:5},{tick:120,letters:5}];
    expect(sustainedVolleyMultiplier(captures,120,false)).toBe(1.5);
    expect(sustainedVolleyMultiplier(captures,120,true)).toBe(1);
  });
  it('expires after a pause and handles mixed word lengths', () => {
    const captures = [{tick:0,letters:4},{tick:60,letters:8},{tick:120,letters:7}];
    expect(sustainedVolleyMultiplier(captures,120,false)).toBe(2);
    expect(sustainedVolleyMultiplier(captures,450,false)).toBe(1);
  });
  it('does not depend on frame rate or mutate captures', () => {
    const captures = Object.freeze([{tick:0,letters:5},{tick:60,letters:6},{tick:120,letters:6}].map(Object.freeze));
    expect(sustainedVolleyMultiplier(captures,120,false)).toBe(sustainedVolleyMultiplier(captures,120,false));
  });
});
