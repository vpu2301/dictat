// SpeakerChip.js — the one-tap speaker control on a turn (sprint 14).
//
// Reuses the sprint-13 proposal grammar verbatim, because a speaker label IS a
// machine proposal and the product must not invent a second visual language
// for the same idea:
//   dashed outline + sparkle = the machine proposed this
//   solid + check            = the clinician ruled on it
// plus the three-bar ConfidenceDot for machine labels — never a raw percentage.
// The shape classes themselves come from the grammar's own helper
// (reports/proposal/grammarClass.js); this file adds only a colour tone.
//
// Four redundant channels carry the state (shape, icon, announced text,
// confidence bars); the doctor/patient COLOUR is a fifth, never the only one.
//
// Authored with createElement (not JSX) so the whole chip renders under
// `node --test` — the same reason the sprint-13 primitives are.

import React from "react";
import { SparkleIcon, CheckIcon } from "../reports/proposal/icons.js";
import { ConfidenceDot } from "../reports/proposal/ConfidenceDot.js";
import { chipClass, chipLabelClass } from "../reports/proposal/grammarClass.js";
import { speakerLabel, ariaTurn, flipHint } from "./copy.js";

const h = React.createElement;

// Tone drives the colour channel only. `unknown` is a visible neutral grey —
// an unresolved voice must LOOK unresolved, not quietly join a party.
export function toneFor(speaker, role) {
  if (role === "doctor") return "doctor";
  if (role === "patient") return "patient";
  if (speaker === "UNKNOWN") return "unknown";
  if (!speaker) return "pending";
  return speaker === "S1" ? "voice1" : "voice2";
}

export function SpeakerChip({
  speaker, role, confidence, source = "machine", lang = "uk",
  onFlip, onOpenMenu, disabled = false,
}) {
  const confirmed = source === "clinician";
  const label = speakerLabel(speaker, role, lang);
  const tone = toneFor(speaker, role);

  // Long-press opens the full menu on touch; the same affordance is a real
  // context menu / right-click on a pointer, and a keyboard user gets it with
  // the menu button that sits next to the chip in TurnBubble.
  let timer = null;
  const holdStart = () => {
    if (!onOpenMenu) return;
    timer = setTimeout(() => { timer = null; onOpenMenu(); }, 450);
  };
  const holdEnd = () => {
    if (timer) { clearTimeout(timer); timer = null; }
  };

  return h(
    "button",
    {
      type: "button",
      // Shape from the grammar; only the colour tone is ours.
      className: chipClass({ confirmed, extra: `cv-chip cv-${tone}` }),
      "data-testid": "speaker-chip",
      "data-speaker": speaker || "pending",
      "data-role": role || "",
      "data-source": source,
      "aria-label": ariaTurn(speaker, role, source, lang),
      title: flipHint(lang),
      disabled,
      onClick: onFlip,
      onContextMenu: onOpenMenu
        ? (e) => { e.preventDefault(); onOpenMenu(); }
        : undefined,
      onPointerDown: holdStart,
      onPointerUp: holdEnd,
      onPointerLeave: holdEnd,
    },
    confirmed ? h(CheckIcon, {}) : h(SparkleIcon, {}),
    h("span", { className: chipLabelClass() }, label),
    // A confirmed label is fact, not probability — no confidence meter on it.
    !confirmed && typeof confidence === "number"
      ? h(ConfidenceDot, { confidence, lang })
      : null,
  );
}
