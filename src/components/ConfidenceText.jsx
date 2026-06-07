// ConfidenceText.jsx — render Final.text + Final.confidence_spans[].
//
// CSS classes (defined in src/styles.css extension):
//   .confidence-moderate     — backend says 0.40 ≤ p < 0.65 (dotted underline)
//   .confidence-high-concern — backend says p < 0.40       (stronger underline)
//
// Designers asked to avoid red — the moderate level uses muted accent and
// high_concern uses a slightly stronger but still non-alarming treatment.
// See spec §D sprint 05.

import React from "react";
import { buildConfidenceSegments } from "../dictation/operations.js";

export function ConfidenceText({ text, spans }) {
  const segments = buildConfidenceSegments(text, spans);
  return (
    <>
      {segments.map((seg, i) => {
        if (!seg.level) return <span key={i}>{seg.text}</span>;
        const cls = seg.level === "high_concern" ? "confidence-high-concern" : "confidence-moderate";
        const tip = seg.level === "high_concern"
          ? "Низька впевненість моделі — перевірте"
          : "Помірна впевненість";
        return <span key={i} className={cls} title={tip}>{seg.text}</span>;
      })}
    </>
  );
}
