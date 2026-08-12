// breakGlass.js — remembering, for the rest of the session, that what is on
// screen was opened by breaking glass.
//
// Defect 2 of the 2026-08-09 clinical-governance hotfix. The S14/S15 flow
// already made privileged access deliberate: a 403 `phi_access_required`
// stops the render, a modal asks for a reason from a closed vocabulary and a
// written justification, and re-authentication mints a time-limited grant.
// What it did NOT do is keep saying so. Once the grant existed, the record
// rendered exactly like a record the viewer was entitled to — same chrome,
// same everything — and the single most important fact about that screen (you
// are inside someone's chart on an exception, and it is being counted) was
// visible only in the seconds it took to dismiss a dialog.
//
// So the grant is remembered here, per resource, for the session:
//
//   · sessionStorage, not localStorage — a break-glass is an episode, not a
//     preference, and it must not outlive the browser session any more than
//     the grant itself outlives its TTL;
//   · keyed by kind+id, because a grant on one patient says nothing about the
//     next one and the banner must not follow the viewer around;
//   · OWNED by the account that broke the glass (2026-08-09, below);
//   · advisory ONLY. This is a note about something the SERVER decided. It
//     grants nothing, and a tampered entry buys a banner, never data — every
//     read is still gated by the grant the server minted.
//
// ── why the store has an owner ─────────────────────────────────────────
// sessionStorage is scoped to the TAB, not to the session: signing out and
// signing back in as someone else keeps every key. Keyed by kind+id alone, an
// administrator's episode on patient X therefore became the NEXT person's
// banner on patient X — and the next person is usually a clinician, who was
// then told that their own entitled read was an exception being counted. That
// is a false statement about an audit control, which is worse than no banner:
// it teaches people that the banner means nothing.
//
// So the store names its owner, and a read that cannot name the same subject
// gets nothing. A different account does not inherit an episode; it starts a
// clean sheet. `subject` is the token's `sub` — the same identity the server
// minted the grant for.
//
// Pure: no React, no fetch. The banner component reads it; the modal writes
// it on success.

// v2 — the shape changed from a flat map to { owner, episodes }. A stale v1
// blob is simply never read again (and dies with the tab regardless), which
// is exactly the right fate for an episode that belonged to nobody nameable.
export const BG_KEY = "mdx.breakglass.v2";
const LEGACY_KEYS = ["mdx.breakglass.v1"];

// A grant outlives neither its server-side TTL nor the session. The TTL is
// what the server told us at mint time; this is the client's copy of that
// deadline, used only to stop showing a banner for an episode that is over.
export const DEFAULT_TTL_MINUTES = 60;

export function bgKey(kind, id) {
  return `${kind}:${id}`;
}

const EMPTY = { owner: null, episodes: {} };

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function read(storage) {
  try {
    const raw = storage.getItem(BG_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!isPlainObject(parsed)) return EMPTY;
    return {
      owner: typeof parsed.owner === "string" && parsed.owner ? parsed.owner : null,
      episodes: isPlainObject(parsed.episodes) ? parsed.episodes : {},
    };
  } catch {
    return EMPTY;
  }
}

/**
 * The episodes this subject may be shown — nothing at all if the store belongs
 * to someone else. Every read goes through here, so "an episode is another
 * account's" and "there is no episode" are the same answer everywhere.
 */
function readOwned(storage, subject) {
  if (!storage || !subject) return {};
  const store = read(storage);
  return store.owner === subject ? store.episodes : {};
}

function write(storage, store) {
  try {
    storage.setItem(BG_KEY, JSON.stringify(store));
    for (const k of LEGACY_KEYS) storage.removeItem?.(k);
  } catch {
    /* a full or blocked storage costs the banner, never the gate */
  }
}

/**
 * Record that `subject` opened `kind`/`id` by breaking glass.
 *
 * `subject` is required: an episode nobody can be named for is not an episode,
 * it is a banner waiting to be shown to the wrong person.
 *
 * `reasonLabel` is stored alongside the code because the banner has to NAME
 * the reason and the code alone ("care_continuity") is not a sentence anyone
 * reads. The label is resolved once, at the moment of the act, in the
 * language it was chosen in.
 */
export function rememberBreakGlass(storage, { subject, kind, id, reasonCode, reasonLabel, note = "", ttlMinutes, now = Date.now() }) {
  if (!storage || !subject || !kind || !id || !reasonCode) return null;
  const ttl = Number.isFinite(ttlMinutes) && ttlMinutes > 0 ? ttlMinutes : DEFAULT_TTL_MINUTES;
  const entry = {
    kind, id, reasonCode,
    reasonLabel: reasonLabel || reasonCode,
    // The justification is kept so the banner can carry it in its tooltip:
    // the person who wrote "covering for Dr. K while she is on leave" should
    // be able to see, an hour later, what they said they were doing.
    note: String(note || "").slice(0, 500),
    at: now,
    expiresAt: now + ttl * 60_000,
  };
  const store = read(storage);
  // A new account does not inherit the last one's episodes — it replaces them.
  const episodes = store.owner === subject ? { ...store.episodes } : {};
  episodes[bgKey(kind, id)] = entry;
  write(storage, { owner: subject, episodes });
  return entry;
}

/**
 * The live break-glass episode this subject has on this resource, or null.
 *
 * `subject` is not optional in practice: without it there is no episode to
 * report, because an episode is something a NAMED person did.
 */
export function activeBreakGlass(storage, kind, id, { now = Date.now(), subject } = {}) {
  if (!kind || !id) return null;
  const entry = readOwned(storage, subject)[bgKey(kind, id)];
  if (!entry) return null;
  // An expired episode stops claiming to be one. The server has already
  // stopped honouring the grant; a banner still saying "you are inside on an
  // exception" would be describing a door that closed.
  if (!Number.isFinite(entry.expiresAt) || entry.expiresAt <= now) return null;
  return entry;
}

/** Every live episode — what the "you are currently inside N records" view needs. */
export function activeBreakGlassList(storage, { now = Date.now(), subject } = {}) {
  return Object.values(readOwned(storage, subject))
    .filter((e) => e && Number.isFinite(e.expiresAt) && e.expiresAt > now)
    .sort((a, b) => b.at - a.at);
}

/** Drop one episode — used when the server says the grant is gone (revoked). */
export function forgetBreakGlass(storage, kind, id) {
  if (!storage) return;
  const store = read(storage);
  if (!store.owner) return;
  const episodes = { ...store.episodes };
  delete episodes[bgKey(kind, id)];
  write(storage, { owner: store.owner, episodes });
}

/**
 * Drop the whole store — called when the session ends, whichever way it ended.
 *
 * Owner-scoping already means the next account sees nothing, so this is the
 * second lock, not the first: an episode names a patient and a reason, and
 * leaving that on a shared clinic workstation's tab after sign-out is not
 * something to rely on a comparison for.
 */
export function clearBreakGlass(storage) {
  if (!storage) return;
  try {
    storage.removeItem(BG_KEY);
    for (const k of LEGACY_KEYS) storage.removeItem(k);
  } catch {
    /* nothing to do — the data dies with the tab either way */
  }
}

/** How long is left, in whole minutes (0 when over). */
export function minutesLeft(entry, now = Date.now()) {
  if (!entry || !Number.isFinite(entry.expiresAt)) return 0;
  return Math.max(0, Math.ceil((entry.expiresAt - now) / 60_000));
}
