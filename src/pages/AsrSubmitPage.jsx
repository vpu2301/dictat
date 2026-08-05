// AsrSubmitPage.jsx — /asr/new. File picker + prompt + language → POST /asr/jobs.
import React, { useState } from "react";
import { Icon } from "../components/UI.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { PromptPicker } from "../components/PromptPicker.jsx";
import { MenuSelect } from "../components/MenuSelect.jsx";
import { AudioDrop } from "../components/AudioDrop.jsx";
import { submitJob } from "../api/asr.js";
import { UPLOAD_CODES, asUploadLang, langLabel, supportsUpload } from "../dictation/languages.js";
import { tr } from "../i18n.js";

// asr-service pins `language` to ^(uk|en)$ (routers/jobs.py, and the same
// pattern on /asr/prompts). There is NO auto-detect: sending "auto" is a 422,
// so it is not offered — and neither is German, which the LIVE recogniser
// (dictation-service + nlp-service) accepts but this batch service does not.
// See dictation/languages.js: UPLOAD_CODES is the single place that says so.
const defaultLanguage = (uiLang) => asUploadLang(uiLang);

// `encounter_id` is a UUID on the wire; anything else is a 422 the user can
// only read as "the page is broken". Caught here instead.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// `embedded` = the Studio workspace hosts the form; it keeps the queued job in
// its own state (and its own URL) instead of routing to the detail page, and
// supplies the encounter from the session context rather than a pasted UUID.
export function AsrSubmitPage({ lang = "en", navigate, onToast, embedded = false, onQueued, encounterId: encounterFixed }) {
  const [file, setFile] = useState(null);
  const [language, setLanguage] = useState(() => defaultLanguage(lang));
  const [promptId, setPromptId] = useState("");
  const [encounterId, setEncounterId] = useState(encounterFixed || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const trimmedEncounter = encounterId.trim();
  const encounterInvalid = trimmedEncounter !== "" && !UUID_RE.test(trimmedEncounter);
  const canSubmit = !!file && !!promptId && !encounterInvalid && !submitting;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const job = await submitJob({
        file,
        prompt_id: promptId,
        language,
        encounter_id: trimmedEncounter || undefined,
      });
      if (onToast) onToast(tr(lang, "Завдання поставлено в чергу", "Job queued"));
      // Optimistic route to detail; detail polls regardless of initial state.
      if (onQueued) onQueued(job);
      else navigate(`/asr/jobs/${encodeURIComponent(job.id)}`);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page asr-submit">
      <div className="page-h">
        <div>
          <h1>{tr(lang, "Нова транскрипція", "New transcription")}</h1>
          <p className="muted">
            {tr(lang, "Завантажте аудіо, виберіть напрям та мову. Завдання обробляється у фоні.", "Upload audio, pick the specialty and language. Processing happens in the background.")}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!embedded && (
            <button className="btn" onClick={() => navigate("/documents/transcripts")}>
              <Icon name="inbox" size={13} />
              <span>{tr(lang, "Усі завдання", "All jobs")}</span>
            </button>
          )}
        </div>
      </div>

      {error && <ApiErrorView error={error} lang={lang} />}

      <form className="card asr-form" onSubmit={onSubmit}>
        <section className="asr-form-section">
          <label className="asr-label">
            <span>{tr(lang, "Аудіо", "Audio")}</span>
            <AudioDrop file={file} onFile={setFile} disabled={submitting} lang={lang} />
          </label>
        </section>

        <section className="asr-form-section asr-form-grid">
          <label className="asr-label">
            <span>{tr(lang, "Мова", "Language")}</span>
            <MenuSelect
              block
              icon="flag"
              value={language}
              onChange={setLanguage}
              disabled={submitting}
              ariaLabel={tr(lang, "Мова аудіо", "Audio language")}
              options={UPLOAD_CODES.map((c) => ({ value: c, label: langLabel(c, lang) }))}
            />
            {!supportsUpload(lang) && lang === "de" && (
              <span className="asr-field-note">
                {tr(lang,
                  "Німецькою можна диктувати наживо; для завантаження файлів сервіс розпізнавання поки приймає лише UK та EN.",
                  "German is available for live dictation; for uploaded files the transcription service still accepts UK and EN only.")}
              </span>
            )}
          </label>

          <label className="asr-label">
            <span>{tr(lang, "Промпт", "Prompt")}</span>
            <PromptPicker
              value={promptId}
              onChange={setPromptId}
              language={language}
              lang={lang}
              disabled={submitting}
            />
          </label>

          {/* Embedded, the visit comes from the session the workspace is on —
              asking the clinician to paste its UUID would be asking them to
              retype something the screen already knows. */}
          <label className="asr-label" hidden={!!(embedded && encounterFixed)}>
            <span>{tr(lang, "ID візиту (опціонально)", "Encounter ID (optional)")}</span>
            <input
              type="text"
              value={encounterId}
              onChange={(e) => setEncounterId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              aria-invalid={encounterInvalid || undefined}
              disabled={submitting}
            />
            {encounterInvalid && (
              <span className="asr-field-err" role="alert">
                {tr(lang, "ID візиту має бути UUID.", "The encounter ID must be a UUID.")}
              </span>
            )}
          </label>
        </section>

        <div className="asr-form-actions">
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            <Icon name="bot" size={13} />
            <span>
              {submitting
                ? (tr(lang, "Надсилання…", "Submitting…"))
                : (tr(lang, "Поставити в чергу", "Queue job"))}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
