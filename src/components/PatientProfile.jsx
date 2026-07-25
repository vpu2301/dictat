// PatientProfile.jsx — Sprint 11: Enhanced patient profile (live data).
// Step 03: identity header (full DOB is appropriate HERE — the year-only
// rule is for lists) + the merged clinical feed via src/patients/feed.js.
import React, { useState, useEffect, useRef } from 'react';
import { Icon, Modal, Empty } from './UI.jsx';
import { Loading, asList } from './DataStates.jsx';
import { ApiErrorView } from './ApiErrorView.jsx';
import { useAsync } from '../api/useAsync.js';
import { useClaims, hasAnyRole } from '../auth/AuthContext.jsx';
import { hasClinicalAccess } from '../auth/permissions.js';
import { RequestAccessModal } from './RequestAccessModal.jsx';
import { getPatient, getPatientTimeline, updatePatient } from '../api/patients.js';
import { mergeFeed } from '../patients/feed.js';
import { PatientFormModal } from '../patients/PatientDirectory.jsx';
import { ConsentSignDialog } from '../patients/ConsentSheet.jsx';
import { listEncounters, createEncounter } from '../api/encounters.js';
import { listConsents, withdrawConsent } from '../api/consents.js';
import { listNotes } from '../api/notes.js';
import { getAnamnesis } from '../api/anamnesis.js';
import { requestDsar } from '../api/privacy.js';
import { tr } from "../i18n.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loc(v, lang) {
  if (v == null) return "";
  if (typeof v === "object") return v[lang] ?? v.en ?? Object.values(v)[0] ?? "";
  return v;
}
function fmtDate(iso, lang) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(tr(lang, "uk-UA", "en-GB"), { day: "2-digit", month: "short", year: "numeric" });
}
function fmtTime(iso, lang) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(tr(lang, "uk-UA", "en-GB"), { hour: "2-digit", minute: "2-digit" });
}
function patientName(p, lang) { return loc(p?.name, lang); }

