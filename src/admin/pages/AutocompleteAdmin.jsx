// AutocompleteAdmin.jsx — /admin/autocomplete: the clinic's suggestion corpus.
//
// Two tabs: «Фрази» (ranked completions) and «Сніпети» (/trigger → expansion).
// Three scopes surface here: system rows (platform-shipped, read-only),
// tenant rows (this clinic's — what an admin curates), user rows (personal).
// The acceptance columns are the nightly roll-up's real counters — the
// evidence of what clinicians actually use, which is the whole point of
// showing them next to the delete button.
//
// The PII gate: the backend refuses phrase/snippet text that looks like
// personal data (six detectors) with a coded 422. That code arrives as a
// Python-repr string inside problem `detail` (see pieces/problemCode.js);
// this page renders it as a clear Ukrainian sentence with the detector names,
// plus the honest caveat that bare digit runs (doses, lab values) can trip
// the phone detector.
import React, { useState } from "react";
import { Icon, Modal } from "../../components/UI.jsx";
import { ApiErrorView } from "../../components/ApiErrorView.jsx";
import { ConfirmDialog } from "../ConfirmDialog.jsx";
import { useLimitedList } from "../useLimitedList.js";
import {
  listPhrases, createPhrase, deletePhrase,
  listSnippets, createSnippet, deleteSnippet,
} from "../../api/autocomplete.js";
import { problemInfo } from "../pieces/problemCode.js";
import {
  phraseProblem, snippetProblem, PII_PATTERN_LABELS, PHRASE_MAX,
  SNIPPET_EXPANSION_MAX,
} from "../pieces/corpusRules.js";
import { isMfaEnrolmentRequired } from "../../auth/mfaGrace.js";
import { tr } from "../../i18n.js";

const AC_LANGS = ["uk", "en"];
const LIST_LIMIT = 100;
const SOURCES = ["system", "tenant", "user"];

const sourceLabel = (s, lang) =>
  s === "system" ? tr(lang, "системна", "system")
  : s === "tenant" ? tr(lang, "клініка", "clinic")
  : tr(lang, "особиста", "personal");

const fmtDate = (iso) => (iso ? String(iso).slice(0, 10) : null);

// ── Write-error rendering (shared by both tabs) ───────────────────────────
function WriteError({ err, lang, kind }) {
  const T = (uk, en) => tr(lang, uk, en);
  const info = problemInfo(err);

  if (info.code === "pii_detected") {
    return (
      <div className="admc-pii-alert" role="alert" data-testid="pii-alert">
        <Icon name="alert" size={16} />
        <div>
          <strong>
            {kind === "phrase"
              ? T("Ця фраза схожа на персональні дані — не збережено.",
                  "This phrase appears to contain personal data — not saved.")
              : T("Цей сніпет схожий на персональні дані — не збережено.",
                  "This snippet appears to contain personal data — not saved.")}
          </strong>
          <div className="admc-pii-patterns">
            {info.patterns.map((p) => (
              <span key={p} className="admc-chip admc-chip-warn" data-testid={`pii-pattern-${p}`}>
                {PII_PATTERN_LABELS[p] ? tr(lang, PII_PATTERN_LABELS[p].uk, PII_PATTERN_LABELS[p].en) : p}
              </span>
            ))}
          </div>
          <small className="muted">
            {T("Корпус підказок спільний і не має містити даних пацієнтів. Зверніть увагу: довгий ряд цифр (доза, аналіз) може хибно спрацювати як телефон — перепишіть його з одиницями чи роздільниками.",
               "The corpus is shared and must not contain patient data. Note: a bare digit run (a dose, a lab value) can false-positive as a phone number — rewrite it with units or separators.")}
          </small>
        </div>
      </div>
    );
  }
  if (info.code === "phrase_already_exists" || info.code === "snippet_already_exists") {
    return (
      <div className="adm-dialog-error" role="alert" data-testid="exists-alert">
        {kind === "phrase"
          ? T("Така фраза вже існує в цій області.", "This phrase already exists in this scope.")
          : T("Сніпет із таким тригером уже існує в цій області.", "A snippet with this trigger already exists in this scope.")}
      </div>
    );
  }
  if (info.code === "rate_limited") {
    return (
      <div className="adm-dialog-error" role="alert">
        {lang === "uk"
          ? `Забагато запитів. Спробуйте ще раз${info.retry_after ? ` за ${info.retry_after} с` : " трохи згодом"}.`
          : `Too many requests. Try again${info.retry_after ? ` in ${info.retry_after}s` : " shortly"}.`}
      </div>
    );
  }
  if (info.code === "forbidden_scope") {
    return (
      <div className="adm-dialog-error" role="alert">
        {T("Немає прав записувати в цю область.", "You may not write to this scope.")}
      </div>
    );
  }
  return <ApiErrorView error={err} lang={lang} />;
}

