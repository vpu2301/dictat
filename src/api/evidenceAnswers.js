// evidenceAnswers.js — the answer API on evidence-answer (:8013), EVA-S04.
//
// Same shape as `evidenceRetrieval.js`: thin calls through the shared client,
// with the request builders kept PURE so the contract can be asserted without
// a browser or a server. Payload shapes come from src/types/evidence
// (generated, EVA-S01) and nothing here redeclares them.
//
// ── The stream ────────────────────────────────────────────────────────────
// `POST /answers` responds `text/event-stream`. The envelope is assembled from
// the frames by a pure reducer (components/evidence/answer/answerEnvelope.js);
// this module's job stops at "a named event with a parsed JSON payload".
//
// The event vocabulary, which is the wire contract this sprint pins:
//
//   meta                   { answer_id, provenance_ref, contract_version }
//   segment                { area: "summary"|"detail", index, segment: Segment }
//   source                 { source: SourceRef }
//   late_sources_expected  { }            web connectors still running
//   flag | check | followup{ … }          envelope side-channels
//   notice                 { code, message }   web_unavailable & friends: INFO
//   deflected              { reason, message } triage refused — terminal, not an error
//   error                  { code, message, retry_after_s? }   terminal
//   done                   { status }     terminal, success
//
// Two properties the reducer relies on and the transport does not guarantee:
// events may arrive OUT OF ORDER (a late web source lands after `done` is
// queued) and may be DUPLICATED (a resumed stream replays what it already
// sent). Everything carries an identity so both are absorbed rather than
// rendered twice — see answerEnvelope.js.

import { apiAt, streamAt } from "./client.js";
import { readSseStream } from "./sse.js";
import { SERVICES } from "./services.js";

/** Query-string builder: omits blank values rather than sending `?x=`. */
function q(params) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === "") continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

/** Question modes this sprint offers. S06+ adds the patient-context modes. */
export const ASK_MODES = ["quick"];

/**
 * Form state → the POST /answers body.
 *
 * Pure, and the only place the request shape is decided. `mode` is always
 * sent: "quick" is a real choice the server logs, and defaulting silently
 * would make a S06 patient-context regression invisible here.
 *
 * `locale` is the UI language, NOT the answer language. The answer comes back
 * in the language of the question — the backend decides that from the text —
 * and this only tells the service which language to render its own fixed
 * strings (deflection copy, check narratives) in.
 */
export function buildAskRequest({ question, mode = "quick", locale } = {}) {
  const body = { question: String(question || "").trim(), mode: ASK_MODES.includes(mode) ? mode : "quick" };
  if (locale) body.locale = String(locale);
  return body;
}

/** A question the service would reject, decided before a request is spent. */
export const MIN_QUESTION_CHARS = 3;
export const MAX_QUESTION_CHARS = 2000;
export function askIssues(question) {
  const text = String(question || "").trim();
  const issues = [];
  if (text.length < MIN_QUESTION_CHARS) issues.push("too_short");
  if (text.length > MAX_QUESTION_CHARS) issues.push("too_long");
  return issues;
}
export const canAsk = (question) => askIssues(question).length === 0;

/**
 * Open the answer stream.
 *
 * `handlers` is { onEvent(name, payload), onOpen(), onDone(), onError(err) }.
 * Returns `{ close() }` — call it on unmount or when the user asks again.
 *
 * A frame whose `data` is not JSON is dropped rather than thrown on: the one
 * thing worse than a malformed event is a malformed event that kills a stream
 * whose other ninety events were fine.
 */
export function createAnswerStream({ question, mode = "quick", locale } = {}, handlers = {}) {
  const controller = new AbortController();
  const { onEvent, onOpen, onDone, onError } = handlers;

  (async () => {
    let response;
    try {
      response = await streamAt(SERVICES.evidenceAnswer, "/answers", {
        method: "POST",
        body: JSON.stringify(buildAskRequest({ question, mode, locale })),
        signal: controller.signal,
      });
    } catch (e) {
      if (!controller.signal.aborted) onError?.(e);
      return;
    }
    onOpen?.(response);
    try {
      await readSseStream(
        response,
        (frame) => {
          if (frame.event === "message" && !frame.data) return;   // keepalive
          let payload = null;
          try { payload = frame.data ? JSON.parse(frame.data) : {}; } catch { return; }
          onEvent?.(frame.event, payload);
        },
        { signal: controller.signal },
      );
      if (!controller.signal.aborted) onDone?.();
    } catch (e) {
      if (!controller.signal.aborted) onError?.(e);
    }
  })();

  return { close: () => controller.abort() };
}

/**
 * GET /answers/:id — the finished envelope.
 *
 * Serves two jobs that are the same request: reopening an answer from history,
 * and RESUMING one whose stream dropped. That equivalence is a requirement on
 * the service, not a convenience: a stream that cannot be re-read as a
 * document turns every flaky connection into a lost answer.
 */
export const getAnswer = (id) => apiAt(SERVICES.evidenceAnswer, `/answers/${encodeURIComponent(id)}`);

/** GET /questions — the asker's own history, cursor-paged. */
export const listQuestions = (cursor) =>
  apiAt(SERVICES.evidenceAnswer, `/questions${q({ cursor })}`);

/** GET /suggestions — the example-question bank. Flag-gated (evidenceSuggestions). */
export const getSuggestions = (specialty) =>
  apiAt(SERVICES.evidenceAnswer, `/suggestions${q({ specialty })}`);

/**
 * The pipeline is saturated: a real, retryable "come back in a moment", NOT a
 * question the caller got wrong. The UI counts down and re-asks; every other
 * error gets the ordinary error card.
 */
export function isOverloaded(error) {
  if (!error) return false;
  const code = error.problem?.code || error.problem?.detail?.code || error.code;
  return error.status === 429 || error.status === 503 || code === "pipeline_overloaded";
}

/** Seconds to wait before a retry, when the service said. Defaults to 10. */
export function retryAfterSeconds(error, fallback = 10) {
  const raw = error?.problem?.retry_after_s ?? error?.retry_after_s;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
