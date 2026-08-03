// NoteEditor.jsx — Sprint 12: Quick note modal + full clinical note editor
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Icon, Modal, SaveStatus, Toast, Empty } from './UI.jsx';
import { Loading, asList } from './DataStates.jsx';
import { useAsync } from '../api/useAsync.js';
import { listPatients, getPatient } from '../api/patients.js';
import { getNote, createNote, updateNote, signNote } from '../api/notes.js';
import {
  deriveTitle, fromWireSections, isBlank, structureFromWire, structureToWire, toWireSections,
} from '../notes/noteShape.js';
import { ApiErrorView } from './ApiErrorView.jsx';
import { MenuSelect } from './MenuSelect.jsx';
// The same recognizer the dictation Studio and the report amend panel use —
// a note is dictated the same way a report is, and a second implementation
// would drift the moment one of them is fixed.
import { useSpeechRecognition, LevelMeter } from './Studio.jsx';
import { listTemplates } from '../api/templates.js';
import { createReport } from '../api/reports.js';
import { tr } from "../i18n.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loc(v, lang) {
  if (v == null) return "";
  if (typeof v === "object") return v[lang] ?? v.en ?? Object.values(v)[0] ?? "";
  return v;
}
function patientName(p, lang) { return loc(p?.name, lang); }
function autoInitials(nameStr) {
  const parts = String(nameStr || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) || "?").toUpperCase();
}

// Standard clinical note formats and their section scaffolds.
const STRUCTURES = [
  { id: "free",  uk: "Вільний текст",  en: "Free text" },
  { id: "SOAP",  uk: "SOAP",           en: "SOAP" },
  { id: "APSO",  uk: "APSO",           en: "APSO" },
  { id: "DAP",   uk: "DAP",            en: "DAP" },
];

const SECTIONS_MAP = {
  SOAP: [
    { id: "S", uk: "Скарги (S)",     en: "Subjective (S)" },
    { id: "O", uk: "Об'єктивно (O)", en: "Objective (O)" },
    { id: "A", uk: "Оцінка (A)",     en: "Assessment (A)" },
    { id: "P", uk: "План (P)",       en: "Plan (P)" },
  ],
  APSO: [
    { id: "A", uk: "Оцінка (A)",     en: "Assessment (A)" },
    { id: "P", uk: "План (P)",       en: "Plan (P)" },
    { id: "S", uk: "Скарги (S)",     en: "Subjective (S)" },
    { id: "O", uk: "Об'єктивно (O)", en: "Objective (O)" },
  ],
  DAP: [
    { id: "D", uk: "Дані (D)",       en: "Data (D)" },
    { id: "A", uk: "Оцінка (A)",     en: "Assessment (A)" },
    { id: "P", uk: "План (P)",       en: "Plan (P)" },
  ],
};

// ─── useQuickNoteHotkey ───────────────────────────────────────────────────────

