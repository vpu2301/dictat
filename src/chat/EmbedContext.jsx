// chat/EmbedContext.jsx — everything the host lends the feature screens that is
// not identity: where we are mounted, how to navigate, how to report telemetry,
// the UI language, the feature settings, and the patient context.
//
// Screens use `navigate()` and `emit()` from here. They never touch `location`,
// never render an <a href> that would reload the host page, and never call an
// analytics SDK — all three are the host's to own (§5).
//
// The patient slice deserves its own note. `patient` is whatever is attached
// right now; `patientLocked` is true when the HOST injected it, which makes it
// fixed for the session — a chat opened from a patient's chart must not let
// someone quietly swap the patient underneath the same thread.

import React, { createContext, useContext } from "react";

const EmbedContext = createContext(null);

export function EmbedProvider({ value, children }) {
  return <EmbedContext.Provider value={value}>{children}</EmbedContext.Provider>;
}

export function useEmbed() {
  const ctx = useContext(EmbedContext);
  if (!ctx) {
    throw new Error("useEmbed() outside <ChatEmbed> — the module must be mounted by its entry component.");
  }
  return ctx;
}
