// NoteStructuresPage.jsx — the "Note templates" tab of the Templates library.
//
// Same surface as the report-templates and forms tabs (TemplatesPage): a
// toolbar of search + filters, one `.ptable` list with starrable rows, a pager,
// and a preview modal. It lived inline in Scribe.jsx as a bare three-column
// table, which read as a different product from the two tabs beside it.
//
// What the two tabs have that this one cannot: GET /note-structures returns a
// fixed catalogue of `{code, name, sections:[{key,label}]}` — no specialty, no
// language, no origin, no status, and nothing writable. So the specialty /
// language / custom-only / deprecated filters have nothing to bind to and are
// not faked; the filters here are the ones the data supports (search, section,
// starred), rendered with the same controls.

import React, { useMemo, useState, useCallback, useEffect } from "react";
import { Icon, Empty } from "./UI.jsx";
import { Loading, asList } from "./DataStates.jsx";
import { ApiErrorView } from "./ApiErrorView.jsx";
import { Pagination } from "./Pagination.jsx";
import { MenuSelect } from "./MenuSelect.jsx";
import { useAsync } from "../api/useAsync.js";
import { getStarredIds, toggleStar } from "../api/templatePrefs.js";
import { listNoteStructures } from "../api/notes.js";
import { tr } from "../i18n.js";

const T = (lang, uk, en) => tr(lang, uk, en);

const PAGE_SIZE_OPTIONS = [12, 24, 48, 96];

// Section labels arrive as plain strings today, but the rest of the app ships
// {uk,en} objects on the same kind of field — keep tolerating both.
function loc(v, lang) {
  if (v == null) return "";
  if (typeof v === "object") return v[lang] ?? v.en ?? Object.values(v)[0] ?? "";
  return v;
}

// Structures have a `code`, not an `id`, and they share the template star store
// — namespace the key so "soap" can never collide with a template UUID.
const starKey = (t) => `note:${t.code || ""}`;

const sectionsOf = (t) => (Array.isArray(t.sections) ? t.sections : []);
const sectionLine = (t, lang) =>
  loc(t.description ?? t.desc, lang)
  || sectionsOf(t).map((s) => loc(s.label, lang)).join(" · ");

