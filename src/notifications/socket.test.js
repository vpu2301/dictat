// Sprint 12 — NotificationSocket lifecycle, driven deterministically.
//
// The socket is injectable (`WebSocketImpl`) precisely so this suite can
// exist: no network, no browser, no timers we do not control. Covers the
// FE spec's §5 close-code handling and the resync-on-open contract.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  BACKOFF_MAX_MS,
  NotificationSocket,
  backoffDelay,
  classifyClose,
} from "./socket.js";
import { SOCKET_STATUS, SUBPROTOCOL } from "./constants.js";

// The repo's api/client.js keeps the token in module memory; import and
// seed it so the socket believes there is a session.
import { setAccessToken } from "../api/client.js";

// A WebSocket stand-in that records what it was constructed with and
// lets a test fire lifecycle events by hand.
class FakeWS {
  static instances = [];
  constructor(url, protocols) {
    this.url = url;
    this.protocols = protocols;
    this.readyState = 0; // CONNECTING
    this.sent = [];
    this.protocol = Array.isArray(protocols) ? protocols[0] : protocols;
    FakeWS.instances.push(this);
  }
  send(data) { this.sent.push(data); }
  close() { this.readyState = 3; }
  // ── test drivers ──
  fireOpen() { this.readyState = 1; if (this.onopen) this.onopen(); }
  fireMessage(obj) { if (this.onmessage) this.onmessage({ data: JSON.stringify(obj) }); }
  fireRaw(data) { if (this.onmessage) this.onmessage({ data }); }
  fireClose(code) { this.readyState = 3; if (this.onclose) this.onclose({ code }); }
}

function makeSocket(callbacks = {}) {
  FakeWS.instances = [];
  setAccessToken("test-token");
  const s = new NotificationSocket({ callbacks, WebSocketImpl: FakeWS });
  return s;
}

// ── handshake ───────────────────────────────────────────────────────

test("connect offers the v1 subprotocol and carries the token in the query", () => {
  const s = makeSocket();
  s.connect();
  const ws = FakeWS.instances[0];
  assert.deepEqual(ws.protocols, [SUBPROTOCOL]);
  assert.ok(ws.url.includes("/ws/notifications"), "endpoint path");
  assert.ok(ws.url.includes("token=test-token"), "browsers cannot set an upgrade header");
  s.close();
});

test("no session → no socket, and no spin", () => {
  FakeWS.instances = [];
  setAccessToken(null);
  const s = new NotificationSocket({ WebSocketImpl: FakeWS });
  s.connect();
  assert.equal(FakeWS.instances.length, 0);
  assert.equal(s.status, SOCKET_STATUS.CLOSED);
});

test("open fires onOpen so the store can resync from REST", () => {
  let opened = 0;
  const s = makeSocket({ onOpen: () => { opened += 1; } });
  s.connect();
  FakeWS.instances[0].fireOpen();
  assert.equal(opened, 1, "every transition to open must trigger a resync");
  assert.equal(s.status, SOCKET_STATUS.OPEN);
  s.close();
});

test("a server negotiating a different subprotocol is fatal, not retried", () => {
  let mismatch = null;
  const s = makeSocket({ onProtocolMismatch: (p) => { mismatch = p; } });
  s.connect();
  const ws = FakeWS.instances[0];
  ws.protocol = "medical-notifications.v2";
  ws.fireOpen();
  assert.equal(mismatch, "medical-notifications.v2");
  assert.equal(s.stopped, true, "reconnecting would negotiate the same wrong version");
  s.close();
});

// ── frame dispatch ──────────────────────────────────────────────────

test("every server frame type routes to its callback", () => {
  const seen = {};
  const s = makeSocket({
    onNotification: (n, c) => { seen.notification = [n.id, c]; },
    onUnreadCount: (c) => { seen.unread = c; },
    onReadAck: (id, c) => { seen.ack = [id, c]; },
    onError: (e) => { seen.error = e.code; },
  });
  s.connect();
  const ws = FakeWS.instances[0];
  ws.fireOpen();

  ws.fireMessage({ type: "connected", subprotocol: SUBPROTOCOL, unread_count: 3 });
  assert.equal(seen.unread, 3, "connected carries the opening badge count");

  ws.fireMessage({ type: "notification", notification: { id: "n1" }, unread_count: 4 });
  assert.deepEqual(seen.notification, ["n1", 4]);

  ws.fireMessage({ type: "unread_count", unread_count: 7 });
  assert.equal(seen.unread, 7);

  ws.fireMessage({ type: "read_ack", notification_id: "n1", unread_count: 6 });
  assert.deepEqual(seen.ack, ["n1", 6]);

  ws.fireMessage({ type: "error", code: "bad_frame", detail: "" });
  assert.equal(seen.error, "bad_frame");

  s.close();
});

