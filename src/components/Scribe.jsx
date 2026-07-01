// Scribe.jsx — Scribe product (Today, Patients, Notes, Consultation)
// All data is fetched from the core / scribe services; there is no mock layer.
import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n.js';
import { Icon, Empty, Modal } from './UI.jsx';
import { LoadGate, asList } from './DataStates.jsx';
import { Pagination } from './Pagination.jsx';
import { useAsync } from '../api/useAsync.js';
import { useClaims } from '../auth/AuthContext.jsx';
import { listPatients, createPatient } from '../api/patients.js';
import { listSchedule } from '../api/encounters.js';
import { listNotes, listNoteStructures } from '../api/notes.js';
import { getSession } from '../api/scribe.js';

// ─── Helpers ─────────────────────────────────────────────────────────────
function loc(v, lang) {
  if (v == null) return "";
  if (typeof v === "object") return v[lang] ?? v.en ?? Object.values(v)[0] ?? "";
  return v;
}
function fmtTime(iso, lang) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(lang === "uk" ? "uk-UA" : "en-GB", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso, lang) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(lang === "uk" ? "uk-UA" : "en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtRel(iso, lang) {
  if (!iso) return "";
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d) / 60000);
  if (diffMin < 1) return lang === "uk" ? "щойно" : "just now";
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
    live: lang === "uk" ? "наживо" : "live",
    draft: lang === "uk" ? "чернетка" : "draft",
    signed: lang === "uk" ? "підписано" : "signed",
    scheduled: lang === "uk" ? "заплановано" : "scheduled",
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
  return a == null ? "" : `${a} ${lang === "uk" ? "р." : "y"}`;
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