export function NoteStructuresPage({ lang, embedded = false }) {
  const req = useAsync(() => listNoteStructures(), []);

  const [search, setSearch] = useState("");
  const [section, setSection] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const [openCode, setOpenCode] = useState(null);

  const [stars, setStars] = useState(() => getStarredIds());
  const onToggleStar = useCallback((t) => {
    toggleStar(starKey(t));
    setStars(getStarredIds());
  }, []);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  const all = useMemo(() => asList(req.data), [req.data]);

  // The section picker is derived from the catalogue rather than hard-coded:
  // the structures are a backend constant that can grow a section any release.
  const sectionOptions = useMemo(() => {
    const seen = new Map();
    all.forEach((t) => sectionsOf(t).forEach((s) => {
      if (s?.key && !seen.has(s.key)) seen.set(s.key, loc(s.label, lang) || s.key);
    }));
    return [...seen.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [all, lang]);

  const list = useMemo(() => {
    let out = all;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((t) =>
        `${loc(t.name, lang)} ${t.code || ""} ${sectionLine(t, lang)}`.toLowerCase().includes(q));
    }
    if (section) out = out.filter((t) => sectionsOf(t).some((s) => s.key === section));
    if (starredOnly) out = out.filter((t) => stars.has(starKey(t)));
    // Starred first, otherwise server order (SOAP, APSO, DAP, free).
    return out.slice().sort((a, b) =>
      (stars.has(starKey(b)) ? 1 : 0) - (stars.has(starKey(a)) ? 1 : 0));
  }, [all, search, section, starredOnly, stars, lang]);

  const starredCount = all.filter((t) => stars.has(starKey(t))).length;

  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageItems = useMemo(
    () => list.slice((safePage - 1) * pageSize, safePage * pageSize),
    [list, safePage, pageSize],
  );

  useEffect(() => {
    setPage(1);
  }, [search, section, starredOnly]);

  const open = all.find((t) => t.code === openCode) || null;

  return (
    <div className={embedded ? "page-embedded" : "page"}>
      {!embedded && (
        <div className="page-h">
          <div>
            <h1>{T(lang, "Шаблони нотаток", "Note templates")}</h1>
            <p className="sub">
              {all.length} {T(lang, "структур", "structures")}
              {` · ${T(lang, "лише перегляд", "read-only")}`}
            </p>
          </div>
        </div>
      )}

      {/* Toolbar — same controls, same order as the report-templates tab. */}
      <div className="ptable-toolbar" style={{ marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <label className="search-input">
          <Icon name="search" size={14} />
          <input
            placeholder={T(lang, "Пошук шаблону…", "Search note templates…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <MenuSelect
          icon="filter"
          value={section}
          onChange={setSection}
          ariaLabel={T(lang, "Розділ", "Section")}
          options={[
            { value: "", label: T(lang, "Всі розділи", "All sections") },
            ...sectionOptions,
          ]}
        />

        <button
          type="button"
          className={"tpl-filter-chip" + (starredOnly ? " on" : "")}
          onClick={() => setStarredOnly((v) => !v)}
          aria-pressed={starredOnly}
        >
          <Icon name="star" size={12} fill={starredOnly ? "currentColor" : "none"} />
          <span>{T(lang, "Лише обрані", "Starred only")}{starredCount > 0 ? ` (${starredCount})` : ""}</span>
        </button>

        <div style={{ flex: 1 }} />
      </div>

      {req.loading ? (
        <Loading lang={lang} />
      ) : req.error ? (
        <ApiErrorView error={req.error} lang={lang} onRetry={req.reload} />
      ) : list.length === 0 ? (
        <Empty
          icon="layers"
          title={T(lang, "Шаблонів не знайдено", "No note templates found")}
          body={all.length === 0
            ? T(lang, "Каталог структур нотаток порожній.", "The note-structure catalogue is empty.")
            : T(lang, "Спробуйте змінити фільтри.", "Try adjusting the filters.")}
        />
      ) : (
        <>
          <div className="ptable">
            <div className="tpl-thead nst">
              <span>{T(lang, "Назва", "Name")}</span>
              <span>{T(lang, "Код", "Code")}</span>
              <span>{T(lang, "Розділи", "Sections")}</span>
              <span>{T(lang, "Походження", "Origin")}</span>
              <span>{T(lang, "Структура", "Structure")}</span>
            </div>
            {pageItems.map((t) => (
              <StructureRow
                key={t.code}
                t={t}
                lang={lang}
                starred={stars.has(starKey(t))}
                onToggleStar={() => onToggleStar(t)}
                onOpen={() => setOpenCode(t.code)}
              />
            ))}
          </div>
          <Pagination
            page={safePage}
            pageCount={pageCount}
            onPage={setPage}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
            total={list.length}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
            lang={lang}
          />
        </>
      )}

      {open && (
        <StructureDetailModal t={open} lang={lang} onClose={() => setOpenCode(null)} />
      )}
    </div>
  );
}

function StructureRow({ t, lang, starred, onToggleStar, onOpen }) {
  return (
    <div
      className="tpl-trow nst"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
    >
      <div className="tpl-trow-name">
        <button
          type="button"
          className={"tpl-star-btn sm" + (starred ? " on" : "")}
          onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
          aria-pressed={starred}
          title={starred
            ? T(lang, "Прибрати з обраних", "Remove from starred")
            : T(lang, "Додати в обрані", "Add to starred")}
        >
          <Icon name="star" size={15} fill={starred ? "currentColor" : "none"} />
        </button>
        <div className="tpl-card-icon"><Icon name="layers" size={16} /></div>
        <span>{loc(t.name, lang)}</span>
      </div>
      <span className="tpl-cell-mut">{t.code ? <code>{t.code}</code> : null}</span>
      <span className="tpl-cell-mut">{sectionsOf(t).length}</span>
      <span>
        {/* Every structure is a platform constant — there are no tenant ones. */}
        <span className="tpl-badge system">
          <Icon name="shield" size={10} />
          {T(lang, "Системний", "System")}
        </span>
      </span>
      <span className="tpl-cell-mut">{sectionLine(t, lang)}</span>
    </div>
  );
}

// Preview only — note structures are a backend constant, so there is nothing
// to clone, edit or deprecate the way there is on a report template.
function StructureDetailModal({ t, lang, onClose }) {
  const sections = sectionsOf(t);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="tpl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tpl-modal-head">
          <div>
            <h2>{loc(t.name, lang)}</h2>
            <p>{T(lang, "Структура розділів для редактора нотаток",
                        "Section structure for the note editor")}</p>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <div className="tpl-modal-body">
          <div className="tpl-detail-meta">
            {t.code && <span className="chip">{t.code}</span>}
            <span className="tpl-badge system">
              <Icon name="shield" size={10} />
              {T(lang, "Системний", "System")}
            </span>
          </div>

          <div className="rail-h" style={{ padding: "12px 0 8px", fontSize: 11 }}>
            {T(lang, "РОЗДІЛИ", "SECTIONS")} · {sections.length}
          </div>
          <div className="tpl-detail-sections">
            {sections.map((s, i) => (
              <div key={s.key || i} className="tpl-detail-row">
                <div className="tpl-sec-num">{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tpl-detail-row-head">
                    <span style={{ fontWeight: 600 }}>{loc(s.label, lang)}</span>
                    {s.key && <code className="tpl-sec-id">{s.key}</code>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="tpl-modal-foot">
          <button className="btn" onClick={onClose}>{T(lang, "Закрити", "Close")}</button>
        </div>
      </div>
    </div>
  );
}
