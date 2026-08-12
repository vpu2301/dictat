// SearchPalette.jsx — the topbar search, made real.
//
// The field in the topbar had never had a handler. It was disabled and labelled
// "coming soon" for a good reason, written into UI.jsx at the time: a search box
// that accepts a query and does nothing is worse than no search box, because an
// auditor hunting an event will type into it and believe the empty result.
//
// This is the handler. Two sources, both with genuine server-side search:
//
//   patients — GET /patients?query=      (canReadPatients)
//   reports  — GET /v1/reports?query=    (hasClinicalAccess)
//
// Templates are NOT in here: listTemplates has no `query` parameter, and
// fetching the whole catalogue on every keystroke to filter it in the browser
// would be a worse answer than leaving them out and saying so.
//
// A MODAL rather than a dropdown under the field, because the results are
// records: a patient row is PHI the moment it renders, and a dialog is the one
// container that takes the whole screen's attention, traps focus, and closes on
// Escape without leaving a list of names hanging over the page behind it.
//
// Two properties the implementation turns on:
//
//   · EVERY request is abortable and stale answers are dropped. Typing
//     "petrenko" fires several searches; without this the answer to "pet" can
//     land after the answer to "petrenko" and replace it, which in a patient
//     search means showing the wrong people under the right query.
//   · One source failing does not empty the palette. Reports being down must
//     not hide the patients that did come back — the note says which half is
//     missing.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Icon, Modal } from "./UI.jsx";
import { tr } from "../i18n.js";
import { useClaims } from "../auth/AuthContext.jsx";
import { canReadPatients, hasClinicalAccess } from "../auth/roles.js";
import { listPatients, displayName, yearOfBirth } from "../api/patients.js";
import { listReports } from "../api/reports.js";

// Long enough that a single letter does not query the roster, short enough that
// an MRN prefix or "ІП" works.
const MIN_CHARS = 2;
// One keystroke is not a query. 220ms is about a fast typist's inter-key gap.
const DEBOUNCE_MS = 220;
const PER_SOURCE = 6;

