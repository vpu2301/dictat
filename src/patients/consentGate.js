// consentGate.js — sprint 11 step 05: the consent gate in front of recording.
//
// HONESTY NOTE (architecture): for DICTATION the backend does not reject a
// session for missing consent — that gate is CLIENT-ENFORCED policy. That is
// why there is no override UI (there is no backend override to audit), and
// why the gate FAILS CLOSED: a consent fetch error blocks recording with a
// retry. This is the deliberate inverse of S10's fail-open autocomplete —
// suggestions are a convenience, consent is the lawful basis.
//
// For CONVERSATION mode (sprint 14) the backend DOES enforce: a conversation
// start without a granted `recording` consent for the encounter's patient is
// refused with `error{code: consent_required}` before a single audio frame is
// accepted, and audited as `conversation.consent_refused`. The gate still runs
// first — a clinician should meet a consent sheet, not a socket error, and the
// microphone should never open for a recording that will be refused.

import { useState, useEffect, useRef, useCallback } from "react";
import { listConsents } from "../api/consents.js";

// Consent types this app gates on. They are DIFFERENT LAWFUL BASES, not
// synonyms, and the backend treats them as such:
//   ai_scribe — dictating the clinician's own voice into a note (S11)
//   recording — recording the CONSULTATION, i.e. the patient's own voice
//               (S14 conversation mode; dictation-service
//               domain/consents.py CONSENT_TYPE_RECORDING, approved text at
//               infra/seeds/consents/recording-v1.md)
// An ai_scribe consent does NOT authorise recording the patient, so
// conversation mode must never be satisfied by one.
export const CONSENT_TYPE_AI_SCRIBE = "ai_scribe";
export const CONSENT_TYPE_RECORDING = "recording";

// The FE's ONE piece of consent business logic. Active =
//   type   = the requested type (exact match — no substitutions)
//   status = "granted"
//   scope: patient-level (no encounter_id) covers every encounter; an
//          encounter-scoped consent counts only for ITS encounter.
// Exported for tests; call sites must never inline their own variant —
// this predicate WILL grow (expiry, per-type gates) and must grow here.
export function hasActiveConsent(consents, { encounterId, type = CONSENT_TYPE_AI_SCRIBE } = {}) {
  return (consents || []).some(
    (c) =>
      c &&
      c.type === type &&
      c.status === "granted" &&
      (!c.encounter_id || c.encounter_id === encounterId)
  );
}

// Named alias kept for the S11 call sites and their matrix test.
export function hasActiveAiScribeConsent(consents, { encounterId } = {}) {
  return hasActiveConsent(consents, { encounterId, type: CONSENT_TYPE_AI_SCRIBE });
}

// useConsentGate(patientId, { encounterId }) →
//   { status: 'idle'|'loading'|'ok'|'required'|'error',
//     consents, refresh(), check() }
//
// `check()` re-fetches and returns { active, error } — recording start MUST
// call it on EVERY attempt (first start, resume, next segment): a consent
// withdrawn elsewhere mid-session blocks the next start. It cannot retroact
// on audio already captured — the withdraw dialog says so.
export function useConsentGate(patientId, { encounterId, type = CONSENT_TYPE_AI_SCRIBE } = {}) {
  const [status, setStatus] = useState(patientId ? "loading" : "idle");
  const [consents, setConsents] = useState([]);
  const seqRef = useRef(0);
  const encRef = useRef(encounterId);
  encRef.current = encounterId;
  const typeRef = useRef(type);
  typeRef.current = type;

  const evaluate = useCallback((list) =>
    hasActiveConsent(list, { encounterId: encRef.current, type: typeRef.current }) ? "ok" : "required", []);

  const refresh = useCallback(async () => {
    if (!patientId) { setStatus("idle"); return { active: false, error: false }; }
    const seq = ++seqRef.current;
    try {
      const list = await listConsents(patientId);
      const arr = Array.isArray(list) ? list : [];
      if (seq === seqRef.current) {
        setConsents(arr);
        setStatus(evaluate(arr));
      }
      return {
        active: hasActiveConsent(arr, { encounterId: encRef.current, type: typeRef.current }),
        error: false,
      };
    } catch {
      // fail CLOSED: unknown consent state blocks recording (see header)
      if (seq === seqRef.current) setStatus("error");
      return { active: false, error: true };
    }
  }, [patientId, evaluate]);

  // `type` is in the deps so a screen that gates on a different lawful basis
  // re-evaluates instead of inheriting the previous type's verdict.
  useEffect(() => {
    setStatus(patientId ? "loading" : "idle");
    setConsents([]);
    if (patientId) refresh();
  }, [patientId, type, refresh]);

  return { status, consents, refresh, check: refresh };
}
