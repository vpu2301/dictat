// Sprint 12 — the FE spec's §5 "resync correctness" VERIFY, at the level
// where it actually lives: the reducer.
//
// The invariant under test is that the WebSocket never sets truth it
// cannot prove. Redis pub/sub fan-out is fire-and-forget (backend
// ADR-0030), so a frame can be dropped, duplicated, or land after the
// REST read that already counted it. REST must win, every time.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_TOASTS,
  initialState,
  reducer,
  selectByDay,
  selectOrdered,
  selectToasts,
} from "./reducer.js";
import { SEVERITY, SOCKET_STATUS } from "./constants.js";

const NOTE = (over = {}) => ({
  id: "n1",
  category: "report.finalized",
  title: "Звіт RPT-1 завершено",
  body_text: "",
  deep_link: "https://app/reports/r1",
  resource_type: "report",
  resource_id: "r1",
  severity: SEVERITY.INFO,
  read_at: null,
  created_at: "2026-07-19T10:00:00Z",
  ...over,
});

const run = (state, ...actions) => actions.reduce(reducer, state);

// ── the core invariant ──────────────────────────────────────────────

test("a REST resync overwrites a badge the socket got wrong", () => {
  // The socket nudged us to 5 while we were disconnected and missed
  // three mark-reads from another device.
  const nudged = run(initialState, { type: "live/unreadCount", count: 5 });
  assert.equal(nudged.unreadCount, 5);

  const resynced = reducer(nudged, {
    type: "resync/done",
    items: [],
    cursor: null,
    unreadCount: 2,
  });
  assert.equal(resynced.unreadCount, 2, "REST is the ledger — it overwrites");
});

test("a notification missed while the socket was down appears after resync", () => {
  const missed = NOTE({ id: "missed", created_at: "2026-07-19T11:00:00Z" });
  const s = run(
    initialState,
    { type: "socket/status", status: SOCKET_STATUS.RECONNECTING },
    { type: "resync/done", items: [missed], cursor: null, unreadCount: 1 },
  );
  assert.deepEqual(s.feed.items.map((i) => i.id), ["missed"]);
  assert.equal(s.unreadCount, 1);
});

test("a duplicated frame does not double-count or double-list", () => {
  // At-least-once delivery: the same notification can arrive twice.
  const s = run(
    initialState,
    { type: "live/notification", notification: NOTE() },
    { type: "live/notification", notification: NOTE() },
  );
  assert.equal(s.feed.items.length, 1, "de-duplicated by id");
  assert.equal(s.unreadCount, 1, "counted once");
});

test("a frame for a row already in the feed does not re-bump the badge", () => {
  const s = run(
    initialState,
    { type: "resync/done", items: [NOTE()], cursor: null, unreadCount: 1 },
    { type: "live/notification", notification: NOTE() },
  );
  assert.equal(s.unreadCount, 1);
});

test("a server-supplied count on a live frame is trusted over a local bump", () => {
  const s = reducer(initialState, {
    type: "live/notification",
    notification: NOTE(),
    unreadCount: 9,
  });
  assert.equal(s.unreadCount, 9);
});

// ── mark-read ───────────────────────────────────────────────────────

test("optimistic mark-read decrements, and rollback restores on failure", () => {
  const seeded = reducer(initialState, {
    type: "resync/done",
    items: [NOTE()],
    cursor: null,
    unreadCount: 1,
  });

  const optimistic = reducer(seeded, { type: "read/optimistic", id: "n1" });
  assert.equal(optimistic.unreadCount, 0);
  assert.ok(optimistic.feed.items[0].read_at, "row shows as read");

  const rolled = reducer(optimistic, { type: "read/rollback", id: "n1", previousReadAt: null });
  assert.equal(rolled.unreadCount, 1, "badge restored");
  assert.equal(rolled.feed.items[0].read_at, null, "row is unread again");
});

test("marking an already-read row does not drive the badge negative", () => {
  const seeded = reducer(initialState, {
    type: "resync/done",
    items: [NOTE({ read_at: "2026-07-19T10:05:00Z" })],
    cursor: null,
    unreadCount: 0,
  });
  const s = reducer(seeded, { type: "read/optimistic", id: "n1" });
  assert.equal(s.unreadCount, 0);
});

test("a read_ack from another tab marks the row read here (multi-tab)", () => {
  const seeded = reducer(initialState, {
    type: "resync/done",
    items: [NOTE()],
    cursor: null,
    unreadCount: 1,
  });
  const s = reducer(seeded, {
    type: "live/readAck",
    notificationId: "n1",
    unreadCount: 0,
  });
  assert.ok(s.feed.items[0].read_at, "reconciled without a manual refresh");
  assert.equal(s.unreadCount, 0);
});

