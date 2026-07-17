// Scribe.jsx — Scribe product (Today, Notes, Consultation). The patients
// roster moved to src/patients/PatientDirectory.jsx (sprint 11 step 02).
// All data is fetched from the core / scribe services; there is no mock layer.
import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n.js';
import { Icon, Empty } from './UI.jsx';
import { LoadGate, asList } from './DataStates.jsx';
import { Pagination } from './Pagination.jsx';
import { useAsync } from '../api/useAsync.js';
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

// ─── New patient modal + patients roster ────────────────────────────────
// Moved to src/patients/PatientDirectory.jsx in sprint 11 step 02 (adds
// edit/archive, the ІПН field, cursor pagination, and the PII-hygiene
// search behavior). ScribePatients here was its sprint-old predecessor.

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
