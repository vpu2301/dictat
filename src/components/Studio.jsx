// Studio.jsx — Dictation Studio (TipTap editor, Sprint 06+)
// Replaces the contenteditable editor from sprint 5 with the TipTap
// section-aware document model. Voice commands, signing flow (Sprint 09),
// and autocomplete (Sprint 10) are wired here.

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useI18n } from '../i18n.js';
import { Icon, SaveStatus, Modal, Toast, Empty } from './UI.jsx';
import { TipTapEditor, bodyToDoc, docToBody } from './TipTapEditor.jsx';
import { SigningFlow } from './SigningFlow.jsx';
import { useAsync } from '../api/useAsync.js';
import { listTemplates, createTemplate } from '../api/templates.js';
import { createReport, updateReport } from '../api/reports.js';
import { matchVoiceCommand, insertionFor } from '../dictation/voiceCommands.js';
import {
  AutocompletePills,
  AutocompletePauseToast,
  AutocompleteSettings,
  usePillSuggestions,
  useGhostText,
  useBackoff,
} from './AutocompletePanel.jsx';

// ── Web Speech wrapper ─────────────────────────────────────────────────
function useSpeechRecognition({ lang, onPartial, onFinal, enabled }) {
  const [state, setState] = useState("idle");
  const [level, setLevel] = useState(0);
  const recogRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const wantRef = useRef(false);
  const restartTimerRef = useRef(0);

  const SR = typeof window !== "undefined"
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;
  const supported = !!SR;

  const startMeter = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        if (!analyserRef.current) return;
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        setLevel(Math.min(1, rms * 5));
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
      return true;
    } catch { return false; }
  }, []);

  const stopMeter = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    setLevel(0);
  }, []);

  const buildRecognizer = useCallback(() => {
    if (!SR) return null;
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = lang === "uk" ? "uk-UA" : "en-US";
    r.onresult = (ev) => {
      let interim = "", final = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        const txt = res[0].transcript;
        if (res.isFinal) final += txt;
        else interim += txt;
      }
      if (interim) onPartial?.(interim);
      if (final) {
        onFinal?.(final, ev.results[ev.resultIndex]?.[0]?.confidence ?? 0.85);
        onPartial?.("");
      }
    };
    r.onerror = (ev) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        wantRef.current = false; setState("error_permission");
      } else if (ev.error === "network") {
        setState("error_network");
      }
    };
    r.onend = () => {
      if (wantRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => { try { r.start(); } catch {} }, 80);
      } else {
        setState(s => s === "processing" ? "idle" : s);
      }
    };
    r.onstart = () => setState("listening");
    return r;
  }, [SR, lang, onPartial, onFinal]);

  const start = useCallback(async () => {
    if (!supported) { setState("error_unsupported"); return; }
    setState("connecting");
    wantRef.current = true;
    const ok = await startMeter();
    if (!ok) { setState("error_permission"); wantRef.current = false; return; }
    const r = buildRecognizer();
    recogRef.current = r;
    try { r.start(); } catch {}
  }, [supported, startMeter, buildRecognizer]);

  const stop = useCallback(() => {
    wantRef.current = false;
    setState("processing");
    if (recogRef.current) try { recogRef.current.stop(); } catch {}
    stopMeter();
    setTimeout(() => setState(s => s === "processing" ? "idle" : s), 400);
  }, [stopMeter]);

  const pause = useCallback(() => {
    wantRef.current = false;
    if (recogRef.current) try { recogRef.current.stop(); } catch {}
    setState("paused");
  }, []);

  useEffect(() => () => {
    wantRef.current = false;
    if (recogRef.current) try { recogRef.current.stop(); } catch {}
    stopMeter();
    clearTimeout(restartTimerRef.current);
  }, [stopMeter]);

  return { state, level, supported, start, stop, pause, setState };
}

