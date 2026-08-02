// chat/features/chat/AnswerActions.jsx — what you can DO with the answer.
//
// Lifted out of the scrolling document and pinned above the ask box, because
// the actions were the first thing to disappear under a long answer — the one
// moment you want them is after you have read to the end, which is exactly when
// they had scrolled away.
//
// Order follows how they get used: judge it (helpful), keep it (copy, create a
// document), redo it (regenerate). "Create document" is the only one styled as
// a primary action; it is the one that produces something.

import React from "react";
import { Icon } from "../../ui/Icon.jsx";
import { t } from "../../i18n.js";

export function AnswerActions({
  onFeedback, feedback, onCopy, copied, onCreateDocument, onRegenerate, locale = "en",
}) {
  return (
    <div className="ec-actions" role="group" aria-label={t(locale, "Дії з відповіддю", "Answer actions")}>
      <button
        type="button"
        className={`ec-act${feedback === "up" ? " on-good" : ""}`}
        onClick={() => onFeedback?.("up")}
        title={t(locale, "Корисно", "Helpful")}
        aria-pressed={feedback === "up"}
      >
        <Icon name="check" size={13} />
        <span className="ec-act-label">{t(locale, "Корисно", "Helpful")}</span>
      </button>
      <button
        type="button"
        className={`ec-act${feedback === "down" ? " on-bad" : ""}`}
        onClick={() => onFeedback?.("down")}
        title={t(locale, "Не корисно", "Not helpful")}
        aria-pressed={feedback === "down"}
      >
        <Icon name="x" size={13} />
        <span className="ec-act-label">{t(locale, "Не корисно", "Not helpful")}</span>
      </button>

      <span className="ec-act-sep" aria-hidden="true" />

      <button type="button" className="ec-act" onClick={onCopy} title={t(locale, "Копіювати", "Copy")}>
        <Icon name={copied ? "check" : "copy"} size={13} />
        <span className="ec-act-label">
          {copied ? t(locale, "Скопійовано", "Copied") : t(locale, "Копіювати", "Copy")}
        </span>
      </button>
      {onRegenerate && (
        <button type="button" className="ec-act" onClick={onRegenerate} title={t(locale, "Ще раз", "Regenerate")}>
          <Icon name="refresh" size={13} />
          <span className="ec-act-label">{t(locale, "Ще раз", "Regenerate")}</span>
        </button>
      )}
      {onCreateDocument && (
        <button type="button" className="ec-act ec-act-primary" onClick={onCreateDocument}>
          <Icon name="fileText" size={13} />
          <span>{t(locale, "Створити документ", "Create document")}</span>
        </button>
      )}
    </div>
  );
}
