// chat/data/useSettings.js — feature-scoped preferences.
//
// Two settings that belong to this module: how much of each source the evidence
// panel shows, and which language answers come back in. Note that the ANSWER
// language is not the UI language — the host injects the second one, and a
// clinician reading a German-language guideline summary in an English interface
// is a normal thing to want.
//
// Persistence is localStorage, scoped per workspace. Note what is NOT stored:
// identity, and any patient. Who the user is arrives only as a prop, and the
// attached patient lives in memory for the session (§5, §10).

import { useCallback, useEffect, useState } from "react";

export const DEFAULT_SETTINGS = {
  evidenceDetail: "full",   // "compact" | "full"
  answerLanguage: "en",     // "en" | "de"
};

const keyFor = (scope) => `chat:settings:${scope || "default"}`;

function read(scope) {
  try {
    const raw = localStorage.getItem(keyFor(scope));
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

// A host can mount the module more than once on a page (the harness does,
// deliberately). Two mounts sharing a workspace share these settings, so a
// change in one has to reach the other — otherwise the same workspace answers
// in German in one panel and English in the next.
const listeners = new Set();
const broadcast = (scope, value) => listeners.forEach((fn) => fn(scope, value));

export function useSettings(scope) {
  const [settings, setSettings] = useState(() => read(scope));

  useEffect(() => { setSettings(read(scope)); }, [scope]);

  useEffect(() => {
    const onChange = (changedScope, value) => {
      if (changedScope === scope) setSettings(value);
    };
    listeners.add(onChange);
    return () => listeners.delete(onChange);
  }, [scope]);

  const update = useCallback((patch) => {
    setSettings((cur) => {
      const next = { ...cur, ...patch };
      try { localStorage.setItem(keyFor(scope), JSON.stringify(next)); } catch { /* private mode: in-memory is fine */ }
      broadcast(scope, next);
      return next;
    });
  }, [scope]);

  const reset = useCallback(() => {
    try { localStorage.removeItem(keyFor(scope)); } catch { /* ignore */ }
    const next = { ...DEFAULT_SETTINGS };
    setSettings(next);
    broadcast(scope, next);
  }, [scope]);

  return { settings, update, reset };
}
