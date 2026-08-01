// ConversationRoom.jsx — conversation mode (sprint 14).
//
// The clinician puts the device between themselves and the patient and lets the
// consultation happen. Four phases, in order, and the order is the point:
//
//   intro  — what will be recorded, said plainly, BEFORE anything opens. The
//            consent gate lives here: a conversation without a granted
//            `recording` consent never opens the socket (and dictation-service
//            would refuse it anyway — consent_required).
//   live   — text first, labels second; one tap to correct; the mapping always
//            explicit and freezable.
//   review — the session is already finalized server-side; the labels are
//            still editable, and this is the last moment they are.
//   draft  — the reviewed dialogue becomes a report draft and opens in the
//            existing Studio draft screen (sprint 08), where sprint-12
//            generation can run.
//
// There is NO voice-command surface anywhere in this file. In conversation
// mode the patient is speaking too, and «новий абзац» out of their mouth must
// never edit a record. The backend disables the NLP stage; the client offers
// no command hints, no undo toast, and drops any voice_command frame that
// arrives (wsClient.js).

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Icon, Empty } from "../components/UI.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { useAsync } from "../api/useAsync.js";
import { asList } from "../components/DataStates.jsx";
import { getPatient, yearOfBirth } from "../api/patients.js";
import { getEncounter, isEncounterClosed } from "../api/encounters.js";
import { VisitControls, visitStatusLabel } from "../patients/VisitControls.jsx";
import { listTemplates, getTemplate, toStudioTemplate } from "../api/templates.js";
import { listPrompts } from "../api/asr.js";
import { getSession } from "../api/dictation.js";
import { createReport } from "../api/reports.js";
import { useConsentGate, CONSENT_TYPE_RECORDING } from "../patients/consentGate.js";
import { ConsentSheet } from "../patients/ConsentSheet.jsx";
import { useMicDevices } from "../dictation/useMicDevices.js";
import { isOpusEncodingSupported } from "../dictation/opusEncoder.js";
import { explainErrorCode } from "../dictation/wsClient.js";
import { tr } from "../i18n.js";

import { useConversationSession } from "./useConversationSession.js";
import { TurnList } from "./TurnList.jsx";
import { MappingBanner } from "./MappingBanner.jsx";
import { corrections, unresolvedCount } from "./turns.js";
import { mergeReview, dialogueText, segmentIds, unattributedCount } from "./dialogue.js";
import { unresolvedNote } from "./copy.js";

const fmtClock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function Elapsed({ startedAt, lang }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return null;
  return (
    <span className="cv-clock" data-testid="cv-clock" aria-label={tr(lang, "Тривалість запису", "Recording length")}>
      {fmtClock(now - startedAt)}
    </span>
  );
}