// ── Mic card ───────────────────────────────────────────────────────────
function MicCard({ state, level, dictLang, setDictLang, onClick, hotkey }) {
  const { t } = useI18n();
  const labels = {
    idle: t("mic.idle"), connecting: t("mic.connecting"), listening: t("mic.listening"),
    paused: t("mic.paused"), processing: t("mic.processing"),
    error_permission: t("mic.error_permission"), error_network: t("mic.error_network"),
    error_unsupported: t("mic.error_unsupported"),
  };
  const helps = {
    idle: t("mic.idle.help", { key: hotkey }),
    connecting: t("mic.connecting.help"),
    listening: t("mic.listening.help", { key: hotkey }),
    paused: t("mic.paused.help", { key: hotkey }),
    processing: t("mic.processing.help"),
    error_permission: t("mic.error_permission.help"),
    error_network: t("mic.error_network.help"),
    error_unsupported: t("mic.error_unsupported.help"),
  };
  const iconFor = { idle: "mic", listening: "mic", paused: "pause", processing: "refresh",
    connecting: "refresh", error_permission: "micOff", error_network: "micOff", error_unsupported: "micOff" }[state] || "mic";
  return (
    <div className="mic-card">
      <div className="lang-tag" style={{ width: "100%" }}>
        <Icon name="flag" size={11} />
        <span>{t("mic.lang")}</span>
        <div className="spacer" style={{ flex: 1 }} />
        <div className="lang-switch" role="tablist" aria-label="Dictation language" style={{ marginLeft: "auto", padding: 2 }}>
          <button type="button" className={dictLang === "uk" ? "on" : ""} onClick={() => setDictLang("uk")}>UK</button>
          <button type="button" className={dictLang === "en" ? "on" : ""} onClick={() => setDictLang("en")}>EN</button>
        </div>
      </div>
      <button className="mic-btn" data-state={state} onClick={onClick}
              aria-label={labels[state]} aria-pressed={state === "listening"}>
        <Icon name={iconFor} size={32} />
      </button>
      <div className="mic-state-label">{labels[state]}</div>
      <div className="mic-help"
           dangerouslySetInnerHTML={{ __html: helps[state].replace(/\b(Space|Пробіл|Esc)\b/g, '<kbd class="kbd">$1</kbd>') }} />
      <LevelMeter active={state === "listening"} level={level} />
    </div>
  );
}

function LevelMeter({ active, level }) {
  const bars = 20;
  return (
    <div className={"level-meter" + (active ? " on" : "")}>
      {Array.from({ length: bars }).map((_, i) => {
        const distance = Math.abs(i - bars / 2 + 0.5) / (bars / 2);
        const localBoost = active ? Math.max(0.06, level * (1 - distance * 0.55)) : 0.06;
        const noise = active ? (0.92 + Math.random() * 0.16) : 1;
        const h = Math.max(2, 18 * localBoost * noise);
        return (
          <span key={i} style={{
            height: `${h}px`,
            background: active ? `var(--accent)` : undefined,
            opacity: active ? 0.4 + level * 0.6 : 0.4,
          }} />
        );
      })}
    </div>
  );
}