function useDebounced(value, ms) {
  const [out, setOut] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setOut(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return out;
}

export function SearchPalette({ lang = "uk", navigate, onClose }) {
  const claims = useClaims();
  const mayPatients = canReadPatients(claims);
  const mayReports = hasClinicalAccess(claims);
  const T = (uk, en) => tr(lang, uk, en);

  const [raw, setRaw] = useState("");
  const query = useDebounced(raw.trim(), DEBOUNCE_MS);
  const [state, setState] = useState({ loading: false, patients: [], reports: [], failed: [] });
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (query.length < MIN_CHARS) {
      setState({ loading: false, patients: [], reports: [], failed: [] });
      return undefined;
    }
    const ac = new AbortController();
    let alive = true;
    setState((s) => ({ ...s, loading: true }));

    // Both sources run in parallel and each settles on its own: a slow reports
    // search must not hold up the patients the clinician is looking for.
    const jobs = [
      mayPatients
        ? listPatients({ query, limit: PER_SOURCE }, { signal: ac.signal })
            .then((p) => ({ kind: "patients", items: p?.items || [] }))
            .catch((e) => ({ kind: "patients", error: e }))
        : null,
      mayReports
        ? listReports({ query, limit: PER_SOURCE }, { signal: ac.signal })
            .then((p) => ({ kind: "reports", items: p?.items || [] }))
            .catch((e) => ({ kind: "reports", error: e }))
        : null,
    ].filter(Boolean);

    Promise.all(jobs).then((results) => {
      // The guard that makes stale answers harmless.
      if (!alive) return;
      const next = { loading: false, patients: [], reports: [], failed: [] };
      for (const r of results) {
        if (r.error) {
          // An abort is not a failure — it is this effect being superseded.
          // Checked on the SIGNAL, not on the error's name: client.js wraps
          // every fetch rejection as ApiError(0, "Network error"), so an
          // AbortError arrives here unrecognisable and would otherwise be
          // reported to the reader as "reports could not be searched".
          if (!ac.signal.aborted) next.failed.push(r.kind);
        } else {
          next[r.kind] = r.items;
        }
      }
      setState(next);
      setCursor(0);
    });

    return () => { alive = false; ac.abort(); };
  }, [query, mayPatients, mayReports]);

  // One flat list is what the arrow keys move through; the headers are drawn
  // from it rather than the other way round.
  const rows = useMemo(() => {
    const out = [];
    for (const p of state.patients) {
      const yob = yearOfBirth(p);
      out.push({
        key: `p:${p.id}`,
        group: "patients",
        icon: "users",
        title: displayName(p, lang) || p.id,
        meta: [p.mrn, yob ? `${T("нар.", "b.")} ${yob}` : null].filter(Boolean).join(" · "),
        href: `/patients/${p.id}`,
      });
    }
    for (const r of state.reports) {
      out.push({
        key: `r:${r.id}`,
        group: "reports",
        icon: "fileText",
        title: r.title?.[lang] || r.title?.uk || r.title?.en || r.code || r.id,
        meta: [r.code, r.status].filter(Boolean).join(" · "),
        href: `/dictate/reports/${r.id}`,
      });
    }
    return out;
  }, [state.patients, state.reports, lang]);

  const open = useCallback((row) => {
    if (!row) return;
    if (navigate) navigate(row.href);
    if (onClose) onClose();
  }, [navigate, onClose]);

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((i) => Math.min(rows.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); open(rows[cursor]); }
  };

  // Keep the cursor in view without stealing focus from the input — the arrow
  // keys must keep working while the list scrolls.
  useEffect(() => {
    listRef.current?.querySelector('[data-cur="1"]')?.scrollIntoView({ block: "nearest" });
  }, [cursor, rows.length]);

  const groups = [
    { key: "patients", label: T("Пацієнти", "Patients") },
    { key: "reports", label: T("Звіти", "Reports") },
  ];
  const short = query.length > 0 && query.length < MIN_CHARS;
  const nothing = !state.loading && query.length >= MIN_CHARS && rows.length === 0;

  return (
    <Modal onClose={onClose} className="search-modal">
      <div className="sp-head">
        <Icon name="search" size={16} />
        <input
          ref={inputRef}
          className="sp-input"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={T("Пацієнт, звіт, код…", "Patient, report, code…")}
          aria-label={T("Пошук", "Search")}
          role="combobox"
          aria-expanded={rows.length > 0}
          aria-controls="sp-results"
          autoComplete="off"
          spellCheck="false"
        />
        <kbd className="sp-esc">esc</kbd>
      </div>

      <div className="sp-body" id="sp-results" ref={listRef} role="listbox" aria-label={T("Результати", "Results")}>
        {short && <p className="sp-hint">{T("Введіть щонайменше два символи.", "Type at least two characters.")}</p>}
        {!query && (
          <p className="sp-hint">
            {mayPatients || mayReports
              ? T("Шукайте за іменем, MRN або кодом звіту.", "Search by name, MRN or report code.")
              : T("Ваша роль не має доступу до пацієнтів або звітів.", "Your role has no access to patients or reports.")}
          </p>
        )}
        {state.loading && <p className="sp-hint">{T("Пошук…", "Searching…")}</p>}
        {nothing && <p className="sp-hint">{T("Нічого не знайдено.", "Nothing found.")}</p>}

        {groups.map((g) => {
          const items = rows.filter((r) => r.group === g.key);
          if (!items.length) return null;
          return (
            <section className="sp-group" key={g.key}>
              <h3 className="sp-group-h">{g.label}</h3>
              {items.map((row) => {
                const i = rows.indexOf(row);
                const on = i === cursor;
                return (
                  <button
                    type="button"
                    key={row.key}
                    role="option"
                    aria-selected={on}
                    data-cur={on ? "1" : "0"}
                    className={`sp-row${on ? " on" : ""}`}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => open(row)}
                  >
                    <Icon name={row.icon} size={14} />
                    <span className="sp-row-t">{row.title}</span>
                    {row.meta && <span className="sp-row-m">{row.meta}</span>}
                  </button>
                );
              })}
            </section>
          );
        })}

        {/* Which half is missing, when one source fails. Silence here would
            read as "there are no reports matching", which is a different and
            wrong statement. */}
        {state.failed.length > 0 && (
          <p className="sp-fail" role="status">
            {state.failed.includes("patients") && state.failed.includes("reports")
              ? T("Пошук недоступний — сервіси не відповідають.", "Search is unavailable — the services did not answer.")
              : state.failed.includes("patients")
                ? T("Пацієнтів знайти не вдалося; показано лише звіти.", "Patients could not be searched; showing reports only.")
                : T("Звітів знайти не вдалося; показано лише пацієнтів.", "Reports could not be searched; showing patients only.")}
          </p>
        )}
      </div>

      <div className="sp-foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> {T("вибір", "move")}</span>
        <span><kbd>↵</kbd> {T("відкрити", "open")}</span>
        {/* Templates are absent on purpose — see the file header. */}
        <span className="sp-foot-note">{T("Пацієнти та звіти", "Patients and reports")}</span>
      </div>
    </Modal>
  );
}
