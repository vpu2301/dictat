// AsrJobDetailPage.jsx — /asr/jobs/:id.
//
// Polls GET /asr/jobs/{id} every 2s while the job is queued or running.
// On complete: fetches plaintext output via getJobResult() and renders
// the transcript. On failed: shows error_kind + error_detail. Cancel
// button is visible while the job is active.
import React, { useEffect, useRef, useState, useCallback } from "react";
import { Icon, Modal, Empty } from "../components/UI.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { AsrStatusPill } from "../components/AsrStatusPill.jsx";
import { TranscriptView } from "../components/TranscriptView.jsx";
import { JsonViewer } from "../components/JsonViewer.jsx";
import { getJob, cancelJob, getJobResult, ASR_ACTIVE, ASR_TERMINAL } from "../api/asr.js";
import { reportsBySourceJobs } from "../api/reports.js";
import { AssignTranscriptModal } from "../components/AssignTranscriptModal.jsx";
import { useAuth, hasAnyRole } from "../auth/AuthContext.jsx";
import { tr } from "../i18n.js";

const POLL_MS = 2000;

function fmtRelative(iso, lang) {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const ds = Math.max(0, (Date.now() - t) / 1000);
  if (ds < 60)      return lang === "uk" ? `${Math.floor(ds)} с тому`       : `${Math.floor(ds)}s ago`;
  if (ds < 3600)    return lang === "uk" ? `${Math.floor(ds / 60)} хв тому` : `${Math.floor(ds / 60)}m ago`;
  if (ds < 86400)   return lang === "uk" ? `${Math.floor(ds / 3600)} год тому` : `${Math.floor(ds / 3600)}h ago`;
  return new Date(t).toLocaleString();
}

// How long this job has been going: since it started running, else since it
// was queued. Re-rendered by the 2s poll, so it stays honest without a timer.
function elapsedLabel(job, lang) {
  const from = job?.started_at || job?.queued_at;
  const t = from ? Date.parse(from) : NaN;
  if (Number.isNaN(t)) return tr(lang, "щойно", "just now");
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  const mmss = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return job?.started_at
    ? tr(lang, `в обробці ${mmss}`, `running for ${mmss}`)
    : tr(lang, `у черзі ${mmss}`, `queued for ${mmss}`);
}

function Field({ label, children, mono }) {
  return (
    <div className="me-field">
      <div className="me-field-label">{label}</div>
      <div className="me-field-value" style={{ fontFamily: mono ? "var(--mono)" : "inherit" }}>
        {children ?? <span className="muted">—</span>}
      </div>
    </div>
  );
}

