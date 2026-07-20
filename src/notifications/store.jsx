// store.jsx — the notifications context.
//
// A third context alongside AuthContext and I18nContext, in the same
// shape as AuthContext (useState/useReducer + useMemo value). No state
// library: nothing in this repo uses one, and one feature is not the
// place to introduce a second paradigm.
//
// The reducer lives in reducer.js so the reconcile rules stay testable
// under `node --test` (no React renderer in this repo).

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";

import {
  getPreferences,
  getUnreadCount,
  listNotifications,
  markAllRead as apiMarkAllRead,
  markRead as apiMarkRead,
  putPreferences,
} from "../api/notifications.js";
import { FEATURES } from "../api/services.js";
import { NotificationSocket } from "./socket.js";
import { fromWire, toWire } from "./prefs.js";
import { initialState, reducer, selectByDay, selectOrdered, selectToasts } from "./reducer.js";

const NotificationsCtx = createContext(null);

export function NotificationsProvider({ children, enabled = FEATURES.notifications }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef = useRef(null);
  // Guards against a resync landing after unmount / sign-out.
  const aliveRef = useRef(true);

  // ── REST resync — the authoritative read ────────────────────────
  const resyncFromRest = useCallback(async () => {
    if (!enabled) return;
    dispatch({ type: "resync/start" });
    try {
      const page = await listNotifications({});
      if (!aliveRef.current) return;
      dispatch({
        type: "resync/done",
        items: page.items || [],
        cursor: page.next_cursor || null,
        unreadCount: page.unread_count,
      });
    } catch (error) {
      if (!aliveRef.current) return;
      dispatch({ type: "resync/error", error });
    }
  }, [enabled]);

  const refreshUnreadCount = useCallback(async () => {
    if (!enabled) return;
    try {
      const r = await getUnreadCount();
      if (aliveRef.current) dispatch({ type: "live/unreadCount", count: r.unread_count });
    } catch {
      // Badge staleness is not worth surfacing; the next resync fixes it.
    }
  }, [enabled]);

  const loadMore = useCallback(async () => {
    if (!enabled) return;
    if (state.feed.loading || state.feed.exhausted || !state.feed.cursor) return;
    dispatch({ type: "feed/loadMore/start" });
    try {
      const page = await listNotifications({ cursor: state.feed.cursor });
      if (!aliveRef.current) return;
      dispatch({
        type: "feed/loadMore/done",
        items: page.items || [],
        cursor: page.next_cursor || null,
      });
    } catch (error) {
      if (aliveRef.current) dispatch({ type: "resync/error", error });
    }
  }, [enabled, state.feed.loading, state.feed.exhausted, state.feed.cursor]);

  // ── mark read ───────────────────────────────────────────────────
  const markRead = useCallback(
    async (id) => {
      const previous = state.feed.items.find((i) => i.id === id);
      const previousReadAt = previous ? previous.read_at : null;
      if (previousReadAt) return; // already read — nothing to do
      dispatch({ type: "read/optimistic", id });
      try {
        const r = await apiMarkRead(id);
        if (aliveRef.current) dispatch({ type: "read/confirmed", unreadCount: r.unread_count });
      } catch (error) {
        // Put it back. A UI that claims something was read when the
        // server disagrees is worse than a visible failure.
        if (aliveRef.current) dispatch({ type: "read/rollback", id, previousReadAt, error });
      }
    },
    [state.feed.items],
  );

  const markAllRead = useCallback(async () => {
    dispatch({ type: "readAll/optimistic" });
    try {
      const r = await apiMarkAllRead();
      if (aliveRef.current) dispatch({ type: "read/confirmed", unreadCount: r.unread_count });
    } catch {
      // No per-row rollback is possible here; a resync restores truth.
      await resyncFromRest();
    }
  }, [resyncFromRest]);

  // ── preferences ─────────────────────────────────────────────────
  const loadPreferences = useCallback(async () => {
    if (!enabled) return;
    dispatch({ type: "prefs/loading" });
    try {
      const view = await getPreferences();
      if (aliveRef.current) dispatch({ type: "prefs/loaded", prefs: fromWire(view) });
    } catch (error) {
      if (aliveRef.current) dispatch({ type: "prefs/error", error });
    }
  }, [enabled]);

  const savePreferences = useCallback(
    async (patch) => {
      const previous = {
        matrix: state.preferences.matrix,
        quietHours: state.preferences.quietHours,
        timezone: state.preferences.timezone,
        digestHour: state.preferences.digestHour,
      };
      const next = { ...previous, ...patch };
      dispatch({ type: "prefs/optimistic", patch });
      try {
        const view = await putPreferences(toWire(next));
        if (aliveRef.current) dispatch({ type: "prefs/loaded", prefs: fromWire(view) });
        return true;
      } catch (error) {
        if (aliveRef.current) dispatch({ type: "prefs/rollback", previous, error });
        return false;
      }
    },
    [state.preferences],
  );

  // ── socket lifecycle ────────────────────────────────────────────
  useEffect(() => {
    aliveRef.current = true;
    if (!enabled) return undefined;

    const socket = new NotificationSocket({
      callbacks: {
        onStatus: (status) => dispatch({ type: "socket/status", status }),
        // EVERY transition to open resyncs. This is the whole
        // correctness story for a dropped frame, a multi-worker gap,
        // or a laptop waking from sleep.
        onOpen: () => { resyncFromRest(); },
        onNotification: (item, unreadCount) =>
          dispatch({ type: "live/notification", notification: item, unreadCount }),
        onUnreadCount: (count) => dispatch({ type: "live/unreadCount", count }),
        onReadAck: (notificationId, unreadCount) =>
          dispatch({ type: "live/readAck", notificationId, unreadCount }),
        onProtocolMismatch: () => dispatch({ type: "socket/protocolMismatch" }),
        onError: (error) => dispatch({ type: "socket/error", error }),
      },
    });
    socketRef.current = socket;
    socket.connect();

    return () => {
      aliveRef.current = false;
      socket.close();
      socketRef.current = null;
    };
  }, [enabled, resyncFromRest]);

  // Re-read the badge when the tab regains focus. A backgrounded tab can
  // have its socket quietly reaped by the browser without a close event.
  useEffect(() => {
    if (!enabled) return undefined;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        if (socketRef.current) socketRef.current.ensureConnected();
        refreshUnreadCount();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled, refreshUnreadCount]);

  const value = useMemo(
    () => ({
      ...state,
      enabled,
      ordered: selectOrdered(state),
      byDay: selectByDay(state),
      toastView: selectToasts(state),
      resyncFromRest,
      refreshUnreadCount,
      loadMore,
      markRead,
      markAllRead,
      loadPreferences,
      savePreferences,
      dismissToast: (id) => dispatch({ type: "toast/dismiss", id }),
      dismissAllToasts: () => dispatch({ type: "toast/dismissAll" }),
    }),
    [
      state,
      enabled,
      resyncFromRest,
      refreshUnreadCount,
      loadMore,
      markRead,
      markAllRead,
      loadPreferences,
      savePreferences,
    ],
  );

  return <NotificationsCtx.Provider value={value}>{children}</NotificationsCtx.Provider>;
}

// Returns null when the provider is absent so a component can render
// nothing rather than crash — the feature is flag-gated and the
// marketing/login shells do not mount the provider at all.
export function useNotifications() {
  return useContext(NotificationsCtx);
}
