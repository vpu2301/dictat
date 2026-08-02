// SearchTips.jsx — "how does this search actually behave?" (sprint 15).
//
// The content is NOT written here. It comes from GET /v1/search/tips, because
// the backend is the only thing that knows what its own tsquery does: ADR-0021
// chose the `simple` FTS config with no stemming, filters compose with AND, and
// synonyms expand server-side. A hardcoded copy in this file would be a promise
// the search engine never made — and would silently rot the first time the
// query pipeline changed.
//
// So: no fallback text, no "helpful" rewording. If the endpoint cannot answer,
// the popover says it cannot answer.

import React, { useEffect, useRef, useState } from "react";
import { getSearchTips } from "../api/reports.js";
import { tr } from "../i18n.js";
import { Icon } from "../components/UI.jsx";

export function SearchTips({ lang }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ status: "idle" });
  const wrapRef = useRef(null);

  // Which language we have already asked for. A ref, not state: keying the
  // effect on its own `status` would cancel the very fetch it just started
  // (setState → re-run → cleanup → the answer lands on a dead closure).
  const fetchedFor = useRef(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Fetched on first open, not on mount: nobody pays for documentation they
  // did not ask for. Re-fetched when the UI language changes, because the tips
  // are localized server-side — not translated here.
  useEffect(() => {
    if (!open || fetchedFor.current === lang) return;
    fetchedFor.current = lang;
    setState({ status: "loading" });
    getSearchTips(lang)
      .then((r) => {
        if (mounted.current) setState({ status: "ready", tips: Array.isArray(r?.tips) ? r.tips : [] });
      })
      .catch(() => {
        // Let the next open try again — a 500 now is not a permanent verdict.
        fetchedFor.current = null;
        if (mounted.current) setState({ status: "error" });
      });
  }, [open, lang]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div className="search-tips-wrap" ref={wrapRef}>
      <button
        type="button"
        className={"btn ghost sm search-tips-btn" + (open ? " accent" : "")}
        data-testid="search-tips-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title={tr(lang, "Як працює пошук", "How search works")}
      >
        <Icon name="info" size={13} />
        <span>{tr(lang, "Як шукати", "Search tips")}</span>
      </button>

      {open && (
        <div className="search-tips-pop" role="dialog" data-testid="search-tips-pop"
             aria-label={tr(lang, "Як працює пошук", "How search works")}>
          {state.status === "loading" && (
            <div className="psub">{tr(lang, "Завантаження…", "Loading…")}</div>
          )}
          {state.status === "error" && (
            <div className="psub" data-testid="search-tips-error">
              {tr(lang,
                "Не вдалося отримати опис поведінки пошуку від сервера.",
                "Could not fetch the search behaviour description from the server.")}
            </div>
          )}
          {state.status === "ready" && state.tips.length === 0 && (
            <div className="psub">{tr(lang, "Немає підказок", "No tips")}</div>
          )}
          {state.status === "ready" && state.tips.map((t) => (
            <div className="search-tip" key={t.key} data-testid={`search-tip-${t.key}`}>
              <div className="search-tip-h">{t.title}</div>
              <div className="search-tip-b">{t.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
