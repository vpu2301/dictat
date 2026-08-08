// chat/features/chat/ChatPage.jsx — the module's main screen.
//
// Two states, one control. Following Perplexity's shape rather than a generic
// chat app:
//
//  · HOME — nothing asked yet. The ask box is the page: centred, large, with
//    example questions beneath it. On an empty evidence tool the hard part is
//    knowing what to ask, so the page answers that instead of showing an empty
//    thread. (Past conversations live in History, not here — one list, one
//    place.)
//  · DOCUMENT — a question has been asked. Earlier turns collapse into a
//    thread, the current question becomes a heading with its sources strip and
//    structured answer, and the same ask box docks to the bottom of the panel.
//
// The patient control lives inside the ask box in both states (see Composer),
// and that chip is the ONLY place attached context is shown: attaching a
// patient changes what the next question means, so it belongs where the
// question is typed — and nowhere else.

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "../../SessionContext.jsx";
import { useEmbed } from "../../EmbedContext.jsx";
import { useChat, useSessionDetail, useAgents, suggestedPrompts } from "../../data/hooks.js";
import { Composer } from "./Composer.jsx";
import { AnswerDocument } from "./AnswerDocument.jsx";
import { AnswerActions } from "./AnswerActions.jsx";
import { PastTurns } from "./PastTurns.jsx";
import { PatientImportDialog } from "./PatientImportDialog.jsx";
import { DocumentDialog } from "./DocumentDialog.jsx";
import { CalculatorDialog } from "./CalculatorDialog.jsx";
import { DisclaimerBanner } from "../../ui/Bits.jsx";
import { ErrorState } from "../../ui/States.jsx";
import { Icon } from "../../ui/Icon.jsx";
import { t } from "../../i18n.js";

