// AnswerActions.jsx — what you can do with a finished answer (EVA-S04).
//
// One action this sprint: copy as text. The formatting is `copyAnswer.js` —
// pure, translated, and asserted in node --test — so what lands in the
// clipboard is a tested artefact rather than a template literal in a click
// handler.
//
// The button stays hidden while the answer is still streaming. Copying half an
// answer produces a document that looks complete and is not, and that document
// outlives the screen it came from.

import React, { useState } from "react";
import { Icon } from "../../UI.jsx";
import { useI18n } from "../../../i18n.js";
import { answerToText } from "./copyAnswer.js";

export function AnswerActions({ question, envelope, deflection }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = answerToText({ question, envelope, t, deflection: deflection?.message || (deflection ? t("deflect.body") : null) });
    try {
      await navigator.clipboard?.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // A denied clipboard permission is not worth a toast — the user knows
      // they denied it, and there is nothing this screen can do about it.
    }
  };

  return (
    <div className="evd-answer-actions" data-testid="answer-actions">
      <button type="button" className="btn" onClick={copy} data-testid="copy-answer">
        <Icon name={copied ? "check" : "fileText"} size={14} />
        {copied ? t("answer.copied") : t("answer.copy")}
      </button>
    </div>
  );
}