function calcAge(dob) {
  if (!dob) return null;
  const d = new Date(dob), now = new Date();
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

function PatientAvatar({ patient, lang = "uk", size = 36 }) {
  const name = patientName(patient, lang) || patient?.mrn || "";
  return (
    <div className="pavatar" style={{
      width: size, height: size,
      background: patient?.accent || "#0a8a7a",
      fontSize: size * 0.36,
    }}>
      {patient?.initials || autoInitials(name)}
    </div>
  );
}

function getGroupKey(iso) {
  const diffDays = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (diffDays < 1) return "today";
  if (diffDays < 7) return "week";
  if (diffDays < 31) return "month";
  return String(new Date(iso).getFullYear());
}

function groupLabel(key, lang) {
  if (key === "today") return tr(lang, "Сьогодні", "Today");
  if (key === "week")  return tr(lang, "Цей тиждень", "This week");
  if (key === "month") return tr(lang, "Цей місяць", "This month");
  return key; // year
}

// ─── DsarModal ────────────────────────────────────────────────────────────────

export function DsarModal({ lang, patientName: pName, onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setBusy(true); setError(null);
    try { await onSubmit({ reason }); }
    catch (e) { setError(e); setBusy(false); }
  };

  return (
    <Modal onClose={onClose}>
      <div className="modal-h">
        <h2>{tr(lang, "Запит DSAR", "DSAR Request")}</h2>
        <p>{lang === "uk" ? `Запит на доступ до даних: ${pName}` : `Data subject access request: ${pName}`}</p>
      </div>
      <div className="dsar-modal-body">
        <div className="dsar-info">
          {lang === "uk" ? (
            <>
              <p style={{ margin: 0 }}>Пакет експорту міститиме:</p>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                <li>дані картки пацієнта та анамнез;</li>
                <li>записи про згоди (включно з відкликаними);</li>
                <li>прийоми;</li>
                <li>звіти з історією версій і транскрипти;</li>
                <li>метадані аудіозаписів (сире аудіо — згідно з налаштуваннями клініки).</li>
              </ul>
              <p style={{ margin: "6px 0 0" }}>Не включається: службові журнали (зберігаються у знеособленій формі). Відповідь суб'єкту даних надається протягом 30 днів.</p>
            </>
          ) : (
            <>
              <p style={{ margin: 0 }}>The export package will contain:</p>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                <li>the patient record and anamnesis;</li>
                <li>consent records (incl. withdrawn);</li>
                <li>encounters;</li>
                <li>reports with version history and transcripts;</li>
                <li>recording metadata (raw audio per clinic configuration).</li>
              </ul>
              <p style={{ margin: "6px 0 0" }}>Not included: service logs (kept in de-identified form). The data subject must receive a response within 30 days.</p>
            </>
          )}
        </div>
        <label>
          {tr(lang, "Причина запиту (необов'язково)", "Reason for request (optional)")}
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={tr(lang, "Напишіть причину…", "Enter reason…")}
            rows={3}
          />
        </label>
        {error && <div style={{ color: "var(--rec,#dc2626)", fontSize: 13 }}>{error.message || (tr(lang, "Помилка", "Error"))}</div>}
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>{tr(lang, "Скасувати", "Cancel")}</button>
        <button className="btn accent" disabled={busy} onClick={submit}>
          <Icon name="download" size={13} />
          {busy ? (tr(lang, "Надсилання…", "Submitting…")) : (tr(lang, "Надіслати запит", "Submit request"))}
        </button>
      </div>
    </Modal>
  );
}

// ─── WithdrawConsentDialog (S11 step 05) ──────────────────────────────────────
// Deliberately weightier than capture (consequences spelled out) but not
// obstructive: one confirmation, no typing. Legal copy flagged in todo.md.

function WithdrawConsentDialog({ lang, consent, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const confirm = async () => {
    setBusy(true); setError(null);
    try { await onConfirm(consent); }
    catch (e) { setError(e); setBusy(false); }
  };
  return (
    <Modal onClose={onClose}>
      <div className="modal-h">
        <h2>{tr(lang, "Відкликати згоду?", "Withdraw this consent?")}</h2>
        <p>{tr(lang, "Дія набуває чинності одразу", "Takes effect immediately")}</p>
      </div>
      <div className="modal-body">
        <div className="consent-withdraw-consequences">
          {tr(lang, "Нові записи для цього пацієнта буде заблоковано до нової згоди; вже створені записи та звіти зберігаються. Відкликання не скасовує обробку, здійснену до цього моменту.", "New recordings for this patient will be blocked until a new consent is captured; recordings and reports already created are retained. Withdrawal does not undo processing that already happened.")}
        </div>
        {error && <div className="consent-sign-error" role="alert">{error.message || (tr(lang, "Помилка", "Error"))}</div>}
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>{tr(lang, "Скасувати", "Cancel")}</button>
        <button className="btn" style={{ color: "var(--rec)", borderColor: "var(--rec)" }} disabled={busy} onClick={confirm}>
          {busy ? (tr(lang, "Відкликання…", "Withdrawing…")) : (tr(lang, "Відкликати згоду", "Withdraw consent"))}
        </button>
      </div>
    </Modal>
  );
}

// ─── StartEncounterSheet (S11 step 04) ────────────────────────────────────────
// The golden path: Почати прийом → encounter created `in_progress` (datetime
// omitted → now) → straight into the dictation studio with the patient +
// encounter context. Retro-logging lives in EncounterModal, never here.

export function StartEncounterSheet({ lang, onClose, onStart }) {
  const [kind, setKind] = useState("visit");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const kindOptions = [
    { value: "visit",    uk: "Візит",                  en: "Visit" },
    { value: "followup", uk: "Повторний прийом",       en: "Follow-up" },
    { value: "phone",    uk: "Телефонна консультація", en: "Phone consultation" },
    { value: "video",    uk: "Відеоконсультація",      en: "Video consultation" },
    { value: "other",    uk: "Інше",                   en: "Other" },
  ];

  const start = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await onStart({ kind, reason: reason.trim() }); }
    catch (e) { setError(e); setBusy(false); }
  };

  return (
    <Modal onClose={onClose}>
      <div className="modal-h">
        <h2>{tr(lang, "Почати прийом", "Start encounter")}</h2>
        <p>{tr(lang, "Прийом розпочнеться зараз; диктування буде звʼязане з ним.", "The encounter starts now; the dictation will be linked to it.")}</p>
      </div>
      <div className="encounter-form">
        <label>
          {tr(lang, "Тип прийому", "Visit kind")}
          <select value={kind} onChange={e => setKind(e.target.value)}>
            {kindOptions.map(o => <option key={o.value} value={o.value}>{o[lang] || o.en}</option>)}
          </select>
        </label>
        <label>
          {tr(lang, "Причина звернення (необовʼязково)", "Reason for visit (optional)")}
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
            placeholder={tr(lang, "Напр., плановий огляд…", "e.g. routine check-up…")} />
        </label>
        {error && <div style={{ color: "var(--rec,#dc2626)", fontSize: 13 }}>{error.message || (tr(lang, "Не вдалося створити прийом", "Could not start the encounter"))}</div>}
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>{tr(lang, "Скасувати", "Cancel")}</button>
        <button className="btn accent" disabled={busy} onClick={start}>
          <Icon name="mic" size={13} />
          {busy ? (tr(lang, "Створення…", "Starting…")) : (tr(lang, "Почати диктування", "Start dictating"))}
        </button>
      </div>
    </Modal>
  );
}

// ─── EncounterModal ───────────────────────────────────────────────────────────
// Retro-logging ("Додати прийом без диктування"): a paper visit backfilled
// with an explicit datetime, created directly as `completed`. Never routes
// into the studio.

