// DictionaryAdmin.jsx — /admin/dictionary: the tenant's language rules.
//
// Two tabs:
//   «Скорочення»       — the merged abbreviation dictionary (nlp-service,
//                        sprint 05). One list, two origins: shipped rows and
//                        this clinic's overrides (`is_tenant_override`). A PUT
//                        always writes a TENANT row keyed by (language,
//                        expanded, abbreviated) — "editing" a system rule
//                        creates the clinic's shadow of it, and the tenant row
//                        wins on collision. The UI says so instead of
//                        smoothing it over. Includes the sandbox test box:
//                        admin-typed text through POST /nlp/process with
//                        per-stage toggles — the text is never persisted.
//   «Голосові команди» — READ-ONLY reference of the dictation vocabulary,
//                        rendered from the live client mirror
//                        (src/dictation/voiceCommands.js — same rows the
//                        Studio matches against, not display copy). Per-tenant
//                        command overrides are a deferred backend feature; the
//                        one voice surface an admin can edit today is option
//                        voice-aliases in templates.
import React, { useMemo, useState } from "react";
import { Icon, Modal } from "../../components/UI.jsx";
import { ApiErrorView } from "../../components/ApiErrorView.jsx";
import { ConfirmDialog } from "../ConfirmDialog.jsx";
import { useLimitedList } from "../useLimitedList.js";
import {
  listAbbreviations, upsertAbbreviation, deleteAbbreviation, processSandbox,
} from "../../api/nlp.js";
import { isMfaEnrolmentRequired } from "../../auth/mfaGrace.js";
import { COMMANDS } from "../../dictation/voiceCommands.js";
import { tr } from "../../i18n.js";

const NLP_LANGS = ["uk", "en", "de"];
const ABBREV_LIMIT = 200;

const DIRECTIONS = [
  { id: "expand",  uk: "розгортати",    en: "expand",  hintUk: "ЧСС → частота серцевих скорочень" },
  { id: "compact", uk: "згортати",      en: "compact", hintUk: "повна форма → скорочення" },
  { id: "either",  uk: "в обидва боки", en: "either",  hintUk: "залежно від контексту" },
];
const dirLabel = (id, lang) => {
  const d = DIRECTIONS.find((x) => x.id === id);
  return d ? tr(lang, d.uk, d.en) : id;
};

const EMPTY_FORM = {
  language: "uk", abbreviated: "", expanded: "", direction: "expand",
  domain: "", case_sensitive: true,
};

