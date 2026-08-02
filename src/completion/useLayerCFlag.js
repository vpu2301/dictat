// useLayerCFlag.js — "does Layer C exist for this deployment?" (sprint 15).
//
// There is no bootstrap/config payload in this platform, and the tenant flag
// lives in generation-service's own settings. The service surfaces it on
// /readyz (`layer_c_enabled`), so that probe IS the feature flag.
//
// Probed ONCE per page load and shared by every editor instance: the answer
// cannot change mid-session, and a per-mount probe would put a request on the
// path of opening a report. A dead or absent service resolves to "off" —
// silence, never an error (Layer C is an enhancement; a clinic without a GPU
// simply never sees ghost text).

import { useEffect, useState } from "react";
import { generationReadyz } from "../api/generation.js";

const OFF = { enabled: false, model: null, reachable: false };

let cached = null;   // resolved value
let inflight = null; // shared promise

export function layerCFlagSnapshot() {
  return cached || OFF;
}

// Test seam: lets a spec pin the flag without a network round-trip.
export function __setLayerCFlagForTests(value) {
  cached = value ? { ...OFF, ...value } : null;
  inflight = null;
}

export function useLayerCFlag({ enabled = true } = {}) {
  const [flag, setFlag] = useState(() => cached || OFF);

  useEffect(() => {
    if (!enabled || cached) return undefined;
    let alive = true;
    if (!inflight) {
      inflight = generationReadyz().then((r) => { cached = r; return r; });
    }
    inflight.then((r) => { if (alive) setFlag(r); });
    return () => { alive = false; };
  }, [enabled]);

  return flag;
}
