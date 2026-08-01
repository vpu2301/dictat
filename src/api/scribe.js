// scribe.js — ambient-scribe consult sessions (sprints 14-15).
//
// A scribe session is a dictation session captured during a live patient
// encounter: a diarized transcript persisted by dictation-service at
// finalize. The transport/finalize lifecycle lives in src/api/dictation.js +
// src/dictation/wsClient.js; this file covers the read side.
//
// It used to point at `{core}/scribe/sessions/{id}` — a route core-service
// has never served, so every "open this consultation" link 404'd. The
// transcript lives on dictation-service; that is what we read.
//
// There is deliberately NO note-generation call here. Note synthesis
// (sprint 12) does not exist in the backend yet, and a client that pretends
// otherwise just moves the 404 one screen later. What produces a document
// today is the conversation review → `POST /v1/reports` → Studio draft, in
// src/conversation/ConversationRoom.jsx.

import { getSession as getDictationSession } from "./dictation.js";

// Wire speaker → the role the transcript UI renders. The backend's mapping
// inference ABSTAINS when the signal is weak, and diarization emits anonymous
// S1/S2/UNKNOWN labels; both must survive to the screen as "unattributed"
// rather than being guessed into a clinician turn.
function turnSpeaker(segment) {
  const role = segment.speaker_role;
  if (role === "doctor") return "clinician";
  if (role === "patient") return "patient";
  return null; // S1 / S2 / UNKNOWN / not yet labelled
}

function toTurn(segment, i) {
  return {
    id: segment.id || `seg-${i}`,
    speaker: turnSpeaker(segment),
    // The anonymous diarization label, kept so two unattributed voices stay
    // visibly distinct instead of collapsing into one anonymous blob.
    label: segment.speaker || null,
    confidence: segment.speaker_confidence ?? null,
    t: segment.start_ms != null ? Math.round(segment.start_ms / 1000) : null,
    text: segment.text || "",
  };
}

// Normalize a dictation-service SessionDetail into what the consult screen
// renders. `note` is absent on purpose — see the header.
export function toConsultSession(detail) {
  if (!detail) return null;
  const segments = Array.isArray(detail.transcript) ? detail.transcript : [];
  return {
    id: detail.id,
    status: detail.status,
    language: detail.language,
    durationS: detail.total_audio_ms ? detail.total_audio_ms / 1000 : null,
    startedAt: detail.started_at || null,
    finalizedAt: detail.finalized_at || null,
    transcript: segments.map(toTurn),
    // A conversation whose diarization never resolved a role is a real
    // outcome, not an error — the screen says so rather than mislabelling.
    unattributed: segments.filter((s) => turnSpeaker(s) === null).length,
  };
}

export async function getSession(id) {
  return toConsultSession(await getDictationSession(id));
}

// The 2-pane review screen (NoteReview.jsx) needs a GENERATED note whose
// spans trace back to transcript turns. Nothing in the backend produces one:
// note synthesis is sprint 12 and does not exist there yet. So this returns
// the real transcript with `generatedNote: null`, and the screen says that
// out loud instead of rendering a blank pane over a 404.
export async function getReviewSession(id) {
  const session = await getSession(id);
  return session && { ...session, generatedNote: null };
}
