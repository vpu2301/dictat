// SynonymsAdmin.jsx — /admin/synonyms: the search-expansion dictionary
// (report-service /v1/synonyms, ADR-0038).
//
// A group is a set of terms report search treats as one: searching any member
// finds the rest (the search response's expanded_terms[]). System groups are
// the platform's — visible, immutable (the server answers writes with a
// deliberate 404, so the controls are simply not rendered). Tenant groups are
// this clinic's to curate.
//
// The clinical-safety note is PINNED, not a dismissible hint: expansion is a
// recall tool, and grouping distinct diagnoses as "synonyms" makes search
// silently conflate them. The probe at the bottom answers "what does a search
// for X actually expand to right now" against the real search endpoint —
// admins verify their edit instead of trusting it.
import React, { useMemo, useState } from "react";
import { Icon, Modal } from "../../components/UI.jsx";
import { ApiErrorView } from "../../components/ApiErrorView.jsx";
import { ConfirmDialog } from "../ConfirmDialog.jsx";
import { useAsync } from "../../api/useAsync.js";
import {
  listSynonymGroups, createSynonymGroup, updateSynonymGroup, deleteSynonymGroup,
  parseTerms, isEditable, SYNONYM_LANGS, SYNONYM_MIN_TERMS, SYNONYM_MAX_TERMS,
} from "../../api/synonyms.js";
import { listReports, expandedTerms } from "../../api/reports.js";
import { isMfaEnrolmentRequired } from "../../auth/mfaGrace.js";
import { tr } from "../../i18n.js";

const TERM_MAX_CHARS = 120;

/** Client mirror of the backend term validator — reason key or null. */
export function groupProblem(terms) {
  if (terms.length < SYNONYM_MIN_TERMS) return "too_few";
  if (terms.length > SYNONYM_MAX_TERMS) return "too_many";
  if (terms.some((t) => t.length > TERM_MAX_CHARS)) return "term_too_long";
  return null;
}

