// AsrJobsListPage.jsx — /asr/jobs. Paginated list of recent jobs.
import React, { useCallback, useEffect, useState } from "react";
import { Icon } from "../components/UI.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { AsrStatusPill } from "../components/AsrStatusPill.jsx";
import { listJobs } from "../api/asr.js";

const STATUSES = ["queued", "running", "complete", "failed", "cancelled"];
const PAGE_SIZE = 25;

function fmtRelative(iso, lang) {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const ds = Math.max(0, (Date.now() - t) / 1000);
  if (ds < 60)    return lang === "uk" ? `${Math.floor(ds)} с тому`       : `${Math.floor(ds)}s ago`;
  if (ds < 3600)  return lang === "uk" ? `${Math.floor(ds / 60)} хв тому` : `${Math.floor(ds / 60)}m ago`;
  if (ds < 86400) return lang === "uk" ? `${Math.floor(ds / 3600)} год тому` : `${Math.floor(ds / 3600)}h ago`;
  return new Date(t).toLocaleString();
}

export function AsrJobsListPage({ lang = "en", navigate }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [jobs, setJobs] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (cur, append) => {
    setLoading(true); setError(null);
    try {
      const r = await listJobs({
        status: statusFilter || undefined,
        cursor: cur || undefined,
        limit: PAGE_SIZE,
      });
      const next = r.jobs || r.items || (Array.isArray(r) ? r : []);
      setJobs(append ? (prev) => [...prev, ...next] : () => next);
      setCursor(r.next_cursor || null);
    } catch (e) { setError(e); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { setJobs([]); setCursor(null); load(null, false); }, [load]);

  return (
    <div className="page asr-jobs">
      <div className="page-h">
        <div>
          <h1>{lang === "uk" ? "Транскрипції" : "Transcription jobs"}</h1>
          <p className="muted">
            {lang === "uk" ? "Останні завдання у тенанті." : "Recent jobs in this tenant."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => load(null, false)} disabled={loading}>
            <Icon name="refresh" size={13} />
            <span>{lang === "uk" ? "Оновити" : "Refresh"}</span>
          </button>
          <button className="btn btn-primary" onClick={() => navigate("/asr/new")}>
            <Icon name="plus" size={13} />
            <span>{lang === "uk" ? "Нове завдання" : "New job"}</span>
          </button>
        </div>
      </div>

      <div className="card audit-filters">
        <div className="audit-filter-row">
          <label>
            <span>{lang === "uk" ? "Статус" : "Status"}</span>
            <div className="severity-group">
              <button
                type="button"
                className={"sev-chip " + (statusFilter === "" ? "on" : "")}
                onClick={() => setStatusFilter("")}
              >
                {lang === "uk" ? "будь-який" : "any"}
              </button>
              {STATUSES.map((s) => (
                <button
                  type="button"
                  key={s}
                  className={"sev-chip " + (statusFilter === s ? "on" : "")}
                  onClick={() => setStatusFilter(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </label>
        </div>
      </div>

      {error && <ApiErrorView error={error} lang={lang} />}

      <section className="card">
        <table className="audit-table">
          <thead>
            <tr>
              <th style={{ width: 110 }}>id</th>
              <th style={{ width: 130 }}>{lang === "uk" ? "Статус" : "Status"}</th>
              <th style={{ width: 70 }}>{lang === "uk" ? "Мова" : "Lang"}</th>
              <th>{lang === "uk" ? "Промпт" : "Prompt"}</th>
              <th style={{ width: 170 }}>{lang === "uk" ? "Поставлено" : "Queued"}</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && !loading && (
              <tr><td colSpan={6} className="audit-empty">
                {lang === "uk" ? "Завдань немає." : "No jobs yet."}
              </td></tr>
            )}
            {jobs.map((j) => (
              <tr
                key={j.id}
                onClick={() => navigate(`/asr/jobs/${encodeURIComponent(j.id)}`)}
                style={{ cursor: "pointer" }}
              >
                <td><code className="mono">{String(j.id).slice(0, 8)}…</code></td>
                <td><AsrStatusPill status={j.status} lang={lang} /></td>
                <td>{j.language ? <span className="chip">{j.language.toUpperCase()}</span> : <span className="muted">—</span>}</td>
                <td><code className="mono" style={{ fontSize: 11 }}>{j.prompt_id ? String(j.prompt_id).slice(0, 12) + "…" : "—"}</code></td>
                <td className="mono" style={{ fontSize: 12 }}>{fmtRelative(j.queued_at, lang)}</td>
                <td><Icon name="chevRight" size={13} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="audit-foot">
          {loading && <span className="muted">{lang === "uk" ? "Завантаження…" : "Loading…"}</span>}
          {!loading && cursor && (
            <button className="btn" onClick={() => load(cursor, true)}>
              {lang === "uk" ? "Наступна сторінка" : "Next page"}
            </button>
          )}
          {!loading && !cursor && jobs.length > 0 && (
            <span className="muted">{lang === "uk" ? "Кінець." : "End of results."}</span>
          )}
        </div>
      </section>
    </div>
  );
}
