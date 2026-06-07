// useCursorPages.js — forward-only cursor pagination with back-navigation.
//
// Server list endpoints here are cursor-based ({ ...items, next_cursor }), so
// you can only walk forward. This hook keeps every page it has already fetched
// in memory, so the user can page Back (instant, from cache) and Next (cached
// if already seen, otherwise fetched with the stored cursor). Total page count
// is unknown until the cursor runs out — pair with <Pagination> in cursor mode.
//
// Usage:
//   const pg = useCursorPages(
//     (cursor) => listJobs({ cursor, limit: 25 }).then(r => ({
//       items: r.jobs || [], nextCursor: r.next_cursor || null,
//     })),
//     [statusFilter],   // refetch from page 1 when these change
//   );
//   pg.items, pg.page, pg.hasPrev, pg.hasNext, pg.next(), pg.prev(), pg.loading, pg.error

import { useState, useEffect, useCallback, useRef } from "react";

export function useCursorPages(fetchPage, deps = []) {
  const [pages, setPages] = useState([]);      // array of item-arrays, one per loaded page
  const [pageIdx, setPageIdx] = useState(0);   // 0-based index into `pages`
  const [nextCursor, setNextCursor] = useState(null); // cursor for the page after the last loaded
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  // Bumped on every loadFirst; a fetch whose id is stale must not paint, so a
  // fast-changing filter can't show an out-of-order first page.
  const reqIdRef = useRef(0);

  const loadFirst = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const { items, nextCursor: nc } = await fetchRef.current(undefined);
      if (reqId !== reqIdRef.current) return;
      setPages([items || []]);
      setPageIdx(0);
      setNextCursor(nc || null);
    } catch (e) {
      if (reqId === reqIdRef.current) setError(e);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, []);

  // Refetch from the first page whenever a dependency (e.g. a filter) changes.
  useEffect(() => { loadFirst(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, deps);

  const next = useCallback(async () => {
    if (loading) return;
    // Already-loaded page → just move the window, no fetch.
    if (pageIdx < pages.length - 1) { setPageIdx(pageIdx + 1); return; }
    if (!nextCursor) return;
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const { items, nextCursor: nc } = await fetchRef.current(nextCursor);
      if (reqId !== reqIdRef.current) return;
      setPages((p) => [...p, items || []]);
      setPageIdx((i) => i + 1);
      setNextCursor(nc || null);
    } catch (e) {
      if (reqId === reqIdRef.current) setError(e);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [loading, pageIdx, pages.length, nextCursor]);

  const prev = useCallback(() => setPageIdx((i) => Math.max(0, i - 1)), []);

  const items = pages[pageIdx] || [];
  const hasPrev = pageIdx > 0;
  const hasNext = pageIdx < pages.length - 1 || !!nextCursor;

  return { items, page: pageIdx + 1, hasPrev, hasNext, next, prev, loading, error, reload: loadFirst };
}
