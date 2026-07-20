// reducer.js — notification state transitions, as a pure function.
//
// Deliberately React-free so the reconcile rules can be tested directly
// under `node --test` (this repo has no React test renderer). The
// provider in store.jsx is a thin useReducer shell over this.
//
// THE INVARIANT, which is the whole correctness story:
//
//   The socket never sets truth it cannot prove. A `notification` frame
//   prepends and bumps the badge locally; an `unread_count` frame sets
//   the badge. But a RESYNC (REST) OVERWRITES both, unconditionally.
//   Redis pub/sub fan-out is fire-and-forget and unordered — a frame can
//   be dropped, duplicated, or arrive after the REST read that already
//   included it. So on every transition to `open` we resync, and where
//   the socket and REST disagree, REST wins.

import { SEVERITY, SOCKET_STATUS, isToastWorthy } from "./constants.js";

// Never let the toast stack grow without bound; past the cap the overflow
// collapses into a single "+N" row (see selectToasts).
export const MAX_TOASTS = 3;

export const initialState = {
  socketStatus: SOCKET_STATUS.CLOSED,
  // Version skew: the server negotiated a subprotocol we do not speak.
  // Fatal and non-retryable — the UI must ask for a refresh.
  protocolMismatch: false,
  lastError: null,

  unreadCount: 0,
  feed: { items: [], cursor: null, loading: false, exhausted: false, error: null },
  toasts: [],

  preferences: {
    matrix: {},
    quietHours: { start: null, end: null },
    timezone: null,
    digestHour: 8,
    loaded: false,
    loading: false,
    saving: false,
    error: null,
  },
};

