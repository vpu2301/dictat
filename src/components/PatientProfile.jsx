// PatientProfile.jsx — Sprint 11: Enhanced patient profile (live data)
import React, { useState } from 'react';
import { Icon, Modal, Empty } from './UI.jsx';
import { Loading, asList } from './DataStates.jsx';
import { ApiErrorView } from './ApiErrorView.jsx';
import { useAsync } from '../api/useAsync.js';
import { getPatient, getPatientTimeline } from '../api/patients.js';
import { listEncounters, createEncounter } from '../api/encounters.js';
import { listConsents, withdrawConsent } from '../api/consents.js';
import { listNotes } from '../api/notes.js';
import { getAnamnesis } from '../api/anamnesis.js';
import { requestDsar, scheduleErasure } from '../api/privacy.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loc(v, lang) {
  if (v == null) return "";
  if (typeof v === "object") return v[lang] ?? v.en ?? Object.values(v)[0] ?? "";
  return v;
}
function fmtDate(iso, lang) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(lang === "uk" ? "uk-UA" : "en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtTime(iso, lang) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(lang === "uk" ? "uk-UA" : "en-GB", { hour: "2-digit", minute: "2-digit" });
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
  if (key === "today") return lang === "uk" ? "Сьогодні" : "Today";
  if (key === "week")  return lang === "uk" ? "Цей тиждень" : "This week";
  if (key === "month") return lang === "uk" ? "Цей місяць" : "This month";
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
        <h2>{lang === "uk" ? "Запит DSAR" : "DSAR Request"}</h2>
        <p>{lang === "uk" ? `Запит на доступ до даних: ${pName}` : `Data subject access request: ${pName}`}</p>
      </div>
      <div className="dsar-modal-body">
        <div className="dsar-info">
          {lang === "uk"
            ? "Відповідно до GDPR та Закону України про захист персональних даних, суб'єкт даних має право запросити копію всіх персональних даних, які обробляє установа. Відповідь надається протягом 30 днів."
            : "Under GDPR, the data subject has the right to request a copy of all personal data held by this organisation. A response must be provided within 30 days."}
        </div>
        <label>
          {lang === "uk" ? "Причина запиту (необов'язково)" : "Reason for request (optional)"}
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={lang === "uk" ? "Напишіть причину…" : "Enter reason…"}
            rows={3}
          />
        </label>
        {error && <div style={{ color: "var(--rec,#dc2626)", fontSize: 13 }}>{error.message || (lang === "uk" ? "Помилка" : "Error")}</div>}
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>{lang === "uk" ? "Скасувати" : "Cancel"}</button>
        <button className="btn accent" disabled={busy} onClick={submit}>
          <Icon name="download" size={13} />
          {busy ? (lang === "uk" ? "Надсилання…" : "Submitting…") : (lang === "uk" ? "Надіслати запит" : "Submit request")}
        </button>
      </div>
    </Modal>
  );
}

// ─── EraseModal ───────────────────────────────────────────────────────────────

