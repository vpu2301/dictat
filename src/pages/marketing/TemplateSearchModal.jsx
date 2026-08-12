// TemplateSearchModal.jsx — the search overlay for /templates.
//
// Clicking the toolbar's search field opens this instead of typing inline. The
// catalogue is ~100 templates across eleven specialties, and an inline field
// filters a grid the reader then has to scroll and scan; a palette answers the
// question where it was asked — type, read the hits, press Enter, land on the
// template.
//
// The field in the toolbar is NOT replaced by a button. It stays a real input
// with the page's real query in it, so a visitor who lands with a filter
// already applied sees it, and so the page keeps working if this component
// never mounts. Opening the palette is an enhancement layered on the focus
// event, not a rewrite of the control.
//
// ── Keyboard ──────────────────────────────────────────────────────────────
// ↑ / ↓ move, Enter opens, Esc closes, Tab is trapped inside. That is the
// contract for a dialog, and a search palette that traps focus but cannot be
// driven from the keyboard is worse than the input it replaced.
//
// ── Focus ─────────────────────────────────────────────────────────────────
// The trigger is a focusable input, so simply closing would return focus to
// it — which re-fires the focus handler and reopens the dialog. `onClose` is
// therefore told whether the close was a cancel (Esc, backdrop) or a commit
// (a result was chosen); the caller blurs the trigger on cancel and navigates
// away on commit, and neither path loops.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/UI.jsx";
import { TEMPLATES, categoryLabel, searchTemplates } from "./templates.js";

const MAX_HITS = 8;

/* Shown before anything is typed: the templates marked `popular` in the
   catalogue, which is the same set the gallery badges with a star. An empty
   palette is a dead end — it makes the reader guess what is searchable. */
const SUGGESTED = TEMPLATES.filter((t) => t.popular).slice(0, MAX_HITS);

export function TemplateSearchModal({ lang, L, strings, initialQuery = "", onClose, onPick }) {
  const [q, setQ] = useState(initialQuery);
  const [i, setI] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const cardRef = useRef(null);

  const hits = useMemo(() => {
    const term = q.trim();
    if (!term) return SUGGESTED;
    return searchTemplates(TEMPLATES, term, lang).slice(0, MAX_HITS);
  }, [q, lang]);

  /* The highlight resets whenever the result set changes; leaving it where it
     was points at whatever has since moved into that row. */
  useEffect(() => { setI(0); }, [q]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();

    /* The page behind must not scroll while a dialog is over it. Restored on
       unmount rather than set from a boolean, so two overlapping overlays
       cannot leave the body locked. */
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const commit = (tpl) => { if (tpl) onPick(tpl); };

  const onKeyDown = (e) => {
    if (e.key === "Escape") { e.preventDefault(); onClose("cancel"); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setI((n) => (n + 1) % Math.max(1, hits.length)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setI((n) => (n - 1 + hits.length) % Math.max(1, hits.length)); return; }
    if (e.key === "Enter") { e.preventDefault(); commit(hits[i]); return; }
    if (e.key === "Tab") {
      /* Two focusables in here — the input and the close button — so the trap
         is a wrap rather than a full tabbable-node walk. */
      const focusables = cardRef.current?.querySelectorAll("input, button");
      if (!focusables || !focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  /* Keep the highlighted row in view when it is driven from the keyboard. */
  useEffect(() => {
    listRef.current?.querySelector('[data-on="1"]')?.scrollIntoView({ block: "nearest" });
  }, [i]);

  return (
    <div
      className="tpl-modal-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose("cancel"); }}
    >
      <div
        className="tpl-modal"
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={L(strings.search)}
        onKeyDown={onKeyDown}
      >
        <div className="tpl-modal-field">
          <Icon name="search" size={17} />
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={L(strings.search)}
            aria-label={L(strings.search)}
            /* Not type="search": the browser's own clear affordance sits where
               the close button is and fires no event this dialog can see. */
            autoComplete="off"
            spellCheck="false"
          />
          <button type="button" className="tpl-modal-close" onClick={() => onClose("cancel")}
            aria-label={L(strings.close)}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="tpl-modal-body">
          <p className="tpl-modal-label">
            {q.trim() ? `${hits.length} ${L(strings.found)}` : L(strings.suggested)}
          </p>

          {hits.length ? (
            <ul className="tpl-modal-list" ref={listRef} role="listbox" aria-label={L(strings.search)}>
              {hits.map((t, n) => (
                <li key={t.slug}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={n === i}
                    data-on={n === i ? "1" : "0"}
                    className={`tpl-modal-hit${n === i ? " is-on" : ""}`}
                    /* Pointer moves the highlight so mouse and keyboard never
                       disagree about which row Enter would open. */
                    onMouseEnter={() => setI(n)}
                    onClick={() => commit(t)}
                  >
                    <span className="tpl-modal-hit-icon"><Icon name={t.icon} size={16} /></span>
                    <span className="tpl-modal-hit-text">
                      <span className="tpl-modal-hit-name">{t.name[lang] ?? t.name.en}</span>
                      <span className="tpl-modal-hit-tag">{t.tag[lang] ?? t.tag.en}</span>
                    </span>
                    <span className="tpl-modal-hit-cat">{categoryLabel(t.cat, lang)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="tpl-modal-empty">{L(strings.none)}</p>
          )}
        </div>

        <div className="tpl-modal-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> {L(strings.hintMove)}</span>
          <span><kbd>↵</kbd> {L(strings.hintOpen)}</span>
          <span><kbd>Esc</kbd> {L(strings.hintClose)}</span>
        </div>
      </div>
    </div>
  );
}
