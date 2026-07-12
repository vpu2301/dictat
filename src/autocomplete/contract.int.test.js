// Sprint 10 step 01 — gated contract smoke against the LIVE local backend.
//
// Proves the FE's pinned wire shapes match the as-built autocomplete-service,
// not the sprint doc's sketch. Skipped unless RUN_BACKEND_INTEGRATION=1 (needs
// `make dev-up && make migrate-up && make seed && make run-auth-service &&
// make run-autocomplete-service` in ~/Desktop/dictate/medical-dictation-backend).
//
//   npm run verify:autocomplete-contract
import { test } from "node:test";
import assert from "node:assert/strict";

const GATED = process.env.RUN_BACKEND_INTEGRATION === "1";
const AUTH = process.env.VITE_AUTH_SERVICE_URL || "http://localhost:8000";
const AC = process.env.VITE_AUTOCOMPLETE_SERVICE_URL || "http://localhost:8007";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The exact SuggestionDTO key set (extra="forbid" on the backend response
// model too — a new key appearing here means the contract moved).
const DTO_KEYS = ["id", "kind", "text", "completion", "source", "confidence", "cursor_offset"];

async function login() {
  const r = await fetch(`${AUTH}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "clinician@tenant-a.example", password: "dev-password" }),
  });
  assert.equal(r.status, 200, `auth login failed: ${r.status}`);
  return (await r.json()).access_token;
}

async function post(token, path, body) {
  return fetch(`${AC}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

test("suggest: phrase prefix 'зад' parses with ≥1 suggestion in the pinned shape", { skip: !GATED }, async () => {
  const token = await login();
  const r = await post(token, "/autocomplete/suggest", { prefix: "зад", language: "uk", limit: 3 });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.match(body.request_id, UUID_RE, "request_id is in the BODY and is a uuid");
  assert.ok(Array.isArray(body.suggestions) && body.suggestions.length >= 1, "≥1 suggestion for the seeded corpus");
  for (const s of body.suggestions) {
    assert.deepEqual(Object.keys(s).sort(), [...DTO_KEYS].sort(), "SuggestionDTO key set");
    assert.equal(s.kind, "phrase");
    assert.ok(s.text.startsWith("зад"), "text is the full phrase");
    assert.equal("зад" + s.completion, s.text, "completion is the remainder after the typed prefix");
    assert.equal(s.cursor_offset, null, "phrases carry no cursor_offset");
    assert.ok(["system", "tenant", "user"].includes(s.source));
  }
});

test("suggest: snippet trigger '/vitals' returns the expansion with an integer cursor_offset", { skip: !GATED }, async () => {
  const token = await login();
  const r = await post(token, "/autocomplete/suggest", { prefix: "/vitals", language: "uk" });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.suggestions.length, 1);
  const s = body.suggestions[0];
  assert.equal(s.kind, "snippet");
  assert.equal(s.completion, s.text, "snippet completion is the whole expansion");
  assert.ok(Number.isInteger(s.cursor_offset), "cursor_offset is where the caret lands");
  assert.ok(s.cursor_offset > 0 && s.cursor_offset <= s.text.length);
});

test("suggest: unknown top-level field → 422 (extra=\"forbid\" is real, not a sketch)", { skip: !GATED }, async () => {
  const token = await login();
  const r = await post(token, "/autocomplete/suggest", { prefix: "зад", language: "uk", surprise: 1 });
  assert.equal(r.status, 422);
});

test("telemetry: shown_only round-trips to 204", { skip: !GATED }, async () => {
  const token = await login();
  const sr = await post(token, "/autocomplete/suggest", { prefix: "зад", language: "uk", limit: 1 });
  const { request_id, suggestions } = await sr.json();
  const r = await post(token, "/autocomplete/telemetry", {
    request_id,
    event: "shown_only",
    prefix: "зад",
    phrase_id: suggestions[0]?.id ?? null,
    context: { field: "anamnesis" },
  });
  assert.equal(r.status, 204);
});