export function EraseModal({ lang, patientName: pName, onClose, onConfirm }) {
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [scheduled, setScheduled] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const reasonValid = reason.trim().length >= 50 && reason.trim().length <= 500;
  const confirmValid = confirmText.trim().toLowerCase() === "erase";
  const done = !!scheduled;

  const erasureLabel = scheduled?.scheduled_at
    ? new Date(scheduled.scheduled_at).toLocaleString(lang === "uk" ? "uk-UA" : "en-GB", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  const confirm = async () => {
    setBusy(true); setError(null);
    try { const r = await onConfirm({ reason }); setScheduled(r || {}); }
    catch (e) { setError(e); }
    finally { setBusy(false); }
  };

  const stepLabels = lang === "uk" ? ["Попередження", "Причина", "Підтвердження"] : ["Warning", "Reason", "Confirm"];

  return (
    <Modal onClose={onClose}>
      <div className="modal-h">
        <h2 style={{ color: "var(--rec)" }}>{lang === "uk" ? "Запланувати видалення" : "Schedule erasure"}</h2>
        <p>{pName}</p>
      </div>

      {!done && (
        <div style={{ padding: "12px 24px 0" }}>
          <div className="erase-step">
            {[1, 2, 3].map((n, i) => (
              <React.Fragment key={n}>
                <div className={`erase-step-dot ${step > n ? "done" : step === n ? "active" : ""}`}>
                  {step > n ? <Icon name="check" size={12} /> : n}
                </div>
                {i < 2 && <div className="erase-step-line" />}
              </React.Fragment>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            {stepLabels.map((l, i) => <span key={i}>{l}</span>)}
          </div>
        </div>
      )}

      <div className="erase-modal-body">
        {done && (
          <div className="erase-success">
            <div className="erase-success-icon"><Icon name="check" size={24} /></div>
            <div style={{ fontWeight: 600, fontSize: 16, color: "var(--text-1)", marginBottom: 8 }}>
              {lang === "uk" ? "Видалення заплановано" : "Erasure scheduled"}
            </div>
            <div style={{ fontSize: 13.5, color: "var(--text-2)", marginBottom: 16 }}>
              {lang === "uk"
                ? `Дані пацієнта ${pName} будуть безповоротно видалені${erasureLabel ? " о:" : "."}`
                : `Patient data for ${pName} will be permanently erased${erasureLabel ? " at:" : "."}`}
            </div>
            {erasureLabel && (
              <div style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--text-1)", fontWeight: 600 }}>{erasureLabel}</div>
            )}
            {scheduled?.cancel_until && (
              <div className="countdown-banner">
                <Icon name="clock" size={14} />
                {lang === "uk"
                  ? `Скасувати можна до ${new Date(scheduled.cancel_until).toLocaleString("uk-UA")}.`
                  : `You can cancel until ${new Date(scheduled.cancel_until).toLocaleString("en-GB")}.`}
              </div>
            )}
          </div>
        )}

        {!done && step === 1 && (
          <div className="erase-warn">
            <div className="erase-warn-icon"><Icon name="flag" size={18} /></div>
            <div className="erase-warn-text">
              {lang === "uk"
                ? <><strong>Ця дія незворотна.</strong> Видалення даних пацієнта <strong>{pName}</strong> призведе до:
                    <ul style={{ margin: "8px 0 0 0", paddingLeft: 18 }}>
                      <li>Видалення всіх медичних записів, нотаток і транскриптів</li>
                      <li>Анонімізації всіх аудит-логів</li>
                      <li>Неможливості відновлення даних</li>
                    </ul></>
                : <><strong>This action is irreversible.</strong> Erasing data for <strong>{pName}</strong> will:
                    <ul style={{ margin: "8px 0 0 0", paddingLeft: 18 }}>
                      <li>Delete all medical records, notes and transcripts</li>
                      <li>Anonymise all audit logs</li>
                      <li>Make data unrecoverable</li>
                    </ul></>}
            </div>
          </div>
        )}

        {!done && step === 2 && (
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "var(--text-2)" }}>
            {lang === "uk" ? `Вкажіть причину видалення (50–500 символів)` : `Provide reason for erasure (50–500 characters)`}
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={5}
              placeholder={lang === "uk" ? "Детально поясніть підставу для видалення…" : "Provide detailed justification for erasure…"}
              style={{ padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "var(--radius)", fontFamily: "var(--sans)", fontSize: 13, resize: "vertical", background: "var(--surface)", color: "var(--text-1)" }} />
            <span style={{ fontSize: 11, color: reason.trim().length < 50 || reason.trim().length > 500 ? "var(--rec)" : "var(--ok,#047857)" }}>
              {reason.trim().length} / 500
            </span>
          </label>
        )}

        {!done && step === 3 && (
          <div>
            <div style={{ fontSize: 13.5, color: "var(--text-2)", marginBottom: 14 }}>
              {lang === "uk" ? `Для підтвердження введіть слово ERASE нижче:` : `To confirm, type ERASE below:`}
            </div>
            <input className="erase-confirm-input" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="ERASE" autoFocus />
            {error && <div style={{ marginTop: 10, fontSize: 12, color: "var(--rec,#dc2626)", textAlign: "center" }}>{error.message || (lang === "uk" ? "Помилка" : "Error")}</div>}
          </div>
        )}
      </div>

      <div className="modal-foot">
        {done ? (
          <button className="btn accent" onClick={onClose}>{lang === "uk" ? "Закрити" : "Close"}</button>
        ) : (
          <>
            <button className="btn" onClick={step === 1 ? onClose : () => setStep(s => s - 1)}>
              {step === 1 ? (lang === "uk" ? "Скасувати" : "Cancel") : (lang === "uk" ? "Назад" : "Back")}
            </button>
            {step < 3 && (
              <button className="btn" style={{ color: "var(--rec)", borderColor: "var(--rec)" }}
                disabled={step === 2 && !reasonValid} onClick={() => setStep(s => s + 1)}>
                {lang === "uk" ? "Далі" : "Next"}
              </button>
            )}
            {step === 3 && (
              <button className="btn" style={{ background: "var(--rec)", color: "white", borderColor: "var(--rec)" }}
                disabled={!confirmValid || busy} onClick={confirm}>
                <Icon name="flag" size={13} />
                {busy ? (lang === "uk" ? "Планування…" : "Scheduling…") : (lang === "uk" ? "Запланувати видалення" : "Schedule erasure")}
              </button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

// ─── EncounterModal ───────────────────────────────────────────────────────────

export function EncounterModal({ lang, onClose, onSave }) {
  const [kind, setKind] = useState("follow-up");
  const [datetime, setDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const kindOptions = [
    { value: "follow-up", uk: "Повторний прийом", en: "Follow-up" },
    { value: "initial",   uk: "Первинний прийом", en: "Initial visit" },
    { value: "urgent",    uk: "Невідкладний прийом", en: "Urgent" },
    { value: "procedure", uk: "Процедура", en: "Procedure" },
    { value: "phone",     uk: "Телефонна консультація", en: "Phone consultation" },
  ];

  const save = async () => {
    setBusy(true); setError(null);
    try { await onSave({ kind, datetime, reason }); }
    catch (e) { setError(e); setBusy(false); }
  };

  return (
    <Modal onClose={onClose}>
      <div className="modal-h">
        <h2>{lang === "uk" ? "Новий прийом" : "New encounter"}</h2>
        <p>{lang === "uk" ? "Зафіксуйте деталі прийому" : "Record encounter details"}</p>
      </div>
      <div className="encounter-form">
        <label>
          {lang === "uk" ? "Тип прийому" : "Visit kind"}
          <select value={kind} onChange={e => setKind(e.target.value)}>
            {kindOptions.map(o => <option key={o.value} value={o.value}>{o[lang] || o.en}</option>)}
          </select>
        </label>
        <label>
          {lang === "uk" ? "Дата та час" : "Date & time"}
          <input type="datetime-local" value={datetime} onChange={e => setDatetime(e.target.value)} />
        </label>
        <label>
          {lang === "uk" ? "Причина звернення" : "Reason for visit"}
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
            placeholder={lang === "uk" ? "Опишіть причину звернення…" : "Describe reason for visit…"} />
        </label>
        {error && <div style={{ color: "var(--rec,#dc2626)", fontSize: 13 }}>{error.message || (lang === "uk" ? "Помилка" : "Error")}</div>}
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>{lang === "uk" ? "Скасувати" : "Cancel"}</button>
        <button className="btn accent" disabled={!reason.trim() || busy} onClick={save}>
          <Icon name="check" size={13} />
          {busy ? (lang === "uk" ? "Збереження…" : "Saving…") : (lang === "uk" ? "Зберегти" : "Save")}
        </button>
      </div>
    </Modal>
  );
}

// ─── Anamnesis summary tab ──────────────────────────────────────────────────────

function AnamnesisTab({ data, lang }) {
  if (!data) {
    return <div style={{ padding: 24 }}><Empty icon="user" title={lang === "uk" ? "Анамнез не заповнено" : "No anamnesis data"} /></div>;
  }
  const medCount = data.medications?.length || 0;
  const allergyCount = data.allergies?.length || 0;
  const condCount = data.conditions?.length || 0;
  return (
    <div style={{ padding: 24 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "var(--text-1)" }}>
        {lang === "uk" ? "Анамнез" : "Anamnesis"}
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: lang === "uk" ? "Препарати" : "Medications", value: medCount },
          { label: lang === "uk" ? "Алергії" : "Allergies", value: allergyCount },
          { label: lang === "uk" ? "Стани" : "Conditions", value: condCount },
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
            {lang === "uk" ? "Основна скарга" : "Chief complaint"}
          </div>
          <div style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.65 }}>{loc(data.chiefComplaint, lang)}</div>
        </div>
      )}
    </div>
  );
}

// ─── EnhancedScribePatient ────────────────────────────────────────────────────

export function EnhancedScribePatient({ id, navigate, lang }) {
  const patientReq = useAsync(() => getPatient(id), [id]);
  const tlReq      = useAsync(() => getPatientTimeline(id), [id]);
  const encReq     = useAsync(() => listEncounters(id), [id]);
  const conReq     = useAsync(() => listConsents(id), [id]);
  const notesReq   = useAsync(() => listNotes({ patient_id: id }), [id]);
  const anamReq    = useAsync(() => getAnamnesis(id), [id]);

  const [tab, setTab] = useState("timeline");
  const [dsarOpen, setDsarOpen] = useState(false);
  const [eraseOpen, setEraseOpen] = useState(false);
  const [encounterOpen, setEncounterOpen] = useState(false);
  const [groupCollapsed, setGroupCollapsed] = useState({});

  if (patientReq.loading) return <div className="page wide"><Loading lang={lang} /></div>;
  if (patientReq.error)   return <div className="page wide"><ApiErrorView error={patientReq.error} lang={lang} /></div>;
  const patient = patientReq.data;
  if (!patient) return <Empty title={lang === "uk" ? "Пацієнт не знайдений" : "Patient not found"} icon="user" />;

  const timeline   = asList(tlReq.data);
  const encounters = asList(encReq.data);
  const consents   = asList(conReq.data);
  const notes      = asList(notesReq.data);
  const anamnesis  = anamReq.data;
  const allergies  = anamnesis?.allergies || [];

  const reportItems = timeline.filter(t => t.kind === "dictate");
  const scribeItems = timeline.filter(t => t.kind === "scribe");

  // Unified, date-sorted timeline.
  const tlItems = [
    ...encounters.map(e => ({ ...e, _type: "encounter", _date: e.date })),
    ...timeline.map(t => ({ id: t.id, date: t.date, kind: t.kind, title: t.title, by: t.by, status: t.status,
      _type: t.kind === "scribe" ? "conversation" : "report", _date: t.date })),
    ...notes.map(n => ({ ...n, _type: "note", _date: n.date || n.created_at })),
    ...consents.map(c => ({ ...c, _type: "consent", _date: c.date })),
  ].sort((a, b) => new Date(b._date) - new Date(a._date));

  const groupOrder = [];
  const groups = {};
  tlItems.forEach(item => {
    const gk = getGroupKey(item._date);
    if (!groups[gk]) { groups[gk] = []; groupOrder.push(gk); }
    groups[gk].push(item);
  });

  const defaultExpanded = { today: true, week: true };
  const isCollapsed = (gk) => (gk in groupCollapsed) ? groupCollapsed[gk] : !defaultExpanded[gk];
  const toggleGroup = (gk) => setGroupCollapsed(prev => ({ ...prev, [gk]: !isCollapsed(gk) }));

  const tabCounts = {
    timeline: tlItems.length,
    notes: notes.length,
    reports: reportItems.length,
    anamnesis: null,
    conversations: scribeItems.length,
    consents: consents.length,
  };

  const tabDefs = [
    { id: "timeline",      icon: "clock",    uk: "Часова шкала", en: "Timeline" },
    { id: "notes",         icon: "fileText", uk: "Нотатки",      en: "Notes" },
    { id: "reports",       icon: "scan",     uk: "Звіти",        en: "Reports" },
    { id: "anamnesis",     icon: "heart",    uk: "Анамнез",      en: "Anamnesis" },
    { id: "conversations", icon: "mic",      uk: "Розмови",      en: "Conversations" },
    { id: "consents",      icon: "shield",   uk: "Згоди",        en: "Consents" },
  ];

  const handleDsar = async ({ reason }) => { await requestDsar(id, { reason }); setDsarOpen(false); };
  const handleErase = ({ reason }) => scheduleErasure(id, { reason });
  const handleEncounter = async (payload) => {
    await createEncounter(id, payload);
    setEncounterOpen(false);
    encReq.reload(); tlReq.reload();
  };
  const handleWithdraw = async (c) => { await withdrawConsent(id, c.id); conReq.reload(); };

  function renderTimelineItem(item) {
    const typeMap = {
      encounter:    { icon: "mic",      chipClass: "scribe",   label: lang === "uk" ? "Прийом"  : "Encounter" },
      report:       { icon: "scan",     chipClass: "dictate",  label: lang === "uk" ? "Звіт"    : "Report" },
      note:         { icon: "fileText", chipClass: "",         label: lang === "uk" ? "Нотатка" : "Note" },
      conversation: { icon: "mic",      chipClass: "scribe",   label: lang === "uk" ? "Розмова" : "Conversation" },
      consent:      { icon: "shield",   chipClass: "",         label: lang === "uk" ? "Згода"   : "Consent" },
    };
    const t = typeMap[item._type] || { icon: "clock", chipClass: "", label: item._type };

    const handleClick = () => {
      if (item._type === "conversation") navigate(`/scribe/consult/${item.id}`);
      else if (item._type === "report")  navigate(`/dictate/reports/${item.id}`);
      else if (item._type === "note")    navigate(`/scribe/notes/${item.id}`);
      else if (item._type === "encounter") setEncounterOpen(true);
    };

    const displayTitle = loc(item.title, lang) || loc(item.reason, lang) || `${t.label} — ${fmtDate(item._date, lang)}`;
    const statusLabel = item.status
      ? ({ live: lang === "uk" ? "наживо" : "live", draft: lang === "uk" ? "чернетка" : "draft", signed: lang === "uk" ? "підписано" : "signed", granted: lang === "uk" ? "надано" : "granted", declined: lang === "uk" ? "відхилено" : "declined", withdrawn: lang === "uk" ? "відкликано" : "withdrawn" })[item.status] || item.status
      : null;

    return (
      <div key={item.id} className={`tl-row tl-type-${item._type}`} onClick={handleClick}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", cursor: "pointer", borderBottom: "1px solid var(--line-2)" }}>
        <div className={`tl-dot tl-type-${item._type}`}><Icon name={t.icon} size={12} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {t.chipClass && <span className={`chip ${t.chipClass}`}>{t.label}</span>}
            <strong style={{ fontSize: 13.5, color: "var(--text-1)" }}>{displayTitle}</strong>
            {statusLabel && (
              <span className={`chip ${item.status === "live" ? "live" : item.status === "signed" || item.status === "granted" ? "signed" : item.status === "draft" || item.status === "declined" ? "draft" : ""}`}>
                {statusLabel}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            {item.by && <>{item.by} · </>}
            {fmtDate(item._date, lang)}, {fmtTime(item._date, lang)}
          </div>
        </div>
        <Icon name="chevRight" size={14} />
      </div>
    );
  }

  return (
    <div className="page wide">
      {/* Profile header */}
      <div className="ph-card">
        <PatientAvatar patient={patient} lang={lang} size={56} />
        <div className="ph-meta">
          <div className="ph-name">
            {patientName(patient, lang)}
            <span className="chip">{(patient.age ?? calcAge(patient.dob)) ?? "—"} {lang === "uk" ? "р." : "y"} · {patient.sex}</span>
            {allergies.length > 0 && (
              <span className="allergy-chip">
                <Icon name="flag" size={11} />
                {lang === "uk" ? `${allergies.length} алергія` : `${allergies.length} allerg${allergies.length === 1 ? "y" : "ies"}`}
              </span>
            )}
          </div>
          <div className="ph-sub">
            <span className="pmono">{patient.mrn}</span>
            {patient.dob && <><span>·</span><span>{lang === "uk" ? "Народж." : "DOB"}: {patient.dob}</span></>}
            {patient.summary && <><span>·</span><span>{loc(patient.summary, lang)}</span></>}
          </div>
          <div className="ph-tags">
            {(patient.tags || []).map((t, i) => <span key={i} className="chip">{t}</span>)}
          </div>
        </div>
        <div className="ph-actions">
          <button className="btn ghost sm" onClick={() => setDsarOpen(true)}><Icon name="download" size={13} /> DSAR</button>
          <button className="btn ghost sm" style={{ color: "var(--rec)", borderColor: "color-mix(in srgb, var(--rec) 30%, transparent)" }} onClick={() => setEraseOpen(true)}>
            <Icon name="flag" size={13} /> {lang === "uk" ? "Видалити дані" : "Schedule erasure"}
          </button>
          <button className="btn ghost sm" onClick={() => navigate(`/dictate?patient=${id}`)}>
            <Icon name="fileText" size={13} /> {lang === "uk" ? "Диктувати звіт" : "Dictate report"}
          </button>
          <button className="btn accent" onClick={() => navigate(`/scribe/consult/new?patient=${id}`)}>
            <Icon name="mic" size={13} /> {lang === "uk" ? "Розпочати запис" : "Start recording"}
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

      {/* Timeline tab */}
      {tab === "timeline" && (
        <div style={{ marginTop: 16 }}>
          {(tlReq.loading || encReq.loading || conReq.loading || notesReq.loading) && <Loading lang={lang} />}
          {tlReq.error && <ApiErrorView error={tlReq.error} lang={lang} />}
          {!tlReq.loading && groupOrder.length === 0 && (
            <Empty icon="clock" title={lang === "uk" ? "Немає записів" : "No history yet"} />
          )}
          {groupOrder.map(gk => (
            <div key={gk} className="tl-group">
              <div className={`tl-group-header ${isCollapsed(gk) ? "collapsed" : ""}`} onClick={() => toggleGroup(gk)}>
                <span>{groupLabel(gk, lang)}</span>
                <span style={{ color: "var(--text-2)", fontWeight: 400, fontSize: 12, textTransform: "none", letterSpacing: 0 }}>
                  {groups[gk].length} {lang === "uk" ? "записів" : "records"}
                </span>
                <Icon name="chevDown" size={13} className="tl-group-chevron" style={{ marginLeft: "auto", transform: isCollapsed(gk) ? "rotate(-90deg)" : undefined }} />
              </div>
              <div className={`tl-group-body ${isCollapsed(gk) ? "collapsed" : ""}`}>
                {groups[gk].map(item => renderTimelineItem(item))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notes tab */}
      {tab === "notes" && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button className="btn accent sm" onClick={() => navigate(`/scribe/notes/new?patient=${id}`)}>
              <Icon name="plus" size={13} /> {lang === "uk" ? "Нова нотатка" : "New note"}
            </button>
          </div>
          {notesReq.loading ? <Loading lang={lang} /> : notes.length === 0 ? (
            <Empty icon="fileText" title={lang === "uk" ? "Нотаток немає" : "No notes yet"} />
          ) : (
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden" }}>
              {notes.map((n, i) => (
                <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < notes.length - 1 ? "1px solid var(--line-2)" : "none", cursor: "pointer" }}
                  onClick={() => navigate(`/scribe/notes/${n.id}`)}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name="fileText" size={13} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-1)" }}>{loc(n.title, lang)}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{n.structure || n.template} · {fmtDate(n.date || n.created_at, lang)}</div>
                  </div>
                  <span className={`chip ${n.status === "signed" ? "signed" : n.status === "draft" ? "draft" : ""}`}>
                    {n.status === "signed" ? (lang === "uk" ? "підписано" : "signed") : n.status === "draft" ? (lang === "uk" ? "чернетка" : "draft") : n.status}
                  </span>
                  <Icon name="chevRight" size={14} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reports tab */}
      {tab === "reports" && (
        <div style={{ marginTop: 16 }}>
          {tlReq.loading ? <Loading lang={lang} /> : reportItems.length === 0 ? (
            <Empty icon="scan" title={lang === "uk" ? "Звітів немає" : "No reports yet"} />
          ) : (
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden" }}>
              {reportItems.map((rep, i, arr) => (
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
                    {rep.status === "signed" ? (lang === "uk" ? "підписано" : "signed") : (lang === "uk" ? "чернетка" : "draft")}
                  </span>
                  <Icon name="chevRight" size={14} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Anamnesis tab */}
      {tab === "anamnesis" && (
        <div style={{ marginTop: 16 }}>
          {anamReq.loading ? <Loading lang={lang} /> : <AnamnesisTab data={anamnesis} lang={lang} />}
        </div>
      )}

      {/* Conversations tab */}
      {tab === "conversations" && (
        <div style={{ marginTop: 16 }}>
          {tlReq.loading ? <Loading lang={lang} /> : scribeItems.length === 0 ? (
            <Empty icon="mic" title={lang === "uk" ? "Розмов немає" : "No conversations yet"} />
          ) : (
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden" }}>
              {scribeItems.map((conv, i, arr) => (
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
                    {conv.status === "live" ? (lang === "uk" ? "наживо" : "live") : conv.status === "signed" ? (lang === "uk" ? "підписано" : "signed") : (lang === "uk" ? "чернетка" : "draft")}
                  </span>
                  <Icon name="chevRight" size={14} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Consents tab */}
      {tab === "consents" && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button className="btn accent sm" onClick={() => navigate(`/scribe/consent/new?patient=${id}`)}>
              <Icon name="plus" size={13} /> {lang === "uk" ? "Запит згоди" : "Request consent"}
            </button>
          </div>
          {conReq.loading ? <Loading lang={lang} /> : consents.length === 0 ? (
            <Empty icon="shield" title={lang === "uk" ? "Записів про згоду немає" : "No consent records"} />
          ) : (
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden" }}>
              {consents.map((c) => (
                <div key={c.id} className="consent-row">
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name="shield" size={13} />
                  </div>
                  <div className="cr-meta">
                    <div className="cr-type">
                      {c.type === "ai_scribe" ? (lang === "uk" ? "AI-скрайб" : "AI Scribe") : c.type}
                      {" · "}{c.method === "verbal" ? (lang === "uk" ? "Вербально" : "Verbal") : (lang === "uk" ? "Кіоск" : "Kiosk")}
                      {" · v"}{c.version}
                    </div>
                    <div className="cr-detail">{fmtDate(c.date, lang)}</div>
                  </div>
                  <span className={`status-badge ${c.status}`}>
                    {({ granted: lang === "uk" ? "Надано" : "Granted", declined: lang === "uk" ? "Відхилено" : "Declined", withdrawn: lang === "uk" ? "Відкликано" : "Withdrawn" })[c.status] || c.status}
                  </span>
                  {c.status === "granted" && (
                    <button className="btn ghost sm" style={{ fontSize: 12 }} onClick={() => handleWithdraw(c)}>
                      {lang === "uk" ? "Відкликати" : "Withdraw"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {dsarOpen && (
        <DsarModal lang={lang} patientName={patientName(patient, lang)} onClose={() => setDsarOpen(false)} onSubmit={handleDsar} />
      )}
      {eraseOpen && (
        <EraseModal lang={lang} patientName={patientName(patient, lang)} onClose={() => setEraseOpen(false)} onConfirm={handleErase} />
      )}
      {encounterOpen && (
        <EncounterModal lang={lang} onClose={() => setEncounterOpen(false)} onSave={handleEncounter} />
      )}
    </div>
  );
}
