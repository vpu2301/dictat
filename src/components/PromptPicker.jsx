// PromptPicker.jsx — (language, specialty) prompt dropdown.
//
// Pulls the prompt list from the asr-service. Renders a loading state while
// fetching, an error banner on failure, and an empty option when the backend
// returns no prompts.
import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "./UI.jsx";
import { listPrompts } from "../api/asr.js";

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

  // Filter by selected language; if language unset, show all.
  const filtered = useMemo(() => {
    if (!language) return prompts;
    return prompts.filter((p) => p.language === language);
  }, [prompts, language]);

  // If the language switch leaves the current selection invalid, clear it.
  useEffect(() => {
    if (!value) return;
    if (!filtered.some((p) => p.id === value)) onChange("");
    // eslint-disable-next-line
  }, [language, prompts]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <select
        className="select"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading}
        style={{ width: "100%" }}
      >
        <option value="" disabled>
          {loading
            ? (lang === "uk" ? "Завантаження…" : "Loading prompts…")
            : (lang === "uk" ? "Оберіть напрям" : "Choose specialty")}
        </option>
        {filtered.map((p) => (
          <option key={p.id} value={p.id}>
            {labelFor(p, lang)}{p.is_default ? "" : ` · ${p.id.slice(0, 6)}`}
          </option>
        ))}
      </select>

      {error && (
        <div className="asr-banner asr-banner-err" role="alert">
          <Icon name="x" size={13} />
          <span>{error.message || (lang === "uk" ? "Не вдалося завантажити" : "Could not load prompts")}</span>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="asr-banner asr-banner-warn" role="status">
          <Icon name="help" size={13} />
          <span>
            {lang === "uk"
              ? "Немає доступних напрямів транскрипції."
              : "No transcription prompts available."}
          </span>
        </div>
      )}
    </div>
  );
}
