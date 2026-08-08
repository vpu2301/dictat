// SuggestionChips.jsx — the specialty question bank (EVA-S04).
//
// Behind `FEATURES.evidenceSuggestions` and silent about its own absence: with
// the flag off this renders nothing, no placeholder and no "suggestions
// unavailable" line. The flag is off because the backend has no question bank
// deployed, and a slot explaining that to a clinician is a slot spent on our
// deployment schedule instead of their question.
//
// Failure is silent for the same reason. `/suggestions` is a nicety; an error
// card where four example chips would have been makes a working screen look
// broken.

import React from "react";
import { useI18n } from "../../../i18n.js";
import { useAsync } from "../../../api/useAsync.js";
import { FEATURES } from "../../../api/services.js";
import { getSuggestions } from "../../../api/evidenceAnswers.js";

/** Whatever key the service wrapped its list in, as strings. */
export function suggestionTexts(response) {
  const raw = response?.suggestions ?? response?.items ?? (Array.isArray(response) ? response : []);
  return raw
    .map((s) => (typeof s === "string" ? s : s?.question || s?.text || ""))
    .map((s) => s.trim())
    .filter(Boolean);
}

export function SuggestionChips({ specialty, onPick, disabled }) {
  const { t } = useI18n();
  const enabled = !!FEATURES.evidenceSuggestions;
  const req = useAsync(() => getSuggestions(specialty), [specialty], { enabled });

  if (!enabled || req.loading || req.error) return null;
  const items = suggestionTexts(req.data);
  if (items.length === 0) return null;

  return (
    <div className="evd-suggestions" data-testid="suggestions">
      <span className="evd-hint">{t("ask.suggestions")}</span>
      <ul className="evd-chips evd-suggestion-list">
        {items.map((s) => (
          <li key={s}>
            <button type="button" className="evd-chip evd-suggestion" disabled={disabled}
                    onClick={() => onPick(s)} data-testid="suggestion">
              {s}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
