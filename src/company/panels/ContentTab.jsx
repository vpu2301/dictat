// ContentTab.jsx — the three registries the platform's language actually lives
// in: report templates, NLP abbreviations, and search synonyms.
//
// Templates already had a tab. The other two had nothing: `GET/PUT/DELETE
// /nlp/abbreviations` has had a client in src/api/nlp.js that no screen ever
// called, and `/v1/synonyms` had no client at all — so the dictionary that
// decides whether "ЧСС" expands to "частота серцевих скорочень", and the one
// that decides whether a search for "набряк" also finds "едема", were both
// editable only with curl. That is content the vendor curates, which makes this
// console the right place for it.
//
// Everything here is live and tenant-scoped. Two asymmetries the UI has to be
// honest about rather than smooth over:
//
//   · Abbreviations come back as ONE list mixing shipped rows and this
//     tenant's overrides (`is_tenant_override`). A PUT always writes a tenant
//     row — it never edits the shipped one — so "editing" a system abbreviation
//     silently creates a shadow. The rows say which they are.
//   · Synonym groups carry `source`. A system group is the platform's and
//     answers 403 to PUT/DELETE, so those controls are not rendered for it.
//
// Language sets differ by service and that is not a bug: nlp-service speaks
// uk/en/de, report-service content is uk/en. See dictation/languages.js.

import React, { useMemo, useState } from "react";
import { useAsync } from "../../api/useAsync.js";
import { Panel, PanelState } from "../../components/dashboard/Panel.jsx";
import { StatCard } from "../../components/dashboard/StatCard.jsx";
import { StatusBadge } from "../../components/dashboard/StatusBadge.jsx";
import { Icon } from "../../components/UI.jsx";
import { ApiErrorView } from "../../components/ApiErrorView.jsx";
import { tr } from "../../i18n.js";
import { Provenance } from "../provenance.jsx";
import { fetchContentRegistry } from "../../api/company.js";
import { upsertAbbreviation, deleteAbbreviation } from "../../api/nlp.js";
import {
  createSynonymGroup, updateSynonymGroup, deleteSynonymGroup,
  parseTerms, validateGroup, isEditable, SYNONYM_LANGS, SYNONYM_MAX_TERMS,
} from "../../api/synonyms.js";
import { DICTATION_CODES } from "../../dictation/languages.js";

const DIRECTIONS = [
  { id: "expand",  uk: "розгортати",   en: "expand",  hintUk: "ЧСС → частота серцевих скорочень", hintEn: "abbrev → full form" },
  { id: "compact", uk: "згортати",     en: "compact", hintUk: "повна форма → скорочення",         hintEn: "full form → abbrev" },
  { id: "either",  uk: "в обидва боки", en: "either",  hintUk: "залежно від контексту",            hintEn: "whichever fits" },
];