export function EncounterModal({ lang, onClose, onSave }) {
  const [kind, setKind] = useState("visit");
  const [datetime, setDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // The as-built EncounterKind enum — anything else 422s (extra="forbid"
  // service; the old free-form values like "follow-up" never saved).
  const kindOptions = [
    { value: "visit",    uk: "Візит",                  en: "Visit" },
    { value: "followup", uk: "Повторний прийом",       en: "Follow-up" },
    { value: "phone",    uk: "Телефонна консультація", en: "Phone consultation" },
    { value: "video",    uk: "Відеоконсультація",      en: "Video consultation" },
    { value: "other",    uk: "Інше",                   en: "Other" },
  ];

  const save = async () => {
    setBusy(true); setError(null);
    // Retro-logged visits are already over: explicit `completed` (the
    // as-built default, sent explicitly so the intent is on the wire).
    try { await onSave({ kind, datetime, reason, status: "completed" }); }
    catch (e) { setError(e); setBusy(false); }
  };

  return (
    <Modal onClose={onClose}>
      <div className="modal-h">
        <h2>{tr(lang, "Додати прийом (без диктування)", "Log an encounter (no dictation)")}</h2>
        <p>{tr(lang, "Зафіксуйте минулий прийом заднім числом", "Backfill a visit that already happened")}</p>
      </div>
      <div className="encounter-form">
        <label>
          {tr(lang, "Тип прийому", "Visit kind")}
          <select value={kind} onChange={e => setKind(e.target.value)}>
            {kindOptions.map(o => <option key={o.value} value={o.value}>{o[lang] || o.en}</option>)}
          </select>
        </label>
        <label>
          {tr(lang, "Дата та час", "Date & time")}
          <input type="datetime-local" value={datetime} onChange={e => setDatetime(e.target.value)} />
        </label>
        <label>
          {tr(lang, "Причина звернення", "Reason for visit")}
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
            placeholder={tr(lang, "Опишіть причину звернення…", "Describe reason for visit…")} />
        </label>
        {error && <div style={{ color: "var(--rec,#dc2626)", fontSize: 13 }}>{error.message || (tr(lang, "Помилка", "Error"))}</div>}
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>{tr(lang, "Скасувати", "Cancel")}</button>
        <button className="btn accent" disabled={!reason.trim() || busy} onClick={save}>
          <Icon name="check" size={13} />
          {busy ? (tr(lang, "Збереження…", "Saving…")) : (tr(lang, "Зберегти", "Save"))}
        </button>
      </div>
    </Modal>
  );
}

// ─── Anamnesis summary tab ──────────────────────────────────────────────────────

function AnamnesisTab({ data, lang }) {
  // As-built AnamnesisOut is { patient_id, record, updated_at } — callers
  // pass `record`; an empty {} record means "not filled in yet".
  if (!data || !Object.keys(data).length) {
    return <div style={{ padding: 24 }}><Empty icon="user" title={tr(lang, "Анамнез не заповнено", "No anamnesis data")} /></div>;
  }
  const medCount = data.medications?.length || 0;
  const allergyCount = data.allergies?.length || 0;
  const condCount = data.conditions?.length || 0;
  return (
    <div style={{ padding: 24 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "var(--text-1)" }}>
        {tr(lang, "Анамнез", "Anamnesis")}
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: tr(lang, "Препарати", "Medications"), value: medCount },
          { label: tr(lang, "Алергії", "Allergies"), value: allergyCount },
          { label: tr(lang, "Стани", "Conditions"), value: condCount },
        ].map((item, i) => (
          <div key={i} style={{ background: "var(--surface-2)", borderRadius: "var(--radius)", padding: "12px 14px", border: "1px solid var(--line)" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-1)" }}>{item.value}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{item.label}</div>
          </div>
        ))}
      </div>
      {data.chiefComplaint && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
            {tr(lang, "Основна скарга", "Chief complaint")}
          </div>
          <div style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.65 }}>{loc(data.chiefComplaint, lang)}</div>
        </div>
      )}
    </div>
  );
}

// ─── EnhancedScribePatient ────────────────────────────────────────────────────

// In-memory page-state cache (tab / scroll / feed window) so browser-back
// within a session lands where the clinician left off. Deliberately a module
// Map, NEVER storage — hygiene: patient-adjacent state must not persist.
const pageStateCache = new Map();

const TAB_IDS = ["timeline", "encounters", "notes", "reports", "recordings", "anamnesis", "conversations", "consents"];
const FEED_PAGE = 30;

// ?tab= is the ONE allowed query param on this route: a closed enum, never
// free text (deep links stay non-identifying — the id is an opaque UUID).
function initialTabFromHash() {
  const m = (typeof location !== "undefined" ? location.hash : "").match(/[?&]tab=([a-z]+)/);
  return m && TAB_IDS.includes(m[1]) ? m[1] : null;
}

