import type { DifficultyConfig } from '../difficulty/DifficultyConfig';
import { normalizeRoomCode, ROOM_CODE_LENGTH, type MatchEndMessage, type RoomInfo } from '../multiplayer/protocol';
import { formatTime, h, percent } from './dom';
import type { Screen } from './UIRoot';

// ───────────────────────── Connecting / errors ─────────────────────────

export function connectingScreen(onCancel: () => void): Screen {
  const cancel = h('button', { class: 'menu-button', onClick: onCancel }, 'Cancel');
  return {
    element: h(
      'section',
      { class: 'screen panel', attrs: { 'aria-live': 'polite' } },
      h('h2', { class: 'screen-title' }, 'Multiplayer'),
      h('p', { class: 'flavour' }, 'Connecting…'),
      h('div', { class: 'button-row' }, cancel),
    ),
    focus: cancel,
  };
}

export function offlineScreen(reason: string, url: string, onRetry: () => void, onBack: () => void): Screen {
  const retry = h('button', { class: 'menu-button primary', onClick: onRetry }, 'Try again');
  return {
    element: h(
      'section',
      { class: 'screen panel', attrs: { role: 'alert' } },
      h('h2', { class: 'screen-title' }, 'Server unavailable'),
      h('p', null, reason),
      h(
        'p',
        { class: 'footnote' },
        `Looking for the multiplayer server at ${url}. To run it on this computer, open a second terminal in the project folder and run: npm run server`,
      ),
      h('p', { class: 'footnote' }, 'Campaign and Endless Practice work without it.'),
      h(
        'div',
        { class: 'button-row' },
        retry,
        h('button', { class: 'menu-button', onClick: onBack }, 'Back'),
      ),
    ),
    focus: retry,
    onKey: (e) => {
      if (e.key === 'Escape') onBack();
    },
  };
}

// ───────────────────────── Lobby ─────────────────────────

export interface LobbyActions {
  onCreate(name: string, level: number): void;
  onJoin(name: string, code: string): void;
  onBack(): void;
}

function levelSelect(levels: readonly DifficultyConfig[], selected: number, id: string): HTMLSelectElement {
  const select = h('select', { class: 'field', attrs: { id } });
  for (const l of levels) {
    const option = h('option', { attrs: { value: String(l.level) } }, `Level ${l.level} · ${l.name}`);
    option.selected = l.level === selected;
    select.append(option);
  }
  return select;
}

