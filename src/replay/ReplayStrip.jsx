// ReplayStrip.jsx — tap a sentence, hear the moment behind it (sprint 15).
//
// The product claim this makes real: a reviewed sentence is never more than one
// tap from the recording it came from. The claim it refuses to make: that the
// audio is always there. Retention windows expire, erasure crypto-shreds, and
// sessions get truncated — every one of those answers is rendered in words,
// inline, where the clinician tapped, instead of as a failure.
//
// The player is deliberately the native <audio controls>: play/pause and
// scrub-within-the-clip for free, no autoplay unless asked (it is never asked),
// and no dependency for a 3-second Ogg blob.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { loadClip, classifyClipError, listSectionAudioSegments } from "../api/audioClips.js";
import { speakerLabel } from "../conversation/copy.js";
import { splitSentences, alignSentencesToSegments } from "./sentences.js";
import { degradedCopy } from "./degraded.js";
import { tr } from "../i18n.js";
import { Icon } from "../components/UI.jsx";

// ── One section's body, sentence-addressable ─────────────────────────────

export function ReplaySection({ reportId, sectionKey, text, lang, openKey, onOpen }) {
  const [segments, setSegments] = useState(null); // null = not loaded, [] = none

  // Timings only — no transcript text crosses this wire, so loading them for
  // every visible section costs nothing a reader would care about.
  useEffect(() => {
    let alive = true;
    if (!reportId || !sectionKey || !String(text || "").trim()) { setSegments([]); return undefined; }
    listSectionAudioSegments(reportId, sectionKey)
      .then((s) => { if (alive) setSegments(s); })
      .catch(() => { if (alive) setSegments([]); }); // no replay is not an error
    return () => { alive = false; };
  }, [reportId, sectionKey, text]);

  const sentences = useMemo(() => splitSentences(text), [text]);
  const spans = useMemo(
    () => alignSentencesToSegments(sentences, segments || []),
    [sentences, segments],
  );

  if (!sentences.length) return null;

  return (
    <div className="body replay-body" data-testid={`replay-section-${sectionKey}`}>
      {sentences.map((s, i) => {
        const span = spans[i];
        const key = `${sectionKey}:${i}`;
        const isOpen = openKey === key;
        return (
          <React.Fragment key={key}>
            <span className={"replay-sentence" + (isOpen ? " on" : "")}>
              {s.text}
              {span && (
                <button
                  type="button"
                  className="replay-glyph"
                  data-testid={`replay-glyph-${sectionKey}-${i}`}
                  aria-expanded={isOpen}
                  aria-label={tr(lang, "Прослухати цей запис", "Play this recording")}
                  title={span.exact
                    ? tr(lang, "Прослухати цей запис", "Play this recording")
                    : tr(lang, "Прослухати запис (приблизний момент)", "Play recording (approximate moment)")}
                  onClick={() => onOpen(isOpen ? null : key)}
                >
                  <Icon name="audio" size={11} />
                </button>
              )}
            </span>
            {isOpen && span && (
              <ClipPlayer
                reportId={reportId}
                span={span}
                lang={lang}
                onClose={() => onOpen(null)}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── The mini-player ──────────────────────────────────────────────────────

function ClipPlayer({ reportId, span, lang, onClose }) {
  const [state, setState] = useState({ status: "loading" });
  const revokeRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    loadClip({ reportId, startMs: span.startMs, endMs: span.endMs })
      .then((clip) => {
        if (!alive) { clip.revoke(); return; }
        revokeRef.current = clip.revoke;
        setState({ status: "ready", url: clip.url });
      })
      .catch((e) => {
        if (alive) setState({ status: "error", error: classifyClipError(e) });
      });
    return () => {
      alive = false;
      revokeRef.current?.();
      revokeRef.current = null;
    };
  }, [reportId, span.startMs, span.endMs]);

  const who = span.speakerRole || span.speaker
    ? speakerLabel(span.speaker, span.speakerRole, lang)
    : null;

  return (
    <div className="replay-player" data-testid="replay-player" role="group"
         aria-label={tr(lang, "Аудіозапис фрагмента", "Recorded moment")}>
      <div className="replay-player-h">
        {who && (
          <span className="replay-speaker" data-testid="replay-speaker">
            <Icon name="user" size={11} /> {who}
          </span>
        )}
        <span className="replay-range mono">{formatRange(span.startMs, span.endMs)}</span>
        {!span.exact && (
          <span className="replay-approx" data-testid="replay-approx">
            {tr(lang, "приблизний момент", "approximate moment")}
          </span>
        )}
        <span className="spacer" />
        <button type="button" className="iconbtn" onClick={onClose}
                aria-label={tr(lang, "Закрити", "Close")}>
          <Icon name="x" size={12} />
        </button>
      </div>

      {state.status === "loading" && (
        <div className="replay-note muted">{tr(lang, "Готуємо запис…", "Preparing the recording…")}</div>
      )}

      {state.status === "ready" && (
        // No `autoplay`: sound in a clinical review starts when the clinician
        // says so, not when a component mounts.
        <audio
          className="replay-audio"
          data-testid="replay-audio"
          controls
          preload="metadata"
          src={state.url}
        />
      )}

      {state.status === "error" && (
        <div className="replay-note replay-degraded" data-testid="replay-degraded">
          <Icon name="info" size={12} />
          <span>{degradedCopy(state.error, lang)}</span>
        </div>
      )}
    </div>
  );
}

function formatRange(startMs, endMs) {
  return `${clock(startMs)}–${clock(endMs)}`;
}

function clock(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
