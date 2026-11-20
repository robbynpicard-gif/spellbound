/** Fixed-tick sustained Volley: only clean captured words count.
 * A minimum of three captures across at least 0.8 seconds prevents a single
 * instant burst from granting a full multiplier. Window: five seconds.
 */
export interface FlowCapture { tick: number; letters: number }
export const FLOW_WINDOW_TICKS = 300;
export function sustainedVolleyMultiplier(captures: readonly FlowCapture[], tick: number, hardcore: boolean): number {
  const recent = captures.filter((c) => c.tick <= tick && tick - c.tick <= FLOW_WINDOW_TICKS);
  if (recent.length < 3) return 1;
  const elapsed = recent[recent.length - 1]!.tick - recent[0]!.tick;
  if (elapsed < 48) return 1;
  // Pace from the words completed after the first timestamp (the first capture
  // establishes the start of the window and must not count as instant typing).
  const letters = recent.slice(1).reduce((n, c) => n + c.letters, 0);
  const wpm = letters * 12 * 60 / elapsed;
  const thresholds = hardcore ? [75, 100, 130] : [55, 75, 100];
  if (wpm >= thresholds[2]!) return 3;
  if (wpm >= thresholds[1]!) return 2;
  if (wpm >= thresholds[0]!) return 1.5;
  return 1;
}