export function ConversationRoom({ lang = "uk", patientId, encounterId, navigate }) {
  const [phase, setPhase] = useState("intro");     // intro | live | review | draft
  const [consentOpen, setConsentOpen] = useState(false);
  const [templateId, setTemplateId] = useState(null);
  const [reviewSegments, setReviewSegments] = useState(null);
  const [draftError, setDraftError] = useState(null);
  const [busy, setBusy] = useState(false);

  const patientReq = useAsync(() => (patientId ? getPatient(patientId) : Promise.resolve(null)), [patientId]);
  const encounterReq = useAsync(() => (encounterId ? getEncounter(encounterId) : Promise.resolve(null)), [encounterId]);
  const templatesReq = useAsync(() => listTemplates({ language: lang }), [lang]);
  const promptsReq = useAsync(() => listPrompts(), []);

  const patient = patientReq.data;
  const encounter = encounterReq.data;
  const templates = asList(templatesReq.data);
  // dictation-service refuses a conversation on a finished visit
  // (`encounter_closed`), and it is right to: the audio would attach to a
  // record that is already closed. Knowing that BEFORE the clinician asks the
  // patient for consent and presses record is the difference between a
  // sentence on screen and a consultation recorded into nothing.
  const visitClosed = !!encounter && isEncounterClosed(encounter.status);

  useEffect(() => {
    if (!templateId && templates.length) setTemplateId(templates[0].id);
  }, [templates, templateId]);

  // The ASR prompt: the default for this language, else the first one offered.
  // Conversation mode needs no section-specific prompt — there are no sections
  // until the draft exists.
  const promptId = useMemo(() => {
    const list = asList(promptsReq.data);
    const forLang = list.filter((p) => !p.language || p.language === lang);
    return (forLang.find((p) => p.is_default) || forLang[0] || list[0] || {}).id || null;
  }, [promptsReq.data, lang]);

  // Closing the tab mid-consultation is the one exit the app cannot make
  // graceful on its own: the unmount handler gets to send end_session, but a
  // hard unload may cut the socket first. Warn while audio is live.
  useEffect(() => {
    if (phase !== "live") return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [phase]);

  const mic = useMicDevices();
  const consentGate = useConsentGate(patientId, { encounterId, type: CONSENT_TYPE_RECORDING });

  const session = useConversationSession({
    language: lang,
    promptId,
    encounterId,
    deviceId: mic.selectedId,
  });

  // ── start: consent is re-checked against the server on EVERY start, so a
  // consent withdrawn elsewhere blocks this one. Fails CLOSED.
  const startConversation = useCallback(async () => {
    setDraftError(null);
    const { active, error } = await consentGate.check();
    if (error) return;                       // the banner offers the retry
    if (!active) { setConsentOpen(true); return; }
    setPhase("live");
    // A start that never opened a socket recorded nothing. Staying on the live
    // surface would show "Говоріть — текст з'явиться тут" over a dead session
    // and offer "Завершити розмову" as the only way out — a consultation the
    // clinician thinks is being recorded is the worst failure this screen has.
    // Go back to the intro, where the error sits above the start button.
    const live = await session.start();
    if (!live) setPhase("intro");
  }, [consentGate, session]);

  // ── stop → the server finalizes and persists; we read the transcript back
  // for the review pass (segment UUIDs and speakers only exist there).
  const stopConversation = useCallback(async () => {
    setBusy(true);
    try {
      const id = await session.stop();
      setPhase("review");
      if (!id) return;
      try {
        const detail = await getSession(id);
        setReviewSegments(asList(detail?.transcript));
      } catch {
        // The transcript is persisted server-side either way; the review pass
        // falls back to what we rendered live.
        setReviewSegments(null);
      }
    } finally {
      setBusy(false);
    }
  }, [session]);

  // ── review → draft. The clinician's corrections are folded onto the
  // persisted segments here; this is the only path by which they reach the
  // record (see dialogue.js for why the backend cannot do it).
  const createDraft = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setDraftError(null);
    try {
      const template = templateId ? toStudioTemplate(await getTemplate(templateId)) : null;
      const sectionKey = template?.sections?.[0]?.id;
      if (!sectionKey) throw new Error("no_template_section");

      // The TEXT comes from the persisted transcript (finalize runs it through
      // NLP, so it can differ slightly from what streamed live); the SPEAKERS
      // come from the review, matched by start_ms. If the read-back failed we
      // fall back to what was rendered — a draft with the clinician's words in
      // it beats no draft at all.
      const base = reviewSegments && reviewSegments.length
        ? reviewSegments
        : session.turns.turns.flatMap((t) =>
            t.segments.map((s) => ({
              text: s.text, start_ms: s.start_ms, end_ms: s.end_ms, speaker: t.speaker,
            })));
      const reviewed = mergeReview(base, {
        corrections: corrections(session.turns),
        mapping: session.mapping.mapping,
      });
      const text = dialogueText(reviewed, { lang });
      if (!text.trim()) throw new Error("empty_transcript");

      const report = await createReport({
        template_id: templateId,
        template_schema_version: template?.schema_version,
        body: { [sectionKey]: text },
        title: tr(lang, "Консультація (розмовний режим)", "Consultation (conversation)"),
        patient_id: patientId,
        source_session_id: session.sessionId || undefined,
        section_meta: {
          [sectionKey]: { transcript_segment_ids: segmentIds(reviewed) },
        },
      });
      setPhase("draft");
      navigate(`/dictate/studio?patient=${patientId}&encounter=${encounterId || ""}&report=${report.id}`);
    } catch (e) {
      setDraftError(e);
    } finally {
      setBusy(false);
    }
  }, [busy, templateId, reviewSegments, session, lang, patientId, encounterId, navigate]);

  // ── guards ──────────────────────────────────────────────────────────
  if (patientReq.error) {
    return <div className="page"><ApiErrorView error={patientReq.error} lang={lang} /></div>;
  }
  if (!patientId) {
    return (
      <div className="page">
        <Empty icon="user"
          title={tr(lang, "Потрібен пацієнт", "A patient is required")}
          body={tr(lang, "Розмовний режим записує пацієнта, тому завжди прив'язаний до прийому.", "Conversation mode records the patient, so it is always tied to an encounter.")}
          action={<button className="btn" onClick={() => navigate("/patients")}>{tr(lang, "До пацієнтів", "To patients")}</button>} />
      </div>
    );
  }
  if (!encounterId) {
    return (
      <div className="page">
        <Empty icon="calendar"
          title={tr(lang, "Потрібен прийом", "An encounter is required")}
          body={tr(lang, "Почніть прийом у картці пацієнта, щоб записати розмову.", "Start an encounter from the patient record to record a conversation.")}
          action={<button className="btn" onClick={() => navigate(`/patients/${patientId}`)}>{tr(lang, "До пацієнта", "To the patient")}</button>} />
      </div>
    );
  }

  const patientName = patient?.name?.[lang] || patient?.name?.uk || patient?.name?.en || "";
  // One banner, rendered wherever the failure can be acted on: on the intro it
  // sits above the start button (which IS the retry), on the live surface it
  // carries its own.
  const errorBanner = session.error ? (
    <div className="consent-gate-banner error" data-testid="cv-error" role="alert">
      <Icon name="micOff" size={14} />
      <span>{session.error.message || explainErrorCode(session.error.code, lang)}</span>
      {session.error.code === "consent_required" && (
        <button type="button" className="btn sm" onClick={() => setConsentOpen(true)}>
          {tr(lang, "Отримати згоду", "Capture consent")}
        </button>
      )}
      {session.error.recoverable && phase !== "intro" && (
        <button type="button" className="btn sm" data-testid="cv-retry" onClick={startConversation}>
          {tr(lang, "Спробувати ще раз", "Try again")}
        </button>
      )}
    </div>
  ) : null;
  const yob = yearOfBirth?.(patient);
  const unresolved = unresolvedCount(session.turns);
  // Nothing to fold into a draft — a failed connect, or a visit where the
  // socket lived but no speech was committed. The button used to stay enabled
  // and fail with "транскрипт збережено", which is false when there is no
  // transcript at all.
  const recorded = (reviewSegments?.length ?? 0) > 0 || session.turns.turns.length > 0;
  const reviewUnattributed = reviewSegments
    ? unattributedCount(mergeReview(reviewSegments, {
        corrections: corrections(session.turns), mapping: session.mapping.mapping,
      }))
    : unresolved;

  return (
    <div className="cv-room" data-testid="conversation-room" data-phase={phase}
         data-session-status={session.status}>
      <header className="cv-head">
        <button className="tb-back" onClick={() => navigate(`/patients/${patientId}`)}
          aria-label={tr(lang, "Назад", "Back")}>
          <Icon name="arrowLeft" size={16} />
        </button>
        <div className="cv-head-meta">
          <div className="cv-head-name">
            {patientName}
            {yob ? <span className="cv-head-sub"> · {tr(lang, `нар. ${yob}`, `b. ${yob}`)}</span> : null}
          </div>
          <div className="cv-head-sub">
            {tr(lang, "Розмова", "Conversation")}
            {encounter?.reason ? ` · ${encounter.reason}` : ""}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {session.recording && (
          <span className="cv-rec" data-testid="cv-recording">
            <i className="cv-rec-dot" /> {tr(lang, "Запис", "Recording")}
          </span>
        )}
        <Elapsed startedAt={session.startedAt} lang={lang} />
      </header>

      {/* ── intro ─────────────────────────────────────────────────── */}
      {phase === "intro" && (
        <div className="cv-intro" data-testid="cv-intro">
          <h1>{tr(lang, "Розмовний режим", "Conversation mode")}</h1>
          <p className="cv-intro-lead">
            {tr(lang,
              "Покладіть пристрій між собою та пацієнтом. Записуються ОБИДВА голоси — і ваш, і пацієнта. Текст з'являється одразу; система пропонує, хто говорить, а ви підтверджуєте або виправляєте одним дотиком.",
              "Place the device between yourself and the patient. BOTH voices are recorded — yours and the patient's. Text appears immediately; the system proposes who is speaking and you confirm or correct it with one tap.")}
          </p>
          <ul className="cv-intro-facts">
            <li><Icon name="users" size={13} /> {tr(lang, "Мітки мовців — це пропозиції машини, а не факт", "Speaker labels are machine proposals, not fact")}</li>
            <li><Icon name="mic" size={13} /> {tr(lang, "Голосові команди тут не працюють — слова пацієнта не редагують запис", "Voice commands are off here — the patient's words never edit the record")}</li>
            <li><Icon name="shield" size={13} /> {tr(lang, "Потрібна окрема згода пацієнта на запис розмови", "A separate patient consent to record the consultation is required")}</li>
          </ul>

          {consentGate.status === "required" && (
            <div className="consent-gate-banner" data-testid="consent-gate-banner" role="status">
              <Icon name="shield" size={14} />
              <span>{tr(lang, "Потрібна згода пацієнта на запис розмови", "Patient consent to record the conversation is required")}</span>
              <button type="button" className="btn accent sm" onClick={() => setConsentOpen(true)}>
                {tr(lang, "Отримати згоду", "Capture consent")}
              </button>
            </div>
          )}
          {consentGate.status === "error" && (
            <div className="consent-gate-banner error" data-testid="consent-gate-error" role="alert">
              <Icon name="micOff" size={14} />
              <span>{tr(lang, "Не вдалося перевірити згоду — запис заблоковано", "Couldn't verify consent — recording is blocked")}</span>
              <button type="button" className="btn sm" onClick={consentGate.refresh}>
                {tr(lang, "Повторити", "Retry")}
              </button>
            </div>
          )}
          {errorBanner}
          {visitClosed && (
            <div className="consent-gate-banner error" data-testid="cv-visit-closed" role="alert">
              <Icon name="calendar" size={14} />
              <span>{tr(lang,
                `Цей прийом ${visitStatusLabel(encounter.status, lang)} — записати розмову можна лише під час відкритого прийому.`,
                `This visit is ${visitStatusLabel(encounter.status, lang)} — a conversation can only be recorded during an open visit.`)}</span>
              <button type="button" className="btn sm" onClick={() => navigate(`/patients/${patientId}`)}>
                {tr(lang, "До картки пацієнта", "To the patient record")}
              </button>
            </div>
          )}
          {!isOpusEncodingSupported() && (
            <div className="consent-gate-banner error" data-testid="cv-no-encoder" role="alert">
              <Icon name="micOff" size={14} />
              <span>{tr(lang,
                "Цей браузер не вміє кодувати аудіо для розмовного режиму. Скористайтеся Chrome.",
                "This browser cannot encode audio for conversation mode. Use Chrome.")}</span>
            </div>
          )}

          <div className="cv-intro-controls">
            <label className="cv-field">
              <span>{tr(lang, "Шаблон для чернетки", "Template for the draft")}</span>
              <select value={templateId || ""} onChange={(e) => setTemplateId(e.target.value)}
                data-testid="cv-template">
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            {mic.devices?.length > 1 && (
              <label className="cv-field">
                <span>{tr(lang, "Мікрофон", "Microphone")}</span>
                <select value={mic.selectedId ?? ""} onChange={(e) => mic.select(e.target.value)}>
                  {mic.devices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
                </select>
              </label>
            )}
          </div>

          <button
            className="btn accent lg"
            data-testid="cv-start"
            disabled={consentGate.status === "loading" || !promptId || !templateId
                      || !isOpusEncodingSupported() || visitClosed}
            onClick={startConversation}
          >
            <Icon name="mic" size={15} /> {tr(lang, "Почати розмову", "Start the conversation")}
          </button>
          {!promptId && !promptsReq.loading && (
            <p className="cv-note">{tr(lang, "Немає доступних профілів розпізнавання.", "No recognition profiles are available.")}</p>
          )}
        </div>
      )}

      {/* ── live + review share the transcript surface ─────────────── */}
      {(phase === "live" || phase === "review") && (
        <>
          {/* Only once there is a voice to attribute. "The system has not yet
              decided who is the clinician and who is the patient" over an
              empty transcript describes a decision that was never pending. */}
          {(session.turns.turns.length > 0 || session.turns.partial) && (
            <MappingBanner
              mapping={session.mapping}
              lang={lang}
              onSwap={session.swapMapping}
            />
          )}

          {errorBanner}

          {session.paused && (
            <div className="cv-resuming" role="status" data-testid="cv-paused">
              {tr(lang, "Запис на паузі — мікрофон вимкнено", "Recording paused — the microphone is off")}
            </div>
          )}

          {session.status === "resuming" && (
            <div className="cv-resuming" role="status" data-testid="cv-resuming">
              {tr(lang, "З'єднання відновлюється — записане збережено", "Reconnecting — what was recorded is safe")}
            </div>
          )}

          <TurnList
            state={session.turns}
            mapping={session.mapping}
            lang={lang}
            onSetSpeaker={session.setSpeaker}
            onAssignRole={session.assignRole}
            emptyHint={phase === "live"
              ? tr(lang, "Говоріть — текст з'явиться тут", "Start talking — the text appears here")
              : tr(lang, "Нічого не записано", "Nothing was recorded")}
          />

          <footer className="cv-foot">
            {phase === "live" ? (
              <>
                <div className="cv-level" aria-hidden="true">
                  <i style={{ width: `${Math.round(Math.min(1, session.level * 1.6) * 100)}%` }} />
                </div>
                <div style={{ flex: 1 }} />
                {/* The protocol has always had pause/resume; this is the
                    first control that sends them. Stepping out of the room
                    no longer means ending the consultation. */}
                <button
                  className="btn"
                  data-testid="cv-pause"
                  disabled={busy || session.status !== "live"}
                  onClick={() => (session.paused ? session.resume() : session.pause())}
                >
                  <Icon name={session.paused ? "play" : "pause"} size={14} />
                  {session.paused
                    ? tr(lang, "Продовжити", "Resume")
                    : tr(lang, "Пауза", "Pause")}
                </button>
                <button className="btn accent" data-testid="cv-stop" disabled={busy} onClick={stopConversation}>
                  <Icon name="check" size={14} /> {tr(lang, "Завершити розмову", "End the conversation")}
                </button>
              </>
            ) : (
              <>
                <span className="cv-review-note" data-testid="cv-review-note">
                  {!recorded
                    ? tr(lang, "Розмову не записано — чернетку створювати нема з чого",
                               "Nothing was recorded — there is nothing to make a draft from")
                    : reviewUnattributed > 0
                      ? unresolvedNote(reviewUnattributed, lang)
                      : tr(lang, "Усі репліки мають мовця", "Every turn has a speaker")}
                </span>
                <div style={{ flex: 1 }} />
                {/* The conversation is over; the visit it belongs to is not.
                    Offering the transition here is what stops finished
                    consultations from leaving an open visit behind. */}
                <VisitControls
                  encounter={encounter}
                  lang={lang}
                  showCancel={false}
                  onChanged={() => encounterReq.reload()}
                />
                <button className="btn" onClick={() => navigate(`/patients/${patientId}`)}>
                  {tr(lang, "Пізніше", "Later")}
                </button>
                <button className="btn accent" data-testid="cv-create-draft"
                  disabled={busy || !recorded} onClick={createDraft}>
                  <Icon name="fileText" size={14} />
                  {busy ? tr(lang, "Створення…", "Creating…") : tr(lang, "Створити чернетку", "Create the draft")}
                </button>
              </>
            )}
          </footer>

          {draftError && (
            <div className="consent-gate-banner error" role="alert" data-testid="cv-draft-error">
              <Icon name="micOff" size={14} />
              <span>{tr(lang, "Не вдалося створити чернетку — транскрипт збережено, спробуйте ще раз",
                             "Could not create the draft — the transcript is saved, try again")}</span>
            </div>
          )}
        </>
      )}

      {consentOpen && patient && (
        <ConsentSheet
          lang={lang}
          patient={patient}
          encounterId={encounterId}
          type={CONSENT_TYPE_RECORDING}
          onClose={() => setConsentOpen(false)}
          onGranted={(_c, { autoStart }) => {
            setConsentOpen(false);
            consentGate.refresh();
            // verbal/written: the clinician just asked the patient and got a
            // yes — go straight into the recording they were trying to start.
            if (autoStart && phase === "intro") startConversation();
          }}
        />
      )}
    </div>
  );
}
