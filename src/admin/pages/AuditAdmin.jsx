// AuditAdmin.jsx — /admin/audit (events) + /admin/audit/verify (chain walk).
//
// The admin console's window onto the tenant's audit trail: filterable,
// cursor-paged (ascending seq — the chain's natural order), with the verify
// walk one tab away rendering its result in full.
//
// DELIBERATELY ABSENT: any way to get the log out of this screen as a file.
// The DSAR and legal-hold paths own evidence leaving the platform; a casual
// one-click copy of the audit log from an admin screen is a data-leak surface,
// not a feature. src/admin/noAuditExport.test.js pins this by grepping the
// source. (The auditor's own /audit/events page makes a different call for a
// different job — that page is theirs, this one is the admin's.)
import React, { useCallback, useState } from "react";
import { Icon } from "../../components/UI.jsx";
import { ApiErrorView } from "../../components/ApiErrorView.jsx";
import { SeverityChip } from "../../components/SeverityChip.jsx";
import { JsonViewer } from "../../components/JsonViewer.jsx";
import { Pagination } from "../../components/Pagination.jsx";
import { useCursorPages } from "../../api/useCursorPages.js";
import { listAuditEvents, verifyAuditChain } from "../../api/endpoints.js";
import { AUDIT_KINDS, AUDIT_SEVERITIES } from "../auditKinds.js";
import { tr } from "../../i18n.js";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
const DEFAULT_PAGE_SIZE = 100;

const EMPTY_FILTERS = {
  kind: "", severity: "", actor_sub: "",
  since: "", until: "", from_seq: "",
};

function isoLocalToIso(s) {
  if (!s) return "";
  try { return new Date(s).toISOString(); } catch { return s; }
}

