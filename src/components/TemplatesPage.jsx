// TemplatesPage.jsx — Template library with create / edit / import modal
import React, { useState, useRef, useCallback } from 'react';
import { Icon, Modal } from './UI.jsx';
import { useI18n } from '../i18n.js';

// Built-in (system) templates are flagged by the backend via `tpl.builtin`.
const isBuiltinTpl = (tpl) => !!(tpl && tpl.builtin);

const SPECIALTIES = [
  { value: "radiology",      label: { uk: "Радіологія",         en: "Radiology"        } },
  { value: "cardiology",     label: { uk: "Кардіологія",        en: "Cardiology"       } },
  { value: "cardiacSurgery", label: { uk: "Кардіохірургія",     en: "Cardiac surgery"  } },
  { value: "orthopaedics",   label: { uk: "Ортопедія",          en: "Orthopaedics"     } },
  { value: "neurology",      label: { uk: "Неврологія",         en: "Neurology"        } },
  { value: "general",        label: { uk: "Загальна медицина",  en: "General medicine" } },
];

const ICONS = ["scan","heart","scalpel","bone","fileText","waveform","brain","shield","user","layers"];
// "brain" and "waveform" map to existing icon paths; add fallbacks below
const ICON_LABELS = {
  scan:"CT/MRI", heart:"Cardio", scalpel:"Surgery", bone:"Ortho",
  fileText:"General", waveform:"Audio", brain:"Neuro", shield:"Other",
  user:"Clinical", layers:"Multi",
};

