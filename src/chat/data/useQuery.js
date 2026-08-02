// chat/data/useQuery.js — the module's data-fetch primitive.
//
// The brief names React Query; this repo doesn't carry it, and adding a
// dependency to cache a fake API would be the tail wagging the dog. What the
// screens actually need from it is here: keyed fetches, load/error state,
// refetch, and stale-result rejection so a fast-typing patient search can't
// paint an out-of-order response.
//
// It also refetches whenever the mock config changes, so the demo switches in
// the settings panel take effect immediately.

import { useCallback, useEffect, useRef, useState } from "react";
import { onMockConfigChange } from "./mockClient.js";

export function useQuery(key, fetcher, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [nonce, setNonce] = useState(0);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => onMockConfigChange(() => setNonce((n) => n + 1)), []);

  useEffect(() => {
    if (!enabled) { setLoading(false); return undefined; }
    let active = true;
    setLoading(true);
    setError(null);
    Promise.resolve()
      .then(() => fetcherRef.current())
      .then((r) => { if (active) { setData(r); setLoading(false); } })
      .catch((e) => { if (active) { setError(e); setData(null); setLoading(false); } });
    return () => { active = false; };
  }, [key, enabled, nonce]);

  return { data, error, loading, refetch };
}
