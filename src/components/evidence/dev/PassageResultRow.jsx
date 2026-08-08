// PassageResultRow.jsx — one retrieved passage (EVA-S03).
//
// Rank, badges, section breadcrumb, excerpt, and a scores popover. Everything
// derived lives in passageView.js; this file draws and handles the disclosure.
//
// A11y: the row is an <li> in an ordered list, so rank is announced by the
// list itself as well as printed; the popover is a real <button> + region, so
// it opens on Enter/Space and closes on Escape.
import React, { useEffect, useRef, useState } from "react";
import {
  excerpt, identity, looksLikeTable, metaBadges,
  offsetLabel, scoreRows, sectionCrumbs, stateChips, formatScore,
} from "./passageView.js";

function ScoresPopover({ passage, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="evd-popover"
      role="dialog"
      aria-label="Retrieval scores"
      tabIndex={-1}
      ref={ref}
      data-testid="scores-popover"
    >
      <table className="evd-scores">
        <thead>
          <tr><th scope="col">stage</th><th scope="col">score</th></tr>
        </thead>
        <tbody>
          {scoreRows(passage).map((row) => (
            <tr key={row.stage} data-stage={row.stage} data-ran={String(row.ran)}>
              <th scope="row">{row.stage}</th>
              <td className={row.ran ? "" : "evd-muted"}>{row.display}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="evd-ids">
        {identity(passage).map((row) => (
          <React.Fragment key={row.key}>
            <dt>{row.label}</dt>
            <dd><code>{row.value}</code></dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}

export function PassageResultRow({ passage, rank }) {
  const [showScores, setShowScores] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const badges = metaBadges(passage);
  const states = stateChips(passage);
  const crumbs = sectionCrumbs(passage.section_path);
  const body = showFull ? { text: passage.text, truncated: false } : excerpt(passage.text);
  const offsets = offsetLabel(passage);

  return (
    <li className="evd-row" data-testid="passage-row" data-passage-id={passage.id}>
      <div className="evd-row-head">
        <span className="evd-rank" aria-label={`rank ${rank}`}>#{rank}</span>
        <span className="evd-score" data-testid="passage-score">
          {formatScore(passage.score ?? passage.scores?.final ?? null)}
        </span>
        <button
          type="button"
          className="btn btn-ghost evd-scores-btn"
          aria-expanded={showScores}
          onClick={() => setShowScores((v) => !v)}
          data-testid="scores-toggle"
        >
          scores
        </button>
        {showScores && <ScoresPopover passage={passage} onClose={() => setShowScores(false)} />}
      </div>

      <ul className="evd-badges" aria-label="Passage metadata">
        {badges.map((b) => (
          <li key={b.key}>
            <span className={`evd-badge evd-badge-${b.kind} ${b.muted ? "evd-muted" : ""}`} data-value={b.value ?? ""}>
              {b.label}
            </span>
          </li>
        ))}
        {states.map((c) => (
          <li key={c.key}>
            <span className={`evd-badge evd-tone-${c.tone}`} title={c.title} data-testid={`state-${c.key}`}>
              {c.label}
            </span>
          </li>
        ))}
      </ul>

      {crumbs.length > 0 && (
        <nav className="evd-crumbs" aria-label="Section">
          {crumbs.map((c, i) => (
            <span key={`${c}-${i}`}>
              {i > 0 && <span className="evd-crumb-sep" aria-hidden="true">›</span>}
              <span className="evd-crumb">{c}</span>
            </span>
          ))}
        </nav>
      )}

      <p className={`evd-text ${looksLikeTable(passage.text) ? "evd-text-table" : ""}`} data-testid="passage-text">
        {body.text}
      </p>
      {body.truncated && (
        <button type="button" className="btn btn-ghost evd-more" onClick={() => setShowFull(true)}>
          show full passage
        </button>
      )}

      <p className="evd-row-foot">
        <span>{passage.published_at || "no publication date"}</span>
        {offsets && <span>{offsets}</span>}
        <span>{passage.connector_id}</span>
      </p>
    </li>
  );
}
