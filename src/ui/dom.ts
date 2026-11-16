/**
 * Tiny helper for building DOM elements in code. Text is always set as text
 * (never parsed as HTML), so no markup injection is possible.
 */
export type Child = Node | string | number | null | undefined | false;

export interface Props {
  class?: string;
  /** Extra attributes, e.g. { 'aria-label': 'Back' }. */
  attrs?: Record<string, string>;
  onClick?: (event: Event) => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    if (props.class) el.className = props.class;
    if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) el.setAttribute(k, v);
    if (props.onClick) el.addEventListener('click', props.onClick);
    if (el instanceof HTMLButtonElement) {
      el.type = props.type ?? 'button';
      if (props.disabled) el.disabled = true;
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

/** Formats milliseconds as m:ss. */
export function formatTime(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export const percent = (fraction: number): string => `${Math.round(fraction * 100)}%`;
