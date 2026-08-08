// answerTitles.js — remembering what an answer was asked (EVA-S04).
//
// The reopen breadcrumb is supposed to read `Evidence / <question excerpt>`,
// and that is awkward for one structural reason: crumbs are computed by the
// HOST (App.jsx) from the route string alone, synchronously, before anything
// has been fetched. The question lives on the answer, and the answer is a
// round trip away.
//
// The fix is not to make crumbs async — that would put a spinner in the top
// bar of every screen in the app to serve one route. It is to notice that on
// every path a user actually takes to a reopened answer, THIS TAB ALREADY
// KNOWS the question: it either just asked it, or it just clicked the history
// row that displayed it. So both of those write it down here, and the crumb
// reads it back synchronously.
//
// A cold deep link (a pasted URL, a bookmark from another session) finds
// nothing and falls back to "Answer". That is the honest outcome and a
// visibly correct one — never a wrong question against the right id.
//
// sessionStorage, not localStorage: a question is a record of what a clinician
// was unsure about, it is scoped to the tab that asked it, and it must not
// outlive the session on a shared workstation. Every access is try/caught —
// storage is disabled outright in some locked-down clinic browser profiles,
// and a breadcrumb is not worth a thrown exception.

const KEY = "mdx.evidence.answerTitles";
const LIMIT = 40;

function read() {
  try {
    const raw = sessionStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Note the question an answer id belongs to. */
export function rememberQuestion(answerId, question) {
  if (!answerId || !question) return;
  try {
    const all = read();
    all[answerId] = String(question);
    // Bounded, oldest-inserted first: an unbounded map in session storage is
    // a slow leak nobody ever notices and nobody ever needs.
    const keys = Object.keys(all);
    if (keys.length > LIMIT) for (const k of keys.slice(0, keys.length - LIMIT)) delete all[k];
    sessionStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable — the crumb falls back, nothing else changes */
  }
}

/** The remembered question, or "" when this tab never saw it. */
export function recallQuestion(answerId) {
  if (!answerId) return "";
  return read()[answerId] || "";
}

/** Test seam. */
export function __clearAnswerTitles() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
