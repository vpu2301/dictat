// Pagination.jsx — shared pager used by every screen that lists big data sets.
//
// Two modes, one component:
//   • Numbered mode — pass `pageCount` (total pages known, e.g. client-side
//     slicing of a fully-loaded list). Renders windowed page-number buttons.
//   • Cursor mode   — omit `pageCount` (forward-only server cursor, total
//     unknown). Renders a "Page N" label with Prev / Next driven by
//     `hasPrev` / `hasNext`.
//
// Presentational only: the caller owns page state and supplies onPrev/onNext
// (and onPage in numbered mode).

import React from "react";
import { Icon } from "./UI.jsx";
import { tr } from "../i18n.js";

// First, last, and a small window around the current page, with ellipses.
function pageWindow(page, pageCount, around = 1) {
  const out = [];
  const lo = Math.max(2, page - around);
  const hi = Math.min(pageCount - 1, page + around);
  out.push(1);
  if (lo > 2) out.push("…");
  for (let n = lo; n <= hi; n++) out.push(n);
  if (hi < pageCount - 1) out.push("…");
  if (pageCount > 1) out.push(pageCount);
  return out;
}

export function Pagination({
  page,                 // 1-based current page
  pageCount = null,     // total pages if known → numbered mode
  hasPrev,              // cursor mode override (defaults from page/pageCount)
  hasNext,
  onPrev,
  onNext,
  onPage,               // (n) => void, numbered mode only
  loading = false,
  lang = "en",
  total = null,         // optional item count for the "X of Y" hint
  pageSize = null,
  pageSizeOptions = null, // e.g. [10, 20, 50, 100] → renders a per-page <select>
  onPageSizeChange,       // (n) => void
}) {
  const numbered = Number.isFinite(pageCount) && pageCount > 0;
  const canPrev = (hasPrev ?? page > 1) && !loading;
  const canNext = (hasNext ?? (numbered ? page < pageCount : false)) && !loading;
  const showSizer = Array.isArray(pageSizeOptions) && pageSizeOptions.length > 0 && onPageSizeChange;

  // Single page with nothing more to load → nothing to page through. Still show
  // the pager if it carries a page-size selector the user can act on.
  if (numbered && pageCount <= 1 && !canNext && !canPrev && !showSizer) return null;

  const prevLabel = tr(lang, "Назад", "Prev");
  const nextLabel = tr(lang, "Далі", "Next");
  const perPageLabel = tr(lang, "На сторінці", "Per page");

  let rangeHint = null;
  if (total != null && pageSize) {
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);
    rangeHint = lang === "uk" ? `${from}–${to} з ${total}` : `${from}–${to} of ${total}`;
  }

  return (
    <nav className="pager" aria-label={tr(lang, "Пагінація", "Pagination")}>
      <button className="btn pager-arrow" onClick={onPrev} disabled={!canPrev}>
        <Icon name="chevLeft" size={13} />
        <span>{prevLabel}</span>
      </button>

      {numbered ? (
        <div className="pager-pages">
          {pageWindow(page, pageCount).map((n, i) =>
            n === "…" ? (
              <span key={`gap-${i}`} className="pager-gap">…</span>
            ) : (
              <button
                key={n}
                className={"pager-num" + (n === page ? " on" : "")}
                aria-current={n === page ? "page" : undefined}
                onClick={() => n !== page && onPage?.(n)}
                disabled={loading}
              >
                {n}
              </button>
            )
          )}
        </div>
      ) : (
        <span className="pager-label">
          {loading
            ? (tr(lang, "Завантаження…", "Loading…"))
            : (lang === "uk" ? `Сторінка ${page}` : `Page ${page}`)}
        </span>
      )}

      <button className="btn pager-arrow" onClick={onNext} disabled={!canNext}>
        <span>{nextLabel}</span>
        <Icon name="chevRight" size={13} />
      </button>

      {rangeHint && <span className="pager-range muted">{rangeHint}</span>}

      {showSizer && (
        <label className="pager-size">
          <span className="muted">{perPageLabel}</span>
          <select
            value={pageSize ?? ""}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            disabled={loading}
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      )}
    </nav>
  );
}
