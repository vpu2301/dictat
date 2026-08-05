// studio/StudioWorkspace.jsx — one room for everything that produces a note.
//
// Before this screen the same clinical act was four screens: /dictate/studio to
// dictate against a template, /dictate/conversation to record the consultation,
// /asr/new + /asr/jobs/:id to upload audio, /documents/* to find any of it
// again. Four routes, four chromes, four ways to lose your place.
//
// Here they are four MODES of one workspace:
//
//   dictate — word by word into the section you selected (Web Speech + voice commands)
//   smart   — talk through the whole note; spoken section names steer it (smartRouting.js)
//   scribe  — the consultation itself, two voices, diarized (dictation-service WS)
//   audio   — a file you already have (asr-service), then assign it to a patient
//
// The surfaces are the SAME components those routes always rendered — the
// workspace owns the chrome (patient, template, microphone, sections, session
// rail) and hands each surface an `embedded` flag so it drops its own copy.
// Nothing here reimplements dictation, consent, autosave or diarization.
//
// One deliberate asymmetry: the dictate/smart surface stays MOUNTED (hidden)
// when you step into a conversation or an upload, because it holds an unsaved
// draft; the conversation and the upload unmount, because they hold a socket
// and a file. `active=false` is what stops the hidden editor from answering the
// space bar or keeping the microphone.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Icon, Empty, Modal, SaveStatus } from "../components/UI.jsx";
import { MenuSelect } from "../components/MenuSelect.jsx";
import { SplitButton } from "../components/SplitButton.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { asList, Loading } from "../components/DataStates.jsx";
import { DictationStudio, LevelMeter } from "../components/Studio.jsx";
import { ConversationRoom } from "../conversation/ConversationRoom.jsx";
import { ScribeConsult } from "../components/Scribe.jsx";
import { AsrSubmitPage } from "../pages/AsrSubmitPage.jsx";
import { AsrJobDetailPage } from "../pages/AsrJobDetailPage.jsx";
import { ASR_ACTIVE } from "../api/asr.js";
import { NoteEditorPage } from "../components/NoteEditor.jsx";
import { useAsync } from "../api/useAsync.js";
import { getPatient, listPatients, yearOfBirth } from "../api/patients.js";
import { createEncounter } from "../api/encounters.js";
import { VisitControls, visitStatusLabel } from "../patients/VisitControls.jsx";
import { dictationOptions, asDictationLang } from "../dictation/languages.js";
import { tr } from "../i18n.js";

import { notifySessionsChanged } from "./SidebarSessions.jsx";
import { studioHref } from "./sessions.js";
import { syncTabs, closeTab, renameTab, paramsOfTab, fallbackTitle, loadTabs, saveTabs } from "./tabs.js";

// ── modes ──────────────────────────────────────────────────────────────

export const MODES = [
  {
    key: "dictate", icon: "keyboard",
    label: (l) => tr(l, "Диктант", "Dictate"),
    hint:  (l) => tr(l, "Слово в слово у вибраний розділ", "Word for word into the selected section"),
  },
  {
    key: "smart", icon: "sparkle",
    label: (l) => tr(l, "Розумний диктант", "Smart dictation"),
    hint:  (l) => tr(l, "Назвіть розділ уголос — текст піде туди", "Say the section out loud — the text lands there"),
  },
  {
    key: "scribe", icon: "users",
    label: (l) => tr(l, "Розмова", "Conversation"),
    hint:  (l) => tr(l, "Запис прийому на два голоси", "The consultation itself, two voices"),
  },
  {
    key: "audio", icon: "audio",
    label: (l) => tr(l, "Аудіо", "Audio"),
    hint:  (l) => tr(l, "Готовий файл → транскрипт → чернетка", "An existing file → transcript → draft"),
  },
  {
    key: "note", icon: "edit",
    label: (l) => tr(l, "Нотатка", "Note"),
    hint:  (l) => tr(l, "Клінічна нотатка — SOAP, APSO, DAP або вільний текст",
                       "A clinical note — SOAP, APSO, DAP or free text"),
  },
];

const ASSIST_KEY = "mdx.studio.assist.v1";
// Which flavour of dictation the clinician used last, so the tab reopens on it.
const DICT_KEY = "mdx.studio.dictation.v1";

const MODE_KEYS = MODES.map((m) => m.key);
export const isStudioMode = (m) => MODE_KEYS.includes(m);
const modeOf = (m) => MODES.find((x) => x.key === m) || MODES[0];
// Both dictation modes are the same surface with different routing.
const isEditorMode = (m) => m === "dictate" || m === "smart";
// …which is why the strip lists DOCUMENTS and the record button's menu picks
// the capture mode: the clinician chooses how the microphone behaves, not
// where they are.

