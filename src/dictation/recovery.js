// recovery.js — "your recording survived", and what to do about it.
//
// THE PROBLEM THIS SOLVES. Sprint 04 gave every live consultation an
// IndexedDB ring of encoded audio so a network drop could be replayed into a
// resumed session. Sprint 16 makes a new kind of interruption routine: session
// revocation (ADR-0040) means an administrator deactivating an account, or a
// refresh replay, kills a clinician's token *while they are recording*. The
// socket closes, the app drops to the login screen, and thirty minutes of a
// consultation sits in IndexedDB that nothing in the UI has ever read back.
//
// Frames alone are not enough to offer anything, because a ring of Opus
// packets does not know whose consultation it was, when it started, or how
// much of it there is. So each recording also writes a MANIFEST — a small
// row alongside the frames, in the same database so the two cannot get out of
// step — and this module is the manifest's lifecycle:
//
//     begin  →  (interrupted | complete)  →  recovered | discarded
//
// WHAT IS AND IS NOT STORED. The manifest holds ids and counters: session id,
// patient id, encounter id, language, timestamps, frame count. It holds NO
// transcript, NO patient name and NO audio — the audio is in the frame store
// where it already was, and a patient's name on a shared workstation's disk is
// a data-protection problem this feature has no reason to create. The
// recovery UI resolves the name from the API at display time, as every other
// screen does.
//
// WHY NOTHING EXPIRES ITSELF ON A TIMER. A manifest is cleared when the
// recording completes normally, when the clinician discards it, or when its
// frames are gone. It is deliberately not swept by age: "your audio was
// deleted while you were away" is the one outcome this whole feature exists to
// prevent.

import { countSessionFrames, dropSessionFrames, openDictationDb } from "./frameQueue.js";

const STORE = "recordings";

export const RECORDING_STATUS = {
  // A recording that is live right now, in this tab.
  ACTIVE: "active",
  // The session ended without the clinician ending it — revoked, expired, or
  // a socket that never came back. This is the state worth offering back.
  INTERRUPTED: "interrupted",
};

async function db() {
  if (typeof indexedDB === "undefined") return null;
  try { return await openDictationDb(); } catch { return null; }
}

function tx(database, mode) {
  return database.transaction(STORE, mode).objectStore(STORE);
}

const done = (request) =>
  new Promise((res, rej) => {
    request.onsuccess = () => res(request.result);
    request.onerror = () => rej(request.error);
  });

/**
 * Record that a session has started recording. Called once the backend has
 * answered start_session, because before that there is no id to file it under.
 */
export async function beginRecording({
  sessionId, patientId = null, encounterId = null, mode = "scribe", language = null, startedAt = Date.now(),
}) {
  if (!sessionId) return null;
  const d = await db();
  if (!d) return null;
  const row = {
    sessionId,
    patientId,
    encounterId,
    mode,
    language,
    startedAt,
    updatedAt: startedAt,
    frames: 0,
    status: RECORDING_STATUS.ACTIVE,
    reason: null,
  };
  try { await done(tx(d, "readwrite").put(row)); } catch {}
  return row;
}

/**
 * Keep the manifest's counters roughly current while recording.
 *
 * Called from the encoder's packet callback, so it is on the hot path: the
 * caller throttles (see `shouldCheckpoint`) and this function never blocks the
 * frame it was called about. A checkpoint lost to a crash costs at most a few
 * seconds of reported duration — never audio, which is written per frame.
 */
export async function checkpointRecording(sessionId, { frames, lastSeq }) {
  if (!sessionId) return;
  const d = await db();
  if (!d) return;
  try {
    const store = tx(d, "readwrite");
    const row = await done(store.get(sessionId));
    if (!row) return;
    row.frames = frames ?? row.frames;
    row.lastSeq = lastSeq ?? row.lastSeq;
    row.updatedAt = Date.now();
    await done(tx(d, "readwrite").put(row));
  } catch {}
}

/** 20 ms frames: checkpoint about every five seconds. */
export function shouldCheckpoint(frameCount) {
  return frameCount > 0 && frameCount % 250 === 0;
}

/**
 * The recording stopped for a reason the clinician did not choose. Marks the
 * manifest so the next sign-in can offer it back. The frames are left exactly
 * where they are — this function must never delete audio.
 */
export async function markInterrupted(sessionId, reason = "session_ended") {
  if (!sessionId) return;
  const d = await db();
  if (!d) return;
  try {
    const store = tx(d, "readwrite");
    const row = await done(store.get(sessionId));
    if (!row) return;
    row.status = RECORDING_STATUS.INTERRUPTED;
    row.reason = reason;
    row.interruptedAt = Date.now();
    row.updatedAt = row.interruptedAt;
    await done(tx(d, "readwrite").put(row));
  } catch {}
}

/**
 * The recording ended properly: the clinician pressed stop, end_session went
 * out, and the server holds the transcript. Nothing local is worth keeping, so
 * the manifest and the frames both go.
 */
