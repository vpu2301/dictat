// useLimitedList.js — loading for the backend's bare-array list endpoints.
//
// Several admin surfaces read endpoints that paginate with nothing but `limit`
// (GET /templates, GET /nlp/abbreviations) or `limit`+`offset` returning a
// bare array with no total and no next-page signal (GET /admin/users). The
// only way to know whether more rows exist is the length heuristic: a full
// page MAY have more behind it, a short page is the end. This hook names that
// heuristic once instead of letting every table re-derive it.
//
// The React-free core (`pageState`) is exported for node --test.

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The length heuristic, as data. `items.length === limit` ⇒ maybeMore: the
 * server filled the page, so the next offset is worth asking for. Anything
 * shorter is definitely the tail.
 */
export function pageState(items, limit) {
  const list = Array.isArray(items) ? items : [];
  return { items: list, maybeMore: limit > 0 && list.length === limit };
}

/**
 * fetcher({ limit, offset }) → Promise<array>. Offset is managed here;
 * endpoints without offset support simply ignore it (their callers keep
 * offset at 0 and page nothing).
 */
export function useLimitedList(fetcher, { limit = 50, deps = [] } = {}) {
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  // Stale responses must not paint — same guard as useCursorPages.
  const reqIdRef = useRef(0);

  const load = useCallback(async (atOffset) => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await fetcherRef.current({ limit, offset: atOffset });
      if (reqId !== reqIdRef.current) return;
      setItems(Array.isArray(rows) ? rows : []);
      setOffset(atOffset);
    } catch (e) {
      if (reqId === reqIdRef.current) setError(e);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [limit]);

  // Filter/dep change ⇒ back to the first page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(0); }, [limit, ...deps]);

  const { maybeMore } = pageState(items, limit);

  return {
    items,
    loading,
    error,
    offset,
    page: Math.floor(offset / limit) + 1,
    hasPrev: offset > 0,
    hasNext: maybeMore,
    next: () => { if (!loading && maybeMore) load(offset + limit); },
    prev: () => { if (!loading && offset > 0) load(Math.max(0, offset - limit)); },
    reload: () => load(offset),
  };
}
