// TemplatesTab.jsx — report-template management from the owner console.
//
// Fully real: report-service ships create / clone / update / deprecate, and
// `templates.write` is a tenant_admin permission the Klarnote account holds.
//
// The one thing to be clear about is REACH. Templates are tenant-scoped: the
// list is "system templates + this tenant's own", and writes land in the tenant
// the JWT points at. So this manages the ACTIVE tenant's library, not the whole
// estate — same single-tenant-token constraint as everywhere else, stated up
// front instead of discovered when a change fails to appear elsewhere.
//
// Best practice this follows, because report-service enforces it: a structural
// edit does not mutate a template in place, it creates a NEW VERSION. Reports
// already written against v1 keep rendering against v1. Deprecation is a soft
// delete — the template stays fetchable by id and disappears from the picker.
import React, { useMemo, useState } from "react";
import { useAsync } from "../../api/useAsync.js";
import { Panel, PanelState } from "../../components/dashboard/Panel.jsx";
import { StatusBadge } from "../../components/dashboard/StatusBadge.jsx";
import { Icon } from "../../components/UI.jsx";
import { Modal } from "../../components/UI.jsx";
import { ApiErrorView } from "../../components/ApiErrorView.jsx";
import { tr } from "../../i18n.js";
import { Provenance } from "../provenance.jsx";
import {
  listTemplates, createTemplate, cloneTemplate, deleteTemplate,
  FIELD_TYPES, isSlug, validateDefinition,
} from "../../api/templates.js";

const asItems = (r) => (Array.isArray(r) ? r : (r?.items || r?.templates || []));

