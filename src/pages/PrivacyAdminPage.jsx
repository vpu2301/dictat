// PrivacyAdminPage.jsx — sprint 11 step 06: /admin/privacy — the tenant's
// DSAR + erasure queue. Sober by design: document-like rows, full
// sentences, explicit dates, no danger theatrics.
//
// Two-person mirror: requests created by the CURRENT admin render an
// "очікує на розгляд іншим адміністратором" badge and NO approve/reject
// controls; the backend's 403 two_person_rule is still handled (races).
//
// Refresh cadence: queue 30 s; a request in `executing` polls at 5 s.
// Hygiene: rows show displayName + year of birth only; URLs carry UUIDs.

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Icon, Empty, Modal } from "../components/UI.jsx";
import { Loading } from "../components/DataStates.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { useAsync } from "../api/useAsync.js";
import { useClaims } from "../auth/AuthContext.jsx";
import { getPatient, displayName, yearOfBirth } from "../api/patients.js";
import {
  listPrivacyRequests, getPrivacyRequest,
  approvePrivacyRequest, rejectPrivacyRequest, downloadDsarPackage,
} from "../api/privacy.js";
import { ExecutionReport } from "../patients/ExecutionReport.jsx";
import { normalizeExcluded, excludedKindLabel, formatBytes, downloadErrorMessage } from "../privacy/manifest.js";
import { tr } from "../i18n.js";

const QUEUE_REFRESH_MS = 30_000;
const EXECUTING_POLL_MS = 5_000;

const STATUS_LABEL = {
  requested: { uk: "очікує розгляду", en: "awaiting review" },
  review:    { uk: "на розгляді", en: "under review" },
  approved:  { uk: "схвалено — пільговий період", en: "approved — grace period" },
  executing: { uk: "виконується", en: "executing" },
  completed: { uk: "виконано", en: "completed" },
  failed:    { uk: "помилка виконання", en: "failed" },
  rejected:  { uk: "відхилено", en: "rejected" },
};
const statusLabel = (s, lang) => (STATUS_LABEL[s] ? (STATUS_LABEL[s][lang] || STATUS_LABEL[s].en) : s);

