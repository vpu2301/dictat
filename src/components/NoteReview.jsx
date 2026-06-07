// NoteReview.jsx — Sprint 15: 2-pane note review with traceability
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Icon } from './UI.jsx';
import { Loading, asList } from './DataStates.jsx';
import { ApiErrorView } from './ApiErrorView.jsx';
import { useAsync } from '../api/useAsync.js';
import { getReviewSession } from '../api/scribe.js';
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

function fmtDurSec(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── SourceCoverageBar ────────────────────────────────────────────────────────

function SourceCoverageBar({ coverage, lang }) {
  const pct = Math.round(coverage * 100);
  return (
    <div className="coverage-bar">
      <span className="cb-label">{lang === "uk" ? "Покриття джерелом:" : "Source coverage:"}</span>
      <span className="cb-pct">{pct}%</span>
      <div className="cb-track">
        <div className="cb-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── ScreenSplitter ───────────────────────────────────────────────────────────

function ScreenSplitter({ onDrag }) {
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startPct = useRef(0);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setDragging(true);
    startX.current = e.clientX;
    startPct.current = null;
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e) => {
      onDrag(e.clientX);
    };
    const handleUp = () => setDragging(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging, onDrag]);

  return (
    <div
      className={`screen-splitter ${dragging ? "dragging" : ""}`}
      onMouseDown={handleMouseDown}
    />
  );
}

// ─── TranscriptViewer ─────────────────────────────────────────────────────────

function TranscriptViewer({ segments, activeSourceIds, lang, speakerMap, onSpeakerChange }) {
  const [openDropdown, setOpenDropdown] = useState(null);

  const resolvedName = (speaker) => speakerMap[speaker] || (speaker === "clinician" ? (lang === "uk" ? "Лікар" : "Clinician") : (lang === "uk" ? "Пацієнт" : "Patient"));

  const roleOptions = [
    { key: "clinician", uk: "Лікар", en: "Clinician" },
    { key: "patient",   uk: "Пацієнт", en: "Patient" },
    { key: "caregiver", uk: "Доглядач", en: "Caregiver" },
  ];

  const handleRename = (currentSpeaker, newRole) => {
    onSpeakerChange(currentSpeaker, newRole);
    setOpenDropdown(null);
  };

  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest(".speaker-badge") && !e.target.closest(".speaker-dropdown")) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div>
      {segments.map(seg => {
        const isHighlighted = activeSourceIds && activeSourceIds.includes(seg.id);
        const speakerRole = speakerMap[seg.speaker] || seg.speaker;
        const badgeClass = speakerRole === "clinician" ? "clinician" : speakerRole === "caregiver" ? "caregiver" : "patient";

        return (
          <div key={seg.id} className={`tx-segment ${isHighlighted ? "active-highlight" : ""}`}>
            <div className="tx-seg-meta">
              <div style={{ position: "relative" }}>
                <button
                  className={`speaker-badge ${badgeClass}`}
                  onClick={() => setOpenDropdown(openDropdown === seg.id ? null : seg.id)}
                  title={lang === "uk" ? "Змінити мовця" : "Change speaker"}
                >
                  {resolvedName(seg.speaker)}
                  <Icon name="chevDown" size={10} />
                </button>
                {openDropdown === seg.id && (
                  <div className="speaker-dropdown">
                    <div style={{ fontSize: 11, color: "var(--muted)", padding: "6px 12px 4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {lang === "uk" ? "Замінити всіх" : "Change all"} &ldquo;{resolvedName(seg.speaker)}&rdquo;
                    </div>
                    {roleOptions.map(opt => (
                      <div
                        key={opt.key}
                        className="speaker-dropdown-item"
                        onClick={() => handleRename(seg.speaker, opt.key)}
                      >
                        <span className={`speaker-badge ${opt.key}`} style={{ cursor: "default" }}>{opt[lang] || opt.en}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <span className="tx-timestamp">{fmtDurSec(seg.t)}</span>
            </div>
            <div className="tx-seg-text">{seg.text}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── GeneratedNoteEditor ──────────────────────────────────────────────────────

function GeneratedNoteEditor({ sections, lang, activeSpan, onSpanHover }) {
  return (
    <div>
      {sections.map(section => (
        <div key={section.id} className="review-note-section">
          <div className="rns-title">{loc(section.title, lang)}</div>
          <SourceCoverageBar coverage={section.coverage || 0} lang={lang} />
          <div className="rns-content" contentEditable suppressContentEditableWarning>
            <AnnotatedContent
              text={loc(section.content, lang)}
              spans={section.spans}
              lang={lang}
              activeSpan={activeSpan}
              onSpanHover={onSpanHover}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Annotate text with traceability spans
function AnnotatedContent({ text, spans, lang, activeSpan, onSpanHover }) {
  // Build annotated segments: find span positions in text
  // We'll do a simple scan for matching text fragments
  if (!spans || spans.length === 0) {
    return <span>{text}</span>;
  }

  // Build list of annotated ranges
  const annotations = [];
  spans.forEach(span => {
    const idx = text.indexOf(span.text);
    if (idx >= 0) {
      annotations.push({ start: idx, end: idx + span.text.length, span });
    }
  });
  annotations.sort((a, b) => a.start - b.start);

  // Build non-overlapping segments
  const segments = [];
  let cursor = 0;
  for (const ann of annotations) {
    if (ann.start > cursor) {
      segments.push({ type: "text", content: text.slice(cursor, ann.start) });
    }
    if (ann.start >= cursor) {
      segments.push({ type: "span", content: text.slice(ann.start, ann.end), span: ann.span });
      cursor = ann.end;
    }
  }
  if (cursor < text.length) {
    segments.push({ type: "text", content: text.slice(cursor) });
  }

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return <span key={i}>{seg.content}</span>;
        }
        const isLowConf = seg.span.confidence < 0.7;
        const isActive = activeSpan && seg.span.sourceIds.some(id => activeSpan.includes(id));
        return (
          <span
            key={i}
            className={`traceability-span${isLowConf ? " low-conf" : ""}${isActive ? " active-trace" : ""}`}
            title={`${lang === "uk" ? "Джерела: " : "Sources: "}${seg.span.sourceIds.join(", ")} — ${Math.round(seg.span.confidence * 100)}%`}
            onMouseEnter={() => onSpanHover(seg.span.sourceIds)}
            onMouseLeave={() => onSpanHover(null)}
          >
            {seg.content}
          </span>
        );
      })}
    </>
  );
}

// ─── NoteReviewPage ───────────────────────────────────────────────────────────

export function NoteReviewPage({ sessionId, lang, navigate }) {
  const req = useAsync(() => getReviewSession(sessionId), [sessionId]);
  const [splitPct, setSplitPct] = useState(45);
  const [activeSpan, setActiveSpan] = useState(null); // array of sourceIds
  const [scrollSync, setScrollSync] = useState(false);
  const [speakerMap, setSpeakerMap] = useState({});
  const [signing, setSigning] = useState(false);
  const containerRef = useRef(null);

  const handleSplitterDrag = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.max(20, Math.min(80, ((clientX - rect.left) / rect.width) * 100));
    setSplitPct(pct);
  }, []);

  const handleSpeakerChange = (currentSpeaker, newRole) => {
    setSpeakerMap(prev => ({ ...prev, [currentSpeaker]: newRole }));
  };

  if (req.loading) return <div className="page"><Loading lang={lang} /></div>;
  if (req.error) return <div className="page"><ApiErrorView error={req.error} lang={lang} /></div>;

  const session = req.data;
  if (!session) {
    return <div style={{ padding: 40, color: "var(--muted)", textAlign: "center" }}>
      {lang === "uk" ? "Сесію не знайдено" : "Session not found"}
    </div>;
  }

  const patient = session.patient;
  const transcript = asList(session.transcript);
  const sections = asList(session.generatedNote?.sections);

  const handleSign = async () => {
    setSigning(true);
    try {
      const body = {};
      sections.forEach(s => { body[s.id] = loc(s.content, lang); });
      const r = await createReport({ language: lang, body, source_session_id: session.id });
      if (r?.id) navigate(`/dictate/reports/${r.id}`);
      else setSigning(false);
    } catch { setSigning(false); }
  };

  return (
    <div className="review-layout" style={{ height: "calc(100vh - 52px)", overflow: "hidden" }}>
      {/* Header */}
      <div className="review-header">
        <button className="tb-back" onClick={() => navigate(patient ? `/scribe/patients/${patient.id}` : "/scribe")}>
          <Icon name="arrowLeft" size={16} />
        </button>
        {patient && (
          <div className="pavatar" style={{ width: 32, height: 32, background: patient.accent || "#0a8a7a", fontSize: 12 }}>
            {patient.initials || autoInitials(patientName(patient, lang))}
          </div>
        )}
        <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-1)", flex: 1 }}>
          {lang === "uk" ? "Огляд нотатки" : "Note review"}
          {patient && (
            <span style={{ fontSize: 13, fontWeight: 400, color: "var(--muted)", marginLeft: 8 }}>
              — {loc(patient.short, lang) || patientName(patient, lang)}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-2)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={scrollSync}
              onChange={e => setScrollSync(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            {lang === "uk" ? "Синхронна прокрутка" : "Scroll sync"}
          </label>
          <button className="btn accent" onClick={handleSign} disabled={signing}>
            <Icon name="sign" size={13} />
            {signing ? (lang === "uk" ? "Створення…" : "Creating…") : (lang === "uk" ? "Підписати як звіт" : "Sign as report")}
          </button>
        </div>
      </div>

      {/* Panes */}
      <div className="review-panes" ref={containerRef}>
        {/* Left: transcript */}
        <div
          className="review-pane-transcript"
          style={{ width: `${splitPct}%`, minWidth: "20%", maxWidth: "80%", overflow: "hidden", display: "flex", flexDirection: "column" }}
        >
          <div className="review-pane-header">
            <Icon name="mic" size={14} />
            {lang === "uk" ? "Транскрипт" : "Transcript"}
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>
              {transcript.length} {lang === "uk" ? "фрагментів" : "segments"}
            </span>
          </div>
          <div className="review-pane-body">
            <TranscriptViewer
              segments={transcript}
              activeSourceIds={activeSpan}
              lang={lang}
              speakerMap={speakerMap}
              onSpeakerChange={handleSpeakerChange}
            />
          </div>
        </div>

        {/* Divider */}
        <ScreenSplitter onDrag={handleSplitterDrag} />

        {/* Right: generated note */}
        <div
          className="review-pane-note"
          style={{ flex: 1, minWidth: "20%", overflow: "hidden", display: "flex", flexDirection: "column" }}
        >
          <div className="review-pane-header">
            <Icon name="fileText" size={14} />
            {lang === "uk" ? "Згенерована нотатка" : "Generated note"}
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>
              {sections.length} {lang === "uk" ? "розділів" : "sections"}
            </span>
          </div>
          <div className="review-pane-body">
            <div style={{ marginBottom: 12, padding: "8px 12px", background: "var(--accent-soft)", borderRadius: "var(--radius)", fontSize: 12.5, color: "var(--accent-text,var(--accent))", display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="sparkle" size={13} />
              {lang === "uk"
                ? "Підкреслені фрагменти пов'язані з першоджерелами в транскрипті. Наведіть курсор, щоб побачити зв'язок."
                : "Underlined spans are linked to source segments in the transcript. Hover to see the connection."}
            </div>
            <GeneratedNoteEditor
              sections={sections}
              lang={lang}
              activeSpan={activeSpan}
              onSpanHover={setActiveSpan}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="review-footer">
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
          {lang === "uk"
            ? `Сесія: ${session.id} · ${transcript.length} фрагментів`
            : `Session: ${session.id} · ${transcript.length} segments`}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
          {lang === "uk" ? "— нормальна достовірність" : "— normal confidence"}
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--warn)", display: "inline-block", marginLeft: 8 }} />
          {lang === "uk" ? "— низька достовірність (пунктир)" : "— low confidence (dotted)"}
        </div>
      </div>
    </div>
  );
}
