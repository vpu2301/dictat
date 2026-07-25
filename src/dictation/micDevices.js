// micDevices.js — system microphone enumeration + a remembered choice.
//
// Why this exists: dictation runs on the browser Web Speech API, and that API
// has NO device-selection surface — Chrome always records from whatever the OS
// has set as the default input. So the picker here does two jobs:
//
//   1. It drives every stream we DO open ourselves (level meter, consent
//      recorder, the WS capture pipeline) — those honour `deviceId` exactly.
//   2. It tells the user when their choice disagrees with the OS default, so
//      they can fix it in System Settings and have recognition follow.
//
// The motivating case is an iPhone used as the Mac's mic (Continuity
// Microphone): it shows up in `enumerateDevices()` only while the phone is
// awake and nearby, and drops off the moment it isn't — so every lookup here
// treats "the remembered device is gone" as normal, not as an error.
//
// Pure helpers only (no React, no imports) — the hook lives in
// ./useMicDevices.js and the unit tests import this file under `node --test`.

export const MIC_PREF_KEY = "mdx.mic.device";

// Sentinel for "follow whatever the OS calls default" — also the value the
// picker renders as the first option.
export const SYSTEM_DEFAULT = "";

// Chrome synthesises alias entries that are not real devices: "default"
// mirrors the OS default input, "communications" the Windows comms device.
// They never belong in the picker, but "default" is how we learn which real
// device the OS is currently routing to.
const PSEUDO_IDS = new Set(["default", "communications"]);

export const isPseudoId = (id) => PSEUDO_IDS.has(id);

// Chrome labels the alias entry "Default - <device>" (localised in some
// builds). groupId matching is the primary signal; this is the fallback.
const DEFAULT_PREFIX = /^(default|standard|standard-?gerät|стандартн\S*|за замовчуванням|domyślny\S*)\s*[-–—:]\s*/i;

export function stripDefaultPrefix(label) {
  return String(label || "").replace(DEFAULT_PREFIX, "").trim();
}

export const looksLikeIPhone = (label) => /iphone|айфон/i.test(String(label || ""));

// macOS (not iOS) — where Continuity Microphone and the System Settings →
// Sound → Input guidance apply.
export function isMacPlatform(nav) {
  const n = nav ?? (typeof navigator !== "undefined" ? navigator : null);
  if (!n) return false;
  const s = `${n.userAgentData?.platform || ""} ${n.platform || ""} ${n.userAgent || ""}`;
  return /mac/i.test(s) && !/iphone|ipad/i.test(s);
}

// ── Enumeration ────────────────────────────────────────────────────────

// Fold a raw MediaDeviceInfo list into what the picker needs.
export function normalizeMics(devices) {
  const inputs = (devices || []).filter((d) => d.kind === "audioinput");
  const alias = inputs.find((d) => d.deviceId === "default") || null;
  const real = inputs
    .filter((d) => d.deviceId && !isPseudoId(d.deviceId))
    .map((d) => ({ deviceId: d.deviceId, groupId: d.groupId || "", label: d.label || "" }));
  return {
    devices: real,
    // What "default" currently points at — shown in the guidance banner.
    defaultGroupId: alias ? alias.groupId || "" : "",
    defaultLabel: alias ? stripDefaultPrefix(alias.label) : "",
    hasDefaultAlias: !!alias,
    // Before mic permission is granted the browser masks labels (and Chrome
    // masks deviceIds too), so the list is unusable until we prompt once.
    labelsHidden: inputs.length > 0 && inputs.every((d) => !d.label),
  };
}

// Resolve the remembered {id, label} against the devices present right now.
// Returns the deviceId to actually use, plus whether we had to heal or drop it.
//
// Healing by label matters for the iPhone case: Chrome re-salts deviceIds when
// the user clears site data, and the phone re-registers on every reconnect —
// matching the label back to a live device keeps the choice sticky instead of
// silently reverting to the built-in mic.
export function matchPreferred(devices, pref) {
  const id = pref && pref.id;
  if (!id) return { deviceId: SYSTEM_DEFAULT, status: "default" };
  const list = devices || [];
  const exact = list.find((d) => d.deviceId === id);
  if (exact) return { deviceId: exact.deviceId, status: "ok", device: exact };
  const label = pref && pref.label;
  const byLabel = label ? list.find((d) => d.label && d.label === label) : null;
  if (byLabel) return { deviceId: byLabel.deviceId, status: "healed", device: byLabel };
  return { deviceId: SYSTEM_DEFAULT, status: "missing" };
}

// Does the current choice actually feed the Web Speech recogniser? True when
// the user follows the OS default, when their device IS the OS default, or
// when the browser hides the default alias (nothing useful to warn about).
export function selectionFollowsSystemDefault(state, selectedId) {
  if (!selectedId) return true;
  const s = state || {};
  if (!s.hasDefaultAlias) return true;
  const sel = (s.devices || []).find((d) => d.deviceId === selectedId);
  if (!sel) return true; // gone — capture falls back to the default anyway
  if (s.defaultGroupId && sel.groupId) return sel.groupId === s.defaultGroupId;
  return !!s.defaultLabel && s.defaultLabel === sel.label;
}

// ── Constraints & capture ──────────────────────────────────────────────

// The constraints the backend cares about (mono, EC/NS/AGC on) plus an exact
// device pin when one is chosen. `exact` — not `ideal` — so a stale id fails
// loudly and we can fall back deliberately instead of recording the wrong mic.
export function micAudioConstraints(deviceId) {
  const base = {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
  return deviceId ? { ...base, deviceId: { exact: deviceId } } : base;
}

export async function listMics() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
    return normalizeMics([]);
  }
  return normalizeMics(await navigator.mediaDevices.enumerateDevices());
}

// Open a capture stream on the chosen device, degrading to the OS default if
// that device just walked away (iPhone asleep / AirPods disconnected).
export async function openMicStream(deviceId) {
  const id = deviceId === undefined ? getPreferredMicId() : deviceId;
  const md = navigator.mediaDevices;
  try {
    return await md.getUserMedia({ audio: micAudioConstraints(id) });
  } catch (e) {
    const name = e && e.name;
    if (id && (name === "OverconstrainedError" || name === "NotFoundError" || name === "NotReadableError")) {
      return md.getUserMedia({ audio: micAudioConstraints(SYSTEM_DEFAULT) });
    }
    throw e;
  }
}

// One-shot permission prompt so `enumerateDevices()` starts returning labels.
// Opens on the OS default (never on a pinned id — the point is to unmask the
// list, and the pinned device may be exactly what's missing) and closes at once.
export async function unlockDeviceLabels() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((t) => t.stop());
}

// ── Preference storage ─────────────────────────────────────────────────
// Stored as {id, label}: the label is what lets matchPreferred() heal a
// re-issued deviceId, and what we show when the device is unavailable.

export function getPreferredMic() {
  try {
    const raw = localStorage.getItem(MIC_PREF_KEY);
    if (!raw) return { id: SYSTEM_DEFAULT, label: "" };
    const p = JSON.parse(raw);
    return { id: String(p?.id || ""), label: String(p?.label || "") };
  } catch {
    return { id: SYSTEM_DEFAULT, label: "" };
  }
}

export const getPreferredMicId = () => getPreferredMic().id;

export function setPreferredMic(id, label) {
  try {
    if (!id) localStorage.removeItem(MIC_PREF_KEY);
    else localStorage.setItem(MIC_PREF_KEY, JSON.stringify({ id, label: label || "" }));
  } catch { /* private mode — the choice just doesn't survive the session */ }
}
