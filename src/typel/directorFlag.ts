/**
 * Development feature flag for the Difficulty Director (D-097 prototype).
 *
 * Off by default: the classic difficulty stays the baseline for comparison.
 * Turn it on in Options or the Sandbox, or with `?director=1` in the preview
 * URL (`?director=0` turns it off). The choice is remembered per browser
 * under its own key, so it never touches progress saves.
 */
const KEY = 'typel.preview.difficultyDirector';

function fromUrl(): boolean | null {
  try {
    const value = new URLSearchParams(globalThis.location?.search ?? '').get('director');
    if (value === '1' || value === 'on' || value === 'true') return true;
    if (value === '0' || value === 'off' || value === 'false') return false;
  } catch {
    /* no URL in this environment */
  }
  return null;
}

function stored(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

let enabled = stored();
const urlChoice = fromUrl();
if (urlChoice !== null) setDirectorEnabled(urlChoice);

export function directorEnabled(): boolean {
  return enabled;
}

export function setDirectorEnabled(on: boolean): void {
  enabled = on;
  try {
    globalThis.localStorage?.setItem(KEY, on ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
}

/** Short label for menus and banners. */
export const difficultyLabel = () => (enabled ? 'Director (experimental)' : 'Classic');
