// provenance.jsx — the honesty primitive for the owner console.
//
// This console mixes three kinds of number, and conflating them would be the
// single most damaging thing it could do: an owner who mistakes a placeholder
// MRR for a measured one makes real decisions on a made-up figure.
//
//   live    — read from a backend endpoint on this page load.
//   derived — computed in the browser from live values. Honest, but only as
//             good as its inputs and its assumptions, which the tooltip states.
//   mock    — a placeholder. NOT measured. Every mock value in the app comes
//             from src/company/mockData.js and nowhere else.
//
// Rule enforced by src/company/noInlineMocks.test.js: no panel may invent a
// number inline. If it is not live and not derived, it is imported from
// mockData.js, which makes the full inventory of fiction greppable in one file.

import React from "react";
import { Icon } from "../components/UI.jsx";
import { tr } from "../i18n.js";

export const SOURCES = {
  live:    { uk: "наживо",    en: "live",    icon: "pulse",  tone: "live" },
  derived: { uk: "похідне",   en: "derived", icon: "activity", tone: "derived" },
  mock:    { uk: "макет",     en: "mock",    icon: "alert",  tone: "mock" },
};

/**
 * Inline provenance badge.
 *
 * @param {"live"|"derived"|"mock"} source
 * @param {string} [note]  what makes it live / how it was derived / what would
 *                         make it real. Shown on hover; required for mock.
 */
export function Provenance({ source, note, lang = "en", compact = false }) {
  const s = SOURCES[source] || SOURCES.mock;
  const label = tr(lang, s.uk, s.en);
  return (
    <span className={`prov prov-${s.tone}${compact ? " compact" : ""}`} title={note || label}>
      <Icon name={s.icon} size={compact ? 9 : 10} />
      {!compact && <span>{label}</span>}
    </span>
  );
}

/** Legend, so the badges are self-explanatory the first time they are seen. */
export function ProvenanceLegend({ lang = "en", mockCount }) {
  const T = (uk, en) => tr(lang, uk, en);
  return (
    <div className="prov-legend">
      <Provenance source="live" lang={lang} />
      <span>{T("з бекенду на цьому завантаженні", "read from the backend on this load")}</span>
      <Provenance source="derived" lang={lang} />
      <span>{T("обчислено в браузері з живих значень", "computed in the browser from live values")}</span>
      <Provenance source="mock" lang={lang} />
      <span>
        <strong>{T("не виміряно — заповнювач", "not measured — placeholder")}</strong>
        {mockCount != null && ` (${mockCount})`}
      </span>
    </div>
  );
}

/**
 * Banner for a panel whose numbers are predominantly placeholders. Loud on
 * purpose: a quiet caveat under a big confident number is not a caveat.
 */
export function MockBanner({ lang = "en", what, need }) {
  const T = (uk, en) => tr(lang, uk, en);
  return (
    <div className="co-note co-note-mock" role="note">
      <Icon name="alert" size={14} />
      <span>
        <strong>{T("Показники-заповнювачі.", "Placeholder figures.")}</strong>{" "}
        {what}{" "}
        {need && (
          <>
            <br />
            <em>{T("Щоб стали справжніми:", "To make them real:")} {need}</em>
          </>
        )}
      </span>
    </div>
  );
}
