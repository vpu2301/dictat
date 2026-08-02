// chat/features/chat/Composer.jsx — the input, and the module's centre of gravity.
//
// One rounded card holding the question on top and a tool row beneath it. It is
// the same component in both screen states — big and centred on the home
// screen, docked to the bottom of the panel once a conversation exists.
//
// The tool row is two drop-ups, opening upward because the box sits at the
// bottom of the panel:
//
//   ⌾  Context   attach a patient, attach a file
//   ⌾  Tools     drug check, calculators, which agent answers
//
// The answer language is NOT here. It is a setting, it changes rarely, and the
// answer itself is written in it — a badge repeating that on every question is
// a fact the reader already has.
//
// Idle they are icons — the row stays quiet when the question carries nothing.
// The moment something IS attached the trigger becomes it: the Context pill
// shows the patient's name, the Tools pill shows the chosen agent, each with a
// × to detach. No chips beside the buttons; the button is the chip.

import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../../ui/Icon.jsx";
import { Dropup, DropupItem, DropupLabel, DropupSep } from "../../ui/Dropup.jsx";
import { t } from "../../i18n.js";

const MAX_ROWS_PX = 168;

export function Composer({
  onSend,
  onStop,
  streaming,
  disabled,
  locale = "en",
  size = "bar",
  draft,
  onDraftUsed,
  // context
  patient,
  patientLocked,
  canAttachPatient,
  onAddPatient,
  onRemovePatient,
  attachment,
  onAttach,
  onRemoveAttachment,
  // tools
  agents = [],
  activeAgent,
  onPickAgent,
  onManageAgents,
  onDrugCheck,
  onOpenCalculator,
  answerLanguage = "en",
}) {
  const [value, setValue] = useState("");
  const areaRef = useRef(null);
  const fileRef = useRef(null);

  const resize = () => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_ROWS_PX)}px`;
  };
  useEffect(resize, [value]);

  // A suggested prompt, a follow-up or a calculator result lands in the box
  // rather than sending straight off, so the user can edit first.
  useEffect(() => {
    if (draft) {
      setValue((cur) => (cur.trim() ? `${cur.trim()} ${draft}` : draft));
      onDraftUsed?.();
      areaRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const submit = () => {
    const text = value.trim();
    if (!text || streaming || disabled) return;
    onSend(text);
    setValue("");
  };

  return (
    <form className="ec-ask" data-size={size} onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <textarea
        ref={areaRef}
        className="ec-ask-input"
        rows={1}
        value={value}
        disabled={disabled}
        placeholder={patient
          ? t(locale, `Питання щодо: ${patient.name}…`, `Ask about ${patient.name}…`)
          : t(locale, "Поставте клінічне запитання…", "Ask a clinical question…")}
        aria-label={t(locale, "Ваше запитання", "Your question")}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
        }}
      />

      <div className="ec-ask-bar">
        <div className="ec-ask-tools">
          {/* ── context ─────────────────────────────────────── */}
          <Dropup
            icon="patient"
            label={t(locale, "Контекст", "Context")}
            activeLabel={patient?.name || attachment?.name}
            activeTitle={patient && attachment
              ? `${patient.name} · ${attachment.name}`
              : (patient?.name || attachment?.name)}
            // A file rides along as a count rather than a second pill: the
            // patient is what changes the answer, the attachment is cargo.
            badge={patient && attachment ? "+1" : null}
            onClear={patientLocked
              ? null
              : (patient ? onRemovePatient : (attachment ? onRemoveAttachment : null))}
          >
            {(close) => (
              <>
                <DropupLabel>{t(locale, "Додати до питання", "Attach to this question")}</DropupLabel>
                <DropupItem
                  icon="patient"
                  label={patient
                    ? t(locale, "Замінити пацієнта", "Change patient")
                    : t(locale, "Пацієнт", "Patient")}
                  hint={patient
                    ? patient.name
                    : t(locale, "Відповіді враховуватимуть його дані", "Answers use their record")}
                  disabled={!canAttachPatient || patientLocked}
                  onClick={() => { close(); onAddPatient?.(); }}
                />
                <DropupItem
                  icon="fileText"
                  label={t(locale, "Файл", "Attachment")}
                  hint={t(locale, "Демо: файл не завантажується", "Demo: the file is not uploaded")}
                  onClick={() => { close(); fileRef.current?.click(); }}
                />
                {patient && !patientLocked && (
                  <>
                    <DropupSep />
                    <DropupItem
                      icon="x"
                      label={t(locale, "Прибрати пацієнта", "Remove patient")}
                      onClick={() => { close(); onRemovePatient?.(); }}
                    />
                  </>
                )}
              </>
            )}
          </Dropup>

          {/* ── tools ───────────────────────────────────────── */}
          <Dropup
            icon="sliders"
            label={t(locale, "Інструменти", "Tools")}
            activeLabel={activeAgent?.name}
            activeTitle={activeAgent?.description}
            onClear={activeAgent ? () => onPickAgent?.(activeAgent) : null}
          >
            {(close) => (
              <>
                <DropupItem
                  icon="pill"
                  label={t(locale, "Перевірка ліків", "Drug check")}
                  hint={patient
                    ? t(locale, "Взаємодії за списком пацієнта", "Interactions from the patient's list")
                    : t(locale, "Взаємодії та дозування", "Interactions and dosing")}
                  onClick={() => { close(); onDrugCheck?.(); }}
                />
                <DropupItem
                  icon="activity"
                  label={t(locale, "Калькулятори", "Calculators")}
                  hint="eGFR · CHA₂DS₂-VASc · BMI"
                  onClick={() => { close(); onOpenCalculator?.(); }}
                />
                <DropupSep />
                <DropupLabel>{t(locale, "Хто відповідає", "Which agent answers")}</DropupLabel>
                {agents.filter((a) => a.status !== "coming_soon").map((a) => (
                  <DropupItem
                    key={a.id}
                    icon={activeAgent?.id === a.id ? "check" : "sparkle"}
                    label={a.name}
                    hint={answerLanguage === "de" && a.descriptionDe
                      ? a.descriptionDe.slice(0, 48)
                      : a.description?.slice(0, 48)}
                    onClick={() => { close(); onPickAgent?.(a); }}
                  />
                ))}
                {onManageAgents && (
                  <>
                    <DropupSep />
                    <DropupItem
                      icon="users"
                      label={t(locale, "Керувати агентами", "Manage agents")}
                      onClick={() => { close(); onManageAgents(); }}
                    />
                  </>
                )}
              </>
            )}
          </Dropup>

          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onAttach?.({ name: file.name, size: file.size, type: file.type });
              e.target.value = "";
            }}
          />
        </div>

        <div className="ec-ask-right">
          <span className="ec-ask-hint">{t(locale, "Enter — надіслати", "Enter to send")}</span>
          {streaming ? (
            <button type="button" className="ec-ask-send ec-ask-send-stop" onClick={onStop}
                    aria-label={t(locale, "Зупинити", "Stop")} title={t(locale, "Зупинити", "Stop")}>
              <Icon name="stop" size={13} />
            </button>
          ) : (
            <button type="submit" className="ec-ask-send" disabled={!value.trim() || disabled}
                    aria-label={t(locale, "Надіслати", "Send")} title={t(locale, "Надіслати", "Send")}>
              <Icon name="arrowUp" size={16} />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
