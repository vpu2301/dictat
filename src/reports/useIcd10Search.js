// useIcd10Search.js — Sprint 13 step 05: search-as-you-type against
// /v1/icd10/search with the FE S10 autocomplete discipline — debounce
// (150 ms search tolerance), AbortController cancel on new input,
// seq-guard against stale responses, LRU memo (~20 queries), min length 2.
// Same discipline as useSuggestions, deliberately NOT coupled to the
// editor hook (different endpoint, different lifecycle).
//
// Degraded mode is FAIL-QUIET: any error (backend down, timeout, the
// endpoint not shipped yet — BE step 03) yields an empty result list, no
// error UI. This is a lookup aid, not the finalize gate; typing and prose
// are never affected.
//
// The logic lives in a framework-free controller (injectable search fn +
// timers) so node --test can exercise debounce/stale/LRU without a DOM;
// the hook is a thin React wrapper.

import { useEffect, useRef, useState } from "react";
import { searchIcd10 } from "../api/icd10.js";

export const ICD10_DEBOUNCE_MS = 150;
export const ICD10_MIN_QUERY = 2;
export const ICD10_LRU_SIZE = 20;

export function createIcd10SearchController({
  search = searchIcd10,
  debounceMs = ICD10_DEBOUNCE_MS,
  minLength = ICD10_MIN_QUERY,
  lruSize = ICD10_LRU_SIZE,
  schedule = (fn, ms) => setTimeout(fn, ms),
  cancel = (id) => clearTimeout(id),
  onResults,
} = {}) {
  let seq = 0;
  let timer = null;
  let aborter = null;
  const lru = new Map(); // q → results (Map preserves recency order)

  const settle = (mySeq, q, results) => {
    if (mySeq !== seq) return; // stale — a newer input owns the dropdown
    onResults?.(results, q);
  };

  return {
    input(raw) {
      const q = String(raw ?? "").trim();
      seq += 1; // anything in flight is now stale
      if (timer != null) { cancel(timer); timer = null; }
      if (aborter) { aborter.abort(); aborter = null; }

      if (q.length < minLength) { onResults?.([], q); return; }

      const hit = lru.get(q);
      if (hit) { // memo: serve without network, refresh recency
        lru.delete(q);
        lru.set(q, hit);
        onResults?.(hit, q);
        return;
      }

      const mySeq = seq;
      timer = schedule(async () => {
        timer = null;
        aborter = new AbortController();
        try {
          const res = await search(q, { signal: aborter.signal });
          const results = Array.isArray(res?.results) ? res.results : [];
          lru.set(q, results);
          while (lru.size > lruSize) lru.delete(lru.keys().next().value);
          settle(mySeq, q, results);
        } catch {
          settle(mySeq, q, []); // fail-quiet (incl. abort races)
        }
      }, debounceMs);
    },
    dispose() {
      seq += 1;
      if (timer != null) { cancel(timer); timer = null; }
      if (aborter) { aborter.abort(); aborter = null; }
    },
  };
}

export function useIcd10Search() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const ctrlRef = useRef(null);
  if (!ctrlRef.current) {
    ctrlRef.current = createIcd10SearchController({ onResults: (r) => setResults(r) });
  }
  useEffect(() => () => ctrlRef.current?.dispose(), []);

  const setQuery = (raw) => {
    setQ(raw);
    ctrlRef.current.input(raw);
  };
  const clear = () => {
    setQ("");
    setResults([]);
    ctrlRef.current.input("");
  };
  return { q, setQuery, results, clear };
}