function fmtDur(s) {
  if (s == null) return "";
  const total = Math.round(s);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const CONSENT_METHOD_LABEL = {
  verbal:  { uk: "Вербально", en: "Verbal" },
  digital: { uk: "Цифровий підпис", en: "Digital signature" },
  written: { uk: "Письмово", en: "Written" },
  kiosk:   { uk: "Кіоск", en: "Kiosk" },
};

export function EnhancedScribePatient({ id, navigate, lang }) {
  const patientReq = useAsync(() => getPatient(id), [id]);
  const tlReq      = useAsync(() => getPatientTimeline(id), [id]);
  const encReq     = useAsync(() => listEncounters(id), [id]);
  const conReq     = useAsync(() => listConsents(id), [id]);
  const notesReq   = useAsync(() => listNotes({ patient_id: id }), [id]);
  const anamReq    = useAsync(() => getAnamnesis(id), [id]);

  const claims = useClaims();
  // Privacy surfaces are admin-only in the UI (menu entries role-gated at
  // render); the backend additionally enforces its scopes on every call.
  const isPrivacyAdmin = hasAnyRole(claims, ["tenant_admin", "super_admin"]);
  // S14 — only an administrator WITHOUT clinical standing breaks glass. A
  // clinician already holds report.read, so offering them the button
  // would be a control that does nothing.
  const canBreakGlass = isPrivacyAdmin && !hasClinicalAccess(claims);
  const [accessTarget, setAccessTarget] = useState(null); // timeline report row | null

  const cached = pageStateCache.get(id);
  const [tab, setTab] = useState(() => initialTabFromHash() || cached?.tab || "timeline");
  const [feedLimit, setFeedLimit] = useState(cached?.feedLimit || FEED_PAGE);
  const [dsarOpen, setDsarOpen] = useState(false);
  const [encounterOpen, setEncounterOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [withdrawTarget, setWithdrawTarget] = useState(null);
  const [signTarget, setSignTarget] = useState(null);
  const [groupCollapsed, setGroupCollapsed] = useState({});

  // Save page state on unmount (refs so the cleanup sees current values).
  const stateRef = useRef({ tab, feedLimit });
  stateRef.current = { tab, feedLimit };
  useEffect(() => () => {
    pageStateCache.set(id, { ...stateRef.current, scrollY: window.scrollY });
  }, [id]);
  // Restore scroll once, after the first data lands.
  const restoredRef = useRef(false);
  const feedReady = !tlReq.loading || !encReq.loading;
  useEffect(() => {
    if (restoredRef.current || !feedReady) return;
    restoredRef.current = true;
    if (cached?.scrollY) requestAnimationFrame(() => window.scrollTo(0, cached.scrollY));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedReady]);

  if (patientReq.loading) return <div className="page wide"><Loading lang={lang} /></div>;
  if (patientReq.error)   return <div className="page wide"><ApiErrorView error={patientReq.error} lang={lang} /></div>;
  const patient = patientReq.data;
  if (!patient) return <Empty title={tr(lang, "Пацієнт не знайдений", "Patient not found")} icon="user" />;

  const timeline   = asList(tlReq.data);
  const encounters = asList(encReq.data);
  const consents   = asList(conReq.data);
  const notes      = asList(notesReq.data);
  const anamnesis  = anamReq.data?.record;
  const allergies  = anamnesis?.allergies || [];

  const reportItems    = timeline.filter(t => t.kind === "dictate");
  const scribeItems    = timeline.filter(t => t.kind === "scribe");
  const recordingItems = timeline.filter(t => t.kind === "recording");

  // The SPA-owned merge (src/patients/feed.js — pure, unit-tested). A source
  // that failed or is still loading contributes nothing; its rows appear
  // when it settles. One failing source degrades its tab, never the page.
  const feed = mergeFeed({ timeline, encounters, notes, consents });
  const visibleFeed = feed.slice(0, feedLimit);

  const feedSources = [
    { req: tlReq,    uk: "звіти й записи", en: "reports & recordings" },
    { req: encReq,   uk: "прийоми",        en: "encounters" },
    { req: notesReq, uk: "нотатки",        en: "notes" },
    { req: conReq,   uk: "згоди",          en: "consents" },
  ];
  const failedSources = feedSources.filter(s => s.req.error);
  const allFeedLoading = feedSources.every(s => s.req.loading);

  const groupOrder = [];
  const groups = {};
  visibleFeed.forEach(item => {
    const gk = getGroupKey(item.date || 0);
    if (!groups[gk]) { groups[gk] = []; groupOrder.push(gk); }
    groups[gk].push(item);
  });

  const defaultExpanded = { today: true, week: true };
  const isCollapsed = (gk) => (gk in groupCollapsed) ? groupCollapsed[gk] : !defaultExpanded[gk];
  const toggleGroup = (gk) => setGroupCollapsed(prev => ({ ...prev, [gk]: !isCollapsed(gk) }));

  const tabCounts = {
    timeline: feed.length,
    encounters: encounters.length,
    notes: notes.length,
    reports: reportItems.length,
    recordings: recordingItems.length,
    anamnesis: null,
    conversations: scribeItems.length,
    consents: consents.length,
  };

  const tabDefs = [
    { id: "timeline",      icon: "clock",    uk: "Усе",          en: "All" },
    { id: "encounters",    icon: "calendar", uk: "Прийоми",      en: "Encounters" },
    { id: "reports",       icon: "scan",     uk: "Звіти",        en: "Reports" },
    { id: "recordings",    icon: "audio",    uk: "Записи",       en: "Recordings" },
    { id: "notes",         icon: "fileText", uk: "Нотатки",      en: "Notes" },
    { id: "conversations", icon: "mic",      uk: "Розмови",      en: "Conversations" },
    { id: "consents",      icon: "shield",   uk: "Згоди",        en: "Consents" },
    { id: "anamnesis",     icon: "heart",    uk: "Анамнез",      en: "Anamnesis" },
  ];

  // DSAR: 202 → the request is already executing; progress lives in the
  // admin queue. 409 dsar_already_running → go to the existing request.
  const handleDsar = async ({ reason }) => {
    try {
      await requestDsar(id, { reason });
    } catch (e) {
      if (e?.problem?.code === "dsar_already_running") {
        setDsarOpen(false);
        navigate("/admin/privacy");
        return;
      }
      throw e;
    }
    setDsarOpen(false);
    navigate("/admin/privacy");
  };
  const handleEncounter = async (payload) => {
    await createEncounter(id, payload);
    setEncounterOpen(false);
    encReq.reload(); tlReq.reload();
  };
  const handleWithdraw = async (c) => {
    await withdrawConsent(id, c.id);
    setWithdrawTarget(null);
    conReq.reload();
  };
  // Golden path: create the encounter live (`in_progress`, datetime = now)
  // and route into the studio with BOTH uuids — the WS start message and the
  // recording linkage hang off ?encounter=.
  const handleStartEncounter = async ({ kind, reason }) => {
    const enc = await createEncounter(id, { kind, reason, status: "in_progress" });
    setStartOpen(false);
    navigate(`/dictate/studio?patient=${id}&encounter=${enc.id}`);
  };
  const handleEditSave = async (body) => {
    await updatePatient(id, body);
    setEditOpen(false);
    patientReq.reload();
  };

  const deceased = patient.status === "deceased";

  function renderFeedItem(item) {
    const typeMap = {
      encounter:    { icon: "calendar", chipClass: "scribe",  label: tr(lang, "Прийом", "Encounter") },
      report:       { icon: "scan",     chipClass: "dictate", label: tr(lang, "Звіт", "Report") },
      recording:    { icon: "audio",    chipClass: "scribe",  label: tr(lang, "Запис", "Recording") },
      note:         { icon: "fileText", chipClass: "",        label: tr(lang, "Нотатка", "Note") },
      conversation: { icon: "mic",      chipClass: "scribe",  label: tr(lang, "Розмова", "Conversation") },
      consent:      { icon: "shield",   chipClass: "",        label: tr(lang, "Згода", "Consent") },
    };
    const t = typeMap[item.type];

    // Deep links: every artifact opens its existing screen; encounter /
    // recording / consent context lives in this page's own tabs (recordings
    // carry metadata only — there is deliberately no media URL to open).
    const links = {
      conversation: () => navigate(`/scribe/consult/${item.id}`),
      report:       () => navigate(`/dictate/reports/${item.id}`),
      note:         () => navigate(`/scribe/notes/${item.id}`),
      consent:      () => setTab("consents"),
      recording:    () => setTab("recordings"),
      encounter:    () => setTab("encounters"),
    };

    const displayTitle =
      item.type === "recording" ? `${t.label}${item.duration_s != null ? ` · ${fmtDur(item.duration_s)}` : ""}`
      : item.type === "consent" ? consentLine(item.raw, lang)
      : loc(item.title, lang) || `${t.label} — ${fmtDate(item.date, lang)}`;
    const statusLabel = item.status
      ? ({ live: tr(lang, "наживо", "live"), draft: tr(lang, "чернетка", "draft"),
           signed: tr(lang, "підписано", "signed"), granted: tr(lang, "надано", "granted"),
           withdrawn: tr(lang, "відкликано", "withdrawn"),
           completed: tr(lang, "завершено", "completed"),
           in_progress: tr(lang, "триває", "in progress"),
           scheduled: tr(lang, "заплановано", "scheduled"),
           cancelled: tr(lang, "скасовано", "cancelled") })[item.status] || item.status
      : null;

    return (
      <div key={item.key} className={`tl-row tl-type-${item.type}`} onClick={links[item.type]}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", cursor: "pointer", borderBottom: "1px solid var(--line-2)" }}>
        <div className={`tl-dot tl-type-${item.type}`}><Icon name={t.icon} size={12} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {t.chipClass && <span className={`chip ${t.chipClass}`}>{t.label}</span>}
            <strong style={{ fontSize: 13.5, color: "var(--text-1)" }}>{displayTitle}</strong>
            {statusLabel && (
              <span className={`chip ${item.status === "live" ? "live" : ["signed", "granted", "completed"].includes(item.status) ? "signed" : ["draft", "in_progress"].includes(item.status) ? "draft" : ""}`}>
                {statusLabel}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            {item.by && <>{item.by} · </>}
            {fmtDate(item.date, lang)}{item.date ? `, ${fmtTime(item.date, lang)}` : ""}
          </div>
        </div>
        <Icon name="chevRight" size={14} />
      </div>
    );
  }

  const listShell = (children) => (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden" }}>{children}</div>
  );

  return (
    <div className="page wide">
      {/* Profile header — full identity is appropriate on the record itself */}
      <div className="ph-card">
        <PatientAvatar patient={patient} lang={lang} size={56} />
        <div className="ph-meta">
          <div className="ph-name">
            {patientName(patient, lang)}
            <span className="chip">{(calcAge(patient.dob)) ?? "—"} {tr(lang, "р.", "y")} · {patient.sex}</span>
            {patient.status === "inactive" && <span className="pdir-badge inactive">{tr(lang, "архів", "archived")}</span>}
            {deceased && <span className="pdir-badge deceased">{tr(lang, "помер(ла)", "deceased")}</span>}
            {patient.has_ipn && (
              <span className="pdir-ipn-chip" title={tr(lang, "ІПН збережено (номер не відображається)", "ІПН on file (number never shown)")}>
                <Icon name="shield" size={11} /> ІПН
              </span>
            )}
            {allergies.length > 0 && (
              <span className="allergy-chip">
                <Icon name="flag" size={11} />
                {lang === "uk" ? `${allergies.length} алергія` : `${allergies.length} allerg${allergies.length === 1 ? "y" : "ies"}`}
              </span>
            )}
          </div>
          <div className="ph-sub">
            <span className="pmono">{patient.mrn}</span>
            {patient.dob && <><span>·</span><span>{tr(lang, "Народж.", "DOB")}: {patient.dob}</span></>}
            {patient.summary && loc(patient.summary, lang) && <><span>·</span><span>{loc(patient.summary, lang)}</span></>}
          </div>
          <div className="ph-tags">
            {(patient.tags || []).map((t, i) => <span key={i} className="chip">{t}</span>)}
          </div>
        </div>
        <div className="ph-actions">
          <button className="btn ghost sm" onClick={() => setEditOpen(true)}>
            <Icon name="edit" size={13} /> {tr(lang, "Редагувати", "Edit")}
          </button>
          {isPrivacyAdmin && (
            <>
              <button className="btn ghost sm" onClick={() => setDsarOpen(true)}>
                <Icon name="download" size={13} /> {tr(lang, "Експорт даних (DSAR)", "Data export (DSAR)")}
              </button>
              <button className="btn ghost sm" onClick={() => navigate(`/patients/${id}/erasure-request`)}>
                <Icon name="flag" size={13} /> {tr(lang, "Запит на видалення", "Request erasure")}
              </button>
            </>
          )}
          <button className="btn ghost sm" disabled={deceased}
            title={deceased ? (tr(lang, "Пацієнт позначений як померлий", "Patient is marked deceased")) : undefined}
            onClick={() => navigate(`/dictate/studio?patient=${id}`)}>
            <Icon name="fileText" size={13} /> {tr(lang, "Диктувати звіт", "Dictate report")}
          </button>
          <button className="btn accent" disabled={deceased}
            title={deceased ? (tr(lang, "Пацієнт позначений як померлий", "Patient is marked deceased")) : undefined}
            onClick={() => setStartOpen(true)}>
            <Icon name="mic" size={13} /> {tr(lang, "Почати прийом", "Start encounter")}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {tabDefs.map(x => (
          <button key={x.id} className={`tab ${tab === x.id ? "on" : ""}`} onClick={() => setTab(x.id)}>
            <Icon name={x.icon} size={14} />
            {x[lang] || x.en}
            {tabCounts[x.id] != null && tabCounts[x.id] > 0 && <span className="tab-badge">{tabCounts[x.id]}</span>}
          </button>
        ))}
      </div>

      {/* Merged feed ("Усе") */}
      {tab === "timeline" && (
        <div style={{ marginTop: 16 }}>
          {failedSources.length > 0 && (
            <div className="tl-source-warn" role="alert">
              <Icon name="flag" size={13} />
              {lang === "uk"
                ? `Не вдалося завантажити: ${failedSources.map(s => s.uk).join(", ")} — решта стрічки актуальна.`
                : `Failed to load: ${failedSources.map(s => s.en).join(", ")} — the rest of the feed is current.`}
            </div>
          )}
          {allFeedLoading && <Loading lang={lang} />}
          {!allFeedLoading && feed.length === 0 && failedSources.length === 0 && (
            <Empty icon="clock" title={tr(lang, "Немає записів", "No history yet")} />
          )}
          {groupOrder.map(gk => (
            <div key={gk} className="tl-group">
              <div className={`tl-group-header ${isCollapsed(gk) ? "collapsed" : ""}`} onClick={() => toggleGroup(gk)}>
                <span>{groupLabel(gk, lang)}</span>
                <span style={{ color: "var(--text-2)", fontWeight: 400, fontSize: 12, textTransform: "none", letterSpacing: 0 }}>
                  {groups[gk].length} {tr(lang, "записів", "records")}
                </span>
                <Icon name="chevDown" size={13} className="tl-group-chevron" style={{ marginLeft: "auto", transform: isCollapsed(gk) ? "rotate(-90deg)" : undefined }} />
              </div>
              <div className={`tl-group-body ${isCollapsed(gk) ? "collapsed" : ""}`}>
                {groups[gk].map(item => renderFeedItem(item))}
              </div>
            </div>
          ))}
          {feed.length > feedLimit && (
            <div className="pdir-more">
              <button type="button" className="btn" onClick={() => setFeedLimit(l => l + FEED_PAGE)}>
                {tr(lang, "Показати ще", "Show more")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Encounters tab */}
      {tab === "encounters" && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button className="btn accent sm" onClick={() => setStartOpen(true)} disabled={deceased}>
              <Icon name="mic" size={13} /> {tr(lang, "Почати прийом", "Start encounter")}
            </button>
            <button className="btn sm" onClick={() => setEncounterOpen(true)}>
              <Icon name="plus" size={13} /> {tr(lang, "Додати без диктування", "Log without dictation")}
            </button>
          </div>
          {encReq.error ? <ApiErrorView error={encReq.error} lang={lang} />
            : encReq.loading ? <Loading lang={lang} />
            : encounters.length === 0 ? (
              <Empty icon="calendar" title={tr(lang, "Ще немає прийомів", "No encounters yet")}
                body={tr(lang, "Почніть перший прийом кнопкою вище", "Start the first one with the button above")} />
            ) : listShell(
              encounters.map((e, i, arr) => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < arr.length - 1 ? "1px solid var(--line-2)" : "none" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name="calendar" size={13} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-1)" }}>
                      {e.reason || (tr(lang, "Без причини", "No reason recorded"))}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {e.kind} · {fmtDate(e.occurred_at, lang)}, {fmtTime(e.occurred_at, lang)}
                    </div>
                  </div>
                  <span className={`chip ${e.status === "completed" ? "signed" : e.status === "in_progress" ? "live" : "draft"}`}>
                    {({ completed: tr(lang, "завершено", "completed"), in_progress: tr(lang, "триває", "in progress"),
                        scheduled: tr(lang, "заплановано", "scheduled"), cancelled: tr(lang, "скасовано", "cancelled") })[e.status] || e.status}
                  </span>
                </div>
              ))
            )}
        </div>
      )}

      {/* Notes tab */}
      {tab === "notes" && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button className="btn accent sm" onClick={() => navigate(`/scribe/notes/new?patient=${id}`)}>
              <Icon name="plus" size={13} /> {tr(lang, "Нова нотатка", "New note")}
            </button>
          </div>
          {notesReq.error ? <ApiErrorView error={notesReq.error} lang={lang} />
            : notesReq.loading ? <Loading lang={lang} />
            : notes.length === 0 ? (
              <Empty icon="fileText" title={tr(lang, "Нотаток немає", "No notes yet")} />
            ) : listShell(
              notes.map((n, i) => (
                <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < notes.length - 1 ? "1px solid var(--line-2)" : "none", cursor: "pointer" }}
                  onClick={() => navigate(`/scribe/notes/${n.id}`)}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name="fileText" size={13} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-1)" }}>{loc(n.title, lang)}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{n.structure} · {fmtDate(n.created_at, lang)}</div>
                  </div>
                  <span className={`chip ${n.status === "signed" ? "signed" : n.status === "draft" ? "draft" : ""}`}>
                    {n.status === "signed" ? (tr(lang, "підписано", "signed")) : n.status === "draft" ? (tr(lang, "чернетка", "draft")) : n.status}
                  </span>
                  <Icon name="chevRight" size={14} />
                </div>
              ))
            )}
        </div>
      )}

      {/* Reports tab */}
      {tab === "reports" && (
        <div style={{ marginTop: 16 }}>
          {tlReq.error ? <ApiErrorView error={tlReq.error} lang={lang} />
            : tlReq.loading ? <Loading lang={lang} />
            : reportItems.length === 0 ? (
              <Empty icon="scan" title={tr(lang, "Звітів немає", "No reports yet")} />
            ) : listShell(
              reportItems.map((rep, i, arr) => (
                <div key={rep.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < arr.length - 1 ? "1px solid var(--line-2)" : "none", cursor: "pointer" }}
                  onClick={() => navigate(`/dictate/reports/${rep.id}`)}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--dictate-soft,#ecebfb)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--dictate,#4338ca)" }}>
                    <Icon name="scan" size={13} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-1)" }}>{loc(rep.title, lang)}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{rep.by} · {fmtDate(rep.date, lang)}</div>
                  </div>
                  <span className={`chip ${rep.status === "signed" ? "signed" : "draft"}`}>
                    {rep.status === "signed" ? (tr(lang, "підписано", "signed")) : (tr(lang, "чернетка", "draft"))}
                  </span>
                  {/* S14 — the timeline is metadata only (title, author,
                      date), which is why an administrator can still see it
                      and use it to find the ONE report they need. Opening
                      it is what requires a grant, so the ask lives here. */}
                  {canBreakGlass && (
                    <button
                      className="btn"
                      title={tr(lang, "Запитати тимчасовий доступ до цього звіту", "Request temporary access to this report")}
                      onClick={(e) => { e.stopPropagation(); setAccessTarget(rep); }}
                    >
                      <Icon name="shield" size={12} />
                      {tr(lang, "Запит доступу", "Request access")}
                    </button>
                  )}
                  <Icon name="chevRight" size={14} />
                </div>
              ))
            )}
        </div>
      )}

      {/* Recordings tab — metadata only; the backend deliberately exposes no
          media URL here (audio access stays on the ASR surface) */}
      {tab === "recordings" && (
        <div style={{ marginTop: 16 }}>
          {tlReq.error ? <ApiErrorView error={tlReq.error} lang={lang} />
            : tlReq.loading ? <Loading lang={lang} />
            : recordingItems.length === 0 ? (
              <Empty icon="audio" title={tr(lang, "Записів немає", "No recordings yet")}
                body={tr(lang, "Записи з'являються після прийомів із диктуванням", "Recordings appear after encounters with dictation")} />
            ) : listShell(
              recordingItems.map((rec, i, arr) => (
                <div key={rec.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < arr.length - 1 ? "1px solid var(--line-2)" : "none" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--scribe-soft,#e6f4f1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--scribe,#0a8a7a)" }}>
                    <Icon name="audio" size={13} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-1)" }}>
                      {tr(lang, "Запис", "Recording")}{rec.duration_s != null ? ` · ${fmtDur(rec.duration_s)}` : ""}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {fmtDate(rec.date, lang)}, {fmtTime(rec.date, lang)}
                      {rec.encounter_id && (
                        <> · <button className="tl-enc-link" onClick={() => setTab("encounters")}>
                          {tr(lang, "до прийому", "view encounter")}
                        </button></>
                      )}
                    </div>
                  </div>
                  {rec.status && <span className="chip">{rec.status}</span>}
                </div>
              ))
            )}
        </div>
      )}

      {/* Anamnesis tab */}
      {tab === "anamnesis" && (
        <div style={{ marginTop: 16 }}>
          {anamReq.error ? <ApiErrorView error={anamReq.error} lang={lang} />
            : anamReq.loading ? <Loading lang={lang} /> : <AnamnesisTab data={anamnesis} lang={lang} />}
        </div>
      )}

      {/* Conversations tab */}
      {tab === "conversations" && (
        <div style={{ marginTop: 16 }}>
          {tlReq.error ? <ApiErrorView error={tlReq.error} lang={lang} />
            : tlReq.loading ? <Loading lang={lang} />
            : scribeItems.length === 0 ? (
              <Empty icon="mic" title={tr(lang, "Розмов немає", "No conversations yet")} />
            ) : listShell(
              scribeItems.map((conv, i, arr) => (
                <div key={conv.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < arr.length - 1 ? "1px solid var(--line-2)" : "none", cursor: "pointer" }}
                  onClick={() => navigate(`/scribe/consult/${conv.id}`)}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--scribe-soft,#e6f4f1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--scribe,#0a8a7a)" }}>
                    <Icon name="mic" size={13} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-1)" }}>{loc(conv.title, lang)}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{conv.by} · {fmtDate(conv.date, lang)}</div>
                  </div>
                  <span className={`chip ${conv.status === "live" ? "live" : conv.status === "signed" ? "signed" : "draft"}`}>
                    {conv.status === "live" ? (tr(lang, "наживо", "live")) : conv.status === "signed" ? (tr(lang, "підписано", "signed")) : (tr(lang, "чернетка", "draft"))}
                  </span>
                  <Icon name="chevRight" size={14} />
                </div>
              ))
            )}
        </div>
      )}

      {/* Consents tab */}
      {tab === "consents" && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button className="btn accent sm" onClick={() => navigate(`/scribe/consent/new?patient=${id}`)}>
              <Icon name="plus" size={13} /> {tr(lang, "Запит згоди", "Request consent")}
            </button>
          </div>
          {conReq.error ? <ApiErrorView error={conReq.error} lang={lang} />
            : conReq.loading ? <Loading lang={lang} />
            : consents.length === 0 ? (
              <Empty icon="shield" title={tr(lang, "Записів про згоду немає", "No consent records")} />
            ) : listShell(
              consents.map((c) => (
                <div key={c.id} className={"consent-row" + (c.status === "withdrawn" ? " withdrawn" : "")}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name="shield" size={13} />
                  </div>
                  <div className="cr-meta">
                    <div className="cr-type">
                      {consentLine(c, lang)}
                      {c.signed_envelope_id && (
                        <span className="chip signed" title={`envelope ${c.signed_envelope_id}`}>
                          <Icon name="sign" size={11} /> {tr(lang, "КЕП", "Signed")}
                        </span>
                      )}
                      {c.method === "digital" && !c.signed_envelope_id && (
                        <span className="chip draft">{tr(lang, "не підписано", "unsigned")}</span>
                      )}
                    </div>
                    <div className="cr-detail">
                      {fmtDate(c.granted_at, lang)}
                      {c.status === "withdrawn" && c.withdrawn_at && (
                        <> · {tr(lang, "відкликано", "withdrawn")} {fmtDate(c.withdrawn_at, lang)}</>
                      )}
                    </div>
                  </div>
                  <span className={`status-badge ${c.status}`}>
                    {({ granted: tr(lang, "Надано", "Granted"), declined: tr(lang, "Відхилено", "Declined"), withdrawn: tr(lang, "Відкликано", "Withdrawn") })[c.status] || c.status}
                  </span>
                  {c.method === "digital" && !c.signed_envelope_id && c.status === "granted" && (
                    <button className="btn ghost sm" style={{ fontSize: 12 }} onClick={() => setSignTarget(c)}>
                      {tr(lang, "Підписати", "Sign")}
                    </button>
                  )}
                  {c.status === "granted" && (
                    <button className="btn ghost sm" style={{ fontSize: 12 }} onClick={() => setWithdrawTarget(c)}>
                      {tr(lang, "Відкликати", "Withdraw")}
                    </button>
                  )}
                </div>
              ))
            )}
        </div>
      )}

      {/* Modals */}
      {editOpen && (
        <PatientFormModal lang={lang} patient={patient} onClose={() => setEditOpen(false)}
          onSave={handleEditSave} onOpenExisting={(pid) => { setEditOpen(false); navigate(`/scribe/patients/${pid}`); }} />
      )}
      {accessTarget && (
        <RequestAccessModal
          lang={lang}
          reportId={accessTarget.id}
          reportCode={loc(accessTarget.title, lang)}
          patientLabel={patientName(patient, lang)}
          onClose={() => setAccessTarget(null)}
          onGranted={() => {
            const reportId = accessTarget.id;
            setAccessTarget(null);
            // The grant exists now — take them straight to the thing they
            // justified reading, rather than back to a list.
            navigate(`/dictate/reports/${reportId}`);
          }}
        />
      )}
      {dsarOpen && (
        <DsarModal lang={lang} patientName={patientName(patient, lang)} onClose={() => setDsarOpen(false)} onSubmit={handleDsar} />
      )}
      {encounterOpen && (
        <EncounterModal lang={lang} onClose={() => setEncounterOpen(false)} onSave={handleEncounter} />
      )}
      {startOpen && (
        <StartEncounterSheet lang={lang} onClose={() => setStartOpen(false)} onStart={handleStartEncounter} />
      )}
      {withdrawTarget && (
        <WithdrawConsentDialog lang={lang} consent={withdrawTarget}
          onClose={() => setWithdrawTarget(null)} onConfirm={handleWithdraw} />
      )}
      {signTarget && (
        <ConsentSignDialog lang={lang} patientId={id} consent={signTarget}
          onClose={() => { setSignTarget(null); conReq.reload(); }}
          onSigned={() => conReq.reload()} />
      )}
    </div>
  );
}

// One consistent "type · method · version" line for consent rows everywhere.
function consentLine(c, lang) {
  const type = c.type === "ai_scribe" ? (tr(lang, "AI-скрайб", "AI Scribe"))
    : c.type === "data_processing" ? (tr(lang, "Обробка даних", "Data processing"))
    : c.type;
  const method = (CONSENT_METHOD_LABEL[c.method] || {})[lang] || c.method;
  return `${type} · ${method}${c.version ? ` · v${c.version}` : ""}`;
}
