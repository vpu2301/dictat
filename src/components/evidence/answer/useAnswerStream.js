// useAnswerStream.js — the stream's lifecycle (EVA-S04).
//
// Everything React about the answer, and nothing else: the reducer
// (answerEnvelope.js) decides what an event MEANS, this decides when a stream
// starts, when it stops, and what happens when it breaks. Keeping the two
// apart is what lets the hard part — out-of-order and duplicate events — be a
// `node --test` file instead of a Playwright flake.
//
// ── The drop, and why resume is a GET ─────────────────────────────────────
// A stream that ends without a terminal event has dropped. It is the single
// most likely failure in a clinic on hospital wifi, and the wrong recovery is
// re-asking: the question would be answered a second time, spending the
// pipeline's slot and possibly returning a DIFFERENT answer to the same
// question, which is the one thing a clinical tool must not do. So resume
// re-reads the answer the service already has, by id, with an ordinary GET.
//
// That is why `meta` is the first event the service sends: until the answer
// has an id, a drop is genuinely unrecoverable and the UI has to say so.
//
// ── One question at a time ────────────────────────────────────────────────
// A second `ask()` while one is streaming aborts the first. The server caps
// concurrency per user anyway; doing it here as well means the UI never shows
// two half-answers racing to fill the same column.

import { useCallback, useEffect, useRef, useState } from "react";
import { createAnswerStream, getAnswer, isOverloaded, retryAfterSeconds } from "../../../api/evidenceAnswers.js";
import {
  envelopeFrom,
  hasContent,
  initialAnswerState,
  lateSourcesPending,
  reduceAnswerEvent,
  stateFromEnvelope,
} from "./answerEnvelope.js";

/** A stream that ended with no terminal event and no id to resume from. */
const DROPPED_UNRECOVERABLE = "stream_dropped_no_id";

export function useAnswerStream({ locale } = {}) {
  const [state, setState] = useState(() => initialAnswerState(""));
  const [streaming, setStreaming] = useState(false);
  /** Transport-level failure, distinct from an `error` event inside the stream. */
  const [transportError, setTransportError] = useState(null);
  const [resuming, setResuming] = useState(false);

  const streamRef = useRef(null);
  // The reducer's own view of the state, so the SSE callbacks are not closing
  // over a stale render. `setState` still drives the paint; this is the copy
  // the drop handler reads to decide whether the answer is resumable.
  const stateRef = useRef(state);
  const mountedRef = useRef(true);

  const apply = useCallback((next) => {
    stateRef.current = next;
    setState(next);
  }, []);

  // The flag must be SET on mount, not just cleared on unmount. React 18's
  // StrictMode mounts, unmounts and remounts every component in development;
  // a `mountedRef` that is only ever set false by the cleanup stays false
  // forever after that first throwaway cycle, and every stream event lands on
  // a component that believes it is gone. The symptom is a permanent shimmer.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      streamRef.current?.close();
    };
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.close();
    streamRef.current = null;
    setStreaming(false);
  }, []);

  /** GET the finished answer — used for both resume and reopen. */
  const hydrate = useCallback(
    async (answerId, question) => {
      setResuming(true);
      setTransportError(null);
      try {
        const envelope = await getAnswer(answerId);
        if (!mountedRef.current) return;
        // Where the echoed question comes from, in order of authority: the
        // service (it stored what was asked), then whatever this tab
        // remembered, then whatever is already on screen — which on a resume
        // is the live question and is therefore right.
        const asked = envelope?.question || question || stateRef.current.question;
        apply(stateFromEnvelope(envelope, asked));
      } catch (e) {
        if (mountedRef.current) setTransportError(e);
      } finally {
        if (mountedRef.current) setResuming(false);
      }
    },
    [apply],
  );

  const ask = useCallback(
    (question) => {
      streamRef.current?.close();
      const fresh = initialAnswerState(question);
      apply(fresh);
      setTransportError(null);
      setStreaming(true);

      // A stream that OPENED and then failed is a drop, however it failed.
      // The two shapes look different and mean the same thing: a server that
      // closes cleanly mid-answer resolves the read loop (`onDone` with no
      // terminal event), while a socket killed by a proxy, a lost wifi
      // association or a laptop lid makes the pending `read()` throw. Both
      // leave a half-answer on screen and both are recovered by re-reading
      // the answer by id — so both are classified here, together, and the
      // raw error is only surfaced when the request never opened at all.
      let opened = false;
      const classifyDrop = () => {
        const s = stateRef.current;
        if (s.done) return null;
        return s.answer_id
          ? { code: "stream_dropped", answerId: s.answer_id }
          : { code: DROPPED_UNRECOVERABLE };
      };

      streamRef.current = createAnswerStream(
        { question, mode: "quick", locale },
        {
          onOpen: () => { opened = true; },
          onEvent: (name, payload) => {
            if (!mountedRef.current) return;
            apply(reduceAnswerEvent(stateRef.current, name, payload));
          },
          onDone: () => {
            if (!mountedRef.current) return;
            setStreaming(false);
            streamRef.current = null;
            const drop = classifyDrop();
            if (drop) setTransportError(drop);
          },
          onError: (e) => {
            if (!mountedRef.current) return;
            setStreaming(false);
            streamRef.current = null;
            // Never opened ⇒ the request itself failed (503, network, 401
            // after a failed refresh). That error is the honest one to show.
            setTransportError(opened ? classifyDrop() || e : e);
          },
        },
      );
    },
    [apply, locale],
  );

  /** Reopen mode: hydrate from an id with no stream at all. */
  const open = useCallback((answerId, question) => { hydrate(answerId, question); }, [hydrate]);

  /**
   * Recover from a drop. Resumes by id when there is one; otherwise the only
   * honest recovery is asking again, and the caller is told which it is via
   * `resumable`.
   */
  const resume = useCallback(() => {
    const id = transportError?.answerId || stateRef.current.answer_id;
    if (id) return hydrate(id);
    if (stateRef.current.question) ask(stateRef.current.question);
    return undefined;
  }, [ask, hydrate, transportError]);

  const retry = useCallback(() => {
    if (stateRef.current.question) ask(stateRef.current.question);
  }, [ask]);

  const reset = useCallback(() => {
    streamRef.current?.close();
    streamRef.current = null;
    setStreaming(false);
    setTransportError(null);
    apply(initialAnswerState(""));
  }, [apply]);

  return {
    state,
    envelope: envelopeFrom(state),
    streaming,
    resuming,
    /** The chip: web sources are still expected and have not landed. */
    lateSourcesPending: lateSourcesPending(state),
    hasContent: hasContent(state),
    /** An `error` event inside the stream, or a transport failure outside it. */
    error: transportError || state.error || null,
    /** True when the failure is a drop we can re-read rather than re-ask. */
    resumable: !!(transportError?.answerId || (transportError && state.answer_id)),
    overloaded: isOverloaded(transportError) || state.error?.code === "pipeline_overloaded",
    retryAfterS: state.error?.retryAfterS ?? retryAfterSeconds(transportError),
    ask,
    open,
    resume,
    retry,
    reset,
    stop,
  };
}
