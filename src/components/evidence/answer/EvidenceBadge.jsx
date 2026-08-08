// EvidenceBadge.jsx — the evidence-strength chip (rule SC2), EVA-S04.
//
// `EvidenceTier` is a FIXED five-value scale in the contract
// (guideline · systematic_review · rct · observational · other), and this
// renders one. It is deliberately not a bar, a star rating or a percentage:
// the scale is ordinal, the distance between its steps is not a number, and
// drawing it as one would invent a precision the evidence does not have.
//
// The label goes through the `tier.` key convention (EVA-S02), so a tier a
// contract v2 adds renders as its own enum value rather than as nothing.

import React from "react";
import { useI18n } from "../../../i18n.js";

/** Mirrors the `EvidenceTier` union in src/types/evidence.d.ts, strongest first. */
export const EVIDENCE_TIERS = ["guideline", "systematic_review", "rct", "observational", "other"];

export function EvidenceBadge({ tier }) {
  const { t } = useI18n();
  if (!tier) return null;
  return (
    <span className="evd-badge evd-tier" data-tier={tier} data-testid="evidence-badge"
          title={t("answer.strength")}>
      {t(`tier.${tier}`)}
    </span>
  );
}
