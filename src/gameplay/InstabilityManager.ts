export const INSTABILITY_MAX = 100;

/**
 * Visual stage of the tower's wards (GDD §8):
 * 0 stable · 1 minor disturbances · 2 increasing instability · 3 critical · 4 collapsed.
 */
export type InstabilityStage = 0 | 1 | 2 | 3 | 4;

export function instabilityStage(value: number): InstabilityStage {
  if (value >= 100) return 4;
  if (value >= 75) return 3;
  if (value >= 50) return 2;
  if (value >= 25) return 1;
  return 0;
}

/** Tracks the tower's instability, clamped to 0–100. */
export class InstabilityManager {
  private current = 0;

  get value(): number {
    return this.current;
  }

  get stage(): InstabilityStage {
    return instabilityStage(this.current);
  }

  get collapsed(): boolean {
    return this.current >= INSTABILITY_MAX;
  }

  add(amount: number): number {
    this.current = Math.min(INSTABILITY_MAX, Math.max(0, this.current + amount));
    return this.current;
  }
}