export function SynonymsAdmin({ lang = "uk", onToast }) {
  const T = (uk, en) => tr(lang, uk, en);
  const req = useAsync(() => listSynonymGroups(), []);
  const [langFilter, setLangFilter] = useState("");

  const [form, setForm] = useState(null);   // {group_id?, language, termsText}
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const groups = useMemo(() => {
    const all = Array.isArray(req.data) ? req.data : [];
    const filtered = langFilter ? all.filter((g) => g.language === langFilter) : all;
    // Tenant groups first — the rows the admin can act on lead the list.
    return [...filtered].sort((a, b) =>
      (a.source === b.source ? 0 : a.source === "tenant" ? -1 : 1));
  }, [req.data, langFilter]);

  const save = async (e) => {
    e.preventDefault();
    const terms = parseTerms(form.termsText);
    if (groupProblem(terms)) return;
    setSaving(true); setSaveError(null);
    try {
      if (form.group_id) await updateSynonymGroup(form.group_id, { language: form.language, terms });
      else await createSynonymGroup({ language: form.language, terms });
      setForm(null);
      req.reload();
      onToast?.(T("Групу збережено", "Group saved"));
    } catch (err) {
      if (!isMfaEnrolmentRequired(err)) setSaveError(err);
    } finally { setSaving(false); }
  };

  const doDelete = async () => {
    setDeleting(true); setDeleteError(null);
    try {
      await deleteSynonymGroup(toDelete.group_id);
      setToDelete(null);
      req.reload();
      onToast?.(T("Групу видалено", "Group removed"));
    } catch (err) {
      if (!isMfaEnrolmentRequired(err)) setDeleteError(err);
    } finally { setDeleting(false); }
  };

  return (
    <div className="adm-page admc-synonyms" data-testid="synonyms-admin">
      <div className="page-h">
        <div>
          <h1>{T("Синоніми пошуку", "Search synonyms")}</h1>
          <p className="muted">
            {T("Групи термінів, які пошук звітів вважає одним запитом (розширення expanded_terms).",
               "Term groups that report search treats as one query (expanded_terms).")}
          </p>
        </div>
        <button className="btn btn-primary" data-testid="syn-add"
                onClick={() => { setSaveError(null); setForm({ language: "uk", termsText: "" }); }}>
          <Icon name="plus" size={13} /> {T("Нова група", "New group")}
        </button>
      </div>

      <div className="admc-safety" role="note" data-testid="syn-safety-note">
        <Icon name="alert" size={15} />
        <span>
          <b>{T("Пов'язане — не означає взаємозамінне.", "Related does not mean interchangeable.")}</b>{" "}
          {T("Не групуйте різні діагнози як синоніми: розширення тихо змішає їх у результатах пошуку. Групуйте лише справжні позначення того самого поняття (термін, скорочення, переклад).",
             "Do not group distinct diagnoses as synonyms: expansion silently conflates them in search results. Group only true names of the same concept (term, abbreviation, translation).")}
        </span>
      </div>

      <div className="admc-toolbar">
        <div className="admc-segmented" role="tablist" aria-label={T("Мова", "Language")}>
          <button className={langFilter === "" ? "on" : ""} onClick={() => setLangFilter("")}>{T("Усі", "All")}</button>
          {SYNONYM_LANGS.map((c) => (
            <button key={c} className={langFilter === c ? "on" : ""} onClick={() => setLangFilter(c)}>
              {c.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {req.error && <ApiErrorView error={req.error} lang={lang} onRetry={req.reload} />}

      {!req.error && (
        <section className="card">
          <table className="adm-table" data-testid="syn-table">
            <thead>
              <tr>
                <th>{T("Терміни групи", "Group terms")}</th>
                <th style={{ width: 55 }}>{T("Мова", "Lang")}</th>
                <th style={{ width: 110 }}>{T("Походження", "Origin")}</th>
                <th style={{ width: 150 }}></th>
              </tr>
            </thead>
            <tbody>
              {!req.loading && groups.length === 0 && (
                <tr><td colSpan={4} className="admc-empty-cell">
                  {T("Груп немає — створіть першу, і пошук почне розширювати ці терміни.",
                     "No groups yet — create the first one and search starts expanding those terms.")}
                </td></tr>
              )}
              {groups.map((g) => (
                <tr key={g.group_id} data-source={g.source}>
                  <td className="admc-terms">
                    {g.terms.map((t) => <span key={t} className="admc-chip">{t}</span>)}
                  </td>
                  <td><code className="mono">{g.language}</code></td>
                  <td>
                    {g.source === "tenant"
                      ? <span className="admc-badge admc-badge-tenant">{T("клініка", "clinic")}</span>
                      : <span className="admc-badge admc-badge-system">{T("системна", "system")}</span>}
                  </td>
                  <td>
                    {isEditable(g) && (
                      <div className="adm-row-actions">
                        <button className="btn sm" data-testid="syn-edit"
                                onClick={() => {
                                  setSaveError(null);
                                  setForm({ group_id: g.group_id, language: g.language, termsText: g.terms.join(", ") });
                                }}>
                          {T("Редагувати", "Edit")}
                        </button>
                        <button className="btn sm adm-danger-link" data-testid="syn-delete"
                                onClick={() => { setDeleteError(null); setToDelete(g); }}>
                          {T("Видалити", "Delete")}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <ExpansionProbe lang={lang} />

      {form && (
        <GroupFormModal lang={lang} form={form} setForm={setForm} saving={saving}
                        error={saveError} onSubmit={save} onClose={() => setForm(null)} />
      )}

      {toDelete && (
        <ConfirmDialog
          lang={lang} danger
          title={T("Видалити групу синонімів?", "Delete this synonym group?")}
          consequence={T(
            "Пошук звітів перестане розширювати ці терміни один в одного — знайдеться лише буквальний збіг.",
            "Report search stops expanding these terms into one another — only literal matches will be found.")}
          confirmLabel={T("Видалити", "Delete")}
          busy={deleting}
          error={deleteError ? <ApiErrorView error={deleteError} lang={lang} /> : null}
          onConfirm={doDelete}
          onCancel={() => setToDelete(null)}
          testId="syn-delete-confirm"
        >
          <div className="adm-dialog-person admc-terms">
            {toDelete.terms.map((t) => <span key={t} className="admc-chip">{t}</span>)}
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}

function GroupFormModal({ lang, form, setForm, saving, error, onSubmit, onClose }) {
  const T = (uk, en) => tr(lang, uk, en);
  const terms = parseTerms(form.termsText);
  const local = form.termsText.trim() ? groupProblem(terms) : "too_few";
  const localMsg = {
    too_few: T(`Потрібно щонайменше ${SYNONYM_MIN_TERMS} терміни.`, `At least ${SYNONYM_MIN_TERMS} terms are required.`),
    too_many: T(`Не більше ${SYNONYM_MAX_TERMS} термінів у групі.`, `No more than ${SYNONYM_MAX_TERMS} terms per group.`),
    term_too_long: T(`Термін задовгий (до ${TERM_MAX_CHARS} символів).`, `A term is too long (${TERM_MAX_CHARS} chars max).`),
  }[local];

  return (
    <Modal className="dialog-modal admc-form-modal" onClose={() => { if (!saving) onClose(); }}>
      <div className="modal-h">
        <h2>{form.group_id ? T("Редагувати групу", "Edit group") : T("Нова група", "New group")}</h2>
        <p>
          {T("Терміни через кому або з нового рядка. Дублікати (без урахування регістру) прибираються.",
             "Terms separated by commas or new lines. Case-insensitive duplicates are dropped.")}
        </p>
      </div>
      <form className="modal-body admc-form" onSubmit={onSubmit} data-testid="syn-form">
        <label>
          <span>{T("Мова", "Language")}</span>
          <select value={form.language} disabled={saving || !!form.group_id}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}>
            {SYNONYM_LANGS.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
          </select>
        </label>
        <label>
          <span>{T("Терміни", "Terms")} <small className="muted">{terms.length}/{SYNONYM_MAX_TERMS}</small></span>
          <textarea rows={4} value={form.termsText} disabled={saving}
                    onChange={(e) => setForm({ ...form, termsText: e.target.value })}
                    placeholder={T("набряк, набряки, едема", "edema, oedema, swelling")}
                    data-testid="syn-terms" />
        </label>
        {terms.length > 0 && (
          <div className="admc-terms" aria-hidden="true">
            {terms.map((t) => <span key={t} className="admc-chip">{t}</span>)}
          </div>
        )}
        {localMsg && form.termsText.trim() !== "" && (
          <div className="adm-dialog-error" role="alert">{localMsg}</div>
        )}
        {error && <ApiErrorView error={error} lang={lang} />}
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            {T("Скасувати", "Cancel")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || !!local}
                  data-testid="syn-save">
            {saving ? "…" : T("Зберегти", "Save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── The expansion probe ───────────────────────────────────────────────────
// A real search (limit 1) whose only read is expanded_terms[] — the admin
// sees what their edit does to an actual query, not a simulation.
function ExpansionProbe({ lang }) {
  const T = (uk, en) => tr(lang, uk, en);
  const [q, setQ] = useState("");
  const [running, setRunning] = useState(false);
  const [probe, setProbe] = useState(null);   // { q, terms[] }
  const [error, setError] = useState(null);

  const run = async (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    setRunning(true); setError(null);
    try {
      const res = await listReports({ query: q.trim(), limit: 1 });
      setProbe({ q: q.trim(), terms: expandedTerms(res) });
    } catch (err) { setProbe(null); setError(err); }
    finally { setRunning(false); }
  };

  return (
    <section className="card admc-probe" data-testid="syn-probe">
      <header className="admc-sandbox-h">
        <Icon name="search" size={14} />
        <h2>{T("Перевірити розширення", "Probe the expansion")}</h2>
        <small className="muted">
          {T("Справжній пошуковий запит — показує, у що розгорнеться термін просто зараз.",
             "A real search query — shows what a term expands to right now.")}
        </small>
      </header>
      <form className="admc-probe-form" onSubmit={run}>
        <input value={q} onChange={(e) => setQ(e.target.value)}
               placeholder={T("набряк", "edema")} data-testid="syn-probe-q" />
        <button className="btn accent" type="submit" disabled={running || !q.trim()}
                data-testid="syn-probe-run">
          {running ? "…" : T("Перевірити", "Probe")}
        </button>
      </form>
      {error && <ApiErrorView error={error} lang={lang} />}
      {probe && (
        <div className="admc-probe-out" data-testid="syn-probe-out">
          {probe.terms.length > 0 ? (
            <>
              <span className="muted">{T("Розширюється до:", "Expands to:")}</span>{" "}
              {probe.terms.map((t) => <span key={t} className="admc-chip">{t}</span>)}
            </>
          ) : (
            <span className="muted">
              {lang === "uk"
                ? `«${probe.q}» не входить до жодної групи — розширення не застосовано.`
                : `“${probe.q}” is in no group — no expansion applied.`}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
