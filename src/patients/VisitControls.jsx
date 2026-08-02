// VisitControls.jsx — pause / resume / end / cancel for an open visit.
//
// The gap this closes: the SPA could only ever *open* a visit
// (`createEncounter({ status: "in_progress" })`). Nothing anywhere moved an
// encounter out of `in_progress`, so every visit a clinician ever started
// stayed in the pipeline forever. Backend migration 0058 added the
// transitions; this is the only place the UI drives them, so the four
// surfaces that show a visit (patient record, today's queue, studio,
// conversation room) behave identically.
//
// Two backend refusals are worth handling by hand rather than as a generic
// error toast:
//   * 409 while a recording on the visit is still live — the clinician gets
//     a second prompt and can force it, because the alternative (a visit
//     nobody can close) is exactly the bug we are fixing.
//   * 409 on an illegal transition — somebody else already moved the visit;
//     re-read rather than insist.

import React, { useState } from "react";
import { Icon, Modal } from "../components/UI.jsx";
import {
  pauseEncounter,
  resumeEncounter,
  completeEncounter,
  cancelEncounter,
  isEncounterOpen,
} from "../api/encounters.js";
import { tr } from "../i18n.js";

const ACTIONS = {
  pause:    pauseEncounter,
  resume:   resumeEncounter,
  complete: completeEncounter,
  cancel:   cancelEncounter,
};

// A live recording is the one refusal we offer to override.
function isLiveRecordingConflict(err) {
  return err?.status === 409 && /still live/i.test(err?.problem?.detail || err?.message || "");
}

export function visitStatusLabel(status, lang) {
  return (
    {
      scheduled:   tr(lang, "заплановано", "scheduled"),
      in_progress: tr(lang, "триває", "in progress"),
      paused:      tr(lang, "призупинено", "paused"),
      completed:   tr(lang, "завершено", "completed"),
      cancelled:   tr(lang, "скасовано", "cancelled"),
    }[status] || status
  );
}

export function visitStatusChipClass(status) {
  if (status === "in_progress") return "live";
  if (status === "paused") return "draft";
  if (status === "completed") return "signed";
  return "";
}

/**
 * @param encounter  the encounter row (needs at least { id, status })
 * @param onChanged  called with the updated encounter after any transition
 * @param compact    icon-only buttons, for dense list rows
 * @param showCancel offer "cancel the visit" alongside "end the visit"
 */
export function VisitControls({ encounter, lang, onChanged, compact = false, showCancel = true }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  // { action, force } — a confirmation the clinician has to answer.
  const [confirm, setConfirm] = useState(null);

  if (!encounter || !isEncounterOpen(encounter.status)) return null;

  const paused = encounter.status === "paused";

  const run = async (action, { force = false } = {}) => {
    setBusy(action);
    setError(null);
    try {
      const updated = await ACTIONS[action](encounter.id, { force });
      setConfirm(null);
      onChanged?.(updated);
    } catch (e) {
      if (!force && isLiveRecordingConflict(e)) {
        // Re-prompt rather than fail: the visit must always be closeable.
        setConfirm({ action, force: true, detail: e.problem?.detail || e.message });
        return;
      }
      setError(e);
      setConfirm(null);
    } finally {
      setBusy(null);
    }
  };

  const ask = (action) => setConfirm({ action, force: false });

  const label = (uk, en) => (compact ? null : tr(lang, uk, en));

  const confirmCopy = () => {
    if (!confirm) return {};
    if (confirm.force) {
      return {
        title: tr(lang, "Запис ще триває", "A recording is still running"),
        body: tr(
          lang,
          "На цьому прийомі ще йде запис. Якщо завершити прийом зараз, запис буде перервано без збереження чернетки. Спочатку зупиніть запис — або завершіть попри це.",
          "A recording on this visit is still running. Ending the visit now interrupts it without producing a draft. Stop the recording first — or end the visit anyway.",
        ),
        ok: tr(lang, "Завершити попри це", "End anyway"),
        danger: true,
      };
    }
    if (confirm.action === "cancel") {
      return {
        title: tr(lang, "Скасувати прийом?", "Cancel the visit?"),
        body: tr(
          lang,
          "Прийом буде позначено як скасований. Це остаточно — відновити його не можна, лише створити новий.",
          "The visit will be marked cancelled. This is final — it cannot be reopened, only recorded anew.",
        ),
        ok: tr(lang, "Скасувати прийом", "Cancel the visit"),
        danger: true,
      };
    }
    return {
      title: tr(lang, "Завершити прийом?", "End the visit?"),
      body: tr(
        lang,
        "Прийом буде закрито й прибрано зі списку активних. Це остаточно — відновити його не можна.",
        "The visit closes and leaves your active list. This is final — it cannot be reopened.",
      ),
      ok: tr(lang, "Завершити", "End the visit"),
      danger: false,
    };
  };

  const copy = confirmCopy();

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {paused ? (
          <button
            type="button"
            className="btn sm"
            disabled={busy != null}
            onClick={() => run("resume")}
            title={tr(lang, "Продовжити прийом", "Resume the visit")}
          >
            <Icon name="play" size={13} /> {label("Продовжити", "Resume")}
          </button>
        ) : (
          <button
            type="button"
            className="btn sm"
            disabled={busy != null}
            onClick={() => run("pause")}
            title={tr(lang, "Призупинити прийом", "Pause the visit")}
          >
            <Icon name="pause" size={13} /> {label("Пауза", "Pause")}
          </button>
        )}

        <button
          type="button"
          className="btn sm accent"
          disabled={busy != null}
          onClick={() => ask("complete")}
          title={tr(lang, "Завершити прийом", "End the visit")}
        >
          <Icon name="check" size={13} /> {label("Завершити", "End visit")}
        </button>

        {showCancel && (
          <button
            type="button"
            className="btn sm"
            disabled={busy != null}
            onClick={() => ask("cancel")}
            title={tr(lang, "Скасувати прийом", "Cancel the visit")}
          >
            <Icon name="x" size={13} /> {label("Скасувати", "Cancel")}
          </button>
        )}
      </div>

      {error && (
        <div className="chip" style={{ marginTop: 6, color: "var(--danger, #c33)" }}>
          {error.problem?.detail || error.message}
        </div>
      )}

      {confirm && (
        <Modal onClose={() => setConfirm(null)}>
          <div className="modal-h">
            <h2>{copy.title}</h2>
          </div>
          <div className="modal-body">
            <p style={{ margin: 0, color: "var(--text-2)", fontSize: 13.5, lineHeight: 1.5 }}>
              {copy.body}
            </p>
            {confirm.detail && (
              <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 12.5, lineHeight: 1.5 }}>
                {confirm.detail}
              </p>
            )}
          </div>
          <div className="modal-foot">
            <button type="button" className="btn" onClick={() => setConfirm(null)}>
              {tr(lang, "Назад", "Back")}
            </button>
            <button
              type="button"
              className={`btn ${copy.danger ? "danger" : "accent"}`}
              disabled={busy != null}
              onClick={() => run(confirm.action, { force: confirm.force })}
            >
              {busy != null ? tr(lang, "Зачекайте…", "Working…") : copy.ok}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