export function TemplatesTab({ lang }) {
  const T = (uk, en) => tr(lang, uk, en);
  const [includeDeprecated, setIncludeDeprecated] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("all");     // all | system | tenant
  const [dialog, setDialog] = useState(null);    // null | {mode:'create'} | {mode:'clone', tpl}
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const req = useAsync(
    () => listTemplates({ limit: 200, include_deprecated: includeDeprecated || undefined }),
    [includeDeprecated],
  );

  const all = useMemo(() => asItems(req.data), [req.data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((t) => {
      if (scope === "system" && !t.is_system) return false;
      if (scope === "tenant" && t.is_system) return false;
      if (!q) return true;
      return [t.name, t.code, t.specialty, t.language]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [all, query, scope]);

  const counts = useMemo(() => ({
    total: all.length,
    system: all.filter((t) => t.is_system).length,
    tenant: all.filter((t) => !t.is_system).length,
    deprecated: all.filter((t) => String(t.status) === "deprecated").length,
  }), [all]);

  const onDeprecate = async (tpl) => {
    setActionError(null);
    setBusyId(tpl.id);
    try {
      await deleteTemplate(tpl.id);
      await req.reload();
    } catch (e) {
      setActionError(e);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="co-stack">
      <div className="co-note">
        <Icon name="info" size={13} />
        <span>
          {T("Шаблони прив'язані до тенанта: список — це системні шаблони плюс власні цього тенанта, а зміни потрапляють у тенант із вашого токена. Це бібліотека активного тенанта, не всієї платформи.",
             "Templates are tenant-scoped: this list is the system templates plus this tenant's own, and writes land in the tenant your token points at. This is the active tenant's library, not the whole estate.")}
          {" "}
          <Provenance source="live" lang={lang} note="GET /templates" />
        </span>
      </div>

      <div className="co-kpis">
        <Kpi label={T("Усього шаблонів", "Templates total")} value={counts.total} icon="layers" accent />
        <Kpi label={T("Системні", "System")} value={counts.system} icon="globe" />
        <Kpi label={T("Власні тенанта", "Tenant-owned")} value={counts.tenant} icon="building" />
        <Kpi label={T("Застарілі", "Deprecated")} value={counts.deprecated} icon="archive" />
      </div>

      <Panel
        title={T("Бібліотека шаблонів", "Template library")}
        icon="layers"
        gapNote={T("Структурна зміна створює НОВУ ВЕРСІЮ — уже написані звіти й далі рендеряться зі своєю. Видалення м'яке: шаблон лишається доступним за id і зникає зі списку вибору.",
                   "A structural edit creates a NEW VERSION — reports already written keep rendering against theirs. Deletion is soft: the template stays fetchable by id and leaves the picker.")}
      >
        {(req.loading || req.error) ? (
          <PanelState loading={req.loading} error={req.error} onRetry={req.reload} lang={lang} />
        ) : (
          <>
            <div className="co-toolbar">
              <label className="co-search">
                <Icon name="search" size={14} />
                <input value={query} onChange={(e) => setQuery(e.target.value)}
                       placeholder={T("Пошук за назвою, кодом, спеціальністю…", "Search name, code, specialty…")}
                       aria-label={T("Пошук шаблонів", "Search templates")} />
                {query && <button className="co-search-x" onClick={() => setQuery("")}><Icon name="x" size={12} /></button>}
              </label>
              <div className="co-segmented" role="tablist">
                {[["all", T("усі", "all")], ["system", T("системні", "system")], ["tenant", T("власні", "own")]].map(([k, l]) => (
                  <button key={k} className={scope === k ? "on" : ""} onClick={() => setScope(k)}>{l}</button>
                ))}
              </div>
              <label className="co-check">
                <input type="checkbox" checked={includeDeprecated}
                       onChange={(e) => setIncludeDeprecated(e.target.checked)} />
                {T("показати застарілі", "show deprecated")}
              </label>
              <button className="colog-btn primary co-btn-sm" onClick={() => setDialog({ mode: "create" })}>
                <Icon name="plus" size={13} /> {T("Новий шаблон", "New template")}
              </button>
            </div>

            {actionError && <ApiErrorView error={actionError} lang={lang} />}

            {!rows.length ? (
              <div className="co-empty">{T("Жоден шаблон не відповідає фільтру.", "No template matches this filter.")}</div>
            ) : (
              <div className="co-tablewrap">
                <table className="co-table">
                  <thead>
                    <tr>
                      <th>{T("Назва", "Name")}</th>
                      <th>{T("Код", "Code")}</th>
                      <th>{T("Спеціальність", "Specialty")}</th>
                      <th>{T("Мова", "Lang")}</th>
                      <th>{T("Версія", "Ver")}</th>
                      <th>{T("Власник", "Owner")}</th>
                      <th>{T("Статус", "Status")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((t) => (
                      <tr key={t.id}>
                        <td className="co-cell-title">{t.name}</td>
                        <td className="co-cell-sub"><code>{t.code}</code></td>
                        <td className="co-cell-sub">{t.specialty || "—"}</td>
                        <td className="co-cell-sub">{t.language || "—"}</td>
                        <td className="co-cell-sub">{t.schema_version ?? "—"}</td>
                        <td>
                          <span className={"co-rolepill" + (t.is_system ? "" : " alt")}>
                            {t.is_system ? T("система", "system") : T("тенант", "tenant")}
                          </span>
                        </td>
                        <td><StatusBadge status={t.status || "active"} /></td>
                        <td className="co-rowactions">
                          {t.is_system ? (
                            <button className="colog-btn co-btn-sm" onClick={() => setDialog({ mode: "clone", tpl: t })}>
                              <Icon name="copy" size={12} /> {T("Клонувати", "Clone")}
                            </button>
                          ) : String(t.status) !== "deprecated" ? (
                            <button className="colog-btn co-btn-sm" disabled={busyId === t.id}
                                    onClick={() => onDeprecate(t)}>
                              <Icon name="archive" size={12} />
                              {busyId === t.id ? T("…", "…") : T("Вивести з обігу", "Deprecate")}
                            </button>
                          ) : (
                            <span className="co-na">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Panel>

      <Panel title={T("Практики роботи з шаблонами", "Template practices")} icon="book">
        <ul className="co-worklist">
          <li>{T("Клонуйте системний шаблон, а не редагуйте його — системні спільні для всіх тенантів.",
                 "Clone a system template rather than editing it — system templates are shared across every tenant.")}</li>
          <li>{T("Код — це незмінний slug (^[a-z][a-z0-9_]*$). Змінюйте назву, а не код.",
                 "The code is an immutable slug (^[a-z][a-z0-9_]*$). Rename the name, never the code.")}</li>
          <li>{T("Голосові синоніми мають бути унікальними в межах шаблону — інакше диктування не знатиме, куди писати.",
                 "Voice aliases must be unique within a template — otherwise dictation cannot tell which section you mean.")}</li>
          <li>{T("Виводьте з обігу замість видалення: чинні звіти посилаються на шаблон, за яким їх написали.",
                 "Deprecate instead of deleting: existing reports reference the template they were written against.")}</li>
          <li>{T("Тримайте секції короткими. ASR-підказка ≤ 896 символів — довші лише розмивають розпізнавання.",
                 "Keep sections tight. The ASR prompt caps at 896 chars — longer ones only blur recognition.")}</li>
        </ul>
      </Panel>

      {dialog && (
        <TemplateDialog
          lang={lang}
          mode={dialog.mode}
          source={dialog.tpl}
          onClose={() => setDialog(null)}
          onDone={async () => { setDialog(null); await req.reload(); }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, icon, accent }) {
  return (
    <div className={"stat-card" + (accent ? " accent" : "")}>
      <div className="stat-card-h">
        <span className="stat-card-label">{label}</span>
        <span className="stat-card-icon"><Icon name={icon} size={15} /></span>
      </div>
      <div className="stat-card-value">{value}</div>
    </div>
  );
}

// Create-from-scratch and clone share a dialog: both end in a template that
// exists in this tenant, and the fields that differ are few.
function TemplateDialog({ lang, mode, source, onClose, onDone }) {
  const T = (uk, en) => tr(lang, uk, en);
  const isClone = mode === "clone";

  const [name, setName] = useState(isClone ? `${source.name} (copy)` : "");
  const [code, setCode] = useState(isClone ? `${source.code}_copy` : "");
  const [specialty, setSpecialty] = useState(isClone ? (source.specialty || "") : "");
  const [language, setLanguage] = useState(isClone ? (source.language || "uk") : "uk");
  const [sections, setSections] = useState([
    { id: "findings", name: "Findings", field_type: "free_text", required: true, order: 0, voice_aliases: ["findings"] },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const definition = { code, name, specialty, language, sections };
  const validation = isClone ? { ok: isSlug(code) && !!name.trim(), errors: {} } : validateDefinition(definition, lang);
  const canSubmit = !busy && name.trim() && isSlug(code) && (isClone || validation.ok);

  const setSection = (i, patch) =>
    setSections((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (isClone) {
        await cloneTemplate({ system_template_id: source.id, new_name: name, new_code: code });
      } else {
        await createTemplate(definition);
      }
      await onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} className="co-modal">
      <form onSubmit={submit}>
        <header className="co-modal-h">
          <h2>{isClone ? T("Клонувати шаблон", "Clone template") : T("Новий шаблон", "New template")}</h2>
          <button type="button" className="co-search-x" onClick={onClose} aria-label={T("Закрити", "Close")}>
            <Icon name="x" size={16} />
          </button>
        </header>

        {isClone && (
          <p className="co-cell-sub" style={{ marginBottom: 14 }}>
            {T("Джерело:", "Source:")} <strong>{source.name}</strong> (<code>{source.code}</code>).{" "}
            {T("Копія належатиме цьому тенанту, і її можна змінювати вільно.",
               "The copy belongs to this tenant and can be edited freely.")}
          </p>
        )}

        <div className="co-formgrid">
          <label className="colog-field">
            <span>{T("Назва", "Name")}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus disabled={busy} />
          </label>
          <label className="colog-field">
            <span>{T("Код (slug, незмінний)", "Code (slug, immutable)")}</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} required disabled={busy}
                   aria-invalid={code ? !isSlug(code) : undefined} />
            {code && !isSlug(code) && (
              <em className="co-field-err">{T("Має відповідати ^[a-z][a-z0-9_]*$", "Must match ^[a-z][a-z0-9_]*$")}</em>
            )}
          </label>
          <label className="colog-field">
            <span>{T("Спеціальність", "Specialty")}</span>
            <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} disabled={busy}
                   placeholder="radiology" />
          </label>
          <label className="colog-field">
            <span>{T("Мова", "Language")}</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={busy}>
              <option value="uk">uk</option><option value="en">en</option>
            </select>
          </label>
        </div>

        {!isClone && (
          <>
            <h3 className="co-subhead">{T("Секції", "Sections")}</h3>
            <div className="co-sections">
              {sections.map((s, i) => (
                <div className="co-section-row" key={i}>
                  <input value={s.id} onChange={(e) => setSection(i, { id: e.target.value })}
                         placeholder="section_id" aria-label={T("ID секції", "Section id")} disabled={busy} />
                  <input value={s.name} onChange={(e) => setSection(i, { name: e.target.value })}
                         placeholder={T("Назва", "Name")} aria-label={T("Назва секції", "Section name")} disabled={busy} />
                  <select value={s.field_type} onChange={(e) => setSection(i, { field_type: e.target.value })} disabled={busy}>
                    {FIELD_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <label className="co-check">
                    <input type="checkbox" checked={!!s.required}
                           onChange={(e) => setSection(i, { required: e.target.checked })} disabled={busy} />
                    {T("обов'язкова", "required")}
                  </label>
                  <button type="button" className="co-search-x" disabled={busy || sections.length === 1}
                          onClick={() => setSections((p) => p.filter((_, j) => j !== i))}
                          aria-label={T("Видалити секцію", "Remove section")}>
                    <Icon name="x" size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="colog-btn co-btn-sm" disabled={busy}
                    onClick={() => setSections((p) => [...p, {
                      id: `section_${p.length + 1}`, name: "", field_type: "free_text",
                      required: false, order: p.length, voice_aliases: [],
                    }])}>
              <Icon name="plus" size={12} /> {T("Додати секцію", "Add section")}
            </button>

            {!validation.ok && Object.keys(validation.errors).length > 0 && (
              <ul className="co-validation">
                {Object.entries(validation.errors).map(([k, v]) => <li key={k}><code>{k}</code> {v}</li>)}
              </ul>
            )}
          </>
        )}

        {error && <ApiErrorView error={error} lang={lang} />}

        <footer className="co-modal-f">
          <button type="button" className="colog-btn ghost" onClick={onClose} disabled={busy}>
            {T("Скасувати", "Cancel")}
          </button>
          <button type="submit" className="colog-btn primary" disabled={!canSubmit}>
            {busy ? T("Збереження…", "Saving…") : isClone ? T("Клонувати", "Clone") : T("Створити", "Create")}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
