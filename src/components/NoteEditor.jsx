// NoteEditor.jsx — Sprint 12: Quick note modal + full clinical note editor
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Icon, Modal, SaveStatus, Toast, Empty } from './UI.jsx';
import { Loading, asList } from './DataStates.jsx';
import { useAsync } from '../api/useAsync.js';
import { listPatients, getPatient } from '../api/patients.js';
import { getNote, createNote, updateNote, signNote } from '../api/notes.js';
import { listTemplates } from '../api/templates.js';
import { createReport } from '../api/reports.js';

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
        <h2>{lang === "uk" ? "Просунути до звіту" : "Promote to report"}</h2>
        <p>{lang === "uk" ? "Нотатка буде перетворена в медичний звіт" : "This note will be promoted to a medical report"}</p>
      </div>
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.65, padding: "12px 14px", background: "var(--accent-soft)", borderRadius: "var(--radius)", borderLeft: "3px solid var(--accent)" }}>
          {lang === "uk"
            ? "Нотатка буде просунута до звіту. Оригінальна нотатка залишається у системі й доступна у вкладці нотаток."
            : "This note will be promoted to a report. The original note remains in the system and is accessible in the notes tab."}
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "var(--text-2)" }}>
          {lang === "uk" ? "Шаблон звіту" : "Report template"}
          <select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)}
            disabled={req.loading || !templates.length}
            style={{ padding: "8px 12px", border: "1px solid var(--line)", borderRadius: "var(--radius)", background: "var(--surface)", fontSize: 13, color: "var(--text-1)" }}>
            {req.loading && <option>{lang === "uk" ? "Завантаження…" : "Loading…"}</option>}
            {!req.loading && !templates.length && <option>{lang === "uk" ? "Немає шаблонів" : "No templates"}</option>}
            {templates.map(t => <option key={t.id} value={t.id}>{loc(t.name, lang)}</option>)}
          </select>
        </label>
        {error && <div style={{ color: "var(--rec,#dc2626)", fontSize: 13 }}>{error.message || (lang === "uk" ? "Помилка" : "Error")}</div>}
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>{lang === "uk" ? "Скасувати" : "Cancel"}</button>
        <button className="btn accent" disabled={!selectedTemplate || busy} onClick={confirm}>
          <Icon name="arrowRight" size={13} />
          {busy ? (lang === "uk" ? "Просування…" : "Promoting…") : (lang === "uk" ? "Просунути" : "Promote")}
        </button>
      </div>
    </Modal>
  );
}

// ─── QuickNoteModal ───────────────────────────────────────────────────────────

