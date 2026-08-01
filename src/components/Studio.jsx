// Studio.jsx — Dictation Studio (TipTap editor, Sprint 06+)
// Replaces the contenteditable editor from sprint 5 with the TipTap
// section-aware document model. Voice commands, signing flow (Sprint 09),
// and autocomplete (Sprint 10) are wired here.

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useI18n , tr } from "../i18n.js";
import { Icon, SaveStatus, Modal, Toast, Empty } from './UI.jsx';
import { MenuSelect } from './MenuSelect.jsx';
import { SplitButton } from './SplitButton.jsx';
import { TipTapEditor, bodyToDoc, docToBody } from './TipTapEditor.jsx';
import { SigningFlow } from './SigningFlow.jsx';
import { ReportPreview } from './ReportPreview.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useAsync } from '../api/useAsync.js';
import { getTemplate, toStudioTemplate } from '../api/templates.js';
import { getStarredIds, toggleStar as toggleStarPref, getUsage, recordUse } from '../api/templatePrefs.js';
import { createReport, updateReport, finalizeReport, downloadReportPdf, getReport } from '../api/reports.js';
import { getPatient, listPatients, yearOfBirth } from '../api/patients.js';
import { getEncounter, createEncounter, isEncounterOpen } from '../api/encounters.js';
import { VisitControls, visitStatusLabel } from '../patients/VisitControls.jsx';
import { useConsentGate } from '../patients/consentGate.js';
import { ConsentSheet } from '../patients/ConsentSheet.jsx';
import { asList, Loading } from './DataStates.jsx';
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
import { sectionMetaFromContent } from '../reports/fieldContract.js';
import { focusViolationTarget } from '../reports/finalizeViolations.js';
import { applyChoiceOp, voiceOpErrorMessage, revealSection, ICD10_SEED_EVENT } from '../reports/applyChoiceOp.js';
import { sectionProgress, countComplete, gapLabel } from '../reports/sectionCompleteness.js';
import { applyOperations } from '../dictation/operations.js';
import { openMicStream, isMacPlatform, looksLikeIPhone } from '../dictation/micDevices.js';
import { useMicDevices } from '../dictation/useMicDevices.js';

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
// The slider is now a 10–100% scale (10% steps). Higher % = more sensitive =
// fewer chars before suggesting. Legacy values (1/2/3, the old Low/Med/High
// scale) are migrated to 20/50/90% on read.
export function acSensitivityPct(sensitivity) {
  if (sensitivity == null) return 50;
  if (sensitivity <= 3) return { 1: 20, 2: 50, 3: 90 }[sensitivity] ?? 50;
  return Math.min(100, Math.max(10, sensitivity));
}
function acMinPrefix(sensitivity) {
  const pct = acSensitivityPct(sensitivity);
  return Math.min(6, Math.max(1, Math.round(6 - pct / 20)));
}

// Per-user autocomplete prefs (step 05). Persisted in localStorage keyed by
// the user's sub — the repo's interim pattern for per-user prefs
// (api/templatePrefs.js precedent; the tweaks store is in-memory by
// design). Server-side preferences endpoint is a named follow-up in
// docs/sprint-10/EXPLORE.md. `enabled` is the master switch: false ⇒ no
// queries, no decorations, no telemetry, no keyboard interception.
const AC_PREFS_DEFAULTS = { enabled: true, ghostEnabled: true, pillsEnabled: true, sensitivity: 50 };
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
//
// `deviceId` pins the level meter to a specific system microphone (undefined →
// whatever the user last picked in Studio; "" → OS default). Note it does NOT
// steer recognition: the Web Speech API exposes no device selection and always
// records from the OS default input. MicCard surfaces that mismatch.
export function useSpeechRecognition({ lang, onPartial, onFinal, enabled, deviceId }) {
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
      const stream = await openMicStream(deviceId);
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
  }, [deviceId]);

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
    r.lang = tr(lang, "uk-UA", "en-US");
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

  // Switching microphone mid-session re-opens the meter on the new device
  // without interrupting the recogniser (which we can't re-point anyway).
  const prevDeviceRef = useRef(deviceId);
  useEffect(() => {
    const changed = prevDeviceRef.current !== deviceId;
    prevDeviceRef.current = deviceId;
    if (!changed || !wantRef.current) return;
    stopMeter();
    startMeter();
  }, [deviceId, startMeter, stopMeter]);

  useEffect(() => () => {
    wantRef.current = false;
    if (recogRef.current) try { recogRef.current.stop(); } catch {}
    stopMeter();
    clearTimeout(restartTimerRef.current);
  }, [stopMeter]);

  return { state, level, supported, start, stop, pause, setState };
}

