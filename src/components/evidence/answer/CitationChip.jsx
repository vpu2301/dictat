// CitationChip.jsx — the inline `[n]` marker (EVA-S04).
//
// A button, never a link. It opens the source drawer at the passage; it does
// not navigate, and with `evidenceExternalLinks` off nothing in this module
// navigates out of the app at all (AC-S04-F-4). Making it a `<button>` is also
// what gets it the right keyboard behaviour and the right screen-reader role
// for free.
//
// A citation whose source has not arrived yet renders as a PENDING marker
// rather than disappearing: the text under a streaming answer must not
// reflow as sources land, and "this sentence is cited, the source is still
// coming" is true and worth showing.

import React from "react";
import { useI18n } from "../../../i18n.js";
import { sourceLabel } from "./sourceView.js";

export function CitationChip({ citation, onOpen }) {
  const { t } = useI18n();
  const pending = !citation?.source || !Number.isFinite(citation.number);

  if (pending) {
    return (
      <span className="evd-cite evd-cite-pending" data-testid="citation-pending"
            aria-label={t("answer.citation_pending")}>
        […]
      </span>
    );
  }

  const label = sourceLabel(citation.source);
  return (
    <button
      type="button"
      className="evd-cite"
      data-testid="citation-chip"
      data-source-id={citation.source_id}
      data-number={citation.number}
      // "Source 3: NICE hypertension guideline" — the number alone tells a
      // screen-reader user nothing about what they are about to open.
      aria-label={t("answer.citation_label", { n: citation.number, title: label })}
      onClick={() => onOpen?.(citation.source_id)}
    >
      [{citation.number}]
    </button>
  );
}
