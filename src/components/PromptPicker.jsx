// PromptPicker.jsx — (language, specialty) prompt dropdown.
//
// Pulls the prompt list from the asr-service. Renders a loading state while
// fetching, an error banner on failure, and an empty option when the backend
// returns no prompts.
import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "./UI.jsx";
import { MenuSelect } from "./MenuSelect.jsx";
import { listPrompts } from "../api/asr.js";
import { tr } from "../i18n.js";

const SPECIALTY_LABELS = {
  cardiology:       { uk: "Кардіологія",        en: "Cardiology" },
  endocrinology:    { uk: "Ендокринологія",     en: "Endocrinology" },
  gastroenterology: { uk: "Гастроентерологія",  en: "Gastroenterology" },
  neurology:        { uk: "Неврологія",         en: "Neurology" },
  orthopedics:      { uk: "Ортопедія",          en: "Orthopedics" },
  pediatrics:       { uk: "Педіатрія",          en: "Pediatrics" },
  general:          { uk: "Загальна практика",  en: "General" },
};

function labelFor(p, lang) {
  const sp = SPECIALTY_LABELS[p.specialty] || { uk: p.specialty, en: p.specialty };
  return `${p.language.toUpperCase()} · ${sp[lang] || sp.en}`;
}

export function PromptPicker({ value, onChange, language, lang = "en", disabled }) {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const r = await listPrompts();
        if (cancelled) return;
        setPrompts(r);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Filter by selected language; "auto" (or unset) shows every language.
  const filtered = useMemo(() => {
    if (!language || language === "auto") return prompts;
    return prompts.filter((p) => p.language === language);
  }, [prompts, language]);

  // If the language switch leaves the current selection invalid, clear it.
  useEffect(() => {
    if (!value) return;
    if (!filtered.some((p) => p.id === value)) onChange("");
    // eslint-disable-next-line
  }, [language, prompts]);

  const options = useMemo(() => filtered.map((p) => ({
    value: p.id,
    label: labelFor(p, lang),
    sub: p.is_default ? undefined : p.id.slice(0, 6),
  })), [filtered, lang]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <MenuSelect
        block
        icon="bot"
        value={value || ""}
        options={options}
        onChange={onChange}
        disabled={disabled || loading}
        ariaLabel={tr(lang, "Напрям транскрипції", "Transcription specialty")}
        placeholder={loading
          ? tr(lang, "Завантаження…", "Loading prompts…")
          : tr(lang, "Оберіть напрям", "Choose specialty")}
      />

      {error && (
        <div className="asr-banner asr-banner-err" role="alert">
          <Icon name="x" size={13} />
          <span>{error.message || (tr(lang, "Не вдалося завантажити", "Could not load prompts"))}</span>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="asr-banner asr-banner-warn" role="status">
          <Icon name="help" size={13} />
          <span>
            {tr(lang, "Немає доступних напрямів транскрипції.", "No transcription prompts available.")}
          </span>
        </div>
      )}
    </div>
  );
}
