// ProposalField.js — Sprint 13 step 02: proposal chrome for input-shaped
// renderers (numeric+unit, date): a dashed frame around the field with the
// grammar's header line — sparkle + «Запропоновано з диктування —
// підтвердьте» + confidence bars — and the confirm/dismiss pair below.
// Chip-shaped values use ProposalChip; both compose the same tokens, so
// "proposal" looks identical whether the value is a chip or an input.
//
// Empty state is the ABSENCE of this component: below-threshold extraction
// produces no metadata, so the renderer shows its plain input + prose with
// no proposal chrome at all.

import React from "react";
import { SparkleIcon } from "./icons.js";
import { ConfidenceDot } from "./ConfidenceDot.js";
import { ProposalActions } from "./ProposalActions.js";
import { proposedTag, ariaProposal } from "./copy.js";

const h = React.createElement;

export function ProposalField({ label, confidence, onConfirm, onDismiss, lang, confirmDisabled = false, children }) {
  return h(
    "div",
    { className: "pgm-field pgm-proposal", role: "group", "aria-label": ariaProposal(label, lang) },
    h(
      "div",
      { className: "pgm-field-head" },
      h(SparkleIcon, {}),
      h("span", { className: "pgm-field-tag" }, proposedTag(lang)),
      h(ConfidenceDot, { confidence, lang }),
    ),
    h("div", { className: "pgm-field-body" }, children),
    h(ProposalActions, { onConfirm, onDismiss, lang, confirmDisabled }),
  );
}
