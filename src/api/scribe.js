// scribe.js — ambient-scribe consult sessions (sprints 14-15).
//
// A scribe session is a dictation session captured during a live patient
// encounter: diarized transcript + an AI-drafted structured note whose spans
// trace back to transcript turns (the review screen). The transport/finalize
// lifecycle lives in src/api/dictation.js + src/dictation/wsClient.js; this
// client covers the read side and the note-generation result.

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

const a = (p, init) => apiAt(SERVICES.core, p, init);

export async function getSession(id) {
  return a(`/scribe/sessions/${encodeURIComponent(id)}`, { method: "GET" });
}

// The review payload: { transcript[], generatedNote{ sections[] } } with
// per-span source attribution and confidence.
export async function getReviewSession(id) {
  return a(`/scribe/sessions/${encodeURIComponent(id)}/review`, { method: "GET" });
}

// Persist clinician edits / accept the generated note.
export async function saveReview(id, body) {
  return a(`/scribe/sessions/${encodeURIComponent(id)}/review`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
