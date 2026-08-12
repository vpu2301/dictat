// RecoveryBanner.jsx — "your recording is still here" (sprint 16).
//
// The other half of the revocation story. When a session dies mid-consultation
// the audio stays in the IndexedDB ring (sprint-04 guarantee) and a manifest
// records what it was — but preserved audio nobody is told about is the same
// as lost audio. This banner is the telling.
//
// It lives at the top of the Studio because that is where a clinician goes to
// record, so it is the one place the offer is guaranteed to be seen by the
// person it belongs to, at the moment it is useful. It renders nothing at all
// when there is nothing to recover, which is almost always.
//
// TWO ACTIONS, AND THE ASYMMETRY IS DELIBERATE. "Restore" reopens the session
// and replays the frames. "Discard" deletes consultation audio, so it asks
// first — this is the only button in the app that can destroy a recording, and
// an accidental click on a banner nobody expected to see is exactly how that
// would happen.

import React, { useCallback, useEffect, useState } from "react";

import { Icon } from "../components/UI.jsx";
import {
  adoptOrphanedRecordings,
  discardRecording,
  formatDuration,
  interruptionCopy,
  listRecoverable,
  recordingDurationMs,
} from "./recovery.js";
import { tr } from "../i18n.js";

function whenLabel(ts, lang) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString(lang === "uk" ? "uk-UA" : "en-GB", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function RecoveryBanner({ lang = "uk", onRestore }) {
  const [items, setItems] = useState([]);
  const [confirming, setConfirming] = useState(null); // sessionId awaiting a second click
  const [busy, setBusy] = useState(null);

  const reload = useCallback(async () => {
    // A recording still marked ACTIVE belongs to a tab that no longer exists
    // (a crash, a closed laptop). Promote those first, or the most abrupt
    // interruptions would be the ones never offered back.
    await adoptOrphanedRecordings();
    setItems(await listRecoverable());
  }, []);

  useEffect(() => { reload().catch(() => setItems([])); }, [reload]);

  if (!items.length) return null;

  const discard = async (sessionId) => {
    if (confirming !== sessionId) { setConfirming(sessionId); return; }
    setBusy(sessionId);
    try {
      await discardRecording(sessionId);
      setItems((cur) => cur.filter((i) => i.sessionId !== sessionId));
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  };

  return (
    <div className="dict-recovery" role="status" data-testid="dictation-recovery">
      <Icon name="audio" size={16} />
      <div className="dict-recovery-body">
        <strong>
          {items.length === 1
            ? tr(lang, "Незавершений запис збережено на цьому комп'ютері",
                       "An unfinished recording is saved on this computer")
            : tr(lang, "Незавершені записи збережено на цьому комп'ютері",
                       "Unfinished recordings are saved on this computer")}
        </strong>
        <p>
          {tr(lang,
            "Аудіо не залишало цей пристрій. Відновіть запис, щоб продовжити консультацію з того місця, де вона обірвалася.",
            "The audio never left this device. Restore a recording to carry on from where the consultation stopped.")}
        </p>

        <ul className="dict-recovery-list">
          {items.map((item) => (
            <li key={item.sessionId} className="dict-recovery-item">
              <div className="dict-recovery-meta">
                <b>{formatDuration(recordingDurationMs(item.frames), lang)}</b>
                <span>
                  {interruptionCopy(item.reason, lang)}
                  {item.interruptedAt ? ` · ${whenLabel(item.interruptedAt, lang)}` : ""}
                </span>
              </div>
              <div className="dict-recovery-actions">
                <button
                  type="button"
                  className="btn accent sm"
                  disabled={busy === item.sessionId}
                  data-testid="recovery-restore"
                  onClick={() => onRestore?.(item)}
                >
                  {tr(lang, "Відновити", "Restore")}
                </button>
                <button
                  type="button"
                  className={"btn sm" + (confirming === item.sessionId ? " danger" : " ghost")}
                  disabled={busy === item.sessionId}
                  data-testid="recovery-discard"
                  onClick={() => discard(item.sessionId)}
                  onBlur={() => setConfirming((c) => (c === item.sessionId ? null : c))}
                >
                  {confirming === item.sessionId
                    ? tr(lang, "Точно видалити?", "Delete for good?")
                    : tr(lang, "Видалити", "Discard")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
