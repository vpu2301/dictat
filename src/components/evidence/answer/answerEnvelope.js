// answerEnvelope.js — the stream → envelope reducer (EVA-S04).
//
// The whole of the answer screen's logic, with none of React in it. A stream
// event goes in, a new state comes out, and `AnswerView` renders whatever the
// state says. That split is what makes the two properties this reducer exists
// for testable at all:
//
//   OUT OF ORDER.  A late web source arrives after `done`. A detail segment
//                  overtakes the summary segment it elaborates. The transport
//                  makes no promises and neither does the pipeline, which
//                  fans out to connectors that finish when they finish.
//
//   DUPLICATED.    A resumed stream replays. A retried connector re-emits its
//                  source. Rendering a claim twice is worse than losing it:
//                  a clinician reading "metformin is first line" twice has no
//                  way to know it is one finding, not two.
//
// Both are absorbed by identity, not by ordering: every collection is keyed
// (segments by `segment.id`, sources by `id`, checks by `rule_id`, followups
// and flags by their own ids) and a second event for a known key REPLACES
// rather than appends. Replace, not ignore — a resumed stream may carry a
// fuller version of the same segment, and the later copy is the better one.
//
// Terminality is a one-way door. Once `done`, `deflected` or `error` has been
// seen, a further terminal event cannot change the outcome — otherwise a
// stray `error` frame arriving behind a completed answer would blank a screen
// the clinician is already reading. Non-terminal events (a late source) are
// still accepted after `done`, which is the entire point of `late_sources`.
//
// Contract shapes (Segment, SourceRef, Flag, CheckResult, FollowUp,
// AnswerEnvelope) come from src/types/evidence — nothing here redeclares them.

import { orderSegments } from "./segmentKinds.js";

/** Terminal outcomes. Reaching one closes the stream's story. */
const TERMINAL = new Set(["done", "deflected", "error"]);

/**
 * ORDER IS NOT ARRIVAL ORDER, and for sources that is a correctness rule
 * rather than a nicety.
 *
 * Citation numbers are assigned from the envelope's `sources[]` position
 * (sourceView.js). If that position were "whichever connector answered
 * first", then `[1]` would mean a different document depending on network
 * timing — and a reopened answer, which gets the server's canonical order,
 * would renumber every citation in a document a clinician may have already
 * copied into a note. So `source` events carry an `index` exactly as
 * `segment` events do, and it is the index that orders them.
 *
 * A source without an index keeps its arrival position behind those that
 * have one, which is the same rule segments follow.
 */
function orderByIndex(entries) {
  return [...(entries || [])]
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const ai = Number.isFinite(a.e?.index) ? a.e.index : Number.MAX_SAFE_INTEGER;
      const bi = Number.isFinite(b.e?.index) ? b.e.index : Number.MAX_SAFE_INTEGER;
      return ai === bi ? a.i - b.i : ai - bi;
    })
    .map(({ e }) => e);
}

/** The sources this answer has, in their canonical order. */
export const sourcesOf = (state) => orderByIndex(state.sources).map((e) => e.source);

export function initialAnswerState(question = "") {
  return {
    question,
    answer_id: null,
    provenance_ref: null,
    contract_version: null,
    /** `null` until the service says. Never guessed. */
    status: null,
    /** [{ index, segment }] — ordering deferred to `orderSegments`. */
    summary: [],
    detail: [],
    /** [{ index, source }] — see `orderByIndex` for why the index matters. */
    sources: [],
    flags: [],
    checks: [],
    followups: [],
    /** Info-level, not errors: web_unavailable and its relatives. */
    notices: [],
    /** The service expects web sources it has not sent yet. */
    lateSourcesExpected: false,
    /** Terminal states, mutually exclusive. */
    deflection: null,
    error: null,
    done: false,
  };
}

const isTerminated = (s) => s.done || !!s.deflection || !!s.error;

/** Upsert by key, preserving position on replace. Never mutates the input. */
function upsert(list, item, keyOf) {
  const key = keyOf(item);
  if (key == null) return [...list, item];
  const at = list.findIndex((x) => keyOf(x) === key);
  if (at === -1) return [...list, item];
  const next = [...list];
  next[at] = item;
  return next;
}

const segmentKey = (entry) => entry?.segment?.id ?? null;

function addSegment(state, payload) {
  const segment = payload?.segment ?? payload;
  if (!segment || typeof segment.text !== "string" || !segment.kind) return state;
  const entry = {
    index: Number.isFinite(payload?.index) ? payload.index : null,
    segment,
  };
  // `area` decides which of the two lists it joins. An unrecognised area is
  // treated as detail: better an extra paragraph below the fold than a
  // segment the pipeline produced and the UI silently dropped.
  const area = payload?.area === "summary" ? "summary" : "detail";
  return { ...state, [area]: upsert(state[area], entry, segmentKey) };
}

/**
 * One event → the next state. Pure, total, and forgiving: an event name this
 * build does not know, or a payload missing its identity, returns the state
 * unchanged rather than throwing. A stream is not a place to be strict — the
 * frames after the bad one are usually the answer.
 */
