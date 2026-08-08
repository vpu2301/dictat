# Evidence module (EVA)

The evidence surfaces live here, behind one boundary: `App.jsx` hands every
`#/evidence/*` path to `EvidenceRoutes.jsx` and knows nothing else about the
module. Adding a screen is a line in that route table; deleting the module is
deleting this directory and one branch in the router.

```
EvidenceRoutes.jsx     the route table + both gates (flag, then role)
EvidenceDevtools.jsx   #/evidence/dev — the index of developer screens
answerTitles.js        which question an answer id belongs to (breadcrumbs)
evidence.css           every rule prefixed `evd-`, no new design tokens
ask/
  QuickSearchPage.jsx       #/evidence and #/evidence/answers/:id  (EVA-S04)
  AskBox.jsx                autosizing question field, permission-gated submit
  SuggestionChips.jsx       the /suggestions bank, behind its own flag
answer/
  AnswerView.jsx            summary · detail · sources, one path for both origins
  useAnswerStream.js        the stream's lifecycle, and only that
  SegmentRenderer.jsx       one segment, drawn — exported for every later sprint
  CitationChip.jsx  SourceListDrawer.jsx  WebSourceBadge.jsx
  EvidenceBadge.jsx  UnverifiedBanner.jsx  DeflectionCard.jsx  AnswerActions.jsx
  segmentKinds.js  answerEnvelope.js  sourceView.js  copyAnswer.js  ← pure decisions
history/
  HistoryPage.jsx  historyView.js
dev/
  RetrievalPlayground.jsx   #/evidence/dev/retrieval  (EVA-S03)
  FiltersEditor.jsx         the RR2 filter set
  PassageResultRow.jsx      rank, badges, breadcrumb, excerpt, scores popover
  ConnectorMetaBar.jsx      per-connector status/latency/count
  JsonViewer.jsx            collapsed request/response
  filtersModel.js  connectorMeta.js  passageView.js    ← the pure decisions
```

## The one thing every later sprint reuses

`answer/segmentKinds.js` is **the** kind→style mapping (rule FE7). S06's patient-context
answer, S07's deep trace and S10's drug card all render the same six kinds, and each of them
does it by importing `SegmentRenderer` — never by writing its own. A second implementation of
"what does an `uncertainty` segment look like" is how a platform ends up telling a clinician
that a hedge is a finding on one screen and a warning on another.

The mapping is **data, not a `switch`**, because `copyAnswer.js` and the drawer need the same
labels without importing React. It is asserted against the generated `SegmentKind` union, so a
seventh kind in a contract v2 fails a test rather than rendering unlabelled — and `kindStyle()`
still degrades an unknown kind to a labelled neutral segment rather than a blank block.

## The pattern every later evidence screen copies

**api module + `useAsync` + shared DataStates, with derivation in pure siblings.**

```js
const req = useAsync(() => retrieve(submitted), [submitted], { enabled: !!submitted });
```

- **Submitted params, not live form state.** Editing the form does not refetch;
  pressing Retrieve builds a new body object, which is what `useAsync` keys on.
  Retrieval runs an embedding model — a request per keystroke is not a
  responsiveness choice, it is a load test. The new object also arms
  `useAsync`'s stale-response guard, so an answer to a superseded question is
  dropped rather than rendered.
- **`useAsync` keeps the last good `data`** through the next request and through
  a failure. That is dictat's convention and it is right here: the previous
  result is what you are comparing against. There is no second copy of it in
  component state.
- **Pure siblings.** `filtersModel.js`, `connectorMeta.js` and `passageView.js`
  hold every decision — which is why "does this filter reach the wire?" and
  "does a null rerank read as 'did not run'?" are `node --test` assertions
  (`dev/devtools.test.js`) rather than Playwright runs. Components draw.
- **Contract types come from `src/types/evidence`** (generated, EVA-S01) and are
  never redeclared — the ESLint rule fails the build on a local copy. Value
  lists that mirror a contract union (`SOURCE_KINDS`, `AUTHORITIES`,
  `CONNECTOR_STATUSES`) are asserted equal to the generated union in tests, so a
  connector kind the backend adds cannot silently go unoffered.
