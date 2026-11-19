import type { GameScene } from '../scenes/GameScene';

/** Compact, optional touch controls. Never invokes the device's OS keyboard. */
export function installMobileKeyboard(scene: () => GameScene | null): void {
  const root = document.createElement('aside');
  root.id = 'mobile-keyboard';
  root.setAttribute('aria-label', 'Touch typing controls');
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'mobile-keyboard-toggle';
  toggle.textContent = '⌨ Keyboard';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'mobile-keyboard-keys');
  const keys = document.createElement('div');
  keys.id = 'mobile-keyboard-keys';
  keys.hidden = true;
  for (const line of ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']) {
    const row = document.createElement('div');
    row.className = 'mobile-keyboard-row';
    for (const char of line) {
      const key = document.createElement('button');
      key.type = 'button';
      key.className = 'mobile-key';
      key.textContent = char;
      key.setAttribute('aria-label', char);
      key.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        scene()?.pressMobileKey(char.toLowerCase());
      });
      row.append(key);
    }
    keys.append(row);
  }
  const actions = document.createElement('div');
  actions.className = 'mobile-keyboard-row mobile-keyboard-actions';
  for (const [label, code] of [['⌫', 'Backspace'], ['ENTER', 'Enter'], ['SUMMON', 'F2'], ['SPELL', 'F3'], ['PAUSE', 'Escape']] as const) {
    const key = document.createElement('button');
    key.type = 'button';
    key.className = 'mobile-key mobile-key-action';
    key.textContent = label;
    key.setAttribute('aria-label', code);
    key.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      scene()?.pressMobileKey(code);
    });
    actions.append(key);
  }
  keys.append(actions);
  const spells = document.createElement('div');
  spells.className = 'mobile-keyboard-row mobile-keyboard-spells';
  for (let i = 1; i <= 8; i++) {
    const key = document.createElement('button');
    key.type = 'button';
    key.className = 'mobile-key';
    key.textContent = String(i);
    key.setAttribute('aria-label', 'Spell slot ' + i);
    key.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      scene()?.pressMobileKey(String(i));
    });
    spells.append(key);
  }
  keys.append(spells);
  toggle.addEventListener('click', () => {
    keys.hidden = !keys.hidden;
    root.classList.toggle('is-open', !keys.hidden);
    toggle.setAttribute('aria-expanded', String(!keys.hidden));
    toggle.textContent = keys.hidden ? '⌨ Keyboard' : '⌨ Hide keyboard';
  });
  root.append(toggle, keys);
  document.body.append(root);
}
