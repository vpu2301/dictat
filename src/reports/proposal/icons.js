// icons.js — Sprint 13 step 02: the grammar's three glyphs, inline SVG via
// createElement. Deliberately NOT the shared UI.jsx Icon: (a) the proposal
// primitives must stay importable under node --test (UI.jsx is JSX), and
// (b) the sparkle/check glyphs are part of the grammar's non-color
// redundancy — shape carries state, so the glyph set is owned here.
// All icons are decorative (aria-hidden); state is announced via labels.

import React from "react";

const h = React.createElement;

const svg = (path, size = 12) =>
  h("svg", {
    className: "pgm-icon",
    width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor",
    strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round",
    "aria-hidden": "true", focusable: "false",
  }, path);

// Machine-proposed: the sparkle (same glyph family as UI.jsx `sparkle`).
export const SparkleIcon = ({ size } = {}) =>
  svg(h("path", { d: "M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" }), size);

// Clinician-confirmed: the check.
export const CheckIcon = ({ size } = {}) =>
  svg(h("path", { d: "m5 13 4 4L19 7" }), size);

// Dismiss/remove: the cross.
export const XIcon = ({ size } = {}) =>
  svg(h("path", { d: "M6 6l12 12M6 18 18 6" }), size);
