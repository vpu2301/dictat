// useSearchQuery.js — debounced, cancel-safe, cursor-append search for
// roster-style screens (sprint 11 step 02).
//
// Mirrors the S10 autocomplete engine's safety pattern (debounce +
// AbortController + monotonic seq guard) at roster tolerances: 250 ms
// debounce, stale-while-loading (previous results stay on screen while the
// next page is in flight — the list never blanks under the user), and
// cursor-append pagination (loadMore() fetches next_cursor and appends,
// deduped by id, for infinite scroll).
//
// Usage:
//   const sq = useSearchQuery(
//     (query, cursor, { signal }) =>
//       listPatients({ query: query || undefined, cursor, limit: 50 })
//         .then(toPage),                       // → { items, nextCursor }
//     [activeTid],                             // reset + refetch on change
//     { debounceMs: 250, minLength: 2 },
//   );
//   sq.setQuery(text)  — debounced; below minLength nothing fires (previous
//                        results stay). "" is always allowed (unfiltered).
//   sq.items, sq.loading, sq.loadingMore, sq.error, sq.hasMore,
//   sq.loadMore(), sq.reload()

import { useState, useEffect, useRef, useCallback } from "react";

export function useSearchQuery(fetchPage, deps = [], { debounceMs = 250, minLength = 2 } = {}) {
  const [query, setQueryState] = useState("");
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  // Monotonic guard: only the newest request may paint. Aborting the old
  // fetch is best-effort; the seq check is the actual correctness barrier.
  const seqRef = useRef(0);
  const abortRef = useRef(null);
  const timerRef = useRef(null);
  // The query the current result set was fetched for — loadMore() must page
  // THAT query even if the input box has since gone below minLength.
  const activeQueryRef = useRef("");

  const runSearch = useCallback(async (q) => {
    const seq = ++seqRef.current;
    if (abortRef.current) abortRef.current.abort();
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    abortRef.current = ctl;
    setLoading(true);
    setError(null);
    try {
      const { items: page, nextCursor: nc } = await fetchRef.current(q, undefined, { signal: ctl?.signal });
      if (seq !== seqRef.current) return;
      activeQueryRef.current = q;
      setItems(page || []);
      setNextCursor(nc || null);
      setLoading(false);
    } catch (e) {
      if (seq !== seqRef.current || (e && e.name === "AbortError")) return;
      setError(e);
      setLoading(false);
    }
  }, []);

  // Debounced query intake. Below minLength (except "") nothing fires and
  // the previous results stay — stale-while-loading, never a blank flash.
  const setQuery = useCallback((text) => {
    const q = String(text ?? "");
    setQueryState(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.length > 0 && q.length < minLength) return;
    timerRef.current = setTimeout(() => runSearch(q), debounceMs);
  }, [debounceMs, minLength, runSearch]);

  // First load + dependency resets (e.g. tenant switch) are immediate.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    runSearch("");
    setQueryState("");
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
      seqRef.current++; // orphan any in-flight response
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const seq = seqRef.current; // a new search invalidates this page fetch
    setLoadingMore(true);
    try {
      const { items: page, nextCursor: nc } = await fetchRef.current(activeQueryRef.current, nextCursor, {});
      if (seq !== seqRef.current) return;
      setItems((prev) => {
        const seen = new Set(prev.map((it) => it && it.id));
        return [...prev, ...(page || []).filter((it) => it && !seen.has(it.id))];
      });
      setNextCursor(nc || null);
    } catch (e) {
      if (seq === seqRef.current) setError(e);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore]);

  const reload = useCallback(() => runSearch(activeQueryRef.current), [runSearch]);

  return { query, setQuery, items, loading, loadingMore, error, hasMore: !!nextCursor, loadMore, reload };
}
