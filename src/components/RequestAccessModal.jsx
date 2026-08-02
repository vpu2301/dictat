// RequestAccessModal.jsx — break-glass access to ONE report (S14) or
// ONE patient record (S15), chosen by the `resourceKind` prop.
//
// A tenant_admin has no standing clinical read. This modal is the door:
// pick a reason from a closed vocabulary, re-enter your password, and get
// a time-limited grant on that single resource.
//
// Two backend calls, in this order, because the second consumes the first:
//
//   POST /auth/reauth              → reauth_ticket (single-use, ~5 min)
//   POST /v1/phi-access-requests   → the grant
//
// Deliberate UX choices, each with a reason:
//
//   * The consequences are stated up front, not buried. This action tells
//     the report's authors by name and lands in the audit trail at `sec`
//     severity; a user who is surprised by that afterwards was misled by
//     the dialog.
//   * A wrong password does NOT close the modal or lose the typed reason —
//     it clears the password field only. Re-typing a justification because
//     you fat-fingered a password is how people learn to write "asdf".
//   * The password is held in component state and dropped on unmount; it
//     is never put in a ref that outlives the dialog, never logged, and
//     never sent anywhere but auth-service.
//
// Follows the DsarModal shape (PatientProfile.jsx) — .modal-h / body /
// .modal-foot — so it reads as part of the same family of consequential
// dialogs rather than a novelty.

import React, { useEffect, useRef, useState } from "react";
import { Modal, Icon } from "./UI.jsx";
import { tr } from "../i18n.js";
import { reauth } from "../api/endpoints.js";
import { listAccessReasons, requestPhiAccess } from "../api/phiAccess.js";

// Shown until /reasons answers, and as the fallback if it fails — the
// modal must stay usable when a metadata call is the only thing broken.
// Kept in lockstep with the CHECK on phi_access_requests.reason_code.
const FALLBACK_REASONS = [
  { code: "patient_complaint", label_uk: "Скарга пацієнта", label_en: "Patient complaint", requires_note: false },
  { code: "legal_request", label_uk: "Юридичний запит", label_en: "Legal or regulatory request", requires_note: false },
  { code: "billing_dispute", label_uk: "Спір щодо оплати", label_en: "Billing dispute", requires_note: false },
  { code: "quality_review", label_uk: "Перевірка якості", label_en: "Quality review", requires_note: false },
  { code: "care_continuity", label_uk: "Безперервність надання допомоги", label_en: "Continuity of care", requires_note: false },
  { code: "data_correction", label_uk: "Виправлення даних", label_en: "Data correction", requires_note: false },
  { code: "other", label_uk: "Інше (вкажіть причину)", label_en: "Other (state the reason)", requires_note: true },
];

const DEFAULT_NOTE_MIN = 10;

function errorMessage(err, lang, resourceKind) {
  const code = err?.problem?.code;
  if (err?.status === 401 && code === "reauth_required") {
    return tr(lang,
      "Термін дії підтвердження минув. Введіть пароль ще раз.",
      "The confirmation expired. Please enter your password again.");
  }
  if (err?.status === 401) {
    return tr(lang, "Невірний пароль.", "That password is not correct.");
  }
  if (err?.status === 404) {
    return resourceKind === "patient"
      ? tr(lang, "Пацієнта не знайдено.", "Patient not found.")
      : tr(lang, "Звіт не знайдено.", "Report not found.");
  }
  if (err?.status === 403) {
    return tr(lang,
      "Ваша роль не дозволяє запитувати доступ.",
      "Your role does not permit requesting access.");
  }
  if (err?.status === 423) {
    return tr(lang,
      "Обліковий запис заблоковано через повторні невдалі спроби.",
      "The account is locked after repeated failed attempts.");
  }
  return err?.message || tr(lang, "Не вдалося виконати запит.", "The request could not be completed.");
}

