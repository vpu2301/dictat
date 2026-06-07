// AuditEventsPage.jsx — /audit/events. Filters + cursor-paginated table.
import React, { useEffect, useState, useCallback } from "react";
import { Icon } from "../components/UI.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { SeverityChip } from "../components/SeverityChip.jsx";
import { JsonViewer } from "../components/JsonViewer.jsx";
import { listAuditEvents } from "../api/endpoints.js";

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

export function AuditEventsPage({ lang = "en" }) {
  const [filters, setFilters] = useState(initialFilters);
  const [draft, setDraft] = useState(initialFilters);
  const [events, setEvents] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

  const load = useCallback(async (cur, append) => {
    setLoading(true); setError(null);
    try {
      const r = await listAuditEvents({
        kind: filters.kind || undefined,
        severity: filters.severity || undefined,
        actor_sub: filters.actor_sub || undefined,
        since: isoLocalToIso(filters.since) || undefined,
        until: isoLocalToIso(filters.until) || undefined,
        from_seq: filters.from_seq || undefined,
        to_seq: filters.to_seq || undefined,
        cursor: cur || undefined,
        limit: 100,
      });
      const next = r.events || [];
      setEvents((cur ? (prev) => [...prev, ...next] : () => next));
      setCursor(r.next_cursor || null);
    } catch (e) { setError(e); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { setEvents([]); setCursor(null); load(null, false); }, [load]);

  const applyFilters = (e) => { e.preventDefault(); setFilters(draft); };
  const resetFilters = () => { setDraft(initialFilters); setFilters(initialFilters); };

  const copy = (s) => { try { navigator.clipboard.writeText(s); } catch {} };

  return (
    <div className="page audit-events">
      <div className="page-h">
        <div>
          <h1>{lang === "uk" ? "Аудит — події" : "Audit events"}</h1>
          <p className="muted">{lang === "uk" ? "Перегляд журналу аудиту тенанта." : "Browse this tenant's audit log."}</p>
        </div>
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
            <button className="btn" type="button" onClick={resetFilters}>{lang === "uk" ? "Скинути" : "Reset"}</button>
            <button className="btn btn-primary" type="submit">{lang === "uk" ? "Застосувати" : "Apply"}</button>
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
              <tr><td colSpan={8} className="audit-empty">{lang === "uk" ? "Подій немає." : "No events."}</td></tr>
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
          {loading && <span className="muted">{lang === "uk" ? "Завантаження…" : "Loading…"}</span>}
          {!loading && cursor && (
            <button className="btn" onClick={() => load(cursor, true)}>{lang === "uk" ? "Наступна сторінка" : "Next page"}</button>
          )}
          {!loading && !cursor && events.length > 0 && (
            <span className="muted">{lang === "uk" ? "Кінець." : "End of results."}</span>
          )}
        </div>
      </section>
    </div>
  );
}