// ─── Today (Scribe landing) ──────────────────────────────────────────────
export function ScribeToday({ navigate, lang }) {
  const sched = useAsync(() => listSchedule(), []);
  const notes = useAsync(() => listNotes({}), []);

  const schedList = asList(sched.data).map((s) => ({ ...s, patient: s.patient }));
  const notesList = asList(notes.data);
  const recentNotes = notesList.slice(0, 4);
  const liveNow = schedList.find((t) => t.status === "in-room");

  const stats = [
    { label: lang === "uk" ? "Сьогодні візитів" : "Today's visits", value: schedList.length },
    { label: lang === "uk" ? "Чернеток" : "Drafts", value: notesList.filter((n) => n.status === "draft").length },
    { label: lang === "uk" ? "Підписаних" : "Signed", value: notesList.filter((n) => n.status === "signed").length },
  ];

  return (
    <div className="page">
      <div className="page-h">
        <div style={{ flex: 1 }}>
          <h1>{lang === "uk" ? "Доброго ранку, докторе" : "Good morning, doctor"}</h1>
          <p className="sub">
            {lang === "uk"
              ? `${schedList.length} візитів заплановано · ${new Date().toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" })}`
              : `${schedList.length} visits scheduled · ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`}
          </p>
        </div>
        <button className="btn accent" onClick={() => navigate(`/scribe/consult/new`)}>
          <Icon name="mic" size={14} /> {lang === "uk" ? "Почати консультацію" : "Start consultation"}
        </button>
      </div>

      <div className="stats-row">
        {stats.map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-v">{s.value}</div>
            <div className="stat-l">{s.label}</div>
          </div>
        ))}
      </div>

      {liveNow && (
        <div className="liveroom" onClick={() => navigate(`/scribe/consult/new?patient=${liveNow.patient?.id || ""}`)}>
          <div className="liveroom-l">
            <PatientAvatar patient={liveNow.patient} lang={lang} size={44} />
            <div>
              <div className="liveroom-name">{patientName(liveNow.patient, lang)} <span className="chip live">{lang === "uk" ? "У кабінеті" : "In room"}</span></div>
              <div className="liveroom-meta">{loc(liveNow.reason, lang)} · {liveNow.time}</div>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <button className="btn accent">
            <Icon name="mic" size={13} /> {lang === "uk" ? "Розпочати запис" : "Begin recording"}
          </button>
        </div>
      )}

      <div className="grid-2">
        <section className="panel">
          <div className="panel-h">
            <h3>{lang === "uk" ? "Графік на сьогодні" : "Today's schedule"}</h3>
            <div style={{ flex: 1 }} />
          </div>
          <LoadGate req={sched} lang={lang}
            empty={() => <Empty icon="calendar" title={lang === "uk" ? "Немає візитів на сьогодні" : "No visits scheduled today"} />}>
            {() => (
              <div className="schedule">
                {schedList.map((item) => (
                  <div key={item.id} className={`sch-row ${item.status}`}
                       onClick={() => item.patient?.id && navigate(`/scribe/patients/${item.patient.id}`)}>
                    <div className="sch-time">{item.time}</div>
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
                      {item.status === "in-room" && <span className="chip live">{lang === "uk" ? "У кабінеті" : "In room"}</span>}
                      {item.status === "scheduled" && <Icon name="chevRight" size={14} />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </LoadGate>
        </section>

        <section className="panel">
          <div className="panel-h">
            <h3>{lang === "uk" ? "Останні нотатки" : "Recent notes"}</h3>
            <div style={{ flex: 1 }} />
            <a className="btn ghost sm" onClick={() => navigate("/scribe/notes")}>{lang === "uk" ? "Усі" : "All"}</a>
          </div>
          <LoadGate req={notes} lang={lang}
            empty={() => <Empty icon="fileText" title={lang === "uk" ? "Ще немає нотаток" : "No notes yet"} />}>
            {() => (
              <div className="note-feed">
                {recentNotes.map((n) => {
                  const pid = n.patient?.id || n.patientId || n.patient_id;
                  return (
                    <div key={n.id} className="note-row" onClick={() => pid && navigate(`/scribe/patients/${pid}`)}>
                      <PatientAvatar patient={n.patient} lang={lang} size={32} />
                      <div className="note-row-body">
                        <div className="note-row-1">
                          <span className="note-row-name">{patientShort(n.patient, lang) || pid}</span>
                          <span className="chip scribe">{n.template || n.structure}</span>
                          <StatusPill status={n.status} lang={lang} />
                        </div>
                        <div className="note-row-2">{fmtRel(n.date || n.created_at, lang)}</div>
                      </div>
                      <Icon name="chevRight" size={14} />
                    </div>
                  );
                })}
              </div>
            )}
          </LoadGate>
        </section>
      </div>
    </div>
  );
}

// ─── Notes feed (cross-patient inbox) ────────────────────────────────────
const SCRIBE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const SCRIBE_DEFAULT_PAGE_SIZE = 20;

export function ScribeNotes({ navigate, lang }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(SCRIBE_DEFAULT_PAGE_SIZE);
  const req = useAsync(() => listNotes({}), []);
  const all = asList(req.data);

  const list = all.filter((n) => {
    if (filter !== "all" && n.status !== filter) return false;
    if (!q) return true;
    const s = (patientName(n.patient, lang) + " " + (n.template || n.structure || "") + " " + n.id).toLowerCase();
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
    all: lang === "uk" ? "Усі" : "All",
    live: lang === "uk" ? "Наживо" : "Live",
    draft: lang === "uk" ? "Чернетки" : "Drafts",
    signed: lang === "uk" ? "Підписані" : "Signed",
  })[k];

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>{lang === "uk" ? "Нотатки" : "Notes"}</h1>
          <p className="sub">{all.length} {lang === "uk" ? "нотаток у вашій стрічці" : "notes in your feed"}</p>
        </div>
        <button className="btn primary" onClick={() => navigate("/scribe/consult/new")}>
          <Icon name="mic" size={14} />
          {lang === "uk" ? "Нова консультація" : "New consultation"}
        </button>
      </div>

      <div className="ptable-toolbar">
        <label className="search-input">
          <Icon name="search" size={14} />
          <input
            placeholder={lang === "uk" ? "Пошук пацієнта, шаблону…" : "Search patient, template…"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <div className="seg">
          {["all", "live", "draft", "signed"].map((k) => (
            <button key={k} className={"seg-btn" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>
              {filterLabel(k)}
              <span className="seg-count">{counts[k]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ptable">
        <div className="ptable-head" style={{ gridTemplateColumns: "2fr 1.2fr 1fr 1fr 30px" }}>
          <span>{lang === "uk" ? "Пацієнт" : "Patient"}</span>
          <span>{lang === "uk" ? "Шаблон" : "Template"}</span>
          <span>{lang === "uk" ? "Статус" : "Status"}</span>
          <span>{lang === "uk" ? "Створено" : "Created"}</span>
          <span></span>
        </div>
        <LoadGate req={req} lang={lang}
          empty={() => (
            <div style={{ padding: 36, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              {lang === "uk" ? "Ще немає нотаток" : "No notes yet"}
            </div>
          )}>
          {() => (
            list.length === 0 ? (
              <div style={{ padding: 36, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                {lang === "uk" ? "Нічого не знайдено" : "No notes match your filter"}
              </div>
            ) : pageList.map((n) => {
              const pid = n.patient?.id || n.patientId || n.patient_id;
              return (
                <div key={n.id} className="ptable-row" style={{ gridTemplateColumns: "2fr 1.2fr 1fr 1fr 30px" }}
                     onClick={() => navigate("/scribe/consult/" + n.id)}>
                  <div className="pcell-name">
                    <PatientAvatar patient={n.patient} lang={lang} size={32} />
                    <div>
                      <div className="pname">{patientName(n.patient, lang) || pid}</div>
                      <div className="psub">{patientAge(n.patient, lang)}{n.patient?.sex ? ` · ${n.patient.sex}` : ""}</div>
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

// ─── New patient modal ────────────────────────────────────────────────────
function NewPatientModal({ lang, onClose, onSave }) {
  const [nameUk,   setNameUk]   = useState("");
  const [nameEn,   setNameEn]   = useState("");
  const [dob,      setDob]      = useState("");
  const [sex,      setSex]      = useState("M");
  const [mrn,      setMrn]      = useState("");
  const [summary,  setSummary]  = useState("");
  const [tags,     setTags]     = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);

  const displayName = nameUk || nameEn || (lang === "uk" ? "Новий пацієнт" : "New patient");
  const initials = autoInitials(displayName);
  const accent = autoAccent(displayName);
  const age = calcAge(dob);
  const valid = (nameUk.trim() || nameEn.trim()) && dob && mrn.trim();

  const addTag = (val) => {
    const v = val.trim();
    if (v && !tags.includes(v)) setTags((t) => [...t, v]);
    setTagInput("");
  };

  const handleSave = async () => {
    if (!valid || saving) return;
    const uk = nameUk.trim() || nameEn.trim();
    const en = nameEn.trim() || nameUk.trim();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: { uk, en },
        dob, sex, mrn: mrn.trim(),
        summary: summary ? { uk: summary, en: summary } : undefined,
        tags,
      });
    } catch (e) {
      setError(e);
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="modal-h">
        <h2>{lang === "uk" ? "Новий пацієнт" : "New patient"}</h2>
        <p>{lang === "uk" ? "Додайте пацієнта до вашої картки" : "Add a patient to your panel"}</p>
      </div>

      <div className="modal-body np-form">
        <div className="np-avatar-row">
          <div className="np-avatar-preview" style={{ background: accent }}>{initials}</div>
          <div className="np-avatar-meta">
            <div className="np-preview-name">{displayName}</div>
            <div className="psub">
              {age !== null ? `${age} ${lang === "uk" ? "р." : "y"}` : (lang === "uk" ? "Вік невідомий" : "Age unknown")}
              {" · "}{sex}
              {mrn && <span className="pmono" style={{ marginLeft: 8 }}>{mrn}</span>}
            </div>
          </div>
        </div>

        <div className="np-row two">
          <label>
            <span>{lang === "uk" ? "ПІБ (UA)" : "Full name (UA)"}</span>
            <input className="ti" value={nameUk} onChange={(e) => setNameUk(e.target.value)} />
          </label>
          <label>
            <span>{lang === "uk" ? "ПІБ (EN)" : "Full name (EN)"}</span>
            <input className="ti" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </label>
        </div>

        <div className="np-row three">
          <label>
            <span>{lang === "uk" ? "Дата народження" : "Date of birth"}</span>
            <input className="ti" type="date" value={dob}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDob(e.target.value)} />
          </label>
          <label>
            <span>{lang === "uk" ? "Стать" : "Sex"}</span>
            <div className="np-sex-toggle">
              {["M", "F"].map((s) => (
                <button key={s} type="button" className={sex === s ? "on" : ""} onClick={() => setSex(s)}>
                  {s === "M" ? (lang === "uk" ? "Чол." : "Male") : (lang === "uk" ? "Жін." : "Female")}
                </button>
              ))}
            </div>
          </label>
          <label>
            <span>MRN</span>
            <input className="ti mono" value={mrn} onChange={(e) => setMrn(e.target.value)} />
          </label>
        </div>

        <label className="np-row">
          <span>{lang === "uk" ? "Основний діагноз / причина звернення" : "Chief complaint / summary"}</span>
          <input className="ti" value={summary} onChange={(e) => setSummary(e.target.value)} />
        </label>

        <div className="np-row">
          <span className="np-label">{lang === "uk" ? "Теги / стани" : "Tags / conditions"}</span>
          <div className="np-tags-field">
            {tags.map((tag) => (
              <span key={tag} className="chip">
                {tag}
                <button type="button" style={{ marginLeft: 4, color: "var(--muted)" }}
                  onClick={() => setTags((t) => t.filter((x) => x !== tag))}>×</button>
              </span>
            ))}
            <input
              className="np-tag-input"
              value={tagInput}
              placeholder={lang === "uk" ? "+ додати тег" : "+ add tag"}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); }
                if (e.key === "Backspace" && !tagInput && tags.length) setTags((t) => t.slice(0, -1));
              }}
              onBlur={() => tagInput.trim() && addTag(tagInput)}
            />
          </div>
        </div>

        {error && (
          <div style={{ color: "var(--rec, #dc2626)", fontSize: 13 }}>
            {error.message || (lang === "uk" ? "Не вдалося зберегти" : "Could not save")}
          </div>
        )}
      </div>

      <div className="modal-foot">
        <button className="btn" onClick={onClose}>{lang === "uk" ? "Скасувати" : "Cancel"}</button>
        <button className="btn accent" disabled={!valid || saving} onClick={handleSave}>
          <Icon name="plus" size={13} />
          {saving ? (lang === "uk" ? "Збереження…" : "Saving…") : (lang === "uk" ? "Додати пацієнта" : "Add patient")}
        </button>
      </div>
    </Modal>
  );
}

// ─── Patients list ───────────────────────────────────────────────────────
export function ScribePatients({ navigate, lang }) {
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(SCRIBE_DEFAULT_PAGE_SIZE);
  // Patients are tenant-scoped server-side (RLS on the active tenant). Re-key on
  // claims.tid so the roster refetches when the active clinic changes (after a
  // switch + re-auth). TENANT.md §2.5.
  const activeTid = useClaims()?.tid;
  const req = useAsync(() => listPatients({ query: q || undefined }), [q, activeTid]);
  const list = asList(req.data);

  // Server re-queries on `q`; reset to the first page when results change.
  useEffect(() => { setPage(1); }, [q]);
  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageList = list.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleAdd = async (payload) => {
    await createPatient(payload);
    setAddOpen(false);
    req.reload();
  };

  return (
    <div className="page">
      <div className="page-h">
        <div style={{ flex: 1 }}>
          <h1>{lang === "uk" ? "Пацієнти" : "Patients"}</h1>
          <p className="sub">{list.length} {lang === "uk" ? "у вашій карті" : "in your panel"}</p>
        </div>
        <button className="btn accent" onClick={() => setAddOpen(true)}>
          <Icon name="plus" size={13} /> {lang === "uk" ? "Новий пацієнт" : "Add patient"}
        </button>
      </div>
      <div className="ptable-toolbar">
        <div className="search-input">
          <Icon name="search" size={14} />
          <input placeholder={lang === "uk" ? "Пошук пацієнтів, MRN…" : "Search patients, MRN…"}
                 value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="ptable">
        <div className="ptable-head">
          <div>{lang === "uk" ? "Пацієнт" : "Patient"}</div>
          <div>MRN</div>
          <div>{lang === "uk" ? "Стан / теги" : "Conditions"}</div>
          <div>{lang === "uk" ? "Останній візит" : "Last visit"}</div>
          <div></div>
        </div>
        <LoadGate req={req} lang={lang}
          empty={() => (
            <div style={{ padding: "40px 24px", textAlign: "center" }}>
              <Empty icon="users" title={lang === "uk" ? "Пацієнтів не знайдено" : "No patients found"} />
            </div>
          )}>
          {() => pageList.map((p) => (
            <div key={p.id} className="ptable-row" onClick={() => navigate(`/scribe/patients/${p.id}`)}>
              <div className="pcell-name">
                <PatientAvatar patient={p} lang={lang} size={34} />
                <div>
                  <div className="pname">{patientName(p, lang)}</div>
                  <div className="psub">{patientAge(p, lang)}{p.sex ? ` · ${p.sex}` : ""}</div>
                </div>
              </div>
              <div className="pmono">{p.mrn}</div>
              <div className="ptags">
                {(p.tags || []).slice(0, 2).map((t, i) => <span key={i} className="chip">{t}</span>)}
                {(p.tags || []).length > 2 && <span className="chip">+{p.tags.length - 2}</span>}
              </div>
              <div className="psub">{fmtRel(p.last || p.last_visit, lang)}</div>
              <div><Icon name="chevRight" size={14} /></div>
            </div>
          ))}
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

      {addOpen && <NewPatientModal lang={lang} onClose={() => setAddOpen(false)} onSave={handleAdd} />}
    </div>
  );
}

// ─── Consultation viewer (reads a finalized scribe session) ──────────────
// Live ambient capture is performed by a dedicated scribe backend; until a
// session exists this screen shows an empty state rather than a scripted demo.
export function ScribeConsult({ id, patientHint, navigate, lang, onRecordingChange }) {
  // This viewer never holds a live recording — clear any parent indicator.
  React.useEffect(() => { onRecordingChange?.(null); }, []); // eslint-disable-line

  const req = useAsync(() => (id ? getSession(id) : Promise.resolve(null)), [id]);

  if (!id) {
    return (
      <div className="page">
        <Empty
          icon="mic"
          title={lang === "uk" ? "Немає активної сесії" : "No active session"}
          body={lang === "uk"
            ? "Запис консультації ще не розпочато. Створіть сесію, щоб переглянути транскрипт і нотатку."
            : "No consultation has been recorded yet. Start a session to see the transcript and note."}
          action={<button className="btn" onClick={() => navigate("/scribe")}>{lang === "uk" ? "До розкладу" : "Back to schedule"}</button>}
        />
      </div>
    );
  }

  return (
    <LoadGate req={req} lang={lang}
      empty={() => (
        <div className="page">
          <Empty icon="search" title={lang === "uk" ? "Сесію не знайдено" : "Session not found"} body={id}
            action={<button className="btn" onClick={() => navigate("/scribe/notes")}>{lang === "uk" ? "До нотаток" : "Back to notes"}</button>} />
        </div>
      )}>
      {(session) => <ConsultView session={session} navigate={navigate} lang={lang} />}
    </LoadGate>
  );
}

function ConsultView({ session, navigate, lang }) {
  const patient = session.patient || {};
  const noteSections = ["subjective", "objective", "assessment", "plan"];
  const note = session.note || {};

  return (
    <div className="consult">
      <div className="consult-h">
        <button className="tb-back" onClick={() => navigate(patient.id ? `/scribe/patients/${patient.id}` : "/scribe/notes")}>
          <Icon name="arrowLeft" size={16} />
        </button>
        <PatientAvatar patient={patient} lang={lang} size={36} />
        <div className="consult-h-meta">
          <div className="consult-h-name">{patientName(patient, lang) || session.patientId}</div>
          <div className="consult-h-sub">
            {patientAge(patient, lang)}{patient.sex ? ` · ${patient.sex}` : ""}{patient.mrn ? ` · ${patient.mrn}` : ""}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {session.status && <StatusPill status={session.status} lang={lang} />}
        <button className="btn" onClick={() => navigate(`/scribe/review/${session.id}`)}>
          <Icon name="eye" size={13} /> {lang === "uk" ? "Огляд нотатки" : "Review note"}
        </button>
      </div>

      <div className="consult-split">
        <section className="tx-pane">
          <div className="tx-h">
            <h3>{lang === "uk" ? "Транскрипт" : "Transcript"}</h3>
          </div>
          <div className="tx-body">
            {asList(session.transcript).map((turn, i) => (
              <div key={turn.id || i} className={`turn ${turn.speaker || "clinician"}`}>
                <div className="turn-meta">
                  <span className="turn-who">
                    {turn.speaker === "patient"
                      ? (lang === "uk" ? "Пацієнт" : "Patient")
                      : (lang === "uk" ? "Лікар" : "Clinician")}
                  </span>
                  <span className="turn-t">{fmtDur(turn.t)}</span>
                </div>
                <div className="turn-text">{turn.text}</div>
              </div>
            ))}
            {!asList(session.transcript).length && (
              <Empty icon="mic" title={lang === "uk" ? "Транскрипт порожній" : "Transcript is empty"} />
            )}
          </div>
        </section>

        <section className="note-pane">
          <div className="note-body">
            {noteSections.filter((sec) => note[sec]).map((sec) => {
              const s = note[sec];
              return (
                <article key={sec} id={`note-${sec}`} className="note-section">
                  <div className="note-section-h"><h4>{loc(s.title, lang)}</h4></div>
                  <div className="note-section-c">
                    {loc(s.content, lang).split("\n").map((line, i) => <p key={i}>{line || <br />}</p>)}
                  </div>
                </article>
              );
            })}

            {asList(session.flags).length > 0 && (
              <article className="note-flags">
                <div className="note-flags-h"><Icon name="sparkle" size={13} /><h4>{lang === "uk" ? "AI помітив" : "AI noticed"}</h4></div>
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
                <div className="note-flags-h"><Icon name="tag" size={13} /><h4>{lang === "uk" ? "Запропоновані коди МКХ-10" : "Suggested ICD-10 codes"}</h4></div>
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

            {!noteSections.some((sec) => note[sec]) && (
              <Empty icon="fileText" title={lang === "uk" ? "Нотатку ще не згенеровано" : "Note not generated yet"} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Note structures (Scribe → Templates) ────────────────────────────────
export function ScribeNoteStructures({ lang }) {
  const req = useAsync(() => listNoteStructures(), []);
  return (
    <div className="page">
      <div className="page-h"><div><h1>{lang === "uk" ? "Шаблони нотаток" : "Note templates"}</h1></div></div>
      <LoadGate req={req} lang={lang}
        empty={() => <Empty icon="layers" title={lang === "uk" ? "Немає шаблонів" : "No note templates"} />}>
        {(data) => (
          <div className="grid-2" style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {asList(data).map((t) => (
              <div key={t.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name="layers" size={14} />
                  <strong style={{ fontSize: 14 }}>{loc(t.name, lang)}</strong>
                </div>
                <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>{loc(t.description ?? t.desc, lang)}</div>
              </div>
            ))}
          </div>
        )}
      </LoadGate>
    </div>
  );
}
