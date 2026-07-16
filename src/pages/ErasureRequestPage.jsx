// ErasureRequestPage.jsx — sprint 11 step 06: the deliberately weighty
// erasure REQUEST flow. Full-screen (not a modal), document-like, sober:
// consequences first, required reason, typed «ВИДАЛЕННЯ» confirmation.
// Wording is always "запит на видалення" — the button never carries a
// delete verb, because this screen cannot delete anything: a SECOND
// administrator must approve, and the grace period runs after that.
//
// Legal copy flagged for review — see todo.md ("S11 legal copy review").

import React, { useState } from "react";
import { Icon } from "../components/UI.jsx";
import { Loading } from "../components/DataStates.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { useAsync } from "../api/useAsync.js";
import { getPatient, displayName } from "../api/patients.js";
import { scheduleErasure } from "../api/privacy.js";

const CONFIRM_WORD = "ВИДАЛЕННЯ";

export function ErasureRequestPage({ patientId, lang, navigate }) {
  const patientReq = useAsync(() => getPatient(patientId), [patientId]);
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);

  if (patientReq.loading) return <div className="page"><Loading lang={lang} /></div>;
  if (patientReq.error) return <div className="page"><ApiErrorView error={patientReq.error} lang={lang} /></div>;
  const patient = patientReq.data;

  const reasonValid = reason.trim().length >= 50 && reason.trim().length <= 500;
  const confirmValid = confirmText.trim() === CONFIRM_WORD;

  const submit = async () => {
    if (!reasonValid || !confirmValid || busy) return;
    setBusy(true); setError(null);
    try {
      const r = await scheduleErasure(patientId, { reason: reason.trim() });
      setCreated(r);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };

  if (created) {
    return (
      <div className="page privacy-doc">
        <div className="privacy-done" data-testid="erasure-request-created">
          <Icon name="check" size={22} />
          <h2>{lang === "uk" ? "Запит на видалення створено" : "Erasure request created"}</h2>
          <p>
            {lang === "uk"
              ? "Статус: очікує на розгляд. Запит має схвалити інший адміністратор — ви не можете схвалити власний запит. Після схвалення почнеться відлік пільгового періоду, протягом якого запит можна скасувати."
              : "Status: awaiting review. A different administrator must approve it — you cannot approve your own request. After approval the grace period starts, during which the request can still be cancelled."}
          </p>
          <div className="privacy-done-actions">
            <button className="btn accent" onClick={() => navigate("/admin/privacy")}>
              {lang === "uk" ? "До черги приватності" : "Open the privacy queue"}
            </button>
            <button className="btn" onClick={() => navigate(`/patients/${patientId}`)}>
              {lang === "uk" ? "До картки пацієнта" : "Back to the patient"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page privacy-doc" data-testid="erasure-request-page">
      <h1>{lang === "uk" ? "Запит на видалення даних пацієнта" : "Request erasure of patient data"}</h1>
      <p className="privacy-doc-sub">
        {displayName(patient, lang)} · <span className="pmono">{patient?.mrn}</span>
      </p>

      {/* 1 — consequences, enumerated as fixed copy */}
      <section className="privacy-block">
        <h3>{lang === "uk" ? "1. Наслідки виконання запиту" : "1. Consequences of executing this request"}</h3>
        {lang === "uk" ? (
          <>
            <p>Після схвалення та завершення пільгового періоду буде <strong>безповоротно знищено</strong>:</p>
            <ul>
              <li>аудіозаписи та транскрипти диктувань і консультацій;</li>
              <li>чернетки звітів (непідписані версії);</li>
              <li>клінічні нотатки та анамнез;</li>
              <li>ідентифікаційні дані картки пацієнта (ПІБ, дата народження, ІПН — криптографічне знищення).</li>
            </ul>
            <p>Згідно із законом буде <strong>збережено</strong>:</p>
            <ul>
              <li>підписані медичні звіти — протягом обов'язкового строку зберігання клінічної документації;</li>
              <li>записи про згоди — як доказ правової підстави обробки;</li>
              <li>конверти кваліфікованих підписів — як юридичний доказ;</li>
              <li>сам запит на видалення та звіт про його виконання.</li>
            </ul>
            <p>
              Цей запит <strong>має схвалити інший адміністратор</strong> — власні запити схвалити неможливо.
              Після схвалення діє пільговий період (типово 7 днів), протягом якого запит можна скасувати.
              Після виконання буде сформовано звіт: що знищено і що збережено та на якій підставі.
            </p>
          </>
        ) : (
          <>
            <p>After approval and the grace period, the following will be <strong>irreversibly destroyed</strong>:</p>
            <ul>
              <li>audio recordings and transcripts of dictations and consultations;</li>
              <li>draft (unsigned) report versions;</li>
              <li>clinical notes and anamnesis;</li>
              <li>patient identity data (name, date of birth, ІПН — cryptographic destruction).</li>
            </ul>
            <p>The law requires the following to be <strong>retained</strong>:</p>
            <ul>
              <li>signed clinical reports — for the statutory clinical-record retention period;</li>
              <li>consent records — as evidence of the lawful basis of processing;</li>
              <li>qualified-signature envelopes — as legal evidence;</li>
              <li>this erasure request and its execution report.</li>
            </ul>
            <p>
              A <strong>different administrator must approve</strong> this request — you cannot approve your own.
              After approval a grace period applies (typically 7 days) during which it can be cancelled.
              Execution produces a report of what was destroyed and what was retained, with the legal basis.
            </p>
          </>
        )}
      </section>

      {/* 2 — required reason */}
      <section className="privacy-block">
        <h3>{lang === "uk" ? "2. Підстава запиту (обов'язково, 50–500 символів)" : "2. Reason for the request (required, 50–500 characters)"}</h3>
        <textarea className="privacy-reason" rows={5} value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={lang === "uk"
            ? "Напр.: письмова вимога пацієнта від 15.07.2026 про реалізацію права на забуття (ст. 17 GDPR)…"
            : "e.g. the patient's written right-to-be-forgotten request of 15 Jul 2026 (GDPR art. 17)…"} />
        <span className={"privacy-count" + (reasonValid ? " ok" : "")}>{reason.trim().length} / 500</span>
      </section>

      {/* 3 — explicit typed confirmation */}
      <section className="privacy-block">
        <h3>{lang === "uk" ? "3. Підтвердження" : "3. Confirmation"}</h3>
        <p>{lang === "uk"
          ? <>Введіть слово <strong className="pmono">{CONFIRM_WORD}</strong>, щоб підтвердити створення запиту:</>
          : <>Type <strong className="pmono">{CONFIRM_WORD}</strong> to confirm creating the request:</>}</p>
        <input className="ti pmono privacy-confirm" value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)} placeholder={CONFIRM_WORD} />
      </section>

      {error && <ApiErrorView error={error} lang={lang} />}

      <div className="privacy-doc-actions">
        <button className="btn" onClick={() => navigate(`/patients/${patientId}`)}>
          {lang === "uk" ? "Скасувати" : "Cancel"}
        </button>
        <button className="btn accent" disabled={!reasonValid || !confirmValid || busy} onClick={submit}>
          {busy
            ? (lang === "uk" ? "Створення запиту…" : "Creating the request…")
            : (lang === "uk" ? "Надіслати запит на видалення" : "Submit the erasure request")}
        </button>
      </div>
    </div>
  );
}
