// DeflectionCard.jsx — triage declined to answer (EVA-S04).
//
// THIS IS NOT AN ERROR, and every design decision here follows from that. The
// pipeline ran, it understood the question, and it decided this is not a
// question an evidence tool should answer — a request for a dosing decision
// about an individual patient in generic mode, a question about self-harm, a
// question that is really a request for a diagnosis.
//
// Rendering that as a failure would be false in both directions: it tells the
// clinician the tool is broken (it is not) and it invites a retry (which will
// deflect again, correctly). So it gets its own card, in its own voice, with
// the safe-messaging body the service supplies — and no Retry button.
//
// `role="status"` and focus moved to it, because the answer the user was
// waiting for is not going to appear and a screen-reader user needs to be
// told that without having to go looking.

import React, { useEffect, useRef } from "react";
import { Icon } from "../../UI.jsx";
import { useI18n } from "../../../i18n.js";

export function DeflectionCard({ deflection }) {
  const { t } = useI18n();
  const ref = useRef(null);

  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <section
      ref={ref}
      className="evd-deflect"
      role="status"
      tabIndex={-1}
      data-reason={deflection?.reason || "triage_deflected"}
      data-testid="deflection-card"
    >
      <h2 className="evd-deflect-title">
        <Icon name="shield" size={15} />
        {t("deflect.title")}
      </h2>
      {/* The service's own wording first: safe messaging is written by people
          who do that for a living, and it is language this UI must not
          paraphrase. The generic line is the fallback when it sent none. */}
      <p className="evd-deflect-body" data-testid="deflection-body">
        {deflection?.message || t("deflect.body")}
      </p>
      <p className="evd-deflect-note">{t("deflect.note")}</p>
    </section>
  );
}
