// ProposalActions.js — Sprint 13 step 02: the confirm/dismiss pair. Real
// <button>s (keyboard-reachable, focusable) with visible TEXT labels — the
// affordance is explicit so no clinician confirms by reflex, and text is
// the third redundancy channel (shape + icon + text, never color-only).

import React from "react";
import { CheckIcon, XIcon } from "./icons.js";
import { confirmLabel, dismissLabel } from "./copy.js";

const h = React.createElement;

// confirmText/dismissText override the default labels for set-level actions
// («Підтвердити всі» on multi_choice) — still the grammar's words, from copy.js.
export function ProposalActions({ onConfirm, onDismiss, lang, confirmDisabled = false, confirmText, dismissText }) {
  return h(
    "span",
    { className: "pgm-actions" },
    h(
      "button",
      {
        type: "button",
        className: "pgm-btn pgm-btn-confirm",
        onClick: onConfirm,
        disabled: confirmDisabled,
      },
      h(CheckIcon, {}),
      h("span", null, confirmText || confirmLabel(lang)),
    ),
    h(
      "button",
      { type: "button", className: "pgm-btn pgm-btn-dismiss", onClick: onDismiss },
      h(XIcon, {}),
      h("span", null, dismissText || dismissLabel(lang)),
    ),
  );
}
