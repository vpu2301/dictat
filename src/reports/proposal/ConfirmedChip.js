// ConfirmedChip.js — Sprint 13 step 02: a clinician-confirmed value. Solid
// fill (shape), check glyph (icon), announced "підтверджено" (text) — and
// NO confidence anything: a confirmed value is documented fact, not a
// probability. The optional remove button is the subtle "manual" affordance
// to change/undo; overriding is done by the renderer (pick another option),
// not by this chip.

import React from "react";
import { CheckIcon, XIcon } from "./icons.js";
import { ariaConfirmed, ariaRemoveAction, removeLabel } from "./copy.js";

const h = React.createElement;

export function ConfirmedChip({ label, onRemove, lang, disabled = false }) {
  return h(
    "span",
    { className: "pgm-chip pgm-confirmed", role: "group", "aria-label": ariaConfirmed(label, lang) },
    h(CheckIcon, {}),
    h("span", { className: "pgm-chip-label" }, label),
    onRemove
      ? h(
          "button",
          {
            type: "button",
            className: "pgm-btn pgm-btn-remove pgm-btn-icon",
            onClick: onRemove,
            disabled,
            "aria-label": ariaRemoveAction(label, lang),
            title: removeLabel(lang),
          },
          h(XIcon, {}),
        )
      : null,
  );
}