// ── small parts ────────────────────────────────────────────────────────

// A tab's name: who it is about. Deliberately ONLY the patient — the editor's
// snapshot belongs to whichever tab last mounted it (it stays mounted behind
// the others), so borrowing its template name christened three empty tabs
// "Операційний протокол". Without a patient the tab says what kind it is.
function editorContextTitle(patient) {
  return patient?.label || "";
}

// A document's date, spelled out. The year appears only when it is NOT the
// current one — "3 серпня" for this year's work, "12 грудня 2025 р." for an
// old draft, so an out-of-year record cannot be misread as recent.
function fmtDocDate(value, lang) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const locale = lang === "uk" ? "uk-UA" : lang;
  const thisYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(locale, {
    day: "numeric", month: "long", ...(thisYear ? {} : { year: "numeric" }),
  });
}

// The `+` at the end of the tab strip: what KIND of document to start.
// A browser's new-tab button opens a blank page; a clinical workspace has four
// blank pages, and asking which is one click cheaper than starting the wrong
// one and switching.
function NewTabButton({ lang, onPick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`sw-newtab${open ? " open" : ""}`} ref={ref}>
      <button
        type="button"
        className="sw-newtab-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={tr(lang, "Новий документ", "New document")}
        title={tr(lang, "Новий документ", "New document")}
        data-testid="sw-newtab"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="plus" size={14} />
      </button>
      {open && (
        <div className="sw-menu" role="menu">
          <div className="sw-menu-h">{tr(lang, "Новий документ", "New document")}</div>
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              role="menuitem"
              className="sw-menu-row"
              data-testid={`sw-newtab-${m.key}`}
              onClick={() => { setOpen(false); onPick(m.key); }}
            >
              <Icon name={m.icon} size={13} />
              <span className="sw-menu-b">
                <span className="sw-menu-t">{m.label(lang)}</span>
                <span className="sw-menu-h2">{m.hint(lang)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// The recording clock. Owned by the workspace so it survives a mode switch
// and reads the same in every mode.
function Elapsed({ since, lang }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!since) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [since]);
  const s = since ? Math.max(0, Math.floor((Date.now() - since) / 1000)) : 0;
  return (
    <span className="sw-clock" data-testid="sw-clock"
      aria-label={tr(lang, "Тривалість запису", "Recording length")}>
      {`${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`}
    </span>
  );
}

// The input level, sampled per animation frame from the editor's own hook.
// It is read through a ref rather than passed as a prop on purpose: at 60 fps
// a prop would re-render the whole workspace for a moving bar.
function LiveLevel({ apiRef, listening }) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!listening) { setLevel(0); return undefined; }
    let raf = 0;
    const step = () => {
      setLevel(apiRef.current?.level || 0);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [listening, apiRef]);
  return <LevelMeter active={listening} level={level} />;
}