test("mark-all-read clears the badge and every toast", () => {
  const seeded = run(
    initialState,
    { type: "live/notification", notification: NOTE({ id: "a", severity: SEVERITY.WARNING }) },
    { type: "live/notification", notification: NOTE({ id: "b" }) },
  );
  const s = reducer(seeded, { type: "readAll/optimistic" });
  assert.equal(s.unreadCount, 0);
  assert.deepEqual(s.toasts, []);
  assert.ok(s.feed.items.every((i) => i.read_at));
});

// ── pagination ──────────────────────────────────────────────────────

test("loadMore appends below and never overwrites the head", () => {
  const first = reducer(initialState, {
    type: "resync/done",
    items: [NOTE({ id: "new", created_at: "2026-07-19T12:00:00Z" })],
    cursor: "cur1",
    unreadCount: 1,
  });
  const second = reducer(first, {
    type: "feed/loadMore/done",
    items: [NOTE({ id: "old", created_at: "2026-07-18T09:00:00Z" })],
    cursor: null,
  });
  assert.deepEqual(second.feed.items.map((i) => i.id), ["new", "old"]);
  assert.equal(second.feed.exhausted, true, "no cursor → exhausted");
});

test("a repeated page does not duplicate rows", () => {
  const first = reducer(initialState, {
    type: "resync/done",
    items: [NOTE({ id: "a" })],
    cursor: "c",
    unreadCount: 1,
  });
  const second = reducer(first, {
    type: "feed/loadMore/done",
    items: [NOTE({ id: "a" })],
    cursor: null,
  });
  assert.equal(second.feed.items.length, 1);
});

// ── toasts (severity routing) ───────────────────────────────────────

test("info notifications toast as well as bumping the badge", () => {
  // They used to be badge-only, which read as the feature being broken:
  // the bell is hidden on Studio and the other focused routes, so a
  // finished dictation produced no visible reaction anywhere. Info now
  // toasts briefly (see NotificationToasts.dismissDelay).
  const s = reducer(initialState, {
    type: "live/notification",
    notification: NOTE({ severity: SEVERITY.INFO }),
  });
  assert.equal(s.unreadCount, 1);
  assert.equal(s.toasts.length, 1);
});

test("warning and critical toast", () => {
  const s = run(
    initialState,
    { type: "live/notification", notification: NOTE({ id: "w", severity: SEVERITY.WARNING }) },
    { type: "live/notification", notification: NOTE({ id: "c", severity: SEVERITY.CRITICAL }) },
  );
  assert.deepEqual(s.toasts.map((t) => t.id), ["w", "c"]);
});

test("toast overflow past the cap collapses into a +N counter", () => {
  let s = initialState;
  for (let i = 0; i < MAX_TOASTS + 2; i += 1) {
    s = reducer(s, {
      type: "live/notification",
      notification: NOTE({ id: `t${i}`, severity: SEVERITY.CRITICAL }),
    });
  }
  const view = selectToasts(s);
  assert.equal(view.visible.length, MAX_TOASTS);
  assert.equal(view.overflow, 2);
});

test("a resync drops toasts for rows that turned out to be read elsewhere", () => {
  const withToast = reducer(initialState, {
    type: "live/notification",
    notification: NOTE({ id: "w", severity: SEVERITY.WARNING }),
  });
  assert.equal(withToast.toasts.length, 1);

  const s = reducer(withToast, {
    type: "resync/done",
    items: [NOTE({ id: "w", severity: SEVERITY.WARNING, read_at: "2026-07-19T10:01:00Z" })],
    cursor: null,
    unreadCount: 0,
  });
  assert.deepEqual(s.toasts, [], "already handled on another device — stale toast");
});

// ── selectors ───────────────────────────────────────────────────────

test("ordering is unread-first, then newest-first", () => {
  const s = reducer(initialState, {
    type: "resync/done",
    cursor: null,
    unreadCount: 1,
    items: [
      NOTE({ id: "read-new", read_at: "x", created_at: "2026-07-19T12:00:00Z" }),
      NOTE({ id: "unread-old", created_at: "2026-07-19T08:00:00Z" }),
    ],
  });
  assert.deepEqual(selectOrdered(s).map((i) => i.id), ["unread-old", "read-new"]);
});

test("day grouping buckets by calendar day, newest day first", () => {
  const s = reducer(initialState, {
    type: "resync/done",
    cursor: null,
    unreadCount: 0,
    items: [
      NOTE({ id: "a", read_at: "x", created_at: "2026-07-19T10:00:00Z" }),
      NOTE({ id: "b", read_at: "x", created_at: "2026-07-18T10:00:00Z" }),
    ],
  });
  const groups = selectByDay(s);
  assert.deepEqual(groups.map((g) => g.key), ["2026-07-19", "2026-07-18"]);
});

// ── socket status ───────────────────────────────────────────────────

test("a protocol mismatch is terminal, not a reconnect loop", () => {
  const s = reducer(initialState, { type: "socket/protocolMismatch" });
  assert.equal(s.protocolMismatch, true);
  assert.equal(s.socketStatus, SOCKET_STATUS.CLOSED);
});
