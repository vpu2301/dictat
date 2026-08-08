// UnverifiedBanner.jsx — the notice that is not dismissible (EVA-S04).
//
// AC-S04-F-2: present, unconditionally, on every answer this sprint renders —
// good ones, deflected ones, resumed ones. It takes no props that could
// suppress it and there is no close button, because the state it describes is
// a property of the PIPELINE, not of an individual answer: nothing in it has
// been verified against a reference standard yet. S06 is the sprint that
// earns the right to remove this, and until then any code path that could
// hide it is a code path that lies.
//
// It is `role="note"`, not `role="alert"`: it is not an interruption, it is a
// standing condition, and an alert on every answer would train people to
// ignore alerts.

import React from "react";
import { Icon } from "../../UI.jsx";
import { useI18n } from "../../../i18n.js";

export function UnverifiedBanner() {
  const { t } = useI18n();
  return (
    <p className="evd-unverified" role="note" data-testid="unverified-banner">
      <Icon name="shield" size={14} />
      <span>{t("answer.unverified")}</span>
    </p>
  );
}
