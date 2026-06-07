// useAsync.js — tiny data-loading hook for the load / empty / error states
// every screen needs once it talks to a real backend instead of a mock.
//
// Usage:
//   const { data, loading, error, reload } = useAsync(() => listPatients(), [query]);
//   if (loading) return <Spinner/>;
//   if (error)   return <ApiErrorView error={error} onRetry={reload}/>;
//   if (!data?.length) return <Empty .../>;
//
// The fetcher is re-run whenever a value in `deps` changes. In-flight results
// for a stale render are dropped (the `active` guard) so a fast-typing filter
// can't paint an out-of-order response.

import { useState, useEffect, useCallback, useRef } from "react";

export function useAsync(fetcher, deps = [], { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    setError(null);
    Promise.resolve()
      .then(() => fetcherRef.current())
      .then((r) => { if (active) { setData(r); setLoading(false); } })
      .catch((e) => { if (active) { setError(e); setLoading(false); } });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nonce, ...deps]);

  return { data, error, loading, reload, setData };
}
