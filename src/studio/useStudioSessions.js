// studio/useStudioSessions.js — the rail's data.
//
// Three services, three requests, one list. Each source is fetched and failed
// INDEPENDENTLY: if asr-service is down, the rail still shows reports and
// dictations plus a line saying which source is missing. A single combined
// promise would have turned one dead service into an empty workspace.

import { useCallback, useMemo } from "react";

import { useAsync } from "../api/useAsync.js";
import { asList } from "../components/DataStates.jsx";
import { listReports, reportHits } from "../api/reports.js";
import { listSessions } from "../api/dictation.js";
import { listJobs } from "../api/asr.js";
import { listNotes } from "../api/notes.js";
import {
  reportToSession, noteToSession, dictationToSession, asrToSession,
  mergeSessions, filterSessions, groupSessions,
} from "./sessions.js";

const LIMIT = 40;

// Every service caps `limit` differently, and asking for more than the cap is a
// 422 — which is how the history page (limit 200) lost its reports entirely
// while the other three loaded. The caps come from the OpenAPI snapshots.
const CAP = { report: 100, note: 200, asr: 200, dictate: 200 };
const cap = (n, key) => Math.max(1, Math.min(n, CAP[key]));

export function useStudioSessions({ lang = "uk", query = "", limit = LIMIT } = {}) {
  // Reports search server-side (it can reach past the first page); the other
  // two are filtered client-side below — neither service takes a text query.
  const reportsReq = useAsync(
    () => listReports({ query: query || undefined, limit: cap(limit, "report") }),
    [query, limit],
  );
  const dictateReq = useAsync(() => listSessions({ limit: cap(limit, "dictate") }), [limit]);
  const asrReq     = useAsync(() => listJobs({ limit: cap(limit, "asr") }), [limit]);
  const notesReq   = useAsync(() => listNotes({ limit: cap(limit, "note") }), [limit]);

  const items = useMemo(() => {
    const reports = reportHits(reportsReq.data).map((h) => reportToSession(h, lang));
    const dictations = asList(dictateReq.data).map((s) => dictationToSession(s, lang));
    const jobs = asList(asrReq.data).map((j) => asrToSession(j, lang));
    const notes = asList(notesReq.data).map((n) => noteToSession(n, lang));
    // The reports call already applied the query server-side; re-applying it
    // client-side would drop hits that matched on a field we don't index here
    // (the snippet), so only the other two sources are filtered.
    return mergeSessions(
      reports,
      filterSessions(notes.filter(Boolean), query),
      filterSessions(dictations.filter(Boolean), query),
      filterSessions(jobs.filter(Boolean), query),
    );
  }, [reportsReq.data, notesReq.data, dictateReq.data, asrReq.data, lang, query]);

  const groups = useMemo(() => groupSessions(items, lang), [items, lang]);

  const reload = useCallback(() => {
    reportsReq.reload();
    notesReq.reload();
    dictateReq.reload();
    asrReq.reload();
  }, [reportsReq.reload, notesReq.reload, dictateReq.reload, asrReq.reload]);

  const sources = [
    { key: "report",  error: reportsReq.error, loading: reportsReq.loading, reload: reportsReq.reload },
    { key: "note",    error: notesReq.error,   loading: notesReq.loading,   reload: notesReq.reload },
    { key: "dictate", error: dictateReq.error, loading: dictateReq.loading, reload: dictateReq.reload },
    { key: "asr",     error: asrReq.error,     loading: asrReq.loading,     reload: asrReq.reload },
  ];

  return {
    items,
    groups,
    sources,
    // "Loading" means nothing is on screen yet; once any source has answered
    // the rail renders what it has instead of blocking on the slowest one.
    loading: sources.every((s) => s.loading),
    failed: sources.filter((s) => s.error),
    reload,
  };
}
