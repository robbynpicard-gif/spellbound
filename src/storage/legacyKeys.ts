/**
 * One-time browser-storage migration for the rename to TypeL (D-099).
 *
 * Earlier builds saved under `spellbound.*` and `wizzytype.*` keys (and the
 * preview under `spellbound.preview.*`). Every such key is copied to the same
 * name with the old brand replaced by `typel`, unless a TypeL key already
 * exists. Old keys are left in place so an older build still finds its save.
 *
 * Imported first in main.ts, so it runs before anything reads storage.
 */
const OLD_BRANDS = /spellbound|wizzytype/g;

export function migrateLegacyStorageKeys(storage: Storage | null): number {
  if (!storage) return 0;
  let copied = 0;
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k) keys.push(k);
    }
    for (const oldKey of keys) {
      const newKey = oldKey.replace(OLD_BRANDS, 'typel');
      if (newKey === oldKey || storage.getItem(newKey) !== null) continue;
      const value = storage.getItem(oldKey);
      if (value === null) continue;
      storage.setItem(newKey, value);
      copied++;
    }
  } catch {
    // Storage blocked or full: the game still runs, just without the old save.
  }
  return copied;
}

function localStorageOrNull(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

migrateLegacyStorageKeys(localStorageOrNull());
