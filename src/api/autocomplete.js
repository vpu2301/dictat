// autocomplete.js — ranked phrase/snippet suggestions for the report editor.
//
// Its own service (:8007, prefix /autocomplete) per the integration guide §3 —
// NOT part of nlp-service. Suggestions are best-effort and must never block
// dictation: callers catch failures and fall back to an empty list.
//
//   POST   /autocomplete/suggest                  ranked suggestions
//   POST   /autocomplete/phrases                  create phrase (201; 409 dup)
//   DELETE /autocomplete/phrases/{phrase_id}      remove phrase (204)
//   POST   /autocomplete/telemetry                usage events (204, PII-scrubbed)

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

const a = (p, init) => apiAt(SERVICES.autocomplete, p, init);

// POST /autocomplete/suggest →
//   { request_id, suggestions: [{ id, kind: 'phrase'|'snippet', text,
//     completion, source: 'system'|'tenant'|'user', confidence,
//     cursor_offset }] }
//
// Wire model is Pydantic extra="forbid": ONLY prefix/language/limit/context
// are accepted (unknown top-level keys 422) and `prefix` is capped at
// 80 chars — send the token being typed (src/autocomplete/prefix.js), never
// the whole section text. Extra hints (section, template) ride inside
// `context`. A leading "/" on the prefix routes to the snippet dispatcher.
// `init` lets the suggest engine pass { signal } for AbortController
// cancellation (a newer keystroke aborts the in-flight request).
export async function suggest({ prefix = "", language = "uk", limit = 3, context }, init = {}) {
  const body = { prefix: String(prefix).slice(0, 80), language, limit };
  if (context && Object.keys(context).length) body.context = context;
  return a("/autocomplete/suggest", { method: "POST", body: JSON.stringify(body), ...init });
}

// Save a personal phrase (201).
// body: { phrase, language, specialty?, section_hint?, source? ('user'|'tenant') }
// 409 → the phrase already exists for this scope; 422 → PII detected.
export async function createPhrase(body) {
  return a("/autocomplete/phrases", { method: "POST", body: JSON.stringify(body) });
}

// Remove (soft-delete) a personal phrase (204).
export async function deletePhrase(phraseId) {
  return a(`/autocomplete/phrases/${encodeURIComponent(phraseId)}`, { method: "DELETE" });
}

// Fire-and-forget usage telemetry (204). Server-side PII scrubbing.
// event: { request_id, event: 'shown_only'|'accepted'|'rejected'|'timeout',
//          prefix, phrase_id?, snippet_id?, context? }
// One event per POST — the wire has no batch shape. `init` lets the
// telemetry sink pass { keepalive: true } for page-unload flushes.
export async function sendTelemetry(event, init = {}) {
  return a("/autocomplete/telemetry", { method: "POST", body: JSON.stringify(event), ...init });
}
