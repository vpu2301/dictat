// AsrSubmitPage.jsx — /asr/new. File picker + prompt + language → POST /asr/jobs.
import React, { useState } from "react";
import { Icon } from "../components/UI.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { PromptPicker } from "../components/PromptPicker.jsx";
import { MenuSelect } from "../components/MenuSelect.jsx";
import { AudioDrop } from "../components/AudioDrop.jsx";
import { submitJob } from "../api/asr.js";
import { tr } from "../i18n.js";

export function AsrSubmitPage({ lang = "en", navigate, onToast }) {
  const [file, setFile] = useState(null);
  // "auto" lets the recognizer detect the language (Whisper auto-detect).
  const [language, setLanguage] = useState("auto");
  const [promptId, setPromptId] = useState("");
  const [encounterId, setEncounterId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit = !!file && !!promptId && !submitting;

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
        encounter_id: encounterId.trim() || undefined,
      });
      if (onToast) onToast(tr(lang, "Завдання поставлено в чергу", "Job queued"));
      // Optimistic route to detail; detail polls regardless of initial state.
      navigate(`/asr/jobs/${encodeURIComponent(job.id)}`);
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
          <button className="btn" onClick={() => navigate("/asr/jobs")}>
            <Icon name="inbox" size={13} />
            <span>{tr(lang, "Усі завдання", "All jobs")}</span>
          </button>
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
              options={[
                { value: "auto", label: tr(lang, "Авто (визначити)", "Auto (detect)") },
                { value: "uk", label: tr(lang, "Українська", "Ukrainian") },
                { value: "en", label: tr(lang, "Англійська", "English") },
              ]}
            />
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

          <label className="asr-label">
            <span>{tr(lang, "ID візиту (опціонально)", "Encounter ID (optional)")}</span>
            <input
              type="text"
              value={encounterId}
              onChange={(e) => setEncounterId(e.target.value)}
              placeholder="enc_…"
              disabled={submitting}
            />
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
