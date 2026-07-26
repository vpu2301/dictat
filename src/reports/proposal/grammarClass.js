// grammarClass.js — the ONE place the `pgm-` shape vocabulary is spelled.
//
// The grammar's promise is that "proposed" and "confirmed" look the same
// everywhere in the product: dashed outline + sparkle vs solid + check. The
// hygiene tripwire in noTelemetryImport.test.js enforces that by forbidding
// `pgm-` classes outside this directory — so a surface that needs the grammar
// (sprint-14 speaker chips, for one) composes it from here instead of
// re-authoring the class strings and drifting.
//
// `extra` is where a caller adds its OWN vocabulary (colour tone, test hooks).
// It can never change the shape channel, which is the point.

export function chipClass({ confirmed = false, extra = "" } = {}) {
  return ["pgm-chip", extra, confirmed ? "pgm-confirmed" : "pgm-proposal"]
    .filter(Boolean)
    .join(" ");
}

// A neutral chip-shaped slot that makes no claim at all — used for text whose
// label has not arrived yet, where even "proposed" would overstate.
export function chipPlaceholderClass({ extra = "" } = {}) {
  return ["pgm-chip", extra].filter(Boolean).join(" ");
}

// The chip's text slot (ellipsis + overflow behaviour live with the grammar).
export function chipLabelClass() {
  return "pgm-chip-label";
}
