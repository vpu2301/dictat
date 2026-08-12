// TranscriptView.jsx — Renders a TranscriptionOutput payload.
//
// Expected shape (matches the asr-service OpenAPI snapshot):
//   {
//     text: string,
//     language?: string,
//     duration_s?: number,
//     segments: [{ start, end, text, words?: [{ start, end, word, confidence }] }]
//   }
//
// Per-word timestamps and confidence shading when `words` are present;
// otherwise we fall back to plain segment text.
import React, { useMemo, useState } from "react";
import { Icon } from "./UI.jsx";
import { tr } from "../i18n.js";

function fmtT(sec) {
  if (sec == null || Number.isNaN(sec)) return "—";
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
}

// Map confidence ∈ [0,1] to a background shade. Low confidence = warmer.
function shadeFor(conf) {
  if (conf == null) return "transparent";
  const c = Math.max(0, Math.min(1, conf));
  if (c >= 0.9) return "transparent";
  if (c >= 0.75) return "rgba(245,158,11,.10)";
  if (c >= 0.6)  return "rgba(245,158,11,.22)";
  return "rgba(220,38,38,.22)";
}

// NLP confidence-span level → shade (server-side confidence stage).
function shadeForLevel(level) {
  if (level === "high_concern") return "rgba(220,38,38,.22)";
  if (level === "moderate")     return "rgba(245,158,11,.22)";
  return "transparent";
}

// Processed-segment renderer: plain text with char-range shading from
// the NLP confidence stage ({start_char, end_char, level}).
function SpannedText({ text, spans, shade }) {
  if (!shade || !Array.isArray(spans) || spans.length === 0) return <span>{text}</span>;
  const sorted = [...spans].sort((a, b) => a.start_char - b.start_char);
  const parts = [];
  let pos = 0;
  for (let i = 0; i < sorted.length; i++) {
    const s = Math.max(pos, sorted[i].start_char);
    const e = Math.min(text.length, sorted[i].end_char);
    if (s > pos) parts.push(<span key={`t${i}`}>{text.slice(pos, s)}</span>);
    if (e > s) {
      parts.push(
        <span
          key={`s${i}`}
          title={sorted[i].level === "high_concern" ? "low confidence" : "check this"}
          style={{ background: shadeForLevel(sorted[i].level), padding: "0 1px", borderRadius: 3 }}
        >
          {text.slice(s, e)}
        </span>
      );
    }
    pos = Math.max(pos, e);
  }
  if (pos < text.length) parts.push(<span key="tail">{text.slice(pos)}</span>);
  return <>{parts}</>;
}

export function TranscriptView({ output, lang = "en" }) {
  const [showTimes, setShowTimes] = useState(true);
  const [shadeConf, setShadeConf] = useState(true);

  const segments = useMemo(() => {
    if (!output) return [];
    if (Array.isArray(output.segments)) return output.segments;
    if (output.text) return [{ start: 0, end: output.duration_s ?? 0, text: output.text }];
    return [];
  }, [output]);

  const copy = () => {
    try { navigator.clipboard.writeText(output?.text || segments.map((s) => s.text).join(" ")); } catch {}
  };

  if (!output) return null;

  return (
    <div className="transcript">
      <header className="transcript-h">
        <div className="transcript-meta">
          {output.language && <span className="chip">{output.language.toUpperCase()}</span>}
          {output.duration_s != null && (
            <span className="muted" style={{ fontSize: 12 }}>
              <Icon name="clock" size={11} /> {fmtT(output.duration_s)}
            </span>
          )}
        </div>
        <div className="transcript-tools">
          <label className="transcript-toggle">
            <input className="chk" type="checkbox" checked={showTimes} onChange={(e) => setShowTimes(e.target.checked)} />
            <span>{tr(lang, "Час", "Times")}</span>
          </label>
          <label className="transcript-toggle">
            <input className="chk" type="checkbox" checked={shadeConf} onChange={(e) => setShadeConf(e.target.checked)} />
            <span>{tr(lang, "Впевненість", "Confidence")}</span>
          </label>
          <button className="btn btn-ghost" onClick={copy} title="Copy plain text">
            <Icon name="download" size={12} />
            <span>{tr(lang, "Копіювати", "Copy")}</span>
          </button>
        </div>
      </header>

      <div className="transcript-body">
        {segments.map((seg, i) => (
          <div className="transcript-seg" key={i}>
            {showTimes && (
              <div className="transcript-time">
                <code>{fmtT(seg.start)}</code>
              </div>
            )}
            <div className="transcript-text">
              {seg.processed ? (
                <span title={seg.rawText && seg.rawText !== seg.text ? `ASR: ${seg.rawText}` : undefined} style={{ whiteSpace: "pre-wrap" }}>
                  <SpannedText text={seg.text} spans={seg.spans} shade={shadeConf} />
                </span>
              ) : Array.isArray(seg.words) && seg.words.length > 0 ? (
                seg.words.map((w, j) => (
                  <span
                    key={j}
                    title={
                      `${fmtT(w.start)}–${fmtT(w.end)}` +
                      (w.confidence != null ? ` · ${(w.confidence * 100).toFixed(0)}%` : "")
                    }
                    style={{
                      background: shadeConf ? shadeFor(w.confidence) : "transparent",
                      padding: "0 1px",
                      borderRadius: 3,
                    }}
                  >
                    {w.word}{j < seg.words.length - 1 ? " " : ""}
                  </span>
                ))
              ) : (
                <span>{seg.text}</span>
              )}
            </div>
          </div>
        ))}
        {segments.length === 0 && (
          <div className="muted" style={{ padding: 12 }}>
            {tr(lang, "Порожня транскрипція.", "Empty transcript.")}
          </div>
        )}
      </div>
    </div>
  );
}