/** Name + "create a room" or "join with a code" (GDD §17 multiplayer lobby). */
export function lobbyScreen(
  levels: readonly DifficultyConfig[],
  defaults: { name: string; level: number },
  error: string | null,
  actions: LobbyActions,
): Screen {
  const name = h('input', {
    class: 'field',
    attrs: { id: 'mp-name', maxlength: '16', autocomplete: 'nickname', placeholder: 'Your wizard name' },
  });
  name.value = defaults.name;
  const level = levelSelect(levels, defaults.level, 'mp-level');
  const code = h('input', {
    class: 'field code-input',
    attrs: {
      id: 'mp-code',
      maxlength: String(ROOM_CODE_LENGTH),
      autocomplete: 'off',
      spellcheck: 'false',
      placeholder: 'ABCD',
      'aria-label': 'Room code',
    },
  });
  code.addEventListener('input', () => (code.value = normalizeRoomCode(code.value)));

  const create = () => actions.onCreate(name.value, Number(level.value));
  const join = () => {
    if (normalizeRoomCode(code.value).length === ROOM_CODE_LENGTH) actions.onJoin(name.value, code.value);
    else code.focus();
  };
  code.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') join();
  });

  const element = h(
    'section',
    { class: 'screen panel lobby', attrs: { 'aria-labelledby': 'lobby-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'lobby-title' } }, 'Wizard Duel'),
    h('p', { class: 'screen-subtitle' }, 'Two wizards, the same words, the same speed. Last wards standing win.'),
    error && h('p', { class: 'form-error', attrs: { role: 'alert' } }, error),
    h('label', { class: 'field-label', attrs: { for: 'mp-name' } }, 'Your name'),
    name,
    h(
      'div',
      { class: 'lobby-columns' },
      h(
        'div',
        { class: 'lobby-box' },
        h('h3', null, 'Create a room'),
        h('label', { class: 'field-label', attrs: { for: 'mp-level' } }, 'Difficulty'),
        level,
        h('button', { class: 'menu-button primary', onClick: create }, 'Create room'),
      ),
      h(
        'div',
        { class: 'lobby-box' },
        h('h3', null, 'Join a room'),
        h('label', { class: 'field-label', attrs: { for: 'mp-code' } }, 'Room code'),
        code,
        h('button', { class: 'menu-button', onClick: join }, 'Join'),
      ),
    ),
    h('div', { class: 'button-row' }, h('button', { class: 'menu-button', onClick: actions.onBack }, 'Back')),
  );
  return {
    element,
    focus: defaults.name ? code : name,
    onKey: (e) => {
      if (e.key === 'Escape') actions.onBack();
    },
  };
}

// ───────────────────────── Room ─────────────────────────

export interface RoomActions {
  onReady(ready: boolean): void;
  onLevel(level: number): void;
  onLeave(): void;
}

export function roomScreen(
  room: RoomInfo,
  you: string,
  levels: readonly DifficultyConfig[],
  actions: RoomActions,
): Screen {
  const me = room.players.find((p) => p.id === you)!;
  const isHost = me.host;
  const full = room.players.length === 2;
  const level = levels[room.settings.level - 1]!;

  const ready = h(
    'button',
    { class: `menu-button${me.ready ? '' : ' primary'}`, onClick: () => actions.onReady(!me.ready), disabled: !full },
    me.ready ? 'Not ready' : full ? 'Ready!' : 'Waiting for opponent…',
  );

  let settings: HTMLElement;
  if (isHost) {
    const select = levelSelect(levels, room.settings.level, 'room-level');
    select.addEventListener('change', () => actions.onLevel(Number(select.value)));
    settings = h(
      'div',
      { class: 'room-settings' },
      h('label', { class: 'field-label', attrs: { for: 'room-level' } }, 'Difficulty (you are the host)'),
      select,
    );
  } else {
    settings = h('p', { class: 'room-settings' }, `Difficulty: Level ${level.level} · ${level.name} (chosen by the host)`);
  }

  const element = h(
    'section',
    { class: 'screen panel room', attrs: { 'aria-labelledby': 'room-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'room-title' } }, 'Duel Room'),
    h('p', { class: 'screen-subtitle' }, full ? 'Both wizards are here.' : 'Share this code with your opponent:'),
    h('p', { class: 'room-code', attrs: { 'aria-label': `Room code ${room.code.split('').join(' ')}` } }, room.code),
    h(
      'ul',
      { class: 'player-list' },
      ...room.players.map((p) =>
        h(
          'li',
          { class: p.ready ? 'is-ready' : '' },
          h('span', { class: 'player-name' }, p.name, p.id === you ? ' (you)' : '', p.host ? ' · host' : ''),
          h('span', { class: 'player-status' }, p.ready ? 'Ready' : 'Not ready'),
        ),
      ),
      !full && h('li', { class: 'empty-seat' }, h('span', null, 'Empty seat…')),
    ),
    settings,
    h('p', { class: 'footnote' }, `${level.initialFallSpeed} px/s · a word every ${(level.spawnInterval / 1000).toFixed(1)} s · spell scrolls on · 4-minute limit`),
    h(
      'div',
      { class: 'button-row' },
      ready,
      h('button', { class: 'menu-button', onClick: actions.onLeave }, 'Leave room'),
    ),
  );
  return {
    element,
    focus: full ? ready : null,
    onKey: (e) => {
      if (e.key === 'Escape') actions.onLeave();
    },
  };
}

// ───────────────────────── Duel menu (no pausing in a duel) ─────────────────────────

export function duelMenuScreen(onKeepFighting: () => void, onForfeit: () => void): Screen {
  const keep = h('button', { class: 'menu-button primary', onClick: onKeepFighting }, 'Keep fighting');
  return {
    element: h(
      'section',
      { class: 'screen panel', attrs: { role: 'dialog', 'aria-labelledby': 'duel-menu-title' } },
      h('h2', { class: 'screen-title', attrs: { id: 'duel-menu-title' } }, 'Duel in progress'),
      h('p', null, 'A duel cannot be paused — your words are still falling!'),
      h(
        'div',
        { class: 'menu-list' },
        keep,
        h('button', { class: 'menu-button', onClick: onForfeit }, 'Forfeit the duel'),
      ),
    ),
    focus: keep,
    onKey: (e) => {
      if (e.key === 'Escape') onKeepFighting();
    },
  };
}

// ───────────────────────── Results ─────────────────────────

const REASONS: Record<MatchEndMessage['reason'], string> = {
  collapse: 'Wards collapsed',
  'both-collapsed': 'Both wards fell at the same moment — decided by score',
  time: 'Time ran out — decided by score',
  forfeit: 'Forfeit',
};

export function duelResultScreen(
  end: MatchEndMessage,
  you: string,
  onRematch: () => void,
  onLeave: () => void,
): Screen {
  const outcome = end.winnerId === null ? 'draw' : end.winnerId === you ? 'won' : 'lost';
  const title = outcome === 'won' ? 'Victory!' : outcome === 'lost' ? 'Defeat' : 'A Draw';
  const ordered = [...end.results].sort((a) => (a.id === you ? -1 : 1));

  const row = (label: string, values: string[]) =>
    h('tr', null, h('th', { attrs: { scope: 'row' } }, label), ...values.map((v) => h('td', null, v)));

  const rematch = h('button', { class: 'menu-button primary', onClick: onRematch }, 'Back to room (rematch)');
  const element = h(
    'section',
    { class: `screen panel results ${outcome === 'lost' ? 'lost' : 'won'}`, attrs: { role: 'dialog', 'aria-labelledby': 'duel-title' } },
    h('h2', { class: 'screen-title', attrs: { id: 'duel-title' } }, title),
    h('p', { class: 'screen-subtitle' }, `${REASONS[end.reason]} · result checked by the server`),
    h(
      'table',
      { class: 'duel-table' },
      h(
        'thead',
        null,
        h('tr', null, h('th', null, ''), ...ordered.map((r) => h('th', { attrs: { scope: 'col' } }, r.id === you ? `${r.name} (you)` : r.name))),
      ),
      h(
        'tbody',
        null,
        row('Score', ordered.map((r) => r.stats.score.toLocaleString())),
        row('Words', ordered.map((r) => String(r.stats.completed))),
        row('Missed', ordered.map((r) => String(r.stats.missed))),
        row('Accuracy', ordered.map((r) => percent(r.stats.accuracy))),
        row('WPM', ordered.map((r) => String(Math.round(r.stats.wpm)))),
        row('Best combo', ordered.map((r) => `×${r.stats.maxCombo}`)),
        row('Instability', ordered.map((r) => `${Math.round(r.instability)}%`)),
        row('Time', ordered.map((r) => formatTime(r.stats.elapsedMs))),
      ),
    ),
    h(
      'div',
      { class: 'button-row' },
      rematch,
      h('button', { class: 'menu-button', onClick: onLeave }, 'Leave'),
    ),
  );
  return { element, focus: rematch };
}
