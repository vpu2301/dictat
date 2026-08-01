// dialogue.js — reviewed conversation → the text that lands in the report.
//
// WHY THE FRONTEND RENDERS THIS AT ALL (the as-built backend contract, checked
// 2026-07-26 against dictation-ws-v2.md + session/draft.py):
//
//   * The only v2 client message is `set_speaker_mapping`. There is NO wire
//     channel for a per-TURN correction, and `finalize` takes no body.
//   * When a conversation session carries a `template_id`, dictation-service
//     renders the draft itself from ITS OWN labels at finalize — and
//     `session_terminated` carries no report id, while report-service has no
//     by-source-session lookup. The clinician's review would be both lost and
//     unreachable.
//   * dictation-ws-v2.md documents the alternative explicitly: without a
//     `template_id` the service skips draft creation ("the clinician creates
//     the report manually", draft.py → `_fail("no_template")`).
//
// So conversation sessions start WITHOUT a template_id and the frontend builds
// the draft from the REVIEWED turns. `dialogueText` below is a deliberate
// mirror of the backend's `dialogue_text` (same labels, same consecutive-turn
// merging) so a draft written by either side reads identically — the only
// difference being that this one knows what the clinician corrected.
//
// Segment UUIDs are minted at finalize and never appear on the wire, so the
// caller reads them back from GET /dictate/sessions/{id} and merges the
// review onto them here.

export const ROLE_LABELS = {
  uk: { doctor: "ЛІКАР", patient: "ПАЦІЄНТ", unknown: "НЕВІДОМО" },
  en: { doctor: "DOCTOR", patient: "PATIENT", unknown: "UNKNOWN" },
};

/**
 * Fold the clinician's turn-level rulings onto the persisted transcript.
 *
 * Matching is by `start_ms`: the persisted segment and the wire `final` are the
 * same committed segment from the same committer, so the timestamp is an exact
 * identity, not a heuristic. A segment we can't match keeps the server's own
 * label — silently dropping it would lose transcript.
 *
 * `mapping` resolves labels → roles at review time, so a correction made before
 * a mapping swap still means the voice the clinician pointed at.
 */
export function mergeReview(segments = [], { corrections = [], mapping = {} } = {}) {
  const byStart = new Map();
  for (const c of corrections) {
    if (c && c.start_ms != null) byStart.set(c.start_ms, c.speaker);
  }
  return segments.map((seg) => {
    const corrected = byStart.get(seg.start_ms);
    const speaker = corrected !== undefined ? corrected : (seg.speaker ?? null);
    const role = speaker && speaker !== "UNKNOWN" ? (mapping[speaker] || null) : null;
    return {
      ...seg,
      speaker,
      speaker_role: role,
      // Provenance survives into the record: a clinician-set label is not a
      // machine proposal, and sprint-12 synthesis must be able to tell them
      // apart before it attributes a sentence to a party.
      speaker_source: corrected !== undefined ? "clinician" : "machine",
      ...(corrected !== undefined ? { speaker_confidence: null } : {}),
    };
  });
}

/**
 * Render reviewed segments as speaker-turn lines. Consecutive segments from the
 * same party join one line (the backend's rule); an unmapped or UNKNOWN speaker
 * renders as the honesty label rather than being folded into a party — a
 * misattributed sentence inverts clinical meaning.
 */
export function dialogueText(segments = [], { lang = "uk" } = {}) {
  const labels = ROLE_LABELS[lang] || ROLE_LABELS.en;
  const lines = [];
  let prevKey = Symbol("none");
  for (const seg of segments) {
    const text = String(seg.text || "").trim();
    if (!text) continue;
    const role = seg.speaker_role || null;
    const key = role !== null ? role : (seg.speaker || "unlabelled");
    const label = role ? labels[role] : labels.unknown;
    if (key === prevKey && lines.length) {
      lines[lines.length - 1] = `${lines[lines.length - 1]} ${text}`;
    } else {
      lines.push(`${label}: ${text}`);
    }
    prevKey = key;
  }
  return lines.join("\n");
}

// Segment UUIDs for the draft's `transcript_segment_ids` (sprint-08 linkage).
// Only conversation transcripts carry them; a dictation transcript has none and
// yields an empty list rather than a fabricated one.
export function segmentIds(segments = []) {
  return segments.map((s) => s && s.id).filter(Boolean);
}

// How much of the reviewed record is still honestly unattributed. Shown to the
// clinician before finalize — never blocking, because "I could not tell" is a
// legitimate answer that must be allowed to reach the record intact.
export function unattributedCount(segments = []) {
  return segments.filter((s) => !s.speaker_role).length;
}
