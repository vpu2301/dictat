// AsrJobsListPage.jsx — /asr/jobs. Paginated list of recent jobs.
import React, { useCallback, useEffect, useState } from "react";
import { Icon, Empty } from "../components/UI.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { AsrStatusPill } from "../components/AsrStatusPill.jsx";
import { Pagination } from "../components/Pagination.jsx";
import { AssignTranscriptModal } from "../components/AssignTranscriptModal.jsx";
import { useCursorPages } from "../api/useCursorPages.js";
import { listJobs } from "../api/asr.js";
import { reportsBySourceJobs } from "../api/reports.js";
import { tr } from "../i18n.js";

const STATUSES = ["queued", "running", "complete", "failed", "cancelled"];
const STATUS_LABEL = {
  "": { uk: "Всі", en: "All" },
  queued: { uk: "У черзі", en: "Queued" },
  running: { uk: "Виконується", en: "Running" },
  complete: { uk: "Готово", en: "Complete" },
  failed: { uk: "Помилка", en: "Failed" },
  cancelled: { uk: "Скасовано", en: "Cancelled" },
};
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

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

export function AsrJobsListPage({ lang = "en", navigate, embedded = false }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const fetchPage = useCallback(async (cursor) => {
    const r = await listJobs({
      status: statusFilter || undefined,
      cursor: cursor || undefined,
      limit: pageSize,
    });
    const items = r.jobs || r.items || (Array.isArray(r) ? r : []);
    return { items, nextCursor: r.next_cursor || null };
  }, [statusFilter, pageSize]);

  const pg = useCursorPages(fetchPage, [statusFilter, pageSize]);
  const { items: jobs, loading, error } = pg;

  // Assignment badges: one bulk lookup per page over the complete jobs.
  const [assignments, setAssignments] = useState(new Map()); // jobId → {report_id, code, status}
  const [assignJob, setAssignJob] = useState(null);          // job being quick-assigned

  const completeIds = jobs.filter((j) => j.status === "complete").map((j) => j.id).join(",");
  useEffect(() => {
    if (!completeIds) { setAssignments(new Map()); return; }
    let cancelled = false;
    (async () => {
      try {
        const map = await reportsBySourceJobs(completeIds.split(","));
        if (!cancelled) setAssignments(map);
      } catch {
        /* non-fatal: badges just won't show */
      }
    })();
    return () => { cancelled = true; };
  }, [completeIds]);

  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };

  const L = (m) => m[lang] ?? m.en;

  return (
    <div className={embedded ? "page-embedded asr-jobs" : "page asr-jobs"}>
      {/* `embedded`: a tab of the Documents page, which owns the frame, the
          title and the create button. Refresh moves down next to the status
          filters so it stays one click away. */}
      {!embedded && (
      <div className="page-h">
        <div>
          <h1>{tr(lang, "Транскрипції", "Transcription jobs")}</h1>
          <p className="sub">
            {tr(lang, "Останні завдання у тенанті.", "Recent jobs in this tenant.")}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <button className="btn" onClick={() => pg.reload()} disabled={loading}>
            <Icon name="refresh" size={14} />
            <span>{tr(lang, "Оновити", "Refresh")}</span>
          </button>
          <button className="btn accent" onClick={() => navigate("/studio?mode=audio")}>
            <Icon name="plus" size={14} />
            <span>{tr(lang, "Нове завдання", "New job")}</span>
          </button>
        </div>
      </div>
      )}

      <div className="tabs" style={{ marginBottom: 14, alignItems: "center" }}>
        {["", ...STATUSES].map((s) => (
          <button
            key={s || "all"}
            type="button"
            className={`tab${statusFilter === s ? " on" : ""}`}
            onClick={() => setStatusFilter(s)}
          >
            {L(STATUS_LABEL[s])}
          </button>
        ))}
        {embedded && (
          <button className="btn sm" style={{ marginLeft: "auto" }} onClick={() => pg.reload()} disabled={loading}>
            <Icon name="refresh" size={13} />
            <span>{tr(lang, "Оновити", "Refresh")}</span>
          </button>
        )}
      </div>

      {error && <ApiErrorView error={error} lang={lang} />}

      <div className="ptable asr-job-table">
        <div className="ptable-head">
          <div>{tr(lang, "Завдання", "Job")}</div>
          <div>{tr(lang, "Статус", "Status")}</div>
          <div>{tr(lang, "Мова", "Lang")}</div>
          <div>{tr(lang, "Призначення", "Assignment")}</div>
          <div></div>
        </div>

        {jobs.length === 0 && !loading ? (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <Empty icon="bot" title={tr(lang, "Завдань немає", "No jobs yet")} />
          </div>
        ) : jobs.map((j) => {
          const asg = assignments.get(j.id);
          return (
            <div
              key={j.id}
              role="row"
              tabIndex={0}
              className="ptable-row"
              onClick={() => navigate(`/asr/jobs/${encodeURIComponent(j.id)}`)}
              onKeyDown={(e) => e.key === "Enter" && navigate(`/asr/jobs/${encodeURIComponent(j.id)}`)}
            >
              <div className="pcell-name">
                <div className="tpl-icon sm"><Icon name="bot" size={14} /></div>
                <div>
                  <div className="pname mono">{String(j.id).slice(0, 8)}…</div>
                  <div className="psub">{fmtRelative(j.queued_at, lang)}</div>
                </div>
              </div>
              <div><AsrStatusPill status={j.status} lang={lang} /></div>
              <div>
                {j.language
                  ? <span className="chip">{j.language.toUpperCase()}</span>
                  : <span className="psub">—</span>}
              </div>
              <div>
                {j.status !== "complete" ? (
                  <span className="psub">—</span>
                ) : asg ? (
                  <button type="button" className="asr-assigned-badge" title={asg.code}
                    onClick={stop(() => navigate(`/dictate/reports/${asg.report_id}`))}>
                    <Icon name="check" size={11} />
                    <span>{asg.code || tr(lang, "призначено", "assigned")}</span>
                  </button>
                ) : (
                  <button type="button" className="btn small"
                    onClick={stop(() => setAssignJob(j))}>
                    <Icon name="user" size={12} />
                    <span>{tr(lang, "Призначити", "Assign")}</span>
                  </button>
                )}
              </div>
              <div className="pdir-row-actions"><Icon name="chevRight" size={14} /></div>
            </div>
          );
        })}
      </div>

      <Pagination
        page={pg.page}
        hasPrev={pg.hasPrev}
        hasNext={pg.hasNext}
        onPrev={pg.prev}
        onNext={pg.next}
        loading={loading}
        lang={lang}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageSizeChange={setPageSize}
      />

      {assignJob && (
        <AssignTranscriptModal
          jobId={assignJob.id}
          jobLanguage={assignJob.language}
          lang={lang}
          navigate={navigate}
          onClose={() => setAssignJob(null)}
          onAssigned={(res) => setAssignments((m) => {
            const next = new Map(m);
            next.set(assignJob.id, { report_id: res.id, code: res.code, status: res.status || "draft" });
            return next;
          })}
        />
      )}
    </div>
  );
}
