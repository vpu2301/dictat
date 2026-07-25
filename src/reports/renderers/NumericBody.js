// NumericBody.js — Sprint 13 step 04: the numeric_with_unit renderer.
//
//   extracted → the value+unit pre-filled inside <ProposalField> (dashed
//               frame, confidence bars, confirm/dismiss); committing an
//               edited value IS the override (→ manual)
//   manual    → <ConfirmedChip> "36,6 %" with remove (→ explicit clear)
//   empty     → plain value+unit inputs; the dictated prose stays visible
//               below (widget mounts above the ProseMirror paragraph) —
//               this is also the BP compound case: "140/90" binds nothing
//               by backend design (two values = ambiguity = no metadata),
//               the clinician types it or the template models two sections
//               (documented in docs/sprint-13/field-authoring-notes.md,
//               NOT special-cased here)
//
// Input semantics: type="text" + inputMode="decimal" (type="number"
// rejects the uk comma in most browsers); parseNumericLocale accepts
// "36,6" and "36.6", stores a JSON number; invalid input → inline error,
// NO write (never destructive). Commit on blur or Enter.
// Controlled by the section model; local state is only the in-progress
// keystrokes. createElement-authored for node --test SSR.

import React from "react";
import { useFieldConfirm } from "../useFieldConfirm.js";
import { ProposalField } from "../proposal/ProposalField.js";
import { ConfirmedChip } from "../proposal/ConfirmedChip.js";
import { parseNumericLocale, formatNumericLocale } from "../parseNumericLocale.js";

const h = React.createElement;

const copy = {
  badNumber: (lang) => (lang === "uk" ? "Введіть число, напр. 36,6" : "Enter a number, e.g. 36.6"),
  needUnit: (lang) => (lang === "uk" ? "Вкажіть одиницю" : "Enter a unit"),
  unitAria: (lang) => (lang === "uk" ? "Одиниця вимірювання" : "Unit of measurement"),
};

// The value+unit input pair, shared by the proposal and empty states.
// Commits {value, unit} on blur/Enter; invalid → inline error + no write.
function NumericInputs({ name, value, unit, lang, readOnly, onCommit }) {
  const [raw, setRaw] = React.useState(formatNumericLocale(value, lang));
  const [unitRaw, setUnitRaw] = React.useState(unit || "");
  const [err, setErr] = React.useState(null);

  // Model changed under us (voice op / reopen / confirm) → resync drafts.
  React.useEffect(() => {
    setRaw(formatNumericLocale(value, lang));
    setUnitRaw(unit || "");
    setErr(null);
  }, [value, unit, lang]);

  const commit = () => {
    if (!raw.trim() && !unitRaw.trim()) { setErr(null); return; } // nothing typed → no-op
    const n = parseNumericLocale(raw);
    if (n == null) { setErr(copy.badNumber(lang)); return; }
    if (!unitRaw.trim()) { setErr(copy.needUnit(lang)); return; }
    setErr(null);
    onCommit({ value: n, unit: unitRaw.trim() });
  };
  const onKeyDown = (e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } };

  return h(
    "span",
    { className: "rf-scalar" },
    h("input", {
      className: "rf-num" + (err ? " rf-invalid" : ""),
      type: "text",
      inputMode: "decimal",
      "aria-label": name,
      "aria-invalid": err ? "true" : undefined,
      value: raw,
      disabled: readOnly,
      onChange: (e) => setRaw(e.target.value),
      onBlur: commit,
      onKeyDown,
    }),
    h("input", {
      className: "rf-unit",
      type: "text",
      "aria-label": copy.unitAria(lang),
      value: unitRaw,
      disabled: readOnly,
      onChange: (e) => setUnitRaw(e.target.value),
      onBlur: commit,
      onKeyDown,
    }),
    err ? h("span", { className: "rf-err", role: "alert" }, err) : null,
  );
}

export function NumericBody({ section, fieldMeta, icd10, onChange, lang, readOnly = false }) {
  const entry = React.useMemo(
    () => ({ field_specific_metadata: fieldMeta || undefined, icd10 }),
    [fieldMeta, icd10],
  );
  const fc = useFieldConfirm({ section, entry, onChange });
  const name = section?.name?.[lang] || section?.name?.en || section?.id;

  if (fc.proposal) {
    return h(
      "div",
      { className: "rf-field rf-numeric" },
      h(ProposalField, {
        label: name, confidence: fc.confidence, lang,
        onConfirm: () => fc.confirm(),
        onDismiss: () => fc.dismiss(),
        confirmDisabled: readOnly,
      }, h(NumericInputs, {
        name, lang, readOnly,
        value: fc.meta.value, unit: fc.meta.unit,
        onCommit: (v) => fc.override(v),
      })),
    );
  }

  if (fc.confirmed) {
    return h(
      "div",
      { className: "rf-field rf-numeric" },
      h(ConfirmedChip, {
        label: `${formatNumericLocale(fc.meta.value, lang)} ${fc.meta.unit}`,
        lang, disabled: readOnly,
        onRemove: () => fc.override(null), // explicit clear → back to inputs
      }),
    );
  }

  return h(
    "div",
    { className: "rf-field rf-numeric" },
    h(NumericInputs, { name, lang, readOnly, value: null, unit: "", onCommit: (v) => fc.override(v) }),
  );
}
