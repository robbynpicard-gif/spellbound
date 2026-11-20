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
