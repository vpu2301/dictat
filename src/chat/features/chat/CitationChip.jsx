// chat/features/chat/CitationChip.jsx — the inline [1] marker.
//
// A button, not a superscript: it opens the evidence panel and highlights the
// source it points at, which is the whole promise of "evidence-based". The
// title carries the source name so hovering answers the question without a
// click, and the accessible name spells out what the bare number means.

import React from "react";
import { t } from "../../i18n.js";
import { sourceTypeLabel } from "../../ui/Bits.jsx";

export function CitationChip({ index, evidence, active, onSelect, locale = "en", answerLanguage = "en" }) {
  const title = evidence.title;
  return (
    <button
      type="button"
      className={`ec-cite${active ? " on" : ""}`}
      onClick={() => onSelect?.(evidence)}
      title={`${title} · ${sourceTypeLabel(evidence.sourceType, locale, answerLanguage)} ${evidence.year}`}
      aria-label={`${t(locale, "Джерело", "Source")} ${index}: ${title}`}
    >
      {index}
    </button>
  );
}
