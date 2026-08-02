// chat/features/chat/PatientImportDialog.jsx — bringing a patient into the chat.
//
// Built on the platform's modal pattern (header / body / tinted footer, no
// close X, action on the right): a row SELECTS, the footer button commits.
// That matters beyond consistency — attaching the wrong patient silently
// changes what every following answer is about, so it takes a deliberate
// second click, exactly like the assign-transcript modal it sits next to.
//
// Panel-scoped by construction: the scrim is `position: absolute` inside the
// module root, so it dims the module and nothing else. A feature that throws a
// fixed full-viewport overlay over its host has stopped being embedded (§5).
//
// This is the in-module path. If the host supplied `onRequestPatient`, the
// caller delegates to the host's own picker and this dialog never opens.

import React, { useEffect, useRef, useState } from "react";
import { useEmbed } from "../../EmbedContext.jsx";
import { usePatients } from "../../data/hooks.js";
import { Icon } from "../../ui/Icon.jsx";
import { ModalLayer } from "../../ui/ModalLayer.jsx";
import { LoadingSkeleton, ErrorState } from "../../ui/States.jsx";
import { age, t } from "../../i18n.js";

export function PatientImportDialog({ onPick, onClose, locale = "en", answerLanguage = "en" }) {
  const { searchPatients, modal } = useEmbed();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const inputRef = useRef(null);

  // `searchPatients` is the host's own roster when it supplied one; without it
  // the module falls back to its fixtures.
  const patients = usePatients(search, searchPatients);
  const rows = patients.data || [];

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // A selection that scrolls out of the result set is not a selection any more.
  useEffect(() => {
    if (selected && !rows.some((p) => p.id === selected.id)) setSelected(null);
  }, [rows, selected]);

  const meta = (p) => {
    const years = age(p.dob);
    const bits = [
      years != null ? t(locale, `${years} р.`, `${years} yrs`) : null,
      p.mrn || null,
      p.diagnoses?.length
        ? p.diagnoses.map((d) => (answerLanguage === "de" && d.labelDe ? d.labelDe : d.label)).join(", ")
        : null,
    ].filter(Boolean);
    return bits.length ? bits.join(" · ") : "—";
  };

  return (
    <ModalLayer {...modal}>
    <div className="ec-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ec-dialog" role="dialog" aria-modal="true" aria-labelledby="ec-import-title">
        <div className="ec-modal-h">
          <h2 id="ec-import-title">{t(locale, "Додати контекст пацієнта", "Add patient context")}</h2>
          <p>
            {searchPatients
              ? t(locale,
                "Пацієнти з реєстру клініки. Контекст діє лише в цій розмові й не зберігається модулем.",
                "Patients from your clinic's roster. The context applies to this conversation only and is not stored by the module.")
              : t(locale,
                "Демонстраційні акаунти пацієнтів. Реальні дані пацієнтів у цей модуль не потрапляють.",
                "Demo patient accounts. No real patient data flows through this module.")}
          </p>
        </div>

        <div className="ec-modal-b">
          <label className="ec-field">
            <span className="ec-field-l">{t(locale, "Пацієнт", "Patient")}</span>
            <input
              ref={inputRef}
              className="ec-ti"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(locale, "Пошук: ім’я, MRN або діагноз…", "Search name, MRN or diagnosis…")}
              aria-label={t(locale, "Пошук пацієнтів", "Search patients")}
            />
          </label>

          {patients.error ? (
            <ErrorState error={patients.error} onRetry={patients.refetch} locale={locale} compact />
          ) : (
            <ul className="ec-picklist" role="listbox" aria-label={t(locale, "Пацієнти", "Patients")}>
              {patients.loading ? (
                <li><LoadingSkeleton variant="list" rows={3} /></li>
              ) : rows.length === 0 ? (
                <li className="ec-picklist-empty">
                  {search
                    ? t(locale, "Нікого не знайдено", "No patients found")
                    : t(locale, "Список порожній", "The list is empty")}
                </li>
              ) : rows.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected?.id === p.id}
                    className={`ec-pickrow${selected?.id === p.id ? " on" : ""}`}
                    onClick={() => setSelected(p)}
                    onDoubleClick={() => onPick(p)}
                  >
                    <span className="ec-pickrow-name">{p.name}</span>
                    <span className="ec-pickrow-meta">{meta(p)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="ec-modal-f">
          <button type="button" className="ec-btn ec-btn-quiet" onClick={onClose}>
            {t(locale, "Скасувати", "Cancel")}
          </button>
          <button
            type="button"
            className="ec-btn ec-btn-primary"
            disabled={!selected}
            onClick={() => selected && onPick(selected)}
          >
            <Icon name="patient" size={13} />
            <span>{t(locale, "Додати контекст", "Add context")}</span>
          </button>
        </div>
      </div>
    </div>
    </ModalLayer>
  );
}
