// Scribe.jsx — Scribe product (Today, Notes, Consultation). The patients
// roster moved to src/patients/PatientDirectory.jsx (sprint 11 step 02).
// All data is fetched from the core / scribe services; there is no mock layer.
import React, { useState, useEffect } from 'react';
import { useI18n , tr } from "../i18n.js";
import { Icon, Empty, SplitButton } from './UI.jsx';
import { LoadGate, asList } from './DataStates.jsx';
import { Pagination } from './Pagination.jsx';
import { useAsync } from '../api/useAsync.js';
import { listSchedule, listOpenEncounters } from '../api/encounters.js';
import { VisitControls, visitStatusLabel } from '../patients/VisitControls.jsx';
import { listNotes } from '../api/notes.js';
import { listReports, countReports } from '../api/reports.js';
import { listTemplates } from '../api/templates.js';
import { openReportPath, reportPatientLabel } from './Reports.jsx';
import { ReportRow, QuickStartModal } from './DictateHome.jsx';
import { listSessions } from '../api/dictation.js';
import { useClaims } from '../auth/AuthContext.jsx';
import { getSession } from '../api/scribe.js';

// ─── Helpers ─────────────────────────────────────────────────────────────
function loc(v, lang) {
  if (v == null) return "";
  if (typeof v === "object") return v[lang] ?? v.en ?? Object.values(v)[0] ?? "";
  return v;
}
function fmtTime(iso, lang) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(tr(lang, "uk-UA", "en-GB"), { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso, lang) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(tr(lang, "uk-UA", "en-GB"), { day: "2-digit", month: "short", year: "numeric" });
}
function fmtRel(iso, lang) {
  if (!iso) return "";
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d) / 60000);
  if (diffMin < 1) return tr(lang, "щойно", "just now");
  if (diffMin < 60) return lang === "uk" ? `${diffMin} хв тому` : `${diffMin} min ago`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return lang === "uk" ? `${h} год тому` : `${h} h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return lang === "uk" ? `${days} дн. тому` : `${days} d ago`;
  return fmtDate(iso, lang);
}
function fmtDur(s) {
  if (s == null) return "";
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
function patientName(p, lang) { return loc(p?.name, lang); }
function patientShort(p, lang) { return loc(p?.short, lang) || patientName(p, lang); }

function StatusPill({ status, lang }) {
  const label = ({
    live: tr(lang, "наживо", "live"),
    draft: tr(lang, "чернетка", "draft"),
    signed: tr(lang, "підписано", "signed"),
    scheduled: tr(lang, "заплановано", "scheduled"),
    // dictation_sessions.status — a conversation is finalized, not a draft.
    finalized: tr(lang, "завершено", "finalized"),
    failed: tr(lang, "помилка", "failed"),
    active: tr(lang, "наживо", "live"),
    reconnecting: tr(lang, "відновлення", "reconnecting"),
    abandoned: tr(lang, "перервано", "abandoned"),
  })[status] || status;
  return <span className={"status-pill " + status}>{label}</span>;
}

// ─── Avatar accent palette + derivation ──────────────────────────────────
const ACCENT_PALETTE = [
  "#0a8a7a","#2563eb","#7c3aed","#dc2626",
  "#ea580c","#0891b2","#059669","#d97706","#be185d","#0369a1",
];
const autoAccent = (name) =>
  ACCENT_PALETTE[((name || "A").toUpperCase().charCodeAt(0) - 65 + ACCENT_PALETTE.length) % ACCENT_PALETTE.length];

function calcAge(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) age--;
  return age;
}

function autoInitials(nameStr) {
  const parts = String(nameStr || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

function patientAge(p, lang) {
  const a = p?.age ?? calcAge(p?.dob);
  return a == null ? "" : `${a} ${tr(lang, "р.", "y")}`;
}

// ─── Patient avatar ──────────────────────────────────────────────────────
function PatientAvatar({ patient, lang = "uk", size = 36 }) {
  const name = patientName(patient, lang) || patient?.mrn || "";
  const initials = patient?.initials || autoInitials(name);
  const accent = patient?.accent || autoAccent(name);
  return (
    <div className="pavatar" style={{ width: size, height: size, background: accent, fontSize: size * 0.36 }}>
      {initials}
    </div>
  );
}

// The report statuses worth surfacing as "work in progress" — cancelled ones
// are not something to pick back up. Same set the Reports list calls "all".
const ACTIVE_REPORT_STATUSES = ["draft", "finalized", "signed", "amended"];

const isToday = (iso) => {
  if (!iso) return false;
  const d = new Date(iso), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

// ─── Home (the one workspace landing) ────────────────────────────────────
// /scribe and /dictate used to be two landings behind a product switch, each
// showing half the day: one the visits, the other the documents. They are one
// page now — the day on the left, the documents on the right — and /dictate
// redirects here.
export function ScribeToday({ navigate, lang }) {
  // Everything here is tenant-scoped server-side; re-key on the active tenant
  // so a clinic switch refetches instead of showing the previous clinic's day.
  const activeTid = useClaims()?.tid;
  const sched = useAsync(() => listSchedule(), [activeTid]);
  const notes = useAsync(() => listNotes({}), [activeTid]);
  // Visits the clinician has open right now. Separate from /schedule, which
  // only ever returns status='scheduled' rows — this is the list that used
  // to be impossible to drain.
  const open = useAsync(() => listOpenEncounters(), [activeTid]);
  // The day's work does not land in any of the three surfaces above. An
  // ambient consult finalizes into a dictation session and a report draft;
  // /notes only ever holds what the note editor wrote, and a visit that has
  // been completed is neither scheduled nor open. Reading only
  // schedule + open + notes is why this page showed four zeros next to a
  // tenant with fifty reports and a morning of finished consultations.
  const reports = useAsync(() => listReports({ status: ACTIVE_REPORT_STATUSES, limit: 30 }), [activeTid]);
  // Exact tile counts (cheap total=exact calls) rather than counting the
  // truncated feed above.
  const counts = useAsync(
    () => Promise.all([
      countReports({ status: "draft" }),
      countReports({ status: ["signed", "amended"] }),
    ]),
    [activeTid],
  );
  const [draftCount, signedCount] = counts.data || [];
  // `status` is required here: with no filter the endpoint answers with the
  // caller's ACTIVE sessions only (list_active_sessions_for_user), which is
  // empty by definition once the consult is over.
  const sessions = useAsync(() => listSessions({ status: "finalized", limit: 6 }), [activeTid]);
  // Template names for the report rows and the quick-start palette.
  const templatesReq = useAsync(() => listTemplates({ limit: 200 }), [activeTid]);

  const schedList = asList(sched.data).map((s) => ({ ...s, patient: s.patient }));
  const openList = asList(open.data);
  const notesList = asList(notes.data);
  const reportList = asList(reports.data);
  const sessionList = asList(sessions.data);
  const templates = asList(templatesReq.data);
  const tplMap = Object.fromEntries(templates.map((t) => [t.id, t]));

  // The search endpoint returns PHI-minimised hits (report_id, template_id,
  // patient_name_redacted, updated_at); alias them onto the flat shape the
  // shared ReportRow expects.
  const reportRows = reportList.map((h) => ({
    ...h,
    id: h.report_id ?? h.id,
    template: h.template_id ?? h.template,
    modified: h.updated_at ?? h.modified,
    patient: { name: h.patient_name || h.patient_name_redacted || "" },
  }));
  const draftRows = reportRows.filter((r) => r.status === "draft").slice(0, 5);
  // The row this screen used to look for — `status === "in-room"` — is not a
  // status the backend has ever emitted (the enum is scheduled | in_progress
  // | paused | completed | cancelled), so the live row never rendered.
  const liveNow = openList[0] || null;

  // One feed, whichever surface the work landed in. Drafts already listed in
  // "Drafts to finish" are left out so the two panels complement each other
  // instead of printing the same three rows twice.
  const shownDraftIds = new Set(draftRows.map((r) => r.id));
  const recentWork = [
    ...reportList.filter((h) => !shownDraftIds.has(h.report_id ?? h.id)).map((h) => ({
      kind: "report",
      id: h.report_id,
      date: h.updated_at,
      status: h.status,
      tag: h.code,
      label: reportPatientLabel({ patient_name: h.patient_name, patient_initials: h.patient_name_redacted }, lang),
      patient: h.patient_name ? { name: h.patient_name } : null,
    })),
    ...notesList.map((n) => ({
      kind: "note",
      id: n.id,
      date: n.date || n.created_at,
      status: n.status,
      tag: n.template || n.structure,
      label: patientShort(n.patient, lang) || n.patient_id || "",
      patient: n.patient,
    })),
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 6);

  // The day in four numbers — and each one leads somewhere. A count a clinician
  // cannot act on is decoration; "39 drafts" is only useful if it is also the
  // way into the drafts.
  const stats = [
    // A dead dictation-service makes this list empty, and an empty list counts
    // as zero — which is a claim ("no consultations today"), not a gap. Print a
    // dash when the source never answered.
    { label: tr(lang, "Консультацій сьогодні", "Consultations today"),
      icon: "mic",
      value: sessions.error
        ? "—"
        : sessionList.filter((s) => isToday(s.finalized_at || s.last_active_at)).length,
      onClick: () => setActivity("consult") },
    { label: tr(lang, "Активних прийомів", "Open visits"), icon: "users",
      value: openList.length,
      onClick: () => navigate("/patients") },
    { label: tr(lang, "Чернеток звітів", "Draft reports"), icon: "fileText",
      value: draftCount ?? draftRows.length,
      onClick: () => navigate("/documents/reports") },
    { label: tr(lang, "Підписаних", "Signed"), icon: "check",
      value: signedCount ?? 0,
      onClick: () => navigate("/documents/reports") },
  ];

  // One feed for what has just happened, whichever service produced it. Two
  // panels ("recent consultations" / "recent work") split the same question —
  // what did I do today? — across two boxes, which is why the second row of the
  // grid was where the page went to die. Merged and filtered instead.
  const activityRows = [
    ...sessionList.map((s) => ({
      kind: "consult",
      id: s.id,
      date: s.finalized_at || s.last_active_at || s.started_at,
      status: s.status,
      tag: s.language ? String(s.language).toUpperCase() : "",
      dur: s.total_audio_ms ? fmtDur(Math.round(s.total_audio_ms / 1000)) : "",
      label: tr(lang, "Консультація", "Consultation"),
      patient: null,
    })),
    ...recentWork,
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  const [activity, setActivity] = useState("all");
  const ACTIVITY_TABS = [
    { key: "all", label: tr(lang, "Усе", "All") },
    { key: "consult", label: tr(lang, "Консультації", "Consultations") },
    { key: "docs", label: tr(lang, "Документи", "Documents") },
  ];
  const shownActivity = activityRows
    .filter((w) => activity === "all"
      || (activity === "consult" ? w.kind === "consult" : w.kind !== "consult"))
    .slice(0, 8);
  const openActivity = (w) => navigate(
    w.kind === "consult" ? `/scribe/consult/${w.id}`
      : w.kind === "report" ? openReportPath({ id: w.id, status: w.status })
        : `/scribe/notes/${w.id}`,
  );

  const reloadOpen = () => { open.reload(); sched.reload(); };
  const openStudio = (tid) => navigate(tid ? `/studio?mode=dictate&template=${tid}` : "/studio?mode=dictate");
  const [qsOpen, setQsOpen] = useState(false);

  // "Good morning" at half past four in the afternoon is the kind of small lie
  // that makes a screen feel unattended.
  const hour = new Date().getHours();
  const greeting = hour < 12
    ? tr(lang, "Доброго ранку, докторе", "Good morning, doctor")
    : hour < 18
      ? tr(lang, "Доброго дня, докторе", "Good afternoon, doctor")
      : tr(lang, "Доброго вечора, докторе", "Good evening, doctor");

  return (
    <div className="page today">
      <div className="page-h">
        <div style={{ flex: 1 }}>
          <h1>{greeting}</h1>
          {/* Two numbers, because the page now covers both halves of the day:
              what is booked, and what is still unfinished. */}
          <p className="sub">
            {lang === "uk"
              ? `${schedList.length} візитів заплановано · ${draftCount ?? draftRows.length} чернеток очікують · ${new Date().toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" })}`
              : `${schedList.length} visits scheduled · ${draftCount ?? draftRows.length} drafts waiting · ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`}
          </p>
        </div>
        <button className="btn" onClick={() => setQsOpen(true)}>
          <Icon name="layers" size={14} /> {tr(lang, "Швидкий старт", "Quick start")}
        </button>
        {/* Every way a task can start, behind one button. The primary is the
            ambient consult; the caret lists the rest, each routing straight to
            its own surface. Mirrors the sidebar's create control. */}
        <SplitButton
          lang={lang}
          primary={{
            icon: "mic",
            label: tr(lang, "Почати консультацію", "Start consultation"),
            onClick: () => navigate("/scribe/consult/new"),
          }}
          actions={[
            { icon: "waveform", label: tr(lang, "Нове диктування", "New dictation"), kbd: "D",
              onClick: () => navigate("/studio?mode=dictate") },
            { icon: "users", label: tr(lang, "Розмова з пацієнтом", "Conversation mode"),
              onClick: () => navigate("/studio?mode=scribe") },
            { icon: "fileText", label: tr(lang, "Написати нотатку", "Take a note"),
              onClick: () => navigate("/scribe/notes/new") },
            { icon: "bot", label: tr(lang, "Завантажити на транскрипцію", "Upload for transcription"),
              onClick: () => navigate("/studio?mode=audio") },
            { icon: "layers", label: tr(lang, "Диктувати за шаблоном", "Dictate from a template"),
              onClick: () => setQsOpen(true) },
          ]}
        />
      </div>

      <div className="stats-row">
        {stats.map((s, i) => (
          <button key={i} type="button" className="stat-card" onClick={s.onClick}>
            <div className="stat-h">
              <span className="stat-v">{s.value}</span>
              <Icon name={s.icon} size={14} className="stat-i" />
            </div>
            <div className="stat-l">{s.label}</div>
          </button>
        ))}
      </div>

      {liveNow && (
        <div className="liveroom">
          <div
            className="liveroom-l"
            style={{ cursor: "pointer" }}
            onClick={() => liveNow.patient?.id && navigate(`/scribe/patients/${liveNow.patient.id}`)}
          >
            <PatientAvatar patient={liveNow.patient} lang={lang} size={44} />
            <div>
              <div className="liveroom-name">
                {patientName(liveNow.patient, lang)}{" "}
                <span className={`chip ${liveNow.status === "paused" ? "draft" : "live"}`}>
                  {visitStatusLabel(liveNow.status, lang)}
                </span>
              </div>
              <div className="liveroom-meta">
                {loc(liveNow.reason, lang)} · {fmtTime(liveNow.started_at || liveNow.occurred_at, lang)}
              </div>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <button
            className="btn accent"
            onClick={() =>
              navigate(`/studio?mode=dictate&patient=${liveNow.patient?.id || ""}&encounter=${liveNow.id}`)
            }
          >
            <Icon name="mic" size={13} /> {tr(lang, "Розпочати запис", "Begin recording")}
          </button>
          {/* The control that did not exist: the visit can be closed from
              the screen that shows it is still running. */}
          <VisitControls encounter={liveNow} lang={lang} onChanged={reloadOpen} />
        </div>
      )}

      {/* Two columns, not four quadrants. The left one is what is OWED — the
          queue a clinician came here to drain, and the feed of what it has
          already produced; the right one is context: the day ahead and the
          visits still open. Both start at the top, so nothing that matters is
          parked in a second grid row below the fold, which is where "recent
          consultations" had been disappearing. */}
      <div className="today-grid">
      <div className="today-col">

        {/* The queue that used to be the whole point of the Dictate landing:
            unfinished report drafts, newest first, reopening in the Studio. */}
        <section className="panel">
          <div className="panel-h">
            <h3>{tr(lang, "Чернетки до завершення", "Drafts to finish")}</h3>
            {(draftCount ?? draftRows.length) > 0 && (
              <span className="chip">{draftCount ?? draftRows.length}</span>
            )}
            <div style={{ flex: 1 }} />
            <a className="btn ghost sm" onClick={() => navigate("/documents/reports")}>{tr(lang, "Усі", "All")}</a>
          </div>
          <LoadGate req={reports} lang={lang}>
            {() => (draftRows.length === 0 ? (
              <Empty icon="check" title={tr(lang, "Усі звіти завершено", "All caught up")}
                     body={tr(lang, "Немає незавершених чернеток.", "No pending drafts.")} />
            ) : (
              <div className="note-feed">
                {draftRows.map((r) => (
                  <ReportRow key={r.id} r={r} tpl={tplMap[r.template]} lang={lang}
                             onClick={() => navigate(openReportPath(r))} />
                ))}
              </div>
            ))}
          </LoadGate>
        </section>

        {/* Everything the day produced, in one feed: finalized consultations
            with their transcript, reports past draft, and notes. */}
        <section className="panel">
          <div className="panel-h">
            <h3>{tr(lang, "Остання активність", "Recent activity")}</h3>
            <div style={{ flex: 1 }} />
            <div className="seg" role="tablist" aria-label={tr(lang, "Фільтр активності", "Activity filter")}>
              {ACTIVITY_TABS.map((t) => (
                <button key={t.key} type="button" role="tab" aria-selected={activity === t.key}
                        className={`seg-btn${activity === t.key ? " on" : ""}`}
                        onClick={() => setActivity(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {/* The consultations half comes from a different service than the
              documents half — when only that one is down, the feed still shows
              the documents and says so, instead of failing whole. */}
          {sessions.error && activity !== "docs" && (
            <div className="today-note">
              {tr(lang, "Консультації зараз недоступні.", "Consultations are unavailable right now.")}
            </div>
          )}
          <LoadGate req={reports} lang={lang}>
            {() => (shownActivity.length === 0 ? (
              <Empty icon="fileText" title={tr(lang, "Ще немає роботи", "Nothing yet")}
                     body={tr(lang, "Звіти, нотатки та транскрипти з'являться тут одразу після першої консультації.",
                                    "Reports, notes and transcripts show up here after your first consultation.")} />
            ) : (
              <div className="note-feed">
                {shownActivity.map((w) => (
                  <div key={w.kind + w.id} className="note-row" onClick={() => openActivity(w)}>
                    {w.kind === "consult"
                      ? <span className="note-row-ico"><Icon name="mic" size={14} /></span>
                      : <PatientAvatar patient={w.patient} lang={lang} size={32} />}
                    <div className="note-row-body">
                      <div className="note-row-1">
                        <span className="note-row-name">{w.label}</span>
                        {w.tag && <span className="chip scribe">{w.tag}</span>}
                        <StatusPill status={w.status} lang={lang} />
                      </div>
                      <div className="note-row-2">
                        {fmtRel(w.date, lang)}{w.dur ? ` · ${w.dur}` : ""}
                      </div>
                    </div>
                    <Icon name="chevRight" size={14} />
                  </div>
                ))}
              </div>
            ))}
          </LoadGate>
        </section>
      </div>

      <aside className="today-col">
        <section className="panel">
          <div className="panel-h">
            <h3>{tr(lang, "Графік на сьогодні", "Today's schedule")}</h3>
            {schedList.length > 0 && <span className="chip">{schedList.length}</span>}
            <div style={{ flex: 1 }} />
          </div>
          <LoadGate req={sched} lang={lang}
            empty={() => <Empty icon="calendar" title={tr(lang, "Немає візитів на сьогодні", "No visits scheduled today")} />}>
            {() => (
              <div className="schedule">
                {schedList.map((item) => (
                  <div key={item.id} className={`sch-row ${item.status}`}
                       onClick={() => item.patient?.id && navigate(`/scribe/patients/${item.patient.id}`)}>
                    {/* `item.time` never existed on the wire — the encounter
                        carries occurred_at. */}
                    <div className="sch-time">{fmtTime(item.occurred_at, lang)}</div>
                    <div className="sch-divider"><div className="sch-dot" /><div className="sch-line" /></div>
                    <div className="sch-body">
                      <div className="sch-row-1">
                        <PatientAvatar patient={item.patient} lang={lang} size={28} />
                        <div className="sch-name">{patientName(item.patient, lang)}</div>
                        <div className="sch-age">· {patientAge(item.patient, lang)}{item.patient?.sex ? `, ${item.patient.sex}` : ""}</div>
                      </div>
                      <div className="sch-reason">{loc(item.reason, lang)}</div>
                    </div>
                    <div className="sch-status">
                      <Icon name="chevRight" size={14} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </LoadGate>
        </section>

        {openList.length > 1 && (
        <section className="panel">
          <div className="panel-h">
            <h3>{tr(lang, "Активні прийоми", "Open visits")}</h3>
            <div style={{ flex: 1 }} />
            <span className="chip">{openList.length}</span>
          </div>
          <div className="schedule">
            {openList.slice(1).map((item) => (
              <div key={item.id} className="sch-row" style={{ alignItems: "center" }}>
                <div className="sch-time">{fmtTime(item.started_at || item.occurred_at, lang)}</div>
                <div className="sch-divider"><div className="sch-dot" /><div className="sch-line" /></div>
                <div
                  className="sch-body"
                  style={{ cursor: "pointer" }}
                  onClick={() => item.patient?.id && navigate(`/scribe/patients/${item.patient.id}`)}
                >
                  <div className="sch-row-1">
                    <PatientAvatar patient={item.patient} lang={lang} size={28} />
                    <div className="sch-name">{patientName(item.patient, lang)}</div>
                    <span className={`chip ${item.status === "paused" ? "draft" : "live"}`}>
                      {visitStatusLabel(item.status, lang)}
                    </span>
                  </div>
                  <div className="sch-reason">{loc(item.reason, lang)}</div>
                </div>
                <VisitControls encounter={item} lang={lang} compact onChanged={reloadOpen} />
              </div>
            ))}
          </div>
        </section>
      )}

      </aside>
      </div>

      {/* The Dictate landing's template palette, kept: it is the fastest way
          into the Studio with the right structure already chosen. */}
      {qsOpen && (
        <QuickStartModal
          templates={templates}
          req={templatesReq}
          lang={lang}
          onPick={(tid) => { setQsOpen(false); openStudio(tid); }}
          onManage={() => { setQsOpen(false); navigate("/library/reports"); }}
          onClose={() => setQsOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Notes feed (cross-patient inbox) ────────────────────────────────────
const SCRIBE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const SCRIBE_DEFAULT_PAGE_SIZE = 20;

export function ScribeNotes({ navigate, lang, embedded = false }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(SCRIBE_DEFAULT_PAGE_SIZE);
  const req = useAsync(() => listNotes({}), []);
  const all = asList(req.data);

  const list = all.filter((n) => {
    if (filter !== "all" && n.status !== filter) return false;
    if (!q) return true;
    const s = (patientName(n.patient, lang) + " " + loc(n.title, lang) + " " + (n.structure || "") + " " + n.id).toLowerCase();
    return s.includes(q.toLowerCase());
  });

  // Reset to the first page whenever the search / status filter changes.
  useEffect(() => { setPage(1); }, [q, filter]);
  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageList = list.slice((safePage - 1) * pageSize, safePage * pageSize);

  const counts = {
    all: all.length,
    live: all.filter((n) => n.status === "live").length,
    draft: all.filter((n) => n.status === "draft").length,
    signed: all.filter((n) => n.status === "signed").length,
  };
  const filterLabel = (k) => ({
    all: tr(lang, "Усі", "All"),
    live: tr(lang, "Наживо", "Live"),
    draft: tr(lang, "Чернетки", "Drafts"),
    signed: tr(lang, "Підписані", "Signed"),
  })[k];

  // `embedded`: a tab of the Documents page, which owns the frame, the title
  // and the create button (see ReportsList for the same contract).
  return (
    <div className={embedded ? "page-embedded" : "page"}>
      {!embedded && (
      <div className="page-h">
        <div>
          <h1>{tr(lang, "Нотатки", "Notes")}</h1>
          <p className="sub">{all.length} {tr(lang, "нотаток у вашій стрічці", "notes in your feed")}</p>
        </div>
        <button className="btn accent" onClick={() => navigate("/scribe/consult/new")}>
          <Icon name="mic" size={14} />
          {tr(lang, "Нова консультація", "New consultation")}
        </button>
      </div>
      )}

      <div className="ptable-toolbar" style={{ marginBottom: 0, paddingBottom: 14 }}>
        <label className="search-input">
          <Icon name="search" size={14} />
          <input
            placeholder={tr(lang, "Пошук пацієнта, шаблону…", "Search patient, template…")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>

      <div className="tabs" style={{ marginBottom: 14 }}>
        {["all", "live", "draft", "signed"].map((k) => (
          <button key={k} className={"tab" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>
            {filterLabel(k)}
            <span className="tab-count">{counts[k]}</span>
          </button>
        ))}
      </div>

      <div className="ptable">
        <div className="ptable-head" style={{ gridTemplateColumns: "2fr 1.2fr 1fr 1fr 30px" }}>
          <span>{tr(lang, "Пацієнт", "Patient")}</span>
          <span>{tr(lang, "Шаблон", "Template")}</span>
          <span>{tr(lang, "Статус", "Status")}</span>
          <span>{tr(lang, "Створено", "Created")}</span>
          <span></span>
        </div>
        <LoadGate req={req} lang={lang}
          empty={() => (
            <div style={{ padding: "40px 24px", textAlign: "center" }}>
              <Empty icon="fileText" title={tr(lang, "Ще немає нотаток", "No notes yet")} />
            </div>
          )}>
          {() => (
            list.length === 0 ? (
              <div style={{ padding: "40px 24px", textAlign: "center" }}>
                <Empty icon="search" title={tr(lang, "Нічого не знайдено", "No notes match your filter")} />
              </div>
            ) : pageList.map((n) => {
              const pid = n.patient?.id || n.patientId || n.patient_id;
              return (
                /* A note id is not a dictation-session id: this row used to
                   open /scribe/consult/{noteId}, which can only 404. The note
                   opens in the note editor. */
                <div key={n.id} className="ptable-row" style={{ gridTemplateColumns: "2fr 1.2fr 1fr 1fr 30px" }}
                     onClick={() => navigate("/scribe/notes/" + n.id)}>
                  <div className="pcell-name">
                    <PatientAvatar patient={n.patient} lang={lang} size={32} />
                    <div>
                      <div className="pname">{patientName(n.patient, lang) || pid}</div>
                      {/* The note's own first line, so a list of five SOAP
                          drafts is distinguishable without opening them. */}
                      <div className="psub">
                        {loc(n.title, lang)
                          || `${patientAge(n.patient, lang)}${n.patient?.sex ? ` · ${n.patient.sex}` : ""}`}
                      </div>
                    </div>
                  </div>
                  <div><span className="chip">{n.template || n.structure}</span></div>
                  <div><StatusPill status={n.status} lang={lang} /></div>
                  <div className="psub">{fmtRel(n.date || n.created_at, lang)}</div>
                  <div style={{ color: "var(--muted)" }}><Icon name="chevRight" size={14} /></div>
                </div>
              );
            })
          )}
        </LoadGate>
      </div>

      {!req.loading && !req.error && list.length > 0 && (
        <Pagination
          page={safePage}
          pageCount={pageCount}
          onPage={setPage}
          onPrev={() => setPage(p => Math.max(1, p - 1))}
          onNext={() => setPage(p => Math.min(pageCount, p + 1))}
          total={list.length}
          pageSize={pageSize}
          pageSizeOptions={SCRIBE_PAGE_SIZE_OPTIONS}
          onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
          lang={lang}
        />
      )}
    </div>
  );
}

// ─── New patient modal + patients roster ────────────────────────────────
// Moved to src/patients/PatientDirectory.jsx in sprint 11 step 02 (adds
// edit/archive, the ІПН field, cursor pagination, and the PII-hygiene
// search behavior). ScribePatients here was its sprint-old predecessor.

// ─── Consultation viewer (reads a finalized scribe session) ──────────────
// Reads the transcript dictation-service persisted at finalize (see
// src/api/scribe.js). Live capture happens in src/conversation/, not here.
export function ScribeConsult({ id, patientHint, navigate, lang, onRecordingChange }) {
  // This viewer never holds a live recording — clear any parent indicator.
  React.useEffect(() => { onRecordingChange?.(null); }, []); // eslint-disable-line

  // "/scribe/consult/new" carries the literal sentinel "new", not a session id
  // (the consent flow lands here after granting: ConsentScreen → consult/new?
  // patient=…&consented=1). It is NOT a persisted session — fetching it hit
  // GET /scribe/sessions/new → 404, which surfaced as a spurious error right
  // after a consent that had already been recorded. Treat it as "no session".
  const hasSession = !!id && id !== "new";
  const req = useAsync(() => (hasSession ? getSession(id) : Promise.resolve(null)), [id]);

  if (!hasSession) {
    return (
      <div className="page">
        <Empty
          icon="mic"
          title={tr(lang, "Немає активної сесії", "No active session")}
          body={tr(lang, "Запис консультації ще не розпочато. Створіть сесію, щоб переглянути транскрипт і нотатку.", "No consultation has been recorded yet. Start a session to see the transcript and note.")}
          action={<button className="btn" onClick={() => navigate("/scribe")}>{tr(lang, "До розкладу", "Back to schedule")}</button>}
        />
      </div>
    );
  }

  return (
    <LoadGate req={req} lang={lang}
      empty={() => (
        <div className="page">
          <Empty icon="search" title={tr(lang, "Сесію не знайдено", "Session not found")} body={id}
            action={<button className="btn" onClick={() => navigate("/documents/notes")}>{tr(lang, "До нотаток", "Back to notes")}</button>} />
        </div>
      )}>
      {(session) => (
        <ConsultView session={session} patientId={patientHint} navigate={navigate} lang={lang} />
      )}
    </LoadGate>
  );
}

// Who a turn is attributed to. The backend's diarization emits anonymous
// S1/S2/UNKNOWN labels and its doctor↔patient mapping ABSTAINS when the
// signal is weak — so an unattributed turn must render as an anonymous
// voice. Calling it "Лікар" would launder a machine abstention into an
// attribution in a clinical record.
function turnWho(turn, lang) {
  if (turn.speaker === "patient") return tr(lang, "Пацієнт", "Patient");
  if (turn.speaker === "clinician") return tr(lang, "Лікар", "Clinician");
  if (turn.label === "S1" || turn.label === "S2") {
    return lang === "uk" ? `Голос ${turn.label}` : `Voice ${turn.label}`;
  }
  return tr(lang, "Мовець невідомий", "Speaker unknown");
}

function ConsultView({ session, patientId, navigate, lang }) {
  const patient = session.patient || {};
  const pid = patient.id || patientId;
  const turns = asList(session.transcript);

  return (
    <div className="consult">
      <div className="consult-h">
        <button className="tb-back" onClick={() => navigate(pid ? `/scribe/patients/${pid}` : "/scribe/notes")}>
          <Icon name="arrowLeft" size={16} />
        </button>
        <PatientAvatar patient={patient} lang={lang} size={36} />
        <div className="consult-h-meta">
          <div className="consult-h-name">
            {patientName(patient, lang) || tr(lang, "Розмова", "Conversation")}
          </div>
          <div className="consult-h-sub">
            {[
              session.durationS != null ? fmtDur(Math.round(session.durationS)) : null,
              turns.length
                ? (lang === "uk" ? `${turns.length} реплік` : `${turns.length} turns`)
                : null,
              fmtRel(session.finalizedAt || session.startedAt, lang) || null,
            ].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {session.status && <StatusPill status={session.status} lang={lang} />}
      </div>

      <div className="consult-split">
        <section className="tx-pane">
          <div className="tx-h">
            <h3>{tr(lang, "Транскрипт", "Transcript")}</h3>
            {session.unattributed > 0 && (
              <span className="psub" style={{ marginLeft: 8 }}>
                {lang === "uk"
                  ? `${session.unattributed} без мовця`
                  : `${session.unattributed} without a speaker`}
              </span>
            )}
          </div>
          <div className="tx-body">
            {turns.map((turn, i) => (
              <div key={turn.id || i} className={`turn ${turn.speaker || "unattributed"}`}>
                <div className="turn-meta">
                  <span className="turn-who">{turnWho(turn, lang)}</span>
                  <span className="turn-t">{fmtDur(turn.t)}</span>
                </div>
                <div className="turn-text">{turn.text}</div>
              </div>
            ))}
            {!turns.length && (
              <Empty icon="mic"
                title={tr(lang, "Нічого не записано", "Nothing was recorded")}
                body={tr(lang,
                  "Ця сесія завершилася без розпізнаного мовлення. Аудіо збережено, але транскрипту немає.",
                  "This session finished with no recognised speech. The audio was stored, but there is no transcript.")} />
            )}
          </div>
        </section>

        <section className="note-pane">
          <div className="note-body">
            {/* No note is generated from a transcript anywhere in the
                backend yet (note synthesis is a later sprint). What DOES
                produce a document is the conversation review → "Створити
                чернетку" → a Studio draft, so send the clinician there
                rather than to a screen with nothing behind it. */}
            <Empty icon="fileText"
              title={tr(lang, "Нотатка не генерується автоматично", "Notes are not generated automatically")}
              body={tr(lang,
                "Автоматичне створення нотатки з транскрипту ще не доступне. Створіть чернетку звіту на основі цієї розмови та відредагуйте її у Студії.",
                "Generating a note from the transcript is not available yet. Create a report draft from this conversation and edit it in the Studio.")}
              action={turns.length ? (
                <button className="btn accent" onClick={() => navigate(`/studio?mode=dictate&patient=${pid || ""}`)}>
                  <Icon name="fileText" size={13} /> {tr(lang, "До Студії", "Open the Studio")}
                </button>
              ) : null} />

            {asList(session.flags).length > 0 && (
              <article className="note-flags">
                <div className="note-flags-h"><Icon name="sparkle" size={13} /><h4>{tr(lang, "AI помітив", "AI noticed")}</h4></div>
                {session.flags.map((f) => (
                  <div key={f.id} className={`flag ${f.level}`}>
                    <Icon name={f.level === "miss" ? "flag" : f.level === "warn" ? "bell" : "check"} size={12} />
                    <span>{loc(f.text, lang)}</span>
                  </div>
                ))}
              </article>
            )}

            {asList(session.codes).length > 0 && (
              <article className="note-codes">
                <div className="note-flags-h"><Icon name="tag" size={13} /><h4>{tr(lang, "Запропоновані коди МКХ-10", "Suggested ICD-10 codes")}</h4></div>
                <div className="codes">
                  {session.codes.map((c) => (
                    <div key={c.code} className="code-chip">
                      <span className="code-id">{c.code}</span>
                      <span className="code-desc">{loc(c.desc, lang)}</span>
                    </div>
                  ))}
                </div>
              </article>
            )}

          </div>
        </section>
      </div>
    </div>
  );
}
