// Studio.jsx — Dictation Studio (TipTap editor, Sprint 06+)
// Replaces the contenteditable editor from sprint 5 with the TipTap
// section-aware document model. Voice commands, signing flow (Sprint 09),
// and autocomplete (Sprint 10) are wired here.

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useI18n } from '../i18n.js';
import { Icon, SaveStatus, Modal, Toast, Empty } from './UI.jsx';
import { TipTapEditor, bodyToDoc, docToBody } from './TipTapEditor.jsx';
import { SigningFlow } from './SigningFlow.jsx';
import { ReportPreview } from './ReportPreview.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useAsync } from '../api/useAsync.js';
import { getTemplate, toStudioTemplate } from '../api/templates.js';
import { getStarredIds, toggleStar as toggleStarPref, getUsage, recordUse } from '../api/templatePrefs.js';
import { createReport, updateReport, finalizeReport, downloadReportPdf, getReport } from '../api/reports.js';
import { getPatient, listPatients } from '../api/patients.js';
import { asList } from './DataStates.jsx';
import { ApiErrorView } from './ApiErrorView.jsx';
import { COMMANDS, segmentUtterance, appendUtterance, actionsOf, findBestSection, INSERT_OPS } from '../dictation/voiceCommands.js';
import {
  AutocompletePills,
  AutocompletePauseToast,
  AutocompleteSettings,
  useSuggestions,
  useBackoff,
} from './AutocompletePanel.jsx';
import { telemetry } from '../autocomplete/telemetry.js';

