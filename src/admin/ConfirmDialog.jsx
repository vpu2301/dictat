// ConfirmDialog.jsx — the admin console's one destructive-action dialog.
//
// Every surface in /admin confirms consequences through this component rather
// than hand-rolling a modal (the pattern that produced three diverging copies:
// AdminUsersPage, the sidebar sign-out, PrivacyAdminPage). The rules it
// encodes:
//
//   · the CONSEQUENCE is named, not the action. "Deactivate user?" tells the
//     admin nothing they did not already click; "sign-in is blocked everywhere
//     and live sessions end now" is the sentence they need before committing.
//   · a destructive confirm is visually destructive (`--rec` tokens via
//     .btn-danger) and auto-focused, so Enter confirms and Escape cancels —
//     keyboard-first, like the rest of an ops console.
//   · the heaviest actions demand a TYPED WORD (PrivacyAdminPage's «ВИДАЛЕННЯ»
//     pattern) — a click can be a reflex, typing cannot.
import React, { useEffect, useRef, useState } from "react";
import { Modal } from "../components/UI.jsx";
import { tr } from "../i18n.js";

export function ConfirmDialog({
  title,
  consequence,          // node — the sentence(s) naming what will happen
  confirmLabel,
  cancelLabel,
  danger = false,       // destructive styling on the confirm button
  typedWord = null,     // require this literal word before confirm enables
  busy = false,
  error = null,         // node — rendered inline (e.g. a 409 explanation)
  lang = "uk",
  onConfirm,
  onCancel,
  children,             // optional extra body (e.g. the person being acted on)
  testId = "confirm-dialog",
}) {
  const [typed, setTyped] = useState("");
  const confirmRef = useRef(null);

  // Auto-focus the primary action (the sign-out modal's pattern) — unless a
  // typed word is demanded, in which case the input is where the user starts.
  useEffect(() => {
    if (!typedWord && confirmRef.current) confirmRef.current.focus();
  }, [typedWord]);

  const armed = !typedWord || typed.trim() === typedWord;

  return (
    <Modal className="dialog-modal adm-confirm" onClose={() => { if (!busy) onCancel(); }}>
      <div className="modal-h">
        <h2>{title}</h2>
        {consequence && <p data-testid={`${testId}-consequence`}>{consequence}</p>}
      </div>
      <div className="modal-body">
        {children}
        {typedWord && (
          <label className="adm-typed-word">
            <span>
              {lang === "uk"
                ? <>Щоб підтвердити, введіть <b>{typedWord}</b></>
                : <>Type <b>{typedWord}</b> to confirm</>}
            </span>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={busy}
              data-testid={`${testId}-typed`}
            />
          </label>
        )}
        {error && (
          <div className="adm-dialog-error" role="alert" data-testid={`${testId}-error`}>
            {error}
          </div>
        )}
      </div>
      <div className="modal-foot">
        <button type="button" className="btn" onClick={onCancel} disabled={busy}
                data-testid={`${testId}-cancel`}>
          {cancelLabel || tr(lang, "Скасувати", "Cancel")}
        </button>
        <button
          type="button"
          ref={confirmRef}
          className={"btn " + (danger ? "btn-danger" : "btn-primary")}
          onClick={onConfirm}
          disabled={busy || !armed}
          data-testid={`${testId}-confirm`}
        >
          {busy ? "…" : confirmLabel || tr(lang, "Підтвердити", "Confirm")}
        </button>
      </div>
    </Modal>
  );
}
