/** A full-screen HTML panel shown over the game canvas. */
export interface Screen {
  element: HTMLElement;
  /** Element to focus when shown (for keyboard players). */
  focus?: HTMLElement | null;
  /** Optional key handler while this screen is showing (e.g. Esc = back). */
  onKey?: (event: KeyboardEvent) => void;
}

/**
 * Owns the HTML layer above the Phaser canvas (decisions.md D-008).
 * Shows one screen at a time; with no screen, the layer is empty and
 * lets clicks through to the game.
 */
export class UIRoot {
  private current: Screen | null = null;

  constructor(private readonly root: HTMLElement) {
    document.addEventListener('keydown', (event) => this.current?.onKey?.(event));
  }

  get showing(): boolean {
    return this.current !== null;
  }

  show(screen: Screen): void {
    this.current = screen;
    this.root.replaceChildren(screen.element);
    this.root.classList.add('is-active');
    (screen.focus ?? screen.element.querySelector<HTMLElement>('button:not([disabled])'))?.focus({
      preventScroll: true,
    });
  }

  clear(): void {
    this.current = null;
    this.root.replaceChildren();
    this.root.classList.remove('is-active');
    // Return focus to the page so game keystrokes don't activate buttons.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }
}
