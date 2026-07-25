// useMicDevices.js — React binding over ./micDevices.js.
//
// Keeps the device list live (the `devicechange` event fires when an iPhone
// joins or leaves as a Continuity Microphone), remembers the choice across
// sessions, and reports whether that choice is the one Web Speech will
// actually hear. Pure logic lives in ./micDevices.js so it stays testable.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  SYSTEM_DEFAULT,
  getPreferredMic,
  listMics,
  matchPreferred,
  selectionFollowsSystemDefault,
  setPreferredMic,
  unlockDeviceLabels,
} from "./micDevices.js";

const EMPTY = {
  devices: [], defaultGroupId: "", defaultLabel: "", hasDefaultAlias: false, labelsHidden: false,
};

export function useMicDevices() {
  const [state, setState] = useState(EMPTY);
  const [pref, setPref] = useState(() => getPreferredMic());
  const [error, setError] = useState(null);
  const prefRef = useRef(pref);
  prefRef.current = pref;

  const supported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.enumerateDevices;

  const refresh = useCallback(async () => {
    if (!supported) return;
    try {
      const next = await listMics();
      setState(next);
      setError(null);
      // A re-issued deviceId for the same physical mic: adopt it silently so
      // the choice survives the iPhone reconnecting.
      const m = matchPreferred(next.devices, prefRef.current);
      if (m.status === "healed") {
        const healed = { id: m.deviceId, label: m.device.label };
        setPref(healed);
        setPreferredMic(healed.id, healed.label);
      }
    } catch (e) { setError(e); }
  }, [supported]);

  useEffect(() => {
    if (!supported) return undefined;
    refresh();
    const md = navigator.mediaDevices;
    md.addEventListener?.("devicechange", refresh);
    return () => md.removeEventListener?.("devicechange", refresh);
  }, [supported, refresh]);

  const select = useCallback((id) => {
    const dev = state.devices.find((d) => d.deviceId === id);
    const next = { id: id || SYSTEM_DEFAULT, label: dev ? dev.label : "" };
    setPref(next);
    setPreferredMic(next.id, next.label);
  }, [state.devices]);

  // Prompt once so the browser stops masking device labels.
  const grantAccess = useCallback(async () => {
    try { await unlockDeviceLabels(); setError(null); }
    catch (e) { setError(e); }
    await refresh();
  }, [refresh]);

  const match = matchPreferred(state.devices, pref);
  return {
    ...state,
    supported,
    error,
    refresh,
    select,
    grantAccess,
    // The id the picker shows and every getUserMedia call pins.
    selectedId: pref.id,
    selectedLabel: pref.label,
    selected: match.device || null,
    // Chosen device isn't plugged in right now — capture falls back to the OS
    // default, so this is a notice, not an error.
    unavailable: match.status === "missing",
    // False ⇒ Web Speech is listening to a different mic than the one picked.
    followsDefault: selectionFollowsSystemDefault(state, pref.id),
  };
}
