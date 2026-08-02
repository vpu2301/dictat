// chat/features/chat/CalculatorDialog.jsx — bedside arithmetic, in the modal.
//
// Prefilled from the attached patient where the roster actually carries the
// value (age, sex) and left blank where it does not — a calculator that invents
// a creatinine because "there was probably one" is worse than an empty field.
//
// The result leaves as a sentence, not a number: "eGFR (CKD-EPI 2021): 60
// ml/min/1.73m² (creatinine 1.3 mg/dL, age 67, male)". Pasted into a question
// or a note, a bare "60" is a number nobody can check.

import React, { useMemo, useState } from "react";
import { Icon } from "../../ui/Icon.jsx";
import { ModalLayer } from "../../ui/ModalLayer.jsx";
import { useEmbed } from "../../EmbedContext.jsx";
import { RUN, CHADSVASC_ITEMS, resultLine } from "../../calculators.js";
import { age as ageFrom, t } from "../../i18n.js";

const TABS = [
  { key: "egfr", uk: "eGFR", en: "eGFR" },
  { key: "chadsvasc", uk: "CHA₂DS₂-VASc", en: "CHA₂DS₂-VASc" },
  { key: "bmi", uk: "ІМТ", en: "BMI" },
];

export function CalculatorDialog({ patient, initial = "egfr", locale = "en", onClose, onInsert }) {
  const patientAge = patient ? ageFrom(patient.dob) : null;
  const { modal } = useEmbed();
  const [tab, setTab] = useState(initial);
  const [form, setForm] = useState({
    creatinine: "",
    age: patientAge != null ? String(patientAge) : "",
    sex: patient?.sex || "m",
    flags: {},
    weightKg: "",
    heightCm: "",
  });

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const toggleFlag = (key) => setForm((f) => ({ ...f, flags: { ...f.flags, [key]: !f.flags[key] } }));

  const result = useMemo(() => RUN[tab]?.(form) || null, [tab, form]);

  return (
    <ModalLayer {...modal}>
    <div className="ec-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ec-dialog" role="dialog" aria-modal="true" aria-labelledby="ec-calc-title">
        <div className="ec-modal-h">
          <h2 id="ec-calc-title">{t(locale, "Калькулятори", "Calculators")}</h2>
          <p>
            {patient
              ? t(locale,
                `Поля заповнено з даних пацієнта там, де вони є (${patient.name}).`,
                `Prefilled from the patient's record where it has the value (${patient.name}).`)
              : t(locale, "Результат можна вставити в питання.", "The result can be inserted into your question.")}
          </p>
        </div>

        <div className="ec-modal-b">
          <div className="ec-tabs">
            {TABS.map((x) => (
              <button
                key={x.key} type="button" role="tab" aria-selected={tab === x.key}
                className={`ec-tab${tab === x.key ? " on" : ""}`}
                onClick={() => setTab(x.key)}
              >
                {t(locale, x.uk, x.en)}
              </button>
            ))}
          </div>

          {tab === "egfr" && (
            <div className="ec-calc-grid">
              <label className="ec-field">
                <span className="ec-field-l">{t(locale, "Креатинін (мг/дл)", "Creatinine (mg/dL)")}</span>
                <input className="ec-ti" inputMode="decimal" value={form.creatinine} autoFocus
                       onChange={(e) => set({ creatinine: e.target.value })} placeholder="1.3" />
              </label>
              <label className="ec-field">
                <span className="ec-field-l">{t(locale, "Вік", "Age")}</span>
                <input className="ec-ti" inputMode="numeric" value={form.age}
                       onChange={(e) => set({ age: e.target.value })} placeholder="67" />
              </label>
              <label className="ec-field">
                <span className="ec-field-l">{t(locale, "Стать", "Sex")}</span>
                <select className="ec-ti" value={form.sex} onChange={(e) => set({ sex: e.target.value })}>
                  <option value="m">{t(locale, "Чоловіча", "Male")}</option>
                  <option value="f">{t(locale, "Жіноча", "Female")}</option>
                </select>
              </label>
            </div>
          )}

          {tab === "chadsvasc" && (
            <>
              <label className="ec-field" style={{ maxWidth: 160 }}>
                <span className="ec-field-l">{t(locale, "Вік", "Age")}</span>
                <input className="ec-ti" inputMode="numeric" value={form.age} autoFocus
                       onChange={(e) => set({ age: e.target.value })} placeholder="78" />
              </label>
              <div className="ec-checks">
                {CHADSVASC_ITEMS.map((item) => (
                  <label className="ec-check" key={item.key}>
                    <input type="checkbox" checked={!!form.flags[item.key]} onChange={() => toggleFlag(item.key)} />
                    <span>{t(locale, item.uk, item.en)}</span>
                    <span className="ec-check-pts">+{item.points}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {tab === "bmi" && (
            <div className="ec-calc-grid">
              <label className="ec-field">
                <span className="ec-field-l">{t(locale, "Вага (кг)", "Weight (kg)")}</span>
                <input className="ec-ti" inputMode="decimal" value={form.weightKg} autoFocus
                       onChange={(e) => set({ weightKg: e.target.value })} placeholder="70" />
              </label>
              <label className="ec-field">
                <span className="ec-field-l">{t(locale, "Зріст (см)", "Height (cm)")}</span>
                <input className="ec-ti" inputMode="decimal" value={form.heightCm}
                       onChange={(e) => set({ heightCm: e.target.value })} placeholder="175" />
              </label>
            </div>
          )}

          <div className="ec-calc-out" aria-live="polite">
            {result ? (
              <>
                <span className="ec-calc-val">{result.value}</span>
                <span className="ec-calc-unit">{result.unit}</span>
                <span className="ec-calc-detail">{result.detail}</span>
              </>
            ) : (
              <span className="ec-note ec-note-sm">
                {t(locale, "Заповніть поля, щоб отримати результат.", "Fill the fields to get a result.")}
              </span>
            )}
          </div>
        </div>

        <div className="ec-modal-f">
          <button type="button" className="ec-btn ec-btn-quiet" onClick={onClose}>
            {t(locale, "Закрити", "Close")}
          </button>
          <button
            type="button"
            className="ec-btn ec-btn-primary"
            disabled={!result}
            onClick={() => onInsert(resultLine(result))}
          >
            <Icon name="arrowUp" size={13} />
            <span>{t(locale, "Вставити в питання", "Insert into question")}</span>
          </button>
        </div>
      </div>
    </div>
    </ModalLayer>
  );
}
