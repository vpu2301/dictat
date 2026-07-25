// DiagnosisBody.js — Sprint 13 step 05: the structured_diagnosis renderer.
// Three zones, top to bottom:
//   1. CONFIRMED codes — section.icd10 as removable <ConfirmedChip>s
//      ("I25.1 — display", or the bare code when display is absent)
//   2. PROPOSALS — metadata.proposals sorted by confidence desc, each a
//      <ProposalChip>: confirm MOVES the code into section.icd10,
//      dismiss drops it from the staging area
//   3. SEARCH — the /v1/icd10/search combobox (useIcd10Search: debounce/
//      abort/seq-guard/LRU); only is_leaf results are pickable, headings
//      render dimmed as context; picking adds to section.icd10 and clears
//      the input; errors fail-quiet to an empty dropdown
// ...and below it all, the dictated PROSE — the section's ProseMirror
// text with S10 autocomplete, which this widget architecturally cannot
// touch: every code operation writes only the section-meta map
// ({icd10, field_specific_metadata}), never the body text. Codes annotate
// the narrative; the narrative is the record.
//
// The FE never invents a code: everything in section.icd10 arrived via a
// proposal confirm or a search pick (buildConfirmProposal/buildPickCode).

import React from "react";
import { useFieldConfirm } from "../useFieldConfirm.js";
import { useIcd10Search } from "../useIcd10Search.js";
import { buildDismissProposal, buildPickCode } from "../fieldActions.js";
import { ICD10_SEED_EVENT } from "../applyChoiceOp.js";
import { ProposalChip } from "../proposal/ProposalChip.js";
import { ConfirmedChip } from "../proposal/ConfirmedChip.js";

const h = React.createElement;

const codeLabel = (code, display) => (display ? `${code} — ${display}` : String(code || ""));

const copy = {
  searchPlaceholder: (lang) => (lang === "uk" ? "Пошук коду МКХ-10…" : "Search ICD-10…"),
  searchAria: (lang) => (lang === "uk" ? "Пошук діагнозу МКХ-10" : "ICD-10 diagnosis search"),
  resultsAria: (lang) => (lang === "uk" ? "Результати пошуку МКХ-10" : "ICD-10 search results"),
};

// The results listbox — exported for direct SSR tests (the hook's async
// state can't be driven under renderToStaticMarkup).
export function Icd10Results({ results, onPick, lang, id = "icd10-results" }) {
  if (!results?.length) return null;
  return h(
    "ul",
    { className: "rf-icd-results", role: "listbox", id, "aria-label": copy.resultsAria(lang) },
    results.map((r) =>
      r.is_leaf
        ? h(
            "li",
            { key: r.code, role: "option", "aria-selected": "false" },
            h(
              "button",
              { type: "button", className: "rf-icd-opt", onClick: () => onPick(r) },
              h("span", { className: "rf-icd-code" }, r.code),
              h("span", { className: "rf-icd-display" }, r.display || ""),
            ),
          )
        : h(
            // Non-leaf heading: group context, dimmed, NOT pickable (the
            // backend's leaf rule — category headers are navigation, not codes).
            "li",
            { key: r.code, className: "rf-icd-head", role: "presentation", "aria-hidden": "true" },
            h("span", { className: "rf-icd-code" }, r.code),
            h("span", { className: "rf-icd-display" }, r.display || ""),
          ),
    ),
  );
}

export function DiagnosisBody({ section, fieldMeta, icd10, onChange, lang, readOnly = false }) {
  const entry = React.useMemo(
    () => ({ field_specific_metadata: fieldMeta || undefined, icd10 }),
    [fieldMeta, icd10],
  );
  const fc = useFieldConfirm({ section, entry, onChange });
  const search = useIcd10Search();

  // Step 07 — mark_diagnosis_text seeds the picker's query (a search hint,
  // never a code selection, never focus). Latest search via ref: the hook's
  // surface is recreated per render.
  const searchRef = React.useRef(search);
  searchRef.current = search;
  React.useEffect(() => {
    const onSeed = (e) => {
      if (!e?.detail || e.detail.sectionId !== section?.id) return;
      searchRef.current.setQuery(String(e.detail.text || ""));
    };
    window.addEventListener(ICD10_SEED_EVENT, onSeed);
    return () => window.removeEventListener(ICD10_SEED_EVENT, onSeed);
  }, [section?.id]);

  const confirmed = fc.icd10;
  const proposals = [...(fc.meta?.proposals || [])].sort(
    (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0),
  );
  const apply = (patch) => { if (patch && onChange) onChange(patch); };
  const pick = (result) => {
    apply(buildPickCode(section, entry, result));
    search.clear();
  };

  return h(
    "div",
    { className: "rf-field rf-diagnosis" },
    // Zone 1 — confirmed codes (the single authority: section.icd10).
    confirmed.length
      ? h(
          "div",
          { className: "rf-chips rf-icd-confirmed" },
          confirmed.map((c) =>
            h(ConfirmedChip, {
              key: c.code,
              label: codeLabel(c.code, c.display),
              lang, disabled: readOnly,
              onRemove: () => fc.removeCode(c.code),
            }),
          ),
        )
      : null,
    // Zone 2 — extractor proposals, highest confidence first.
    proposals.length
      ? h(
          "div",
          { className: "rf-chips rf-icd-proposals" },
          proposals.map((p) =>
            h(ProposalChip, {
              key: p.code,
              label: codeLabel(p.code, p.display),
              confidence: p.confidence,
              lang, disabled: readOnly,
              onConfirm: () => fc.confirmProposal(p.code),
              onDismiss: () => apply(buildDismissProposal(section, entry, p.code)),
            }),
          ),
        )
      : null,
    // Zone 3 — the picker. The dictated prose renders below the widget
    // (the section's own text), always visible, never touched from here.
    readOnly
      ? null
      : h(
          "div",
          { className: "rf-icd-search" },
          h("input", {
            className: "rf-icd-input",
            type: "text",
            role: "combobox",
            "aria-label": copy.searchAria(lang),
            "aria-expanded": search.results.length ? "true" : "false",
            "aria-controls": "icd10-results",
            "aria-autocomplete": "list",
            autoComplete: "off",
            placeholder: copy.searchPlaceholder(lang),
            value: search.q,
            onChange: (e) => search.setQuery(e.target.value),
            onKeyDown: (e) => { if (e.key === "Escape") search.clear(); },
          }),
          h(Icd10Results, { results: search.results, onPick: pick, lang }),
        ),
  );
}
