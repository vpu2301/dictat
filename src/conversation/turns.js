// turns.js — the conversation transcript model (sprint 14).
//
// Folds the v2 partial/final stream into speaker TURNS. Pure functions over a
// plain state object so the whole model is testable under node; the React
// surface (ConversationRoom.jsx) only renders what comes out of here.
//
// THE HONESTY RULES THIS MODEL ENFORCES (dictation-ws-v2.md §"The honesty
// principle") — every one of them is a test in turns.test.js:
//
//   1. TEXT IS NEVER HELD FOR A LABEL. A segment with `speaker: null` renders
//      immediately in its own turn and is marked `pending`. Diarization trails
//      the text by up to one window; a UI that waits for the label shows the
//      clinician a blank screen while someone is talking.
//   2. A LABEL MAY ARRIVE, NEVER CHANGE. null → "S1" is a resolution and is
//      applied to the already-rendered segment (this is the backfill). "S1" →
//      "S2" on the same seq is a retro-lie and is refused: committed labels do
//      not silently change (the doctor/patient MAPPING over labels is what
//      moves — see mapping.js).
//   3. UNKNOWN IS AN ANSWER, NOT A GAP. It gets its own visible turn; it is
//      never merged into a neighbour and never guessed into S1/S2.
//   4. A CLINICIAN-CORRECTED TURN IS CLOSED. New machine segments never merge
//      into it — extending a correction to text the clinician never reviewed
//      would launder a proposal into a confirmation.

// Speaker labels are anonymous on the wire. Roles live in mapping.js.
export const UNKNOWN = "UNKNOWN";
export const SPEAKER_LABELS = ["S1", "S2"];

export function emptyTurns() {
  return {
    turns: [],          // [{ id, speaker, confidence, source, segments, text }]
    partial: null,      // { seq, text, speaker } — the live, uncommitted tail
    seqIndex: {},       // seq → turn id, so a resolution can find its segment
    lastSeq: -1,
  };
}

const isLabel = (s) => s === "S1" || s === "S2";

function segmentsText(segments) {
  return segments.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim();
}

// A turn accepts a new segment only when the machine put it with the same
// voice AND no clinician has ruled on the turn yet (rule 4). `null` (pending)
// segments group with each other so an unlabeled stretch stays one bubble
// instead of shattering into one bubble per window.
function accepts(turn, speaker) {
  if (!turn) return false;
  if (turn.source === "clinician") return false;
  return turn.speaker === speaker;
}

/**
 * Apply a v2 `final` frame. Idempotent per seq: a repeated final updates the
 * existing segment (this is how a trailing label lands) instead of appending
 * the text twice.
 */
export function applyFinal(state, msg) {
  const seq = Number(msg.seq);
  const speaker = msg.speaker ?? null;
  const confidence = msg.speaker_confidence ?? null;

  // ── already-seen seq: this is a resolution, not new content (rule 2) ──
  const knownTurnId = state.seqIndex[seq];
  if (knownTurnId != null) {
    if (!isLabel(speaker) && speaker !== UNKNOWN) return state;
    let resolved = false;
    const turns = state.turns.map((t) => {
      if (t.id !== knownTurnId) return t;
      const segments = t.segments.map((s) => {
        if (s.seq !== seq || s.speaker != null) return s;
        resolved = true;
        return { ...s, speaker, confidence, pending: false };
      });
      if (!resolved) return t;
      // The turn itself resolves only when it was wholly pending and the
      // clinician has not overruled it.
      const resolvable = t.speaker == null && t.source === "machine";
      return {
        ...t,
        segments,
        speaker: resolvable ? speaker : t.speaker,
        confidence: resolvable ? confidence : t.confidence,
      };
    });
    return resolved ? { ...state, turns } : state;
  }

  const segment = {
    seq,
    text: String(msg.text || ""),
    start_ms: msg.start_ms ?? null,
    end_ms: msg.end_ms ?? null,
    speaker,
    confidence,
    pending: speaker == null,
  };
  if (!segment.text) return state;

  const last = state.turns[state.turns.length - 1];
  // UNKNOWN never merges (rule 3): two ambiguous stretches are two separate
  // things the clinician has to look at, not one blob.
  const merge = speaker !== UNKNOWN && accepts(last, speaker);

  let turns;
  let turnId;
  if (merge) {
    turnId = last.id;
    const segments = [...last.segments, segment];
    turns = [
      ...state.turns.slice(0, -1),
      { ...last, segments, text: segmentsText(segments) },
    ];
  } else {
    turnId = `t${seq}`;
    turns = [
      ...state.turns,
      {
        id: turnId,
        speaker,
        confidence,
        source: "machine",
        segments: [segment],
        text: segment.text,
      },
    ];
  }

  return {
    ...state,
    turns,
    seqIndex: { ...state.seqIndex, [seq]: turnId },
    lastSeq: Math.max(state.lastSeq, seq),
    // The committed text supersedes whatever the live tail was showing.
    partial: state.partial && state.partial.seq === seq ? null : state.partial,
  };
}