export function reduceAnswerEvent(state, name, payload = {}) {
  // A terminal outcome is final. Late NON-terminal events are still welcome.
  if (TERMINAL.has(name) && isTerminated(state)) return state;

  switch (name) {
    case "meta":
      return {
        ...state,
        answer_id: payload.answer_id ?? state.answer_id,
        provenance_ref: payload.provenance_ref ?? state.provenance_ref,
        contract_version: payload.contract_version ?? state.contract_version,
        // `meta` may carry an early status (`insufficient_basis` is known
        // before the first segment). It must not overwrite a terminal one.
        status: state.status ?? payload.status ?? null,
      };

    case "segment":
      return addSegment(state, payload);

    case "source": {
      const source = payload?.source ?? payload;
      if (!source || !source.id) return state;
      const entry = { index: Number.isFinite(payload?.index) ? payload.index : null, source };
      return { ...state, sources: upsert(state.sources, entry, (e) => e.source?.id ?? null) };
    }

    case "late_sources_expected":
      return { ...state, lateSourcesExpected: payload?.expected !== false };

    case "flag": {
      const flag = payload?.flag ?? payload;
      if (!flag?.code) return state;
      return { ...state, flags: upsert(state.flags, flag, (f) => f.code) };
    }

    case "check": {
      const check = payload?.check ?? payload;
      if (!check?.rule_id) return state;
      return { ...state, checks: upsert(state.checks, check, (c) => c.rule_id) };
    }

    case "followup": {
      const f = payload?.followup ?? payload;
      if (!f?.id) return state;
      return { ...state, followups: upsert(state.followups, f, (x) => x.id) };
    }

    case "notice": {
      if (!payload?.code) return state;
      return { ...state, notices: upsert(state.notices, payload, (n) => n.code) };
    }

    // Triage refused to answer. NOT an error: the pipeline worked and its
    // answer is "not here". Terminal, and rendered as its own card.
    case "deflected":
      return {
        ...state,
        deflection: { reason: payload?.reason || "triage_deflected", message: payload?.message || "" },
        status: "deflected",
        done: true,
        lateSourcesExpected: false,
      };

    case "error":
      return {
        ...state,
        error: {
          code: payload?.code || "stream_error",
          message: payload?.message || "",
          retryAfterS: Number.isFinite(payload?.retry_after_s) ? payload.retry_after_s : null,
        },
        done: true,
        lateSourcesExpected: false,
      };

    case "done":
      return { ...state, status: payload?.status || state.status || "ok", done: true };

    default:
      return state;
  }
}

/** Fold a whole event list. The shuffled-fixture tests run through here. */
export function reduceAnswerEvents(state, events) {
  return (events || []).reduce((s, e) => reduceAnswerEvent(s, e.event ?? e.name, e.data ?? e.payload), state);
}

/**
 * State → the `AnswerEnvelope` shape, so the streamed path and the reopened
 * path (`GET /answers/:id`, which returns an envelope outright) render
 * through exactly one code path. AC-S04-F-3's "reopen equality" is this
 * function being the only assembler.
 */
export function envelopeFrom(state) {
  return {
    answer_id: state.answer_id,
    provenance_ref: state.provenance_ref,
    contract_version: state.contract_version,
    status: state.status || "ok",
    summary_segments: orderSegments(state.summary).map((e) => e.segment),
    detail_segments: orderSegments(state.detail).map((e) => e.segment),
    sources: sourcesOf(state),
    flags: state.flags,
    checks: state.checks,
    followups: state.followups,
  };
}

/**
 * A fetched envelope → the same state shape, so `AnswerView` cannot tell a
 * reopened answer from a finished stream. The inverse of `envelopeFrom`, and
 * the round trip is asserted in the unit tests.
 */
export function stateFromEnvelope(envelope, question = "") {
  const base = initialAnswerState(question);
  if (!envelope) return base;
  const wrap = (list) => (list || []).map((segment, index) => ({ index, segment }));
  return {
    ...base,
    answer_id: envelope.answer_id ?? null,
    provenance_ref: envelope.provenance_ref ?? null,
    contract_version: envelope.contract_version ?? null,
    status: envelope.status || "ok",
    summary: wrap(envelope.summary_segments),
    detail: wrap(envelope.detail_segments),
    // The stored order IS the canonical one, so it becomes the index.
    sources: (envelope.sources || []).map((source, index) => ({ index, source })),
    flags: envelope.flags || [],
    checks: envelope.checks || [],
    followups: envelope.followups || [],
    // A stored answer that was deflected reads as one, not as a blank page.
    deflection:
      envelope.status === "deflected"
        ? { reason: "triage_deflected", message: deflectionMessageFrom(envelope) }
        : null,
    done: true,
  };
}

/** A deflected envelope carries its explanation as a flag, not a segment. */
function deflectionMessageFrom(envelope) {
  const flag = (envelope.flags || []).find((f) => f.code === "triage_deflected");
  return flag?.message || "";
}

/**
 * Is the "checking current web sources…" chip still live?
 *
 * It resolves three ways, and all three must clear it — a chip that spins
 * forever is a worse lie than never showing one. Web sources arrived; the
 * service said web is unavailable; or the stream ended without either, which
 * means nothing more is coming.
 */
export function lateSourcesPending(state) {
  if (!state.lateSourcesExpected) return false;
  if (state.done) return false;
  if (state.sources.some((e) => e.source?.kind === "web")) return false;
  if (state.notices.some((n) => n.code === "web_unavailable")) return false;
  return true;
}

/** Does the answer have anything on screen yet? Drives the summary shimmer. */
export const hasContent = (state) =>
  state.summary.length > 0 || state.detail.length > 0 || !!state.deflection;