export function QuickNoteModal({ lang, navigate, onClose }) {
  const [patientQuery, setPatientQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [structure, setStructure] = useState("free");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const dropdownRef = useRef(null);
  const comboRef = useRef(null);

  const patientsReq = useAsync(() => listPatients({ query: patientQuery || undefined, limit: 6 }), [patientQuery]);
  const filteredPatients = asList(patientsReq.data);

  const selectPatient = (p) => {
    setSelectedPatient(p);
    setPatientQuery(patientName(p, lang));
    setDropdownOpen(false);
  };

  const handleSave = async () => {
    if (!selectedPatient || !content.trim() || saving) return;
    setSaving(true); setError(null);
    try {
      const r = await createNote({ patient_id: selectedPatient.id, structure, title: content.slice(0, 60), sections: { note: content } });
      onClose();
      if (r?.id) navigate(`/scribe/notes/${r.id}`);
    } catch (e) { setError(e); setSaving(false); }
  };

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          comboRef.current && !comboRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <Modal onClose={onClose}>
      <div className="modal-h">
        <h2>{lang === "uk" ? "Швидка нотатка" : "Quick note"}</h2>
        <p>
          <kbd>{navigator.platform?.startsWith("Mac") ? "⌘" : "Ctrl"}</kbd>
          <kbd>⇧</kbd>
          <kbd>N</kbd>
        </p>
      </div>

      <div className="modal-body quick-note-overlay">
        <div className="qno-body">
          <div className="qno-combobox" ref={comboRef}>
            <label style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4, display: "block" }}>
              {lang === "uk" ? "Пацієнт" : "Patient"}
            </label>
            <input
              value={patientQuery}
              onChange={e => { setPatientQuery(e.target.value); setSelectedPatient(null); setDropdownOpen(true); }}
              onFocus={() => setDropdownOpen(true)}
              placeholder={lang === "uk" ? "Пошук пацієнта…" : "Search patient…"}
            />
            {dropdownOpen && filteredPatients.length > 0 && (
              <div className="qno-dropdown" ref={dropdownRef}>
                {filteredPatients.map(p => (
                  <div key={p.id} className={`qno-dropdown-item ${selectedPatient?.id === p.id ? "highlighted" : ""}`}
                    onMouseDown={() => selectPatient(p)}>
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

          <div>
            <label style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, display: "block" }}>
              {lang === "uk" ? "Структура" : "Structure"}
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
              {lang === "uk" ? "Вміст нотатки" : "Note content"}
            </label>
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder={lang === "uk" ? "Введіть текст нотатки…" : "Enter note content…"} rows={6} />
          </div>
          {error && <div style={{ color: "var(--rec,#dc2626)", fontSize: 13 }}>{error.message || (lang === "uk" ? "Не вдалося зберегти" : "Could not save")}</div>}
        </div>
      </div>

      <div className="modal-foot">
        <button className="btn" onClick={onClose}>{lang === "uk" ? "Відхилити" : "Discard"}</button>
        <button className="btn accent" disabled={!selectedPatient || !content.trim() || saving} onClick={handleSave}>
          <Icon name="save" size={13} />
          {saving ? (lang === "uk" ? "Збереження…" : "Saving…") : (lang === "uk" ? "Зберегти" : "Save")}
        </button>
      </div>
    </Modal>
  );
}

// ─── NoteEditorPage ───────────────────────────────────────────────────────────

export function NoteEditorPage({ noteId, patientId, lang, navigate }) {
  const noteReq = useAsync(() => (noteId ? getNote(noteId) : Promise.resolve(null)), [noteId]);
  const note = noteReq.data;
  const pid = patientId || note?.patient_id || note?.patientId;
  const patientReq = useAsync(() => (pid ? getPatient(pid) : Promise.resolve(null)), [pid]);
  const patient = patientReq.data;

  const [structure, setStructure] = useState("SOAP");
  const [activeSection, setActiveSection] = useState(SECTIONS_MAP["SOAP"][0].id);
  const [sectionContents, setSectionContents] = useState({});
  const [freeContent, setFreeContent] = useState("");
  const [saveState, setSaveState] = useState("saved");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const autoSaveRef = useRef(null);
  const noteRef = useRef(noteId || null);

  // Hydrate editor state once an existing note loads.
  useEffect(() => {
    if (!note) return;
    noteRef.current = note.id || noteId || null;
    if (note.structure) {
      setStructure(note.structure);
      setActiveSection(SECTIONS_MAP[note.structure]?.[0]?.id || "");
    }
    if (note.sections && typeof note.sections === "object") {
      setSectionContents(note.sections);
      if (note.sections.note) setFreeContent(note.sections.note);
    }
  }, [note]); // eslint-disable-line

  const sections = SECTIONS_MAP[structure] || [];

  const persist = useCallback(async () => {
    setSaveState("saving");
    const payload = {
      structure,
      sections: structure === "free" ? { note: freeContent } : sectionContents,
    };
    try {
      if (noteRef.current) {
        await updateNote(noteRef.current, payload);
      } else {
        const r = await createNote({ patient_id: pid, ...payload });
        noteRef.current = r?.id ?? null;
      }
      setSaveState("saved");
      setLastSavedAt(Date.now());
    } catch {
      setSaveState("unsaved");
    }
  }, [structure, sectionContents, freeContent, pid]);

  const triggerAutosave = useCallback(() => {
    setSaveState("unsaved");
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => { persist(); }, 1200);
  }, [persist]);

  useEffect(() => () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); }, []);

  const handleSectionChange = (sectionId, value) => {
    setSectionContents(prev => ({ ...prev, [sectionId]: value }));
    triggerAutosave();
  };

  const handleSign = async () => {
    try {
      if (!noteRef.current) await persist();
      if (noteRef.current) await signNote(noteRef.current);
      setToast(lang === "uk" ? "Нотатку підписано" : "Note signed");
      noteReq.reload();
    } catch (e) {
      setToast((e && e.message) || (lang === "uk" ? "Не вдалося підписати" : "Could not sign"));
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

  const title = note ? loc(note.title, lang) : (lang === "uk" ? "Нова нотатка" : "New note");

  return (
    <div className="page note-editor-page">
      <div className="nep-header">
        <button className="tb-back" onClick={() => navigate(patient ? `/scribe/patients/${patient.id}` : "/scribe/notes")}>
          <Icon name="arrowLeft" size={16} />
        </button>
        {patient && (
          <div className="pavatar" style={{ width: 30, height: 30, background: patient.accent || "#0a8a7a", fontSize: 11 }}>
            {patient.initials || autoInitials(patientName(patient, lang))}
          </div>
        )}
        <div className="nep-title">
          {title}
          {patient && (
            <span style={{ fontSize: 13, fontWeight: 400, color: "var(--muted)", marginLeft: 8 }}>
              — {loc(patient.short, lang) || patientName(patient, lang)}
            </span>
          )}
        </div>
        <SaveStatus state={saveState} lastSavedAt={lastSavedAt} />
        <div className="nep-actions">
          <button className="btn ghost sm" onClick={() => setPromoteOpen(true)}>
            <Icon name="arrowRight" size={13} />
            {lang === "uk" ? "Просунути до звіту" : "Promote to report"}
          </button>
          <button className="btn accent" onClick={handleSign}>
            <Icon name="sign" size={13} />
            {lang === "uk" ? "Підписати" : "Sign & finish"}
          </button>
        </div>
      </div>

      <div className="nep-body">
        <div className="structure-picker">
          <label style={{ fontSize: 12, color: "var(--muted)", marginRight: 4 }}>
            {lang === "uk" ? "Структура:" : "Structure:"}
          </label>
          <select value={structure} onChange={e => { setStructure(e.target.value); setActiveSection(SECTIONS_MAP[e.target.value]?.[0]?.id || ""); }}>
            {STRUCTURES.map(s => <option key={s.id} value={s.id}>{s[lang] || s.en}</option>)}
          </select>
          {sections.length > 0 && (
            <div className="section-tabs">
              {sections.map(sec => (
                <button key={sec.id} className={`section-tab ${activeSection === sec.id ? "active" : ""}`} onClick={() => setActiveSection(sec.id)}>
                  {sec[lang] || sec.en}
                </button>
              ))}
            </div>
          )}
        </div>

        {structure === "free" && (
          <div className="note-section-block">
            <div className="nsb-header"><span className="nsb-title">{lang === "uk" ? "Нотатка" : "Note"}</span></div>
            <textarea className="nsb-body" value={freeContent}
              onChange={e => { setFreeContent(e.target.value); triggerAutosave(); }}
              placeholder={lang === "uk" ? "Почніть вводити нотатку…" : "Start typing your note…"} />
          </div>
        )}

        {sections.length > 0 && sections.map(sec => (
          <div key={sec.id} className={`note-section-block ${activeSection === sec.id ? "active-section" : ""}`}>
            <div className="nsb-header" onClick={() => setActiveSection(sec.id)} style={{ cursor: "pointer" }}>
              <span className="nsb-title">{sec[lang] || sec.en}</span>
            </div>
            <textarea className="nsb-body" value={sectionContents[sec.id] || ""}
              onChange={e => handleSectionChange(sec.id, e.target.value)}
              placeholder={lang === "uk" ? `Введіть текст для розділу "${sec.uk}"…` : `Enter ${sec.en} content…`}
              style={{ display: activeSection === sec.id ? "block" : undefined }} />
          </div>
        ))}
      </div>

      {promoteOpen && <PromoteModal lang={lang} onClose={() => setPromoteOpen(false)} onConfirm={handlePromote} />}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
