// DateBody.js — Sprint 13 step 04: the date AND date_with_note renderer.
//
//   extracted → the date pre-filled in a native <input type="date"> inside
//               <ProposalField>; picking a different date IS the override
//   manual    → <ConfirmedChip> with the uk-formatted date + remove (clear)
//   empty     → a plain date input (multi-date dictation and
//               below-threshold extraction both land here by backend
//               design — no metadata, prose preserved)
//
// date_with_note registers THIS SAME renderer: the pinned metadata for
// both types carries only {date} — the note lives in section.text (the
// dictated prose), which already renders editable below the widget and is
// what min_chars applies to at finalize (BE step 06). A second note input
// here would dual-write the prose; deliberately not built.
//
// The native date input emits ISO (the storage format) and displays in the
// browser locale (uk → DD.MM.YYYY); the chip label uses formatDateDisplay.
// Emptying the picker on a confirmed/empty field is an explicit clear.

import React from "react";
import { useFieldConfirm } from "../useFieldConfirm.js";
import { ProposalField } from "../proposal/ProposalField.js";
import { ConfirmedChip } from "../proposal/ConfirmedChip.js";
import { formatDateDisplay } from "../dateInput.js";

const h = React.createElement;

function DateInput({ name, value, lang, readOnly, onCommit }) {
  return h("input", {
    className: "rf-date",
    type: "date",
    "aria-label": name,
    value: value || "",
    disabled: readOnly,
    // A date input emits a complete ISO date or "" — commit directly.
    onChange: (e) => onCommit(e.target.value),
  });
}

export function DateBody({ section, fieldMeta, icd10, onChange, lang, readOnly = false }) {
  const entry = React.useMemo(
    () => ({ field_specific_metadata: fieldMeta || undefined, icd10 }),
    [fieldMeta, icd10],
  );
  const fc = useFieldConfirm({ section, entry, onChange });
  const name = section?.name?.[lang] || section?.name?.en || section?.id;

  if (fc.proposal) {
    return h(
      "div",
      { className: "rf-field rf-datefield" },
      h(ProposalField, {
        label: name, confidence: fc.confidence, lang,
        onConfirm: () => fc.confirm(),
        onDismiss: () => fc.dismiss(),
        confirmDisabled: readOnly,
      }, h(DateInput, {
        name, lang, readOnly,
        value: fc.meta.date,
        // Picking another date overrides (→ manual); emptying while a
        // proposal is up is the dismiss affordance's job — ignore "".
        onCommit: (iso) => { if (iso) fc.override(iso); },
      })),
    );
  }

  if (fc.confirmed) {
    return h(
      "div",
      { className: "rf-field rf-datefield" },
      h(ConfirmedChip, {
        label: formatDateDisplay(fc.meta.date, lang),
        lang, disabled: readOnly,
        onRemove: () => fc.override(null),
      }),
    );
  }

  return h(
    "div",
    { className: "rf-field rf-datefield" },
    h(DateInput, { name, lang, readOnly, value: "", onCommit: (iso) => fc.override(iso) }),
  );
}