// ── System microphone picker ───────────────────────────────────────────
// Lets the clinician dictate through any system input — including an iPhone
// paired as a Continuity Microphone. The picker steers every stream we open
// (level meter, capture pipeline); the Web Speech recogniser can't be
// re-pointed by any browser API, so when the choice isn't the OS default we
// say so and give the one-time settings fix instead of silently misleading.
function MicDevicePicker({ mic }) {
  const { t } = useI18n();
  if (!mic || !mic.supported) return null;

  const options = [
    {
      value: "",
      label: t("mic.device.system"),
      sub: mic.defaultLabel || undefined,
    },
    ...mic.devices.map((d, i) => ({
      value: d.deviceId,
      label: d.label || t("mic.device.unnamed", { n: i + 1 }),
    })),
  ];

  const settingsPath = isMacPlatform() ? t("mic.device.path.mac") : t("mic.device.path.other");
  const chosenLabel = mic.selected?.label || mic.selectedLabel;
  // Only worth hinting when the phone isn't already in the list.
  const showIPhoneHint = isMacPlatform() && !mic.devices.some((d) => looksLikeIPhone(d.label));

  return (
    <div className="mic-device">
      <div className="lang-tag">
        <Icon name="mic" size={11} />
        <span>{t("mic.device")}</span>
        <button type="button" className="mic-device-refresh" onClick={mic.refresh}
                title={t("mic.device.refresh")} aria-label={t("mic.device.refresh")}>
          <Icon name="refresh" size={11} />
        </button>
      </div>
      <MenuSelect
        block
        value={mic.selectedId}
        options={options}
        onChange={mic.select}
        ariaLabel={t("mic.device")}
        placeholder={t("mic.device.system")}
      />
      {mic.labelsHidden && (
        <div className="mic-device-note">
          {t("mic.device.unlock")}{" "}
          <button type="button" className="mic-device-link" onClick={mic.grantAccess}>
            {t("mic.device.unlock.cta")}
          </button>
        </div>
      )}
      {!mic.labelsHidden && mic.devices.length === 0 && (
        <div className="mic-device-note">{t("mic.device.none")}</div>
      )}
      {mic.unavailable && (
        <div className="mic-device-note warn">
          {t("mic.device.unavailable", { device: mic.selectedLabel || t("mic.device.system") })}
        </div>
      )}
      {!mic.unavailable && !mic.followsDefault && (
        <div className="mic-device-note warn">
          {mic.defaultLabel
            ? t("mic.device.notDefault", { device: mic.defaultLabel, selected: chosenLabel, path: settingsPath })
            : t("mic.device.notDefault.plain", { selected: chosenLabel, path: settingsPath })}
        </div>
      )}
      {showIPhoneHint && !mic.labelsHidden && (
        <div className="mic-device-note">{t("mic.device.iphoneHint")}</div>
      )}
    </div>
  );
}