// `embedded` = hosted by the Studio workspace, which owns the back affordance
// (its session rail) and wants the assignment handed to it rather than turned
// into a link the clinician has to notice.
export function AsrJobDetailPage({ id, lang = "en", navigate, onToast, embedded = false, onAssigned, onStatus }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [result, setResult] = useState(null);
  const [resultMissing, setResultMissing] = useState(false);
  const [resultLoading, setResultLoading] = useState(false);
  const [resultError, setResultError] = useState(null);

  // Assign-to-patient: is this job already saved as a draft report?
  const [assignment, setAssignment] = useState(null); // {report_id, code, status, patient_id} | null
  const [assignOpen, setAssignOpen] = useState(false);

  // Who gets to see the service's raw answer. Auditors and tenant admins do
  // the reconciling; a clinician transcribing a consultation has no use for it
  // and every reason not to be shown a UUID soup mid-workflow.
  const { state: auth } = useAuth();
  const auditView = hasAnyRole(auth?.claims, ["auditor", "tenant_admin", "super_admin"]);

  const pollRef = useRef(null);
  const cancelledRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const j = await getJob(id);
      if (cancelledRef.current) return;
      setJob(j);
      setError(null);
      return j;
    } catch (e) {
      if (cancelledRef.current) return;
      // A poll that lands on an expired access token is not a failure of the
      // job: the client refreshes and the next tick succeeds. Painting
      // "Unauthorized (401) — Token expired" over a running transcription
      // reported the session's plumbing as the job's outcome. A 401 that is
      // really terminal ends the session anyway (RootGate), so nothing is
      // swallowed by staying quiet here.
      if (e?.status === 401) return;
      setError(e);
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [id]);

  // Initial load + polling lifecycle.
  useEffect(() => {
    cancelledRef.current = false;
    setLoading(true);
    setJob(null);
    setResult(null);
    setResultMissing(false);
    setResultError(null);

    const tick = async () => {
      const j = await refresh();
      if (cancelledRef.current) return;
      if (j && ASR_ACTIVE.has(j.status)) {
        pollRef.current = setTimeout(tick, POLL_MS);
      }
    };
    tick();

    return () => {
      cancelledRef.current = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [id, refresh]);

  // Tell whoever is hosting this page what the job is doing, so a running
  // transcription is visible from OUTSIDE the tab it lives in — the whole
  // promise of "you can walk away" depends on it being announced elsewhere.
  useEffect(() => {
    if (job?.status) onStatus?.(job.status);
  }, [job?.status, onStatus]);

  // Fetch the transcript once the job reaches "complete".
  // NOTE: resultLoading must stay OUT of this effect's guard and deps —
  // setResultLoading(true) inside the fetch re-ran the effect, whose
  // cleanup flipped `cancelled` before the response landed, so neither
  // setResult nor setResultLoading(false) ever ran (permanent spinner).
  useEffect(() => {
    if (!job || job.status !== "complete") return;
    if (result || resultMissing) return;
    let cancelled = false;
    (async () => {
      setResultLoading(true);
      setResultError(null);
      try {
        const r = await getJobResult(id);
        if (cancelled) return;
        if (r.missing) setResultMissing(true);
        else setResult(r.output);
      } catch (e) {
        if (!cancelled) setResultError(e);
      } finally {
        if (!cancelled) setResultLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [job, id, result, resultMissing]);

  // Once complete, look up whether this job is already assigned to a patient
  // (saved as a draft report). Drives the assigned banner vs the assign button.
  useEffect(() => {
    if (!job || job.status !== "complete") return;
    let cancelled = false;
    (async () => {
      try {
        const map = await reportsBySourceJobs([id]);
        if (!cancelled) setAssignment(map.get(id) || null);
      } catch {
        /* non-fatal: leave the assign button available */
      }
    })();
    return () => { cancelled = true; };
  }, [job, id]);

  const doCancel = async () => {
    setCancelling(true);
    try {
      await cancelJob(id);
      if (onToast) onToast(tr(lang, "Скасовано", "Cancelled"));
      setConfirmCancel(false);
      refresh();
    } catch (e) {
      setError(e);
      setConfirmCancel(false);
    } finally {
      setCancelling(false);
    }
  };

  if (loading && !job) {
    return (
      <div className="page">
        <Empty icon="clock" title={tr(lang, "Завантаження…", "Loading…")} />
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="page">
        <ApiErrorView error={error} lang={lang} />
        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => navigate("/documents/transcripts")}>
            <Icon name="arrowLeft" size={13} />
            <span>{tr(lang, "До списку", "Back to list")}</span>
          </button>
        </div>
      </div>
    );
  }

  const active = job && ASR_ACTIVE.has(job.status);
  const failed = job && job.status === "failed";
  const done = job && job.status === "complete";

  return (
    <div className="page asr-job">
      <div className="page-h">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {tr(lang, "Завдання", "Job")}{" "}
            <code className="mono" style={{ fontSize: 14, color: "var(--muted)" }}>{String(id).slice(0, 8)}…</code>
            <AsrStatusPill status={job?.status || "queued"} lang={lang} />
          </h1>
          <p className="muted">
            {tr(lang, "Поставлено: ", "Queued: ")}{fmtRelative(job?.queued_at, lang)}
            {active && (
              <> · <span title="auto-refresh">{tr(lang, "оновлюється кожні 2 с", "auto-refreshing every 2s")}</span></>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!embedded && (
            <button className="btn" onClick={() => navigate("/documents/transcripts")}>
              <Icon name="arrowLeft" size={13} />
              <span>{tr(lang, "До списку", "Back")}</span>
            </button>
          )}
          <button className="btn" onClick={refresh} disabled={loading}>
            <Icon name="refresh" size={13} />
            <span>{tr(lang, "Оновити", "Refresh")}</span>
          </button>
          {done && !assignment && (
            <button className="btn accent" onClick={() => setAssignOpen(true)}>
              <Icon name="user" size={13} />
              <span>{tr(lang, "Призначити пацієнту", "Assign to patient")}</span>
            </button>
          )}
          {active && (
            <button className="btn btn-danger" onClick={() => setConfirmCancel(true)} disabled={cancelling}>
              <Icon name="x" size={13} />
              <span>{tr(lang, "Скасувати", "Cancel")}</span>
            </button>
          )}
        </div>
      </div>

      {assignment && (
        <div className="asr-banner asr-banner-ok assign-banner" role="status">
          <Icon name="check" size={14} />
          <span>
            {tr(lang, "Призначено пацієнту — ", "Assigned to patient — ")}
            <a href={`#/dictate/reports/${assignment.report_id}`}
              onClick={(e) => { e.preventDefault(); navigate(`/dictate/reports/${assignment.report_id}`); }}>
              {assignment.code || tr(lang, "звіт", "report")}
            </a>
            {assignment.status ? ` (${assignment.status})` : ""}
          </span>
        </div>
      )}

      {error && <ApiErrorView error={error} lang={lang} />}

      {/* While it runs, the screen should say so in one glance. The details
          card is for afterwards; a clinician watching a transcription wants to
          know it is alive, roughly how long it has been going, and that they
          are free to walk away. */}
      {active && (
        <section className="asr-progress" data-state={job.status} role="status" aria-live="polite"
          data-testid="asr-progress">
          <div className="asr-progress-wave" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => <i key={i} style={{ animationDelay: `${i * 0.09}s` }} />)}
          </div>
          <div className="asr-progress-b">
            <h2>
              {job.status === "queued"
                ? tr(lang, "У черзі на розпізнавання", "Queued for transcription")
                : tr(lang, "Розпізнаємо аудіо…", "Transcribing the audio…")}
            </h2>
            <p>
              {job.status === "queued"
                ? tr(lang, "Файл прийнято. Обробка почнеться, щойно звільниться робітник.",
                           "The file is accepted. Processing starts as soon as a worker frees up.")
                : tr(lang, "Готовий транскрипт з'явиться просто тут. Можна закрити вкладку або зайнятися іншим документом — обробка триває на сервері.",
                           "The finished transcript appears right here. You can close the tab or work on another document — processing continues on the server.")}
            </p>
            <div className="asr-progress-meta">
              <span><Icon name="clock" size={12} /> {elapsedLabel(job, lang)}</span>
              <span className="asr-progress-sep" />
              <span>{tr(lang, "оновлюється кожні 2 с", "refreshed every 2s")}</span>
              {job.language && <><span className="asr-progress-sep" /><span>{String(job.language).toUpperCase()}</span></>}
            </div>
          </div>
        </section>
      )}

      <section className="card me-section">
        <header className="me-section-h">
          <Icon name="fileText" size={14} />
          <h2>{tr(lang, "Деталі", "Details")}</h2>
        </header>
        <div className="me-grid">
          <Field label="id" mono>{job?.id ? <code>{job.id}</code> : null}</Field>
          <Field label={tr(lang, "Мова", "Language")}>{job?.language?.toUpperCase()}</Field>
          <Field label={tr(lang, "Промпт", "Prompt")} mono>{job?.prompt_id ? <code>{job.prompt_id}</code> : null}</Field>
          <Field label="encounter_id" mono>{job?.encounter_id ? <code>{job.encounter_id}</code> : null}</Field>
          <Field label={tr(lang, "Стартовано", "Started")} mono>{job?.started_at}</Field>
          <Field label={tr(lang, "Завершено", "Finished")} mono>{job?.finished_at}</Field>
        </div>
      </section>

      {failed && (
        <section className="card me-section asr-fail" role="alert">
          <header className="me-section-h">
            <Icon name="x" size={14} />
            <h2>{tr(lang, "Помилка обробки", "Processing failed")}</h2>
          </header>
          <div className="me-grid">
            <Field label="error_kind" mono>{job.error_kind ? <code>{job.error_kind}</code> : null}</Field>
            <Field label="error_detail">{job.error_detail}</Field>
          </div>
        </section>
      )}

      {done && (
        <section className="card me-section">
          <header className="me-section-h">
            <Icon name="bot" size={14} />
            <h2>{tr(lang, "Транскрипція", "Transcript")}</h2>
            {resultLoading && <span className="muted">{tr(lang, "Завантаження…", "Loading…")}</span>}
          </header>

          {resultError && <ApiErrorView error={resultError} lang={lang} />}

          {resultMissing && (
            <div className="asr-banner asr-banner-warn" role="status" style={{ margin: 12 }}>
              <Icon name="help" size={13} />
              <span>
                {tr(lang, "Транскрипція готова, але бекенд віддає лише pre-signed URL на зашифрований об'єкт (.json.enc), який браузер не може розшифрувати (ADR-0011). Потрібно, щоб GET /asr/jobs/{id}/result проксував EncryptedObjectStore.get() і повертав plaintext TranscriptionOutput.", "The transcript exists, but the backend only returns a pre-signed URL to the encrypted object (.json.enc), which the browser cannot decrypt (ADR-0011). GET /asr/jobs/{id}/result needs to proxy EncryptedObjectStore.get() and return the plaintext TranscriptionOutput.")}
              </span>
            </div>
          )}

          {result && <TranscriptView output={result} lang={lang} />}
        </section>
      )}

      {/* The raw envelope is evidence, not workflow: an auditor reconciling a
          transcript against what the service actually returned needs it, a
          clinician transcribing a consultation never does. Role-gated rather
          than deleted — removing it would cost the audit trail a primary
          source. */}
      {auditView && (
        <details className="card me-section">
          <summary style={{ cursor: "pointer", fontWeight: 500 }}>
            {tr(lang, "Сирий JSON (для аудиту)", "Raw JSON (for audit)")}
          </summary>
          <div style={{ marginTop: 12 }}>
            <JsonViewer value={{ job, result }} />
          </div>
        </details>
      )}

      {/* The platform's dialog shell (header / body / footer), not a stack of
          inline styles: this one was raw markup dropped into `.modal`, so it
          rendered without padding and with its buttons hard against the edge. */}
      {confirmCancel && (
        <Modal onClose={() => setConfirmCancel(false)} className="dialog-modal">
          <div className="modal-h">
            <h2>{tr(lang, "Скасувати завдання?", "Cancel this job?")}</h2>
            <p>
              {tr(lang, "Поточне завдання буде скасоване. Якщо обробка вже почалася, її буде зупинено.",
                        "The job will be cancelled. If processing has started, it will be stopped.")}
            </p>
          </div>
          <div className="modal-body">
            {/* What is actually lost, said plainly — the audio survives, the
                transcript does not exist yet, and the job cannot be resumed. */}
            <ul className="asr-cancel-facts">
              <li>
                <Icon name="audio" size={13} />
                {tr(lang, "Завантажене аудіо залишиться у системі.", "The uploaded audio stays in the system.")}
              </li>
              <li>
                <Icon name="fileText" size={13} />
                {tr(lang, "Транскрипт створено не буде — доведеться поставити завдання заново.",
                          "No transcript will be produced — you would have to queue the job again.")}
              </li>
            </ul>
          </div>
          <div className="modal-foot">
            <button className="btn" onClick={() => setConfirmCancel(false)} disabled={cancelling}>
              {tr(lang, "Не скасовувати", "Keep processing")}
            </button>
            <button className="btn btn-danger" onClick={doCancel} disabled={cancelling}>
              <Icon name={cancelling ? "refresh" : "x"} size={13} className={cancelling ? "spin" : undefined} />
              {cancelling
                ? tr(lang, "Скасування…", "Cancelling…")
                : tr(lang, "Скасувати завдання", "Cancel the job")}
            </button>
          </div>
        </Modal>
      )}

      {assignOpen && (
        <AssignTranscriptModal
          jobId={id}
          jobLanguage={job?.language}
          lang={lang}
          navigate={navigate}
          onClose={() => setAssignOpen(false)}
          onAssigned={(res) => {
            setAssignment({
              report_id: res.id, code: res.code,
              status: res.status || "draft", patient_id: res.patient_id,
            });
            onAssigned?.(res);
          }}
        />
      )}
    </div>
  );
}
