// DataStates.jsx — shared loading / error / empty rendering for screens that
// fetch from the backend via useAsync(). Keeps every screen's load/empty/error
// handling identical instead of re-implementing it per component.

import React from "react";
import { Empty } from "./UI.jsx";
import { ApiErrorView } from "./ApiErrorView.jsx";

export function Loading({ lang = "en" }) {
  return (
    <div className="data-loading" role="status" aria-live="polite"
         style={{ padding: 36, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
      <span className="data-spinner" aria-hidden="true" />
      {lang === "uk" ? "Завантаження…" : "Loading…"}
    </div>
  );
}

// Normalize the various shapes a list endpoint can return into an array.
// The report-service search endpoint returns `{ hits }` (not `{ items }`),
// so recognise that key too — otherwise report lists silently read as empty.
export function asList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.hits)) return data.hits;
  return [];
}

function isEmpty(data) {
  if (data == null) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (Array.isArray(data.items)) return data.items.length === 0;
  if (Array.isArray(data.hits)) return data.hits.length === 0;
  return false;
}

// Render-prop gate: handles loading + error + (optional) empty, then calls
// children(data) for the happy path.
export function LoadGate({ req, lang = "en", empty, children }) {
  if (req.loading) return <Loading lang={lang} />;
  if (req.error)   return <ApiErrorView error={req.error} lang={lang} />;
  if (empty && isEmpty(req.data)) {
    return typeof empty === "function" ? empty() : empty;
  }
  return children(req.data);
}