// ── Mic card ───────────────────────────────────────────────────────────
function MicCard({ state, level, dictLang, setDictLang, onClick, hotkey, mic }) {
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
      <MicDevicePicker mic={mic} />
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
  const L = tr(lang, "uk", "en");
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
      language: tr(lang, "uk", "en"),
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
  const iconLabel = {
    fileText: tr(lang, "Документ", "Document"),
    scan:     tr(lang, "Знімок", "Imaging"),
    heart:    tr(lang, "Кардіологія", "Cardiology"),
    scalpel:  tr(lang, "Хірургія", "Surgery"),
    bone:     tr(lang, "Ортопедія", "Orthopedics"),
  };
  const specOpts = ["radiology", "cardiology", "cardiacSurgery", "orthopaedics"];
  return (
    <Modal onClose={onClose} className="modal-xl">
      <div className="modal-h">
        <h2>{t("tpl.addTitle")}</h2>
        <p>{t("tpl.addSub")}</p>
      </div>
      <div className="modal-body addtpl">
        <div className="addtpl-meta">
          <div className="addtpl-row">
            <label>
              <span>{t("tpl.nameUk")}</span>
              <input className="ti" value={nameUk} onChange={e => setNameUk(e.target.value)} placeholder={t("tpl.nameUk.ph")} />
            </label>
          </div>
          <div className="addtpl-row">
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
              <MenuSelect
                block
                value={specialty}
                onChange={setSpecialty}
                ariaLabel={t("tpl.specialty")}
                options={specOpts.map(s => ({ value: s, label: t(`spec.${s}`) }))}
              />
            </label>
          </div>
          <div className="addtpl-row">
            <label>
              <span>{t("tpl.icon")}</span>
              <div className="icon-pick">
                {iconOpts.map(ic => (
                  <button key={ic} type="button"
                    className={"icon-opt" + (icon === ic ? " on" : "")}
                    onClick={() => setIcon(ic)}
                    aria-label={iconLabel[ic]}
                    data-tip={iconLabel[ic]}>
                    <Icon name={ic} size={16} />
                  </button>
                ))}
              </div>
            </label>
          </div>
        </div>
        <div className="addtpl-sections">
          <div className="addtpl-secshead">
            <span className="rail-h" style={{ padding: 0 }}>{sections.length} {t("tpl.sections")}</span>
          </div>
          <div className="addtpl-seclist">
            {sections.map((s, i) => (
              <div key={i} className="addtpl-secrow">
                <span className="addtpl-secnum">{i + 1}</span>
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
          <button type="button" className="addtpl-addbtn" onClick={addSection}>
            <Icon name="plus" size={13} /> {t("tpl.addSection")}
          </button>
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>{t("action.cancel")}</button>
        <button className="btn accent" disabled={!valid} onClick={submit}>
          <Icon name="plus" size={13} /> {t("tpl.create")}
        </button>
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
// Template picker — a full modal (styled like the voice-commands modal) rather
// than a cramped rail dropdown: search + starred filter + a 2-col grid of
// template cards with star toggles and the active check.
function TemplatePickerModal({ template, templatesMap, onSelect, onAdd, onClose, lang, t }) {
  const [query, setQuery] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const [stars, setStars] = useState(() => getStarredIds());
  const [usage] = useState(() => getUsage());
  const handleStar = (id, e) => { e.stopPropagation(); toggleStarPref(id); setStars(getStarredIds()); };

  const nameOf = (tpl) => String(tpl.name?.[lang] || tpl.name?.en || tpl.code || "");
  const all = Object.values(templatesMap || {});
  const q = query.trim().toLowerCase();
  const visible = all
    .filter((tpl) => !q || `${nameOf(tpl)} ${tpl.code} ${tpl.specialty}`.toLowerCase().includes(q))
    .filter((tpl) => !starredOnly || stars.has(tpl.id))
    .sort((a, b) => {
      const ua = usage[a.id] || 0, ub = usage[b.id] || 0;
      if (ub !== ua) return ub - ua;
      return nameOf(a).localeCompare(nameOf(b));
    });
  const starredCount = all.reduce((n, tpl) => n + (stars.has(tpl.id) ? 1 : 0), 0);

  return (
    <Modal onClose={onClose} className="tplpick-modal">
      <div className="modal-h cmd-modal-h">
        <div>
          <h2>{tr(lang, "Оберіть шаблон", "Choose a template")}</h2>
          <p>{tr(lang, "Шаблон визначає розділи звіту, у які ви диктуєте.", "The template defines the report sections you dictate into.")}</p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label={t("cmd.close")}>
          <Icon name="x" size={14} />
        </button>
      </div>

      <div className="tplpick-toolbar">
        <label className="search-input" style={{ flex: 1 }}>
          <Icon name="search" size={14} />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={tr(lang, "Пошук шаблону…", "Search templates…")}
            aria-label={tr(lang, "Пошук шаблону", "Search templates")} />
        </label>
        <button type="button" className={"tpl-filter-chip" + (starredOnly ? " on" : "")}
          onClick={() => setStarredOnly((s) => !s)} aria-pressed={starredOnly}>
          <Icon name="star" size={12} fill={starredOnly ? "currentColor" : "none"} />
          <span>{tr(lang, "Лише обрані", "Starred")}{starredCount > 0 ? ` (${starredCount})` : ""}</span>
        </button>
        <span className="muted" style={{ fontSize: 12.5, minWidth: 24, textAlign: "right" }}>{visible.length}</span>
      </div>

      <div className="modal-body cmd-modal-body">
        {visible.length === 0 ? (
          <div className="tpl-dropdown-empty" style={{ padding: 32, textAlign: "center" }}>
            {starredOnly
              ? tr(lang, "Немає обраних шаблонів", "No starred templates")
              : tr(lang, "Нічого не знайдено", "No matches")}
          </div>
        ) : (
          <div className="tplpick-grid">
            {visible.map((tpl) => {
              const uc = usage[tpl.id] || 0;
              const starred = stars.has(tpl.id);
              const active = tpl.id === template.id;
              return (
                <div key={tpl.id} className={"tplpick-item" + (active ? " active" : "")}>
                  <button type="button" className="tplpick-main"
                    onClick={() => { recordUse(tpl.id); onSelect(tpl.id); onClose(); }}>
                    <span className="tpl-icon sm"><Icon name={tpl.icon || "fileText"} size={16} /></span>
                    <span className="tplpick-text">
                      <span className="tplpick-name">
                        {nameOf(tpl)}
                        {active && <Icon name="check" size={13} className="accent" />}
                      </span>
                      <span className="tplpick-meta">
                        {tpl.code} · {specLabel(t, tpl.specialty)}
                        {tpl.sections?.length ? ` · ${tpl.sections.length} ${t("tpl.sections")}` : ""}
                        {uc > 0 ? ` · ${uc}×` : ""}
                      </span>
                    </span>
                  </button>
                  <button type="button" className={"tpl-option-star" + (starred ? " on" : "")}
                    onClick={(e) => handleStar(tpl.id, e)} aria-pressed={starred}
                    title={starred ? tr(lang, "Прибрати з обраних", "Unstar") : tr(lang, "Додати в обрані", "Star")}>
                    <Icon name="star" size={14} fill={starred ? "currentColor" : "none"} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="modal-foot">
        <button type="button" className="btn accent" onClick={onAdd}>
          <Icon name="plus" size={13} /> {t("tpl.add")}
        </button>
      </div>
    </Modal>
  );
}

function SectionNav({ template, body, sectionMeta, activeId, onPick, templatesMap, onSelectTemplate, onAddTemplate }) {
  const { t, lang } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // Sprint 13: progress accounts for the validator's typed-field
  // requirements (a diagnosis without a confirmed ICD-10 code is NOT done)
  // — the rail must never say 100% while finalize would refuse.
  const progress = (s) => sectionProgress(s, body, sectionMeta);
  const total = template.sections.length;
  const done  = countComplete(template.sections, body, sectionMeta);

  return (
    <>
      <div className="rail-h">{t("nav.dictation")} · {specLabel(t, template.specialty)}</div>
      <div className="tpl-picker">
        <button
          type="button"
          className={"rail-tplsel" + (pickerOpen ? " open" : "")}
          onClick={() => setPickerOpen(true)}
          aria-expanded={pickerOpen}
          aria-haspopup="dialog"
        >
          <div className="tpl-icon"><Icon name={template.icon || "fileText"} size={16} /></div>
          <div className="tpl-meta">
            <div className="tpl-name">{template.name[lang] || template.name.en}</div>
            <div className="tpl-spec">{template.code} · {specLabel(t, template.specialty)}</div>
          </div>
          <Icon name="chevDown" size={14} className="muted chev" />
        </button>
      </div>
      {pickerOpen && (
        <TemplatePickerModal
          template={template}
          templatesMap={templatesMap}
          onSelect={onSelectTemplate}
          onAdd={() => { setPickerOpen(false); setAddOpen(true); }}
          onClose={() => setPickerOpen(false)}
          lang={lang}
          t={t}
        />
      )}
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
          const { state, gap } = progress(s);
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
              {gap
                ? <span className="section-gap">{gapLabel(gap, lang)}</span>
                : wc > 0 && <span className="word-count">{wc}</span>}
              {s.required && state === "missing" && <span className="req" aria-label="Required">!</span>}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Editor toolbar (above editor) ──────────────────────────────────────
// Patient identity moved to StudioContextBar (S11 step 04) — the toolbar
// keeps only save state. The studio screen may be visible to the patient, so
// the visible identity budget is name + year of birth, nothing more.
function EditorToolbar({ saveState, lastSavedAt }) {
  return (
    <div className="editor-toolbar">
      <div className="meta" />
      <div className="spacer" />
      <SaveStatus state={saveState} lastSavedAt={lastSavedAt} />
    </div>
  );
}

// ── Patient/encounter context bar (S11 step 04) ─────────────────────────
// Compact, always-visible context while dictating: displayName + year of
// birth + encounter reason. Deliberately NEVER the full DOB or MRN — the
// screen may face the patient; the full record is one click away.
// The "wrong patient?" escape shows until anything has been dictated —
// mis-selection is the top real-world error and undoing it must be one
// click BEFORE recording starts.
function StudioContextBar({ patient, encounter, canEscape, lang, onVisitChanged }) {
  const yob = yearOfBirth(patient);
  return (
    <div className="studio-context-bar" data-testid="studio-context-bar">
      <Icon name="user" size={13} />
      <strong className="scb-name">{patient.label}</strong>
      <span className="scb-sub">
        {yob != null ? (lang === "uk" ? `нар. ${yob}` : `b. ${yob}`) : null}
      </span>
      {encounter && (
        <span className="scb-enc">
          <Icon name="calendar" size={12} />
          {encounter.reason || (tr(lang, "Прийом", "Encounter"))}
          {isEncounterOpen(encounter.status) && (
            <em> · {visitStatusLabel(encounter.status, lang)}</em>
          )}
        </span>
      )}
      <span className="spacer" />
      {/* Ending the dictation is not ending the visit. The bar that always
          says which visit you are in is where the control to close it
          belongs — without it the encounter stayed in_progress forever. */}
      <VisitControls
        encounter={encounter}
        lang={lang}
        compact
        showCancel={false}
        onChanged={onVisitChanged}
      />
      {canEscape && (
        <button type="button" className="scb-escape"
          onClick={() => { location.hash = "/patients"; }}>
          {tr(lang, "Неправильний пацієнт?", "Wrong patient?")}
        </button>
      )}
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
          ? (tr(lang, "Диктуєте у розділ", "Dictating into"))
          : (tr(lang, "Активний розділ", "Active section"))}
      </span>
      <span className="dsb-section">{name}</span>
      {idx >= 0 && (
        <span className="dsb-pos">{idx + 1}/{template.sections.length}</span>
      )}
    </div>
  );
}

// ── Footer action bar ────────────────────────────────────────────────────
// One control: "Complete dictation" with its alternates (save draft, draft PDF)
// behind the caret — same split button as the finalize modal. Save state reads
// off the item's hint; the header already carries the live SaveStatus, so the
// footer doesn't need a second always-on indicator.
function StudioFooter({ done, total, onSaveDraft, onDownloadDraft, onComplete, saveState, lang }) {
  const saving = saveState === "saving";
  const saved  = saveState === "saved";
  const [pdfBusy, setPdfBusy] = useState(false);
  const downloadPdf = async () => {
    setPdfBusy(true);
    try { await onDownloadDraft(); } finally { setPdfBusy(false); }
  };
  return (
    <div className="studio-footer">
      <div className="studio-footer-info">
        <span className="sf-progress">{done}/{total} {tr(lang, "розділів", "sections")}</span>
      </div>
      <SplitButton
        variant="primary"
        icon="check"
        label={tr(lang, "Завершити диктування", "Complete dictation")}
        onClick={onComplete}
        menuLabel={tr(lang, "Інші дії", "Other actions")}
        items={[
          {
            key: "save",
            icon: saved ? "check" : "save",
            label: tr(lang, "Зберегти чернетку", "Save draft"),
            hint: saving
              ? tr(lang, "Збереження…", "Saving…")
              : saved
                ? tr(lang, "Збережено — змін немає", "Saved — no changes")
                : tr(lang, "Продовжити пізніше · ⌘S", "Continue later · ⌘S"),
            onSelect: onSaveDraft,
            disabled: saving || saved,
            busy: saving,
          },
          {
            key: "pdf",
            icon: "download",
            label: tr(lang, "PDF (чернетка)", "Draft PDF"),
            hint: tr(lang, "Чернетка, без юридичної сили", "Draft, no legal force"),
            onSelect: downloadPdf,
            busy: pdfBusy,
          },
        ]}
      />
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
    dob: p.dob, // context bar derives year-of-birth (never renders the date)
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
    () => listPatients({ query: debounced || undefined, limit: 24 }),
    [debounced],
  );
  const patients = asList(patientsReq.data);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Keyboard: ↑/↓ move the highlight, Enter opens it — same as the Patients
  // roster and other list pages.
  const [kbIdx, setKbIdx] = useState(-1);
  useEffect(() => { setKbIdx(-1); }, [patients.length, debounced]);
  const onListKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setKbIdx((i) => Math.min(patients.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setKbIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") {
      const pick = patients[kbIdx >= 0 ? kbIdx : 0];
      if (pick) { e.preventDefault(); onSelect(normalizePatient(pick, lang)); }
    }
  };

  const initialLoading = patientsReq.loading && patients.length === 0 && !patientsReq.error;

  return (
    <div className="studio">
      <div className="patient-gate">
        <div className="page">
          <div className="page-h">
            <div style={{ flex: 1 }}>
              <h1>{tr(lang, "Оберіть пацієнта", "Choose a patient")}</h1>
              <p className="sub">
                {tr(lang, "Диктування завжди прив'язане до пацієнта. Оберіть пацієнта, щоб почати запис.", "Every dictation is filed against a patient. Choose one to start recording.")}
              </p>
            </div>
          </div>

          <div className="ptable-toolbar">
            <div className="search-input" style={{ flex: 1 }}>
              <Icon name="search" size={14} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tr(lang, "Пошук: ім'я або MRN…", "Search: name or MRN…")}
                aria-label={tr(lang, "Пошук пацієнта", "Search patient")}
              />
            </div>
            {patientsReq.loading && patients.length > 0 && (
              <span className="pdir-searching">{tr(lang, "Пошук…", "Searching…")}</span>
            )}
          </div>

          <div className="ptable patient-pick-list" role="listbox" tabIndex={0} onKeyDown={onListKeyDown}
            aria-label={tr(lang, "Список пацієнтів", "Patient list")}>
            <div className="ptable-head">
              <div>{tr(lang, "Пацієнт", "Patient")}</div>
              <div>MRN</div>
              <div>{tr(lang, "Вік / стать", "Age / sex")}</div>
              <div></div>
            </div>

            {initialLoading && <Loading lang={lang} />}
            {patientsReq.error && <ApiErrorView error={patientsReq.error} lang={lang} />}
            {!initialLoading && !patientsReq.error && patients.length === 0 && (
              <div style={{ padding: "40px 24px", textAlign: "center" }}>
                <Empty icon="users" title={debounced
                  ? (tr(lang, "Нічого не знайдено", "No results"))
                  : (tr(lang, "Пацієнтів ще немає", "No patients yet"))} />
              </div>
            )}

            {!initialLoading && !patientsReq.error && patients.map((p, i) => {
              const norm = normalizePatient(p, lang);
              return (
                <div
                  key={p.id}
                  role="option"
                  aria-selected={i === kbIdx}
                  data-testid="patient-gate-row"
                  className={"ptable-row" + (i === kbIdx ? " pdir-kb" : "")}
                  onClick={() => onSelect(norm)}
                >
                  <div className="pcell-name">
                    <div className="pavatar" style={{ width: 34, height: 34, fontSize: 12 }}>
                      {p.initials || patientInitials(norm.label)}
                    </div>
                    <div className="pname">{norm.label}</div>
                  </div>
                  <div className="pmono">{p.mrn || norm.ref || "—"}</div>
                  <div className="psub">
                    {norm.age != null ? `${norm.age}${norm.sex ? ` · ${norm.sex}` : ""}` : "—"}
                  </div>
                  <div className="pdir-row-actions"><Icon name="chevRight" size={14} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main: DictationStudio ──────────────────────────────────────────────
export function DictationStudio({ onSignedNavigate, lang, templatesMap = {}, onAddTemplate: externalAddTemplate, patient: patientProp, patientId, encounterId: encounterIdProp, initialTemplateId, reportId, templatesLoading = false, templatesError = null, onRetryTemplates }) {
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
  // Encounter context (S11 step 04): dictation launched via "Почати прийом"
  // arrives with ?encounter=<uuid>. The encounter is fetched to render the
  // context bar AND validated client-side before recording: a 404 mirrors
  // the dictation-WS `encounter_invalid` protocol error, a completed/
  // cancelled one mirrors `encounter_closed` — same recovery UX for both
  // layers. State (not just the prop) so "створити новий прийом" can swap
  // the context in place.
  const [encounterId, setEncounterId] = useState(encounterIdProp || null);
  useEffect(() => { setEncounterId(encounterIdProp || null); }, [encounterIdProp]);
  const encounterReq = useAsync(
    () => (encounterId ? getEncounter(encounterId) : Promise.resolve(null)),
    [encounterId],
    { enabled: !!encounterId },
  );
  const encounter = encounterReq.data || null;
  const encounterInvalid = !!encounterId && encounterReq.error?.status === 404;
  const encounterClosed = !!encounter && ["completed", "cancelled"].includes(encounter.status);
  const [creatingEncounter, setCreatingEncounter] = useState(false);

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
  // Sprint 13 — everything a section carries besides prose:
  // { [section_key]: { icd10?, field_specific_metadata? } }. Seeded from a
  // reopened draft and round-tripped through EVERY save — an autosave that
  // dropped it would destroy extractor proposals and confirmed diagnoses.
  const [sectionMeta, setSectionMeta] = useState({});
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
  const reportStatusRef = useRef("draft"); // draft | finalized | signed — drives finalize-before-sign
  // Autosave pacing/serialization (see AUTOSAVE_* constants).
  const savingRef = useRef(false);              // a PUT/POST is in flight
  const lastSaveAttemptRef = useRef(0);         // ts of the last network attempt
  const autosaveBackoffUntilRef = useRef(0);    // don't retry before this ts (429)
  const latestBodyRef = useRef(body);           // to detect edits made mid-save
  latestBodyRef.current = body;
  const latestSectionMetaRef = useRef(sectionMeta); // same, for typed field edits
  latestSectionMetaRef.current = sectionMeta;
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
    reportStatusRef.current = rep.status || "draft";
    if (content.template_id) setTemplateId(content.template_id);
    const nextBody = {};
    for (const s of content.sections || []) {
      if (s?.section_key) nextBody[s.section_key] = s.text || "";
    }
    setBody(nextBody);
    setSectionMeta(sectionMetaFromContent(content));
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
      setSectionMeta({});
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
  // Returns "saved" (server now holds the latest state), "dirty" (saved,
  // but edits landed mid-flight — call again), or "failed" (nothing was
  // persisted this attempt: busy, missing patient, 429 backoff, 409
  // version adoption, or a real error). finalizeFromPreview relies on
  // this to never finalize a stale draft.
  const saveDraft = useCallback(async () => {
    // Serialize: never overlap two saves. A slow PUT racing the next autosave
    // tick is what desyncs the optimistic-lock version (→ 409). The autosave
    // effect reschedules once this one finishes if the doc is still dirty.
    if (savingRef.current) return "failed";
    // Never CREATE a report for an empty document. Save triggers with nothing
    // dictated yet (Cmd+S, the footer button, "зберегти" as a voice command,
    // an abandoned session) would otherwise strand an empty orphan draft —
    // each one its own row in the reports list, so a finalized document
    // appeared to coexist with draft twins of itself.
    if (!reportIdRef.current &&
        !Object.values(body).some(v => (v || "").trim()) &&
        !Object.keys(sectionMeta).length) {
      setSaveState("saved");
      return "saved";
    }
    // No report yet and no patient id: nothing to persist safely. Keep the doc
    // dirty so autosave retries once the patient resolves (the backend
    // hard-requires patient_id — a create without it 422s).
    if (!reportIdRef.current && !(templateId && patient?.id)) {
      setSaveState("unsaved");
      return "failed";
    }
    savingRef.current = true;
    lastSaveAttemptRef.current = Date.now();
    const savedBody = body;  // to detect edits landed while this save was in flight
    const savedMeta = sectionMeta;
    setSaveState("saving");
    try {
      if (reportIdRef.current) {
        const r = await updateReport(reportIdRef.current, {
          expected_version: reportVersionRef.current,
          template_id: templateId,
          template_schema_version: template?.schema_version,
          body,
          section_meta: sectionMeta,
        });
        if (r?.version_number != null) reportVersionRef.current = r.version_number;
      } else {
        const r = await createReport({ template_id: templateId, template_schema_version: template?.schema_version, body, patient_id: patient.id, section_meta: sectionMeta });
        reportIdRef.current = r?.id ?? null;
        reportVersionRef.current = r?.version_number ?? 1;
      }
      setLastSavedAt(Date.now());
      // If the user kept typing during the save, stay dirty so those edits flush.
      const clean = latestBodyRef.current === savedBody && latestSectionMetaRef.current === savedMeta;
      setSaveState(clean ? "saved" : "unsaved");
      return clean ? "saved" : "dirty";
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
        return "failed";
      }
      // 409 optimistic-lock mismatch — our version is stale (a save raced, or a
      // reopened draft seeded a stale version). Adopt the server's
      // current_version and retry silently.
      if (status === 409 || code === "optimistic_lock_mismatch") {
        const cv = conflictCurrentVersion(e);
        if (cv != null) reportVersionRef.current = cv;
        return "failed";
      }

      // Genuine, actionable failures still surface.
      const isMissingPatient = status === 422 &&
        /patient_not_found/.test(code || e.message || "");
      pushToast({
        message: isMissingPatient
          ? (tr(lang, "Оберіть пацієнта, перш ніж зберігати звіт", "Select a patient before saving the report"))
          : (tr(lang, "Не вдалося зберегти: ", "Save failed: "))
            + ((e && e.message) || (tr(lang, "спробуйте ще раз", "will retry"))),
      });
      return "failed";
    } finally {
      savingRef.current = false;
      setSaveTick(n => n + 1);  // re-arm the autosave effect (mid-save edits)
    }
  }, [body, sectionMeta, templateId, template, dictLang, patient, pushToast, lang]);

  const triggerSave = useCallback(() => { saveDraft(); }, [saveDraft]);

  // Sprint 13 — a typed field widget changed a section's meta (confirm,
  // override, pick). Merge the patch and mark the draft dirty so the normal
  // autosave PUT persists it; an empty patch removes the section's entry.
  const onSectionMetaChange = useCallback((sectionKey, patch) => {
    setSectionMeta((prev) => {
      const next = { ...prev };
      const entry = { ...(next[sectionKey] || {}), ...(patch || {}) };
      if (entry.icd10 && !entry.icd10.length) delete entry.icd10;
      if (entry.field_specific_metadata && !Object.keys(entry.field_specific_metadata).length) {
        delete entry.field_specific_metadata;
      }
      if (Object.keys(entry).length) next[sectionKey] = entry;
      else delete next[sectionKey];
      return next;
    });
    setSaveState("unsaved");
  }, []);

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

  // System microphone choice (persisted; live-updates as devices come and go).
  const mic = useMicDevices();
  const speech = useSpeechRecognition({
    lang: dictLang, enabled: true, onPartial: onPartialCb, onFinal: onFinalCb,
    deviceId: mic.selectedId,
  });

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
    // The server must hold the LATEST draft before it validates: a single
    // saveDraft() can no-op (another save in flight, 429 pacing, 409 version
    // adoption) — finalizing then would validate a STALE copy: freshly added
    // ICD-10 codes would still 422 as missing, and the finalized version
    // would silently lack the last edits. Retry until clean, bounded.
    let saved = await saveDraft();
    for (let attempt = 0; saved !== "saved" && attempt < 6; attempt++) {
      const wait = Math.max(autosaveBackoffUntilRef.current - Date.now(), 1200);
      await new Promise((res) => setTimeout(res, Math.min(wait, 6000)));
      saved = await saveDraft();
    }
    if (saved !== "saved") {
      throw new Error(tr(lang, "Не вдалося зберегти чернетку — спробуйте ще раз", "Could not save the draft — try again"));
    }
    const r = await finalizeReport(reportIdRef.current, {
      expected_version: reportVersionRef.current,
    });
    if (r?.version_number != null) reportVersionRef.current = r.version_number;
    reportStatusRef.current = r?.status || "finalized";
    pushToast({ message: tr(lang, "Звіт завершено", "Report finalized") });
    return r;
  }, [saveDraft, lang]);

  // «Підписати звіт» from the preview (2026-07-24): the backend only signs a
  // FINALIZED report — clicking Sign on a draft used to open the password
  // modal and reject a perfectly correct password with a raw 409. Now the
  // draft is finalized first (same validation surface: a 422 renders the
  // per-section reasons in the preview and signing never opens), and only
  // then does the signing modal appear.
  const signFromPreview = useCallback(async () => {
    if (reportStatusRef.current === "draft" || !reportIdRef.current) {
      await finalizeFromPreview(); // throws w/ .problems → preview surfaces them
    }
    setPreviewOpen(false);
    setSignOpen(true);
  }, [finalizeFromPreview]);

  // ── Sprint 13 step 07 — typed-field voice ops (backend step 07) ─────
  // Server-computed set/add/remove_choice + mark_diagnosis_text arrive as
  // `final.operations` on the sprint-05 WS channel and route through the
  // applyOperations registry into THIS ctx. Every mutation goes through the
  // same onSectionMetaChange → autosave path a tapped chip uses (voice ⇒
  // source:"manual", rendered confirmed — a spoken command is an explicit
  // clinician act). NOTHING here calls focus(): chips update model-driven,
  // the section is revealed by scroll only, the caret never moves.
  const applyVoiceChoiceOp = useCallback((op) => {
    const res = applyChoiceOp(op, { template, sectionMeta: latestSectionMetaRef.current });
    if (res.error) {
      pushToast({ message: voiceOpErrorMessage(res.error, lang) });
      return;
    }
    if (res.patch) onSectionMetaChange(res.sectionKey, res.patch);
    revealSection(res.sectionKey);
  }, [template, onSectionMetaChange, pushToast, lang]);

  const markDiagnosisText = useCallback((text) => {
    const t = String(text || "").trim();
    if (!t) return;
    // The hint targets the report's diagnosis section; it seeds the ICD-10
    // picker's search — never selects a code.
    const diag = template?.sections?.find((s) => s.field_type === "structured_diagnosis");
    if (!diag) return;
    revealSection(diag.id);
    try {
      window.dispatchEvent(new CustomEvent(ICD10_SEED_EVENT, { detail: { sectionId: diag.id, text: t } }));
    } catch {}
  }, [template]);

  const serverOpsCtx = useMemo(() => ({
    applyChoiceOp: applyVoiceChoiceOp,
    markDiagnosisText,
    choiceOpFailed: (reason, value) =>
      pushToast({ message: voiceOpErrorMessage({ code: reason, value }, lang) }),
    warn: (m) => pushToast({ message: m }),
  }), [applyVoiceChoiceOp, markDiagnosisText, pushToast, lang]);

  // The WS `final` consumer calls this with `final.operations` once the
  // streaming path is live (missing operations = NLP downgraded — the
  // registry's existing rule). Also exposed as a dev-only e2e seam (the
  // __mdxClient convention) so step-08 can drive the REAL op path
  // (registry → ctx → sectionMeta → chips) before backend step 07 merges.
  const applyServerOperations = useCallback(
    (operations) => applyOperations(operations, serverOpsCtx),
    [serverOpsCtx],
  );
  useEffect(() => {
    if (typeof window === "undefined" || !import.meta.env?.DEV) return;
    window.__mdxStudioOps = applyServerOperations;
    return () => { if (window.__mdxStudioOps === applyServerOperations) delete window.__mdxStudioOps; };
  }, [applyServerOperations]);

  // Sprint 13 step 06 — «перейти» from a finalize violation: close the
  // preview, make the offending section active (existing scroll/caret
  // mechanics), then focus the most specific fix affordance — for
  // diagnosis_not_confirmed the first proposal's confirm button (the fix is
  // one tap away). The delay lets the modal unmount and the editor scroll.
  const jumpToViolation = useCallback((sectionKey, code) => {
    setPreviewOpen(false);
    pickSection(sectionKey, "finalize_violation");
    setTimeout(() => focusViolationTarget(sectionKey, code), 150);
  }, [pickSection]);

  const downloadDraft = useCallback(async () => {
    if (!reportIdRef.current) { await saveDraft(); }
    if (!reportIdRef.current) {
      pushToast({ message: tr(lang, "Спершу збережіть чернетку, щоб завантажити PDF", "Save the draft first to download the PDF") });
      return;
    }
    try {
      await downloadReportPdf(reportIdRef.current, { variant: "draft", lang });
    } catch (e) {
      pushToast({ message: tr(lang, "Не вдалося завантажити PDF", "Could not download the PDF") });
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
  }, [saveState, body, sectionMeta, saveDraft, saveTick]);

  // The autosave above is a timer, and a timer does not survive the tab
  // closing: up to one debounce window of dictated text can go with it.
  // Warn while anything is unsaved or the mic is still hot.
  useEffect(() => {
    const atRisk = saveState === "unsaved" || speech.state === "listening";
    if (!atRisk) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState, speech.state]);

  // ── Hotkeys ────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = e => {
      const isEditing = e.target?.isContentEditable || e.target?.tagName === "INPUT" || e.target?.tagName === "TEXTAREA";
      // Space = toggle mic (when not editing)
      if (e.code === "Space" && !isEditing && e.target === document.body) {
        // via ref: this effect mounts once, but the gate check inside
        // toggleMic must see the CURRENT patient/consent state
        e.preventDefault(); toggleMicRef.current();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault(); triggerSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Mic actions + the consent gate (S11 step 05) ───────────────────
  // The transition into `speech.start()` is the single "before recording
  // starts" moment for the hotkey, the mic button AND resume-from-pause —
  // the gate lives here, not in the UI around it. It re-checks the server
  // on EVERY start so a consent withdrawn elsewhere blocks the next
  // segment. Fail CLOSED on errors: this is a legal gate — the deliberate
  // inverse of S10's fail-open autocomplete (see consentGate.js).
  const [consentSheetOpen, setConsentSheetOpen] = useState(false);
  const consentGate = useConsentGate(patient?.id, { encounterId });

  const startRecording = async () => {
    const { active, error } = await consentGate.check();
    if (error) return;                          // banner shows the retry
    if (!active) { setConsentSheetOpen(true); return; }
    speech.start();
  };
  const toggleMic = () => {
    if (speech.state === "listening") { speech.pause(); return; }
    startRecording();
  };
  const toggleMicRef = useRef(toggleMic);
  toggleMicRef.current = toggleMic;

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
    minPrefixLen: acMinPrefix(acPrefs.sensitivity),
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
              {tr(lang, "Спробувати ще раз", "Retry")}
            </button>
            <button className="btn" onClick={() => { location.hash = "/dictate/reports"; }}>
              {tr(lang, "← До звітів", "← Back to reports")}
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
          <Empty icon="user" title={tr(lang, "Завантаження…", "Loading…")} />
        </div>
      );
    }
    return <PatientGate lang={lang} onSelect={setPickedPatient} />;
  }

  // Encounter validation screens (mirror the BE protocol error codes; see
  // the encounter block above). Rendered before the recording surface so a
  // bad context can never produce an orphaned or mislinked recording.
  if (encounterInvalid) {
    return (
      <div className="studio">
        <Empty icon="calendar"
          title={tr(lang, "Прийом не знайдено", "Encounter not found")}
          body={tr(lang, "Посилання застаріле або прийом було видалено. Поверніться до картки пацієнта та почніть прийом заново.", "The link is stale or the encounter was removed. Return to the patient record and start the encounter again.")}
          action={
            <button className="btn accent" onClick={() => { location.hash = `/patients/${patient.id}`; }}>
              {tr(lang, "Повернутися до пацієнта", "Back to the patient")}
            </button>
          } />
      </div>
    );
  }
  if (encounterClosed) {
    const startFresh = async () => {
      if (creatingEncounter) return;
      setCreatingEncounter(true);
      try {
        const fresh = await createEncounter(patient.id, {
          kind: encounter.kind || "visit",
          reason: encounter.reason || "",
          status: "in_progress",
        });
        setEncounterId(fresh.id);
        location.hash = `/dictate/studio?patient=${patient.id}&encounter=${fresh.id}`;
      } finally {
        setCreatingEncounter(false);
      }
    };
    return (
      <div className="studio">
        <Empty icon="calendar"
          title={tr(lang, "Прийом уже завершено", "This encounter is closed")}
          body={tr(lang, "До завершеного прийому не можна додати новий запис. Створіть новий прийом, щоб продовжити диктування.", "A closed encounter can't take a new recording. Start a fresh encounter to continue dictating.")}
          action={
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button className="btn accent" disabled={creatingEncounter} onClick={startFresh}>
                {creatingEncounter
                  ? (tr(lang, "Створення…", "Creating…"))
                  : (tr(lang, "Створити новий прийом", "Start a new encounter"))}
              </button>
              <button className="btn" onClick={() => { location.hash = `/patients/${patient.id}`; }}>
                {tr(lang, "До пацієнта", "Back to the patient")}
              </button>
            </div>
          } />
      </div>
    );
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
            ? (tr(lang, "Завантаження шаблонів…", "Loading templates…"))
            : errored
              ? (tr(lang, "Не вдалося завантажити шаблони", "Couldn't load templates"))
              : (tr(lang, "Шаблони недоступні", "No templates available"))}
          body={loading
            ? ""
            : errored
              ? (tr(lang, "Сервіс звітів недоступний. Спробуйте ще раз.", "The report service is unavailable. Please try again."))
              : (tr(lang, "Немає доступних шаблонів звітів.", "No report templates are available."))}
          action={errored && onRetryTemplates
            ? <button className="btn accent" onClick={onRetryTemplates}>
                {tr(lang, "Спробувати ще раз", "Retry")}
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
          sectionMeta={sectionMeta}
          activeId={activeId}
          onPick={(id) => pickSection(id, "user_click")}
          templatesMap={templatesMap}
          onSelectTemplate={id => {
            setTemplateId(id);
            setBody({});
            setSectionMeta({});
            reportIdRef.current = null;
            setActiveId(null); // the detail-load effect sets the first section
          }}
          onAddTemplate={onAddTemplate}
        />
      </aside>

      <section className="center">
        <StudioContextBar
          patient={patient}
          encounter={encounter}
          canEscape={Object.values(body).every(v => !String(v || "").trim()) && speech.state !== "listening"}
          lang={lang}
          onVisitChanged={() => encounterReq.reload()}
        />
        <EditorToolbar
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
          sectionMeta={sectionMeta}
          onSectionMetaChange={onSectionMetaChange}
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
          done={countComplete(template.sections, body, sectionMeta)}
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
          {consentGate.status === "required" && (
            <div className="consent-gate-banner" data-testid="consent-gate-banner" role="status">
              <Icon name="shield" size={14} />
              <span>{tr(lang, "Потрібна згода пацієнта на AI-запис", "Patient consent to AI recording is required")}</span>
              <button type="button" className="btn accent sm" onClick={() => setConsentSheetOpen(true)}>
                {tr(lang, "Отримати згоду", "Capture consent")}
              </button>
            </div>
          )}
          {consentGate.status === "error" && (
            <div className="consent-gate-banner error" data-testid="consent-gate-error" role="alert">
              <Icon name="micOff" size={14} />
              <span>{tr(lang, "Не вдалося перевірити згоду — запис заблоковано", "Couldn't verify consent — recording is blocked")}</span>
              <button type="button" className="btn sm" onClick={consentGate.refresh}>
                {tr(lang, "Повторити", "Retry")}
              </button>
            </div>
          )}
          <MicCard
            state={speech.state}
            level={speech.level}
            dictLang={dictLang}
            setDictLang={setDictLang}
            onClick={toggleMic}
            hotkey="Space"
            mic={mic}
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
        onSign={signFromPreview}
        onApplySynthesis={applySynthesis}
        onFinalize={finalizeFromPreview}
        sectionMeta={sectionMeta}
        onSectionMetaChange={onSectionMetaChange}
        onJumpToViolation={jumpToViolation}
      />

      {/* Sprint 09: Full signing flow */}
      {consentSheetOpen && (
        <ConsentSheet
          lang={lang}
          patient={patient}
          encounterId={encounterId}
          onClose={() => setConsentSheetOpen(false)}
          onGranted={(_c, { autoStart }) => {
            consentGate.refresh();
            // verbal/written: the clinician asked to record — proceed
            // straight into it; digital keeps the sign dialog open instead
            if (autoStart) speech.start();
          }}
        />
      )}
      {signOpen && (
        <SigningFlow
          // BUG FIX 2026-07-24: reportId was never passed here, so the dev
          // password flow signed /v1/reports/undefined/sign and every
          // attempt was "rejected" regardless of the password.
          reportId={reportIdRef.current}
          lang={lang}
          onClose={() => setSignOpen(false)}
          onSigned={() => {
            reportStatusRef.current = "signed";
            setSignOpen(false);
            pushToast({ message: tr(lang, "Звіт підписано", "Report signed") });
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