export function ContentTab({ lang, navigate }) {
  const T = (uk, en) => tr(lang, uk, en);
  const [langFilter, setLangFilter] = useState("");
  const req = useAsync(() => fetchContentRegistry({ language: langFilter || undefined }), [langFilter]);
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState(null);

  const d = req.data;

  const run = async (key, fn) => {
    setBusy(key); setActionError(null);
    try { await fn(); req.reload(); }
    catch (e) { setActionError(e); }
    finally { setBusy(null); }
  };

  return (
    <div className="co-stack">
      <div className="co-note">
        <Icon name="info" size={13} />
        <span>
          {T("Мова продукту: шаблони, скорочення й синоніми пошуку. Правки застосовуються до активного тенанта й одразу впливають на диктування та пошук.",
             "The product's vocabulary: templates, abbreviations and search synonyms. Edits apply to the active tenant and take effect on dictation and search immediately.")}
          {" "}<Provenance source="live" lang={lang} note="GET /templates + /nlp/abbreviations + /v1/synonyms" />
        </span>
      </div>

      <div className="co-kpis">
        <StatCard label={T("Шаблони", "Templates")} icon="layers" accent
                  loading={req.loading} error={req.error || d?.templates.error}
                  value={d?.templates.total ?? "—"}
                  sublabel={d ? `${d.templates.tenant} ${T("власних", "tenant-owned")}` : undefined}>
          <Provenance source="live" lang={lang} note="GET /templates" />
        </StatCard>
        <StatCard label={T("Скорочення", "Abbreviations")} icon="book"
                  loading={req.loading} error={req.error || d?.abbreviations.error}
                  value={d?.abbreviations.total ?? "—"} approx={d?.abbreviations.capped}
                  sublabel={d ? `${d.abbreviations.overrides} ${T("перевизначень", "overrides")}` : undefined}>
          <Provenance source="live" lang={lang} note="GET /nlp/abbreviations" />
        </StatCard>
        <StatCard label={T("Групи синонімів", "Synonym groups")} icon="copy"
                  loading={req.loading} error={req.error || d?.synonyms.error}
                  value={d?.synonyms.total ?? "—"}
                  sublabel={d ? `${d.synonyms.tenant} ${T("власних", "tenant")} · ${d.synonyms.system} ${T("системних", "system")}` : undefined}>
          <Provenance source="live" lang={lang} note="GET /v1/synonyms" />
        </StatCard>
        <StatCard label={T("Термінів у словнику", "Terms in the dictionary")} icon="list"
                  loading={req.loading} error={req.error || d?.synonyms.error}
                  value={d?.synonyms.terms ?? "—"}
                  sublabel={T("розширюють кожен пошук звіту", "each one widens a report search")}>
          <Provenance source="derived" lang={lang} note="sum of terms[] across every group" />
        </StatCard>
      </div>

      {actionError && <ApiErrorView error={actionError} lang={lang} />}

      <div className="co-toolbar">
        <div className="co-segmented" role="tablist" aria-label={T("Мова", "Language")}>
          <button className={langFilter === "" ? "on" : ""} onClick={() => setLangFilter("")}
                  aria-pressed={langFilter === ""}>{T("Усі мови", "All languages")}</button>
          {DICTATION_CODES.map((c) => (
            <button key={c} className={langFilter === c ? "on" : ""} aria-pressed={langFilter === c}
                    onClick={() => setLangFilter(c)}>{c.toUpperCase()}</button>
          ))}
        </div>
        <span className="co-cell-sub">
          {T("Фільтр мови стосується скорочень — nlp-service приймає uk/en/de, тоді як синоніми та шаблони існують лише для uk/en.",
             "The language filter applies to abbreviations — nlp-service takes uk/en/de, while synonyms and templates exist for uk/en only.")}
        </span>
      </div>

      <Panel title={T("Скорочення", "Abbreviations")} icon="book"
             sub={d ? `${d.abbreviations.total}${d.abbreviations.capped ? `+ (${T("обмежено", "capped at")} ${d.abbreviations.cap})` : ""}` : undefined}>
        {(req.loading || req.error || !d) ? (
          <PanelState loading={req.loading} error={req.error} onRetry={req.reload} lang={lang} />
        ) : d.abbreviations.error ? (
          <ApiErrorView error={d.abbreviations.error} lang={lang} onRetry={req.reload} />
        ) : (
          <>
            <AbbreviationForm lang={lang} busy={busy === "abbr-add"}
                              defaultLang={langFilter || "uk"}
                              onSubmit={(body) => run("abbr-add", () => upsertAbbreviation(body))} />
            {!d.abbreviations.items.length ? (
              <div className="co-empty">
                {T("Жодного скорочення для цього фільтра.", "No abbreviations for this filter.")}
              </div>
            ) : (
              <div className="co-tablewrap">
                <table className="co-table co-table-dense">
                  <thead>
                    <tr>
                      <th>{T("Скорочення", "Short")}</th><th>{T("Повна форма", "Expansion")}</th>
                      <th>{T("Напрям", "Direction")}</th><th>{T("Мова", "Lang")}</th>
                      <th>{T("Джерело", "Source")}</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {d.abbreviations.items.map((a) => (
                      <tr key={a.id}>
                        <td><code>{a.abbreviated}</code></td>
                        <td>{a.expanded}</td>
                        <td className="co-cell-sub">{a.direction}</td>
                        <td className="co-cell-sub">{a.language}</td>
                        <td>
                          {a.is_tenant_override
                            ? <StatusBadge tone="info" label={T("клініка", "tenant")} />
                            : <StatusBadge tone="muted" label={T("платформа", "platform")} />}
                        </td>
                        <td className="co-rowactions">
                          {a.is_tenant_override ? (
                            <button className="co-search-x" disabled={busy === a.id}
                                    title={T("Видалити перевизначення", "Delete this override")}
                                    aria-label={T("Видалити", "Delete")}
                                    onClick={() => run(a.id, () => deleteAbbreviation(a.id))}>
                              <Icon name="x" size={13} />
                            </button>
                          ) : (
                            <span className="co-cell-sub" title={T("Рядок платформи — редагування створює перевизначення для клініки", "A platform row — editing it creates a tenant override")}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="co-cell-sub">
              {T("PUT завжди пише рядок клініки. Щоб «змінити» скорочення платформи, додайте своє з тим самим скороченням — воно перекриє системне для цього тенанта.",
                 "A PUT always writes a tenant row. To \"change\" a platform abbreviation, add your own with the same short form — it shadows the shipped one for this tenant.")}
            </p>
          </>
        )}
      </Panel>

      <Panel title={T("Синоніми пошуку", "Search synonyms")} icon="copy"
             sub={d ? `${d.synonyms.total}` : undefined}>
        {(req.loading || req.error || !d) ? (
          <PanelState loading={req.loading} error={req.error} onRetry={req.reload} lang={lang} />
        ) : d.synonyms.error ? (
          <ApiErrorView error={d.synonyms.error} lang={lang} onRetry={req.reload} />
        ) : (
          <>
            <SynonymForm lang={lang} busy={busy === "syn-add"}
                         onSubmit={(body) => run("syn-add", () => createSynonymGroup(body))} />
            {!d.synonyms.items.length ? (
              <div className="co-empty">
                {T("Словник порожній — пошук звітів шукатиме лише дослівні збіги.",
                   "The dictionary is empty — report search will only match literally.")}
              </div>
            ) : (
              <ul className="co-flaglist">
                {d.synonyms.items.map((g) => (
                  <SynonymRow key={g.group_id} g={g} lang={lang} busy={busy === g.group_id}
                              onSave={(body) => run(g.group_id, () => updateSynonymGroup(g.group_id, body))}
                              onDelete={() => run(g.group_id, () => deleteSynonymGroup(g.group_id))} />
                ))}
              </ul>
            )}
          </>
        )}
      </Panel>

      <Panel title={T("Шаблони", "Templates")} icon="layers">
        {(req.loading || req.error || !d) ? (
          <PanelState loading={req.loading} error={req.error} onRetry={req.reload} lang={lang} />
        ) : d.templates.error ? (
          <ApiErrorView error={d.templates.error} lang={lang} onRetry={req.reload} />
        ) : (
          <>
            <dl className="co-facts">
              <dt>{T("Усього", "Total")}</dt><dd>{d.templates.total}</dd>
              <dt>{T("Власних клініки", "Tenant-owned")}</dt><dd>{d.templates.tenant}</dd>
              <dt>{T("Застарілих", "Deprecated")}</dt><dd>{d.templates.deprecated}</dd>
              {Object.entries(d.templates.byLanguage).map(([k, n]) => (
                <React.Fragment key={k}>
                  <dt>{T("Мова", "Language")} {k}</dt><dd>{n}</dd>
                </React.Fragment>
              ))}
            </dl>
            <button className="co-link" onClick={() => navigate("/company/templates")}>
              {T("Редактор шаблонів", "Template editor")} <Icon name="chevRight" size={12} />
            </button>
          </>
        )}
      </Panel>
    </div>
  );
}

function AbbreviationForm({ lang, busy, defaultLang, onSubmit }) {
  const T = (uk, en) => tr(lang, uk, en);
  const [short, setShort] = useState("");
  const [expanded, setExpanded] = useState("");
  const [direction, setDirection] = useState("expand");
  const [language, setLanguage] = useState(defaultLang);
  const hint = DIRECTIONS.find((x) => x.id === direction);

  return (
    <form className="co-addmember" onSubmit={(e) => {
      e.preventDefault();
      if (!short.trim() || !expanded.trim()) return;
      onSubmit({
        language,
        abbreviated: short.trim(),
        expanded: expanded.trim(),
        direction,
        case_sensitive: true,
      });
      setShort(""); setExpanded("");
    }}>
      <input value={short} onChange={(e) => setShort(e.target.value)} disabled={busy} maxLength={50}
             placeholder={T("скорочення", "short form")} aria-label={T("Скорочення", "Short form")} />
      <input value={expanded} onChange={(e) => setExpanded(e.target.value)} disabled={busy} maxLength={200}
             placeholder={T("повна форма", "expansion")} aria-label={T("Повна форма", "Expansion")} />
      <select value={direction} onChange={(e) => setDirection(e.target.value)} disabled={busy}
              aria-label={T("Напрям", "Direction")}>
        {DIRECTIONS.map((x) => <option key={x.id} value={x.id}>{T(x.uk, x.en)}</option>)}
      </select>
      <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={busy}
              aria-label={T("Мова", "Language")}>
        {DICTATION_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <button type="submit" className="colog-btn primary co-btn-sm" disabled={busy || !short.trim() || !expanded.trim()}>
        <Icon name="plus" size={12} /> {busy ? T("Збереження…", "Saving…") : T("Додати", "Add")}
      </button>
      <span className="co-cell-sub">{hint ? T(hint.hintUk, hint.hintEn) : ""}</span>
    </form>
  );
}

function SynonymForm({ lang, busy, onSubmit }) {
  const T = (uk, en) => tr(lang, uk, en);
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("uk");
  const terms = parseTerms(text);
  const problem = validateGroup({ language, terms });

  return (
    <form className="co-addmember" onSubmit={(e) => {
      e.preventDefault();
      if (problem) return;
      onSubmit({ language, terms });
      setText("");
    }}>
      <input value={text} onChange={(e) => setText(e.target.value)} disabled={busy}
             placeholder={T("терміни через кому: набряк, набряки, едема", "comma-separated terms: oedema, edema, swelling")}
             aria-label={T("Терміни групи", "Group terms")} />
      <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={busy}
              aria-label={T("Мова", "Language")}>
        {SYNONYM_LANGS.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <button type="submit" className="colog-btn primary co-btn-sm" disabled={busy || !!problem}>
        <Icon name="plus" size={12} /> {busy ? T("Збереження…", "Saving…") : T("Створити групу", "Create group")}
      </button>
      <span className="co-cell-sub">
        {text.trim() === "" ? T(`Від 2 до ${SYNONYM_MAX_TERMS} термінів.`, `Between 2 and ${SYNONYM_MAX_TERMS} terms.`)
          : problem === "too_few" ? T("Потрібно щонайменше два терміни — один розширюється сам у себе.",
                                      "At least two terms — one expands to itself.")
          : problem === "too_many" ? T(`Максимум ${SYNONYM_MAX_TERMS} термінів у групі.`, `At most ${SYNONYM_MAX_TERMS} terms per group.`)
          : `${terms.length} ${T("термінів", "terms")}`}
      </span>
    </form>
  );
}

function SynonymRow({ g, lang, busy, onSave, onDelete }) {
  const T = (uk, en) => tr(lang, uk, en);
  const editable = isEditable(g);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(() => (g.terms || []).join(", "));
  const terms = useMemo(() => parseTerms(text), [text]);
  const problem = validateGroup({ language: g.language, terms });

  return (
    <li>
      {editing ? (
        <>
          <input className="co-syn-edit" value={text} onChange={(e) => setText(e.target.value)}
                 disabled={busy} aria-label={T("Терміни групи", "Group terms")} />
          <button className="colog-btn co-btn-sm" disabled={busy} onClick={() => { setEditing(false); setText((g.terms || []).join(", ")); }}>
            {T("Скасувати", "Cancel")}
          </button>
          <button className="colog-btn primary co-btn-sm" disabled={busy || !!problem}
                  onClick={() => { onSave({ language: g.language, terms }); setEditing(false); }}>
            {busy ? T("Збереження…", "Saving…") : T("Зберегти", "Save")}
          </button>
        </>
      ) : (
        <>
          <code>{(g.terms || []).join(" · ")}</code>
          <span className="co-cell-sub">{g.language}</span>
          {editable
            ? <StatusBadge tone="info" label={T("клініка", "tenant")} />
            : <StatusBadge tone="muted" label={T("платформа", "platform")} />}
          {editable && (
            <>
              <button className="colog-btn co-btn-sm" disabled={busy} onClick={() => setEditing(true)}>
                {T("Змінити", "Edit")}
              </button>
              <button className="co-search-x" disabled={busy} onClick={onDelete}
                      title={T("Видалити групу", "Delete group")} aria-label={T("Видалити", "Delete")}>
                <Icon name="x" size={13} />
              </button>
            </>
          )}
        </>
      )}
    </li>
  );
}
