// ConfidenceDot.js — Sprint 13 step 02: the confidence indicator. A tiny
// three-bar meter (signal-strength shape): low = 1 bar, medium = 2,
// high = 3 — the band is carried by SHAPE, so it survives colorblindness
// and monochrome. The primary view never shows a number; the precise
// percentage lives only in the hover title (§4.1: a raw "82%" reads as
// authority the extractor doesn't have).

import React from "react";
import { confidenceBand } from "../fieldContract.js";
import { bandLabel } from "./copy.js";

const h = React.createElement;

const BARS = { low: 1, medium: 2, high: 3 };

export function ConfidenceDot({ confidence, lang }) {
  const band = confidenceBand(confidence);
  const label = bandLabel(band, lang);
  const pct = typeof confidence === "number" ? Math.round(confidence * 100) : null;
  return h(
    "span",
    {
      className: `pgm-conf pgm-conf-${band}`,
      role: "img",
      "aria-label": label,
      title: pct == null ? label : `${label} (${pct}%)`, // number on hover ONLY
    },
    [1, 2, 3].map((i) =>
      h("i", { key: i, className: "pgm-conf-bar" + (i <= BARS[band] ? " on" : "") }),
    ),
  );
}
