// TurnList.jsx — the live, turn-structured transcript (sprint 14).
//
// Two design rules this file exists to keep:
//
//  1. TEXT NEVER WAITS FOR A LABEL. The bubble renders the words the moment
//     they arrive; the chip renders whatever the machine can honestly say
//     right now ("Визначається…"), and upgrades in place when the label lands.
//  2. RECOLOURING NEVER MOVES THE PAGE. A mapping flip repaints every bubble.
//     The autoscroll effect is keyed on CONTENT only, and only fires when the
//     clinician is already pinned to the bottom — so a recolour (or scrolling
//     back to check something) can never yank the view.

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SpeakerChip } from "./SpeakerChip.js";
import { chipPlaceholderClass } from "../reports/proposal/grammarClass.js";
import { roleOf } from "./mapping.js";
import { flipSpeaker, UNKNOWN } from "./turns.js";
import { chooseRole, chooseUnknown } from "./speakerActions.js";
import { assignDoctor, assignPatient, assignUnknown, speakerLabel } from "./copy.js";
import { tr } from "../i18n.js";

function SpeakerMenu({ lang, onPick, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="cv-menu" ref={ref} role="menu" data-testid="speaker-menu">
      <button type="button" role="menuitem" onClick={() => onPick("doctor")}>{assignDoctor(lang)}</button>
      <button type="button" role="menuitem" onClick={() => onPick("patient")}>{assignPatient(lang)}</button>
      <button type="button" role="menuitem" onClick={() => onPick("unknown")}>{assignUnknown(lang)}</button>
    </div>
  );
}

function TurnBubble({ turn, mapping, lang, onSetSpeaker, onAssignRole, readOnly }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const role = roleOf(mapping, turn.speaker);

  const flip = () => {
    if (readOnly) return;
    onSetSpeaker(turn.id, flipSpeaker(turn.speaker));
  };

  const pick = (choice) => {
    setMenuOpen(false);
    if (readOnly) return;
    const res = choice === "unknown"
      ? chooseUnknown()
      : chooseRole({ turnSpeaker: turn.speaker, mapping, role: choice });
    if (res.speaker) onSetSpeaker(turn.id, res.speaker);
    if (res.assign) onAssignRole(res.assign.label, res.assign.role);
  };

  const tone = role || (turn.speaker === UNKNOWN ? "unknown" : turn.speaker ? turn.speaker.toLowerCase() : "pending");

  return (
    <article
      className={`cv-turn cv-turn-${tone}${turn.source === "clinician" ? " is-confirmed" : ""}`}
      data-testid="turn"
      data-turn-id={turn.id}
      data-speaker={turn.speaker || "pending"}
      data-role={role || ""}
      data-source={turn.source}
    >
      <div className="cv-turn-head">
        <SpeakerChip
          speaker={turn.speaker}
          role={role}
          confidence={turn.confidence}
          source={turn.source}
          lang={lang}
          disabled={readOnly}
          onFlip={flip}
          onOpenMenu={readOnly ? undefined : () => setMenuOpen(true)}
        />
        {!readOnly && (
          <button
            type="button"
            className="cv-turn-more"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={tr(lang, `Вибрати мовця: ${speakerLabel(turn.speaker, role, lang)}`,
                                 `Choose speaker: ${speakerLabel(turn.speaker, role, lang)}`)}
            onClick={() => setMenuOpen((v) => !v)}
          >
            ⋯
          </button>
        )}
        {menuOpen && <SpeakerMenu lang={lang} onPick={pick} onClose={() => setMenuOpen(false)} />}
      </div>
      <p className="cv-turn-text">{turn.text}</p>
    </article>
  );
}

export function TurnList({ state, mapping, lang, onSetSpeaker, onAssignRole, readOnly = false, emptyHint }) {
  const scrollRef = useRef(null);
  const atBottomRef = useRef(true);
  const { turns, partial } = state;

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  // Content-keyed, bottom-pinned. `mapping` is deliberately NOT a dependency:
  // a SpeakerMappingUpdated recolour must not scroll anything.
  const lastText = turns.length ? turns[turns.length - 1].text : "";
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !atBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [turns.length, lastText, partial && partial.text]);

  return (
    <div className="cv-turns" ref={scrollRef} onScroll={onScroll} data-testid="turn-list">
      {!turns.length && !partial && (
        <p className="cv-turns-empty">{emptyHint}</p>
      )}
      {turns.map((t) => (
        <TurnBubble
          key={t.id}
          turn={t}
          mapping={mapping}
          lang={lang}
          onSetSpeaker={onSetSpeaker}
          onAssignRole={onAssignRole}
          readOnly={readOnly}
        />
      ))}
      {partial && (
        // The live tail. Rendered the instant text arrives, in the neutral
        // "resolving" treatment — labelling it before the machine has spoken
        // would be a guess presented as a reading.
        <article className="cv-turn cv-turn-partial" data-testid="turn-partial" aria-live="polite">
          <div className="cv-turn-head">
            <span className={chipPlaceholderClass({ extra: "cv-chip cv-pending" })} aria-hidden="true">
              {speakerLabel(partial.speaker, roleOf(mapping, partial.speaker), lang)}
            </span>
          </div>
          <p className="cv-turn-text">{partial.text}</p>
        </article>
      )}
    </div>
  );
}
