// BreakGlassBanner.jsx — the standing reminder that this record was opened on
// an exception.
//
// Not dismissable. That is the entire design: a banner you can close is a
// banner that is closed within ten seconds and never seen again, and the fact
// it carries — you are reading the chart of someone you have no standing
// relationship with, under a reason you gave, and every read is counted —
// is the one fact that must not fade into the chrome.
//
// It states the reason back in the viewer's own words. "Доступ у режимі
// розбити скло" alone is a status; "…— зафіксовано: безперервність надання
// допомоги" is an account of what they said they were doing, which is what
// makes it uncomfortable enough to work.

import React from "react";

import { Icon } from "../components/UI.jsx";
import { minutesLeft } from "./breakGlass.js";
import { tr } from "../i18n.js";

export function BreakGlassBanner({ entry, lang = "uk" }) {
  if (!entry) return null;
  const left = minutesLeft(entry);
  return (
    <div
      className="bg-banner"
      role="status"
      aria-live="polite"
      data-testid="break-glass-banner"
      data-reason={entry.reasonCode}
      title={entry.note || undefined}
    >
      <Icon name="shield" size={14} />
      <span className="bg-banner-b">
        <strong>
          {tr(lang, "Доступ у режимі «розбити скло»", "Break-glass access")}
        </strong>
        <span className="bg-banner-reason">
          {tr(lang, " — зафіксовано: ", " — recorded as: ")}
          {entry.reasonLabel}
        </span>
      </span>
      {/* The clock is part of the pressure: this is temporary, and saying so
          discourages treating a break-glass grant as a working session. */}
      {left > 0 && (
        <span className="bg-banner-ttl">
          {tr(lang, `ще ${left} хв`, `${left} min left`)}
        </span>
      )}
    </div>
  );
}
