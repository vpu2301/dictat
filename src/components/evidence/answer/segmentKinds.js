// segmentKinds.js — THE kind→style mapping (rule FE7), EVA-S04.
//
// Every evidence surface from here on renders segments, and every one of them
// reads this table. It is a table and not a `switch` inside SegmentRenderer
// for one reason: the copy-as-text formatter, the drawer, the history row and
// any S05+ screen need the same six labels, and a mapping that lives inside a
// component gets re-typed by the second screen that needs it. There is one
// kind→style mapping; this is it.
//
// WHAT A "STYLE" IS HERE. Three things, and none of them is a colour value:
//
//   icon      an existing platform Icon name (components/UI.jsx)
//   labelKey  the i18n key, which is the contract enum verbatim (`kind.` +
//             the value — the convention EVA-S01 wrote into i18n.js so the
//             translation key and the contract value can never diverge)
//   token     the CSS custom property the colour resolves through
//
// The token is a PLATFORM token (--accent, --warn, --info, …), never a new
// one. evidence.css says the module owns no colours, and a kind palette is
// exactly the thing that would quietly grow one.
//
// COLOUR IS NEVER THE SIGNAL. Every kind renders icon + text label + colour,
// so the six are distinguishable in greyscale, at 200% zoom, and to a reader
// who cannot tell teal from green. Two kinds deliberately SHARE a token
// (`uncertainty` and `missing_info` are both --warn; `evidence` and
// `next_step` are both --accent) because inventing four warning colours to
// keep them apart would be decoration standing in for information the label
// already carries.
//
// Pure data + pure functions: no React, no CSS import, no i18n import. Tested
// in node --test against the generated SegmentKind union, so a seventh kind
// added by a contract v2 fails here loudly instead of rendering unlabelled.

/**
 * The six kinds, in the order a segment list should be read. Mirrors the
 * `SegmentKind` union in src/types/evidence.d.ts — a value list, not a type.
 * `segmentKinds.test.js` asserts the two are identical.
 */
export const SEGMENT_KINDS = [
  "evidence",
  "patient_fact",
  "interpretation",
  "uncertainty",
  "missing_info",
  "next_step",
];

/** kind → { icon, labelKey, token }. Frozen: this is a contract, not state. */
export const KIND_STYLE = Object.freeze({
  // A claim carried by a citation. The load-bearing kind, and the only one
  // that should ever appear without a hedge — so it gets the accent.
  evidence:       { icon: "book",       labelKey: "kind.evidence",       token: "--accent" },
  // Something read off THIS patient's record. Neutral-positive: it is fact,
  // not inference, and the reader must be able to separate the two at a
  // glance when S06 starts mixing them in one answer.
  patient_fact:   { icon: "user",       labelKey: "kind.patient_fact",   token: "--ok" },
  // The model joining the two above. Informational blue: not a warning, but
  // not evidence either — this is the sentence a clinician overrides.
  interpretation: { icon: "sparkle",    labelKey: "kind.interpretation", token: "--info" },
  // The answer knows it might be wrong.
  uncertainty:    { icon: "help",       labelKey: "kind.uncertainty",    token: "--warn" },
  // The answer knows something it was not given. Shares --warn with
  // `uncertainty` on purpose; the icon and the label are what separate them.
  missing_info:   { icon: "search",     labelKey: "kind.missing_info",   token: "--warn" },
  // What to do next. An action, so it reads in the app's action colour.
  next_step:      { icon: "arrowRight", labelKey: "kind.next_step",      token: "--accent" },
});

/**
 * Style for a kind, INCLUDING one this build has never heard of.
 *
 * A v2 contract adding a seventh kind must degrade to "a labelled segment in
 * the neutral style", never to a blank block or a crash. The fallback label
 * key is the unknown value itself, so a missing translation surfaces as the
 * raw enum — which is ugly, legible, and reportable.
 */
export function kindStyle(kind) {
  const known = KIND_STYLE[kind];
  if (known) return known;
  return { icon: "fileText", labelKey: `kind.${kind}`, token: "--muted", unknown: true };
}

/** True for a kind this build renders with its designed style. */
export const isKnownKind = (kind) => Object.prototype.hasOwnProperty.call(KIND_STYLE, kind);

/**
 * The class the CSS hangs colour off. One class per kind rather than an inline
 * style, so a theme switch (and the print stylesheet) still works and the
 * token stays resolvable in CSS where it was defined.
 */
export const kindClass = (kind) => `evd-kind evd-kind-${isKnownKind(kind) ? kind : "unknown"}`;

/**
 * Segments in render order.
 *
 * The backend's order is authoritative — it wrote the answer, and reordering a
 * clinical narrative by kind would put "next step" before the finding it
 * follows from. This exists only to make the stream's arrival order
 * irrelevant: segments carry `index`, and anything without one keeps its
 * position behind those that do.
 */
export function orderSegments(entries) {
  return [...(entries || [])]
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const ai = Number.isFinite(a.e?.index) ? a.e.index : Number.MAX_SAFE_INTEGER;
      const bi = Number.isFinite(b.e?.index) ? b.e.index : Number.MAX_SAFE_INTEGER;
      return ai === bi ? a.i - b.i : ai - bi;
    })
    .map(({ e }) => e);
}