// ── Abbreviations tab ─────────────────────────────────────────────────────
function AbbreviationsTab({ lang, onToast }) {
  const T = (uk, en) => tr(lang, uk, en);
  const [langFilter, setLangFilter] = useState("");
  const list = useLimitedList(
    ({ limit }) => listAbbreviations({ language: langFilter || undefined, limit }),
    { limit: ABBREV_LIMIT, deps: [langFilter] },
  );

  const [form, setForm] = useState(null);        // null | {…EMPTY_FORM, _origin}
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [toDelete, setToDelete] = useState(null); // row
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const startCreate = () => { setSaveError(null); setForm({ ...EMPTY_FORM, language: langFilter || "uk" }); };
  const startEdit = (row) => {
    setSaveError(null);
    setForm({
      language: row.language, abbreviated: row.abbreviated, expanded: row.expanded,
      direction: row.direction, domain: row.domain || "",
      case_sensitive: !!row.case_sensitive,
      _origin: row.is_tenant_override ? "tenant" : "system",
    });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setSaveError(null);
    try {
      await upsertAbbreviation({
        language: form.language,
        expanded: form.expanded.trim(),
        abbreviated: form.abbreviated.trim(),
        direction: form.direction,
        domain: form.domain.trim() || null,
        case_sensitive: form.case_sensitive,
      });
      // 204 with no body and no id — the list is the read-back.
      setForm(null);
      list.reload();
      onToast?.(T("Правило збережено", "Rule saved"));
    } catch (err) {
      if (!isMfaEnrolmentRequired(err)) setSaveError(err);
    } finally { setSaving(false); }
  };

  const doDelete = async () => {
    setDeleting(true); setDeleteError(null);
    try {
      await deleteAbbreviation(toDelete.id);
      setToDelete(null);
      list.reload();
      onToast?.(T("Правило клініки видалено", "Clinic rule removed"));
    } catch (err) {
      if (!isMfaEnrolmentRequired(err)) setDeleteError(err);
    } finally { setDeleting(false); }
  };

  return (
    <>
      <div className="admc-note">
        <Icon name="info" size={13} />
        <span>
          {T("Один список — два походження. Правило клініки переважає системне з тим самим ключем (мова + повна форма + скорочення). Редагування системного правила створює правило клініки.",
             "One list — two origins. A clinic rule wins over the system rule with the same key (language + full form + abbreviation). Editing a system rule creates a clinic rule.")}
        </span>
      </div>

      <div className="admc-toolbar">
        <div className="admc-segmented" role="tablist" aria-label={T("Мова", "Language")}>
          <button className={langFilter === "" ? "on" : ""} onClick={() => setLangFilter("")}>{T("Усі", "All")}</button>
          {NLP_LANGS.map((c) => (
            <button key={c} className={langFilter === c ? "on" : ""} onClick={() => setLangFilter(c)}>
              {c.toUpperCase()}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={startCreate} data-testid="abbrev-add">
          <Icon name="plus" size={13} /> {T("Додати правило", "Add a rule")}
        </button>
      </div>

      {list.error && <ApiErrorView error={list.error} lang={lang} onRetry={list.reload} />}

      {!list.error && (
        <section className="card">
          <table className="adm-table" data-testid="abbrev-table">
            <thead>
              <tr>
                <th>{T("Скорочення", "Abbreviation")}</th>
                <th></th>
                <th>{T("Повна форма", "Full form")}</th>
                <th style={{ width: 60 }}>{T("Мова", "Lang")}</th>
                <th>{T("Домен", "Domain")}</th>
                <th style={{ width: 70 }}>{T("Регістр", "Case")}</th>
                <th style={{ width: 130 }}>{T("Походження", "Origin")}</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {!list.loading && list.items.length === 0 && (
                <tr><td colSpan={8} className="admc-empty-cell">
                  {T("Правил немає — додайте перше.", "No rules yet — add the first one.")}
                </td></tr>
              )}
              {list.items.map((row) => (
                <tr key={row.id || `${row.language}:${row.expanded}:${row.abbreviated}`}>
                  <td><code className="mono">{row.abbreviated}</code></td>
                  <td className="admc-dir" title={dirLabel(row.direction, lang)}>
                    {row.direction === "expand" ? "→" : row.direction === "compact" ? "←" : "↔"}
                  </td>
                  <td>{row.expanded}</td>
                  <td><code className="mono">{row.language}</code></td>
                  <td>{row.domain || <span className="muted">—</span>}</td>
                  <td>{row.case_sensitive
                    ? <span title={T("чутливе до регістру", "case-sensitive")}>Aa</span>
                    : <span className="muted" title={T("нечутливе до регістру", "case-insensitive")}>aa</span>}
                  </td>
                  <td>
                    {row.is_tenant_override
                      ? <span className="admc-badge admc-badge-tenant">{T("правило клініки", "clinic rule")}</span>
                      : <span className="admc-badge admc-badge-system">{T("системне", "system")}</span>}
                  </td>
                  <td>
                    <div className="adm-row-actions">
                      <button className="btn sm" onClick={() => startEdit(row)} data-testid="abbrev-edit">
                        {T("Редагувати", "Edit")}
                      </button>
                      {row.is_tenant_override && (
                        <button className="btn sm adm-danger-link"
                                onClick={() => { setDeleteError(null); setToDelete(row); }}
                                data-testid="abbrev-delete">
                          {T("Видалити", "Delete")}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.hasNext && (
            <div className="adm-table-foot">
              <span className="muted">
                {lang === "uk"
                  ? `Показано перші ${ABBREV_LIMIT} — звузьте фільтр мови.`
                  : `Showing the first ${ABBREV_LIMIT} — narrow the language filter.`}
              </span>
            </div>
          )}
        </section>
      )}

      <SandboxPanel lang={lang} />

      {form && (
        <AbbrevFormModal
          lang={lang} form={form} setForm={setForm} saving={saving}
          error={saveError} onSubmit={save} onClose={() => setForm(null)}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          lang={lang} danger
          title={T("Видалити правило клініки?", "Delete this clinic rule?")}
          consequence={T(
            "Диктування перестане застосовувати це правило. Системне правило з тим самим ключем (якщо існує) знову діятиме.",
            "Dictation stops applying this rule. The system rule with the same key (if one exists) takes effect again.")}
          confirmLabel={T("Видалити", "Delete")}
          busy={deleting}
          error={deleteError ? <ApiErrorView error={deleteError} lang={lang} /> : null}
          onConfirm={doDelete}
          onCancel={() => setToDelete(null)}
          testId="abbrev-delete-confirm"
        >
          <div className="adm-dialog-person">
            <code className="mono">{toDelete.abbreviated}</code> ↔ {toDelete.expanded}
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}

function AbbrevFormModal({ lang, form, setForm, saving, error, onSubmit, onClose }) {
  const T = (uk, en) => tr(lang, uk, en);
  const set = (k) => (e) =>
    setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const valid = form.abbreviated.trim().length >= 1 && form.abbreviated.trim().length <= 50
    && form.expanded.trim().length >= 1 && form.expanded.trim().length <= 200;

  return (
    <Modal className="dialog-modal admc-form-modal" onClose={() => { if (!saving) onClose(); }}>
      <div className="modal-h">
          <h2>{form._origin ? T("Правило клініки", "Clinic rule") : T("Нове правило", "New rule")}</h2>
          <p>
            {form._origin === "system"
              ? T("Це системне правило. Збереження створить правило клініки, яке його переважить.",
                  "This is a system rule. Saving creates a clinic rule that takes precedence over it.")
              : T("Збереження записує правило клініки за ключем «мова + повна форма + скорочення».",
                  "Saving writes a clinic rule keyed by language + full form + abbreviation.")}
          </p>
        </div>
        <form className="modal-body admc-form" onSubmit={onSubmit} data-testid="abbrev-form">
          <label>
            <span>{T("Мова", "Language")}</span>
            <select value={form.language} onChange={set("language")} disabled={saving}>
              {NLP_LANGS.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
            </select>
          </label>
          <label>
            <span>{T("Скорочення", "Abbreviation")} <small className="muted">1–50</small></span>
            <input value={form.abbreviated} onChange={set("abbreviated")} disabled={saving}
                   maxLength={50} placeholder="ЧСС" data-testid="abbrev-short" />
          </label>
          <label>
            <span>{T("Повна форма", "Full form")} <small className="muted">1–200</small></span>
            <input value={form.expanded} onChange={set("expanded")} disabled={saving}
                   maxLength={200} placeholder={T("частота серцевих скорочень", "heart rate")}
                   data-testid="abbrev-full" />
          </label>
          <label>
            <span>{T("Напрям", "Direction")}</span>
            <select value={form.direction} onChange={set("direction")} disabled={saving}>
              {DIRECTIONS.map((d) => (
                <option key={d.id} value={d.id}>{tr(lang, d.uk, d.en)} — {d.hintUk}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{T("Домен (необов'язково)", "Domain (optional)")}</span>
            <input value={form.domain} onChange={set("domain")} disabled={saving}
                   placeholder={T("кардіологія", "cardiology")} />
          </label>
          <label className="admc-check">
            <input type="checkbox" checked={form.case_sensitive} onChange={set("case_sensitive")}
                   disabled={saving} />
            <span>{T("Чутливе до регістру (ЧСС ≠ чсс)", "Case-sensitive (HR ≠ hr)")}</span>
          </label>
          {error && <ApiErrorView error={error} lang={lang} />}
          <div className="modal-foot">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              {T("Скасувати", "Cancel")}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !valid}
                    data-testid="abbrev-save">
              {saving ? "…" : T("Зберегти", "Save")}
            </button>
          </div>
        </form>
    </Modal>
  );
}

// ── The sandbox test box ──────────────────────────────────────────────────
const STAGES = [
  { id: "abbreviation",   uk: "скорочення",       en: "abbreviations" },
  { id: "punctuation",    uk: "пунктуація",       en: "punctuation" },
  { id: "number_norm",    uk: "числа",            en: "numbers" },
  { id: "date_norm",      uk: "дати",             en: "dates" },
  { id: "voice_commands", uk: "голосові команди", en: "voice commands" },
];

function SandboxPanel({ lang }) {
  const T = (uk, en) => tr(lang, uk, en);
  const [text, setText] = useState("");
  const [sandLang, setSandLang] = useState("uk");
  const [disabled, setDisabled] = useState(() => new Set());
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const toggle = (id) => setDisabled((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const run = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setRunning(true); setError(null);
    try {
      setResult(await processSandbox({
        text, language: sandLang, stages_disabled: [...disabled],
      }));
    } catch (err) { setResult(null); setError(err); }
    finally { setRunning(false); }
  };

  return (
    <section className="card admc-sandbox" data-testid="sandbox">
      <header className="admc-sandbox-h">
        <Icon name="sliders" size={14} />
        <h2>{T("Пісочниця", "Sandbox")}</h2>
        <small className="muted">
          {T("Введіть фразу — побачите, як словник клініки її обробить. Текст не зберігається.",
             "Type a phrase to see what the clinic's dictionary does to it. The text is not stored.")}
        </small>
      </header>
      <form onSubmit={run} className="admc-sandbox-form">
        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={T("пацієнт скаржиться на біль чсс 92 ат 130 на 85", "patient reports pain hr 92 bp 130 over 85")}
          data-testid="sandbox-text"
        />
        <div className="admc-sandbox-controls">
          <select value={sandLang} onChange={(e) => setSandLang(e.target.value)} aria-label={T("Мова", "Language")}>
            {NLP_LANGS.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
          </select>
          <div className="admc-stage-toggles">
            <span className="muted">{T("Етапи:", "Stages:")}</span>
            {STAGES.map((s) => (
              <label key={s.id} className="admc-check">
                <input type="checkbox" checked={!disabled.has(s.id)} onChange={() => toggle(s.id)} />
                <span>{tr(lang, s.uk, s.en)}</span>
              </label>
            ))}
          </div>
          <button className="btn accent" type="submit" disabled={running || !text.trim()}
                  data-testid="sandbox-run">
            {running ? "…" : T("Перевірити", "Try it")}
          </button>
        </div>
      </form>
      {error && <ApiErrorView error={error} lang={lang} />}
      {result && (
        <div className="admc-sandbox-out">
          <div className="admc-sandbox-result" data-testid="sandbox-out">{result.text}</div>
          {Array.isArray(result.warnings) && result.warnings.length > 0 && (
            <ul className="admc-sandbox-warnings" data-testid="sandbox-warnings">
              {result.warnings.map((w, i) => (
                <li key={i}>
                  <code className="mono">{w.stage}</code> · <code className="mono">{w.code}</code>
                  {w.detail ? <> — {w.detail}</> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

// ── Voice-commands reference tab ──────────────────────────────────────────
function CommandsTab({ lang, navigate }) {
  const T = (uk, en) => tr(lang, uk, en);
  const groups = useMemo(() => {
    const nav = COMMANDS.filter((c) => c.op === "navigate_section");
    const text = COMMANDS.filter((c) => c.op !== "navigate_section");
    return { nav, text };
  }, []);

  const renderRows = (rows) => rows.map((c) => (
    <tr key={c.intent}>
      <td><code className="mono">{c.intent}</code></td>
      <td>{(c.uk || []).map((p) => <span key={p} className="admc-chip">{p}</span>)}</td>
      <td>{(c.en || []).map((p) => <span key={p} className="admc-chip">{p}</span>)}</td>
      <td>{(c.de || []).map((p) => <span key={p} className="admc-chip">{p}</span>)}</td>
      <td>{c.arg?.value ? <code className="mono">{c.arg.value}</code> : <span className="muted">—</span>}</td>
    </tr>
  ));

  return (
    <>
      <div className="admc-note admc-note-pinned" data-testid="commands-note">
        <Icon name="info" size={13} />
        <span>
          {T("Довідник — лише для читання: розпізнавання виконує сервер, каталог команд є глобальним. Персональні голосові команди клініки — майбутня функція серверної частини; редагованими сьогодні є голосові псевдоніми опцій у шаблонах.",
             "Read-only reference: recognition runs server-side and the command catalogue is global. Per-clinic voice commands are a future backend feature; what you can edit today is option voice-aliases in templates.")}
          {" "}
          <button className="btn sm" onClick={() => navigate("/admin/templates")} data-testid="commands-to-templates">
            {T("До шаблонів", "To templates")}
          </button>
        </span>
      </div>

      <section className="card">
        <h3 className="admc-subhead">{T("Текст і пунктуація", "Text & punctuation")}</h3>
        <table className="adm-table admc-commands" data-testid="commands-table">
          <thead>
            <tr>
              <th style={{ width: 160 }}>{T("Команда", "Command")}</th>
              <th>UK</th><th>EN</th><th>DE</th>
              <th style={{ width: 70 }}>{T("Символ", "Symbol")}</th>
            </tr>
          </thead>
          <tbody>{renderRows(groups.text)}</tbody>
        </table>
      </section>

      <section className="card">
        <h3 className="admc-subhead">{T("Навігація розділами", "Section navigation")}</h3>
        <p className="muted admc-subnote">
          {T("Спрацьовують під час диктування за шаблоном; назви розділів беруться з шаблона та його псевдонімів.",
             "Active while dictating against a template; section names come from the template and its aliases.")}
        </p>
        <table className="adm-table admc-commands">
          <thead>
            <tr>
              <th style={{ width: 160 }}>{T("Команда", "Command")}</th>
              <th>UK</th><th>EN</th><th>DE</th>
              <th style={{ width: 70 }}></th>
            </tr>
          </thead>
          <tbody>{renderRows(groups.nav)}</tbody>
        </table>
      </section>
    </>
  );
}

// ── The page ──────────────────────────────────────────────────────────────
export function DictionaryAdmin({ lang = "uk", navigate, onToast, tab = "abbreviations" }) {
  const T = (uk, en) => tr(lang, uk, en);
  const active = tab === "commands" ? "commands" : "abbreviations";

  return (
    <div className="adm-page admc-dictionary" data-testid="dictionary-admin">
      <div className="page-h">
        <div>
          <h1>{T("Словник і команди", "Dictionary & commands")}</h1>
          <p className="muted">
            {T("Правила скорочень цієї клініки та довідник голосових команд диктування.",
               "This clinic's abbreviation rules and the dictation voice-command reference.")}
          </p>
        </div>
      </div>

      <div className="tabs doc-tabs">
        <button className={"tab" + (active === "abbreviations" ? " on" : "")}
                onClick={() => navigate("/admin/dictionary")} data-testid="dict-tab-abbrev">
          {T("Скорочення", "Abbreviations")}
        </button>
        <button className={"tab" + (active === "commands" ? " on" : "")}
                onClick={() => navigate("/admin/dictionary?tab=commands")} data-testid="dict-tab-commands">
          {T("Голосові команди", "Voice commands")}
        </button>
      </div>

      {active === "commands"
        ? <CommandsTab lang={lang} navigate={navigate} />
        : <AbbreviationsTab lang={lang} onToast={onToast} />}
    </div>
  );
}
