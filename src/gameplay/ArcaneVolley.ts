/** Experimental Arcane Volley momentum chain. Only solo preview uses this.
 * Fixed simulation ticks; numbers are playtest knobs, not final design law.
 * No changes to word generation, spawn timing or difficulty progression.
 */
export interface ArcaneVolleyState {
  captures: number;
  lastTick: number | null;
  lastLetters: number;
}
export const emptyArcaneVolley = (): ArcaneVolleyState => ({captures:0,lastTick:null,lastLetters:0});
export function volleyWindowTicks(letters: number, hardcore: boolean): number {
  // 60 Hz simulation: a modest target-switch allowance plus time for the
  // word's actual length. Longer words must not be intrinsically penalized.
  return (hardcore ? 28 : 42) + Math.max(1,letters) * (hardcore ? 9 : 12);
}
export function arcaneVolleyCapture(state: ArcaneVolleyState, tick: number, letters: number, hardcore: boolean): ArcaneVolleyState {
  if (!Number.isInteger(tick) || tick < 0 || !Number.isInteger(letters) || letters < 1) throw new RangeError('invalid capture');
  const withinWindow = state.lastTick !== null && tick >= state.lastTick &&
    tick - state.lastTick <= volleyWindowTicks(letters,hardcore);
  return {captures:withinWindow ? state.captures+1 : 1,lastTick:tick,lastLetters:letters};
}
export function arcaneVolleyMultiplier(state: ArcaneVolleyState, tick: number, hardcore: boolean): number {
  if (state.lastTick === null || state.captures < 2) return 1;
  const gap = tick-state.lastTick;
  if (gap < 0) return 1;
  const window = volleyWindowTicks(state.lastLetters,hardcore);
  // Two windows of grace: fading momentum drops a step at a time rather
  // than abruptly deleting a hard-earned Surge. The next slow capture
  // starts a fresh chain; no banked momentum from idle time.
  const faded = gap <= window ? 0 : gap <= window*1.5 ? 1 : gap <= window*2 ? 2 : state.captures;
  // The first capture only arms a timing window; the second timely capture
  // earns ×1.2. A lone or late capture never earns Volley by itself.
  const n = Math.max(0,state.captures-faded-1);
  if (n === 0) return 1;
  // Kindle and sustained Surge: +0.2 per linked capture to ×5 (21 captures total).
  if (n <= 20) return Math.round((1+n*.2)*10)/10;
  // Soft cap at ×5: +0.1 per progressively harder step.
  let extra=n-20,steps=0;
  while (extra >= steps+2 && steps < 1000) {extra-=steps+2;steps++;}
  return Math.round((5+steps*.1)*10)/10;
}
export function arcaneVolleyPhase(multiplier: number): 'kindle'|'surge'|'mastery' {
  return multiplier < 2 ? 'kindle' : multiplier <= 5 ? 'surge' : 'mastery';
}