// Newest first, de-duplicated by id. Used everywhere a merge happens so
// at-least-once delivery cannot produce a doubled row.
function mergeById(existing, incoming) {
  const seen = new Set();
  const out = [];
  for (const item of [...incoming, ...existing]) {
    if (!item || !item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export function reducer(state, action) {
  switch (action.type) {
    // ── socket lifecycle ──────────────────────────────────────────
    case "socket/status":
      return { ...state, socketStatus: action.status };

    case "socket/protocolMismatch":
      // Terminal. Reconnecting would negotiate the same wrong version.
      return {
        ...state,
        protocolMismatch: true,
        socketStatus: SOCKET_STATUS.CLOSED,
      };

    case "socket/error":
      return { ...state, lastError: action.error || null };

    // ── live frames (provisional) ─────────────────────────────────
    case "live/notification": {
      const item = action.notification;
      if (!item || !item.id) return state;
      const known = state.feed.items.some((i) => i.id === item.id);
      const items = mergeById(state.feed.items, [item]);
      return {
        ...state,
        feed: { ...state.feed, items },
        // Trust the server's count when the frame carries one; fall back
        // to a local bump only for a genuinely new unread row.
        unreadCount: Number.isFinite(action.unreadCount)
          ? action.unreadCount
          : state.unreadCount + (known || item.read_at ? 0 : 1),
        toasts:
          isToastWorthy(item.severity) && !known
            ? [...state.toasts, item]
            : state.toasts,
      };
    }

    case "live/unreadCount":
      if (!Number.isFinite(action.count)) return state;
      return { ...state, unreadCount: action.count };

    case "live/readAck": {
      // The server confirmed a mark-read (possibly from another tab).
      const items = state.feed.items.map((i) =>
        i.id === action.notificationId && !i.read_at
          ? { ...i, read_at: action.readAt || new Date().toISOString() }
          : i,
      );
      return {
        ...state,
        feed: { ...state.feed, items },
        unreadCount: Number.isFinite(action.unreadCount) ? action.unreadCount : state.unreadCount,
        toasts: state.toasts.filter((t) => t.id !== action.notificationId),
      };
    }

    // ── REST resync (authoritative) ───────────────────────────────
    case "resync/start":
      return { ...state, feed: { ...state.feed, loading: true, error: null } };

    case "resync/done": {
      // OVERWRITES. The first REST page is the newest truth, so it
      // replaces the head of the feed rather than merging under it —
      // that is what repairs a badge left stale by a dropped frame.
      const items = mergeById(state.feed.items, action.items || []);
      return {
        ...state,
        unreadCount: Number.isFinite(action.unreadCount) ? action.unreadCount : state.unreadCount,
        feed: {
          ...state.feed,
          items,
          cursor: action.cursor ?? null,
          exhausted: !action.cursor,
          loading: false,
          error: null,
        },
        // A resync proves what is unread; toasts for rows that turn out
        // to be already read elsewhere are stale and get dropped.
        toasts: state.toasts.filter((t) => {
          const fresh = (action.items || []).find((i) => i.id === t.id);
          return !fresh || !fresh.read_at;
        }),
      };
    }

    case "resync/error":
      return {
        ...state,
        feed: { ...state.feed, loading: false, error: action.error || null },
      };

    // ── pagination ────────────────────────────────────────────────
    case "feed/loadMore/start":
      return { ...state, feed: { ...state.feed, loading: true, error: null } };

    case "feed/loadMore/done": {
      // Appends BELOW what we have; older pages never overwrite the head.
      const incoming = action.items || [];
      const seen = new Set(state.feed.items.map((i) => i.id));
      const appended = incoming.filter((i) => i && i.id && !seen.has(i.id));
      return {
        ...state,
        feed: {
          ...state.feed,
          items: [...state.feed.items, ...appended],
          cursor: action.cursor ?? null,
          exhausted: !action.cursor,
          loading: false,
        },
      };
    }

    // ── local mark-read (optimistic) ──────────────────────────────
    case "read/optimistic": {
      const items = state.feed.items.map((i) =>
        i.id === action.id && !i.read_at
          ? { ...i, read_at: new Date().toISOString() }
          : i,
      );
      const wasUnread = state.feed.items.some((i) => i.id === action.id && !i.read_at);
      return {
        ...state,
        feed: { ...state.feed, items },
        unreadCount: Math.max(0, state.unreadCount - (wasUnread ? 1 : 0)),
        toasts: state.toasts.filter((t) => t.id !== action.id),
      };
    }

    case "read/confirmed":
      return {
        ...state,
        unreadCount: Number.isFinite(action.unreadCount) ? action.unreadCount : state.unreadCount,
      };

    case "read/rollback": {
      // The server refused. Put the row back rather than leaving the UI
      // claiming something was read that was not.
      const items = state.feed.items.map((i) =>
        i.id === action.id ? { ...i, read_at: action.previousReadAt ?? null } : i,
      );
      return {
        ...state,
        feed: { ...state.feed, items },
        unreadCount: state.unreadCount + (action.previousReadAt ? 0 : 1),
      };
    }

    case "readAll/optimistic": {
      const now = new Date().toISOString();
      return {
        ...state,
        feed: {
          ...state.feed,
          items: state.feed.items.map((i) => (i.read_at ? i : { ...i, read_at: now })),
        },
        unreadCount: 0,
        toasts: [],
      };
    }

    // ── toasts ────────────────────────────────────────────────────
    case "toast/dismiss":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };

    case "toast/dismissAll":
      return { ...state, toasts: [] };

    // ── preferences ───────────────────────────────────────────────
    case "prefs/loading":
      return { ...state, preferences: { ...state.preferences, loading: true, error: null } };

    case "prefs/loaded":
      return {
        ...state,
        preferences: {
          ...state.preferences,
          ...action.prefs,
          loaded: true,
          loading: false,
          saving: false,
          error: null,
        },
      };

    case "prefs/saving":
      return { ...state, preferences: { ...state.preferences, saving: true, error: null } };

    case "prefs/optimistic":
      return { ...state, preferences: { ...state.preferences, ...action.patch, saving: true } };

    case "prefs/rollback":
      return {
        ...state,
        preferences: {
          ...state.preferences,
          ...action.previous,
          saving: false,
          error: action.error || null,
        },
      };

    case "prefs/error":
      return {
        ...state,
        preferences: { ...state.preferences, loading: false, saving: false, error: action.error },
      };

    case "reset":
      return { ...initialState };

    default:
      return state;
  }
}

// ── selectors ───────────────────────────────────────────────────────

// Unread first, then newest first. The backend already orders this way,
// but the feed also holds locally-prepended live rows, so the ordering is
// re-established client-side rather than assumed.
export function selectOrdered(state) {
  return [...state.feed.items].sort((a, b) => {
    const aUnread = a.read_at ? 0 : 1;
    const bUnread = b.read_at ? 0 : 1;
    if (aUnread !== bUnread) return bUnread - aUnread;
    return String(b.created_at).localeCompare(String(a.created_at));
  });
}

/** Group into [{ key: 'YYYY-MM-DD', items: [...] }], newest day first. */
export function selectByDay(state) {
  const groups = new Map();
  for (const item of selectOrdered(state)) {
    const key = String(item.created_at || "").slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => ({ key, items }));
}

/**
 * Visible toasts + an overflow count. Past MAX_TOASTS the oldest are
 * collapsed into a single "+N" row so a storm cannot bury the screen.
 */
export function selectToasts(state) {
  const all = state.toasts;
  if (all.length <= MAX_TOASTS) return { visible: all, overflow: 0 };
  return { visible: all.slice(-MAX_TOASTS), overflow: all.length - MAX_TOASTS };
}

export function selectUnreadCount(state) {
  return state.unreadCount;
}
