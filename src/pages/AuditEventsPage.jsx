// AuditEventsPage.jsx — /audit/events. Filters + cursor-paginated table.
import React, { useCallback, useState } from "react";
import { Icon } from "../components/UI.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { SeverityChip } from "../components/SeverityChip.jsx";
import { JsonViewer } from "../components/JsonViewer.jsx";
import { Pagination } from "../components/Pagination.jsx";
import { useCursorPages } from "../api/useCursorPages.js";
import { listAuditEvents } from "../api/endpoints.js";
import { tr } from "../i18n.js";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
const DEFAULT_PAGE_SIZE = 100;

const SEVERITIES = ["info", "warn", "sec", "error"];

const initialFilters = {
  kind: "", severity: "", actor_sub: "",
  since: "", until: "",
  from_seq: "", to_seq: "",
};

function isoLocalToIso(s) {
  if (!s) return "";
  // datetime-local → ISO 8601 (assume local TZ)
  try { return new Date(s).toISOString(); } catch { return s; }
}

// `initialFromSeq` arrives from /audit/verify's "show the event" link
// (/audit/events?from_seq=<first_divergence_seq>) — verify and events share the
// same per-tenant seq space, so the number can be used as-is.
export function AuditEventsPage({ lang = "en", initialFromSeq = "" }) {
  const seeded = initialFromSeq ? { ...initialFilters, from_seq: initialFromSeq } : initialFilters;
  const [filters, setFilters] = useState(seeded);
  const [draft, setDraft] = useState(seeded);
  const [expanded, setExpanded] = useState({});
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const fetchPage = useCallback(async (cursor) => {
    const r = await listAuditEvents({
      kind: filters.kind || undefined,
      severity: filters.severity || undefined,
      actor_sub: filters.actor_sub || undefined,
      since: isoLocalToIso(filters.since) || undefined,
      until: isoLocalToIso(filters.until) || undefined,
      from_seq: filters.from_seq || undefined,
      to_seq: filters.to_seq || undefined,
      cursor: cursor || undefined,
      limit: pageSize,
    });
    return { items: r.events || [], nextCursor: r.next_cursor || null };
  }, [filters, pageSize]);

  const pg = useCursorPages(fetchPage, [filters, pageSize]);
  const { items: events, loading, error } = pg;

  const applyFilters = (e) => { e.preventDefault(); setFilters(draft); };
  const resetFilters = () => { setDraft(initialFilters); setFilters(initialFilters); };

  const copy = (s) => { try { navigator.clipboard.writeText(s); } catch {} };

  // Evidence has to leave the screen to be worth anything to an auditor.
  // Scoped to the page in view on purpose: /audit/events is a forward-only
  // cursor with no server-side export, so an "export everything" button would
  // either lie or hammer the endpoint. The label says which it is.
  const exportCsv = () => {
    const cols = ["seq", "created_at", "severity", "kind", "actor_sub", "actor_role", "target_kind", "target_id"];
    const esc = (v) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = events.map((ev) => cols.map((c) => esc(ev[c])).concat(esc(JSON.stringify(ev.payload ?? {}))).join(","));
    const csv = [cols.concat("payload").join(",")].concat(rows).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-events-p${pg.page}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  return (
    <div className="page audit-events">
      <div className="page-h">
        <div style={{ flex: 1 }}>
          <h1>{tr(lang, "Аудит — події", "Audit events")}</h1>
          <p className="muted">{tr(lang, "Перегляд журналу аудиту тенанта.", "Browse this tenant's audit log.")}</p>
        </div>
        <button className="btn" onClick={exportCsv} disabled={events.length === 0}
          title={tr(lang, "Експортує сторінку, що на екрані", "Exports the page currently on screen")}>
          <Icon name="download" size={13} />
          {tr(lang, "Експорт CSV (сторінка)", "Export CSV (this page)")}
        </button>
      </div>

      <form className="audit-filters card" onSubmit={applyFilters}>
        <div className="audit-filter-row">
          <label>
            <span>kind</span>
            <input value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} placeholder="auth.login" />
          </label>
          <label>
            <span>actor_sub</span>
            <input value={draft.actor_sub} onChange={(e) => setDraft({ ...draft, actor_sub: e.target.value })} placeholder="uuid" />
          </label>
          <label>
            <span>severity</span>
            <div className="severity-group">
              <button type="button"
                className={"sev-chip " + (draft.severity === "" ? "on" : "")}
                onClick={() => setDraft({ ...draft, severity: "" })}>any</button>
              {SEVERITIES.map((s) => (
                <button type="button" key={s}
                  className={"sev-chip " + (draft.severity === s ? "on" : "")}
                  onClick={() => setDraft({ ...draft, severity: s })}>{s}</button>
              ))}
            </div>
          </label>
        </div>
        <div className="audit-filter-row">
          <label>
            <span>since</span>
            <input type="datetime-local" value={draft.since} onChange={(e) => setDraft({ ...draft, since: e.target.value })} />
          </label>
          <label>
            <span>until</span>
            <input type="datetime-local" value={draft.until} onChange={(e) => setDraft({ ...draft, until: e.target.value })} />
          </label>
          <label>
            <span>from_seq</span>
            <input type="number" value={draft.from_seq} onChange={(e) => setDraft({ ...draft, from_seq: e.target.value })} />
          </label>
          <label>
            <span>to_seq</span>
            <input type="number" value={draft.to_seq} onChange={(e) => setDraft({ ...draft, to_seq: e.target.value })} />
          </label>
          <div className="audit-filter-actions">
            <button className="btn" type="button" onClick={resetFilters}>{tr(lang, "Скинути", "Reset")}</button>
            <button className="btn btn-primary" type="submit">{tr(lang, "Застосувати", "Apply")}</button>
          </div>
        </div>
      </form>

      {error && <ApiErrorView error={error} lang={lang} />}

      <section className="card">
        <table className="audit-table">
          <thead>
            <tr>
              <th style={{ width: 80 }}>seq</th>
              <th style={{ width: 170 }}>created_at</th>
              <th style={{ width: 90 }}>severity</th>
              <th>kind</th>
              <th style={{ width: 130 }}>actor</th>
              <th style={{ width: 110 }}>role</th>
              <th>target</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && !loading && (
              <tr><td colSpan={8} className="audit-empty">{tr(lang, "Подій немає.", "No events.")}</td></tr>
            )}
            {events.map((ev) => {
              const open = !!expanded[ev.seq];
              return (
                <React.Fragment key={ev.seq}>
                  <tr className={open ? "row-open" : ""} onClick={() => setExpanded((e) => ({ ...e, [ev.seq]: !e[ev.seq] }))}>
                    <td><code className="mono">{ev.seq}</code></td>
                    <td className="mono">{ev.created_at}</td>
                    <td><SeverityChip severity={ev.severity} /></td>
                    <td><code className="mono">{ev.kind}</code></td>
                    <td>
                      {ev.actor_sub ? (
                        <span className="actor">
                          <code className="mono">{String(ev.actor_sub).slice(0, 8)}…</code>
                          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); copy(ev.actor_sub); }} title="Copy">
                            <Icon name="download" size={11} />
                          </button>
                        </span>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td>{ev.actor_role || <span className="muted">—</span>}</td>
                    <td>
                      {ev.target_kind ? (
                        <span><code className="mono">{ev.target_kind}</code> {ev.target_id && <code className="mono muted">/{String(ev.target_id).slice(0, 8)}…</code>}</span>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td><Icon name={open ? "chevDown" : "chevRight"} size={13} /></td>
                  </tr>
                  {open && (
                    <tr className="row-expand">
                      <td colSpan={8}>
                        <JsonViewer value={ev.payload ?? ev} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        <div className="audit-foot">
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
        </div>
      </section>
    </div>
  );
}