- **Service URLs only via `SERVICES`** (`src/api/services.js`).
  `noHardcodedServiceUrls.test.js` fails on a literal host or port anywhere in
  this directory, on a bare `fetch` in a component, and on any client for the
  operator-only ingest service.

## Recorded exceptions

**Devtools are en-only.** No `tr()`, no translation keys, no entry in
`i18n.js`. They speak the pipeline's vocabulary — connectors, fusion scores,
snapshots, `include_superseded` — to the people building it. Translating
"lexical" or "RRF fusion" into Ukrainian would produce a screen that is harder
to use in both languages, and would put terms into the translation files that
no clinician-facing string will ever reuse. **This exception covers
`#/evidence/dev/*` only**; every clinician-facing evidence screen from S04
onward is translated like any other surface, on the terminology fixed in
`src/i18n.js` (EVA-S02).

**No audit or analytics touchpoints.** Retrieval reads are not audited at this
layer — the FE mirrors the backend's decision. Corpus reads carry no patient
data, and an audit event per playground query would bury the events that do
matter. Answer-level provenance (which passages a clinical answer consumed) is
recorded by the answer service from S04; that is the layer where reads become
worth recording.

**Devtools are `tenant_admin`-only, and that is not a data-sensitivity
judgement.** The corpus is not patient data. It is that a screen written in
fusion scores can only confuse a clinician, and the module keeps every
permission decision in one place (`EvidenceRoutes.jsx`).

## Streaming, and why it is not `EventSource` (EVA-S04)

`EventSource` cannot set a header. This platform's auth is a bearer token in memory — never a
cookie, never a query parameter — so authenticating a stream with `EventSource` would mean
putting the token where every proxy between the clinic and the service logs it. The answer
stream is therefore an ordinary `fetch` whose body is read as it arrives (`client.js`'s
`streamAt`, `src/api/sse.js`'s parser), and the wire format is still SSE because that is what
the backend speaks.

Three rules the stream code is built around, each of them a correctness property rather than a
preference:

- **Events arrive out of order and duplicated.** Every collection is keyed and a second event
  for a known key replaces rather than appends — *replaces*, because a resumed stream may carry
  a fuller version of the same segment. Asserted with shuffled and doubled fixtures.
- **`source` events carry an `index`, and citation numbers come from it.** Numbering by arrival
  would make `[1]` mean whichever connector won the race, and a reopened answer — which gets
  the service's canonical order — would renumber every citation in a document a clinician may
  already have pasted into a note.
- **A drop is recovered by re-reading, never by re-asking.** Re-asking spends the pipeline's
  slot and can return a *different* answer to the same question. `meta` (carrying `answer_id`)
  must therefore be the first event the service sends, and `GET /answers/:id` has to serve both
  reopen and resume.

## The two gates, in this order

1. The flag decides whether the routes **exist** — `FEATURES.evidence` for the clinician
   screens, `FEATURES.evidenceDevtools` for `#/evidence/dev/*`, and neither implies the other.
   Off ⇒ `isEvidenceRoute()` is false ⇒ the host renders its ordinary 404.
2. The role gate decides who may open one that does: `tenant_admin` for the devtools, and for
   the clinician screens whatever the permission MATRIX says holds `evidence.ask`. That list is
   **read from the matrix, never typed here** — a hand-written
   `["clinician","nurse","tenant_admin"]` would be a fourth copy of `permissions.csv` and the
   first one to go stale.

Flag first, deliberately: a clinician deep-linking into a build with the flag
off gets "page not found", not "forbidden". Forbidden would confirm the route
exists. `e2e/evidence-flag-off.spec.js` asserts both halves, with a control
that turns the flag on and watches the screens appear.

The flag is build-time (`VITE_FEAT_EVIDENCE_DEVTOOLS`). `services.js` also
accepts a **DEV-only** `localStorage` override (`mdx.flag.evidenceDevtools`) so
one Playwright run can exercise both states; `import.meta.env.DEV` guards it, so
it is dead code in a production build.
