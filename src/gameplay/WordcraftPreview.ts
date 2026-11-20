/** Explicit, session-scoped URL opt-in for the development preview only.
 * Never activate on production or in Wizard Duels. */
export function previewWordcraftEnabled(pathname?: string, search?: string): boolean {
  const path = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  const query = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  // GitHub Pages preview is /spellbound/preview/; local preview builds may
  // use /preview/. No matching production root path is accepted.
  if (!/(?:^|\/)preview(?:\/|$)/.test(path)) return false;
  return new URLSearchParams(query).get('wordcraft') === '1';
}

/** URL-only toggle; never stores a setting or activates outside preview. */
export function setPreviewWordcraftEnabled(enabled: boolean): boolean {
  if (typeof window === 'undefined' || !window.location.pathname.split('/').includes('preview')) return false;
  const url = new URL(window.location.href);
  if (enabled) url.searchParams.set('wordcraft', '1');
  else url.searchParams.delete('wordcraft');
  window.history.replaceState(window.history.state, '', url.toString());
  return previewWordcraftEnabled();
}
