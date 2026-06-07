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

export function AsrJobDetailPage({ id, lang = "en", navigate, onToast }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [result, setResult] = useState(null);
  const [resultMissing, setResultMissing] = useState(false);
  const [resultLoading, setResultLoading] = useState(false);
  const [resultError, setResultError] = useState(null);

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

  // Fetch the transcript once the job reaches "complete".
  useEffect(() => {
    if (!job || job.status !== "complete") return;
    if (result || resultMissing || resultLoading) return;
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
  }, [job, id, result, resultMissing, resultLoading]);

  const doCancel = async () => {
    setCancelling(true);
    try {
      await cancelJob(id);
      if (onToast) onToast(lang === "uk" ? "Скасовано" : "Cancelled");
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
        <Empty icon="clock" title={lang === "uk" ? "Завантаження…" : "Loading…"} />
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="page">
        <ApiErrorView error={error} lang={lang} />
        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => navigate("/asr/jobs")}>
            <Icon name="arrowLeft" size={13} />
            <span>{lang === "uk" ? "До списку" : "Back to list"}</span>
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
            {lang === "uk" ? "Завдання" : "Job"}{" "}
            <code className="mono" style={{ fontSize: 14, color: "var(--muted)" }}>{String(id).slice(0, 8)}…</code>
            <AsrStatusPill status={job?.status || "queued"} lang={lang} />
          </h1>
          <p className="muted">
            {lang === "uk" ? "Поставлено: " : "Queued: "}{fmtRelative(job?.queued_at, lang)}
            {active && (
              <> · <span title="auto-refresh">{lang === "uk" ? "оновлюється кожні 2 с" : "auto-refreshing every 2s"}</span></>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => navigate("/asr/jobs")}>
            <Icon name="arrowLeft" size={13} />
            <span>{lang === "uk" ? "До списку" : "Back"}</span>
          </button>
          <button className="btn" onClick={refresh} disabled={loading}>
            <Icon name="refresh" size={13} />
            <span>{lang === "uk" ? "Оновити" : "Refresh"}</span>
          </button>
          {active && (
            <button className="btn btn-danger" onClick={() => setConfirmCancel(true)} disabled={cancelling}>
              <Icon name="x" size={13} />
              <span>{lang === "uk" ? "Скасувати" : "Cancel"}</span>
            </button>
          )}
        </div>
      </div>

      {error && <ApiErrorView error={error} lang={lang} />}

      <section className="card me-section">
        <header className="me-section-h">
          <Icon name="fileText" size={14} />
          <h2>{lang === "uk" ? "Деталі" : "Details"}</h2>
        </header>
        <div className="me-grid">
          <Field label="id" mono>{job?.id ? <code>{job.id}</code> : null}</Field>
          <Field label={lang === "uk" ? "Мова" : "Language"}>{job?.language?.toUpperCase()}</Field>
          <Field label={lang === "uk" ? "Промпт" : "Prompt"} mono>{job?.prompt_id ? <code>{job.prompt_id}</code> : null}</Field>
          <Field label="encounter_id" mono>{job?.encounter_id ? <code>{job.encounter_id}</code> : null}</Field>
          <Field label={lang === "uk" ? "Стартовано" : "Started"} mono>{job?.started_at}</Field>
          <Field label={lang === "uk" ? "Завершено" : "Finished"} mono>{job?.finished_at}</Field>
        </div>
      </section>

      {failed && (
        <section className="card asr-fail" role="alert">
          <header className="me-section-h">
            <Icon name="x" size={14} />
            <h2>{lang === "uk" ? "Помилка обробки" : "Processing failed"}</h2>
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
            <h2>{lang === "uk" ? "Транскрипція" : "Transcript"}</h2>
            {resultLoading && <span className="muted">{lang === "uk" ? "Завантаження…" : "Loading…"}</span>}
          </header>

          {resultError && <ApiErrorView error={resultError} lang={lang} />}

          {resultMissing && (
            <div className="asr-banner asr-banner-warn" role="status" style={{ margin: 12 }}>
              <Icon name="help" size={13} />
              <span>
                {lang === "uk"
                  ? "Бекенд ще не має GET /asr/jobs/{id}/result. Потрібно додати ендпоінт, що проксує EncryptedObjectStore.get() і повертає plaintext TranscriptionOutput (ADR-0011 забороняє клієнтський розшифр)."
                  : "Backend GET /asr/jobs/{id}/result isn't deployed. Ask: add an endpoint that proxies EncryptedObjectStore.get() and returns the plaintext TranscriptionOutput (ADR-0011 forbids client-side decrypt)."}
              </span>
            </div>
          )}

          {result && <TranscriptView output={result} lang={lang} />}
        </section>
      )}

      <details className="card me-section">
        <summary style={{ cursor: "pointer", padding: "12px 16px", fontWeight: 500 }}>
          {lang === "uk" ? "Сирий JSON" : "Raw JSON"}
        </summary>
        <div style={{ padding: "0 16px 16px" }}>
          <JsonViewer value={{ job, result }} />
        </div>
      </details>

      {confirmCancel && (
        <Modal onClose={() => setConfirmCancel(false)}>
          <h3 style={{ margin: 0 }}>{lang === "uk" ? "Скасувати завдання?" : "Cancel this job?"}</h3>
          <p style={{ color: "var(--muted)" }}>
            {lang === "uk"
              ? "Поточне завдання буде скасоване. Якщо обробка вже почалася, її буде зупинено."
              : "The job will be cancelled. If processing has started, it will be stopped."}
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            <button className="btn" onClick={() => setConfirmCancel(false)} disabled={cancelling}>
              {lang === "uk" ? "Назад" : "Back"}
            </button>
            <button className="btn btn-danger" onClick={doCancel} disabled={cancelling}>
              {cancelling ? "…" : (lang === "uk" ? "Скасувати" : "Cancel job")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