export async function completeRecording(sessionId) {
  if (!sessionId) return;
  const d = await db();
  if (!d) return;
  try { await done(tx(d, "readwrite").delete(sessionId)); } catch {}
  await dropSessionFrames(d, sessionId);
}

/** The clinician looked at the offer and said no. Same cleanup, by choice. */
export const discardRecording = completeRecording;

/**
 * Everything worth offering back, newest first.
 *
 * A manifest is only offered when its audio is genuinely still there — the
 * ring is capacity-bounded and evicts acknowledged frames, so an interrupted
 * session whose frames were all acknowledged has nothing left to recover and
 * would otherwise produce an offer that does nothing when accepted. Those are
 * cleaned up here rather than shown.
 */
export async function listRecoverable() {
  const d = await db();
  if (!d) return [];
  let rows = [];
  try { rows = (await done(tx(d, "readonly").getAll())) || []; } catch { return []; }

  const out = [];
  for (const row of rows) {
    if (row.status !== RECORDING_STATUS.INTERRUPTED) continue;
    const frames = await countSessionFrames(d, row.sessionId);
    if (frames <= 0) {
      // Nothing to restore. Silently retire it: an offer that cannot deliver
      // is worse than no offer.
      try { await done(tx(d, "readwrite").delete(row.sessionId)); } catch {}
      continue;
    }
    out.push({ ...row, frames });
  }
  return out.sort((a, b) => (b.interruptedAt || b.updatedAt || 0) - (a.interruptedAt || a.updatedAt || 0));
}

/**
 * A recording is only marked INTERRUPTED by code that saw the interruption. A
 * crash, a closed laptop or a killed browser destroys the tab before any of
 * that runs, leaving the manifest stuck in ACTIVE — the most abrupt losses
 * producing the one state nothing ever offers back. This promotes them.
 *
 * THE STALENESS WINDOW is what keeps it from relabelling a recording that is
 * live right now, possibly in another tab of the same browser (the two share
 * this database). A live session checkpoints every few seconds, so anything
 * touched inside the window is presumed alive and left alone. The cost of
 * being wrong is one skipped offer, corrected on the next visit; the cost of
 * the opposite would be telling a clinician their running consultation had
 * been interrupted.
 */
export const ACTIVE_STALE_MS = 60_000;

export async function adoptOrphanedRecordings({ now = Date.now(), staleMs = ACTIVE_STALE_MS } = {}) {
  const d = await db();
  if (!d) return 0;
  let rows = [];
  try { rows = (await done(tx(d, "readonly").getAll())) || []; } catch { return 0; }
  let n = 0;
  for (const row of rows) {
    if (!isStaleActive(row, now, staleMs)) continue;
    row.status = RECORDING_STATUS.INTERRUPTED;
    row.reason = row.reason || "tab_closed";
    row.interruptedAt = row.updatedAt || now;
    try { await done(tx(d, "readwrite").put(row)); n++; } catch {}
  }
  return n;
}

/** Pure predicate behind `adoptOrphanedRecordings` — see the note above. */
export function isStaleActive(row, now = Date.now(), staleMs = ACTIVE_STALE_MS) {
  if (!row || row.status !== RECORDING_STATUS.ACTIVE) return false;
  const touched = row.updatedAt || row.startedAt || 0;
  return now - touched > staleMs;
}

// ── pure helpers (unit-tested; no IndexedDB) ───────────────────────────

/** Frame count → milliseconds. The wire framing is 20 ms, fixed (spec §A). */
export const FRAME_MS = 20;

export function recordingDurationMs(frames) {
  return Math.max(0, Number(frames) || 0) * FRAME_MS;
}

/** "3 хв 20 с" / "3 min 20 s" — a duration a clinician can weigh. */
export function formatDuration(ms, lang = "en") {
  const total = Math.round(Math.max(0, ms) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  const uk = lang === "uk";
  if (m <= 0) return uk ? `${s} с` : `${s} s`;
  return uk ? `${m} хв ${s} с` : `${m} min ${s} s`;
}

/**
 * Why the recording stopped, for the offer's subtitle. Unknown reasons get a
 * neutral phrasing rather than a guess — a wrong explanation of a lost
 * consultation is worse than none.
 */
export function interruptionCopy(reason, lang = "en") {
  const uk = lang === "uk";
  switch (reason) {
    case "revoked":
      return uk
        ? "Сеанс було завершено під час запису"
        : "Your session was ended while recording";
    case "expired":
      return uk
        ? "Термін сеансу минув під час запису"
        : "Your session expired while recording";
    case "replay":
      return uk
        ? "Сеанс перервано з міркувань безпеки під час запису"
        : "Your session was ended for security while recording";
    case "tab_closed":
      return uk
        ? "Вкладку закрито під час запису"
        : "The tab closed while recording";
    default:
      return uk ? "Запис перервано" : "The recording was interrupted";
  }
}
