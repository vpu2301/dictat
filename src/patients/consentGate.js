// consentGate.js — sprint 11 step 05: the consent gate in front of recording.
//
// HONESTY NOTE (architecture): the backend does NOT reject a dictation
// session for missing consent — this gate is CLIENT-ENFORCED policy. That is
// why there is no override UI (there is no backend override to audit), and
// why the gate FAILS CLOSED: a consent fetch error blocks recording with a
// retry. This is the deliberate inverse of S10's fail-open autocomplete —
// suggestions are a convenience, consent is the lawful basis. Backend
// enforcement (a dictation-service consent check) is the named carry-over.

import { useState, useEffect, useRef, useCallback } from "react";
import { listConsents } from "../api/consents.js";

// The FE's ONE piece of consent business logic. Active =
//   type  = "ai_scribe"  (the gate's subject — recording consent)
//   status = "granted"
//   scope: patient-level (no encounter_id) covers every encounter; an
//          encounter-scoped consent counts only for ITS encounter.
// Exported for tests; call sites must never inline their own variant —
// this predicate WILL grow (expiry, per-type gates) and must grow here.
export function hasActiveAiScribeConsent(consents, { encounterId } = {}) {
  return (consents || []).some(
    (c) =>
      c &&
      c.type === "ai_scribe" &&
      c.status === "granted" &&
      (!c.encounter_id || c.encounter_id === encounterId)
  );
}

// useConsentGate(patientId, { encounterId }) →
//   { status: 'idle'|'loading'|'ok'|'required'|'error',
//     consents, refresh(), check() }
//
// `check()` re-fetches and returns { active, error } — recording start MUST
// call it on EVERY attempt (first start, resume, next segment): a consent
// withdrawn elsewhere mid-session blocks the next start. It cannot retroact
// on audio already captured — the withdraw dialog says so.
export function useConsentGate(patientId, { encounterId } = {}) {
  const [status, setStatus] = useState(patientId ? "loading" : "idle");
  const [consents, setConsents] = useState([]);
  const seqRef = useRef(0);
  const encRef = useRef(encounterId);
  encRef.current = encounterId;

  const evaluate = useCallback((list) =>
    hasActiveAiScribeConsent(list, { encounterId: encRef.current }) ? "ok" : "required", []);

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
      return { active: hasActiveAiScribeConsent(arr, { encounterId: encRef.current }), error: false };
    } catch {
      // fail CLOSED: unknown consent state blocks recording (see header)
      if (seq === seqRef.current) setStatus("error");
      return { active: false, error: true };
    }
  }, [patientId, evaluate]);

  useEffect(() => {
    setStatus(patientId ? "loading" : "idle");
    setConsents([]);
    if (patientId) refresh();
  }, [patientId, refresh]);

  return { status, consents, refresh, check: refresh };
}