// ── Main page ──────────────────────────────────────────────────────────────
export function TemplatesPage({ lang, templates, onAdd, onUpdate, onDelete, navigate }) {
  const { t } = useI18n();
  const [search,  setSearch]  = useState("");
  const [spec,    setSpec]    = useState(null);
  const [filter,  setFilter]  = useState("all"); // all | builtin | custom
  const [modal,   setModal]   = useState(null);  // null | { mode:"create" } | { mode:"edit", tpl }
  const [delConf, setDelConf] = useState(null);  // id to confirm-delete

  const list = Object.values(templates).filter((tpl) => {
    if (filter === "builtin" &&  isBuiltinTpl(tpl)) return true;
    if (filter === "custom"  && !isBuiltinTpl(tpl)) return true;
    if (filter === "all")                           return true;
    return false;
  }).filter((tpl) => {
    if (spec && tpl.specialty !== spec) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return ((tpl.name?.uk || "") + (tpl.name?.en || "") + (tpl.code || "")).toLowerCase().includes(q);
  });

  const specName = (s) => SPECIALTIES.find((x) => x.value === s)?.label[lang] ?? s;

  const handleSave = (tpl) => {
    const isNew = !templates[tpl.id];
    isNew ? onAdd(tpl) : onUpdate(tpl);
    setModal(null);
  };

  const handleDelete = (id) => {
    onDelete(id);
    setDelConf(null);
  };

  const customCount  = Object.values(templates).filter((t) => !isBuiltinTpl(t)).length;
  const builtinCount = Object.values(templates).filter((t) =>  isBuiltinTpl(t)).length;

  return (
    <div className="page">
      {/* Header */}
      <div className="page-h">
        <div>
          <h1>{lang === "uk" ? "Шаблони диктування" : "Dictation templates"}</h1>
          <p className="sub">
            {Object.keys(templates).length}{" "}
            {lang === "uk" ? "шаблонів" : "templates"}
            {customCount > 0 && ` · ${customCount} ${lang === "uk" ? "власних" : "custom"}`}
          </p>
        </div>
        <button className="btn accent" onClick={() => setModal({ mode: "create" })}>
          <Icon name="plus" size={14} />
          {lang === "uk" ? "Новий шаблон" : "New template"}
        </button>
      </div>

      {/* Toolbar */}
      <div className="ptable-toolbar" style={{ marginBottom: 16 }}>
        <label className="search-input">
          <Icon name="search" size={14} />
          <input
            placeholder={lang === "uk" ? "Пошук шаблону…" : "Search templates…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <select
          className="ti"
          style={{ width: "auto", padding: "5px 10px" }}
          value={spec || ""}
          onChange={(e) => setSpec(e.target.value || null)}
        >
          <option value="">{lang === "uk" ? "Всі спеціальності" : "All specialties"}</option>
          {SPECIALTIES.map((s) => (
            <option key={s.value} value={s.value}>{s.label[lang]}</option>
          ))}
        </select>

        <div className="seg">
          {[
            { key: "all",     label: lang === "uk" ? "Всі"       : "All",     count: Object.keys(templates).length },
            { key: "builtin", label: lang === "uk" ? "Вбудовані" : "Built-in", count: builtinCount },
            { key: "custom",  label: lang === "uk" ? "Власні"    : "Custom",  count: customCount  },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              className={`seg-btn${filter === key ? " on" : ""}`}
              onClick={() => setFilter(key)}
            >
              {label}
              <span className="seg-count">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {list.length === 0 ? (
        <div className="tpl-empty">
          <Icon name="layers" size={36} />
          <h3>{lang === "uk" ? "Шаблонів не знайдено" : "No templates found"}</h3>
          <p>{lang === "uk" ? "Спробуйте змінити фільтр або створіть новий шаблон" : "Try changing the filter or create a new template"}</p>
          <button className="btn accent" style={{ marginTop: 12 }} onClick={() => setModal({ mode: "create" })}>
            <Icon name="plus" size={13} /> {lang === "uk" ? "Створити шаблон" : "Create template"}
          </button>
        </div>
      ) : (
        <div className="tpl-grid">
          {list.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              tpl={tpl}
              lang={lang}
              isBuiltin={isBuiltinTpl(tpl)}
              specName={specName(tpl.specialty)}
              onEdit={() => setModal({ mode: "edit", tpl })}
              onUse={() => navigate("/dictate")}
              onDelete={() => setDelConf(tpl.id)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {modal && (
        <TemplateModal
          lang={lang}
          initial={modal.mode === "edit" ? modal.tpl : null}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {/* Delete confirm */}
      {delConf && (
        <Modal onClose={() => setDelConf(null)}>
          <div className="modal-h">
            <h2>{lang === "uk" ? "Видалити шаблон?" : "Delete template?"}</h2>
            <p>{lang === "uk" ? "Цю дію не можна скасувати." : "This action cannot be undone."}</p>
          </div>
          <div className="modal-foot">
            <button className="btn" onClick={() => setDelConf(null)}>
              {lang === "uk" ? "Скасувати" : "Cancel"}
            </button>
            <button className="btn danger" onClick={() => handleDelete(delConf)}>
              <Icon name="x" size={13} /> {lang === "uk" ? "Видалити" : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Template card ──────────────────────────────────────────────────────────
function TemplateCard({ tpl, lang, isBuiltin, specName, onEdit, onUse, onDelete }) {
  const required = tpl.sections.filter((s) => s.required).length;
  return (
    <div className="tpl-card">
      <div className="tpl-card-top">
        <div className="tpl-card-icon">
          <Icon name={tpl.icon || "fileText"} size={18} />
        </div>
        <div className="tpl-card-meta">
          <div className="tpl-card-name">{tpl.name[lang] || tpl.name.en}</div>
          <div className="tpl-card-sub">
            <span className="chip" style={{ fontSize: 11 }}>{tpl.code}</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{specName}</span>
          </div>
        </div>
        {isBuiltin && (
          <span className="chip" style={{ fontSize: 10, alignSelf: "flex-start", flexShrink: 0 }}>
            {lang === "uk" ? "вбудований" : "built-in"}
          </span>
        )}
      </div>

      <div className="tpl-card-sections">
        {tpl.sections.map((s) => (
          <span key={s.id} className={`tpl-sec-dot${s.required ? " req" : ""}`} title={s.name[lang] || s.name.en} />
        ))}
        <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 4 }}>
          {tpl.sections.length}{lang === "uk" ? " секцій" : " sections"}
          {required > 0 && ` · ${required} ${lang === "uk" ? "обов'язкових" : "required"}`}
        </span>
      </div>

      <div className="tpl-card-actions">
        <button className="btn sm" onClick={onUse}>
          <Icon name="mic" size={12} /> {lang === "uk" ? "Використати" : "Use"}
        </button>
        <button className="btn ghost sm" onClick={onEdit}>
          <Icon name="edit" size={12} /> {lang === "uk" ? "Редагувати" : "Edit"}
        </button>
        {!isBuiltin && (
          <button className="icon-btn danger" onClick={onDelete} title={lang === "uk" ? "Видалити" : "Delete"}>
            <Icon name="x" size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Create / Edit modal ────────────────────────────────────────────────────
function TemplateModal({ lang, initial, onSave, onClose }) {
  const [tab, setTab] = useState("build"); // build | import | preview
  const isEdit = !!initial;

  // Build tab state
  const [nameUk,    setNameUk]    = useState(initial?.name?.uk   ?? "");
  const [nameEn,    setNameEn]    = useState(initial?.name?.en   ?? "");
  const [code,      setCode]      = useState(initial?.code       ?? "");
  const [specialty, setSpecialty] = useState(initial?.specialty  ?? "radiology");
  const [icon,      setIcon]      = useState(initial?.icon       ?? "fileText");
  const [sections,  setSections]  = useState(
    initial?.sections?.map((s) => ({ ...s })) ??
    [
      { id: "indication", nameUk: "Показання",  nameEn: "Indication",  required: true  },
      { id: "findings",   nameUk: "Результати", nameEn: "Findings",    required: true  },
      { id: "impression", nameUk: "Висновок",   nameEn: "Impression",  required: true  },
    ]
  );

  // Import tab state
  const [importText,   setImportText]   = useState("");
  const [importError,  setImportError]  = useState("");
  const [importParsed, setImportParsed] = useState(null);
  const [dragOver,     setDragOver]     = useState(false);
  const fileRef = useRef(null);

  // Drag-to-reorder sections
  const dragIdx = useRef(null);
  const onDragStart = (i)     => { dragIdx.current = i; };
  const onDragOver  = (e, i)  => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === i) return;
    const next = [...sections];
    const [row] = next.splice(dragIdx.current, 1);
    next.splice(i, 0, row);
    setSections(next);
    dragIdx.current = i;
  };
  const onDragEnd = () => { dragIdx.current = null; };

  // Section helpers
  const setSection = (i, key, val) =>
    setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, [key]: val } : s)));
  const addSection  = () => setSections((prev) => [...prev, { id: `sec-${Date.now()}`, nameUk: "", nameEn: "", required: false }]);
  const removeSection = (i) => setSections((prev) => prev.filter((_, idx) => idx !== i));

  // Auto-generate code from English name
  const autoCode = (name) => name.replace(/[^a-zA-Z0-9 ]/g, "").trim().split(/\s+/).slice(0, 3).join("-").toUpperCase();

  // Build validation
  const buildValid = (nameUk.trim() || nameEn.trim()) &&
    code.trim().length >= 2 &&
    sections.length > 0 &&
    sections.every((s) => s.nameUk?.trim() || s.nameEn?.trim() || s.name?.uk || s.name?.en);

  // Assemble from build tab — always returns a valid object (empty fields get placeholder text)
  const buildTemplate = () => ({
    id:       initial?.id ?? `tpl-${Date.now().toString(36)}`,
    name:     {
      uk: nameUk.trim() || nameEn.trim() || (lang === "uk" ? "Без назви" : "Untitled"),
      en: nameEn.trim() || nameUk.trim() || "Untitled",
    },
    code:     code.trim().toUpperCase() || "???",
    specialty,
    icon,
    sections: sections.map((s, i) => {
      const uk = s.nameUk ?? s.name?.uk ?? "";
      const en = s.nameEn ?? s.name?.en ?? "";
      return {
        id:       s.id || `sec-${i}`,
        required: !!s.required,
        name:     {
          uk: uk.trim() || en.trim() || `Секція ${i + 1}`,
          en: en.trim() || uk.trim() || `Section ${i + 1}`,
        },
        anchor:   s.anchor ?? { uk: uk.toLowerCase().trim(), en: en.toLowerCase().trim() },
      };
    }),
  });

  // Import helpers
  const parseImport = (text) => {
    setImportError("");
    setImportParsed(null);
    try {
      const raw = JSON.parse(text.trim());
      const tpl = normaliseImport(raw);
      if (!tpl.name?.en && !tpl.name?.uk) throw new Error("Missing name");
      if (!tpl.code) throw new Error("Missing code");
      if (!Array.isArray(tpl.sections) || tpl.sections.length === 0) throw new Error("No sections");
      setImportParsed(tpl);
      setTab("preview");
    } catch (e) {
      setImportError(e.message || "Invalid JSON");
    }
  };

  const normaliseImport = (raw) => ({
    id:       `tpl-${Date.now().toString(36)}`,
    name:     raw.name  ?? { uk: raw.nameUk ?? "", en: raw.nameEn ?? "" },
    code:     (raw.code ?? "").toUpperCase(),
    specialty: raw.specialty ?? "radiology",
    icon:     raw.icon ?? "fileText",
    sections: (raw.sections ?? []).map((s, i) => ({
      id:       s.id ?? `sec-${i}`,
      required: !!s.required,
      name:     s.name ?? { uk: s.nameUk ?? s.name_uk ?? "", en: s.nameEn ?? s.name_en ?? "" },
      anchor:   s.anchor ?? {
        uk: (s.name?.uk ?? s.nameUk ?? "").toLowerCase(),
        en: (s.name?.en ?? s.nameEn ?? "").toLowerCase(),
      },
    })),
  });

  const handleFileRead = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setImportText(e.target.result);
      parseImport(e.target.result);
    };
    reader.readAsText(file);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileRead(file);
  };

  // Final save
  const handleSave = () => {
    if (tab === "import" || tab === "preview") {
      if (importParsed) onSave(importParsed);
    } else {
      if (buildValid) onSave(buildTemplate());
    }
  };

  const canSave = (tab === "build" && buildValid) ||
                  ((tab === "import" || tab === "preview") && !!importParsed);

  // importParsed wins if present, otherwise always show the live builder state
  const previewTpl = importParsed ?? buildTemplate();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="tpl-modal" onClick={(e) => e.stopPropagation()}>

        {/* Modal header */}
        <div className="tpl-modal-head">
          <div>
            <h2>{isEdit
              ? (lang === "uk" ? "Редагувати шаблон" : "Edit template")
              : (lang === "uk" ? "Новий шаблон"      : "New template")
            }</h2>
            <p>{lang === "uk" ? "Визначте структуру та секції звіту" : "Define the report structure and sections"}</p>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="tpl-modal-tabs">
          {[
            { key: "build",   icon: "edit",      label: lang === "uk" ? "Конструктор" : "Builder"  },
            { key: "import",  icon: "download",  label: lang === "uk" ? "Імпорт"     : "Import"   },
            { key: "preview", icon: "eye",       label: lang === "uk" ? "Перегляд"   : "Preview"  },
          ].map(({ key, icon, label }) => (
            <button
              key={key}
              className={`tpl-modal-tab${tab === key ? " on" : ""}`}
              onClick={() => setTab(key)}
            >
              <Icon name={icon} size={13} /> {label}
              {key === "preview" && previewTpl && <span className="tpl-modal-tab-dot" />}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="tpl-modal-body">

          {/* ── Build tab ── */}
          {tab === "build" && (
            <div className="tpl-build">
              {/* Icon + name row */}
              <div className="tpl-build-row">
                <div className="tpl-build-label">{lang === "uk" ? "Іконка" : "Icon"}</div>
                <div className="icon-pick">
                  {ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      className={`icon-opt${icon === ic ? " on" : ""}`}
                      onClick={() => setIcon(ic)}
                      title={ICON_LABELS[ic]}
                    >
                      <Icon name={ic} size={16} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="tpl-build-row two">
                <div>
                  <div className="tpl-build-label">{lang === "uk" ? "Назва (UA)" : "Name (UA)"}</div>
                  <input className="ti" value={nameUk} placeholder="КТ органів грудної клітки"
                    onChange={(e) => setNameUk(e.target.value)} />
                </div>
                <div>
                  <div className="tpl-build-label">{lang === "uk" ? "Назва (EN)" : "Name (EN)"}</div>
                  <input className="ti" value={nameEn} placeholder="CT Chest"
                    onChange={(e) => {
                      setNameEn(e.target.value);
                      if (!code) setCode(autoCode(e.target.value));
                    }} />
                </div>
              </div>

              <div className="tpl-build-row two">
                <div>
                  <div className="tpl-build-label">{lang === "uk" ? "Код шаблону" : "Template code"}</div>
                  <input className="ti mono" value={code} placeholder="CT-CHEST"
                    onChange={(e) => setCode(e.target.value.toUpperCase())} />
                </div>
                <div>
                  <div className="tpl-build-label">{lang === "uk" ? "Спеціальність" : "Specialty"}</div>
                  <select className="ti" value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
                    {SPECIALTIES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label[lang]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sections */}
              <div className="tpl-build-sections-head">
                <span className="tpl-build-label" style={{ margin: 0 }}>
                  {lang === "uk" ? "Секції" : "Sections"}
                  <span className="psub" style={{ marginLeft: 6 }}>
                    {lang === "uk" ? "перетягніть для зміни порядку" : "drag to reorder"}
                  </span>
                </span>
                <button className="btn ghost sm" type="button" onClick={addSection}>
                  <Icon name="plus" size={12} /> {lang === "uk" ? "Додати секцію" : "Add section"}
                </button>
              </div>

              <div className="tpl-sections-list">
                {sections.map((s, i) => {
                  const nameUkV = s.nameUk ?? s.name?.uk ?? "";
                  const nameEnV = s.nameEn ?? s.name?.en ?? "";
                  return (
                    <div
                      key={s.id || i}
                      className="tpl-sec-row"
                      draggable
                      onDragStart={() => onDragStart(i)}
                      onDragOver={(e)  => onDragOver(e, i)}
                      onDragEnd={onDragEnd}
                    >
                      <div className="tpl-sec-drag" title="Drag to reorder">
                        <Icon name="moreV" size={14} />
                      </div>
                      <div className="tpl-sec-num">{i + 1}</div>
                      <input className="ti" placeholder={lang === "uk" ? "Назва UA" : "Name UA"}
                        value={nameUkV}
                        onChange={(e) => setSection(i, "nameUk", e.target.value)} />
                      <input className="ti" placeholder={lang === "uk" ? "Назва EN" : "Name EN"}
                        value={nameEnV}
                        onChange={(e) => setSection(i, "nameEn", e.target.value)} />
                      <label className="tpl-sec-req" title={lang === "uk" ? "Обов'язкова секція" : "Required section"}>
                        <input type="checkbox" checked={!!s.required}
                          onChange={(e) => setSection(i, "required", e.target.checked)} />
                        <span>{lang === "uk" ? "Обов'язк." : "Required"}</span>
                      </label>
                      <button type="button" className="iconbtn danger"
                        disabled={sections.length <= 1}
                        onClick={() => removeSection(i)}>
                        <Icon name="x" size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Import tab ── */}
          {tab === "import" && (
            <div className="tpl-import">
              {/* Drop zone */}
              <div
                className={`tpl-dropzone${dragOver ? " over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept=".json,application/json"
                  style={{ display: "none" }}
                  onChange={(e) => e.target.files[0] && handleFileRead(e.target.files[0])} />
                <Icon name="download" size={28} />
                <strong>{lang === "uk" ? "Перетягніть .json файл сюди" : "Drop a .json file here"}</strong>
                <span>{lang === "uk" ? "або натисніть для вибору" : "or click to browse"}</span>
              </div>

              <div className="tpl-import-or">
                <span>{lang === "uk" ? "або вставте JSON" : "or paste JSON"}</span>
              </div>

              <textarea
                className="tpl-import-area"
                placeholder={`{\n  "name": { "uk": "...", "en": "CT Chest" },\n  "code": "CT-CHEST",\n  "specialty": "radiology",\n  "sections": [\n    { "id": "indication", "required": true, "name": { "uk": "Показання", "en": "Indication" } }\n  ]\n}`}
                value={importText}
                onChange={(e) => { setImportText(e.target.value); setImportError(""); setImportParsed(null); }}
                spellCheck={false}
              />

              <div className="tpl-import-actions">
                {importError && (
                  <span className="tpl-import-error">
                    <Icon name="flag" size={13} /> {importError}
                  </span>
                )}
                {importParsed && (
                  <span className="tpl-import-ok">
                    <Icon name="check" size={13} />
                    {lang === "uk" ? `Розпізнано: ${importParsed.name[lang] || importParsed.name.en}` : `Parsed: ${importParsed.name.en || importParsed.name.uk}`}
                  </span>
                )}
                <button
                  className="btn primary sm"
                  style={{ marginLeft: "auto" }}
                  disabled={!importText.trim()}
                  onClick={() => parseImport(importText)}
                >
                  <Icon name="check" size={13} /> {lang === "uk" ? "Розпізнати та переглянути" : "Parse & preview"}
                </button>
              </div>
            </div>
          )}

          {/* ── Preview tab ── */}
          {tab === "preview" && (
            <div className="tpl-preview">
              {/* Missing fields warning */}
              {!buildValid && !importParsed && (
                <div className="tpl-preview-warn">
                  <Icon name="flag" size={13} />
                  <span>
                    {lang === "uk"
                      ? "Деякі поля не заповнені — заповніть їх у Конструкторі перед збереженням."
                      : "Some fields are incomplete — finish them in Builder before saving."}
                  </span>
                </div>
              )}

              <div className="tpl-preview-header">
                <div className="tpl-icon" style={{ width: 44, height: 44, borderRadius: 12 }}>
                  <Icon name={previewTpl.icon || "fileText"} size={22} />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-1)" }}>
                    {previewTpl.name[lang] || previewTpl.name.en}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 5, alignItems: "center" }}>
                    <span className="chip">{previewTpl.code}</span>
                    <span className="psub">
                      {SPECIALTIES.find((s) => s.value === previewTpl.specialty)?.label[lang] ?? previewTpl.specialty}
                    </span>
                    <span className="psub">·</span>
                    <span className="psub">
                      {previewTpl.sections.length}{" "}
                      {lang === "uk" ? "секцій" : "sections"}
                      {" · "}
                      {previewTpl.sections.filter(s => s.required).length}{" "}
                      {lang === "uk" ? "обов'язкових" : "required"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="tpl-preview-sections">
                <div className="rail-h" style={{ padding: "0 0 10px", fontSize: 11 }}>
                  {lang === "uk" ? "СТРУКТУРА ЗВІТУ" : "REPORT STRUCTURE"}
                </div>
                {previewTpl.sections.map((s, i) => (
                  <div key={s.id || i} className="tpl-preview-row">
                    <div className="tpl-sec-num" style={{ width: 24, height: 24, lineHeight: "24px" }}>{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 500, color: "var(--text-1)" }}>{s.name[lang] || s.name.en}</span>
                      {s.name.uk && s.name.en && s.name.uk !== s.name.en && (
                        <span className="psub" style={{ marginLeft: 8 }}>
                          {s.name[lang === "uk" ? "en" : "uk"]}
                        </span>
                      )}
                    </div>
                    {s.required && <span className="req-tag">{lang === "uk" ? "Обов'язк." : "Required"}</span>}
                    {(s.anchor?.uk || s.anchor?.en) && (
                      <div className="psub" style={{ fontSize: 11, fontFamily: "var(--mono)" }}>
                        «{s.anchor[lang] || s.anchor.en}»
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="tpl-preview-hint">
                <Icon name="mic" size={12} />
                <span>
                  {lang === "uk"
                    ? "Голосова команда «перейти до [секції]» переміщує курсор між секціями під час диктування."
                    : "Say \"go to [section name]\" while dictating to jump between sections hands-free."}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="tpl-modal-foot">
          <button className="btn" onClick={onClose}>
            {lang === "uk" ? "Скасувати" : "Cancel"}
          </button>
          {tab !== "preview" && tab !== "import" && (
            <button className="btn ghost sm" onClick={() => setTab("preview")} disabled={!buildValid}>
              <Icon name="eye" size={13} /> {lang === "uk" ? "Переглянути" : "Preview"}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn accent" disabled={!canSave} onClick={handleSave}>
            <Icon name={isEdit ? "save" : "plus"} size={13} />
            {isEdit
              ? (lang === "uk" ? "Зберегти зміни" : "Save changes")
              : (lang === "uk" ? "Створити шаблон" : "Create template")
            }
          </button>
        </div>
      </div>
    </div>
  );
}
