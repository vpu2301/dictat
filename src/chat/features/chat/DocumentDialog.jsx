// chat/features/chat/DocumentDialog.jsx — the answer, turned into a document.
//
// Reading an answer and filing one are different jobs. This is the second: pick
// what you are writing (note / plan / summary), get a draft that is already in
// the right shape, edit it, then copy it or hand it to the host.
//
// The draft is EDITABLE on purpose. A generated clinical document that cannot
// be corrected before it is filed is a trap — and the edit is what turns "the
// machine wrote this" into "I reviewed and wrote this".

import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "../../ui/Icon.jsx";
import { ModalLayer } from "../../ui/ModalLayer.jsx";
import { useEmbed } from "../../EmbedContext.jsx";
import { generateDocument, DOCUMENT_KINDS } from "../../documents.js";
import { t } from "../../i18n.js";

const KIND_LABEL = {
  note: { icon: "fileText", uk: ["Нотатка", "Оцінка та план"], en: ["Note", "Assessment and plan"] },
  plan: { icon: "check", uk: ["План", "Пронумеровані кроки"], en: ["Plan", "Numbered steps"] },
  summary: { icon: "book", uk: ["Підсумок", "Питання, відповідь, джерела"], en: ["Summary", "Question, answer, sources"] },
};

export function DocumentDialog({
  question, answer, patient, locale = "en", answerLanguage = "en",
  onClose, onCreateDocument, onEvent,
}) {
  const { modal } = useEmbed();
  const [kind, setKind] = useState("note");
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  const generated = useMemo(
    () => generateDocument({ kind, question, answer, patient, language: answerLanguage, locale }),
    [kind, question, answer, patient, answerLanguage, locale],
  );

  // Switching kind regenerates. Edits are per-kind and deliberately not merged:
  // a plan is not an edited note, and silently carrying text across would
  // produce a document that claims to be one thing and reads as another.
  useEffect(() => { setBody(generated?.body || ""); setSent(false); }, [generated]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const edited = body !== (generated?.body || "");

  const copy = () => {
    navigator.clipboard?.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onEvent?.({ name: "document_copied", kind, edited, sources: generated?.sourceCount || 0 });
  };

  const send = async () => {
    if (!onCreateDocument) return;
    await onCreateDocument({ ...generated, body, edited });
    setSent(true);
    onEvent?.({ name: "document_sent_to_host", kind, edited, patientAttached: !!patient });
  };

  return (
    <ModalLayer {...modal}>
    <div className="ec-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ec-dialog ec-dialog-wide" role="dialog" aria-modal="true" aria-labelledby="ec-doc-title">
        <div className="ec-modal-h">
          <h2 id="ec-doc-title">{t(locale, "Створити документ", "Create a document")}</h2>
          <p>{t(locale,
            "Чернетку складено з цієї відповіді. Відредагуйте перед збереженням.",
            "Drafted from this answer. Edit it before you file it.")}</p>
        </div>

        <div className="ec-modal-b">
        <div className="ec-choices">
          {DOCUMENT_KINDS.map((k) => {
            const [label, hint] = locale === "uk" ? KIND_LABEL[k].uk : KIND_LABEL[k].en;
            return (
              <button
                key={k} type="button" role="radio" aria-checked={kind === k}
                className={`ec-choice${kind === k ? " on" : ""}`}
                onClick={() => setKind(k)}
              >
                <Icon name={KIND_LABEL[k].icon} size={14} />
                <span className="ec-choice-body">
                  <span>{label}</span>
                  <span className="ec-choice-hint">{hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        <textarea
          className="ec-doc-edit"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-label={t(locale, "Текст документа", "Document text")}
          spellCheck={false}
        />
        </div>

        <div className="ec-modal-f">
          <span className="ec-note ec-note-sm">
            {patient
              ? t(locale, `Містить контекст пацієнта: ${patient.name}.`, `Includes patient context: ${patient.name}.`)
              : t(locale, "Без контексту пацієнта.", "No patient context.")}
            {edited ? t(locale, " Відредаговано.", " Edited.") : ""}
          </span>
          <button type="button" className="ec-btn ec-btn-quiet" onClick={onClose}>
            {t(locale, "Закрити", "Close")}
          </button>
          <button type="button" className="ec-btn" onClick={copy}>
            <Icon name={copied ? "check" : "copy"} size={13} />
            <span>{copied ? t(locale, "Скопійовано", "Copied") : t(locale, "Копіювати", "Copy")}</span>
          </button>
          {onCreateDocument && (
            <button type="button" className="ec-btn ec-btn-primary" onClick={send} disabled={sent}>
              <Icon name={sent ? "check" : "arrowUp"} size={13} />
              <span>{sent
                ? t(locale, "Надіслано", "Sent")
                : t(locale, "Надіслати в застосунок", "Send to app")}</span>
            </button>
          )}
        </div>
      </div>
    </div>
    </ModalLayer>
  );
}
