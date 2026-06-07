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
            <input type="checkbox" checked={showTimes} onChange={(e) => setShowTimes(e.target.checked)} />
            <span>{lang === "uk" ? "Час" : "Times"}</span>
          </label>
          <label className="transcript-toggle">
            <input type="checkbox" checked={shadeConf} onChange={(e) => setShadeConf(e.target.checked)} />
            <span>{lang === "uk" ? "Впевненість" : "Confidence"}</span>
          </label>
          <button className="btn btn-ghost" onClick={copy} title="Copy plain text">
            <Icon name="download" size={12} />
            <span>{lang === "uk" ? "Копіювати" : "Copy"}</span>
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
              {Array.isArray(seg.words) && seg.words.length > 0 ? (
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
            {lang === "uk" ? "Порожня транскрипція." : "Empty transcript."}
          </div>
        )}
      </div>
    </div>
  );
}
