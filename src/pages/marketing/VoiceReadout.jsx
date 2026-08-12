// VoiceReadout.jsx — the "what it is hearing right now" strip.
//
// Two instances on the landing page, one object: under the hero's claim chips
// on white paper, and inside the evidence constellation on the dark band. It
// is the site's smallest, most literal demonstration — a microphone level, the
// word HEARS, and a sentence a clinician just said.
//
// CONTROLLED OR SELF-DRIVEN, on purpose:
//   · the evidence band passes `index`, because there the phrase must agree
//     with whichever cluster is lit — including when a reader's hover picks
//     the cluster, which no timer inside this component could know about;
//   · the hero passes nothing and lets it cycle on its own.
// Both paths run the same markup, so the two readouts can never drift apart
// visually the way two copies of this would.
//
// `prefers-reduced-motion` stops the rotation rather than merely stopping the
// animation. A caption that silently rewrites itself every five seconds is
// motion whether or not it slides while it does it, and it is the harder kind
// to look away from — text changing under the eye pulls attention back every
// time. Under the setting it prints one line and stays there.

import React, { useEffect, useState } from "react";

const DEFAULT_DWELL = 5200;

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;   /* no matchMedia — assume motion is fine */
  }
}

/* Shared by both readouts and by the evidence graph, which needs the same
 * cadence for its cluster rotation. `paused` is the hover case: the reader
 * pointing at something outranks the timer. */
export function useRotation(count, { dwell = DEFAULT_DWELL, paused = false } = {}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (paused || count < 2 || prefersReducedMotion()) return undefined;
    const id = setInterval(() => setI((n) => (n + 1) % count), dwell);
    return () => clearInterval(id);
  }, [count, dwell, paused]);
  return [i, setI];
}

/**
 * @param lines  array of [uk, en] pairs
 * @param index  controlled position; omit to let it cycle on its own
 * @param tone   "light" (paper) | "dark" (the inverted band)
 * @param label  the tag before the sentence — "Чує" / "Hears"
 */
export function VoiceReadout({ lines, index, tone = "light", label, lang = "en", dwell }) {
  const controlled = typeof index === "number";
  const [self] = useRotation(controlled ? 0 : lines.length, { dwell });
  const at = controlled ? index : self;
  const line = lines[((at % lines.length) + lines.length) % lines.length];
  const text = lang === "uk" ? line[0] : line[1];

  return (
    <div className={`lp-voice is-${tone}`} aria-live="polite">
      {/* Five bars, the same object as the hero's background waveform and the
          recorder in the product. Decorative — the sentence is the content. */}
      <span className="lp-voice-bars" aria-hidden="true">
        <i /><i /><i /><i /><i />
      </span>
      <span className="lp-voice-tag">{label}</span>
      {/* Re-keyed on the text so React swaps the element and the fade runs
          again, rather than mutating a text node in place — which reads as a
          glitch rather than as a new sentence arriving. */}
      <span className="lp-voice-line" key={text}>{text}</span>
    </div>
  );
}
