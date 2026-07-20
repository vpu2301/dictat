// Sprint 12 — gated contract smoke against the LIVE notification-service.
//
// Proves the FE's pinned wire shapes match the AS-BUILT service, not the
// sprint doc's sketch. contract.test.js pins the documented contract
// offline; this one checks the running server agrees with the document.
//
// Skipped unless RUN_BACKEND_INTEGRATION=1. Needs, in
// ~/Desktop/dictate/medical-dictation-backend:
//   make dev-up && make migrate-up && make seed
//   make run-auth-service          (:8000)
//   make run-notification-service  (:8004)
//
//   npm run verify:notifications-contract
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

const GATED = process.env.RUN_BACKEND_INTEGRATION === "1";
const AUTH = process.env.VITE_AUTH_SERVICE_URL || "http://localhost:8000";
const NOTIF = process.env.VITE_NOTIFICATION_SERVICE_URL || "http://localhost:8004";

// The exact NotificationItem key set. The backend response model is
// extra="forbid" too, so a new key here means the contract moved.
const ITEM_KEYS = [
  "id",
  "category",
  "title",
  "body_text",
  "deep_link",
  "resource_type",
  "resource_id",
  "severity",
  "read_at",
  "created_at",
];

const CATEGORY_ROW_KEYS = [
  "category",
  "in_app_enabled",
  "email_mode",
  "is_default",
  "digest_eligible",
];

const sorted = (a) => [...a].sort();