function fmtDT(iso, lang) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(tr(lang, "uk-UA", "en-GB"),
    { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function ageOf(iso, lang) {
  const h = Math.floor((Date.now() - new Date(iso)) / 3600e3);
  if (h < 1) return tr(lang, "менш як годину тому", "under an hour ago");
  if (h < 24) return lang === "uk" ? `${h} год тому` : `${h} h ago`;
  const d = Math.floor(h / 24);
  return lang === "uk" ? `${d} дн. тому` : `${d} d ago`;
}

// Grace countdown to scheduled_for (approved erasures).
function GraceCountdown({ until, lang }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  const ms = new Date(until) - Date.now();
  if (ms <= 0) {
    return (
      <span className="privacy-grace" data-testid="grace-countdown">
        {tr(lang, "пільговий період завершено — очікує виконання", "grace period over — awaiting execution")}
      </span>
    );
  }
  const days = Math.floor(ms / 86400e3);
  const hours = Math.floor((ms % 86400e3) / 3600e3);
  return (
    <span className="privacy-grace" data-testid="grace-countdown">
      {lang === "uk"
        ? `виконання ${fmtDT(until, lang)} — залишилось ${days} дн. ${hours} год`
        : `executes ${fmtDT(until, lang)} — ${days}d ${hours}h remaining`}
    </span>
  );
}

// ── approve / reject dialogs ─────────────────────────────────────────────
function ApproveDialog({ req, lang, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const confirm = async () => {
    setBusy(true); setError(null);
    try { onDone(await approvePrivacyRequest(req.id)); }
    catch (e) { setError(e); setBusy(false); }
  };
  const raced = error?.problem?.code === "two_person_rule";
  return (
    <Modal onClose={onClose}>
      <div className="modal-h">
        <h2>{tr(lang, "Схвалити запит на видалення?", "Approve the erasure request?")}</h2>
        <p>{tr(lang, "Друге підтвердження — два адміністратори", "The second confirmation — two administrators")}</p>
      </div>
      <div className="modal-body">
        <div className="privacy-approve-copy">
          {tr(lang, "Схвалення запускає пільговий період (типово 7 днів), після якого дані пацієнта буде безповоротно знищено, окрім того, що закон вимагає зберегти (підписані звіти, записи про згоди, конверти підписів, слід цього запиту). Протягом пільгового періоду запит ще можна скасувати.", "Approval starts the grace period (typically 7 days), after which the patient's data is irreversibly destroyed except what the law requires to retain (signed reports, consent records, signature envelopes, this request's paper trail). During the grace period the request can still be cancelled.")}
        </div>
        {error && (
          <div className="consent-sign-error" role="alert">
            {raced
              ? (tr(lang, "Правило двох осіб: цей запит створили ви — його має схвалити інший адміністратор.", "Two-person rule: you created this request — a different administrator must approve it."))
              : (error.problem?.detail || error.message)}
          </div>
        )}
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>{tr(lang, "Скасувати", "Cancel")}</button>
        <button className="btn accent" disabled={busy || raced} onClick={confirm}>
          {busy ? (tr(lang, "Схвалення…", "Approving…")) : (tr(lang, "Схвалити", "Approve"))}
        </button>
      </div>
    </Modal>
  );
}

function RejectDialog({ req, lang, cancelDuringGrace, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const confirm = async () => {
    if (!reason.trim() || busy) return;
    setBusy(true); setError(null);
    try { onDone(await rejectPrivacyRequest(req.id, { rejection_reason: reason.trim() })); }
    catch (e) { setError(e); setBusy(false); }
  };
  return (
    <Modal onClose={onClose}>
      <div className="modal-h">
        <h2>{cancelDuringGrace
          ? (tr(lang, "Скасувати заплановане видалення?", "Cancel the scheduled erasure?"))
          : (tr(lang, "Відхилити запит?", "Reject the request?"))}</h2>
        <p>{tr(lang, "Причина обов'язкова — вона лишається в записі запиту", "A reason is required — it stays on the request record")}</p>
      </div>
      <div className="modal-body">
        <textarea className="privacy-reason" rows={3} value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={tr(lang, "Напр.: пацієнт відкликав вимогу 16.07.2026…", "e.g. the patient withdrew the demand on 16 Jul 2026…")} />
        {error && <div className="consent-sign-error" role="alert">{error.problem?.detail || error.message}</div>}
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>{tr(lang, "Назад", "Back")}</button>
        <button className="btn" style={{ color: "var(--rec)", borderColor: "var(--rec)" }}
          disabled={!reason.trim() || busy} onClick={confirm}>
          {busy ? "…" : cancelDuringGrace
            ? (tr(lang, "Скасувати видалення", "Cancel the erasure"))
            : (tr(lang, "Відхилити запит", "Reject the request"))}
        </button>
      </div>
    </Modal>
  );
}

// ── DSAR detail (status + download) ──────────────────────────────────────
function DsarDetail({ req, lang, onRefresh }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    try { setDetail(await getPrivacyRequest(req.id)); setError(null); }
    catch (e) { setError(e); }
  }, [req.id]);
  useEffect(() => { load(); }, [load, req.status]);
  // executing → 5 s poll until it settles
  useEffect(() => {
    if ((detail?.status || req.status) !== "executing") return;
    const t = setInterval(async () => {
      const d = await getPrivacyRequest(req.id).catch(() => null);
      if (d) { setDetail(d); if (d.status !== "executing") onRefresh(); }
    }, EXECUTING_POLL_MS);
    return () => clearInterval(t);
  }, [detail?.status, req.status, req.id, onRefresh]);

  const download = async () => {
    setDownloading(true); setError(null);
    try {
      // a FRESH mint per click: re-fetch the status (audited link issue)…
      const fresh = await getPrivacyRequest(req.id);
      setDetail(fresh);
      if (fresh.package_expired) return;         // the expired banner explains it
      if (!fresh.download?.url) {
        // Completed but no link: nothing to click through to, so say so rather
        // than swallowing the click.
        setError({ problem: { detail: tr(lang,
          "Сервер не видав посилання на пакет. Оновіть сторінку або запросіть експорт повторно.",
          "The server issued no download link. Refresh, or request the export again.") } });
        return;
      }
      // …then stream the authenticated zip, using the just-minted HMAC link.
      const blob = await downloadDsarPackage(req.id, fresh.download.url);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `dsar-${req.id}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      // 410 = package aged out mid-flow; reload so the expired banner replaces
      // the button. Everything else gets a translated line under the row.
      if (e.status === 410) await load();
      else setError({ problem: { detail: downloadErrorMessage(e, lang) } });
    } finally {
      setDownloading(false);
    }
  };

  const d = detail || req;
  return (
    <div className="privacy-dsar-detail">
      {d.status === "executing" && (
        <span className="privacy-progress">{tr(lang, "Формується пакет даних…", "Assembling the data package…")}</span>
      )}
      {d.status === "completed" && d.package_expired && (
        <span className="privacy-expired" data-testid="dsar-expired">
          {tr(lang, "Пакет видалено після завершення строку зберігання — запросіть експорт повторно з картки пацієнта.", "The package was deleted after its retention window — request the export again from the patient record.")}
        </span>
      )}
      {d.status === "completed" && !d.package_expired && d.download && (
        <span className="privacy-download">
          <button className="btn sm accent" disabled={downloading} onClick={download} data-testid="dsar-download">
            <Icon name="download" size={13} />
            {downloading ? (tr(lang, "Завантаження…", "Downloading…")) : (tr(lang, "Завантажити пакет", "Download package"))}
          </button>
          <em>{lang === "uk" ? `посилання дійсне до ${fmtDT(d.download.expires_at, lang)}` : `link valid until ${fmtDT(d.download.expires_at, lang)}`}</em>
        </span>
      )}
      {d.status === "completed" && d.manifest_summary && (
        <ManifestSummary summary={d.manifest_summary} lang={lang} />
      )}
      {error && <span className="privacy-expired">{error.problem?.detail || error.message}</span>}
    </div>
  );
}

// What the package contains, and — just as important for a DSAR — what it does
// NOT contain and why. `excluded` arrives as [{kind, reason}], so each entry is
// rendered as its own line instead of being stringified into the summary.
function ManifestSummary({ summary, lang }) {
  const excluded = normalizeExcluded(summary.excluded);
  const size = formatBytes(summary.package_bytes);
  return (
    <div className="privacy-manifest">
      <div className="privacy-manifest-line">
        <span>{tr(lang, "обʼєктів", "items")}: <strong>{summary.item_count ?? "—"}</strong></span>
        {size && <span>{tr(lang, "розмір", "size")}: {size}</span>}
        {summary.engine_version && <span className="pmono">{summary.engine_version}</span>}
      </div>
      {excluded.length > 0 && (
        <div className="privacy-excluded">
          <div className="privacy-excluded-h">
            {tr(lang, "Не увійшло до пакета", "Not included in the package")} ({excluded.length})
          </div>
          <ul>
            {excluded.map((e, i) => (
              <li key={`${e.kind}-${i}`}>
                <span className="privacy-excluded-kind">{excludedKindLabel(e.kind, lang)}</span>
                {e.reason && <span className="privacy-excluded-why">{e.reason}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── erasure detail (report on completed) ────────────────────────────────
function ErasureDetail({ req, lang }) {
  const detailReq = useAsync(
    () => (req.status === "completed" ? getPrivacyRequest(req.id) : Promise.resolve(null)),
    [req.id, req.status],
    { enabled: req.status === "completed" },
  );
  if (req.status !== "completed") return null;
  if (detailReq.loading) return <Loading lang={lang} />;
  const report = detailReq.data?.manifest_summary;
  if (!report) {
    // Honest gap: the as-built status endpoint surfaces report_of_execution
    // for DSAR only — the erasure execution report is stored server-side
    // but not yet exposed (named backend ask). Never fabricate one.
    return (
      <div className="privacy-expired" data-testid="exec-report-unavailable">
        {tr(lang, "Звіт про виконання сформовано на сервері, але API його ще не публікує (задача бекенду). Дані знищено згідно з правилами.", "The execution report exists server-side but the API does not expose it yet (named backend ask).")}
      </div>
    );
  }
  return <ExecutionReport report={report} lang={lang} />;
}

// ── the queue ────────────────────────────────────────────────────────────
export function PrivacyAdminPage({ lang, navigate }) {
  const claims = useClaims();
  const mySub = claims?.sub;
  const listReq = useAsync(() => listPrivacyRequests(), []);
  const requests = Array.isArray(listReq.data) ? listReq.data : [];

  // 30 s queue refresh
  useEffect(() => {
    const t = setInterval(() => listReq.reload(), QUEUE_REFRESH_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // patient labels (name + year ONLY — list hygiene)
  const [patients, setPatients] = useState({});
  const wantedRef = useRef(new Set());
  useEffect(() => {
    for (const r of requests) {
      if (wantedRef.current.has(r.patient_id)) continue;
      wantedRef.current.add(r.patient_id);
      getPatient(r.patient_id)
        .then((p) => setPatients((m) => ({ ...m, [r.patient_id]: p })))
        .catch(() => setPatients((m) => ({ ...m, [r.patient_id]: null })));
    }
  }, [requests]);

  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

  const patientLine = (r) => {
    const p = patients[r.patient_id];
    if (p === undefined) return "…";
    if (p === null) return r.patient_id.slice(0, 8);
    const yob = yearOfBirth(p);
    return `${displayName(p, lang)}${yob ? ` · ${tr(lang, "нар.", "b.")} ${yob}` : ""}`;
  };

  // "Needs action" is the two-person rule made visible: an erasure someone ELSE
  // requested and that is still pending. Your own requests can never be it.
  const needsAction = (r) =>
    r.kind === "erasure" && r.requested_by !== mySub && ["requested", "review"].includes(r.status);
  const inGrace = (r) => r.kind === "erasure" && r.status === "approved";

  const counts = {
    all: requests.length,
    action: requests.filter(needsAction).length,
    grace: requests.filter(inGrace).length,
    erasure: requests.filter((r) => r.kind === "erasure").length,
    dsar: requests.filter((r) => r.kind === "dsar").length,
    completed: requests.filter((r) => r.status === "completed").length,
  };

  const matches = (r) => {
    if (tab === "action" && !needsAction(r)) return false;
    if (tab === "erasure" && r.kind !== "erasure") return false;
    if (tab === "dsar" && r.kind !== "dsar") return false;
    if (tab === "completed" && r.status !== "completed") return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const p = patients[r.patient_id];
    const name = p ? displayName(p, lang) : "";
    return [name, r.reason, r.rejection_reason, r.patient_id, r.id]
      .some((v) => (v || "").toLowerCase().includes(q));
  };

  const visible = requests.filter(matches);
  const erasures = visible.filter((r) => r.kind === "erasure");
  const dsars = visible.filter((r) => r.kind === "dsar");

  const TABS = [
    { key: "all",       n: counts.all,       uk: "Всі",           en: "All" },
    { key: "action",    n: counts.action,    uk: "Потребує дії",  en: "Needs action" },
    { key: "erasure",   n: counts.erasure,   uk: "Видалення",     en: "Erasure" },
    { key: "dsar",      n: counts.dsar,      uk: "DSAR",          en: "DSAR" },
    { key: "completed", n: counts.completed, uk: "Виконані",      en: "Completed" },
  ];

  const renderRow = (r) => {
    const own = r.requested_by === mySub;
    const open = !!expanded[r.id];
    const actionable = r.kind === "erasure" && ["requested", "review"].includes(r.status);
    return (
      <div
        key={r.id}
        className={`privacy-row status-${r.status}${needsAction(r) ? " privacy-row-todo" : ""}`}
        data-own={own || undefined}
      >
        {/* One grid row, same column rhythm as the reports list; the detail
            panel below spans the full width when the row is expanded. */}
        <div
          className="privacy-row-main pv-row"
          role="row"
          tabIndex={0}
          aria-expanded={open}
          onClick={() => setExpanded((m) => ({ ...m, [r.id]: !open }))}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded((m) => ({ ...m, [r.id]: !open })); } }}
        >
          <div className="pcell-name">
            <div className="tpl-icon sm"><Icon name={r.kind === "erasure" ? "shield" : "download"} size={14} /></div>
            <div style={{ minWidth: 0 }}>
              <div className="pname">{patientLine(r)}</div>
              <div className="psub pmono">{r.patient_id.slice(0, 8)}</div>
            </div>
          </div>

          <div style={{ minWidth: 0 }}>
            <span className={`privacy-kind ${r.kind}`}>
              {r.kind === "erasure" ? (tr(lang, "Видалення", "Erasure")) : "DSAR"}
            </span>
            {r.reason && (
              <div className="psub privacy-reason-preview" title={r.reason}>
                «{r.reason.slice(0, 60)}{r.reason.length > 60 ? "…" : ""}»
              </div>
            )}
          </div>

          <div>
            <span className={`privacy-status s-${r.status}`}>{statusLabel(r.status, lang)}</span>
            {r.status === "rejected" && r.rejection_reason && (
              <div className="psub privacy-rejected-reason" title={r.rejection_reason}>
                {tr(lang, "причина: ", "reason: ")}«{r.rejection_reason.slice(0, 40)}»
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 13 }}>{ageOf(r.requested_at, lang)}</div>
            <div className="psub">{fmtDT(r.requested_at, lang)}</div>
          </div>

          {/* Actions never toggle the row open. */}
          <div className="pv-actions" onClick={(e) => e.stopPropagation()}>
            {r.kind === "erasure" && r.status === "approved" && r.scheduled_for && (
              <>
                <GraceCountdown until={r.scheduled_for} lang={lang} />
                <button className="btn sm" onClick={() => setRejectTarget({ req: r, grace: true })}>
                  {tr(lang, "Скасувати видалення", "Cancel the erasure")}
                </button>
              </>
            )}
            {actionable && !own && (
              <>
                <button className="btn sm accent" data-testid="approve-btn" onClick={() => setApproveTarget(r)}>
                  {tr(lang, "Схвалити", "Approve")}
                </button>
                <button className="btn sm" data-testid="reject-btn" onClick={() => setRejectTarget({ req: r, grace: false })}>
                  {tr(lang, "Відхилити", "Reject")}
                </button>
              </>
            )}
            {own && ["requested", "review"].includes(r.status) && r.kind === "erasure" && (
              <span className="privacy-own-badge" data-testid="own-request-badge">
                {tr(lang, "ваш запит — очікує на розгляд іншим адміністратором", "your request — awaiting review by another administrator")}
              </span>
            )}
          </div>

          <div className="pv-chev"><Icon name={open ? "chevDown" : "chevRight"} size={14} /></div>
        </div>

        {open && (
          <div className="privacy-row-detail">
            {r.kind === "dsar"
              ? <DsarDetail req={r} lang={lang} onRefresh={listReq.reload} />
              : <ErasureDetail req={r} lang={lang} />}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page privacy-queue">
      <div className="page-h">
        <div>
          <h1>{tr(lang, "Приватність", "Privacy")}</h1>
          <p className="sub">
            {tr(lang, "Запити DSAR та запити на видалення даних. Видалення схвалюється за правилом двох осіб.", "DSAR and erasure requests. Erasure follows the two-person rule.")}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <button className="btn" onClick={listReq.reload} disabled={listReq.loading}>
            <Icon name="refresh" size={14} /> {tr(lang, "Оновити", "Refresh")}
          </button>
        </div>
      </div>

      <div className="tenant-stats">
        <div className={"stat-card" + (counts.action ? " privacy-stat-action" : "")}>
          <div className="stat-card-h">
            <span className="stat-card-label">{tr(lang, "Потребує вашої дії", "Needs your action")}</span>
            <span className="stat-card-icon"><Icon name="flag" size={15} /></span>
          </div>
          <div className="stat-card-value">{counts.action}</div>
          <div className="stat-card-sub">{tr(lang, "видалення, подані іншими", "erasures requested by others")}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-h">
            <span className="stat-card-label">{tr(lang, "Пільговий період", "In grace period")}</span>
            <span className="stat-card-icon"><Icon name="clock" size={15} /></span>
          </div>
          <div className="stat-card-value">{counts.grace}</div>
          <div className="stat-card-sub">{tr(lang, "ще можна скасувати", "still cancellable")}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-h">
            <span className="stat-card-label">DSAR</span>
            <span className="stat-card-icon"><Icon name="download" size={15} /></span>
          </div>
          <div className="stat-card-value">{counts.dsar}</div>
          <div className="stat-card-sub">{tr(lang, "запити на копію даних", "data copy requests")}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-h">
            <span className="stat-card-label">{tr(lang, "Виконано", "Completed")}</span>
            <span className="stat-card-icon"><Icon name="check" size={15} /></span>
          </div>
          <div className="stat-card-value">{counts.completed}</div>
          <div className="stat-card-sub">{tr(lang, "з", "of")} {counts.all}</div>
        </div>
      </div>

      {listReq.error && <ApiErrorView error={listReq.error} lang={lang} />}

      <div className="ptable-toolbar" style={{ marginBottom: 0, paddingBottom: 12 }}>
        <label className="search-input">
          <Icon name="search" size={14} />
          <input
            placeholder={tr(lang, "Пошук за пацієнтом, причиною, ID…", "Search patient, reason, ID…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && <button style={{ marginLeft: 4, opacity: .6 }} onClick={() => setSearch("")}>✕</button>}
        </label>
      </div>

      <div className="tabs" style={{ marginBottom: 14 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab${tab === t.key ? " on" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {tr(lang, t.uk, t.en)}
            <span className="tab-count">{t.n}</span>
          </button>
        ))}
      </div>

      {/* Erasure first, then DSAR — the two-person queue is the urgent half. */}
      <div className="ptable privacy-ptable">
        <div className="pv-head">
          <span>{tr(lang, "Пацієнт", "Patient")}</span>
          <span>{tr(lang, "Запит", "Request")}</span>
          <span>{tr(lang, "Статус", "Status")}</span>
          <span>{tr(lang, "Створено", "Created")}</span>
          <span>{tr(lang, "Дії", "Actions")}</span>
          <span />
        </div>
        {listReq.loading ? <Loading lang={lang} />
          : visible.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center" }}>
              <Empty
                icon="shield"
                title={requests.length === 0
                  ? tr(lang, "Запитів немає", "No privacy requests")
                  : tr(lang, "Нічого не знайдено", "No matches")}
                body={requests.length === 0
                  ? tr(lang, "Запити DSAR та на видалення зʼявляться тут одразу після створення.", "DSAR and erasure requests show up here as soon as they are raised.")
                  : tr(lang, "Змініть пошук або фільтр.", "Try a different search or filter.")}
              />
            </div>
          ) : [...erasures, ...dsars].map(renderRow)}
      </div>

      {approveTarget && (
        <ApproveDialog req={approveTarget} lang={lang}
          onClose={() => setApproveTarget(null)}
          onDone={() => { setApproveTarget(null); listReq.reload(); }} />
      )}
      {rejectTarget && (
        <RejectDialog req={rejectTarget.req} cancelDuringGrace={rejectTarget.grace} lang={lang}
          onClose={() => setRejectTarget(null)}
          onDone={() => { setRejectTarget(null); listReq.reload(); }} />
      )}
    </div>
  );
}