// Coerce arbitrary text into a backend slug: ^[a-z][a-z0-9_]*$.
function slugify(input, fallback = "item") {
  let s = String(input || "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!/^[a-z]/.test(s)) s = `${fallback}_${s}`.replace(/_+$/, "");
  s = s.replace(/[^a-z0-9_]/g, "");
  if (!/^[a-z]/.test(s)) s = `t_${s}`;
  return s;
}

// Sensitivity (settings slider) → min typed chars before a phrase query.
const AC_MIN_PREFIX_BY_SENSITIVITY = { 1: 5, 2: 3, 3: 2 };

// Per-user autocomplete prefs (step 05). Persisted in localStorage keyed by
// the user's sub — the repo's interim pattern for per-user prefs
// (api/templatePrefs.js precedent; the tweaks store is in-memory by
// design). Server-side preferences endpoint is a named follow-up in
// docs/sprint-10/EXPLORE.md. `enabled` is the master switch: false ⇒ no
// queries, no decorations, no telemetry, no keyboard interception.
const AC_PREFS_DEFAULTS = { enabled: true, ghostEnabled: true, pillsEnabled: true, sensitivity: 2 };
const acPrefsKey = (sub) => `mdx.ac.prefs.v1.${sub || "anon"}`;
function loadAcPrefs(sub) {
  try {
    const raw = localStorage.getItem(acPrefsKey(sub));
    return raw ? { ...AC_PREFS_DEFAULTS, ...JSON.parse(raw) } : AC_PREFS_DEFAULTS;
  } catch {
    return AC_PREFS_DEFAULTS;
  }
}

// ── Autosave pacing ────────────────────────────────────────────────────
// The report-service rate-limits draft PUTs to 1 per 5s per draft (429
// autosave_rate_limited). Space our autosaves comfortably above that so normal
// typing never trips the limiter; the idle debounce still flushes quickly once
// the user pauses within the window.
const AUTOSAVE_DEBOUNCE_MS = 1500;      // quiet period after the last keystroke
const AUTOSAVE_MIN_INTERVAL_MS = 6000;  // ≥ backend's 5s/draft, padded

// Normalize the draft PUT/POST error `detail` into an object. The backend
// contract is `{ error, ... }`, but it sometimes serializes detail as a string —
// either JSON, or a Python dict repr with single quotes
// (`{'error': 'optimistic_lock_mismatch', 'current_version': 11, ...}`). If we
// don't parse that back into an object, the version-conflict / rate-limit
// recovery below never matches and the raw dict leaks into a toast.
function saveErrorDetail(e) {
  const d = e && e.problem && e.problem.detail;
  if (d && typeof d === "object") return d;
  if (typeof d === "string") {
    try { return JSON.parse(d); } catch {}
    // Python repr → JSON: single→double quotes (values here are ints/idents,
    // so no embedded apostrophes to worry about).
    try { return JSON.parse(d.replace(/'/g, '"')); } catch {}
    // Last resort: scrape the known fields out of whatever string we got.
    const err = /error["']?\s*[:=]\s*["']?([a-z_]+)/i.exec(d);
    const cv  = /current_version["']?\s*[:=]\s*(\d+)/i.exec(d);
    const ra  = /retry_after["']?\s*[:=]\s*(\d+)/i.exec(d);
    return {
      ...(err ? { error: err[1] } : { error: d }),
      ...(cv ? { current_version: Number(cv[1]) } : {}),
      ...(ra ? { retry_after: Number(ra[1]) } : {}),
    };
  }
  return {};
}
function saveErrorCode(e) {
  const d = saveErrorDetail(e);
  return d.error || (e && e.problem && e.problem.code) || "";
}
// Seconds to wait after a 429, from the body's retry_after (Retry-After header
// isn't surfaced through ApiError). Defaults to the 5s window.
function retryAfterMs(e) {
  const d = saveErrorDetail(e);
  const ra = d.retry_after ?? (e && e.problem && e.problem.retry_after);
  const n = Number(ra);
  return (Number.isFinite(n) && n > 0 ? n : 5) * 1000;
}
// The server's authoritative version from a 409 optimistic_lock_mismatch, so we
// can adopt it and retry instead of getting stuck.
function conflictCurrentVersion(e) {
  const d = saveErrorDetail(e);
  if (d.error === "optimistic_lock_mismatch" && d.current_version != null) return d.current_version;
  return null;
}

// ── Web Speech wrapper ─────────────────────────────────────────────────
// Exported so the report view can reuse the same recognizer for voice
// amendments (Reports.jsx) — one dictation engine across the app.
export function useSpeechRecognition({ lang, onPartial, onFinal, enabled }) {
  const [state, setState] = useState("idle");
  const [level, setLevel] = useState(0);
  // The running recognizer instance is built once per start() — route its
  // events through refs so it always sees the LATEST callbacks. onFinal
  // closes over the active section; a closure frozen at start() kept
  // dictating into whichever section was active when the mic was turned on,
  // ignoring any section switch made mid-session.
  const onPartialRef = useRef(onPartial);
  const onFinalRef = useRef(onFinal);
  onPartialRef.current = onPartial;
  onFinalRef.current = onFinal;
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
      if (interim) onPartialRef.current?.(interim);
      if (final) {
        onFinalRef.current?.(final, ev.results[ev.resultIndex]?.[0]?.confidence ?? 0.85);
        onPartialRef.current?.("");
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
  }, [SR, lang]);

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

export function LevelMeter({ active, level }) {
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
        // mousedown + preventDefault: a click would blur the editor first,
        // clearing the suggestions before the click event ever fires.
        <div key={s.id} className="suggestion" onMouseDown={(e) => { e.preventDefault(); onAccept(s, i); }}>
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
// Full vocabulary modal — generated from the matcher's own COMMANDS so it
// can never drift from what actually works.
function VoiceCommandModal({ onClose }) {
  const { t, lang } = useI18n();
  const L = lang === "uk" ? "uk" : "en";
  const chipOf = (c) => {
    switch (c.op) {
      case "insert_paragraph_break": return "¶";
      case "insert_line_break":      return "↵";
      case "insert_quote_marker":    return c.arg.value === "open" ? "«" : "»";
      case "insert_punctuation":     return c.arg.value;
      case "navigate_section":       return "→";
      case "insert_template":        return "→";
      case "save_draft":             return "⌘S";
      case "undo_last":              return "⌘Z";
      case "stop_dictation":         return "Esc";
      default:                       return "";
    }
  };
  const groups = [
    { key: "structure", ops: ["insert_paragraph_break", "insert_line_break"] },
    { key: "punct",     ops: ["insert_punctuation", "insert_quote_marker"] },
    { key: "nav",       ops: ["navigate_section", "insert_template"] },
    { key: "actions",   ops: ["save_draft", "undo_last", "stop_dictation"] },
  ].map(g => ({ ...g, rows: COMMANDS.filter(c => g.ops.includes(c.op)) }));
  return (
    <Modal onClose={onClose}>
      <div className="modal-h cmd-modal-h">
        <div>
          <h2>{t("cmd.ref")}</h2>
          <p>{t("cmd.modal.sub")}</p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label={t("cmd.close")}>
          <Icon name="x" size={14} />
        </button>
      </div>
      <div className="modal-body cmd-modal-body">
        {groups.map(g => (
          <section key={g.key} className="cmd-group">
            <h3>{t(`cmd.group.${g.key}`)}</h3>
            <div className="cmd-grid">
              {g.rows.map(c => {
                const [main, ...alts] = c[L] || c.uk;
                return (
                  <div className="cmd-item" key={c.intent}>
                    <span className="cmd-chip">{chipOf(c)}</span>
                    <span className="cmd-phrases">
                      <span className="main">{main}</span>
                      {alts.length > 0 && <span className="alts">{alts.join(" · ")}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}

function VoiceCommandRef() {
  const { t } = useI18n();
  const [allOpen, setAllOpen] = useState(false);
  const core = [
    ["cmd.newPara","↵"],["cmd.newLine","⇧↵"],["cmd.comma",","],["cmd.period","."],
    ["cmd.question","?"],["cmd.dash","—"],["cmd.colon",":"],["cmd.goTo","→"],
    ["cmd.undo","⌘Z"],["cmd.save","⌘S"],["cmd.stop","Esc"],
  ];
  return (
    <details className="cmd-ref" open>
      <summary>
        <Icon name="chevRight" size={11} className="chev" />
        {t("cmd.ref")}
      </summary>
      <div className="cmd-list">
        {core.map(([key, eq]) => (
          <div className="cmd-row" key={key}>
            <span className="phrase">"{t(key)}"</span>
            <span className="action mono">{eq}</span>
          </div>
        ))}
        <button type="button" className="btn ghost sm cmd-all" onClick={() => setAllOpen(true)}>
          {t("cmd.showAll")}
        </button>
        {/* Step 05: the Tab-precedence note promised in step 03. */}
        <div className="muted" style={{ fontSize: 11, lineHeight: 1.45, padding: '6px 4px 2px' }}>
          {t("ac.help.tabNote")}
        </div>
      </div>
      {allOpen && <VoiceCommandModal onClose={() => setAllOpen(false)} />}
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
  // Build a strict backend TemplateDefinition (§3). Slugs must match
  // ^[a-z][a-z0-9_]*$; voice_aliases must be unique across the whole template.
  const submit = () => {
    if (!valid) return;
    const usedIds = new Set();
    const usedAliases = new Set();
    const def = {
      code: slugify(code, "tpl"),
      name: (lang === "uk" ? nameUk : nameEn).trim() || nameUk.trim() || nameEn.trim(),
      language: lang === "uk" ? "uk" : "en",
      specialty: specialty,
      schema_version: 1,
      sections: sections.map((s, i) => {
        const uk = s.uk.trim();
        const en = s.en.trim();
        let id = slugify(en || uk, `section_${i + 1}`);
        while (usedIds.has(id)) id = `${id}_${i}`;
        usedIds.add(id);
        const aliases = [uk.toLowerCase(), en.toLowerCase()]
          .filter(Boolean)
          .filter((a) => !usedAliases.has(a));
        aliases.forEach((a) => usedAliases.add(a));
        return {
          id,
          name: (lang === "uk" ? uk : en) || uk || en,
          voice_aliases: aliases,
          required: !!s.required,
          field_type: "free_text",
          asr_prompt: "",
          min_chars: 0,
          order: i,
        };
      }),
    };
    onCreate(def);
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

// Translate a specialty key, falling back to a humanized slug for backend
// specialties (e.g. "family_medicine") that have no i18n entry.
function specLabel(t, specialty) {
  if (!specialty) return "";
  const key = `spec.${specialty}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return String(specialty).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

  // Template picker: search, starred filter, and stars/usage prefs (interim
  // client-side; backend will provide these — see templatePrefs.js).
  const [query, setQuery] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const [stars, setStars] = useState(() => getStarredIds());
  const [usage, setUsage] = useState(() => getUsage());
  // Refresh prefs each time the picker opens (cheap; reflects other tabs/uses).
  useEffect(() => {
    if (pickerOpen) { setStars(getStarredIds()); setUsage(getUsage()); setQuery(""); }
  }, [pickerOpen]);
  const handleStar = (id, e) => { e.stopPropagation(); toggleStarPref(id); setStars(getStarredIds()); };

  const filled = (id) => {
    const v = (body[id] || "").trim();
    if (!v) return "missing";
    if (v.length < 30) return "partial";
    return "filled";
  };
  const total = template.sections.length;
  const done  = template.sections.filter(s => filled(s.id) === "filled").length;
  const all   = Object.values(templatesMap || {});

  const nameOf = (tpl) => String(tpl.name?.[lang] || tpl.name?.en || tpl.code || "");
  // Filter by search + starred, then order by most-used first (ties → name).
  const q = query.trim().toLowerCase();
  const visible = all
    .filter(tpl => !q || `${nameOf(tpl)} ${tpl.code} ${tpl.specialty}`.toLowerCase().includes(q))
    .filter(tpl => !starredOnly || stars.has(tpl.id))
    .sort((a, b) => {
      const ua = usage[a.id] || 0, ub = usage[b.id] || 0;
      if (ub !== ua) return ub - ua;
      return nameOf(a).localeCompare(nameOf(b));
    });
  const starredCount = all.reduce((n, tpl) => n + (stars.has(tpl.id) ? 1 : 0), 0);

  return (
    <>
      <div className="rail-h">{t("nav.dictation")} · {specLabel(t, template.specialty)}</div>
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
            <div className="tpl-spec">{template.code} · {specLabel(t, template.specialty)}</div>
          </div>
          <Icon name="chevDown" size={14} className={"muted chev" + (pickerOpen ? " up" : "")} />
        </button>
        {pickerOpen && (
          <div className="tpl-dropdown" role="listbox">
            <div className="tpl-dropdown-search">
              <Icon name="search" size={14} className="muted" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={lang === "uk" ? "Пошук шаблону…" : "Search templates…"}
                aria-label={lang === "uk" ? "Пошук шаблону" : "Search templates"}
              />
            </div>
            <div className="tpl-dropdown-filter">
              <button
                type="button"
                className={"tpl-filter-chip" + (starredOnly ? " on" : "")}
                onClick={() => setStarredOnly(s => !s)}
                aria-pressed={starredOnly}
              >
                <Icon name="star" size={12} fill={starredOnly ? "currentColor" : "none"} />
                <span>{lang === "uk" ? "Лише обрані" : "Starred"}{starredCount > 0 ? ` (${starredCount})` : ""}</span>
              </button>
              <span className="tpl-dropdown-count muted">{visible.length}</span>
            </div>
            <div className="tpl-dropdown-list">
              {visible.length === 0 ? (
                <div className="tpl-dropdown-empty">
                  {starredOnly
                    ? (lang === "uk" ? "Немає обраних шаблонів" : "No starred templates")
                    : (lang === "uk" ? "Нічого не знайдено" : "No matches")}
                </div>
              ) : visible.map(tpl => {
                const uc = usage[tpl.id] || 0;
                const starred = stars.has(tpl.id);
                return (
                  <div className="tpl-option-row" key={tpl.id}>
                    <button
                      type="button" role="option"
                      aria-selected={tpl.id === template.id}
                      className={"tpl-option" + (tpl.id === template.id ? " active" : "")}
                      onClick={() => { recordUse(tpl.id); onSelectTemplate(tpl.id); setPickerOpen(false); }}
                    >
                      <div className="tpl-icon sm"><Icon name={tpl.icon || "fileText"} size={14} /></div>
                      <div className="tpl-meta">
                        <div className="tpl-name">{nameOf(tpl)}</div>
                        <div className="tpl-spec">{tpl.code} · {specLabel(t, tpl.specialty)}{tpl.sections?.length ? <> · <span className="muted">{tpl.sections.length} {t("tpl.sections")}</span></> : null}{uc > 0 ? <> · <span className="muted">{uc}×</span></> : null}</div>
                      </div>
                      {tpl.id === template.id && <Icon name="check" size={14} className="accent" />}
                    </button>
                    <button
                      type="button"
                      className={"tpl-option-star" + (starred ? " on" : "")}
                      onClick={(e) => handleStar(tpl.id, e)}
                      aria-pressed={starred}
                      aria-label={starred
                        ? (lang === "uk" ? "Прибрати з обраних" : "Unstar")
                        : (lang === "uk" ? "Додати в обрані" : "Star")}
                      title={starred
                        ? (lang === "uk" ? "Прибрати з обраних" : "Unstar")
                        : (lang === "uk" ? "Додати в обрані" : "Star")}
                    >
                      <Icon name="star" size={14} fill={starred ? "currentColor" : "none"} />
                    </button>
                  </div>
                );
              })}
            </div>
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
              <span className="dot" aria-hidden="true" />
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
function EditorToolbar({ saveState, lastSavedAt, patient }) {
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
    </div>
  );
}

// ── Active-section indicator: shows which section dictation lands in ───────
function DictationStatusBar({ template, activeId, listening, lang }) {
  const sec = (template?.sections || []).find((s) => s.id === activeId);
  const name = sec ? (sec.name[lang] || sec.name.en) : "—";
  const idx = (template?.sections || []).findIndex((s) => s.id === activeId);
  return (
    <div className={"dictation-status-bar" + (listening ? " live" : "")}>
      <span className="dsb-dot" aria-hidden="true" />
      <span className="dsb-label">
        {listening
          ? (lang === "uk" ? "Диктуєте у розділ" : "Dictating into")
          : (lang === "uk" ? "Активний розділ" : "Active section")}
      </span>
      <span className="dsb-section">{name}</span>
      {idx >= 0 && (
        <span className="dsb-pos">{idx + 1}/{template.sections.length}</span>
      )}
    </div>
  );
}

// ── Footer action bar: save draft + download draft PDF + complete dictation ──
function StudioFooter({ done, total, onSaveDraft, onDownloadDraft, onComplete, saveState, lang }) {
  const saving = saveState === "saving";
  const saved  = saveState === "saved";
  const saveLabel = saving
    ? (lang === "uk" ? "Збереження…" : "Saving…")
    : saved
      ? (lang === "uk" ? "Збережено" : "Saved")
      : (lang === "uk" ? "Зберегти чернетку" : "Save draft");
  return (
    <div className="studio-footer">
      <div className="studio-footer-info">
        <span className="sf-progress">{done}/{total} {lang === "uk" ? "розділів" : "sections"}</span>
      </div>
      <button
        className="btn ghost"
        onClick={onSaveDraft}
        disabled={saving || saved}
        title={lang === "uk" ? "Зберегти, щоб продовжити пізніше (⌘S)" : "Save to continue later (⌘S)"}
      >
        <Icon name={saving ? "refresh" : saved ? "check" : "save"} size={14} /> {saveLabel}
      </button>
      <button className="btn ghost" onClick={onDownloadDraft}>
        <Icon name="download" size={14} /> {lang === "uk" ? "PDF (чернетка)" : "Draft PDF"}
      </button>
      <button className="btn primary" onClick={onComplete}>
        <Icon name="check" size={14} /> {lang === "uk" ? "Завершити диктування" : "Complete dictation"}
      </button>
    </div>
  );
}

// Normalize any patient shape (roster row, fetched record, or prop) into the
// compact { id, mrn, ref, label, ... } the Studio/report pipeline expects.
function normalizePatient(p, lang) {
  if (!p) return null;
  if (p.label && p.ref) return p; // already normalized
  const name =
    (typeof p.name === "object" ? (p.name?.[lang] || p.name?.uk || p.name?.en) : p.name) ||
    p.label || p.mrn || "";
  return {
    id: p.id,
    mrn: p.mrn,
    ref: p.ref || p.mrn,
    label: name,
    name: p.name,
    age: p.age,
    sex: p.sex,
  };
}

function patientInitials(label) {
  const parts = String(label || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

// ── Patient gate ───────────────────────────────────────────────────────
// A report is never dictated without a patient (medico-legal requirement):
// the Studio renders this picker until a patient is chosen, and only then
// mounts the dictation surface. Search reuses the roster list endpoint.
function PatientGate({ lang, onSelect }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(id);
  }, [query]);

  const patientsReq = useAsync(
    () => listPatients({ query: debounced || undefined, limit: 8 }),
    [debounced],
  );
  const patients = asList(patientsReq.data);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="studio">
      <div className="patient-gate">
        <div className="patient-gate-card">
          <div className="patient-gate-icon"><Icon name="user" size={22} /></div>
          <h2>{lang === "uk" ? "Оберіть пацієнта" : "Select a patient"}</h2>
          <p className="muted">
            {lang === "uk"
              ? "Диктування завжди прив'язане до пацієнта. Оберіть пацієнта, щоб почати."
              : "Every dictation is filed against a patient. Choose one to begin."}
          </p>

          <label className="search-input" style={{ width: "100%", marginTop: 8 }}>
            <Icon name="search" size={14} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={lang === "uk" ? "Пошук за іменем або МКА…" : "Search by name or MRN…"}
              aria-label={lang === "uk" ? "Пошук пацієнта" : "Search patient"}
            />
          </label>

          <div className="patient-gate-list" role="listbox">
            {patientsReq.loading ? (
              <div className="muted" style={{ padding: 16, textAlign: "center" }}>
                {lang === "uk" ? "Завантаження…" : "Loading…"}
              </div>
            ) : patients.length === 0 ? (
              <Empty
                icon="user"
                title={lang === "uk" ? "Пацієнтів не знайдено" : "No patients found"}
                body={debounced
                  ? (lang === "uk" ? "Спробуйте інший запит." : "Try a different search.")
                  : (lang === "uk" ? "Почніть вводити, щоб знайти пацієнта." : "Start typing to find a patient.")}
              />
            ) : (
              patients.map((p) => {
                const norm = normalizePatient(p, lang);
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    className="patient-gate-row"
                    onClick={() => onSelect(norm)}
                  >
                    <span className="avatar" style={{ width: 32, height: 32, fontSize: 12, flexShrink: 0 }}>
                      {p.initials || patientInitials(norm.label)}
                    </span>
                    <span className="patient-gate-row-meta">
                      <span className="patient-gate-row-name">{norm.label}</span>
                      <span className="patient-gate-row-sub muted">
                        {norm.ref}{norm.age != null ? ` · ${norm.age}${norm.sex || ""}` : ""}
                      </span>
                    </span>
                    <Icon name="chevRight" size={14} className="muted" />
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main: DictationStudio ──────────────────────────────────────────────
export function DictationStudio({ onSignedNavigate, lang, templatesMap = {}, onAddTemplate: externalAddTemplate, patient: patientProp, patientId, initialTemplateId, reportId, templatesLoading = false, templatesError = null, onRetryTemplates }) {
  const { t } = useI18n();

  // Reopening an existing draft (/dictate/studio?report=<id>): fetch the report
  // envelope so its body, template, patient and version can be rehydrated into
  // the Studio. Autosave then keeps updating THIS report (never creates a copy)
  // and its status is untouched — a draft stays a draft.
  const reportReq = useAsync(
    () => (reportId ? getReport(reportId) : Promise.resolve(null)),
    [reportId],
    { enabled: !!reportId },
  );

  // When dictation is launched from a patient (/dictate/studio?patient=<id>) or a
  // reopened draft, resolve the patient so the report is filed against them and
  // the toolbar shows the context. An explicit `patient` prop wins over the
  // fetched one; a reopened draft supplies its patient_id from the envelope.
  const effectivePatientId = patientId || reportReq.data?.patient_id || null;
  const patientReq = useAsync(
    () => (effectivePatientId ? getPatient(effectivePatientId) : Promise.resolve(null)),
    [effectivePatientId],
    { enabled: !!effectivePatientId },
  );
  // A patient chosen in the gate (when the Studio is opened without one).
  const [pickedPatient, setPickedPatient] = useState(null);
  const patient = useMemo(() => {
    if (patientProp) return normalizePatient(patientProp, lang);
    if (pickedPatient) return pickedPatient;
    return normalizePatient(patientReq.data, lang) || undefined;
  }, [patientProp, pickedPatient, patientReq.data, lang]);
  const templatesList = useMemo(() => Object.values(templatesMap), [templatesMap]);
  const [templateId,  setTemplateId]  = useState(initialTemplateId || null);

  // The list endpoint omits schema_jsonb (no sections); fetch the full template
  // detail for the active id and adapt it to the Studio shape (the backend
  // loads it into the dictation session at start — we don't re-send it).
  const detailReq = useAsync(
    () => getTemplate(templateId),
    [templateId],
    { enabled: !!templateId },
  );
  const template = useMemo(
    () => (detailReq.data ? toStudioTemplate(detailReq.data) : null),
    [detailReq.data],
  );

  const [body,        setBody]        = useState({});
  const [activeId,    setActiveId]    = useState(null);
  const [dictLang,    setDictLang]    = useState(lang);
  const [partial,     setPartial]     = useState("");
  const [saveState,   setSaveState]   = useState("saved");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [signOpen,    setSignOpen]    = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [toasts,      setToasts]      = useState([]);
  const { state: auth } = useAuth();
  const author = auth?.dbUser?.display_name || auth?.claims?.sub || null;
  const reportIdRef = useRef(null);
  const reportVersionRef = useRef(0);  // optimistic-lock version for draft autosave
  // Autosave pacing/serialization (see AUTOSAVE_* constants).
  const savingRef = useRef(false);              // a PUT/POST is in flight
  const lastSaveAttemptRef = useRef(0);         // ts of the last network attempt
  const autosaveBackoffUntilRef = useRef(0);    // don't retry before this ts (429)
  const latestBodyRef = useRef(body);           // to detect edits made mid-save
  latestBodyRef.current = body;
  // Bumped after every save attempt so the autosave effect re-evaluates even
  // when the doc was already "unsaved" (edits that landed mid-save must flush).
  const [saveTick, setSaveTick] = useState(0);

  // Rehydrate a reopened draft once its envelope loads. Seeding reportIdRef +
  // reportVersionRef means the very next autosave PUTs the existing report
  // (updateReport branch) instead of POSTing a new one. Guarded by a ref so a
  // later autosave-driven data refresh can't clobber in-progress edits.
  const seededReportRef = useRef(null);
  useEffect(() => {
    const rep = reportReq.data;
    if (!rep?.id || seededReportRef.current === rep.id) return;
    seededReportRef.current = rep.id;
    const content = rep.content || {};
    reportIdRef.current = rep.id;
    // The envelope names it current_version_number (GET /v1/reports/{id});
    // seeding 1 for a v2+ draft would 409 every autosave until the conflict
    // handler re-adopts the server version.
    reportVersionRef.current = rep.current_version_number ?? rep.version_number ?? 1;
    if (content.template_id) setTemplateId(content.template_id);
    const nextBody = {};
    for (const s of content.sections || []) {
      if (s?.section_key) nextBody[s.section_key] = s.text || "";
    }
    setBody(nextBody);
    setSaveState("saved");
  }, [reportReq.data]);

  // Live dictation WebSocket client, when a session is running. Section-aware
  // ASR is driven over this socket via switch_section (templates §4): no HTTP
  // on this path. Null while the Studio is on the Web-Speech fallback path.
  const wsClientRef = useRef(null);

  // Tell the backend ASR which section we're in now. Fires on a user click in
  // the rail and on a voice `navigate_section`. The recoverable error frame
  // (code:"bad_message") for an invalid id is surfaced as a non-fatal toast and
  // keeps the session alive.
  const notifySectionSwitch = useCallback((sectionId, reason) => {
    if (!sectionId) return;
    const ws = wsClientRef.current;
    if (ws && typeof ws.switchSection === "function") {
      ws.switchSection(sectionId, reason);
    }
  }, []);

  const pickSection = useCallback((sectionId, reason = "user_click") => {
    setActiveId(sectionId);
    notifySectionSwitch(sectionId, reason);
  }, [notifySectionSwitch]);

  // Pick the first available template once the list loads. Skip while a reopened
  // draft is still loading — its own template (from the envelope) must win, not a
  // default first pick.
  useEffect(() => {
    if (templateId || !templatesList.length) return;
    if (reportId && !reportReq.data) return;
    // Reopened draft with its own template: the rehydrate effect above sets it
    // in this same commit, but `templateId` in this closure is still null —
    // check the envelope directly or this pick would overwrite it (and the
    // next autosave would rewrite the draft's template_id).
    if (reportId && reportReq.data?.content?.template_id) return;
    setTemplateId(templatesList[0].id);
  }, [templatesList, templateId, reportId, reportReq.data]);

  // Once the detail (with sections) loads, default the active section.
  useEffect(() => {
    const secs = template?.sections;
    if (!secs?.length) return;
    setActiveId((cur) => (cur && secs.some((s) => s.id === cur)) ? cur : secs[0].id);
  }, [template]);

  const onAddTemplate = useCallback(async (definition) => {
    const newId = await externalAddTemplate?.(definition);
    if (newId) {
      setTemplateId(newId);
      setBody({});
      reportIdRef.current = null;
      setActiveId(null); // the detail-load effect sets the first section
    }
  }, [externalAddTemplate]);

  // Sprint 10 — autocomplete state. The suggest hook itself lives further
  // down (after `speech` is declared — querying is off while dictating).
  const [acPrefs, setAcPrefs] = useState(() => loadAcPrefs(auth?.claims?.sub));
  useEffect(() => {
    try { localStorage.setItem(acPrefsKey(auth?.claims?.sub), JSON.stringify(acPrefs)); } catch {}
  }, [acPrefs, auth?.claims?.sub]);
  const backoff = useBackoff();
  const [acCaretText, setAcCaretText] = useState(null); // text before caret (from the editor)
  const [acActiveIdx, setAcActiveIdx] = useState(0);
  const [acExplicit, setAcExplicit] = useState(false);  // ArrowDown armed explicit selection
  const acApiRef = useRef(null);                        // { accept } exposed by TipTapEditor

  useEffect(() => { setDictLang(lang); }, [lang]);

  // ── Toasts ─────────────────────────────────────────────────────────
  // Declared before saveDraft: saveDraft lists pushToast in its dependency
  // array, so pushToast must be initialized first (a `const` referenced above
  // its declaration throws a TDZ error during render).
  const pushToast = useCallback(toast => {
    const id = Math.random().toString(36).slice(2);
    setToasts(s => [...s, { ...toast, id }]);
  }, []);

  // ── Persistence ────────────────────────────────────────────────────
  const saveDraft = useCallback(async () => {
    // Serialize: never overlap two saves. A slow PUT racing the next autosave
    // tick is what desyncs the optimistic-lock version (→ 409). The autosave
    // effect reschedules once this one finishes if the doc is still dirty.
    if (savingRef.current) return;
    // No report yet and no patient id: nothing to persist safely. Keep the doc
    // dirty so autosave retries once the patient resolves (the backend
    // hard-requires patient_id — a create without it 422s).
    if (!reportIdRef.current && !(templateId && patient?.id)) {
      setSaveState("unsaved");
      return;
    }
    savingRef.current = true;
    lastSaveAttemptRef.current = Date.now();
    const savedBody = body;  // to detect edits landed while this save was in flight
    setSaveState("saving");
    try {
      if (reportIdRef.current) {
        const r = await updateReport(reportIdRef.current, {
          expected_version: reportVersionRef.current,
          template_id: templateId,
          template_schema_version: template?.schema_version,
          body,
        });
        if (r?.version_number != null) reportVersionRef.current = r.version_number;
      } else {
        const r = await createReport({ template_id: templateId, template_schema_version: template?.schema_version, body, patient_id: patient.id });
        reportIdRef.current = r?.id ?? null;
        reportVersionRef.current = r?.version_number ?? 1;
      }
      setLastSavedAt(Date.now());
      // If the user kept typing during the save, stay dirty so those edits flush.
      setSaveState(latestBodyRef.current === savedBody ? "saved" : "unsaved");
    } catch (e) {
      // Leave the doc dirty so the next tick retries.
      setSaveState("unsaved");
      const status = e && e.status;
      const code = saveErrorCode(e);

      // 429 — backend autosave rate limit (1 PUT / 5s / draft). Expected
      // backpressure, not a real failure: back off for retry_after and retry
      // silently. No toast (this was the scary "autosave_rate_limited" toast).
      if (status === 429 || code === "autosave_rate_limited") {
        autosaveBackoffUntilRef.current = Date.now() + retryAfterMs(e);
        return;
      }
      // 409 optimistic-lock mismatch — our version is stale (a save raced, or a
      // reopened draft seeded a stale version). Adopt the server's
      // current_version and retry silently.
      if (status === 409 || code === "optimistic_lock_mismatch") {
        const cv = conflictCurrentVersion(e);
        if (cv != null) reportVersionRef.current = cv;
        return;
      }

      // Genuine, actionable failures still surface.
      const isMissingPatient = status === 422 &&
        /patient_not_found/.test(code || e.message || "");
      pushToast({
        message: isMissingPatient
          ? (lang === "uk"
            ? "Оберіть пацієнта, перш ніж зберігати звіт"
            : "Select a patient before saving the report")
          : (lang === "uk" ? "Не вдалося зберегти: " : "Save failed: ")
            + ((e && e.message) || (lang === "uk" ? "спробуйте ще раз" : "will retry")),
      });
    } finally {
      savingRef.current = false;
      setSaveTick(n => n + 1);  // re-arm the autosave effect (mid-save edits)
    }
  }, [body, templateId, template, dictLang, patient, pushToast, lang]);

  const triggerSave = useCallback(() => { saveDraft(); }, [saveDraft]);

  // (Sprint 10) Right-rail suggestion accepts route through the editor's
  // single-transaction accept (acApiRef) — see the TipTapEditor wiring.

  // ── Speech recognition ────────────────────────────────────────────
  const onPartialCb = useCallback(s => setPartial(s), []);
  // Resolve a spoken phrase/keyword to a template section. Fuzzy on
  // purpose: tolerates ASR mishears ("хіт операції" → "Хід операції")
  // and Ukrainian case endings ("до ходу операції"). Used by both the
  // fixed section commands ("розділ діагноз") and the generic
  // "перейти до <розділ>" form.
  const findSectionByPhrase = useCallback(
    (phrase, keyword) => findBestSection(template?.sections, phrase, keyword),
    [template],
  );

  const onFinalCb   = useCallback((s, conf) => {
    let trimmed = s.trim();
    if (!trimmed || !activeId) return;

    // Voice commands: detection is client-side on the Web Speech path.
    // Generic section jump first — "перейти до <розділ>" / "go to <section>"
    // with an arbitrary section name the fixed vocabulary can't cover.
    // Also matches at the END of a longer utterance; the content before
    // the command still gets inserted below.
    const goTo = trimmed.toLowerCase().replace(/[.,!?]+$/, "").trim()
      .match(dictLang === "uk" ? /^(.*?)\s*перейти до (.+)$/ : /^(.*?)\s*go to (.+)$/);
    if (goTo) {
      const target = findSectionByPhrase(goTo[2], goTo[2]);
      if (target) {
        pickSection(target.id, "voice_command");
        if (!goTo[1]) return;       // pure navigation — nothing to insert
        trimmed = trimmed.slice(0, goTo[1].length).trim(); // keep the content prefix
        if (!trimmed) return;
      }
    }

    // Commands may be embedded in a longer utterance ("болить голова кома") —
    // segment the tokens instead of matching the whole string.
    const parts = segmentUtterance(trimmed, dictLang);
    const mutates = parts.some(p =>
      p.type === "text" || INSERT_OPS.has(p.row.op) || p.row.op === "undo_last");
    if (mutates) {
      const wrap = (t) => (conf > 0 && conf < 0.55 ? `[[${t}]]` : t);
      setBody(prev => ({
        ...prev,
        [activeId]: appendUtterance(prev[activeId] || "", parts, { wrapText: wrap }),
      }));
      setSaveState("unsaved");
    }

    for (const a of actionsOf(parts)) {
      if (a.op === "save_draft") triggerSave();
      else if (a.op === "stop_dictation") speech.stop();
      else if (a.op === "navigate_section") {
        const target = findSectionByPhrase(a.phrase, (a.intent.split(".")[1] || ""));
        if (target) pickSection(target.id, "voice_command");
      }
    }
  }, [activeId, dictLang, triggerSave, findSectionByPhrase, pickSection]);

  const speech = useSpeechRecognition({ lang: dictLang, enabled: true, onPartial: onPartialCb, onFinal: onFinalCb });

  // ── Complete dictation / draft export ──────────────────────────────
  // Stop the mic, persist the draft (creating the report if needed), then open
  // the written-report preview. Synthesis of raw dictation into polished prose
  // is a backend step (see the Desktop backend task) — today we render the
  // dictated body against the template structure.
  const completeDictation = useCallback(async () => {
    if (speech.state === "listening") speech.pause();
    await saveDraft();
    setPreviewOpen(true);
  }, [saveDraft, speech]);

  // Apply accepted AI-synthesized prose back into the draft. The autosave effect
  // persists it (and bumps the optimistic-lock version).
  const applySynthesis = useCallback((updates) => {
    if (!updates || !Object.keys(updates).length) return;
    setBody(prev => ({ ...prev, ...updates }));
    setSaveState("unsaved");
  }, []);

  // Finalize from the preview → real "finalized" transition with optimistic
  // locking. Persists the latest draft first so the version we send is current.
  // Throws (with .problems on a 422, .status on a 409) for the preview to surface.
  const finalizeFromPreview = useCallback(async () => {
    if (!reportIdRef.current) throw new Error("no_report");
    await saveDraft();
    const r = await finalizeReport(reportIdRef.current, {
      expected_version: reportVersionRef.current,
    });
    if (r?.version_number != null) reportVersionRef.current = r.version_number;
    pushToast({ message: lang === "uk" ? "Звіт завершено" : "Report finalized" });
    return r;
  }, [saveDraft, lang]);

  const downloadDraft = useCallback(async () => {
    if (!reportIdRef.current) { await saveDraft(); }
    if (!reportIdRef.current) {
      pushToast({ message: lang === "uk"
        ? "Спершу збережіть чернетку, щоб завантажити PDF"
        : "Save the draft first to download the PDF" });
      return;
    }
    try {
      await downloadReportPdf(reportIdRef.current, { variant: "draft", lang });
    } catch (e) {
      pushToast({ message: lang === "uk"
        ? "Не вдалося завантажити PDF"
        : "Could not download the PDF" });
    }
  }, [saveDraft, lang]);

  // ── Autosave ───────────────────────────────────────────────────────
  // Flush a short quiet-period after the last keystroke, but never faster than
  // the backend's per-draft rate limit (1 save / 5s — see report-service
  // AutosaveRateLimiter). We compute the delay from three constraints and take
  // the largest: the idle debounce, the time still owed on the min-interval
  // since the last attempt, and any active 429 backoff. This keeps continuous
  // dictation from tripping a stream of 429 `autosave_rate_limited` responses
  // while still saving promptly when the user pauses.
  useEffect(() => {
    if (saveState !== "unsaved") return;
    const now = Date.now();
    const delay = Math.max(
      AUTOSAVE_DEBOUNCE_MS,
      AUTOSAVE_MIN_INTERVAL_MS - (now - lastSaveAttemptRef.current),
      autosaveBackoffUntilRef.current - now,
    );
    const id = setTimeout(() => { saveDraft(); }, delay);
    return () => clearTimeout(id);
  }, [saveState, body, saveDraft, saveTick]);

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

  // ── Mic actions ────────────────────────────────────────────────────
  const toggleMic = () => {
    if (speech.state === "listening") speech.pause();
    else if (speech.state === "paused") speech.start();
    else if (speech.state === "idle" || speech.state.startsWith("error_")) speech.start();
  };

  // ── Autocomplete (Sprint 10) ───────────────────────────────────────
  // Single suggestions source for ghost (Layer A) + pills (Layer B).
  // Off while dictating — the transcript stream owns insertion; re-enabled
  // automatically on pause/stop. Insertion itself happens inside
  // TipTapEditor as one ProseMirror transaction (single undo step); these
  // handlers own telemetry + backoff + state.
  const acEnabled =
    acPrefs.enabled !== false && // master switch (step 05) — OFF ⇒ zero work
    (acPrefs.ghostEnabled !== false || acPrefs.pillsEnabled !== false) &&
    !backoff.paused &&
    speech.state !== 'listening';

  // Degraded case (>SUGGEST_TIMEOUT_MS): the answer was never rendered —
  // report it so tomorrow's ranking can join it by request_id.
  const handleAcDegraded = useCallback(({ requestId, prefix }) => {
    telemetry.track({
      request_id: requestId,
      event: 'timeout',
      prefix: prefix || '',
      context: { field: activeId },
    });
  }, [activeId]);

  const ac = useSuggestions({
    textBeforeCaret: acCaretText,
    enabled: acEnabled,
    language: dictLang,
    sectionId: activeId,
    templateId,
    // Sensitivity slider: how much typed evidence a phrase query needs
    // (1 = low → 5 chars, 2 = medium → 3, 3 = high → 2). Snippet "/"
    // triggers always fire.
    minPrefixLen: AC_MIN_PREFIX_BY_SENSITIVITY[acPrefs.sensitivity] ?? 3,
    onDegraded: handleAcDegraded,
  });

  // Per-source visibility (settings panel): applied on top of the hook
  // state so ghost, pills, right rail and the keyboard protocol all see
  // the same filtered list.
  const acVisible = useMemo(
    () => ac.suggestions.filter(s => acPrefs.sources?.[s.source] !== false),
    [ac.suggestions, acPrefs.sources],
  );
  useEffect(() => {
    if (acActiveIdx !== 0 && acActiveIdx >= acVisible.length) setAcActiveIdx(0);
  }, [acVisible.length, acActiveIdx]);
  const acPillsOpen = acPrefs.pillsEnabled !== false && acVisible.length > 1;

  // New response → reset selection state + record the impression. The sink
  // (src/autocomplete/telemetry.js) dedups shown_only per request_id,
  // batches sequential POSTs, and survives page close via keepalive fetch —
  // track() is synchronous and can never affect typing.
  useEffect(() => {
    setAcActiveIdx(0);
    setAcExplicit(false);
    if (ac.requestId && acVisible.length) {
      const first = acVisible[0];
      telemetry.track({
        request_id: ac.requestId,
        event: 'shown_only',
        prefix: ac.prefix || '',
        ...(first.kind === 'snippet' ? { snippet_id: first.id } : { phrase_id: first.id }),
        context: { field: activeId },
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ac.requestId]);

  const handleAcAccept = useCallback((s, i) => {
    if (ac.requestId) {
      telemetry.track({
        request_id: ac.requestId,
        event: 'accepted',
        prefix: ac.prefix || '',
        ...(s.kind === 'snippet' ? { snippet_id: s.id } : { phrase_id: s.id }),
        context: { field: activeId, index: Number.isInteger(i) ? i : 0 },
      });
    }
    backoff.accept();
    ac.clear();
    setAcActiveIdx(0);
    setAcExplicit(false);
  }, [ac, backoff, activeId]);

  const handleAcDismiss = useCallback(() => {
    if (ac.requestId) {
      telemetry.track({
        request_id: ac.requestId,
        event: 'rejected',
        prefix: ac.prefix || '',
        context: { field: activeId },
      });
    }
    backoff.dismiss();
    ac.clear();
    setAcActiveIdx(0);
    setAcExplicit(false);
  }, [ac, backoff, activeId]);

  const handleAcCycle = useCallback((idx, explicit) => {
    setAcActiveIdx(idx);
    if (explicit) setAcExplicit(true);
  }, []);

  // A reopened draft that failed to load must surface the failure. Falling
  // through would render the patient gate and then an empty template state —
  // which reads as "pick a patient / no templates" instead of the real error
  // (and an autosave from that state could even fork a new report).
  if (reportId && reportReq.error) {
    return (
      <div className="studio">
        <div style={{ maxWidth: 560, margin: "48px auto", display: "grid", gap: 12 }}>
          <ApiErrorView error={reportReq.error} lang={lang} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn accent" onClick={reportReq.reload}>
              {lang === "uk" ? "Спробувати ще раз" : "Retry"}
            </button>
            <button className="btn" onClick={() => { location.hash = "/dictate/reports"; }}>
              {lang === "uk" ? "← До звітів" : "← Back to reports"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Patient gate: a report is never dictated without a patient. Until one is
  // resolved (from a prop, the ?patient= URL, a reopened draft, or the gate
  // picker) we render the picker instead of the recording surface. While a known
  // patient or a reopened report is still loading, show a spinner rather than
  // flashing the picker. `!patientReq.data` (not `.loading`) covers the commit
  // where the envelope just supplied patient_id but the fetch effect hasn't
  // flipped `loading` yet; a failed patient fetch still falls back to the gate.
  if (!patient) {
    const resolving = (reportId && reportReq.loading) ||
      (effectivePatientId && !patientReq.error && !patientReq.data);
    if (resolving) {
      return (
        <div className="studio">
          <Empty icon="user" title={lang === "uk" ? "Завантаження…" : "Loading…"} />
        </div>
      );
    }
    return <PatientGate lang={lang} onSelect={setPickedPatient} />;
  }

  if (!template) {
    // Three distinct states share this gate — keep them apart so a list that is
    // still loading (or a backend hiccup) never masquerades as "no templates":
    //   • loading  — the template list (App-level) or the active detail is in flight
    //   • errored  — the list request failed → offer a retry, not a dead end
    //   • empty    — the list resolved with zero templates
    const loading = templatesLoading || (!!templateId && detailReq.loading);
    const errored = !loading && !!templatesError;
    return (
      <div className="studio">
        <Empty
          icon="fileText"
          title={loading
            ? (lang === "uk" ? "Завантаження шаблонів…" : "Loading templates…")
            : errored
              ? (lang === "uk" ? "Не вдалося завантажити шаблони" : "Couldn't load templates")
              : (lang === "uk" ? "Шаблони недоступні" : "No templates available")}
          body={loading
            ? ""
            : errored
              ? (lang === "uk"
                ? "Сервіс звітів недоступний. Спробуйте ще раз."
                : "The report service is unavailable. Please try again.")
              : (lang === "uk"
                ? "Немає доступних шаблонів звітів."
                : "No report templates are available.")}
          action={errored && onRetryTemplates
            ? <button className="btn accent" onClick={onRetryTemplates}>
                {lang === "uk" ? "Спробувати ще раз" : "Retry"}
              </button>
            : undefined}
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
          onPick={(id) => pickSection(id, "user_click")}
          templatesMap={templatesMap}
          onSelectTemplate={id => {
            setTemplateId(id);
            setBody({});
            reportIdRef.current = null;
            setActiveId(null); // the detail-load effect sets the first section
          }}
          onAddTemplate={onAddTemplate}
        />
      </aside>

      <section className="center">
        <EditorToolbar
          patient={patient}
          saveState={saveState}
          lastSavedAt={lastSavedAt}
        />
        <DictationStatusBar
          template={template}
          activeId={activeId}
          listening={speech.state === "listening"}
          lang={lang}
        />
        {/* Sprint 06: TipTap section-aware editor */}
        <TipTapEditor
          template={template}
          patientRef={patient?.ref || patient?.mrn}
          body={body}
          onBodyChange={b => { setBody(b); setSaveState("unsaved"); }}
          activeId={activeId}
          onActiveSectionChange={(id) => pickSection(id, "user_click")}
          partial={partial}
          dictating={speech.state === "listening"}
          readOnly={false}
          lang={lang}
          acSuggestions={acVisible}
          acActiveIndex={acActiveIdx}
          acExplicit={acExplicit}
          acPrefix={ac.prefix}
          acShowGhost={acPrefs.ghostEnabled !== false}
          onAcAccept={handleAcAccept}
          onAcDismiss={handleAcDismiss}
          onAcCycle={handleAcCycle}
          onAcCaretContext={setAcCaretText}
          acApiRef={acApiRef}
          acListboxOpen={acPillsOpen}
        />

        {/* Sprint 10: Layer B pills (popup only when there is a choice),
            anchored under the caret (viewport coords from the editor). */}
        {acPillsOpen && (
          <AutocompletePills
            suggestions={acVisible}
            activeIndex={acActiveIdx}
            anchor={acApiRef.current?.caretCoords?.() || null}
            onAccept={(s, i) => acApiRef.current?.accept(s, i)}
            onDismiss={handleAcDismiss}
            lang={lang}
          />
        )}

        {/* Sprint 10: Pause toast */}
        {backoff.pauseMsg && (
          <AutocompletePauseToast onResume={backoff.resume} lang={lang} />
        )}

        <StudioFooter
          done={template.sections.filter(s => (body[s.id] || "").trim().length > 0).length}
          total={template.sections.length}
          onSaveDraft={triggerSave}
          onDownloadDraft={downloadDraft}
          onComplete={completeDictation}
          saveState={saveState}
          lang={lang}
        />
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
          <SuggestionsPanel
            suggestions={acVisible}
            onAccept={(s, i) => acApiRef.current?.accept(s, i)}
          />
          <VoiceCommandRef />
          {/* Sprint 10: Autocomplete settings */}
          <AutocompleteSettings prefs={acPrefs} onChange={setAcPrefs} lang={lang} />
        </div>
      </aside>

      {/* Completed dictation → written-report preview */}
      <ReportPreview
        open={previewOpen}
        lang={lang}
        template={template}
        body={body}
        patient={patient}
        author={author}
        reportId={reportIdRef.current}
        onClose={() => setPreviewOpen(false)}
        onSign={() => { setPreviewOpen(false); setSignOpen(true); }}
        onApplySynthesis={applySynthesis}
        onFinalize={finalizeFromPreview}
      />

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