export function RequestAccessModal({
  lang = "uk",
  // "report" (S14) or "patient" (S15). For "patient", pass the patient's
  // id as resourceId; reportId is kept for the existing report call sites.
  resourceKind = "report",
  resourceId,
  reportId,
  reportCode,
  patientLabel,
  onClose,
  onGranted,
}) {
  const targetId = resourceId ?? reportId;
  const isPatient = resourceKind === "patient";
  const [reasons, setReasons] = useState(FALLBACK_REASONS);
  const [ttlMinutes, setTtlMinutes] = useState(60);
  const [noteMin, setNoteMin] = useState(DEFAULT_NOTE_MIN);

  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const passwordRef = useRef(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  useEffect(() => {
    let cancelled = false;
    listAccessReasons().then(
      (r) => {
        if (cancelled || !r) return;
        if (Array.isArray(r.reasons) && r.reasons.length) setReasons(r.reasons);
        if (typeof r.grant_ttl_minutes === "number") setTtlMinutes(r.grant_ttl_minutes);
        if (typeof r.note_min_chars === "number") setNoteMin(r.note_min_chars);
      },
      // A failed metadata fetch is not a reason to block the request —
      // the fallback vocabulary is the same list, and the server
      // validates the choice anyway.
      () => {},
    );
    return () => { cancelled = true; };
  }, []);

  const selected = reasons.find((r) => r.code === reasonCode) || null;
  const noteRequired = Boolean(selected?.requires_note);
  const noteTooShort = noteRequired && note.trim().length < noteMin;
  const canSubmit = Boolean(reasonCode) && Boolean(password) && !noteTooShort && !busy;

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      // Step 1 — prove presence. The ticket lives only in this closure.
      const { reauth_ticket: ticket } = await reauth(password);
      // Step 2 — spend it. From here the grant exists and is audited.
      const grant = await requestPhiAccess({
        resourceKind,
        resourceId: targetId,
        reasonCode,
        reasonNote: note.trim(),
        reauthTicket: ticket,
      });
      if (!alive.current) return;
      onGranted?.(grant);
    } catch (err) {
      if (!alive.current) return;
      setError(err);
      setBusy(false);
      // Clear ONLY the password: a bad password must not cost the user
      // the justification they just wrote.
      setPassword("");
      passwordRef.current?.focus();
    }
  };

  return (
    <Modal onClose={busy ? undefined : onClose}>
      <div className="modal-h">
        <h2>
          {isPatient
            ? tr(lang, "Запит доступу до картки пацієнта", "Request access to patient record")
            : tr(lang, "Запит доступу до звіту", "Request access to report")}
        </h2>
        <p>
          {isPatient
            ? (patientLabel || targetId)
            : (
              <>
                {reportCode ? `${reportCode}` : targetId}
                {patientLabel ? ` · ${patientLabel}` : ""}
              </>
            )}
        </p>
      </div>

      <form className="dsar-modal-body" onSubmit={submit}>
        <div className="dsar-info">
          {lang === "uk" ? (
            <>
              <p style={{ margin: 0 }}>
                Ви — адміністратор і не маєте постійного доступу до медичних записів.
                Цей запит відкриє{" "}
                <strong>{isPatient ? "лише картку цього пацієнта" : "лише цей звіт"}</strong>{" "}
                на {ttlMinutes} хв.
              </p>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {!isPatient && <li>авторів звіту буде повідомлено про ваш доступ;</li>}
                <li>подію та причину буде записано в журнал аудиту;</li>
                <li>{isPatient
                  ? "кожне відкриття картки зараховується окремо;"
                  : "кожне відкриття звіту зараховується окремо."}</li>
                {isPatient && <li>читання звітів пацієнта потребує окремого запиту.</li>}
              </ul>
            </>
          ) : (
            <>
              <p style={{ margin: 0 }}>
                You are an administrator and hold no standing access to clinical
                records. This request opens{" "}
                <strong>{isPatient ? "this one patient record" : "this one report"}</strong>{" "}
                for {ttlMinutes} min.
              </p>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {!isPatient && <li>the report's authors are notified that you opened it;</li>}
                <li>the event and your stated reason enter the audit trail;</li>
                <li>each time you open it is counted separately{isPatient ? ";" : "."}</li>
                {isPatient && <li>reading the patient's reports needs a separate request.</li>}
              </ul>
            </>
          )}
        </div>

        <label>
          {tr(lang, "Причина доступу", "Reason for access")}
          <select
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            disabled={busy}
            required
          >
            <option value="" disabled>
              {tr(lang, "Оберіть причину…", "Select a reason…")}
            </option>
            {reasons.map((r) => (
              <option key={r.code} value={r.code}>
                {lang === "uk" ? r.label_uk : r.label_en}
              </option>
            ))}
          </select>
        </label>

        <label>
          {noteRequired
            ? tr(lang, `Опис причини (мін. ${noteMin} символів)`, `Describe the reason (min ${noteMin} characters)`)
            : tr(lang, "Додаткові деталі (необов'язково)", "Additional detail (optional)")}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={tr(lang, "Напр.: судовий запит №12/2026", "e.g. court order 12/2026")}
            rows={3}
            disabled={busy}
          />
        </label>
        {noteTooShort && note.length > 0 && (
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            {tr(lang,
              `Ще ${noteMin - note.trim().length} символів.`,
              `${noteMin - note.trim().length} more characters.`)}
          </div>
        )}

        <label>
          {tr(lang, "Підтвердьте паролем", "Confirm with your password")}
          <input
            ref={passwordRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder={tr(lang, "Ваш пароль", "Your password")}
            disabled={busy}
            required
          />
        </label>

        {error && (
          <div role="alert" style={{ color: "var(--rec,#dc2626)", fontSize: 13 }}>
            {errorMessage(error, lang, resourceKind)}
          </div>
        )}

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            {tr(lang, "Скасувати", "Cancel")}
          </button>
          <button type="submit" className="btn accent" disabled={!canSubmit}>
            <Icon name="shield" size={13} />
            {busy
              ? tr(lang, "Перевірка…", "Verifying…")
              : tr(lang, "Запитати доступ", "Request access")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default RequestAccessModal;
