// useGhostCompletion.js — Layer C (sprint 15): the hook behind ghost text.
//
// Interaction law, enforced here rather than by convention:
//
//   · Ghost text NEVER auto-inserts. The hook only ever holds a STRING and a
//     request id; insertion is a separate, explicit act performed by the editor
//     in one ProseMirror transaction. Nothing in this file can write to the
//     document.
//   · Stale ghosts die instantly. Four killers, all wired: new input (this
//     effect re-runs and clears first), cursor move / blur (the caret prefix
//     changes or goes null), and >2 s of irrelevance — both for a response that
//     arrives too late to still be about what the clinician is typing, AND for
//     a ghost that has sat on screen unclaimed.
//   · Silence is normal. 204 / timeout / dead service all resolve to "no
//     ghost", never to an error state. See api/generation.js.
//
// Shape deliberately mirrors sprint-10's useSuggestions (seq counter, settle
// timer, abort-on-supersede) so the two layers behave identically under the
// same fingers.

import { useCallback, useEffect, useRef, useState } from "react";
import { inlineCompletion } from "../api/generation.js";
import { isMidSentence } from "./midSentence.js";

// A settled pause, not a keystroke: 400 ms after the last change. Long enough
// that a fluent typist never sees a ghost mid-word, short enough that a pause
// to think is answered before the thought moves on.
export const SETTLE_MS = 400;

// The irrelevance budget. Serves twice: a response later than this is dropped
// unrendered, and a rendered ghost expires after this much untouched time.
export const STALE_MS = 2_000;

// 429 is the backend saying "you are asking too often" — the only correct
// answer is to stop asking for a while. Never surfaced to the user.
export const RATE_LIMIT_PAUSE_MS = 30_000;

const NO_GHOST = null;

export function useGhostCompletion({
  textBeforeCaret,   // block text before the caret, or null (blurred/selecting)
  enabled,           // tenant flag ∧ user pref ∧ not dictating ∧ Layer A silent
  reportId,          // required by the wire contract — no draft, no completion
  sectionKey,
  language = "uk",
  onShown,           // ({ requestId, prefix }) → telemetry `shown_only`
  onDismissed,       // ({ requestId, prefix, reason }) → telemetry `rejected`
  requestFn = inlineCompletion, // seam for unit tests
}) {
  const [ghost, setGhost] = useState(NO_GHOST);

  const seqRef = useRef(0);
  const ghostRef = useRef(NO_GHOST);
  ghostRef.current = ghost;
  const suppressUntilRef = useRef(0);
  const shownCbRef = useRef(onShown);
  shownCbRef.current = onShown;
  const dismissCbRef = useRef(onDismissed);
  dismissCbRef.current = onDismissed;

  // Clear + report, exactly once per shown ghost. Every death path funnels
  // through here so `shown_only` and `rejected` can never drift apart.
  const kill = useCallback((reason) => {
    const g = ghostRef.current;
    if (!g) return;
    ghostRef.current = NO_GHOST;
    setGhost(NO_GHOST);
    dismissCbRef.current?.({ requestId: g.requestId, prefix: g.prefix, reason });
  }, []);

  // Accept: the editor has already inserted the text. The hook's job is to stop
  // showing the ghost WITHOUT reporting a dismissal (the accept is its own
  // event, fired by the caller).
  const clearAccepted = useCallback(() => {
    seqRef.current++;
    ghostRef.current = NO_GHOST;
    setGhost(NO_GHOST);
  }, []);

  // Explicit dismissal from the keyboard / blur handlers.
  const dismiss = useCallback((reason = "input") => {
    seqRef.current++;
    kill(reason);
  }, [kill]);

  useEffect(() => {
    const seq = ++seqRef.current;
    // Any re-run means the world moved: the previous ghost is stale by
    // definition. Kill first, ask second.
    kill("input");

    if (!enabled || !reportId || !sectionKey) return undefined;
    if (textBeforeCaret == null) return undefined;         // blurred / range selection
    if (!isMidSentence(textBeforeCaret)) return undefined; // finished sentence → silence
    if (Date.now() < suppressUntilRef.current) return undefined; // 429 pause

    const controller = new AbortController();
    let staleTimer = null;

    const settle = setTimeout(async () => {
      // Irrelevance guard: whatever comes back after this deadline is about a
      // prefix the clinician has already moved past.
      staleTimer = setTimeout(() => controller.abort(), STALE_MS);
      const prefix = textBeforeCaret;
      let result = null;
      try {
        result = await requestFn(
          { reportId, sectionKey, textBeforeCursor: prefix, language },
          { signal: controller.signal },
        );
      } catch {
        result = null; // belt and braces — the client already swallows
      }
      clearTimeout(staleTimer);
      staleTimer = null;
      if (seqRef.current !== seq) return; // superseded while in flight

      if (result?.rateLimited) {
        suppressUntilRef.current = Date.now() + (result.retryAfterMs || RATE_LIMIT_PAUSE_MS);
        return;
      }
      if (!result?.completion) return; // 204 and friends — silence is the answer

      const next = { text: result.completion, requestId: result.requestId, prefix, model: result.model };
      ghostRef.current = next;
      setGhost(next);
      shownCbRef.current?.({ requestId: result.requestId, prefix });

      // …and it expires if nothing claims it.
      staleTimer = setTimeout(() => {
        if (seqRef.current === seq) kill("expired");
      }, STALE_MS);
    }, SETTLE_MS);

    return () => {
      clearTimeout(settle);
      if (staleTimer) clearTimeout(staleTimer);
      controller.abort();
    };
    // `kill` and `requestFn` are stable; listing them would re-fire the effect
    // on every render and turn the settle pause into a keystroke storm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textBeforeCaret, enabled, reportId, sectionKey, language]);

  return { ghost, dismiss, clearAccepted };
}
