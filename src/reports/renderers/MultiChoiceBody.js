// MultiChoiceBody.js — Sprint 13 step 03: the multi-select chip renderer.
// Same grammar as ChoiceBody, multiple selected values. Fully controlled by
// the section model (voice-op ready, step 07).
//
// Proposal review (the contract carries ONE source for the whole set, so a
// partial "this chip confirmed, the rest staged" is unrepresentable — see
// fieldActions.js):
//   «Підтвердити всі» → the whole extracted set flips to manual (one save)
//   per-chip dismiss  → shrinks the extracted set, the rest stays proposed
//   per-chip confirm  → the manual set becomes exactly that value; other
//                       proposals drop to plain chips (prose intact)
//   toggling any chip → override semantics: the resulting set is manual
// Exclusive option: honored only when the backend flags one
// (option.exclusive — a named backend ask; no slug hardcoding here).

import React from "react";
import { useFieldConfirm } from "../useFieldConfirm.js";
import { optionLabel } from "../fieldContract.js";
import { buildConfirmOne, buildDismissValue, nextMultiSelection } from "../fieldActions.js";
import { ProposalChip } from "../proposal/ProposalChip.js";
import { ConfirmedChip } from "../proposal/ConfirmedChip.js";
import { ProposalActions } from "../proposal/ProposalActions.js";
import { confirmAllLabel, dismissAllLabel } from "../proposal/copy.js";
import { chipRowKeyDown } from "./chipNav.js";

const h = React.createElement;

export function MultiChoiceBody({ section, fieldMeta, icd10, onChange, lang, readOnly = false }) {
  const entry = React.useMemo(
    () => ({ field_specific_metadata: fieldMeta || undefined, icd10 }),
    [fieldMeta, icd10],
  );
  const fc = useFieldConfirm({ section, entry, onChange });

  const options = section?.options || [];
  if (!options.length) {
    if (import.meta.env?.DEV) {
      console.warn(`[report-fields] multi_choice section ${JSON.stringify(section?.id)} has no options — nothing to render`);
    }
    return null;
  }

  const selected = fc.meta?.selected || [];
  const name = section?.name?.[lang] || section?.name?.en || section?.id;
  const apply = (patch) => { if (patch && onChange) onChange(patch); };
  const toggle = (value) => fc.override(nextMultiSelection(section, entry, value));

  return h(
    "div",
    { className: "rf-field rf-multi", role: "group", "aria-label": name },
    h(
      "div",
      { className: "rf-chips", onKeyDown: chipRowKeyDown },
      options.map((opt) => {
        const label = optionLabel(options, opt.value);
        const isSel = selected.includes(opt.value);
        if (isSel && fc.confirmed) {
          return h(ConfirmedChip, {
            key: opt.value, label, lang, disabled: readOnly,
            onRemove: () => toggle(opt.value),
          });
        }
        if (isSel && fc.proposal) {
          return h(ProposalChip, {
            key: opt.value, label, lang, disabled: readOnly,
            confidence: fc.confidence,
            onConfirm: () => apply(buildConfirmOne(section, entry, opt.value)),
            onDismiss: () => apply(buildDismissValue(section, entry, opt.value)),
          });
        }
        return h(
          "button",
          {
            key: opt.value,
            type: "button",
            className: "rf-chip",
            "aria-pressed": isSel ? "true" : "false",
            disabled: readOnly,
            onClick: () => toggle(opt.value),
          },
          label,
        );
      }),
    ),
    // Set-level review actions, only while the set is a proposal.
    fc.proposal && !readOnly
      ? h(ProposalActions, {
          lang,
          onConfirm: () => fc.confirm(),
          onDismiss: () => fc.dismiss(),
          confirmText: confirmAllLabel(lang),
          dismissText: dismissAllLabel(lang),
        })
      : null,
  );
}
