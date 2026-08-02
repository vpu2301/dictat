// chat/routing.test.js — the scoped router.
//
// The router is the piece most likely to be wrong in a way nobody notices:
// mounted at a different base path in a different host, a bad parse silently
// renders the chat instead of the deep-linked conversation.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePath, buildPath } from "./routing.js";

const BASE = "/apps/evidence-chat";

test("the base path is the chat", () => {
  assert.deepEqual(parsePath(BASE, BASE), { view: "chat", sessionId: null });
  assert.equal(parsePath(`${BASE}/`, BASE).view, "chat");
});

test("history and agents are the other views", () => {
  assert.equal(parsePath(`${BASE}/history`, BASE).view, "history");
  assert.equal(parsePath(`${BASE}/agents`, BASE).view, "agents");
});

test("retired paths fall back to the chat, they do not blank the panel", () => {
  // Settings and connectors moved to the host's own settings page. Old deep
  // links must land somewhere sensible rather than rendering nothing.
  assert.deepEqual(parsePath(`${BASE}/settings`, BASE), { view: "chat", sessionId: null });
  assert.deepEqual(parsePath(`${BASE}/connectors`, BASE), { view: "chat", sessionId: null });
});

test("a resumed session is a chat with an id", () => {
  const r = parsePath(`${BASE}/s/ses_01`, BASE);
  assert.equal(r.view, "chat");
  assert.equal(r.sessionId, "ses_01");
});

test("anything unrecognised under the base still renders a screen", () => {
  assert.deepEqual(parsePath(`${BASE}/nonsense/deep`, BASE), { view: "chat", sessionId: null });
});

test("the module works at any base path a host mounts it on", () => {
  const other = "/chat";
  assert.equal(parsePath(`${other}/s/ses_02`, other).sessionId, "ses_02");
  assert.equal(buildPath(other, { view: "history" }), "/chat/history");
});

test("buildPath and parsePath round-trip", () => {
  const cases = [
    { view: "chat", sessionId: null },
    { view: "history", sessionId: null },
    { view: "chat", sessionId: "ses_01" },
  ];
  for (const c of cases) assert.deepEqual(parsePath(buildPath(BASE, c), BASE), c);
});

test("session ids are encoded on the way out and decoded on the way back", () => {
  // A slash inside an id would otherwise become a path segment and split the
  // route in half — the encoding is doing real work, not ceremony.
  const id = "ses a/b";
  const path = buildPath(BASE, { view: "chat", sessionId: id });
  assert.equal(path.includes(" "), false);
  assert.equal(parsePath(path, BASE).sessionId, id);
});
