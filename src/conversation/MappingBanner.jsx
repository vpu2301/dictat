// MappingBanner.jsx — "who is who, according to the machine" (sprint 14).
//
// The mapping is the single most consequential proposal on this screen: it
// decides whether a symptom lands in the record as the patient's report or the
// clinician's statement. So it is stated in words AND colour, its rationale is
// available, and one tap makes it authoritative.
//
// The pulse: when the backend changes its hypothesis mid-consultation
// (SpeakerMappingUpdated), every rendered turn recolours. A silent recolour
// would be the screen rewriting history behind the clinician's back, so the
// banner flashes exactly ONCE per change — keyed on the model's pulse counter,
// never on render.

import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../components/UI.jsx";
import { isKnown } from "./mapping.js";
import { mappingKnown, mappingUnknown, mappingFrozen, swapLabel } from "./copy.js";
import { tr } from "../i18n.js";

export function MappingBanner({ mapping, lang, onSwap, disabled = false }) {
  const [pulsing, setPulsing] = useState(false);
  const seenPulse = useRef(mapping.pulse);

  useEffect(() => {
    if (mapping.pulse === seenPulse.current) return;
    seenPulse.current = mapping.pulse;
    setPulsing(true);
    const t = setTimeout(() => setPulsing(false), 900);
    return () => clearTimeout(t);
  }, [mapping.pulse]);

  const known = isKnown(mapping);
  const doctorVoice = Object.entries(mapping.mapping).find(([, r]) => r === "doctor")?.[0] || "S1";

  return (
    <div
      className={`cv-mapping${pulsing ? " is-pulsing" : ""}${known ? "" : " is-unknown"}`}
      data-testid="mapping-banner"
      data-frozen={mapping.frozen ? "true" : "false"}
      data-source={mapping.source}
      role="status"
    >
      <Icon name={known ? "users" : "help"} size={14} />
      <span className="cv-mapping-text">
        {known ? mappingKnown(doctorVoice, lang) : mappingUnknown(lang)}
      </span>
      {mapping.frozen ? (
        <span className="cv-mapping-frozen" data-testid="mapping-frozen">
          <Icon name="check" size={12} /> {mappingFrozen(lang)}
        </span>
      ) : mapping.rationale ? (
        // The machine's reasoning, verbatim, on hover — an explainable
        // heuristic is worth showing; a score on its own is not.
        <span className="cv-mapping-why" title={mapping.rationale}>
          {tr(lang, "чому?", "why?")}
        </span>
      ) : null}
      <div style={{ flex: 1 }} />
      <button
        type="button"
        className="btn sm"
        data-testid="mapping-swap"
        disabled={disabled}
        onClick={onSwap}
      >
        <Icon name="refresh" size={12} /> {swapLabel(lang)}
      </button>
    </div>
  );
}