async function login() {
  const r = await fetch(`${AUTH}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "clinician@tenant-a.example", password: "dev-password" }),
  });
  assert.equal(r.status, 200, `auth login failed: ${r.status}`);
  return (await r.json()).access_token;
}

const authed = (token) => ({ Authorization: `Bearer ${token}` });

test("feed page carries exactly the documented keys", { skip: !GATED }, async () => {
  const token = await login();
  const r = await fetch(`${NOTIF}/v1/notifications?limit=5`, { headers: authed(token) });
  assert.equal(r.status, 200, `feed failed: ${r.status}`);
  const body = await r.json();

  assert.deepEqual(sorted(Object.keys(body)), sorted(["items", "next_cursor", "unread_count"]));
  assert.ok(Array.isArray(body.items));
  assert.equal(typeof body.unread_count, "number");

  for (const item of body.items) {
    assert.deepEqual(sorted(Object.keys(item)), sorted(ITEM_KEYS), "NotificationItem drifted");
  }
});

test("unread-count is the badge's cheap read", { skip: !GATED }, async () => {
  const token = await login();
  const r = await fetch(`${NOTIF}/v1/notifications/unread-count`, { headers: authed(token) });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.deepEqual(Object.keys(body), ["unread_count"]);
});

test("a bad cursor is a 400, not a silent reset to page 1", { skip: !GATED }, async () => {
  // A silent reset would make a paging bug look like an infinite feed.
  const token = await login();
  const r = await fetch(`${NOTIF}/v1/notifications?cursor=not-a-cursor`, {
    headers: authed(token),
  });
  assert.equal(r.status, 400);
});

test("limit above the server cap is rejected", { skip: !GATED }, async () => {
  const token = await login();
  const r = await fetch(`${NOTIF}/v1/notifications?limit=1000`, { headers: authed(token) });
  assert.equal(r.status, 422, "the FE clamps to 100; the server enforces it");
});

test("preferences GET has the list-of-rows shape the FE converts", { skip: !GATED }, async () => {
  const token = await login();
  const r = await fetch(`${NOTIF}/v1/notifications/preferences`, { headers: authed(token) });
  assert.equal(r.status, 200);
  const body = await r.json();

  assert.deepEqual(
    sorted(Object.keys(body)),
    sorted(["categories", "timezone", "quiet_hours", "digest_hour"]),
  );
  assert.ok(Array.isArray(body.categories), "categories is a LIST, not a map");
  for (const row of body.categories) {
    assert.deepEqual(sorted(Object.keys(row)), sorted(CATEGORY_ROW_KEYS));
  }
  assert.deepEqual(sorted(Object.keys(body.quiet_hours)), sorted(["start", "end"]));
});

test("preferences PUT round-trips and rejects an unknown key", { skip: !GATED }, async () => {
  const token = await login();
  const current = await (
    await fetch(`${NOTIF}/v1/notifications/preferences`, { headers: authed(token) })
  ).json();

  const body = {
    categories: current.categories.map((c) => ({
      category: c.category,
      in_app_enabled: c.in_app_enabled,
      email_mode: c.email_mode,
    })),
    timezone: current.timezone,
    quiet_hours: current.quiet_hours || {},
    digest_hour: current.digest_hour,
  };

  const ok = await fetch(`${NOTIF}/v1/notifications/preferences`, {
    method: "PUT",
    headers: { ...authed(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal(ok.status, 200, "a full, well-formed replace is accepted");

  // extra="forbid" — an unknown key must be refused, not ignored.
  const bad = await fetch(`${NOTIF}/v1/notifications/preferences`, {
    method: "PUT",
    headers: { ...authed(token), "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, surprise: true }),
  });
  assert.equal(bad.status, 422, "extra='forbid' must reject an unknown key");
});

test("marking a nonexistent notification read is a 404", { skip: !GATED }, async () => {
  const token = await login();
  const r = await fetch(
    `${NOTIF}/v1/notifications/00000000-0000-0000-0000-000000000000/read`,
    { method: "POST", headers: authed(token) },
  );
  assert.equal(r.status, 404);
});

// Raw node:http — undici's fetch refuses to set a `Connection: Upgrade`
// header ("invalid connection header"), so a handshake cannot be driven
// through it. This is the only way to exercise the upgrade gate without
// pulling in a WebSocket dependency the repo does not have.
function handshake({ path, headers }) {
  return new Promise((resolve, reject) => {
    const url = new URL(NOTIF);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path,
        method: "GET",
        headers: {
          Connection: "Upgrade",
          Upgrade: "websocket",
          "Sec-WebSocket-Version": "13",
          "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
          ...headers,
        },
      },
      (res) => {
        res.resume();
        resolve({ status: res.statusCode, headers: res.headers });
      },
    );
    // A successful upgrade never emits `response`.
    req.on("upgrade", (res, socket) => {
      socket.destroy();
      resolve({ status: res.statusCode, headers: res.headers, upgraded: true });
    });
    req.on("error", reject);
    req.end();
  });
}

// A pre-accept rejection is answered by Starlette with a plain HTTP 403,
// whatever close code the endpoint passes — there is no WebSocket close
// frame before the handshake completes. The documented 4400/4401/4403
// codes are therefore NOT observable here (nor in a browser, which
// reports 1006). See the note in socket.js:classifyClose.
const PRE_ACCEPT_REJECTION = 403;

test("the WS upgrade refuses a client that does not offer v1", { skip: !GATED }, async () => {
  // The subprotocol IS the version negotiation: without it the server
  // rejects at upgrade rather than serving frames we may not understand.
  const token = await login();
  const r = await handshake({
    path: `/ws/notifications?token=${encodeURIComponent(token)}`,
    // deliberately NO Sec-WebSocket-Protocol
  });
  assert.equal(r.status, PRE_ACCEPT_REJECTION, "missing subprotocol must be refused");
  assert.ok(!r.upgraded, "the socket must not be accepted");
});

test("the WS upgrade refuses a missing token", { skip: !GATED }, async () => {
  const r = await handshake({
    path: "/ws/notifications",
    headers: { "Sec-WebSocket-Protocol": "medical-notifications.v1" },
  });
  assert.equal(r.status, PRE_ACCEPT_REJECTION, "unauthenticated upgrades are refused");
  assert.ok(!r.upgraded);
});

test("a valid handshake is accepted and echoes the subprotocol", { skip: !GATED }, async () => {
  const token = await login();
  const r = await handshake({
    path: `/ws/notifications?token=${encodeURIComponent(token)}`,
    headers: { "Sec-WebSocket-Protocol": "medical-notifications.v1" },
  });
  assert.equal(r.status, 101, "switching protocols");
  assert.equal(
    r.headers["sec-websocket-protocol"],
    "medical-notifications.v1",
    "browsers fail the connection if the negotiated subprotocol is absent",
  );
});