// ── Events tab ────────────────────────────────────────────────────────────
function EventsTab({ lang, initialFromSeq }) {
  const seeded = initialFromSeq ? { ...EMPTY_FILTERS, from_seq: initialFromSeq } : EMPTY_FILTERS;
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
      cursor: cursor || undefined,
      limit: pageSize,
    });
    return { items: r.events || [], nextCursor: r.next_cursor || null };
  }, [filters, pageSize]);

  const pg = useCursorPages(fetchPage, [filters, pageSize]);
  const { items: events, loading, error } = pg;

  const apply = (e) => { e.preventDefault(); setFilters(draft); };
  const reset = () => { setDraft(EMPTY_FILTERS); setFilters(EMPTY_FILTERS); };

  return (
    <>
      <form className="card adm-audit-filters" onSubmit={apply} data-testid="audit-filters">
        <label>
          <span>{tr(lang, "Тип події", "Event kind")}</span>
          <input list="adm-audit-kinds" value={draft.kind}
                 onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
                 placeholder="template.deprecated" data-testid="filter-kind" />
          <datalist id="adm-audit-kinds">
            {AUDIT_KINDS.map((k) => <option key={k} value={k} />)}
          </datalist>
        </label>
        <label>
          <span>{tr(lang, "Важливість", "Severity")}</span>
          <select value={draft.severity}
                  onChange={(e) => setDraft({ ...draft, severity: e.target.value })}
                  data-testid="filter-severity">
            <option value="">{tr(lang, "будь-яка", "any")}</option>
            {AUDIT_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>
          <span>{tr(lang, "Актор (sub)", "Actor (sub)")}</span>
          <input value={draft.actor_sub}
                 onChange={(e) => setDraft({ ...draft, actor_sub: e.target.value })}
                 placeholder="uuid" data-testid="filter-actor" />
        </label>
        <label>
          <span>{tr(lang, "Від", "Since")}</span>
          <input type="datetime-local" value={draft.since}
                 onChange={(e) => setDraft({ ...draft, since: e.target.value })}
                 data-testid="filter-since" />
        </label>
        <label>
          <span>{tr(lang, "До", "Until")}</span>
          <input type="datetime-local" value={draft.until}
                 onChange={(e) => setDraft({ ...draft, until: e.target.value })} />
        </label>
        <label>
          <span>from_seq</span>
          <input type="number" min="1" value={draft.from_seq}
                 onChange={(e) => setDraft({ ...draft, from_seq: e.target.value })} />
        </label>
        <div className="adm-audit-filter-actions">
          <button className="btn" type="button" onClick={reset}>{tr(lang, "Скинути", "Reset")}</button>
          <button className="btn btn-primary" type="submit" data-testid="filter-apply">
            {tr(lang, "Застосувати", "Apply")}
          </button>
        </div>
      </form>

      {error && <ApiErrorView error={error} lang={lang} />}

      <section className="card">
        <table className="audit-table adm-table" data-testid="audit-table">
          <thead>
            <tr>
              <th style={{ width: 80 }}>seq</th>
              <th style={{ width: 170 }}>{tr(lang, "Час", "Time")}</th>
              <th style={{ width: 90 }}>{tr(lang, "Важливість", "Severity")}</th>
              <th>{tr(lang, "Тип", "Kind")}</th>
              <th style={{ width: 130 }}>{tr(lang, "Актор", "Actor")}</th>
              <th>{tr(lang, "Ціль", "Target")}</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="audit-empty">
                  {tr(lang, "Подій за цими фільтрами немає.", "No events match these filters.")}
                </td>
              </tr>
            )}
            {events.map((ev) => {
              const open = !!expanded[ev.seq];
              return (
                <React.Fragment key={ev.seq}>
                  <tr className={open ? "row-open" : ""}
                      onClick={() => setExpanded((x) => ({ ...x, [ev.seq]: !x[ev.seq] }))}>
                    <td><code className="mono">{ev.seq}</code></td>
                    <td className="mono">{ev.created_at}</td>
                    <td><SeverityChip severity={ev.severity} /></td>
                    <td><code className="mono">{ev.kind}</code></td>
                    <td>
                      {ev.actor_sub
                        ? <code className="mono">{String(ev.actor_sub).slice(0, 8)}…</code>
                        : <span className="muted">—</span>}
                    </td>
                    <td>
                      {ev.target_kind ? (
                        <span>
                          <code className="mono">{ev.target_kind}</code>{" "}
                          {ev.target_id && <code className="mono muted">/{String(ev.target_id).slice(0, 8)}…</code>}
                        </span>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td><Icon name={open ? "chevDown" : "chevRight"} size={13} /></td>
                  </tr>
                  {open && (
                    <tr className="row-expand">
                      <td colSpan={7}><JsonViewer value={ev.payload ?? ev} /></td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        <div className="adm-table-foot">
          <span className="muted adm-order-note">
            {tr(lang, "Порядок: від найдавніших (за seq)", "Order: oldest first (by seq)")}
          </span>
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
    </>
  );
}

// ── Verify tab ────────────────────────────────────────────────────────────
// Same contract notes as the auditor's page: to_seq < from_seq is a server
// 500 (blocked client-side); ok with zero events is a vacuous pass, not a
// verified chain; a "gap" reports no hashes.
const REASON = {
  gap: {
    uk: "Пропуск у послідовності — подію(ї) видалено або вони не дійшли до журналу.",
    en: "Gap in the sequence — one or more events were deleted or never reached the log.",
  },
  prev_hash_mismatch: {
    uk: "Посилання на попередній хеш не збігається — ланцюг було переписано.",
    en: "The link to the previous hash does not match — the chain was rewritten.",
  },
  payload_hash_mismatch: {
    uk: "Хеш вмісту не збігається — тіло події змінено після запису.",
    en: "The payload hash does not match — the event body was altered after it was written.",
  },
};
const reasonText = (reason, lang) =>
  (REASON[reason] ? tr(lang, REASON[reason].uk, REASON[reason].en) : reason || "—");

function VerifyTab({ lang, navigate }) {
  const [form, setForm] = useState({ from_seq: 1, to_seq: "" });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);

  const run = async (e) => {
    e.preventDefault();
    const from = Number(form.from_seq || 1);
    const to = form.to_seq === "" ? undefined : Number(form.to_seq);
    if (!Number.isInteger(from) || from < 1) {
      setFormError(tr(lang, "from_seq має бути цілим числом ≥ 1.", "from_seq must be a whole number ≥ 1."));
      return;
    }
    if (to !== undefined && (!Number.isInteger(to) || to < from)) {
      setFormError(tr(lang, "to_seq має бути ≥ from_seq.", "to_seq must be ≥ from_seq."));
      return;
    }
    setFormError(null);
    setRunning(true); setError(null); setResult(null);
    try {
      setResult(await verifyAuditChain({ from_seq: from, to_seq: to }));
    } catch (err) { setError(err); }
    finally { setRunning(false); }
  };

  const empty = result && result.ok && !result.events_checked;
  const tone = !result ? null : !result.ok ? "fail" : empty ? "warn" : "ok";

  return (
    <>
      <section className="card admin-card">
        <header className="admin-card-h">
          <Icon name="shield" size={14} />
          <h2>{tr(lang, "Перевірити ланцюг", "Verify the chain")}</h2>
          <small className="muted">
            {tr(lang,
              "Прохід по хеш-ланцюгу журналу. Порожній to_seq — до кінця; довгі діапазони тривають довго.",
              "Walks the log's hash chain. Empty to_seq goes to the end; long ranges take a while.")}
          </small>
        </header>
        <form className="admin-form" onSubmit={run}>
          <label className="admin-field">
            <span>from_seq</span>
            <input type="number" min="1" value={form.from_seq} disabled={running}
                   onChange={(e) => setForm({ ...form, from_seq: e.target.value })} />
          </label>
          <label className="admin-field">
            <span>to_seq</span>
            <input type="number" min="1" value={form.to_seq} disabled={running}
                   placeholder={tr(lang, "до кінця", "to end")}
                   onChange={(e) => setForm({ ...form, to_seq: e.target.value })} />
          </label>
          <div className="admin-form-actions" style={{ alignItems: "center", gap: 12 }}>
            {formError && <span className="field-error" style={{ marginRight: "auto" }}>{formError}</span>}
            <button className="btn accent" type="submit" disabled={running} data-testid="verify-run">
              {running ? tr(lang, "Перевірка…", "Verifying…") : tr(lang, "Перевірити ланцюг", "Verify the chain")}
            </button>
          </div>
        </form>
      </section>

      {error && <ApiErrorView error={error} lang={lang} />}

      {result && (
        <section className={"card verify-result " + tone} data-testid="verify-result">
          <header>
            {tone === "ok" && <Icon name="check" size={28} />}
            {tone === "warn" && <Icon name="help" size={28} />}
            {tone === "fail" && <Icon name="x" size={28} />}
            <div>
              {tone === "ok" && <>
                <strong>{tr(lang, "Підтверджено", "Verified")}</strong>
                <p>{lang === "uk"
                  ? `${result.events_checked} подій перевірено; останній seq ${result.last_seq}.`
                  : `${result.events_checked} events checked; last seq ${result.last_seq}.`}</p>
              </>}
              {tone === "warn" && <>
                <strong>{tr(lang, "У діапазоні немає подій", "No events in this range")}</strong>
                <p>{tr(lang,
                  "Порожній діапазон сервер вважає коректним — це не підтвердження ланцюга. Розширте діапазон.",
                  "The server treats an empty range as valid — that is not a verified chain. Widen the range.")}</p>
              </>}
              {tone === "fail" && <>
                <strong>{tr(lang, "Виявлено розрив", "Divergence detected")}</strong>
                <p data-testid="verify-divergence">
                  seq {result.first_divergence_seq} — {reasonText(result.divergence_reason, lang)}
                </p>
              </>}
            </div>
            <div style={{ flex: 1 }} />
            {!result.ok && result.first_divergence_seq && navigate && (
              <button className="btn"
                      onClick={() => navigate(`/admin/audit?from_seq=${result.first_divergence_seq}`)}>
                <Icon name="list" size={13} /> {tr(lang, "Показати подію", "Show the event")}
              </button>
            )}
          </header>

          <div className="verify-grid">
            <VRow label="events_checked" value={result.events_checked} />
            <VRow label="last_seq" value={result.last_seq} />
            <VRow label="last_hash" value={result.last_hash} mono />
            {!result.ok && <>
              <VRow label="first_divergence_seq" value={result.first_divergence_seq} />
              <VRow label="divergence_reason" value={result.divergence_reason} />
              {result.divergence_reason !== "gap" && <>
                <VRow label="expected_hash" value={result.expected_hash} mono />
                <VRow label="actual_hash" value={result.actual_hash} mono />
              </>}
            </>}
          </div>
        </section>
      )}
    </>
  );
}

function VRow({ label, value, mono }) {
  const emptyValue = value == null || value === "";
  return (
    <div className="verify-row">
      <div className="verify-row-label">{label}</div>
      <div className="verify-row-value" style={{ fontFamily: mono ? "var(--mono)" : "inherit" }}>
        {emptyValue ? <span className="muted">—</span> : String(value)}
      </div>
    </div>
  );
}

// ── The page ──────────────────────────────────────────────────────────────
export function AuditAdmin({ lang = "uk", navigate, tab = "events", initialFromSeq = "" }) {
  return (
    <div className="adm-page adm-audit" data-testid="audit-admin">
      <div className="page-h">
        <div>
          <h1>{tr(lang, "Аудит", "Audit")}</h1>
          <p className="muted">
            {tr(lang,
              "Журнал дій у цій клініці — незмінний, з хеш-ланцюгом. Перегляд і перевірка; збереження у файл звідси навмисно недоступне.",
              "This clinic's action log — append-only, hash-chained. Viewing and verification; saving it to a file from here is deliberately not offered.")}
          </p>
        </div>
      </div>

      <div className="tabs doc-tabs adm-audit-tabs">
        <button className={"tab" + (tab === "events" ? " on" : "")}
                onClick={() => navigate("/admin/audit")} data-testid="audit-tab-events">
          {tr(lang, "Події", "Events")}
        </button>
        <button className={"tab" + (tab === "verify" ? " on" : "")}
                onClick={() => navigate("/admin/audit/verify")} data-testid="audit-tab-verify">
          {tr(lang, "Перевірка ланцюга", "Chain verification")}
        </button>
      </div>

      {tab === "verify"
        ? <VerifyTab lang={lang} navigate={navigate} />
        : <EventsTab lang={lang} initialFromSeq={initialFromSeq} />}
    </div>
  );
}