export function ChatPage({ sessionId }) {
  const { user } = useSession();
  const {
    locale, settings, emit, navigate, live,
    patient, patientLocked, allowPatientImport, hasHostPicker,
    attachPatient, attachPatientById, removePatient, requestPatientFromHost,
    onCreateDocument,
  } = useEmbed();

  const chat = useChat({
    patientId: patient?.id || null,
    patient,
    language: settings.answerLanguage,
    onEvent: emit,
  });

  const [importOpen, setImportOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [docOpen, setDocOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  // What the next question carries besides its text. Neither is persisted: the
  // file is never uploaded (demo), and the agent choice rides with the ask.
  const [attachment, setAttachment] = useState(null);
  const [activeAgent, setActiveAgent] = useState(null);

  const agents = useAgents();

  // ── resume ──────────────────────────────────────────────────────────────
  // A resumed session restores its thread AND the patient it was held under —
  // reading old answers about a patient with no context attached would strip
  // the very thing that made them specific.
  const resumed = useSessionDetail(sessionId, settings.answerLanguage);
  useEffect(() => {
    if (!sessionId || !resumed.data) return;
    chat.loadSession(resumed.data);
    setFeedback(null);
    if (patientLocked) return;
    if (resumed.data.patientId) {
      if (resumed.data.patientId !== patient?.id) attachPatientById(resumed.data.patientId, { silent: true });
    } else if (patient) {
      // Restoring a session that was held WITHOUT a patient means restoring
      // that too. Leaving whoever happened to be attached would relabel old
      // generic answers as if they had been about them.
      removePatient({ silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, resumed.data]);

  // ── thread shape ────────────────────────────────────────────────────────
  // The last (question, answer) pair is the document; everything before it is
  // the collapsed thread above it.
  const { current, past } = useMemo(() => {
    const messages = chat.messages;
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return { current: null, past: [] };
    const index = messages.findIndex((m) => m.id === lastAssistant.id);
    const question = lastAssistant.question
      || [...messages.slice(0, index)].reverse().find((m) => m.role === "user")?.text
      || "";
    return { current: { question, message: lastAssistant }, past: messages.slice(0, Math.max(0, index - 1)) };
  }, [chat.messages]);

  useEffect(() => { setFeedback(null); }, [current?.message?.id]);

  // ── patient context ─────────────────────────────────────────────────────
  const addContext = async () => {
    if (hasHostPicker) {
      const picked = await requestPatientFromHost();
      if (picked) attachPatient(picked, { via: "host_picker" });
      return;
    }
    setImportOpen(true);
  };

  // The plain-text form of the answer, for the clipboard. Citation markers keep
  // their numbers and the source list travels with them — a pasted answer whose
  // "[1]" points at nothing is worse than one with no citations.
  const copyAnswer = () => {
    const a = current?.message?.answer;
    if (!a) return;
    const sources = (a.citations || []).map((c, i) => `[${i + 1}] ${c.title} — ${c.source} ${c.year} (${c.evidenceLevel})`);
    navigator.clipboard?.writeText([
      current.question, "",
      a.recommendation, "",
      a.summary, "",
      a.limitations ? `${t(locale, "Обмеження", "Limitations")}: ${a.limitations}` : null, "",
      ...sources,
    ].filter((line) => line !== null).join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    emit({ name: "answer_copied" });
  };

  // "Drug check" writes the question rather than opening a separate mode: the
  // module answers questions, so the tool's job is to phrase a good one — with
  // the patient's own medication list when there is one.
  const drugCheck = () => {
    const meds = patient?.medications?.length ? patient.medications.join(", ") : null;
    setDraft(meds
      ? t(locale,
        `Перевірте взаємодії та дозування: ${meds}.`,
        `Check interactions and dosing for: ${meds}.`)
      : t(locale,
        "Перевірте взаємодії та дозування для: ",
        "Check interactions and dosing for: "));
    emit({ name: "tool_drug_check", patientAttached: !!patient });
  };

  const composer = (size) => (
    <Composer
      size={size}
      onSend={(text) => {
        chat.send(text);
        // The attachment belongs to the question it was attached to.
        if (attachment) { emit({ name: "attachment_sent", size: attachment.size }); setAttachment(null); }
      }}
      onStop={chat.stop}
      streaming={chat.streaming}
      locale={locale}
      draft={draft}
      onDraftUsed={() => setDraft(null)}
      patient={patient}
      patientLocked={patientLocked}
      canAttachPatient={allowPatientImport || hasHostPicker}
      onAddPatient={addContext}
      onRemovePatient={removePatient}
      attachment={attachment}
      onAttach={(file) => { setAttachment(file); emit({ name: "attachment_added", size: file.size }); }}
      onRemoveAttachment={() => setAttachment(null)}
      agents={agents.data || []}
      activeAgent={activeAgent}
      onPickAgent={(a) => {
        setActiveAgent((cur) => (cur?.id === a.id ? null : a));
        emit({ name: "agent_selected", agentId: a.id });
      }}
      onManageAgents={() => navigate({ view: "agents" })}
      onDrugCheck={drugCheck}
      onOpenCalculator={() => { setCalcOpen(true); emit({ name: "tool_calculator_opened" }); }}
      answerLanguage={settings.answerLanguage}
    />
  );

  // There is no patient card on the page. The chip inside the ask box is the
  // attached-context indicator, and it is where the question is typed — a
  // second panel restating the same fact is furniture between the reader and
  // the answer.

  const isHome = !current;

  return (
    <div className="ec-chat" data-state={isHome ? "home" : "doc"}>
      {resumed.error ? (
        <ErrorState
          error={resumed.error}
          onRetry={resumed.refetch}
          locale={locale}
          title={t(locale, "Не вдалося відкрити розмову", "Couldn’t open that conversation")}
        />
      ) : isHome ? (
        /* ── HOME ─────────────────────────────────────────── */
        <div className="ec-home">
          <div className="ec-home-hd">
            <span className="ec-home-mark"><Icon name="sparkle" size={18} /></span>
            <h1 className="ec-home-title">
              {t(locale, "Доказова відповідь на клінічне питання", "Evidence-based answers to clinical questions")}
            </h1>
            <p className="ec-home-sub">
              {patient
                ? t(locale,
                  `Відповіді враховують контекст пацієнта: ${patient.name}.`,
                  `Answers are contextualised for ${patient.name}.`)
                : t(locale,
                  "Кожна відповідь із джерелами: тип, рік і рівень доказовості. Додайте пацієнта в полі нижче, щоб відповіді враховували його дані.",
                  "Every answer comes with its sources — type, year and level of evidence. Attach a patient in the box below to contextualise them.")}
            </p>
          </div>

          {composer("hero")}

          <div className="ec-home-block">
            <div className="ec-home-label">{t(locale, "Спробуйте", "Try asking")}</div>
            <div className="ec-examples">
              {suggestedPrompts(settings.answerLanguage).map((p) => (
                <button key={p} type="button" className="ec-example" onClick={() => setDraft(p)}>
                  <Icon name="sparkle" size={12} />
                  <span>{p}</span>
                </button>
              ))}
            </div>
          </div>

          <DisclaimerBanner locale={locale} live={live} />
        </div>
      ) : (
        /* ── DOCUMENT ─────────────────────────────────────── */
        <>
          <div className="ec-doc-bar">
            <button
              type="button"
              className="ec-btn ec-btn-quiet"
              onClick={() => { chat.newChat(); navigate({ view: "chat" }); }}
            >
              <Icon name="plus" size={13} />
              <span>{t(locale, "Новий чат", "New chat")}</span>
            </button>
          </div>

          <div className="ec-scroll">
            {past.length > 0 && <PastTurns messages={past} locale={locale} />}
            <AnswerDocument
              question={current.question}
              message={current.message}
              patientName={patient?.name}
              onCiteFollowUp={(q) => setDraft(q)}
              locale={locale}
              answerLanguage={settings.answerLanguage}
              evidenceDetail={settings.evidenceDetail}
            />
          </div>

          {chat.error && (
            <div className="ec-inline-error" role="alert">
              <Icon name="alert" size={13} />
              <span>
                {/* The data layer already writes a typed, localised sentence for
                    every failure it knows how to name (evidenceApi.js: the
                    service is unreachable, the model timed out, the session
                    expired). Showing the generic line over it threw that away
                    and left "it failed" as the only diagnosis the reader ever
                    got. Anything without a `code` is an unnamed error, and its
                    raw message is not UI copy. */}
                {chat.error.code
                  ? chat.error.message
                  : t(locale, "Не вдалося отримати відповідь.", "The answer failed to come back.")}
                {chat.error.status ? ` (${chat.error.status})` : ""}
              </span>
              <button type="button" className="ec-linkbtn" onClick={chat.regenerate}>
                {t(locale, "Спробувати ще раз", "Try again")}
              </button>
            </div>
          )}

          {/* Docked, not fixed: it sticks to the bottom of the module's own box,
              so a host page can still scroll past the whole panel (§5). */}
          <div className="ec-dock">
            {current.message?.answer && !chat.streaming && (
              <AnswerActions
                locale={locale}
                feedback={feedback}
                onFeedback={(v) => {
                  setFeedback((cur) => (cur === v ? null : v));
                  emit({ name: "answer_feedback", value: v });
                }}
                copied={copied}
                onCopy={copyAnswer}
                onRegenerate={chat.regenerate}
                onCreateDocument={() => { setDocOpen(true); emit({ name: "document_opened" }); }}
              />
            )}
            {composer("bar")}
            <DisclaimerBanner locale={locale} live={live} />
          </div>
        </>
      )}

      {docOpen && current?.message?.answer && (
        <DocumentDialog
          question={current.question}
          answer={current.message.answer}
          patient={patient}
          locale={locale}
          answerLanguage={settings.answerLanguage}
          onEvent={emit}
          onCreateDocument={onCreateDocument}
          onClose={() => setDocOpen(false)}
        />
      )}

      {calcOpen && (
        <CalculatorDialog
          patient={patient}
          locale={locale}
          onClose={() => setCalcOpen(false)}
          onInsert={(line) => {
            setDraft(line);
            setCalcOpen(false);
            emit({ name: "tool_calculator_inserted" });
          }}
        />
      )}

      {importOpen && (
        <PatientImportDialog
          locale={locale}
          answerLanguage={settings.answerLanguage}
          onClose={() => setImportOpen(false)}
          onPick={(picked) => {
            attachPatient(picked, { via: "import_dialog" });
            setImportOpen(false);
          }}
        />
      )}
    </div>
  );
}