test("an unknown frame type is ignored, not fatal (additive versioning)", () => {
  const s = makeSocket();
  s.connect();
  const ws = FakeWS.instances[0];
  ws.fireOpen();
  ws.fireMessage({ type: "something_the_backend_added_later" });
  assert.equal(s.status, SOCKET_STATUS.OPEN, "socket stays up");
  s.close();
});

test("an unparseable frame does not drop the socket", () => {
  const s = makeSocket();
  s.connect();
  const ws = FakeWS.instances[0];
  ws.fireOpen();
  ws.fireRaw("{not json");
  assert.equal(s.status, SOCKET_STATUS.OPEN);
  s.close();
});

test("mark_read is sent in the shape the protocol defines", () => {
  const s = makeSocket();
  s.connect();
  const ws = FakeWS.instances[0];
  ws.fireOpen();
  s.markRead("abc");
  assert.deepEqual(JSON.parse(ws.sent[0]), { type: "mark_read", notification_id: "abc" });
  s.close();
});

// ── close codes (FE spec §5) ────────────────────────────────────────

test("4401 refreshes the token and retries", () => {
  const plan = classifyClose(4401);
  assert.equal(plan.retry, true);
  assert.equal(plan.refreshToken, true, "retrying without a refresh guarantees a second 4401");
});

test("4403 is terminal — retrying cannot grant permission", () => {
  const plan = classifyClose(4403);
  assert.equal(plan.retry, false);
  assert.equal(plan.fatal, true);
});

test("4400 is terminal and flagged as a protocol problem", () => {
  const plan = classifyClose(4400);
  assert.equal(plan.retry, false);
  assert.equal(plan.protocol, true);
});

test("4429 retries but skips ahead in the backoff curve", () => {
  const plan = classifyClose(4429);
  assert.equal(plan.retry, true);
  assert.ok(plan.penalty > 0, "backs off harder than an ordinary drop");
});

test("an abnormal close retries AND refreshes the token", () => {
  // notification-service rejects a bad upgrade before accept(), and
  // Starlette answers that with a plain HTTP 403 — no close frame. The
  // browser therefore reports 1006, never 4401, so an expired token
  // would never self-heal if only the 4401 branch refreshed.
  const plan = classifyClose(1006);
  assert.equal(plan.retry, true);
  assert.equal(plan.fatal, false);
  assert.equal(plan.refreshToken, true, "1006 is what an expired token actually looks like");
});

test("a normal close is not retried — we asked for it", () => {
  const plan = classifyClose(1000);
  assert.equal(plan.retry, false);
});

test("a fatal close leaves the socket closed, with no reconnect scheduled", () => {
  const s = makeSocket();
  s.connect();
  FakeWS.instances[0].fireClose(4403);
  assert.equal(s.status, SOCKET_STATUS.CLOSED);
  assert.equal(s._reconnectTimer, null, "no retry pending");
});

test("a transient close moves to reconnecting", () => {
  const s = makeSocket();
  s.connect();
  FakeWS.instances[0].fireOpen();
  FakeWS.instances[0].fireClose(1006);
  assert.equal(s.status, SOCKET_STATUS.RECONNECTING);
  s.close();
});

// ── backoff ─────────────────────────────────────────────────────────

test("backoff grows exponentially and is capped", () => {
  const noJitter = { jitter: () => 1 };
  assert.equal(backoffDelay(0, noJitter), 1000);
  assert.equal(backoffDelay(1, noJitter), 2000);
  assert.equal(backoffDelay(2, noJitter), 4000);
  assert.equal(backoffDelay(99, noJitter), BACKOFF_MAX_MS);
});

test("backoff is jittered so clients do not stampede a restarted server", () => {
  const low = backoffDelay(3, { jitter: () => 0 });
    const high = backoffDelay(3, { jitter: () => 1 });
  assert.ok(low < high, "the delay must vary with jitter");
  assert.ok(low >= 4000, "never below half the nominal delay");
});

test("close() stops reconnecting for good", () => {
  const s = makeSocket();
  s.connect();
  FakeWS.instances[0].fireOpen();
  s.close();
  assert.equal(s.stopped, true);
  const before = FakeWS.instances.length;
  s.ensureConnected();
  assert.equal(FakeWS.instances.length, before, "a closed socket stays closed");
});

test("ensureConnected reopens a socket the browser reaped silently", () => {
  const s = makeSocket();
  s.connect();
  const ws = FakeWS.instances[0];
  ws.fireOpen();
  // Simulate a backgrounded tab: the socket is dead but never fired onclose.
  ws.readyState = 3;
  s.ensureConnected();
  assert.equal(FakeWS.instances.length, 2, "a new socket was opened");
  s.close();
});
