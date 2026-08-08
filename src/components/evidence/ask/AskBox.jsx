// AskBox.jsx — the question field (EVA-S04).
//
// An autosizing textarea, not an input: clinical questions are sentences with
// qualifiers ("in a patient already on an ACE inhibitor, with eGFR 45"), and a
// single-line field that scrolls horizontally makes people shorten the
// question until it fits, which is the opposite of what the pipeline needs.
// Capped at six rows so the answer below it never gets pushed off screen.
//
// SUBMIT IS PERMISSION-GATED AND THE GATE IS ADVISORY. `usePermission` decides
// whether the button is usable; the server decides whether the answer happens.
// The client-side check exists so a nurse in a tenant where the permission was
// withdrawn sees a disabled control with a reason instead of a 403 after
// typing a paragraph.
//
// DISABLED WHILE STREAMING, mirroring the server's one-in-flight cap. Not to
// protect the server — it enforces its own — but because two answers racing
// into one column is a UI that cannot be read.

import React, { useEffect, useRef } from "react";
import { Icon } from "../../UI.jsx";
import { useI18n } from "../../../i18n.js";
import { usePermission } from "../../../auth/permissions.js";
import { canAsk, MAX_QUESTION_CHARS } from "../../../api/evidenceAnswers.js";

const MAX_ROWS = 6;

export function AskBox({ value, onChange, onSubmit, streaming, examples, onPickExample }) {
  const { t } = useI18n();
  const mayAsk = usePermission("evidence.ask", "evidence");
  const ref = useRef(null);

  // Autosize: reset to auto first, or the box only ever grows — scrollHeight
  // of an already-tall element includes the height it was given.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const line = Number.parseFloat(getComputedStyle(el).lineHeight) || 20;
    el.style.height = `${Math.min(el.scrollHeight, line * MAX_ROWS + 16)}px`;
  }, [value]);

  const ready = canAsk(value) && !streaming && mayAsk;

  const submit = (e) => {
    e.preventDefault();
    if (!ready) return;
    onSubmit(String(value).trim());
  };

  const onKeyDown = (e) => {
    // Enter asks, Shift+Enter breaks the line. The reverse of a chat box's
    // default is wrong here: this field takes one question, not a
    // conversation, and every keystroke spent reaching for a button is one
    // more reason to shorten the question.
    if (e.key === "Enter" && !e.shiftKey) { submit(e); }
  };

  return (
    <form className="evd-ask" onSubmit={submit} data-testid="ask-box">
      <label className="label" htmlFor="evd-question">{t("ask.label")}</label>
      <div className="evd-ask-row">
        <textarea
          id="evd-question"
          ref={ref}
          className="input evd-ask-input"
          rows={2}
          maxLength={MAX_QUESTION_CHARS}
          value={value}
          disabled={streaming}
          placeholder={t("ask.placeholder")}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          data-testid="question-input"
        />
        <button type="submit" className="btn accent evd-ask-submit" disabled={!ready}
                data-testid="ask-submit"
                title={mayAsk ? undefined : t("ask.forbidden")}>
          <Icon name={streaming ? "clock" : "search"} size={14} />
          {streaming ? t("ask.asking") : t("ask.submit")}
        </button>
      </div>

      <p className="evd-ask-mode" data-testid="mode-tag">
        {/* The mode is on screen because it is the difference between "this
            answer knows nothing about your patient" and the S06 mode that
            does. A clinician must never have to guess which one they used. */}
        <span className="evd-badge evd-mode-badge" data-mode="generic">{t("ask.generic_mode")}</span>
        <span className="evd-hint">{t("ask.generic_hint")}</span>
      </p>

      {!mayAsk && (
        <p className="evd-hint" role="note" data-testid="ask-forbidden">{t("ask.forbidden")}</p>
      )}

      {examples?.length > 0 && (
        <div className="evd-examples" data-testid="examples">
          <span className="evd-hint">{t("ask.examples")}</span>
          {examples.map((ex) => (
            <button key={ex} type="button" className="evd-example" disabled={streaming}
                    onClick={() => onPickExample(ex)} data-testid="example">
              {ex}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