// ── Suggestions panel (old Layer B, kept for right rail) ──────────────
function SuggestionsPanel({ suggestions, onAccept }) {
  const { t } = useI18n();
  if (!suggestions || !suggestions.length) {
    return (
      <div className="suggestions">
        <div className="sug-h">
          <span className="sug-title">{t("sug.title")}</span>
          <span className="muted" style={{ fontSize: 11 }}>{t("sug.tabHint", { key: "Tab" })}</span>
        </div>
        <div className="muted" style={{ fontSize: 12, padding: "20px 4px", textAlign: "center" }}>—</div>
      </div>
    );
  }
  return (
    <div className="suggestions">
      <div className="sug-h">
        <span className="sug-title">{t("sug.title")}</span>
        <span className="muted" style={{ fontSize: 11, display: "inline-flex", gap: 4, alignItems: "center" }}>
          <span className="kbd">Tab</span>
          {t("sug.tabHint", { key: "" }).replace(/^[  ]+/, "")}
        </span>
      </div>
      {suggestions.map((s, i) => (
        <div key={s.id} className="suggestion" onClick={() => onAccept(s, i)}>
          <span className="sug-rank">{i === 0 ? "Tab" : `Alt+${i + 1}`}</span>
          <div className="sug-text" dangerouslySetInnerHTML={{ __html: s.text.replace(/\{(\w+)\}/g, '<mark>$1</mark>') }} />
          <div className="sug-meta">
            <span>{t(`sug.source.${s.source}`)}</span>
            <span className="conf"><i style={{ width: `${Math.round(s.confidence * 100)}%` }} /></span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Voice command ref ──────────────────────────────────────────────────
function VoiceCommandRef() {
  const { t } = useI18n();
  const cmds = [
    ["cmd.newPara","↵"],["cmd.newLine","⇧↵"],["cmd.comma",","],["cmd.period","."],
    ["cmd.question","?"],["cmd.dash","—"],["cmd.goTo","→"],["cmd.undo","⌘Z"],
    ["cmd.save","⌘S"],["cmd.stop","Esc"],
  ];
  return (
    <details className="cmd-ref" open>
      <summary>
        <Icon name="chevRight" size={11} className="chev" />
        {t("cmd.ref")}
      </summary>
      <div className="cmd-list">
        {cmds.map(([key, eq]) => (
          <div className="cmd-row" key={key}>
            <span className="phrase">"{t(key)}"</span>
            <span className="action mono">{eq}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

// ── Add Template Dialog ────────────────────────────────────────────────
function AddTemplateDialog({ onClose, onCreate }) {
  const { t, lang } = useI18n();
  const [nameUk, setNameUk] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [code, setCode] = useState("");
  const [specialty, setSpecialty] = useState("radiology");
  const [icon, setIcon] = useState("fileText");
  const [sections, setSections] = useState([
    { uk: "Показання", en: "Indication", required: true },
    { uk: "Висновок", en: "Impression", required: true },
  ]);
  const setSection = (i, k, v) => setSections(arr => arr.map((s, idx) => idx === i ? { ...s, [k]: v } : s));
  const addSection    = () => setSections(arr => [...arr, { uk: "", en: "", required: false }]);
  const removeSection = (i) => setSections(arr => arr.filter((_, idx) => idx !== i));
  const valid = (nameUk.trim() || nameEn.trim()) && code.trim() && sections.every(s => (s.uk.trim() || s.en.trim()));
  const submit = () => {
    if (!valid) return;
    const id = "tpl-" + Date.now().toString(36);
    const tpl = {
      id, specialty, icon,
      name: { uk: nameUk.trim() || nameEn.trim(), en: nameEn.trim() || nameUk.trim() },
      code: code.trim().toUpperCase(),
      sections: sections.map((s, i) => {
        const uk = s.uk.trim() || s.en.trim();
        const en = s.en.trim() || s.uk.trim();
        return {
          id: en.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `sec-${i}`,
          required: !!s.required,
          anchor: { uk: uk.toLowerCase(), en: en.toLowerCase() },
          name: { uk, en },
        };
      }),
    };
    onCreate(tpl);
  };
  const iconOpts = ["fileText", "scan", "heart", "scalpel", "bone"];
  const specOpts = ["radiology", "cardiology", "cardiacSurgery", "orthopaedics"];
  return (
    <Modal onClose={onClose}>
      <div className="modal-h">
        <h2>{t("tpl.addTitle")}</h2>
        <p>{t("tpl.addSub")}</p>
      </div>
      <div className="modal-body addtpl">
        <div className="addtpl-row two">
          <label>
            <span>{t("tpl.nameUk")}</span>
            <input className="ti" value={nameUk} onChange={e => setNameUk(e.target.value)} placeholder={t("tpl.nameUk.ph")} />
          </label>
          <label>
            <span>{t("tpl.nameEn")}</span>
            <input className="ti" value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder={t("tpl.nameEn.ph")} />
          </label>
        </div>
        <div className="addtpl-row two">
          <label>
            <span>{t("tpl.code")}</span>
            <input className="ti mono" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="MRI-BRAIN" />
          </label>
          <label>
            <span>{t("tpl.specialty")}</span>
            <select className="ti" value={specialty} onChange={e => setSpecialty(e.target.value)}>
              {specOpts.map(s => <option key={s} value={s}>{t(`spec.${s}`)}</option>)}
            </select>
          </label>
        </div>
        <div className="addtpl-row">
          <label>
            <span>{t("tpl.icon")}</span>
            <div className="icon-pick">
              {iconOpts.map(ic => (
                <button key={ic} type="button" className={"icon-opt" + (icon === ic ? " on" : "")} onClick={() => setIcon(ic)} aria-label={ic}>
                  <Icon name={ic} size={16} />
                </button>
              ))}
            </div>
          </label>
        </div>
        <div className="addtpl-sections">
          <div className="addtpl-secshead">
            <span className="rail-h" style={{ padding: 0 }}>{t("tpl.sections")}</span>
            <button type="button" className="btn ghost sm" onClick={addSection}><Icon name="plus" size={12} /> {t("tpl.addSection")}</button>
          </div>
          {sections.map((s, i) => (
            <div key={i} className="addtpl-secrow">
              <input className="ti" value={s.uk} onChange={e => setSection(i, "uk", e.target.value)} placeholder="Українською" />
              <input className="ti" value={s.en} onChange={e => setSection(i, "en", e.target.value)} placeholder="English" />
              <label className="req-toggle" title={t("tpl.required")}>
                <input type="checkbox" checked={s.required} onChange={e => setSection(i, "required", e.target.checked)} />
                <span>!</span>
              </label>
              <button type="button" className="iconbtn danger" onClick={() => removeSection(i)} aria-label="Remove" disabled={sections.length <= 1}>
                <Icon name="x" size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>{t("action.cancel")}</button>
        <button className="btn primary" disabled={!valid} onClick={submit}>{t("tpl.create")}</button>
      </div>
    </Modal>
  );
}

// ── Section nav (left rail) — Sprint 06 enhanced ───────────────────────
function SectionNav({ template, body, activeId, onPick, templatesMap, onSelectTemplate, onAddTemplate }) {
  const { t, lang } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const pickerRef = useRef(null);
  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = e => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [pickerOpen]);

  const filled = (id) => {
    const v = (body[id] || "").trim();
    if (!v) return "missing";
    if (v.length < 30) return "partial";
    return "filled";
  };
  const total = template.sections.length;
  const done  = template.sections.filter(s => filled(s.id) === "filled").length;
  const all   = Object.values(templatesMap || {});

  return (
    <>
      <div className="rail-h">{t("nav.dictation")} · {t(`spec.${template.specialty}`)}</div>
      <div className="tpl-picker" ref={pickerRef}>
        <button
          type="button"
          className={"rail-tplsel" + (pickerOpen ? " open" : "")}
          onClick={() => setPickerOpen(o => !o)}
          aria-expanded={pickerOpen}
          aria-haspopup="listbox"
        >
          <div className="tpl-icon"><Icon name={template.icon || "fileText"} size={16} /></div>
          <div className="tpl-meta">
            <div className="tpl-name">{template.name[lang] || template.name.en}</div>
            <div className="tpl-spec">{template.code} · {t(`spec.${template.specialty}`)}</div>
          </div>
          <Icon name="chevDown" size={14} className={"muted chev" + (pickerOpen ? " up" : "")} />
        </button>
        {pickerOpen && (
          <div className="tpl-dropdown" role="listbox">
            <div className="tpl-dropdown-h">{t("tpl.switch")}</div>
            {all.map(tpl => (
              <button
                key={tpl.id} type="button" role="option"
                aria-selected={tpl.id === template.id}
                className={"tpl-option" + (tpl.id === template.id ? " active" : "")}
                onClick={() => { onSelectTemplate(tpl.id); setPickerOpen(false); }}
              >
                <div className="tpl-icon sm"><Icon name={tpl.icon || "fileText"} size={14} /></div>
                <div className="tpl-meta">
                  <div className="tpl-name">{tpl.name[lang] || tpl.name.en}</div>
                  <div className="tpl-spec">{tpl.code} · {t(`spec.${tpl.specialty}`)} · <span className="muted">{tpl.sections.length} {t("tpl.sections")}</span></div>
                </div>
                {tpl.id === template.id && <Icon name="check" size={14} className="accent" />}
              </button>
            ))}
            <div className="tpl-dropdown-sep" />
            <button type="button" className="tpl-add" onClick={() => { setAddOpen(true); setPickerOpen(false); }}>
              <Icon name="plus" size={14} />
              <span>{t("tpl.add")}</span>
            </button>
          </div>
        )}
      </div>
      {addOpen && (
        <AddTemplateDialog
          onClose={() => setAddOpen(false)}
          onCreate={tpl => { onAddTemplate(tpl); setAddOpen(false); }}
        />
      )}

      {/* Sprint 06 — Section progress rail */}
      <div className="progress-meta">
        <span>{done}/{total}</span>
        <span>{Math.round((done / total) * 100)}%</span>
      </div>
      <div className="progress-bar">
        <div style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <div className="rail-h">
        {lang === 'uk' ? 'Розділи' : 'Sections'}
      </div>
      <div className="section-list" role="list" aria-label="Section progress rail">
        {template.sections.map(s => {
          const state       = filled(s.id);
          const dotState    = (s.required && state === "missing") ? "missing" : state;
          const wc          = (body[s.id] || "").split(/\s+/).filter(Boolean).length;
          // Sprint 06: ● filled, ◐ partial, ○ missing
          const indicator   = state === "filled" ? "●" : state === "partial" ? "◐" : "○";
          return (
            <div
              key={s.id}
              role="listitem"
              className={"section-item" + (s.id === activeId ? " active" : "")}
              data-state={dotState}
              onClick={() => onPick(s.id)}
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && onPick(s.id)}
              aria-current={s.id === activeId ? 'true' : undefined}
            >
              <span className="dot" aria-hidden="true">{indicator}</span>
              <span className="label">{s.name[lang] || s.name.en}</span>
              {wc > 0 && <span className="word-count">{wc}</span>}
              {s.required && state === "missing" && <span className="req" aria-label="Required">!</span>}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Editor toolbar (above editor) ──────────────────────────────────────
function EditorToolbar({ onSave, saveState, lastSavedAt, onSign, onExport, patient }) {
  const { t } = useI18n();
  return (
    <div className="editor-toolbar">
      <div className="meta">
        {patient ? (
          <>
            <span className="patient-id">{patient.ref || patient.mrn}</span>
            {patient.label && <span className="patient-sub">· {patient.label}</span>}
          </>
        ) : (
          <span className="patient-sub">{t("studio.noPatient") || (t("nav.dictation"))}</span>
        )}
      </div>
      <div className="spacer" />
      <SaveStatus state={saveState} lastSavedAt={lastSavedAt} />
      <div className="vdiv" />
      <button className="btn ghost sm" onClick={onExport}>
        <Icon name="download" size={13} /> {t("action.export")}
      </button>
      <button className="btn primary sm" onClick={onSign}>
        <Icon name="sign" size={13} /> {t("action.sign")}
      </button>
    </div>
  );
}

// ── Main: DictationStudio ──────────────────────────────────────────────
export function DictationStudio({ onSignedNavigate, lang, templatesMap = {}, onAddTemplate: externalAddTemplate, patient }) {
  const { t } = useI18n();
  const templatesList = useMemo(() => Object.values(templatesMap), [templatesMap]);
  const [templateId,  setTemplateId]  = useState(null);
  const template = (templateId && templatesMap[templateId]) || null;

  const [body,        setBody]        = useState({});
  const [activeId,    setActiveId]    = useState(null);
  const [dictLang,    setDictLang]    = useState(lang);
  const [partial,     setPartial]     = useState("");
  const [saveState,   setSaveState]   = useState("saved");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [signOpen,    setSignOpen]    = useState(false);
  const [toasts,      setToasts]      = useState([]);
  const reportIdRef = useRef(null);

  // Pick the first available template once the list loads.
  useEffect(() => {
    if (templateId || !templatesList.length) return;
    const first = templatesList[0];
    setTemplateId(first.id);
    setActiveId(first.sections?.[0]?.id ?? null);
  }, [templatesList, templateId]);

  const onAddTemplate = useCallback(tpl => {
    externalAddTemplate?.(tpl);
    setTemplateId(tpl.id);
    setBody({});
    setActiveId(tpl.sections?.[0]?.id ?? null);
  }, [externalAddTemplate]);

  // Sprint 10 — autocomplete state
  const [acPrefs, setAcPrefs] = useState({ ghostEnabled: true, pillsEnabled: true, sensitivity: 2 });
  const [showPills, setShowPills] = useState(false);
  const backoff = useBackoff();
  const pillSugs = usePillSuggestions({
    templateId,
    sectionId: activeId,
    bodyText: body[activeId] || '',
    enabled: acPrefs.pillsEnabled && !backoff.paused,
    language: dictLang,
  });

  const ghostText = useGhostText({
    templateId,
    sectionId: activeId,
    bodyText: body[activeId] || '',
    enabled: acPrefs.ghostEnabled && !backoff.paused,
    dismissCount: backoff.dismissCount,
    lastDismissTime: backoff.lastDismissTime,
    language: dictLang,
  });

  useEffect(() => { setDictLang(lang); }, [lang]);

  // ── Persistence ────────────────────────────────────────────────────
  const saveDraft = useCallback(async () => {
    setSaveState("saving");
    try {
      if (reportIdRef.current) {
        await updateReport(reportIdRef.current, { body });
      } else if (templateId) {
        const r = await createReport({ template: templateId, language: dictLang, body, status: "draft" });
        reportIdRef.current = r?.id ?? null;
      }
      setSaveState("saved");
      setLastSavedAt(Date.now());
    } catch {
      // Leave the document dirty so the next autosave tick retries.
      setSaveState("unsaved");
    }
  }, [body, templateId, dictLang]);

  const triggerSave = useCallback(() => { saveDraft(); }, [saveDraft]);

  const onAcceptSuggestion = useCallback((s) => {
    setBody(prev => {
      const cur = prev[activeId] || "";
      const sep = cur && !cur.endsWith(" ") && !cur.endsWith("\n") ? " " : "";
      return { ...prev, [activeId]: cur + sep + s.text.replace(/\{(\w+)\}/g, "___") };
    });
    setSaveState("unsaved");
    pushToast({ message: t("sug.undo") + " · " + (s.text.length > 40 ? s.text.slice(0, 40) + "…" : s.text) });
  }, [activeId, t]);

  // ── Speech recognition ────────────────────────────────────────────
  const onPartialCb = useCallback(s => setPartial(s), []);
  const onFinalCb   = useCallback((s, conf) => {
    const trimmed = s.trim();
    if (!trimmed || !activeId) return;
    // Voice commands: detection is client-side on the Web Speech path.
    const cmd = matchVoiceCommand(trimmed, dictLang);
    if (cmd) {
      const ins = insertionFor(cmd);
      if (ins != null) setBody(prev => ({ ...prev, [activeId]: (prev[activeId] || "") + ins }));
      else if (cmd.op === "save_draft") triggerSave();
      else if (cmd.op === "stop_dictation") speech.stop();
      return;
    }
    setBody(prev => {
      const cur = prev[activeId] || "";
      const sep = cur && !cur.endsWith(" ") && !cur.endsWith("\n") ? " " : "";
      const text = conf > 0 && conf < 0.55 ? `[[${trimmed}]]` : trimmed;
      return { ...prev, [activeId]: cur + sep + text };
    });
    setSaveState("unsaved");
  }, [activeId, dictLang, triggerSave]);

  const speech = useSpeechRecognition({ lang: dictLang, enabled: true, onPartial: onPartialCb, onFinal: onFinalCb });

  // ── Autosave ───────────────────────────────────────────────────────
  useEffect(() => {
    if (saveState !== "unsaved") return;
    const id = setTimeout(() => { saveDraft(); }, 1200);
    return () => clearTimeout(id);
  }, [saveState, body, saveDraft]);

  // ── Hotkeys ────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = e => {
      const isEditing = e.target?.isContentEditable || e.target?.tagName === "INPUT" || e.target?.tagName === "TEXTAREA";
      // Space = toggle mic (when not editing)
      if (e.code === "Space" && !isEditing && e.target === document.body) {
        e.preventDefault(); toggleMic();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault(); triggerSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Toasts ─────────────────────────────────────────────────────────
  const pushToast = useCallback(toast => {
    const id = Math.random().toString(36).slice(2);
    setToasts(s => [...s, { ...toast, id }]);
  }, []);

  // ── Mic actions ────────────────────────────────────────────────────
  const toggleMic = () => {
    if (speech.state === "listening") speech.pause();
    else if (speech.state === "paused") speech.start();
    else if (speech.state === "idle" || speech.state.startsWith("error_")) speech.start();
  };

  // ── Autocomplete handlers (Sprint 10) ──────────────────────────────
  const handleGhostAccept = useCallback(() => {
    if (!ghostText) return;
    setBody(prev => {
      const cur = prev[activeId] || '';
      const sep = cur && !cur.endsWith(' ') ? ' ' : '';
      return { ...prev, [activeId]: cur + sep + ghostText };
    });
    backoff.accept();
    setSaveState('unsaved');
  }, [ghostText, activeId, backoff]);

  const handleGhostDismiss = useCallback(() => {
    backoff.dismiss();
  }, [backoff]);

  const handlePillAccept = useCallback(sug => {
    setBody(prev => {
      const cur = prev[activeId] || '';
      const sep = cur && !cur.endsWith(' ') ? ' ' : '';
      return { ...prev, [activeId]: cur + sep + sug.text };
    });
    backoff.accept();
    setShowPills(false);
    setSaveState('unsaved');
    pushToast({ message: lang === 'uk' ? `Вставлено: ${sug.text.slice(0, 40)}…` : `Inserted: ${sug.text.slice(0, 40)}…` });
  }, [activeId, backoff, lang, pushToast]);

  const handlePillDismiss = useCallback(() => {
    backoff.dismiss();
    setShowPills(false);
  }, [backoff]);

  // Show pills when we have suggestions and cursor is in editor
  useEffect(() => {
    if (acPrefs.pillsEnabled && pillSugs.length > 0 && !backoff.paused) {
      setShowPills(true);
    } else {
      setShowPills(false);
    }
  }, [pillSugs, acPrefs.pillsEnabled, backoff.paused]);

  if (!template) {
    return (
      <div className="studio">
        <Empty
          icon="fileText"
          title={lang === "uk" ? "Шаблони недоступні" : "No templates available"}
          body={lang === "uk"
            ? "Не вдалося завантажити шаблони звітів."
            : "Report templates could not be loaded."}
        />
      </div>
    );
  }

  return (
    <div className="studio">
      <aside className="left">
        <SectionNav
          template={template}
          body={body}
          activeId={activeId}
          onPick={setActiveId}
          templatesMap={templatesMap}
          onSelectTemplate={id => {
            setTemplateId(id);
            setBody({});
            reportIdRef.current = null;
            setActiveId(templatesMap[id]?.sections?.[0]?.id ?? null);
          }}
          onAddTemplate={onAddTemplate}
        />
      </aside>

      <section className="center">
        <EditorToolbar
          patient={patient}
          saveState={saveState}
          lastSavedAt={lastSavedAt}
          onSave={triggerSave}
          onSign={() => setSignOpen(true)}
          onExport={() => pushToast({ message: lang === "uk" ? "PDF згенеровано" : "PDF generated" })}
        />
        {/* Sprint 06: TipTap section-aware editor */}
        <TipTapEditor
          template={template}
          patientRef={patient?.ref || patient?.mrn}
          body={body}
          onBodyChange={b => { setBody(b); setSaveState("unsaved"); }}
          activeId={activeId}
          onActiveSectionChange={setActiveId}
          partial={partial}
          readOnly={false}
          lang={lang}
          autocompleteGhost={ghostText}
          onAutocompleteAccept={handleGhostAccept}
          onAutocompleteDismiss={handleGhostDismiss}
        />

        {/* Sprint 10: Layer B pills */}
        {showPills && (
          <AutocompletePills
            suggestions={pillSugs}
            onAccept={handlePillAccept}
            onDismiss={handlePillDismiss}
            lang={lang}
          />
        )}

        {/* Sprint 10: Pause toast */}
        {backoff.pauseMsg && (
          <AutocompletePauseToast onResume={backoff.resume} lang={lang} />
        )}
      </section>

      <aside className="right">
        <div className="right-pad">
          <MicCard
            state={speech.state}
            level={speech.level}
            dictLang={dictLang}
            setDictLang={setDictLang}
            onClick={toggleMic}
            hotkey="Space"
          />
          <SuggestionsPanel suggestions={pillSugs} onAccept={onAcceptSuggestion} />
          <VoiceCommandRef />
          {/* Sprint 10: Autocomplete settings */}
          <AutocompleteSettings prefs={acPrefs} onChange={setAcPrefs} lang={lang} />
        </div>
      </aside>

      {/* Sprint 09: Full signing flow */}
      {signOpen && (
        <SigningFlow
          lang={lang}
          onClose={() => setSignOpen(false)}
          onSigned={() => {
            setSignOpen(false);
            pushToast({ message: lang === "uk" ? "Звіт підписано" : "Report signed" });
            onSignedNavigate?.();
          }}
        />
      )}

      <div className="toast-stack">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} onClose={() => setToasts(s => s.filter(x => x.id !== t.id))} />
        ))}
      </div>
    </div>
  );
}
