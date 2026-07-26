// ProposalChip.js — Sprint 13 step 02: one machine-proposed value awaiting
// review. The proposal look is: DASHED OUTLINE (shape) + sparkle glyph
// (icon) + announced state (text) + confidence bars — four redundant
// channels; color is never the only carrier. Confirm/dismiss are inline
// icon buttons with per-value aria labels (the chip is used in rows of
// many, e.g. multi_choice — "Confirm" alone would be ambiguous).

import React from "react";
import { SparkleIcon, CheckIcon, XIcon } from "./icons.js";
import { ConfidenceDot } from "./ConfidenceDot.js";
import { chipClass } from "./grammarClass.js";
import {
  ariaProposal,
  ariaConfirmAction,
  ariaDismissAction,
  confirmLabel,
  dismissLabel,
} from "./copy.js";

const h = React.createElement;

export function ProposalChip({ label, confidence, onConfirm, onDismiss, lang, disabled = false }) {
  return h(
    "span",
    { className: chipClass({ confirmed: false }), role: "group", "aria-label": ariaProposal(label, lang) },
    h(SparkleIcon, {}),
    h("span", { className: "pgm-chip-label" }, label),
    h(ConfidenceDot, { confidence, lang }),
    h(
      "button",
      {
        type: "button",
        className: "pgm-btn pgm-btn-confirm pgm-btn-icon",
        onClick: onConfirm,
        disabled,
        "aria-label": ariaConfirmAction(label, lang),
        title: confirmLabel(lang),
      },
      h(CheckIcon, {}),
    ),
    h(
      "button",
      {
        type: "button",
        className: "pgm-btn pgm-btn-dismiss pgm-btn-icon",
        onClick: onDismiss,
        disabled,
        "aria-label": ariaDismissAction(label, lang),
        title: dismissLabel(lang),
      },
      h(XIcon, {}),
    ),
  );
}