export function useQuickNoteHotkey(onOpen) {
  useEffect(() => {
    const handler = (e) => {
      const mac = navigator.platform?.startsWith("Mac") || navigator.userAgent.includes("Mac");
      const mod = mac ? e.metaKey : e.ctrlKey;
      if (mod && e.shiftKey && (e.key === "N" || e.key === "n")) {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpen]);
}

// ─── PromoteModal ─────────────────────────────────────────────────────────────

export function PromoteModal({ lang, onClose, onConfirm }) {
  const req = useAsync(() => listTemplates(), []);
  const templates = asList(req.data);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!selectedTemplate && templates.length) setSelectedTemplate(templates[0].id);
  }, [templates, selectedTemplate]);

  const confirm = async () => {
    if (!selectedTemplate) return;
    setBusy(true); setError(null);
    try { await onConfirm(selectedTemplate); }
    catch (e) { setError(e); setBusy(false); }
  };

  return (
    <Modal onClose={onClose}>
      <div className="modal-h">
        <h2>{tr(lang, "Просунути до звіту", "Promote to report")}</h2>
        <p>{tr(lang, "Нотатка буде перетворена в медичний звіт", "This note will be promoted to a medical report")}</p>
      </div>
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.65, padding: "12px 14px", background: "var(--accent-soft)", borderRadius: "var(--radius)", borderLeft: "3px solid var(--accent)" }}>
          {tr(lang, "Нотатка буде просунута до звіту. Оригінальна нотатка залишається у системі й доступна у вкладці нотаток.", "This note will be promoted to a report. The original note remains in the system and is accessible in the notes tab.")}
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "var(--text-2)" }}>
          {tr(lang, "Шаблон звіту", "Report template")}
          <select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)}
            disabled={req.loading || !templates.length}
            style={{ padding: "8px 12px", border: "1px solid var(--line)", borderRadius: "var(--radius)", background: "var(--surface)", fontSize: 13, color: "var(--text-1)" }}>
            {req.loading && <option>{tr(lang, "Завантаження…", "Loading…")}</option>}
            {!req.loading && !templates.length && <option>{tr(lang, "Немає шаблонів", "No templates")}</option>}
            {templates.map(t => <option key={t.id} value={t.id}>{loc(t.name, lang)}</option>)}
          </select>
        </label>
        {error && <div style={{ color: "var(--rec,#dc2626)", fontSize: 13 }}>{error.message || (tr(lang, "Помилка", "Error"))}</div>}
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>{tr(lang, "Скасувати", "Cancel")}</button>
        <button className="btn accent" disabled={!selectedTemplate || busy} onClick={confirm}>
          <Icon name="arrowRight" size={13} />
          {busy ? (tr(lang, "Просування…", "Promoting…")) : (tr(lang, "Просунути", "Promote"))}
        </button>
      </div>
    </Modal>
  );
}

// ─── QuickNoteModal ───────────────────────────────────────────────────────────