/**
 * Apply a v2 `partial`. It is the live tail: one at a time, replaced wholesale,
 * rendered even when `speaker` is null (rule 1). It is NOT a turn — it never
 * enters `turns`, so a revision can't leave a ghost bubble behind.
 */
export function applyPartial(state, msg) {
  const text = String(msg.text || "");
  if (!text) return { ...state, partial: null };
  return {
    ...state,
    partial: {
      seq: Number(msg.seq),
      text,
      speaker: msg.speaker ?? null,
      confidence: msg.speaker_confidence ?? null,
    },
  };
}

export function clearPartial(state) {
  return state.partial ? { ...state, partial: null } : state;
}

/**
 * The clinician's ruling on one turn. `speaker` is "S1" | "S2" | UNKNOWN — the
 * voice, not the role; roles are resolved through the mapping at render time,
 * so a correction survives a later mapping swap.
 *
 * Marks the turn `source: "clinician"`, which is what the proposal grammar
 * renders solid (confirmed) instead of dashed (proposed), and what closes the
 * turn to further machine merging.
 */
export function setTurnSpeaker(state, turnId, speaker) {
  let changed = false;
  const turns = state.turns.map((t) => {
    if (t.id !== turnId) return t;
    if (t.speaker === speaker && t.source === "clinician") return t;
    changed = true;
    return {
      ...t,
      speaker,
      confidence: null,       // a clinician's answer is not a probability
      source: "clinician",
      segments: t.segments.map((s) => ({ ...s, speaker, pending: false })),
    };
  });
  return changed ? { ...state, turns } : state;
}

// One-tap flip: the other known voice. From UNKNOWN/pending there is no "other"
// voice to flip to, so the first tap claims S1 and the menu covers the rest.
export function flipSpeaker(speaker) {
  if (speaker === "S1") return "S2";
  if (speaker === "S2") return "S1";
  return "S1";
}

/**
 * Re-seed the model from a resumed session's committed transcript (v2 resume
 * preserves turns + labels up to the committed high-water mark). Segment order
 * is the wire order; grouping is recomputed by the same rules, so a resumed
 * screen is indistinguishable from an uninterrupted one.
 */
export function fromCommitted(segments = []) {
  let state = emptyTurns();
  for (const seg of segments) {
    state = applyFinal(state, {
      seq: seg.seq,
      text: seg.text,
      start_ms: seg.start_ms,
      end_ms: seg.end_ms,
      speaker: seg.speaker ?? null,
      speaker_confidence: seg.speaker_confidence ?? null,
    });
  }
  return state;
}

// Every turn the clinician ruled on, for the finalize payload.
export function corrections(state) {
  return state.turns
    .filter((t) => t.source === "clinician")
    .flatMap((t) => t.segments.map((s) => ({ seq: s.seq, start_ms: s.start_ms, speaker: t.speaker })));
}

// Turns whose voice is still unresolved — what the review pass asks about
// before finalize. Counted, never blocking: an honestly-unknown turn is a
// legitimate final state.
export function unresolvedCount(state) {
  return state.turns.filter((t) => t.speaker == null || t.speaker === UNKNOWN).length;
}
