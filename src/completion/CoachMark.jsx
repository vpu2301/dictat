// CoachMark.jsx — the one-time explanation of ghost text (sprint 15).
//
// Generated content that appears inside a medical record must say what it is
// the FIRST time a clinician meets it. Once. After that the visual grammar
// (dim italic + the ✦ mark) carries the meaning on its own, and a repeated
// coach-mark would be nagging rather than honesty.
//
// Anchored to the caret so it points at the thing it explains. Dismisses on
// its own after a read-length pause, and remembers per user — the flag lives
// in localStorage next to the autocomplete prefs, not on the server: this is a
// property of "have I seen it", not of the account.

import React, { useEffect, useState } from "react";
import { tr } from "../i18n.js";

const KEY = (sub) => `mdx.layerc.coach.v1.${sub || "anon"}`;
const VISIBLE_MS = 7_000;

export function coachMarkSeen(sub) {
  try { return localStorage.getItem(KEY(sub)) === "1"; } catch { return true; }
}

export function markCoachMarkSeen(sub) {
  try { localStorage.setItem(KEY(sub), "1"); } catch { /* private mode — show it again, harmless */ }
}

export function GhostCoachMark({ anchor, lang, onDone }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setLeaving(true); onDone?.(); }, VISIBLE_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  if (leaving || !anchor) return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const width = Math.min(340, vw - 16);
  const left = Math.max(8, Math.min(anchor.left, vw - width - 8));

  return (
    <div
      className="layerc-coach"
      role="note"
      data-testid="layerc-coach"
      style={{ position: "fixed", left, top: anchor.bottom + 10, width }}
    >
      <span className="layerc-coach-mark" aria-hidden="true">✦</span>
      <span>
        {tr(lang,
          "Продовження, запропоноване ШІ — Tab, щоб прийняти",
          "AI-suggested continuation — press Tab to accept")}
      </span>
      <button
        type="button"
        className="layerc-coach-x"
        tabIndex={-1}
        aria-label={tr(lang, "Зрозуміло", "Got it")}
        onMouseDown={(e) => { e.preventDefault(); setLeaving(true); onDone?.(); }}
      >
        ✕
      </button>
    </div>
  );
}