// Patient selection, as a dialog instead of a screen: in this workspace the
// patient is a field of the session, not a gate in front of it.
function PatientPicker({ lang, onPick, onClose }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(id);
  }, [query]);
  const req = useAsync(() => listPatients({ query: debounced || undefined, limit: 30 }), [debounced]);
  const patients = asList(req.data);

  return (
    <Modal onClose={onClose} className="sw-picker">
      <div className="modal-h">
        <h2>{tr(lang, "Оберіть пацієнта", "Choose a patient")}</h2>
        <button className="icon-btn" onClick={onClose} aria-label={tr(lang, "Закрити", "Close")}>
          <Icon name="x" size={14} />
        </button>
      </div>
      <div className="modal-b">
        <div className="search-input">
          <Icon name="search" size={14} />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={tr(lang, "Ім'я, MRN або ІПН…", "Name, MRN or national ID…")}
            aria-label={tr(lang, "Пошук пацієнта", "Search patient")} />
        </div>
        {req.loading && patients.length === 0 && <Loading lang={lang} />}
        {req.error && <ApiErrorView error={req.error} lang={lang} />}
        {!req.loading && !req.error && patients.length === 0 && (
          <Empty icon="users" title={tr(lang, "Нічого не знайдено", "No results")} />
        )}
        {patients.length > 0 && (
          <div className="sw-pickhead" aria-hidden="true">
            <span>{tr(lang, "Пацієнт", "Patient")}</span>
            <span>{tr(lang, "Народження", "Born")}</span>
            <span>MRN</span>
          </div>
        )}
        <ul className="sw-picklist" role="listbox">
          {patients.map((p) => {
            const name = p.name?.[lang] || p.name?.uk || p.name?.en || p.display_name || p.id;
            const yb = yearOfBirth(p);
            // Two people can share a name; the MRN is what tells them apart, so
            // it gets its own column rather than a suffix. When a record has no
            // MRN the system id stands in — truncated on screen, whole in the
            // title, because a 36-char UUID in a picker row is noise.
            const mrn = p.mrn || p.ref || "";
            return (
              <li key={p.id}>
                {/* Same role as the old full-screen gate row (a report is never
                    dictated without a patient), so it keeps the same name. */}
                <button type="button" className="sw-pickrow" data-testid="patient-gate-row"
                  onClick={() => { onPick(p); onClose(); }}>
                  <span className="sw-pickrow-b">
                    <span className="sw-pickrow-name">{name}</span>
                    {p.has_ipn && (
                      <span className="sw-pickrow-tag" title={tr(lang, "Записано ІПН", "National ID on file")}>
                        ІПН
                      </span>
                    )}
                    {p.status && p.status !== "active" && (
                      <span className={`sw-pickrow-tag ${["deceased", "erased"].includes(p.status) ? "warn" : "state"}`}>
                        {p.status}
                      </span>
                    )}
                  </span>
                  <span className="sw-pickrow-dob">
                    {yb ? `${yb}${p.sex ? ` · ${p.sex}` : ""}` : (p.sex || "—")}
                  </span>
                  <span className="sw-pickrow-meta" title={mrn ? undefined : p.id}>
                    {mrn || `${String(p.id).slice(0, 8)}…`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}

// ── the workspace ──────────────────────────────────────────────────────

export function StudioWorkspace({
  lang = "uk", navigate,
  mode: modeProp, patientId, encounterId, templateId, reportId, sessionId, jobId, noteId, tabId,
  templatesMap = {}, onAddTemplate, templatesLoading = false, templatesError = null, onRetryTemplates,
  onToast,
}) {
  const mode = isStudioMode(modeProp) ? modeProp : "dictate";
  // The assist rail (microphone device, suggestions, voice-command reference,
  // autocomplete settings) is open by default — everything the old Studio put
  // there is still one glance away — and collapsible for a document-only view.
  // The choice sticks: it is a working preference, not a per-session mood.
  const [assistOpen, setAssistOpen] = useState(() => {
    try { return localStorage.getItem(ASSIST_KEY) !== "0"; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem(ASSIST_KEY, assistOpen ? "1" : "0"); } catch {}
  }, [assistOpen]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [composer, setComposer] = useState("");
  // Set by the picker, so the header can name the patient before the editor's
  // own fetch resolves; the URL stays the source of truth for the id.
  const [pickedPatient, setPickedPatient] = useState(null);

  // What the editor is doing right now (see DictationStudio's `onSnapshot`).
  const [snap, setSnap] = useState(null);
  // …and what an uploaded file is doing, reported by the ASR page. Kept per
  // tab id so the strip can mark THAT tab as busy, not whichever is on screen.
  const [jobStatusByTab, setJobStatusByTab] = useState({});
  const apiRef = useRef(null);
  // Only the identity of this callback matters to the editor's effect — keep it
  // stable, or the snapshot effect fires on every parent render forever.
  const onSnapshot = useCallback((s) => setSnap(s), []);

  // Everything that changes the workspace goes through the URL: a session is a
  // link a clinician can send to themselves, and the back button has to work.
  // `t` rides along so a navigation stays INSIDE the tab it came from.
  const params = useMemo(() => ({
    mode, patient: patientId, encounter: encounterId, template: templateId,
    report: reportId, session: sessionId, job: jobId, note: noteId, t: tabId,
  }), [mode, patientId, encounterId, templateId, reportId, sessionId, jobId, noteId, tabId]);
  const go = useCallback((patch) => {
    navigate(studioHref({ ...params, ...patch }));
  }, [navigate, params]);

  // ── open documents ───────────────────────────────────────────────────
  // Tabs live in sessionStorage: working state, not a record. What was open is
  // worth surviving a reload; it is not worth outliving the browser tab, and
  // every document in the strip is one click away in the sidebar anyway.
  const [tabState, setTabState] = useState(() => {
    const stored = typeof sessionStorage !== "undefined" ? loadTabs(sessionStorage) : [];
    // Continue the id sequence past whatever was restored, so a new tab can
    // never collide with a stored one.
    const seq = stored.reduce((n, t) => Math.max(n, Number(String(t.id).slice(1)) || 0), 0);
    return { tabs: stored, seq };
  });
  const [activeTab, setActiveTab] = useState(null);

  // The URL is the truth; the strip follows it. Opening a link with no `t`
  // (from the sidebar, a notification, a bookmark) lands in a new tab, exactly
  // like a browser.
  //
  // Guarded by the URL signature rather than done inside a state updater:
  // opening a tab is NOT a pure function of previous state (it mints an id), and
  // React re-invokes effects and updaters — in StrictMode, twice — which minted
  // two tabs for one navigation.
  const tabStateRef = useRef(tabState);
  tabStateRef.current = tabState;
  const lastSyncRef = useRef("");
  useEffect(() => {
    const signature = JSON.stringify({ ...params, t: tabId });
    if (lastSyncRef.current === signature) return;
    lastSyncRef.current = signature;
    const cur = tabStateRef.current;
    const next = syncTabs(cur.tabs, { ...params, t: tabId }, { seq: cur.seq });
    setActiveTab(next.activeId);
    if (next.tabs !== cur.tabs || next.seq !== cur.seq) {
      tabStateRef.current = { tabs: next.tabs, seq: next.seq };
      setTabState(tabStateRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, patientId, encounterId, templateId, reportId, sessionId, jobId, noteId, tabId]);

  // A navigation that arrived without `t` (or with an unknown one) has just
  // been given a tab — put it in the URL so the next navigation stays inside it.
  useEffect(() => {
    if (activeTab && activeTab !== tabId) navigate(studioHref({ ...params, t: activeTab }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (typeof sessionStorage !== "undefined") saveTabs(sessionStorage, tabState.tabs);
  }, [tabState.tabs]);

  // Which dictation flavour the tab (and the record button's menu) offers when
  // the clinician is somewhere else. Sticky, because a doctor who dictates
  // section-by-section should not have to re-choose that every consultation.
  const [dictationMode, setDictationMode] = useState(() => {
    try { return localStorage.getItem(DICT_KEY) === "smart" ? "smart" : "dictate"; }
    catch { return "dictate"; }
  });
  useEffect(() => {
    if (!isEditorMode(mode) || mode === dictationMode) return;
    setDictationMode(mode);
    try { localStorage.setItem(DICT_KEY, mode); } catch {}
  }, [mode, dictationMode]);

  // The editor is kept alive across mode switches once it has been opened —
  // it holds a draft. `everEditor` is what makes "hidden, not unmounted" work.
  const [everEditor, setEverEditor] = useState(isEditorMode(mode));
  useEffect(() => { if (isEditorMode(mode)) setEverEditor(true); }, [mode]);

  // Recording clock: started when the editor's mic goes live, cleared when it
  // stops. Conversation mode runs its own clock (it owns the socket's start).
  const listening = snap?.micState === "listening";
  const [recSince, setRecSince] = useState(null);
  useEffect(() => {
    setRecSince((cur) => (listening ? (cur || Date.now()) : null));
  }, [listening]);

  // The header names the patient in EVERY mode, and only the dictation modes
  // mount the editor that resolves them — so the workspace resolves its own.
  // A reopened draft is the exception: its patient comes from the report
  // envelope, which only the editor has, hence the snapshot fallback.
  const patientReq = useAsync(
    () => (patientId ? getPatient(patientId) : Promise.resolve(null)),
    [patientId],
    { enabled: !!patientId },
  );
  const patient = useMemo(() => {
    // `useAsync` keeps its last data when disabled, so a tab with no patient
    // would inherit the previous tab's — and name itself after them. Only a
    // record that IS this tab's patient counts.
    const p = patientReq.data && patientReq.data.id === patientId ? patientReq.data : null;
    if (p) {
      return {
        id: p.id,
        label: p.name?.[lang] || p.name?.uk || p.name?.en || p.display_name || p.id,
        dob: p.dob,
      };
    }
    if (pickedPatient && pickedPatient.id === patientId) {
      return {
        id: pickedPatient.id,
        label: pickedPatient.name?.[lang] || pickedPatient.name?.uk || pickedPatient.name?.en || pickedPatient.id,
        dob: pickedPatient.dob,
      };
    }
    return snap?.patient || null;
  }, [patientReq.data, pickedPatient, patientId, snap?.patient, lang]);
  const yob = yearOfBirth(patient);

  // Nothing to open and nobody to open it for: the picker IS the old patient
  // gate, moved from a screen into a dialog. Asked once PER TAB — every new
  // document needs its own answer (that is the point of a second tab), and a
  // clinician who dismissed it is not asked the same question twice.
  const askedTabsRef = useRef(new Set());
  useEffect(() => {
    if (!activeTab || askedTabsRef.current.has(activeTab)) return;
    if (mode === "audio") return;            // an upload has no patient yet
    if (patientId || reportId || jobId || sessionId || noteId) return;
    askedTabsRef.current.add(activeTab);
    setPickerOpen(true);
  }, [activeTab, mode, patientId, reportId, jobId, sessionId, noteId]);

  const templateOptions = useMemo(
    () => Object.values(templatesMap).map((t) => ({
      value: t.id, label: t.name?.[lang] || t.name?.en || t.code || t.id,
    })),
    [templatesMap, lang],
  );

  const setJobStatus = useCallback((status) => {
    setJobStatusByTab((cur) => {
      const key = activeTab;
      if (!key || cur[key] === status) return cur;
      return { ...cur, [key]: status };
    });
  }, [activeTab]);
  const busyTab = (tab) => ASR_ACTIVE.has(jobStatusByTab[tab.id] || "");

  // ── tab actions ──────────────────────────────────────────────────────
  // A new tab is a new document: the patient does NOT carry over. Two
  // consultations open at once is the whole point, and inheriting the last
  // patient is how the wrong record gets written.
  const openNewTab = useCallback((nextMode) => {
    navigate(studioHref({ mode: nextMode }));
  }, [navigate]);

  const onCloseTab = useCallback((id) => {
    setTabState((cur) => {
      const { tabs, next } = closeTab(cur.tabs, id);
      // Closing the tab you are in moves you to its neighbour; closing the last
      // one leaves an empty strip and a blank dictation, not a blank screen.
      if (id === activeTab) {
        navigate(next ? studioHref(paramsOfTab(next)) : studioHref({ mode: dictationMode }));
      }
      return { ...cur, tabs };
    });
  }, [activeTab, navigate, dictationMode]);

  // What the strip calls this tab: the patient, else the document's own title,
  // else what kind of document it is. Named from the editor's snapshot, so a
  // tab renames itself the moment the patient is chosen.
  const activeTabTitle = editorContextTitle(patient);
  useEffect(() => {
    if (!activeTab || !activeTabTitle) return;
    setTabState((cur) => {
      const tabs = renameTab(cur.tabs, activeTab, activeTabTitle);
      return tabs === cur.tabs ? cur : { ...cur, tabs };
    });
  }, [activeTab, activeTabTitle]);

  // ── actions ──────────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    // Outside the dictation modes there is no editor to dictate into — the
    // button carries you to the flavour you last used instead of pretending.
    if (!isEditorMode(mode)) { go({ mode: dictationMode }); return; }
    apiRef.current?.toggleMic();
  }, [mode, dictationMode, go]);

  const [startingVisit, setStartingVisit] = useState(false);
  const [visitError, setVisitError] = useState(null);
  const startVisit = useCallback(async () => {
    if (!patientId || startingVisit) return;
    setStartingVisit(true);
    setVisitError(null);
    try {
      const enc = await createEncounter(patientId, { kind: "visit", reason: "", status: "in_progress" });
      go({ encounter: enc.id });
    } catch (e) {
      setVisitError(e);
    } finally {
      setStartingVisit(false);
    }
  }, [patientId, startingVisit, go]);

  const sendComposer = useCallback(() => {
    const text = composer.trim();
    if (!text) return;
    if (apiRef.current?.insertText(text)) setComposer("");
  }, [composer]);

  const dictateItems = MODES.map((m) => ({
    key: m.key,
    label: m.label(lang),
    icon: m.icon,
    hint: m.hint(lang),
    active: m.key === mode,
    onSelect: () => go({ mode: m.key }),
  }));

  // ── surfaces ─────────────────────────────────────────────────────────
  const editorSurface = everEditor ? (
    <div className="sw-pane" hidden={!isEditorMode(mode)} key="editor">
      <DictationStudio
        embedded
        active={isEditorMode(mode)}
        smart={mode === "smart"}
        assistOpen={assistOpen}
        apiRef={apiRef}
        onSnapshot={onSnapshot}
        onRequestPatient={() => setPickerOpen(true)}
        onReportCreated={notifySessionsChanged}
        onEncounterChanged={(id) => go({ encounter: id })}
        lang={lang}
        patientId={patientId}
        encounterId={encounterId}
        initialTemplateId={templateId}
        reportId={reportId}
        templatesMap={templatesMap}
        onAddTemplate={onAddTemplate}
        templatesLoading={templatesLoading}
        templatesError={templatesError}
        onRetryTemplates={onRetryTemplates}
      />
    </div>
  ) : null;

  let modeSurface = null;
  if (mode === "scribe") {
    modeSurface = sessionId
      ? <ScribeConsult id={sessionId} patientHint={patientId} navigate={navigate} lang={lang} />
      // A conversation is always recorded against an open visit (the backend
      // refuses otherwise — `encounter_closed`). Starting one used to mean
      // leaving for the patient record and coming back; the visit is one
      // field, so it is one button.
      : (patientId && !encounterId) ? (
        <div className="sw-gate">
          <Empty icon="calendar"
            title={tr(lang, "Потрібен відкритий прийом", "An open visit is required")}
            body={tr(lang,
              "Розмова записується в межах прийому — почніть його тут, щоб запис прив'язався до візиту.",
              "A conversation is recorded against a visit — start one here so the recording is filed against it.")}
            action={
              <button className="btn accent" disabled={startingVisit} data-testid="sw-start-visit"
                onClick={startVisit}>
                {startingVisit
                  ? tr(lang, "Створення…", "Creating…")
                  : tr(lang, "Почати прийом", "Start the visit")}
              </button>
            } />
          {visitError && <ApiErrorView error={visitError} lang={lang} />}
        </div>
      ) : (
        <ConversationRoom
          embedded
          lang={lang}
          patientId={patientId}
          encounterId={encounterId}
          navigate={navigate}
          onDraft={(report) => {
            notifySessionsChanged();
            navigate(studioHref({ mode: "dictate", patient: patientId, encounter: encounterId, report: report.id }));
          }}
        />
      );
  } else if (mode === "note") {
    // The note editor is the same three-column shell as the dictation Studio
    // (its own structure rail, its own microphone), so it drops straight in.
    // The patient comes from the workspace, so its internal gate never has to
    // ask a question the header already answers.
    modeSurface = (
      <NoteEditorPage
        embedded
        noteId={noteId}
        patientId={patientId}
        lang={lang}
        navigate={navigate}
        onNoteCreated={(id) => { notifySessionsChanged(); go({ note: id }); }}
      />
    );
  } else if (mode === "audio") {
    modeSurface = jobId
      ? (
        <AsrJobDetailPage
          embedded
          id={jobId}
          lang={lang}
          navigate={navigate}
          onToast={onToast}
          onStatus={setJobStatus}
          onAssigned={(report) => {
            notifySessionsChanged();
            navigate(studioHref({ mode: "dictate", patient: report.patient_id || patientId, report: report.id }));
          }}
        />
      )
      : (
        <AsrSubmitPage
          embedded
          lang={lang}
          navigate={navigate}
          onToast={onToast}
          encounterId={encounterId}
          onQueued={(job) => { notifySessionsChanged(); go({ job: job.id }); }}
        />
      );
  }

  // ── header bits ──────────────────────────────────────────────────────
  // Which day this document belongs to: the report's own date, else the visit
  // it was recorded during, else — for a dictation that is starting now — today.
  // Only the editor knows a document's date, and it stays MOUNTED behind the
  // other modes — so its snapshot must not be read while an upload or a past
  // recording is on screen, or July's job inherits the draft's date.
  const editorContext = isEditorMode(mode) || !!reportId;
  const docDateValue = editorContext
    ? (snap?.docDate || snap?.encounter?.occurred_at || snap?.encounter?.started_at || null)
    : null;
  const docDateLabel = fmtDocDate(docDateValue, lang);
  const docDateTitle = docDateValue
    ? tr(lang, "Дата документа", "Document date")
    : tr(lang, "Сьогодні", "Today");
  // Today is the honest answer only for a document being made NOW. Opening a
  // past upload or a finished recording, the workspace has no date of its own —
  // the surface below carries the real timestamps, so the chip stays away
  // rather than stamping today's date on July's work.
  const showDate = editorContext || (!jobId && !sessionId);

  const sections = snap?.sections || [];
  const composerDisabled = !isEditorMode(mode) || !snap?.activeId;
  const activeSectionName = sections.find((s) => s.id === snap?.activeId)?.name || "";

  return (
    <div className="sw" data-testid="studio-workspace" data-mode={mode}>
      {/* No session rail here: the work list lives in the app sidebar
          (studio/SidebarSessions.jsx), so it is reachable from every screen and
          this one is nothing but the document. */}
      <main className="sw-main">
        <header className="sw-head">
          {/* Who and which visit — the two facts that must be on screen the
              whole time a recording can start. The old Studio called this the
              context bar; the name (and the test id) travel with the job.
              Identity budget is unchanged: display name + year of birth, never
              the full date of birth and never the MRN — this screen can face
              the patient. */}
          <div className="sw-head-ctx"
            data-testid={patient ? "studio-context-bar" : undefined}>
          <div className="sw-head-1">
            <button type="button" className="sw-patient" data-testid="sw-patient"
              onClick={() => setPickerOpen(true)}>
              <Icon name="user" size={14} />
              <span className="sw-patient-name">
                {patient?.label || tr(lang, "Оберіть пацієнта", "Choose a patient")}
              </span>
              {yob != null && (
                <span className="sw-patient-yob">{tr(lang, `нар. ${yob}`, `b. ${yob}`)}</span>
              )}
              <Icon name="chevDown" size={12} className="muted" />
            </button>

            {/* Mis-selection is the top real-world error, and undoing it has to
                be one click BEFORE anything is dictated. Once the document has
                content the offer goes away — switching patients under a written
                record is not an escape, it is a new document. */}
            {patient && snap?.canEscape && (
              <button type="button" className="sw-escape"
                onClick={() => navigate("/patients")}>
                {tr(lang, "Неправильний пацієнт?", "Wrong patient?")}
              </button>
            )}

            <div className="sw-head-sp" />

            {isEditorMode(mode) && (
              <SaveStatus state={snap?.saveState || "saved"} lastSavedAt={snap?.lastSavedAt} />
            )}

            <button
              type="button"
              className={`sw-iconbtn${assistOpen ? " on" : ""}`}
              aria-pressed={assistOpen}
              title={tr(lang, "Панель підказок", "Assist panel")}
              onClick={() => setAssistOpen((v) => !v)}
            >
              <Icon name="sliders" size={14} />
            </button>

            <button
              type="button"
              className="btn"
              data-testid="sw-create"
              disabled={!isEditorMode(mode) || !snap?.total}
              onClick={() => apiRef.current?.complete()}
              title={tr(lang, "Переглянути та завершити документ", "Review and complete the document")}
            >
              <Icon name="fileText" size={13} />
              <span>{tr(lang, "Створити", "Create")}</span>
            </button>

            {/* The language you dictate IN belongs next to the button that
                starts dictating — not in the document's meta line, where it
                read as a property of the report. Just the code: the full name
                lives in the menu, where the choice is made. */}
            {isEditorMode(mode) && (
              <span className="sw-lang">
                <MenuSelect
                  value={snap?.dictLang || asDictationLang(lang)}
                  onChange={(v) => apiRef.current?.setDictLang(v)}
                  ariaLabel={tr(lang, "Мова диктування", "Dictation language")}
                  options={dictationOptions(lang, { short: true })}
                />
              </span>
            )}

            {/* The record control. `data-state` is the recogniser's own state,
                so anything watching the microphone (tests, the consent gate's
                assertions, a future global recording indicator) reads it from
                the control the clinician actually presses. */}
            <SplitButton
              variant="accent"
              placement="down"
              mainProps={{ "data-testid": "studio-mic", "data-state": snap?.micState || "idle" }}
              icon={listening ? "pause" : "mic"}
              label={listening
                ? tr(lang, "Пауза", "Pause")
                : isEditorMode(mode) ? tr(lang, "Диктувати", "Dictate") : tr(lang, "До диктанту", "To dictation")}
              onClick={toggleMic}
              menuLabel={tr(lang, "Режим запису", "Capture mode")}
              items={dictateItems}
            />
          </div>

          <div className="sw-head-2">
            {/* The DOCUMENT's date, not the clock's: a draft reopened three
                weeks later still belongs to the day of the visit. Falls back to
                the encounter, then to today for a dictation that starts now. */}
            {showDate && (
              <span className="sw-meta" title={docDateTitle} data-testid="sw-date">
                <Icon name="calendar" size={12} />
                {docDateLabel}
              </span>
            )}

            {snap?.encounter && (
              <>
                <span className="sw-meta-sep" />
                <span className="sw-meta" data-testid="sw-encounter">
                  {snap.encounter.reason || tr(lang, "Прийом", "Encounter")}
                  {` · ${visitStatusLabel(snap.encounter.status, lang)}`}
                </span>
                {/* A consultation that is over must be closeable from where it
                    was recorded — otherwise finished visits stay open forever. */}
                <VisitControls
                  compact
                  encounter={snap.encounter}
                  lang={lang}
                  onChanged={() => apiRef.current?.reloadEncounter?.()}
                />
              </>
            )}

            {isEditorMode(mode) && (
              <>
                <span className="sw-meta-sep" />
                <MenuSelect
                  icon="fileText"
                  value={snap?.templateId || templateId || ""}
                  onChange={(v) => apiRef.current?.switchTemplate(v)}
                  placeholder={tr(lang, "Шаблон", "Template")}
                  ariaLabel={tr(lang, "Шаблон звіту", "Report template")}
                  options={templateOptions}
                />
                {snap?.total > 0 && (
                  <span className="sw-progress" title={tr(lang, "Заповнені розділи", "Completed sections")}>
                    {snap.done}/{snap.total}
                  </span>
                )}
              </>
            )}

            <div className="sw-head-sp" />

            {listening && (
              <span className="sw-rec" data-testid="sw-recording">
                <i className="sw-rec-dot" />
                {tr(lang, "Запис", "Recording")}
              </span>
            )}
            {isEditorMode(mode) && <Elapsed since={recSince} lang={lang} />}
            {isEditorMode(mode) && <LiveLevel apiRef={apiRef} listening={listening} />}
          </div>
          </div>

          {/* Open documents. Each tab is one thing being worked on; `+` starts
              another and asks what kind. The capture mode of the ACTIVE tab is
              switched from the record button's menu, so the strip stays a list
              of documents rather than a list of settings. */}
          <div className="sw-tabsrow">
          <div className="sw-tabs" role="tablist" aria-label={tr(lang, "Відкриті документи", "Open documents")}>
            {tabState.tabs.map((t) => {
              const isActive = t.id === activeTab;
              const label = t.title || fallbackTitle(t, lang);
              const busy = busyTab(t);
              return (
                <span key={t.id} className={`sw-tab${isActive ? " on" : ""}${busy ? " busy" : ""}`}
                  title={busy ? tr(lang, "Триває розпізнавання", "Transcription in progress") : undefined}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className="sw-tab-main"
                    data-testid="sw-doc-tab"
                    title={label}
                    onClick={() => navigate(studioHref(paramsOfTab(t)))}
                  >
                    {busy
                      ? <i className="sw-tab-busy" aria-hidden="true" />
                      : <Icon name={modeOf(t.mode).icon} size={13} />}
                    <span className="sw-tab-l">{label}</span>
                  </button>
                  <button
                    type="button"
                    className="sw-tab-x"
                    aria-label={tr(lang, "Закрити", "Close")}
                    data-testid="sw-tab-close"
                    onClick={(e) => { e.stopPropagation(); onCloseTab(t.id); }}
                  >
                    <Icon name="x" size={11} />
                  </button>
                </span>
              );
            })}
          </div>
            {/* Outside the scroller on purpose: `overflow-x` on the strip clips
                vertically too, which ate the menu this button opens. */}
            <NewTabButton lang={lang} onPick={openNewTab} />
            <div className="sw-head-sp" />
            <span className="sw-tabs-hint">{modeOf(mode).hint(lang)}</span>
          </div>

          {/* No section strip. The document itself is the list of sections —
              clicking into one selects it — and a second copy of that list
              above the page was chrome competing with the record. Which
              section dictation lands in is said where it matters: in the
              composer's placeholder, and by the caret. */}
        </header>

        <div className="sw-surface">
          {editorSurface}
          {!isEditorMode(mode) && <div className="sw-pane" key={mode}>{modeSurface}</div>}
        </div>

        <div className="sw-composer">
          <Icon name="edit" size={14} className="muted" />
          <input
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendComposer(); } }}
            disabled={composerDisabled}
            data-testid="sw-composer"
            aria-label={tr(lang, "Додати текст у розділ", "Add text to the section")}
            placeholder={composerDisabled
              ? (mode === "scribe"
                  ? tr(lang, "Під час розмови текст пишуть голоси — не клавіатура", "During a conversation the voices write the text, not the keyboard")
                  : mode === "audio"
                    ? tr(lang, "Завантажте аудіо — транскрипт з'явиться у документі", "Upload audio — the transcript lands in the document")
                    : tr(lang, "Оберіть розділ, щоб писати", "Pick a section to write into"))
              : tr(lang, `Написати в «${activeSectionName}» — або натисніть мікрофон`,
                         `Write into "${activeSectionName}" — or press the microphone`)}
          />
          <button type="button" className="sw-iconbtn"
            aria-label={tr(lang, "Мікрофон", "Microphone")}
            data-testid="sw-composer-mic"
            onClick={toggleMic}>
            <Icon name={listening ? "pause" : "mic"} size={14} />
          </button>
          <button type="button" className="sw-send" disabled={composerDisabled || !composer.trim()}
            aria-label={tr(lang, "Додати", "Add")} onClick={sendComposer}>
            <Icon name="arrowRight" size={14} />
          </button>
        </div>
      </main>

      {pickerOpen && (
        <PatientPicker
          lang={lang}
          onClose={() => setPickerOpen(false)}
          onPick={(p) => {
            setPickedPatient(p);
            // A new patient means a new document — the report/job/session in
            // the URL belonged to the previous one. It stays in THIS tab
            // though: `t` is who is asking, not what they are holding.
            navigate(studioHref({ mode, patient: p.id, t: activeTab || undefined }));
          }}
        />
      )}
    </div>
  );
}