// ── Phrases tab ───────────────────────────────────────────────────────────
const EMPTY_PHRASE = { phrase: "", language: "uk", specialty: "", section_hint: "", source: "tenant" };

function PhrasesTab({ lang, onToast }) {
  const T = (uk, en) => tr(lang, uk, en);
  const [filters, setFilters] = useState({ language: "", source: "", specialty: "" });
  const list = useLimitedList(
    ({ limit }) => listPhrases({
      language: filters.language || undefined,
      source: filters.source || undefined,
      specialty: filters.specialty.trim() || undefined,
      limit,
    }),
    { limit: LIST_LIMIT, deps: [filters] },
  );

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    const local = phraseProblem(form.phrase);
    if (local) return; // the submit button is disabled anyway
    setSaving(true); setSaveError(null);
    try {
      const body = { phrase: form.phrase.trim(), language: form.language, source: form.source };
      if (form.specialty.trim()) body.specialty = form.specialty.trim();
      if (form.section_hint.trim()) body.section_hint = form.section_hint.trim();
      await createPhrase(body);
      setForm(null);
      list.reload();
      onToast?.(T("Фразу додано", "Phrase added"));
    } catch (err) {
      if (!isMfaEnrolmentRequired(err)) setSaveError(err);
    } finally { setSaving(false); }
  };

  const doDelete = async () => {
    setDeleting(true); setDeleteError(null);
    try {
      await deletePhrase(toDelete.id);
      setToDelete(null);
      list.reload();
      onToast?.(T("Фразу видалено", "Phrase removed"));
    } catch (err) {
      if (!isMfaEnrolmentRequired(err)) setDeleteError(err);
    } finally { setDeleting(false); }
  };

  const pct = (row) =>
    row.impression_count > 0
      ? `${Math.round((row.acceptance_count / row.impression_count) * 100)}%`
      : null;

  return (
    <>
      <div className="admc-toolbar">
        <div className="admc-segmented" role="tablist" aria-label={T("Мова", "Language")}>
          <button className={filters.language === "" ? "on" : ""}
                  onClick={() => setFilters({ ...filters, language: "" })}>{T("Усі", "All")}</button>
          {AC_LANGS.map((c) => (
            <button key={c} className={filters.language === c ? "on" : ""}
                    onClick={() => setFilters({ ...filters, language: c })}>{c.toUpperCase()}</button>
          ))}
        </div>
        <select value={filters.source} aria-label={T("Область", "Scope")}
                onChange={(e) => setFilters({ ...filters, source: e.target.value })}
                data-testid="phrase-source-filter">
          <option value="">{T("всі області", "all scopes")}</option>
          {SOURCES.map((s) => <option key={s} value={s}>{sourceLabel(s, lang)}</option>)}
        </select>
        <input className="admc-filter-input" value={filters.specialty}
               placeholder={T("спеціальність…", "specialty…")}
               onChange={(e) => setFilters({ ...filters, specialty: e.target.value })} />
        <button className="btn btn-primary" data-testid="phrase-add"
                onClick={() => { setSaveError(null); setForm({ ...EMPTY_PHRASE, language: filters.language || "uk" }); }}>
          <Icon name="plus" size={13} /> {T("Додати фразу", "Add a phrase")}
        </button>
      </div>

      {list.error && <ApiErrorView error={list.error} lang={lang} onRetry={list.reload} />}

      {!list.error && (
        <section className="card">
          <table className="adm-table" data-testid="phrases-table">
            <thead>
              <tr>
                <th>{T("Фраза", "Phrase")}</th>
                <th style={{ width: 55 }}>{T("Мова", "Lang")}</th>
                <th>{T("Спеціальність", "Specialty")}</th>
                <th style={{ width: 95 }}>{T("Область", "Scope")}</th>
                <th style={{ width: 80 }} title={T("Скільки разів підказку показано", "Times the suggestion was shown")}>
                  {T("Показів", "Shown")}
                </th>
                <th style={{ width: 90 }} title={T("Скільки разів підказку прийнято", "Times the suggestion was accepted")}>
                  {T("Прийнять", "Accepted")}
                </th>
                <th style={{ width: 55 }}>%</th>
                <th style={{ width: 110 }}>{T("Востаннє", "Last used")}</th>
                <th style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {!list.loading && list.items.length === 0 && (
                <tr><td colSpan={9} className="admc-empty-cell">
                  {T("Фраз немає — додайте перші, і клініка бачитиме їх у підказках редактора.",
                     "No phrases yet — add the first ones and the clinic sees them as editor suggestions.")}
                </td></tr>
              )}
              {list.items.map((row) => (
                <tr key={row.id}>
                  <td>{row.phrase}</td>
                  <td><code className="mono">{row.language}</code></td>
                  <td>{row.specialty || <span className="muted">—</span>}</td>
                  <td><span className={`admc-badge admc-badge-${row.source}`}>{sourceLabel(row.source, lang)}</span></td>
                  <td className="admc-num">{row.impression_count}</td>
                  <td className="admc-num">{row.acceptance_count}</td>
                  <td className="admc-num">{pct(row) || <span className="muted">—</span>}</td>
                  <td>{fmtDate(row.last_accepted_at) || <span className="muted">—</span>}</td>
                  <td>
                    {row.source !== "system" && (
                      <button className="btn sm adm-danger-link" data-testid="phrase-delete"
                              onClick={() => { setDeleteError(null); setToDelete(row); }}>
                        {T("Видалити", "Delete")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.hasNext && (
            <div className="adm-table-foot">
              <span className="muted">
                {lang === "uk"
                  ? `Показано перші ${LIST_LIMIT} — звузьте фільтри.`
                  : `Showing the first ${LIST_LIMIT} — narrow the filters.`}
              </span>
            </div>
          )}
        </section>
      )}

      {form && (
        <PhraseFormModal lang={lang} form={form} setForm={setForm} saving={saving}
                         error={saveError} onSubmit={save} onClose={() => setForm(null)} />
      )}

      {toDelete && (
        <ConfirmDialog
          lang={lang} danger
          title={T("Видалити фразу?", "Delete this phrase?")}
          consequence={T(
            "Фраза зникне з підказок редактора для всіх, кому була видима. Лічильники використання буде втрачено.",
            "The phrase disappears from editor suggestions for everyone who saw it. Its usage counters are lost.")}
          confirmLabel={T("Видалити", "Delete")}
          busy={deleting}
          error={deleteError ? <WriteError err={deleteError} lang={lang} kind="phrase" /> : null}
          onConfirm={doDelete}
          onCancel={() => setToDelete(null)}
          testId="phrase-delete-confirm"
        >
          <div className="adm-dialog-person">{toDelete.phrase}</div>
        </ConfirmDialog>
      )}
    </>
  );
}

function PhraseFormModal({ lang, form, setForm, saving, error, onSubmit, onClose }) {
  const T = (uk, en) => tr(lang, uk, en);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const local = phraseProblem(form.phrase);

  return (
    <Modal className="dialog-modal admc-form-modal" onClose={() => { if (!saving) onClose(); }}>
      <div className="modal-h">
        <h2>{T("Нова фраза", "New phrase")}</h2>
        <p>
          {T("Фраза з'являтиметься як підказка в редакторі звітів. Корпус спільний — без даних пацієнтів.",
             "The phrase appears as an editor suggestion. The corpus is shared — no patient data.")}
        </p>
      </div>
      <form className="modal-body admc-form" onSubmit={onSubmit} data-testid="phrase-form">
        <label>
          <span>{T("Фраза", "Phrase")} <small className="muted">1–{PHRASE_MAX}</small></span>
          <input value={form.phrase} onChange={set("phrase")} disabled={saving}
                 maxLength={PHRASE_MAX} data-testid="phrase-text"
                 placeholder={T("аускультація легень без хрипів", "lungs clear to auscultation")} />
        </label>
        <label>
          <span>{T("Мова", "Language")}</span>
          <select value={form.language} onChange={set("language")} disabled={saving}>
            {AC_LANGS.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
          </select>
        </label>
        <label>
          <span>{T("Область", "Scope")}</span>
          <select value={form.source} onChange={set("source")} disabled={saving}
                  data-testid="phrase-scope">
            <option value="tenant">{T("для всієї клініки", "for the whole clinic")}</option>
            <option value="user">{T("лише для мене", "just for me")}</option>
          </select>
        </label>
        <label>
          <span>{T("Спеціальність (необов'язково)", "Specialty (optional)")}</span>
          <input value={form.specialty} onChange={set("specialty")} disabled={saving} maxLength={64} />
        </label>
        <label>
          <span>{T("Розділ (необов'язково)", "Section hint (optional)")}</span>
          <input value={form.section_hint} onChange={set("section_hint")} disabled={saving}
                 placeholder={T("обстеження", "exam")} />
        </label>
        {error && <WriteError err={error} lang={lang} kind="phrase" />}
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            {T("Скасувати", "Cancel")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || !!local}
                  data-testid="phrase-save">
            {saving ? "…" : T("Зберегти", "Save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Snippets tab ──────────────────────────────────────────────────────────
const EMPTY_SNIPPET = { trigger: "", expansion: "", cursor_position: "", language: "uk", source: "tenant" };

function SnippetsTab({ lang, onToast }) {
  const T = (uk, en) => tr(lang, uk, en);
  const [filters, setFilters] = useState({ language: "", source: "" });
  const list = useLimitedList(
    ({ limit }) => listSnippets({
      language: filters.language || undefined,
      source: filters.source || undefined,
      limit,
    }),
    { limit: LIST_LIMIT, deps: [filters] },
  );

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    const cursor = form.cursor_position === ""
      ? form.expansion.length
      : Number(form.cursor_position);
    if (snippetProblem({ trigger: form.trigger, expansion: form.expansion, cursor_position: cursor })) return;
    setSaving(true); setSaveError(null);
    try {
      await createSnippet({
        trigger: form.trigger, expansion: form.expansion,
        cursor_position: cursor, language: form.language, source: form.source,
      });
      setForm(null);
      list.reload();
      onToast?.(T("Сніпет додано", "Snippet added"));
    } catch (err) {
      if (!isMfaEnrolmentRequired(err)) setSaveError(err);
    } finally { setSaving(false); }
  };

  const doDelete = async () => {
    setDeleting(true); setDeleteError(null);
    try {
      await deleteSnippet(toDelete.id);
      setToDelete(null);
      list.reload();
      onToast?.(T("Сніпет видалено", "Snippet removed"));
    } catch (err) {
      if (!isMfaEnrolmentRequired(err)) setDeleteError(err);
    } finally { setDeleting(false); }
  };

  return (
    <>
      <div className="admc-toolbar">
        <div className="admc-segmented" role="tablist" aria-label={T("Мова", "Language")}>
          <button className={filters.language === "" ? "on" : ""}
                  onClick={() => setFilters({ ...filters, language: "" })}>{T("Усі", "All")}</button>
          {AC_LANGS.map((c) => (
            <button key={c} className={filters.language === c ? "on" : ""}
                    onClick={() => setFilters({ ...filters, language: c })}>{c.toUpperCase()}</button>
          ))}
        </div>
        <select value={filters.source} aria-label={T("Область", "Scope")}
                onChange={(e) => setFilters({ ...filters, source: e.target.value })}>
          <option value="">{T("всі області", "all scopes")}</option>
          {SOURCES.map((s) => <option key={s} value={s}>{sourceLabel(s, lang)}</option>)}
        </select>
        <button className="btn btn-primary" data-testid="snippet-add"
                onClick={() => { setSaveError(null); setForm({ ...EMPTY_SNIPPET }); }}>
          <Icon name="plus" size={13} /> {T("Додати сніпет", "Add a snippet")}
        </button>
      </div>

      {list.error && <ApiErrorView error={list.error} lang={lang} onRetry={list.reload} />}

      {!list.error && (
        <section className="card">
          <table className="adm-table" data-testid="snippets-table">
            <thead>
              <tr>
                <th style={{ width: 130 }}>{T("Тригер", "Trigger")}</th>
                <th>{T("Розгортання", "Expansion")}</th>
                <th style={{ width: 55 }}>{T("Мова", "Lang")}</th>
                <th style={{ width: 95 }}>{T("Область", "Scope")}</th>
                <th style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {!list.loading && list.items.length === 0 && (
                <tr><td colSpan={5} className="admc-empty-cell">
                  {T("Сніпетів немає. Сніпет — це «/тригер», що розгортається в заготовлений текст.",
                     "No snippets yet. A snippet is a “/trigger” that expands into prepared text.")}
                </td></tr>
              )}
              {list.items.map((row) => (
                <tr key={row.id}>
                  <td><code className="mono">/{row.trigger}</code></td>
                  <td className="admc-expansion" title={row.expansion}>{row.expansion}</td>
                  <td><code className="mono">{row.language}</code></td>
                  <td><span className={`admc-badge admc-badge-${row.source}`}>{sourceLabel(row.source, lang)}</span></td>
                  <td>
                    {row.source !== "system" && (
                      <button className="btn sm adm-danger-link" data-testid="snippet-delete"
                              onClick={() => { setDeleteError(null); setToDelete(row); }}>
                        {T("Видалити", "Delete")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {form && (
        <SnippetFormModal lang={lang} form={form} setForm={setForm} saving={saving}
                          error={saveError} onSubmit={save} onClose={() => setForm(null)} />
      )}

      {toDelete && (
        <ConfirmDialog
          lang={lang} danger
          title={T("Видалити сніпет?", "Delete this snippet?")}
          consequence={T(
            "«/» + тригер перестане розгортатися для всіх, кому сніпет був видимий.",
            "“/” + trigger stops expanding for everyone who could see this snippet.")}
          confirmLabel={T("Видалити", "Delete")}
          busy={deleting}
          error={deleteError ? <WriteError err={deleteError} lang={lang} kind="snippet" /> : null}
          onConfirm={doDelete}
          onCancel={() => setToDelete(null)}
          testId="snippet-delete-confirm"
        >
          <div className="adm-dialog-person"><code className="mono">/{toDelete.trigger}</code></div>
        </ConfirmDialog>
      )}
    </>
  );
}

function SnippetFormModal({ lang, form, setForm, saving, error, onSubmit, onClose }) {
  const T = (uk, en) => tr(lang, uk, en);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const cursor = form.cursor_position === "" ? form.expansion.length : Number(form.cursor_position);
  const local = form.trigger || form.expansion
    ? snippetProblem({ trigger: form.trigger, expansion: form.expansion, cursor_position: cursor })
    : "empty";
  const localMsg = {
    trigger_slash: T("Тригер зберігається без початкового «/» — приберіть його.",
                     "The trigger is stored without the leading “/” — drop it."),
    trigger_format: T("Тригер: 2–32 символи, латиниця в нижньому регістрі, цифри, «-», «_», починається з літери.",
                      "Trigger: 2–32 chars, lower-case latin, digits, “-”, “_”, starts with a letter."),
    expansion_too_long: T("Розгортання завелике (до 4000 символів).", "Expansion too long (4000 chars max)."),
    cursor_out_of_range: T("Позиція курсора виходить за межі тексту.", "Cursor position is outside the text."),
  }[local];

  return (
    <Modal className="dialog-modal admc-form-modal" onClose={() => { if (!saving) onClose(); }}>
      <div className="modal-h">
        <h2>{T("Новий сніпет", "New snippet")}</h2>
        <p>
          {T("У редакторі сніпет викликається як «/тригер». Курсор стане на вказану позицію в розгорнутому тексті.",
             "In the editor the snippet is invoked as “/trigger”. The cursor lands at the given position in the expanded text.")}
        </p>
      </div>
      <form className="modal-body admc-form" onSubmit={onSubmit} data-testid="snippet-form">
        <label>
          <span>{T("Тригер (без «/»)", "Trigger (no “/”)")}</span>
          <input value={form.trigger} onChange={set("trigger")} disabled={saving}
                 maxLength={32} placeholder="bp" data-testid="snippet-trigger" />
        </label>
        <label>
          <span>{T("Розгортання", "Expansion")} <small className="muted">1–{SNIPPET_EXPANSION_MAX}</small></span>
          <textarea rows={4} value={form.expansion} onChange={set("expansion")} disabled={saving}
                    maxLength={SNIPPET_EXPANSION_MAX} data-testid="snippet-expansion"
                    placeholder={T("АТ ___/___ мм рт. ст.", "BP ___/___ mmHg")} />
        </label>
        <label>
          <span>{T("Позиція курсора (порожньо — в кінці)", "Cursor position (empty — at the end)")}</span>
          <input type="number" min="0" max={form.expansion.length} value={form.cursor_position}
                 onChange={set("cursor_position")} disabled={saving} data-testid="snippet-cursor" />
        </label>
        <label>
          <span>{T("Мова", "Language")}</span>
          <select value={form.language} onChange={set("language")} disabled={saving}>
            {AC_LANGS.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
          </select>
        </label>
        <label>
          <span>{T("Область", "Scope")}</span>
          <select value={form.source} onChange={set("source")} disabled={saving}>
            <option value="tenant">{T("для всієї клініки", "for the whole clinic")}</option>
            <option value="user">{T("лише для мене", "just for me")}</option>
          </select>
        </label>
        {localMsg && <div className="adm-dialog-error" role="alert">{localMsg}</div>}
        {error && <WriteError err={error} lang={lang} kind="snippet" />}
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            {T("Скасувати", "Cancel")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || !!local}
                  data-testid="snippet-save">
            {saving ? "…" : T("Зберегти", "Save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── The page ──────────────────────────────────────────────────────────────
export function AutocompleteAdmin({ lang = "uk", navigate, onToast, tab = "phrases" }) {
  const T = (uk, en) => tr(lang, uk, en);
  const active = tab === "snippets" ? "snippets" : "phrases";

  return (
    <div className="adm-page admc-autocomplete" data-testid="autocomplete-admin">
      <div className="page-h">
        <div>
          <h1>{T("Автодоповнення", "Autocomplete")}</h1>
          <p className="muted">
            {T("Корпус підказок клініки: фрази та сніпети. Колонки використання — реальні лічильники нічного зведення.",
               "The clinic's suggestion corpus: phrases and snippets. The usage columns are the nightly roll-up's real counters.")}
          </p>
        </div>
      </div>

      <div className="tabs doc-tabs">
        <button className={"tab" + (active === "phrases" ? " on" : "")}
                onClick={() => navigate("/admin/autocomplete")} data-testid="ac-tab-phrases">
          {T("Фрази", "Phrases")}
        </button>
        <button className={"tab" + (active === "snippets" ? " on" : "")}
                onClick={() => navigate("/admin/autocomplete?tab=snippets")} data-testid="ac-tab-snippets">
          {T("Сніпети", "Snippets")}
        </button>
      </div>

      {active === "snippets"
        ? <SnippetsTab lang={lang} onToast={onToast} />
        : <PhrasesTab lang={lang} onToast={onToast} />}
    </div>
  );
}
