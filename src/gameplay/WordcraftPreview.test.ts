import { describe, expect, it } from 'vitest';
import { previewWordcraftEnabled } from './WordcraftPreview';

describe('preview-only Wordcraft experiment gate', () => {
  it('requires both a preview path and an explicit opt-in', () => {
    expect(previewWordcraftEnabled('/spellbound/preview/', '?wordcraft=1')).toBe(true);
    expect(previewWordcraftEnabled('/preview/', '?wordcraft=1')).toBe(true);
    expect(previewWordcraftEnabled('/spellbound/preview/', '')).toBe(false);
    expect(previewWordcraftEnabled('/spellbound/', '?wordcraft=1')).toBe(false);
    expect(previewWordcraftEnabled('/', '?wordcraft=1')).toBe(false);
    expect(previewWordcraftEnabled('/spellbound/preview/', '?wordcraft=0')).toBe(false);
    expect(previewWordcraftEnabled('/spellbound/previewed/', '?wordcraft=1')).toBe(false);
  });
});
