// AsrSubmitPage.jsx — /asr/new. File picker + prompt + language → POST /asr/jobs.
import React, { useState } from "react";
import { Icon } from "../components/UI.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { PromptPicker } from "../components/PromptPicker.jsx";
import { AudioDrop } from "../components/AudioDrop.jsx";
import { submitJob } from "../api/asr.js";

export function AsrSubmitPage({ lang = "en", navigate, onToast }) {
  const [file, setFile] = useState(null);
  const [language, setLanguage] = useState("uk");
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
      if (onToast) onToast(lang === "uk" ? "Завдання поставлено в чергу" : "Job queued");
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
          <h1>{lang === "uk" ? "Нова транскрипція" : "New transcription"}</h1>
          <p className="muted">
            {lang === "uk"
              ? "Завантажте аудіо, виберіть напрям та мову. Завдання обробляється у фоні."
              : "Upload audio, pick the specialty and language. Processing happens in the background."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => navigate("/asr/jobs")}>
            <Icon name="inbox" size={13} />
            <span>{lang === "uk" ? "Усі завдання" : "All jobs"}</span>
          </button>
        </div>
      </div>

      {error && <ApiErrorView error={error} lang={lang} />}

      <form className="card asr-form" onSubmit={onSubmit}>
        <section className="asr-form-section">
          <label className="asr-label">
            <span>{lang === "uk" ? "Аудіо" : "Audio"}</span>
            <AudioDrop file={file} onFile={setFile} disabled={submitting} lang={lang} />
          </label>
        </section>

        <section className="asr-form-section asr-form-grid">
          <label className="asr-label">
            <span>{lang === "uk" ? "Мова" : "Language"}</span>
            <div className="seg">
              {[{ v: "uk", l: "UK" }, { v: "en", l: "EN" }].map((o) => (
                <button
                  type="button"
                  key={o.v}
                  className={"seg-btn " + (language === o.v ? "on" : "")}
                  onClick={() => setLanguage(o.v)}
                  disabled={submitting}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </label>

          <label className="asr-label">
            <span>{lang === "uk" ? "Промпт" : "Prompt"}</span>
            <PromptPicker
              value={promptId}
              onChange={setPromptId}
              language={language}
              lang={lang}
              disabled={submitting}
            />
          </label>

          <label className="asr-label">
            <span>{lang === "uk" ? "ID візиту (опціонально)" : "Encounter ID (optional)"}</span>
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
                ? (lang === "uk" ? "Надсилання…" : "Submitting…")
                : (lang === "uk" ? "Поставити в чергу" : "Queue job")}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
