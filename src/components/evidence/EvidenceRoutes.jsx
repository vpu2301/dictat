// EvidenceRoutes.jsx — the evidence module's own route table (EVA-S03/S04).
//
// THE BOUNDARY. App.jsx hands every `#/evidence/*` path to this component and
// knows nothing else about the module: no imports of evidence screens, no
// per-screen route branches, no flag checks. Adding a screen is a line here,
// not an edit to a 900-line router — and deleting the module is deleting one
// directory plus one branch.
//
// TWO FAMILIES, TWO FLAGS, and neither implies the other:
//
//   clinician (S04)   #/evidence, #/evidence/answers/:id, #/evidence/history
//                     FEATURES.evidence · roles holding `evidence.ask`
//   devtools  (S03)   #/evidence/dev/*
//                     FEATURES.evidenceDevtools · tenant_admin
//
// A build can ship the clinician surface with the devtools off (which is what
// production is) or the devtools alone on a developer's machine.
//
// Everything is gated twice, in this order, on purpose:
//   · the flag decides whether these routes EXIST (off ⇒ the caller's 404,
//     identical to any other unknown path — flag-off invisibility)
//   · the role gate decides who may open one that does
//
// Order matters: the flag is checked first, so a clinician deep-linking to a
// devtools path on a build where the flag is off gets "page not found", not
// "forbidden". "Forbidden" would confirm the route exists.
//
// THE ROLE LIST IS NOT WRITTEN HERE. It is read out of the permission MATRIX
// (`evidence.ask`), which mirrors the backend's permissions.csv and is drift-
// tested against it. A hand-typed `["clinician","nurse","tenant_admin"]` in
// this file would be a fourth copy of that list and the first one to go stale.
import React from "react";
import { FEATURES } from "../../api/services.js";
import { MATRIX } from "../../auth/permissions.js";
import { RequireRole } from "../../auth/RequireRole.jsx";
import { tr } from "../../i18n.js";
import { EvidenceDevtools } from "./EvidenceDevtools.jsx";
import { RetrievalPlayground } from "./dev/RetrievalPlayground.jsx";
import { QuickSearchPage } from "./ask/QuickSearchPage.jsx";
import { HistoryPage } from "./history/HistoryPage.jsx";
import { excerpt } from "./history/historyView.js";
import { recallQuestion } from "./answerTitles.js";

export const EVIDENCE_BASE_PATH = "/evidence";

/** Who may open a clinician evidence screen. One source: the permission table. */
const ASK_ROLES = MATRIX["evidence.ask"].evidence;

const DEVTOOLS_ROUTES = {
  "/evidence/dev": { title: "Evidence devtools", Component: EvidenceDevtools },
  "/evidence/dev/retrieval": { title: "Retrieval playground", Component: RetrievalPlayground },
};

/**
 * The clinician routes. `match` returns the props the screen is mounted with,
 * or null — which is all a router this small needs instead of a path parser.
 */
const CLINICIAN_ROUTES = [
  {
    id: "ask",
    match: (p) => (p === "/evidence" ? {} : null),
    Component: QuickSearchPage,
    crumb: () => null,
  },
  {
    id: "answer",
    match: (p) => {
      const m = /^\/evidence\/answers\/([^/]+)$/.exec(p);
      return m ? { answerId: decodeURIComponent(m[1]) } : null;
    },
    Component: QuickSearchPage,
    // The crumb is the question, not the id: a breadcrumb reading
    // "Evidence / 9f3c-…" tells the reader nothing they can use. See
    // answerTitles.js for why the question is available synchronously on
    // every path a user actually takes here, and what a cold deep link gets.
    crumb: (props, lang) =>
      excerpt(recallQuestion(props.answerId)) || tr(lang, "Відповідь", "Answer"),
  },
  {
    id: "history",
    match: (p) => (p === "/evidence/history" ? {} : null),
    Component: HistoryPage,
    crumb: (_props, lang) => tr(lang, "Історія", "History"),
  },
];

/** The clinician route that claims this path, with its props. */
function matchClinician(path) {
  if (!FEATURES.evidence) return null;
  for (const route of CLINICIAN_ROUTES) {
    const props = route.match(path);
    if (props) return { route, props };
  }
  return null;
}

function matchDevtools(path) {
  if (!FEATURES.evidenceDevtools) return null;
  return Object.prototype.hasOwnProperty.call(DEVTOOLS_ROUTES, path)
    ? DEVTOOLS_ROUTES[path]
    : null;
}

/** Does the module claim this path at all? False ⇒ the host renders its 404. */
export function isEvidenceRoute(route) {
  const path = String(route || "").split("?")[0];
  return !!matchClinician(path) || !!matchDevtools(path);
}

/**
 * Breadcrumbs for the host's top bar. Returns null when the module does not
 * own the route, so App.jsx can fall through without importing anything else.
 */
export function evidenceCrumbs(route, lang = "uk") {
  const path = String(route || "").split("?")[0];
  const dev = matchDevtools(path);
  if (dev) return [{ label: "Evidence" }, { label: dev.title }];

  const hit = matchClinician(path);
  if (!hit) return null;
  const head = { label: tr(lang, "Доказова база", "Evidence") };
  const tail = hit.route.crumb(hit.props, lang);
  return tail ? [head, { label: tail }] : [head, { label: tr(lang, "Запит", "Ask") }];
}

export function EvidenceRoutes({ route, navigate }) {
  const path = String(route || "").split("?")[0];

  const clinician = matchClinician(path);
  if (clinician) {
    const { route: entry, props } = clinician;
    return (
      <RequireRole any={ASK_ROLES} navigate={navigate}>
        <entry.Component {...props} navigate={navigate} />
      </RequireRole>
    );
  }

  const dev = matchDevtools(path);
  if (!dev) return null;

  // Devtools are tenant_admin-only. Not because the data is sensitive — the
  // corpus is not patient data — but because a screen that speaks in fusion
  // scores is a screen a clinician can only be confused by, and every
  // permission this module will ever hold is decided in one place.
  return (
    <RequireRole any={["tenant_admin"]} navigate={navigate}>
      <dev.Component navigate={navigate} />
    </RequireRole>
  );
}
