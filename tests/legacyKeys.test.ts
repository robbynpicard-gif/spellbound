import { describe, expect, it } from 'vitest';
import { migrateLegacyStorageKeys } from '../src/storage/legacyKeys';

class MemoryStorage {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}

describe('TypeL rename storage migration', () => {
  it('copies Spellbound and Wizzy Type keys to TypeL keys', () => {
    const s = new MemoryStorage();
    s.setItem('wizzytype.save', 'A');
    s.setItem('spellbound.preview.wizzytype.save', 'B');
    s.setItem('spellbound.dev.apprenticeship.v1', 'C');
    s.setItem('unrelated', 'D');
    expect(migrateLegacyStorageKeys(s as unknown as Storage)).toBe(3);
    expect(s.getItem('typel.save')).toBe('A');
    expect(s.getItem('typel.preview.typel.save')).toBe('B');
    expect(s.getItem('typel.dev.apprenticeship.v1')).toBe('C');
    expect(s.getItem('wizzytype.save')).toBe('A');
  });

  it('never overwrites an existing TypeL key', () => {
    const s = new MemoryStorage();
    s.setItem('typel.save', 'new');
    s.setItem('wizzytype.save', 'old');
    migrateLegacyStorageKeys(s as unknown as Storage);
    expect(s.getItem('typel.save')).toBe('new');
  });
});
