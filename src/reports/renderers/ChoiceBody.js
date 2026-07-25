// ChoiceBody.js — Sprint 13 step 03: the single-select chip renderer.
//
// One chip per template option (`label` shown, `value` saved). The section
// model is the ONLY state (fully controlled): selection comes from
// metadata.selected, chrome from `source` — so step 07's voice ops (which
// write the model through the same save path) re-render this without any
// local state fighting them.
//
//   empty      → all plain chips; tap = direct manual selection
//   extracted  → the proposed option renders as <ProposalChip> (confirm/
//                dismiss inline), the others stay plain; tapping another
//                option IS the override (result source:"manual")
//   manual     → <ConfirmedChip> with the remove affordance (clears back
//                to empty; prose is never touched)
//
// Dictated prose coexists BELOW the chips by construction: the widget
// mount is the section's first child, the ProseMirror paragraph follows —
// nothing dictated is ever hidden (step 01 audit).
//
// A11y: the row is a labeled group of native buttons — Tab reaches every
// chip and the proposal's confirm/dismiss; Space/Enter activate; arrows
// move focus (never select — selecting writes the record, so browsing must
// be side-effect-free; deliberate deviation from the ARIA radio pattern).
// Authored with createElement (not JSX) so node --test can SSR it.

import React from "react";
import { useFieldConfirm } from "../useFieldConfirm.js";
import { optionLabel } from "../fieldContract.js";
import { ProposalChip } from "../proposal/ProposalChip.js";
import { ConfirmedChip } from "../proposal/ConfirmedChip.js";
import { chipRowKeyDown } from "./chipNav.js";

const h = React.createElement;

export function ChoiceBody({ section, fieldMeta, icd10, onChange, lang, readOnly = false }) {
  const entry = React.useMemo(
    () => ({ field_specific_metadata: fieldMeta || undefined, icd10 }),
    [fieldMeta, icd10],
  );
  const fc = useFieldConfirm({ section, entry, onChange });

  const options = section?.options || [];
  if (!options.length) {
    // Backend validation forbids option-less choice sections — defense-in-depth.
    if (import.meta.env?.DEV) {
      console.warn(`[report-fields] choice section ${JSON.stringify(section?.id)} has no options — nothing to render`);
    }
    return null;
  }

  const selected = fc.meta?.selected ?? null;
  const name = section?.name?.[lang] || section?.name?.en || section?.id;

  return h(
    "div",
    { className: "rf-field rf-choice", role: "group", "aria-label": name },
    h(
      "div",
      { className: "rf-chips", onKeyDown: chipRowKeyDown },
      options.map((opt) => {
        const label = optionLabel(options, opt.value);
        if (opt.value === selected && fc.confirmed) {
          return h(ConfirmedChip, {
            key: opt.value, label, lang, disabled: readOnly,
            onRemove: () => fc.override(null),
          });
        }
        if (opt.value === selected && fc.proposal) {
          return h(ProposalChip, {
            key: opt.value, label, lang, disabled: readOnly,
            confidence: fc.confidence,
            onConfirm: () => fc.confirm(),
            onDismiss: () => fc.dismiss(),
          });
        }
        return h(
          "button",
          {
            key: opt.value,
            type: "button",
            className: "rf-chip",
            "aria-pressed": "false",
            disabled: readOnly,
            onClick: () => fc.override(opt.value),
          },
          label,
        );
      }),
    ),
  );
}