// The patient a note belongs to. Extracted from the quick-note modal because
// the full editor needs exactly the same control: `patient_id` is REQUIRED by
// NoteCreate, and a note editor that cannot name a patient cannot save at all.
export function PatientCombobox({ lang, value, onSelect, autoFocus = false }) {
  const [query, setQuery] = useState(value ? patientName(value, lang) : "");
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const comboRef = useRef(null);

  const req = useAsync(() => listPatients({ query: query || undefined, limit: 6 }), [query]);
  const options = asList(req.data);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          comboRef.current && !comboRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (p) => {
    setQuery(patientName(p, lang));
    setOpen(false);
    onSelect(p);
  };

  return (
    <div className="qno-combobox" ref={comboRef}>
      <input
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => { setQuery(e.target.value); onSelect(null); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={tr(lang, "Пошук пацієнта…", "Search patient…")}
      />
      {open && options.length > 0 && (
        <div className="qno-dropdown" ref={dropdownRef}>
          {options.map((p) => (
            <div key={p.id} className={`qno-dropdown-item ${value?.id === p.id ? "highlighted" : ""}`}
                 onMouseDown={() => pick(p)}>
              <div className="pavatar" style={{ width: 24, height: 24, background: p.accent || "#0a8a7a", fontSize: 9, flexShrink: 0 }}>
                {p.initials || autoInitials(patientName(p, lang))}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{patientName(p, lang)}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{p.mrn}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function QuickNoteModal({ lang, navigate, onClose }) {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [structure, setStructure] = useState("free");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    if (!selectedPatient || !content.trim() || saving) return;
    setSaving(true); setError(null);
    try {
      // Whatever structure is picked, a quick note is one block of prose —
      // it goes in as the first section of that structure.
      const order = (SECTIONS_MAP[structure] || []).map((x) => x.id);
      const contents = order.length ? { [order[0]]: content } : {};
      const r = await createNote({
        patient_id: selectedPatient.id,
        structure: structureToWire(structure),
        title: deriveTitle({ structure, order, contents, freeText: content }),
        sections: toWireSections({ structure, order, contents, freeText: content }),
      });
      onClose();
      if (r?.id) navigate(`/scribe/notes/${r.id}`);
    } catch (e) { setError(e); setSaving(false); }
  };

  return (
    <Modal onClose={onClose}>
      <div className="modal-h">
        <h2>{tr(lang, "Швидка нотатка", "Quick note")}</h2>
        <p>
          <kbd>{navigator.platform?.startsWith("Mac") ? "⌘" : "Ctrl"}</kbd>
          <kbd>⇧</kbd>
          <kbd>N</kbd>
        </p>
      </div>

      <div className="modal-body quick-note-overlay">
        <div className="qno-body">
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4, display: "block" }}>
              {tr(lang, "Пацієнт", "Patient")}
            </label>
            <PatientCombobox lang={lang} value={selectedPatient} onSelect={setSelectedPatient} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, display: "block" }}>
              {tr(lang, "Структура", "Structure")}
            </label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {STRUCTURES.map(s => (
                <button key={s.id} className={`section-tab ${structure === s.id ? "active" : ""}`} onClick={() => setStructure(s.id)}>
                  {s[lang] || s.en}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4, display: "block" }}>
              {tr(lang, "Вміст нотатки", "Note content")}
            </label>
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder={tr(lang, "Введіть текст нотатки…", "Enter note content…")} rows={6} />
          </div>
          {error && <div style={{ color: "var(--rec,#dc2626)", fontSize: 13 }}>{error.message || (tr(lang, "Не вдалося зберегти", "Could not save"))}</div>}
        </div>
      </div>

      <div className="modal-foot">
        <button className="btn" onClick={onClose}>{tr(lang, "Відхилити", "Discard")}</button>
        <button className="btn accent" disabled={!selectedPatient || !content.trim() || saving} onClick={handleSave}>
          <Icon name="save" size={13} />
          {saving ? (tr(lang, "Збереження…", "Saving…")) : (tr(lang, "Зберегти", "Save"))}
        </button>
      </div>
    </Modal>
  );
}

// ─── NoteEditorPage ───────────────────────────────────────────────────────────

export function NoteEditorPage({ noteId, patientId, lang, navigate }) {
  const noteReq = useAsync(() => (noteId ? getNote(noteId) : Promise.resolve(null)), [noteId]);
  const note = noteReq.data;
  // A note REQUIRES a patient server-side (NoteCreate.patient_id). Reached
  // without one — /scribe/notes/new straight from the create menu — the page
  // asks for one instead of autosaving into a 422 on every keystroke.
  const [pickedPatient, setPickedPatient] = useState(null);
  const pid = patientId || note?.patient_id || note?.patientId || pickedPatient?.id;
  const patientReq = useAsync(() => (pid ? getPatient(pid) : Promise.resolve(null)), [pid]);
  const patient = patientReq.data;

  const [structure, setStructure] = useState("SOAP");
  const [activeSection, setActiveSection] = useState(SECTIONS_MAP["SOAP"][0].id);
  const [sectionContents, setSectionContents] = useState({});
  const [freeContent, setFreeContent] = useState("");
  const [saveState, setSaveState] = useState("saved");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  // The save error used to be swallowed (`catch { setSaveState("unsaved") }`),
  // which is why this page looked like it worked and saved nothing.
  const [saveError, setSaveError] = useState(null);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const autoSaveRef = useRef(null);
  const noteRef = useRef(noteId || null);

  // Hydrate editor state once an existing note loads.
  useEffect(() => {
    if (!note) return;
    noteRef.current = note.id || noteId || null;
    if (note.structure) {
      // The wire enum is lowercase; the editor's ids are not.
      const ui = structureFromWire(note.structure);
      setStructure(ui);
      setActiveSection(SECTIONS_MAP[ui]?.[0]?.id || "");
    }
    // `sections` is a list of {key, content} — reading it as an object left
    // every field blank when reopening a saved note.
    const hydrated = fromWireSections(note.sections);
    setSectionContents(hydrated.contents);
    setFreeContent(hydrated.freeText);
  }, [note]); // eslint-disable-line

  const sections = SECTIONS_MAP[structure] || [];

  // The debounced save fires ~1.2 s after the last keystroke, and a callback
  // that closed over `sectionContents` reads whatever the state was when that
  // callback was BUILT — i.e. one edit behind. (That is why the last thing
  // typed used to vanish on reload: the save that ran had the previous
  // render's sections.) A ref refreshed every render is the current value.
  const liveRef = useRef({ structure, sectionContents, freeContent, pid });
  useEffect(() => {
    liveRef.current = { structure, sectionContents, freeContent, pid };
  });

  // One place that knows the wire shape: lowercase structure, sections as an
  // ordered list of {key, content}, and a derived title so the notes list is
  // not a column of blanks.
  const wireBody = useCallback(() => {
    const live = liveRef.current;
    const order = (SECTIONS_MAP[live.structure] || []).map((x) => x.id);
    const shape = {
      structure: live.structure,
      order,
      contents: live.sectionContents,
      freeText: live.freeContent,
    };
    return {
      structure: structureToWire(live.structure),
      title: deriveTitle(shape),
      sections: toWireSections(shape),
    };
  }, []);

  const persist = useCallback(async () => {
    const live = liveRef.current;
    // Nothing typed yet, or no patient to attach it to: not an error, just
    // nothing to do. Creating an empty note on mount would litter the roster.
    if (!noteRef.current && (!live.pid || isBlank({
      structure: live.structure, contents: live.sectionContents, freeText: live.freeContent,
    }))) {
      return;
    }
    setSaveState("saving");
    setSaveError(null);
    try {
      if (noteRef.current) {
        await updateNote(noteRef.current, wireBody());
      } else {
        const r = await createNote({ patient_id: live.pid, ...wireBody() });
        noteRef.current = r?.id ?? null;
        // Put the new id in the URL so a reload (or the back button) lands on
        // the saved note rather than a blank "new note" form again.
        if (r?.id && typeof location !== "undefined") {
          history.replaceState(null, "", `#/scribe/notes/${r.id}`);
        }
      }
      setSaveState("saved");
      setLastSavedAt(Date.now());
    } catch (e) {
      setSaveState("unsaved");
      setSaveError(e);
    }
  }, [wireBody]);

  const triggerAutosave = useCallback(() => {
    setSaveState("unsaved");
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => { persist(); }, 1200);
  }, [persist]);

  // A pending edit must not die with the page. Flush on unmount and on tab
  // close — 1.2 s of unsaved typing is a whole section in a busy clinic.
  useEffect(() => {
    const flush = () => { if (autoSaveRef.current) { clearTimeout(autoSaveRef.current); persist(); } };
    window.addEventListener("beforeunload", flush);
    return () => { window.removeEventListener("beforeunload", flush); flush(); };
  }, [persist]);

  // Picking the patient is what unblocks the first save, so save right then
  // rather than waiting for the next keystroke.
  useEffect(() => {
    if (pickedPatient && !noteRef.current) persist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedPatient]);


  const handleSectionChange = (sectionId, value) => {
    setSectionContents(prev => ({ ...prev, [sectionId]: value }));
    triggerAutosave();
  };

  // ── Voice ──────────────────────────────────────────────────────────
  // Dictation lands in whichever section is active, exactly like the Studio.
  // The hook routes its callbacks through refs, so switching section mid-
  // sentence moves the text with it rather than dictating into the section
  // that happened to be open when the mic went on.
  const [dictLang, setDictLang] = useState(lang === "en" ? "en" : "uk");
  const [partial, setPartial] = useState("");
  const appendDictated = useCallback((text) => {
    const chunk = String(text || "").trim();
    if (!chunk) return;
    if (structure === "free") {
      setFreeContent((prev) => (prev ? `${prev} ${chunk}` : chunk));
    } else {
      setSectionContents((prev) => {
        const cur = prev[activeSection] || "";
        return { ...prev, [activeSection]: cur ? `${cur} ${chunk}` : chunk };
      });
    }
    setPartial("");
    triggerAutosave();
  }, [structure, activeSection, triggerAutosave]);

  const speech = useSpeechRecognition({
    lang: dictLang,
    enabled: true,
    onPartial: setPartial,
    onFinal: appendDictated,
  });
  const listening = speech.state === "listening";
  const toggleMic = () => { if (listening) speech.pause(); else speech.start(); };
  const speechLabel = {
    idle: tr(lang, "Готово", "Ready"),
    connecting: tr(lang, "З'єднання…", "Connecting…"),
    listening: tr(lang, "Слухаю…", "Listening…"),
    paused: tr(lang, "Пауза", "Paused"),
    processing: tr(lang, "Обробка…", "Processing…"),
    error_permission: tr(lang, "Немає доступу до мікрофона", "Microphone blocked"),
    error_network: tr(lang, "Помилка мережі", "Network error"),
    error_unsupported: tr(lang, "Диктування не підтримується", "Dictation unsupported"),
  }[speech.state] || speech.state;

  // The mic must not keep running once the note is closed.
  useEffect(() => () => { try { speech.stop?.(); } catch { /* already stopped */ } }, []); // eslint-disable-line

  const handleSign = async () => {
    try {
      if (!noteRef.current) await persist();
      if (!noteRef.current) {
        // persist() refused (no patient, or nothing typed) — say which.
        setToast(!pid
          ? tr(lang, "Спочатку виберіть пацієнта", "Pick a patient first")
          : tr(lang, "Нотатка порожня", "The note is empty"));
        return;
      }
      await signNote(noteRef.current);
      setToast(tr(lang, "Нотатку підписано", "Note signed"));
      noteReq.reload();
    } catch (e) {
      setToast((e && e.message) || (tr(lang, "Не вдалося підписати", "Could not sign")));
    }
  };

  const handlePromote = async (templateId) => {
    const r = await createReport({
      template_id: templateId,
      body: structure === "free" ? { note: freeContent } : sectionContents,
    });
    setPromoteOpen(false);
    if (r?.id) navigate(`/dictate/reports/${r.id}`);
  };

  if (noteId && noteReq.loading) return <div className="page note-editor-page"><Loading lang={lang} /></div>;

  // What the clinician just typed wins over what the server last stored: the
  // header used to say "New note" forever, even after the note had saved.
  const liveTitle = deriveTitle({
    structure,
    order: (SECTIONS_MAP[structure] || []).map((x) => x.id),
    contents: sectionContents,
    freeText: freeContent,
  });
  const title = liveTitle || loc(note?.title, lang) || (tr(lang, "Нова нотатка", "New note"));

  const order = (SECTIONS_MAP[structure] || []).map((x) => x.id);
  const wordCount = (structure === "free"
    ? freeContent
    : order.map((id) => sectionContents[id] || "").join(" ")
  ).trim().split(/\s+/).filter(Boolean).length;
  const activeLabel = structure === "free"
    ? tr(lang, "Нотатка", "Note")
    : (sections.find((x) => x.id === activeSection)?.[lang]
       || sections.find((x) => x.id === activeSection)?.en
       || "");
  const activeText = structure === "free" ? freeContent : (sectionContents[activeSection] || "");
  const setActiveText = (v) => {
    if (structure === "free") { setFreeContent(v); triggerAutosave(); }
    else handleSectionChange(activeSection, v);
  };
  const signed = note?.status === "signed";

  return (
    // Same shell as the dictation Studio: section rail on the left, the
    // writing surface in the middle, the microphone on the right. A note and
    // a dictated report are the same job with a different output.
    <div className="studio note-studio">
      <aside className="left">
        <div className="rail-h">{tr(lang, "Нотатка", "Note")}</div>
        <div className="ns-rail-block">
          <label className="ns-rail-label">{tr(lang, "Структура", "Structure")}</label>
          <MenuSelect
            block
            icon="layers"
            value={structure}
            ariaLabel={tr(lang, "Структура нотатки", "Note structure")}
            options={STRUCTURES.map((x) => ({ value: x.id, label: x[lang] || x.en }))}
            onChange={(v) => {
              setStructure(v);
              setActiveSection(SECTIONS_MAP[v]?.[0]?.id || "");
              triggerAutosave();
            }}
          />
        </div>

        <div className="ns-rail-block">
          <label className="ns-rail-label">{tr(lang, "Розділи", "Sections")}</label>
          <div className="ns-sections">
            {(structure === "free"
              ? [{ id: "note", uk: "Нотатка", en: "Note" }]
              : sections
            ).map((sec) => {
              const text = structure === "free" ? freeContent : (sectionContents[sec.id] || "");
              const filled = !!String(text).trim();
              const isActive = structure === "free" || activeSection === sec.id;
              return (
                <button key={sec.id} type="button"
                        className={"ns-section" + (isActive ? " on" : "") + (filled ? " filled" : "")}
                        onClick={() => structure !== "free" && setActiveSection(sec.id)}>
                  <span className="ns-section-dot" aria-hidden="true" />
                  <span className="ns-section-name">{sec[lang] || sec.en}</span>
                  {filled && <span className="ns-section-count">
                    {String(text).trim().split(/\s+/).filter(Boolean).length}
                  </span>}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <section className="center">
        {/* Context bar — who this note is about, same strip the Studio shows. */}
        <div className="studio-context-bar">
          <button className="tb-back" style={{ marginRight: 2 }}
                  onClick={() => navigate(patient ? `/scribe/patients/${patient.id}` : "/documents/notes")}>
            <Icon name="arrowLeft" size={15} />
          </button>
          <Icon name="fileText" size={14} />
          <span className="scb-name">
            {patient ? patientName(patient, lang) : tr(lang, "Без пацієнта", "No patient")}
          </span>
          {patient?.mrn && <span className="chip">{patient.mrn}</span>}
          <span className="chip">{structure === "free" ? tr(lang, "Вільний текст", "Free text") : structure}</span>
          {signed
            ? <span className="chip signed">{tr(lang, "підписано", "signed")}</span>
            : <span className="chip draft">{tr(lang, "чернетка", "draft")}</span>}
          <div style={{ flex: 1 }} />
          <SaveStatus state={saveState} lastSavedAt={lastSavedAt} />
        </div>

        {!pid && (
          <div className="nep-patient-gate">
            <div>
              <div className="nep-gate-t">{tr(lang, "Для кого ця нотатка?", "Who is this note for?")}</div>
              <div className="nep-gate-s">
                {tr(lang, "Нотатку неможливо зберегти без пацієнта.",
                          "A note cannot be saved without a patient.")}
              </div>
            </div>
            <PatientCombobox lang={lang} value={pickedPatient} onSelect={setPickedPatient} autoFocus />
          </div>
        )}

        {/* Where dictation is landing — the Studio's status strip. */}
        <div className={"ns-dictation-bar" + (listening ? " on" : "")}>
          <Icon name={listening ? "mic" : "keyboard"} size={13} />
          <span>
            {listening
              ? tr(lang, `Диктую в «${activeLabel}»`, `Dictating into “${activeLabel}”`)
              : tr(lang, `Розділ: ${activeLabel}`, `Section: ${activeLabel}`)}
          </span>
          <div style={{ flex: 1 }} />
          <span className="ns-wordcount">{wordCount} {tr(lang, "слів", "words")}</span>
        </div>

        {saveError && (
          <div style={{ padding: "10px 18px 0" }}>
            <ApiErrorView error={saveError} lang={lang} />
          </div>
        )}

        <div className="ns-editor">
          <div className="ns-editor-h">
            <span className="ns-editor-title">{activeLabel}</span>
            {structure !== "free" && (
              <div className="ns-tabs" role="tablist">
                {sections.map((sec) => (
                  <button key={sec.id} type="button" role="tab"
                          aria-selected={activeSection === sec.id}
                          className={"dictate-sec-chip" + (activeSection === sec.id ? " on" : "")}
                          onClick={() => setActiveSection(sec.id)}>
                    {sec.id}
                    {String(sectionContents[sec.id] || "").trim() && <span className="dictate-dot" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <textarea
            className="ns-area"
            value={activeText}
            onChange={(e) => setActiveText(e.target.value)}
            placeholder={listening
              ? tr(lang, "Говоріть — текст з'явиться тут…", "Speak — your words land here…")
              : tr(lang, "Введіть текст або натисніть мікрофон…", "Type, or press the microphone…")}
            aria-label={activeLabel}
          />
          {partial && <div className="dictate-partial ns-partial">{partial}</div>}
        </div>

        <div className="studio-footer">
          <div className="studio-footer-info">
            <div className="sf-progress">
              {structure === "free"
                ? tr(lang, "Вільна нотатка", "Free-text note")
                : tr(lang,
                     `${order.filter((id) => String(sectionContents[id] || "").trim()).length} з ${order.length} розділів заповнено`,
                     `${order.filter((id) => String(sectionContents[id] || "").trim()).length} of ${order.length} sections filled`)}
            </div>
          </div>
          <button className="btn ghost sm" onClick={() => setPromoteOpen(true)}>
            <Icon name="arrowRight" size={13} />
            {tr(lang, "Просунути до звіту", "Promote to report")}
          </button>
          <button className="btn accent" onClick={handleSign} disabled={signed}>
            <Icon name="sign" size={13} />
            {signed ? tr(lang, "Підписано", "Signed") : tr(lang, "Підписати", "Sign & finish")}
          </button>
        </div>
      </section>

      {/* Right rail — the microphone, same control as the Studio's. */}
      <aside className="right">
        <div className="dictate-panel">
          <div className="dictate-h">
            <span className="rail-h" style={{ padding: 0 }}>{tr(lang, "Диктування", "Dictation")}</span>
            <div className="lang-switch" role="tablist" aria-label={tr(lang, "Мова диктування", "Dictation language")}>
              <button type="button" className={dictLang === "uk" ? "on" : ""} onClick={() => setDictLang("uk")}>UK</button>
              <button type="button" className={dictLang === "en" ? "on" : ""} onClick={() => setDictLang("en")}>EN</button>
            </div>
          </div>

          <div className="dictate-mic">
            <button className="mic-btn" data-state={speech.state} onClick={toggleMic}
                    aria-label={speechLabel} aria-pressed={listening}
                    disabled={!speech.supported}>
              <Icon name={speech.state.startsWith("error_") ? "micOff" : listening ? "mic" : speech.state === "paused" ? "pause" : "mic"} size={26} />
            </button>
            <div className="mic-state-label" style={{ fontSize: 12.5 }}>{speechLabel}</div>
            <LevelMeter active={listening} level={speech.level} />
          </div>

          <div className="psub" style={{ fontSize: 11.5, textAlign: "center" }}>
            {speech.supported
              ? tr(lang, "Текст додається до вибраного розділу. Перемикайте розділи під час диктування.",
                         "Speech is appended to the selected section. You can switch sections while dictating.")
              : tr(lang, "Цей браузер не підтримує розпізнавання мовлення.",
                         "This browser has no speech recognition.")}
          </div>
        </div>

        <div className="ns-meta">
          <div className="rail-h">{tr(lang, "Про нотатку", "About")}</div>
          <div className="ns-meta-row">
            <span>{tr(lang, "Назва", "Title")}</span>
            <strong>{title}</strong>
          </div>
          {note?.created_at && (
            <div className="ns-meta-row">
              <span>{tr(lang, "Створено", "Created")}</span>
              <strong>{new Date(note.created_at).toLocaleString(tr(lang, "uk-UA", "en-GB"))}</strong>
            </div>
          )}
          {note?.signed_at && (
            <div className="ns-meta-row">
              <span>{tr(lang, "Підписано", "Signed")}</span>
              <strong>{new Date(note.signed_at).toLocaleString(tr(lang, "uk-UA", "en-GB"))}</strong>
            </div>
          )}
        </div>
      </aside>

      {promoteOpen && <PromoteModal lang={lang} onClose={() => setPromoteOpen(false)} onConfirm={handlePromote} />}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
