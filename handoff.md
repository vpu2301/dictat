# Dictat — Developer Handoff

Practical context for anyone picking up this repo. Pairs with `README.md` (which
covers the service URLs / `.env` matrix in depth) — this file focuses on **how the
frontend is built, the conventions you must follow, the gotchas, and what was
recently changed**.

> **What it is:** `dictat` (package name `dictator`) is the **React + Vite web
> frontend** for a voice-first medical documentation platform. Clinical content is
> **dictated, not typed** — clinicians record dictations or live consultations, the
> backend transcribes + structures them, and clinicians review, amend, and **e-sign**
> the result (Дія.Підпис / qualified key). The backend is a **separate repo** of
> microservices (`~/Desktop/dictate` / `medical-dictation-backend`).

---

## 1. Run / build / test

```bash
npm install
cp .env.example .env        # point VITE_*_SERVICE_URL at your backends
npm run dev                 # Vite dev server (default :5173)
npm run build               # production build (also the fastest full typecheck-ish gate)
npm run preview             # serve the production build

npm run e2e                 # Playwright end-to-end (npm run e2e:ui for the runner UI)
npm run test:unit           # node --test over the pure modules (no runner dependency)
npm run verify:batch-a      # live auth-contract check against the backend (scripts/integration)

# EVA-S01 — evidence contracts & the permission mirror
npm run contracts:types     # regenerate src/types/evidence.d.ts from the pinned backend schemas
npm run contracts:check     # CI: regenerate to a buffer, fail if the committed file differs, then tsc
npm run lint:contracts      # the one ESLint rule: no hand-written contract types
npm run auth:permissions -- --check   # vendored docs/auth/permissions.csv vs the backend's copy
EVIDENCE_DB_URL=… npm run fixtures:corpus   # EVA-S02 — regenerate the mock corpus from a dev backend
```

The unit net is `npm run test:unit` (plain `node --test`, no framework) plus
`npm run build` (full module transform; catches import/syntax errors) and Playwright e2e.
After any change, run `npm run build` before declaring done.

**Tech stack:** React 18, Vite 6, **TipTap 3** (section-aware editor), DOMPurify (paste
sanitization), `qrcode` (Дія signing), `diff-match-patch` (report amendments),
`@floating-ui` (popovers). No CSS framework — hand-rolled CSS with design tokens.

---

## 2. Boot & providers

`index.html → src/main.jsx → src/App.jsx`. Provider stack (`src/main.jsx`):

```
<AuthProvider>          // src/auth/AuthContext.jsx — { state: {claims, dbUser}, setState, clear }
  <RootGate>            // src/auth/RootGate.jsx — gates first paint on auth bootstrap
    <App />             // hash router + the big route switch
```

CSS is imported once, in order, in `main.jsx`:
`styles.css → scribe.css → app-extra.css → sprints-06-10.css → sprints-11-15.css`.
**Later files override earlier ones** — put new rules in the file matching the feature
era, or `app-extra.css` for cross-cutting tweaks.

---

## 3. Architecture

### Backend services (`src/api/services.js`)
The platform is **split into multiple services**, NOT one monolith. Base URLs come from
`.env` (`VITE_*_SERVICE_URL`), defaulting to localhost ports:

| Key | Default | Responsibility |
|---|---|---|
| `auth` | :8000 | login/refresh, `/auth/me`, admin users, audit |
| `asr` | :8001 | batch transcription jobs |
| `dictation` | :8002 | **live dictation WebSocket** (section-aware ASR) |
| `core` | :8003 | patients, encounters, consents, anamnesis, notes, scribe |
| `nlp` | :8005 | NLP/autocomplete helpers |
| `report` | :8006 | reports + templates (create/draft/finalize/pdf) |
| `autocomplete` | :8007 | ghost-text + pill suggestions |
| `signing` | :8008 | Дія / KEP signing, signed PDFs, verify |
| `generation` | :8009 | Layer C inline generative completion (S15) |
| `notification` | :8004 | notification feed, WebSocket push, preferences (S12) |
| `evidenceRetrieval` | :8011 | `POST /retrieve` — hybrid corpus/web retrieval (EVA-S03) |
| `evidenceAnswer` | :8013 | the answer API (EVA-S04) — no client yet |
| `evidenceWebsearch` | :8014 | web-search connector (EVA-S08) — no client yet |

**Not in the table, deliberately:** evidence-ingest (:8010) is operator-only — CLI plus a
service-token ops API bound to 127.0.0.1. The SPA never calls it, `services.js` says so where
an entry would otherwise be added by reflex, and a unit test fails if one appears.

In production all point at the **same same-origin gateway**. Endpoints are **flat — no
`/api/v1` prefix** on most services (report-service uses `/v1/...`).

### API client pattern
- `src/api/client.js` — the `fetch` wrapper (auth header, error shaping).
- One file per domain in `src/api/` (`reports.js`, `templates.js`, `signing.js`,
  `patients.js`, …). Each exports plain async functions returning parsed JSON.
- **No global store** (no Redux/Zustand/React Query). Data loading uses the tiny
  `useAsync(fetcher, deps, { enabled })` hook (`src/api/useAsync.js`) → `{ data, loading,
  error, reload }`. Cursor pagination: `useCursorPages.js`.
- **No mock data anywhere.** Every screen must render explicit **loading / empty / error**
  states (`DataStates.jsx`, `ApiErrorView.jsx`, `Empty`). If a backend endpoint isn't
  deployed, show empty/error — never fabricate.

### Auth & permissions
- `useAuth()` → `{ state, setState, clear }`; `state` is `null | { claims, dbUser }`.
  - `claims`: `{ sub, tid, scope, iss, roles: string[], mfa }` (from the verified token)
  - `dbUser`: `{ email, display_name, role, status, mfa_enrolled_at, last_login_at }`
- `useClaims()`, `hasAnyRole(claims, roles)` (`AuthContext.jsx`).
- Route/role guards: `RequireAuth`, `RequireRole` (`src/auth/RequireRole.jsx`).
- Page-level permission checks: `usePermission(action, target_kind)` — note **both** arguments
  (`src/auth/permissions.js`, table in `src/auth/roles.js`).
- Roles seen: `clinician`, `tenant_admin`, `auditor`, `nurse`, and since EVA-S01
  `knowledge_admin` (evidence-corpus curator — **not** an admin; its whole authority is
  `evidence.corpus.manage` + `evidence.domains.manage`). All data is **tenant-scoped**
  (RLS) — a 404 may mean "another tenant's row", never say "forbidden" on a 404.
- The `MATRIX` mirrors `docs/auth/permissions.csv`, a **verbatim vendored copy** of the
  backend's file. Two guards, both in CI: `npm run auth:permissions -- --check` (copy vs
  backend) and `src/auth/permissionsDrift.test.js` (CSV ↔ MATRIX, both directions, with an
  explicit alias map for the legacy `reports.read`/`report.read`-style divergences and an
  `UNMIRRORED` list for backend actions the UI deliberately does not gate on). Adding a
  backend action without deciding which of those two it is fails the build.
  Details: [`docs/auth/roles.md`](docs/auth/roles.md).

### Evidence contracts typegen (EVA-S01)

The evidence work has **no hand-written types and no hand-written permission strings**. Both
come out of one pipeline, and the point of the sprint was to make bypassing it fail loudly.

```
evidence-backend/docs/api/evidence-contracts/*.schema.json
        │  packaged by backend CI as evidence-contracts-{sha}.tar.gz
        ▼
scripts/contracts-typegen.mjs  ← pinned by contracts.pin.json (sha, artifact name, base URL)
        ▼
src/types/evidence.d.ts        AnswerEnvelope, Segment, SegmentKind, Citation,
                               PatientSnapshot, PatientFact, ClinicalIntent, FollowUp,
                               CheckResult, AnswerProvenance, EvidencePassage, …
                               + EvidenceAction / EvidenceTargetKind, generated from the
                                 evidence.* rows of docs/auth/permissions.csv
src/types/evidence.usage.ts    compile fixture referencing every exported type
```

- **Both generated files are committed**, so a checkout builds with no backend present. Both
  carry a `GENERATED — do not edit` header, and `npm run contracts:check` rejects a hand edit
  exactly as it rejects a stale file.
- **Schema resolution order**: `EVIDENCE_CONTRACTS_TARBALL` → `.contracts-cache/<artifact>`
  (gitignored) → download from `EVIDENCE_CONTRACTS_ARTIFACT_URL` / `contracts.pin.json`
  `artifactBaseUrl` → `EVIDENCE_CONTRACTS_DIR`, else the sibling `../dictate/evidence-backend`
  checkout. That last one is the dev path and is **unpinned**; `--require-artifact` (what CI
  passes) refuses it, so a release cannot be cut against someone's local edits. Anything
  missing is a hard exit(1) with the reason printed — the pipeline never stale-compiles.
- **Changing the types** = bump `sha` in `contracts.pin.json`, `npm run contracts:types`,
  commit the result. There is no other supported edit.
- **`artifactBaseUrl` is still null**: the backend artifact is not published anywhere this
  repo can fetch it. Until a URL exists, the CI contracts job compiles the committed types and
  emits a `::warning` saying the regeneration check did not run. Setting the repo variable
  `EVIDENCE_CONTRACTS_ARTIFACT_URL` closes that gap and needs no code change.
- **The convention** (module README: [`src/types/README.md`](src/types/README.md)): import
  contract shapes, never restate them. `evidence/no-handwritten-contract-types`
  (`eslint-rules/`, `npm run lint:contracts`) errors on a local `interface Segment` or
  `@typedef {{…}} Segment`; the `import("../types/evidence").Segment` alias form is fine. The
  rule reserves the composite shapes and the closed enums, not the scalar leaf aliases
  (`Text`, `Id`, `Message`) — reserving those app-wide would be unlivable.
- **Envelopes are immutable.** Reducers copy; nothing mutates a segment or citation in place,
  so the generated `readonly`-ish shapes stay honest across the S03+ screens that share them.
- **Segment-kind i18n keys are reserved, not invented**: the `SegmentKind` enum value *is* the
  key suffix (`kind.evidence`, `kind.patient_fact`, …). Comment block at the top of `STRINGS`
  in `src/i18n.js`.
- **CI**: `.github/workflows/evidence-contracts.yml` — the repo's first workflow, deliberately
  narrow (contracts, permissions mirror + lint, unit, flag-off invisibility). It also runs a
  negative control: typegen with an impossible pin **must** exit non-zero.

### Evidence corpus fixtures (EVA-S02)

`e2e/fixtures/corpus/` is **the** mock corpus — 12 documents, 13 versions, 42 passages, 6 cached
web pages. Every later route-mocked evidence suite reads it instead of inventing passages, so one
corpus with one set of metadata shapes sits behind all of them. Full detail:
[`e2e/fixtures/corpus/README.md`](e2e/fixtures/corpus/README.md).

- **Validated against the generated contracts.** `corpusFixtures.test.js` parses
  `src/types/evidence.d.ts` and checks every row field by field — unknown keys, missing required
  keys, wrong primitives, values outside a closed enum — plus an **edge-state inventory**: every
  licence class / tier / authority / connector kind / trust tier, a retracted document, a
  superseded pair, an expired document, table passages in both scripts, ≥30% of passages in each
  script. Losing one of those in a regeneration is what the inventory exists to catch.
  (Why not `tsc`: TypeScript widens JSON string values to `string`, so `"national"` is not
  assignable to `SourceAuthority` and the compile check cannot be written at all.)
- **Content mirrors what the backend ingests**: section paths and prose from
  `evidence-ingest/tests/fixtures/generate_fixtures.py`, canonical ids from
  `evidence-backend/eval/seed/judgments.jsonl`, licence classes from `docs/corpus/licenses.md`.
  An FE mock and a backend eval run therefore name the same documents.
- **They were authored, not exported.** `scripts/export-corpus-fixtures.mjs` works but needs a dev
  backend with an ingested corpus, which exists only on a developer's machine. Run it when one
  does; the shape test says whether anything was lost. It reads Postgres (ADR-0003: OpenSearch is
  a projection) and deliberately keeps what `/retrieve` hides — retracted documents and superseded
  versions — because those are states later screens must render.
- **Nightly, not on PRs**: the regeneration smoke needs that backend, so it runs on the schedule
  and is skipped (loudly) until `EVIDENCE_DB_URL` is configured. Hermetic CI reads the committed
  files.
- `web-pages.json` is never exported — cached web results are not corpus rows (no table for them
  in migrations 0067/0068). Hand-edited.

**Deferrals recorded by S02**, so nothing is silently postponed:

| Deferred | To | Meanwhile |
|---|---|---|
| Corpus administration UI (`evidence.corpus.manage`, `evidence.domains.manage`) | S12 knowledge-admin portal | CLI only — `evidence-backend/docs/runbooks/evidence-ingest.md` |
| Retrieval screens | S03 | — |
| Ukrainian corpus terminology sign-off | before S03 ships strings | words fixed in `src/i18n.js`; **clinical review outstanding** |

`evidence-ingest` (:8010) is **internal-only** — operator CLI plus a service-token ops API bound to
127.0.0.1. The SPA never calls it, and `src/api/services.js` carries a comment saying so where an
entry would otherwise be added by reflex.

### The evidence module (EVA-S03)

One boundary: `App.jsx` hands every `#/evidence/*` path to
`src/components/evidence/EvidenceRoutes.jsx` and knows nothing else — no screen imports, no
per-screen branches, no flag checks. Adding a screen is a line in that route table. Full
detail: [`src/components/evidence/README.md`](src/components/evidence/README.md).

| Route | Screen | Gate |
|---|---|---|
| `#/evidence` | Quick Search — ask + streamed answer | `FEATURES.evidence` + `evidence.ask` |
| `#/evidence/answers/:id` | the same screen, reopened from an id | same (ownership is the server's) |
| `#/evidence/history` | the asker's own questions | same |
| `#/evidence/dev` | devtools index | `FEATURES.evidenceDevtools` + `tenant_admin` |
| `#/evidence/dev/retrieval` | retrieval playground | same |

Two independent route families behind two independent flags — a build can ship the clinician
surface with the devtools off (production) or the devtools alone (a developer's machine).
The clinician role list is **read out of the permission MATRIX** (`evidence.ask` → clinician,
nurse, tenant_admin), never hand-typed, so it cannot drift from `docs/auth/permissions.csv`.

**Nav.** The existing sidebar "Доказова база / Evidence" group now carries up to four rows and
each half brings its own gate: *Запит* (`#/evidence`) and *Історія* (`#/evidence/history`) when
`FEATURES.evidence` **and** `evidence.ask`; *Платформа* / *Агенти* (`#/chat`) when the chat
module's settings toggle is on. Neither implies the other, and with both off the group is absent.

**Two gates, in this order**: the flag decides whether the routes *exist* (off ⇒ the ordinary
404, byte-identical to any unknown path); the role gate decides who may open one that does.
Flag first, deliberately — "forbidden" would confirm the route exists.

The flag is build-time (`VITE_FEAT_EVIDENCE_DEVTOOLS`, default off everywhere). `services.js`
also honours a **DEV-only** `localStorage` override (`mdx.flag.evidenceDevtools`) so one
Playwright run can prove both states; `import.meta.env.DEV` guards it, so it is dead code in a
production build.

**The pattern every later evidence screen copies** — api module + `useAsync` + shared
DataStates, with derivation in pure siblings:

- **Submitted params, not live form state.** Editing the form does not refetch; Retrieve
  builds a new body object, which `useAsync` keys on (and which arms its stale-response
  guard). Retrieval runs an embedding model — a request per keystroke is a load test.
- **`useAsync` already keeps the last good `data`** through the next request and through a
  failure, so the previous result stays on screen with an "updating…" line. No second copy in
  component state.
- **Pure siblings hold every decision** (`filtersModel.js`, `connectorMeta.js`,
  `passageView.js`), which is why "does this filter reach the wire?" is a `node --test`
  assertion, not a Playwright run.
- **Value lists that mirror a contract union** (`SOURCE_KINDS`, `AUTHORITIES`,
  `CONNECTOR_STATUSES`) are asserted equal to the generated union, so a connector kind the
  backend adds cannot silently go unoffered.
- **`degraded` is not an error.** It renders as a banner above real results, naming the
  connectors that did not answer. `retrieval_unavailable` (503) is the error state, with retry.
- **Devtools are en-only and unaudited**, both recorded as exceptions in the module README.

### Feature flags (`services.js` → `FEATURES`)
Flip via `.env` only once the gating backend is deployed AND CORS-reachable
(`VITE_FEAT_TEMPLATES`, `_REPORTS`, `_PATIENTS`, `_NOTES`, `_ANAMNESIS`, `_MFA_ENROLMENT`).

---

## 4. Routing

**Hash router**, hand-rolled in `src/App.jsx` — a big `if/else` chain on
`const r = route` (from `location.hash`). Navigate with `navigate(path)` which sets
`location.hash`. `navigate` is **not** passed everywhere; many pages use the global hash
or receive `navigate` as a prop. Each branch sets `view` + `crumbs`.

Route map (current):

| Path | Page |
|---|---|
| `/welcome`, `/`, `/features/*`, `/product/*`, `/legal/*` | marketing (`LandingPage`, `ContentPage`) |
| `/login`, `/signup`, `/mfa`, `/verify/*` | auth |
| `/dictate` | **DictationStudio** (the core screen) |
| `/dictate/conversation?patient=&encounter=` | **ConversationRoom** (S14) — two-voice consultation on protocol v2; needs a `recording` consent; finalize → draft → `/dictate/studio?report=` |
| `/dictate/reports`, `/dictate/reports/{id}` | Reports list + detail |
| `/dictate/templates` | TemplatesPage |
| `/scribe`, `/scribe/consult/*`, `/scribe/patients/*`, `/scribe/notes/*`, `/scribe/review/*` | ambient scribe + EHR |
| `/asr`, `/asr/jobs`, `/asr/jobs/{id}`, `/asr/new` | batch ASR |
| `/profile` | **ProfilePage** (user-facing, added this session) |
| `/me` | MePage (token/claims inspector — dev/identity view) |
| `/settings` | SettingsPage |
| `/admin/users`, `/audit/events`, `/audit/verify` | admin/audit (role-gated) |
| `/forbidden` | 403 |

---

## 5. Directory map

```
src/
  App.jsx            # hash router + route switch + app shell
  main.jsx           # providers + CSS imports
  i18n.js            # STRINGS{uk,en} + I18nProvider/useI18n (see §6)
  api/               # one file per backend domain + useAsync/useCursorPages + services.js
  auth/              # AuthContext, RequireRole, permissions, RootGate
  components/        # shared UI + big feature components (Studio, Reports, NoteEditor, SigningFlow…)
    UI.jsx           # Icon set, Sidebar, TopBar, Empty, SaveStatus, Modal, Toast, Logo
    Sidebar.jsx      # left nav + account menu (Profile/Settings/Audit/Sign out)
    Studio.jsx       # Dictation Studio (see §7)
    TipTapEditor.jsx # section-aware rich editor
    ReportPreview.jsx# written-report preview + draft-PDF print (added this session)
  pages/             # route-level pages (Settings, Profile, Me, Admin, Audit, Login…)
    marketing/       # public content pages
  extensions/        # TipTap nodes/marks (SectionExtension, LowConfidenceMark)
  dictation/         # voiceCommands.js (client-side command matching)
  paste/             # sanitizingPaste.js
  *.css              # styles.css (base+tokens), scribe.css, app-extra.css, sprints-06-10.css, sprints-11-15.css
scripts/integration/ # batch-a-verify.mjs (live contract check)
```

---

## 6. Conventions & gotchas (read before editing)

- **Bilingual everything (uk/en).** The app has `I18nProvider`/`useI18n()` with a `STRINGS`
  table, **but 99% of code uses inline ternaries**: `lang === "uk" ? "…" : "…"`, often via a
  local helper `const T = (uk, en) => (lang === "uk" ? uk : en)`. Follow the surrounding
  file. Template/section names are bilingual objects: `name.{uk,en}` — resolve as
  `name[lang] || name.en`.
- **Client-side prefs live in a `tweaks` store**, not localStorage. `useTweaks(defaults)`
  (`components/TweaksPanel.jsx`); applied to `<html data-theme/data-density>` + `--accent`
  in `App.jsx`. Keys: `theme, lang, density, accent` (+ Settings page adds more, read with
  inline fallbacks). **`TWEAK_DEFAULTS` in `App.jsx` is wrapped in `/*EDITMODE-BEGIN*/…END`
  markers owned by a dev edit-mode tool — don't hand-edit inside them.** `tweaks` is
  in-memory (resets on reload).
- **Per-user template favorites/usage** are interim **localStorage** (`api/templatePrefs.js`,
  keys `mdx.tpl.stars.v1` / `mdx.tpl.usage.v1`) standing in for a future backend. Used by
  both the Studio template picker and TemplatesPage.
- **Design tokens**: colors/spacing are CSS vars in `styles.css` `:root` (light) + a dark
  block. Use `var(--surface|surface-2|line|text-1|text-2|text-3|muted|accent|accent-soft|
  accent-text|rec|warn|warn-soft|ok|dictate|dictate-soft|shadow-1..3|radius*|mono)`. Don't
  hardcode hex. `--rec` is the recording-red; there's no `--danger` (use `--rec` or a fallback).
- **Icons**: inline SVG set in `components/UI.jsx` `<Icon name=… size=… />`. `fill` passes
  through (`fill="currentColor"` for filled states, e.g. the star). Add new glyphs to the
  `paths` map there.
- **TipTap document model**: the editor renders **section nodes** (`extensions/
  SectionExtension.js`) — no bare paragraphs at root. `body` is a flat `{ [sectionId]: text }`
  object; convert with `bodyToDoc(template, body, lang)` / `docToBody(doc)`
  (`TipTapEditor.jsx`). Section titles render from the `data-section-title` attr via CSS
  `::before`.
- **Hooks order / TDZ**: `App.jsx` and `Studio.jsx` are large single functions — define
  `useCallback`s **after** the state/values they list in deps, or you'll hit "cannot access
  before initialization" at render (the dep array is evaluated eagerly).
- **Modals** use `.modal-overlay/.modal` with stop-propagation; the report preview uses its
  own `.report-preview-*` classes.

---

## 7. The Dictation Studio (the core screen)

`src/components/Studio.jsx` — grid layout `left (260) | center (1fr) | right (320)`:
- **left** `SectionNav`: template picker (search + ⭐ starred filter), progress bar, section
  list with `●/◐/○` fill indicators + required `!` + word counts.
- **center**: `EditorToolbar` (patient + save status) → **`DictationStatusBar`** (shows the
  active section + a pulsing red dot while the mic is live) → `TipTapEditor` → `StudioFooter`
  (draft-PDF + **Complete dictation**).
- **right**: `MicCard` (mic state + level meter + uk/en switch), suggestions, voice-command
  reference, autocomplete settings.

**Dictation flow:** Web Speech (`useSpeechRecognition`) → `onFinalCb` checks voice commands
(`dictation/voiceCommands.js`), else appends to `body[activeId]`; low-confidence (<0.55) text
wraps in `[[…]]`. Live section-aware ASR goes over the **dictation WebSocket** when running.
**Autosave**: 1200 ms debounce → `createReport` (first) / `updateReport` draft PUT (optimistic
lock via `expected_version`/`version_number`, tracked in `reportIdRef`/`reportVersionRef`).

**Complete dictation** (`completeDictation`): pauses mic → `saveDraft()` → opens
`ReportPreview` (the written report). From there: back to editing, **Download PDF (draft)**,
or **Sign report** (→ `SigningFlow`). Signing: Дія QR poll **or** local KEP (download unsigned
PDF → sign locally → upload). Report statuses: `draft | final | signed | amended`.

**Draft PDF** is currently **client-side** (`ReportPreview.downloadDraftReport` opens a
print window with a diagonal "DRAFT" watermark + "NOT SIGNED" banner → browser Save as PDF).
The server-rendered watermarked PDF is a backend task (see §9).

---

## 8. Recent changes (this session)

### EVA-S01 — contracts typegen & permission mirror (branch `evidence`)

Plumbing only; **no screens, no routes, no nav**. See § "Evidence contracts typegen" above for
how the pipeline works, and `docs/auth/roles.md` for the permission rows.

- `scripts/contracts-typegen.mjs` — artifact-first resolution (pinned by `contracts.pin.json`),
  `--check` / `--require-artifact`, loud failure on anything missing. Emits
  `src/types/evidence.d.ts` (156 types) **and** `src/types/evidence.usage.ts` (the compile
  fixture), both committed. `tsconfig.contracts.json` compiles them under `strict`.
- `src/auth/roles.js` — nine `evidence.*` actions over `evidence` / `evidence_corpus`, the
  `knowledge_admin` role (`KNOWLEDGE_ROLES`, `isKnowledgeAdminOnly`), `MATRIX` and
  `EVIDENCE_ACTIONS` now exported. `docs/auth/permissions.csv` replaced with the backend's
  verbatim copy (the old 17-row file was a pre-S14 hand summary that no test read).
- `src/auth/permissionsDrift.test.js` — the drift test. Proven both directions on a scratch
  branch: deleting a mirrored evidence row fails 5 assertions; flipping one CSV `allowed`
  cell, or adding an unmirrored `evidence.*` action to the CSV, each fail exactly one.
- `eslint-rules/no-handwritten-contract-types.js` + `eslint.config.js` (the repo's first lint
  config — one rule, deliberately) + a test whose last case plants a violating file in
  `src/chat/`, lints it with the real CLI, and asserts the build fails.
- `e2e/evidence-flag-off.spec.js` — route probe over five `/chat` paths + sidebar nav
  snapshot, with a flag-on control so "invisible" cannot pass by being broken.
- `src/i18n.js` — reserved `kind.*` key namespace comment. `src/types/README.md` — the
  type-usage convention. `.github/workflows/evidence-contracts.yml` — CI.

### EVA-S04 — Quick Search: the first clinician evidence surface (branch `evidence`)

Ask a clinical question, watch a segment-typed answer stream in with corpus and web citations,
reopen it later from history. See § "The evidence module" above for routes, nav and gates.

**The pieces, and where each decision lives**

- `src/api/evidenceAnswers.js` — `createAnswerStream` / `getAnswer` / `listQuestions` /
  `getSuggestions`, plus the **pure** `buildAskRequest`. `src/api/sse.js` — an SSE frame parser
  written as a pure state machine (chunk splits, CRLF, multi-line `data:`, comment keepalives),
  so a byte stream's awkward parts are `node --test` assertions rather than clinic discoveries.
- `client.js` gains **`streamAt`** (§ "streaming addendum"): the same in-memory bearer and
  single-flight refresh as `apiAt`, stopping one step earlier and returning the live `Response`.
  **Not `EventSource`** — it cannot set a header, so authenticating a stream with it means a
  cookie (there is none) or the token in a query string, where every proxy logs it.
- `components/evidence/answer/segmentKinds.js` — **THE kind→style table (rule FE7)**. Every
  later evidence surface imports this; a second copy is how a hedge ends up looking like a
  finding on one screen and a warning on another. Data, not a `switch`, because the clipboard
  formatter and the drawer need the same labels without importing React.
- `answerEnvelope.js` — the stream reducer. Pure, and the whole reason the two hard properties
  are testable: events arrive **out of order** and **duplicated**, and both are absorbed by
  identity (segments by `segment.id`, sources by `id`, checks by `rule_id`) rather than by
  ordering. `envelopeFrom` / `stateFromEnvelope` are inverses, which is what makes a streamed
  answer and a reopened one **one render path**.
- `sourceView.js` (citation numbering, grouping, `webHref`), `copyAnswer.js` (copy-as-text),
  `history/historyView.js` (row model) — the rest of the decisions, all pure.
- Components: `ask/{QuickSearchPage,AskBox,SuggestionChips}`,
  `answer/{AnswerView,useAnswerStream,SegmentRenderer,CitationChip,SourceListDrawer,
  WebSourceBadge,EvidenceBadge,UnverifiedBanner,DeflectionCard,AnswerActions}`,
  `history/HistoryPage`. A **FollowUp slot is reserved** in `QuickSearchPage` between the ask
  box and the answer — `envelope.followups` is already populated, S05 fills the seam.

**Three rules worth knowing before changing anything here**

1. **Citation numbers come from `sources[]` order, and `source` events carry an `index`.**
   Numbering by arrival would make `[1]` mean whichever connector won the race, and a reopened
   answer — which gets the service's canonical order — would renumber every citation in a
   document a clinician may already have pasted into a note. Regression-tested.
2. **A drop is recovered by re-reading, never by re-asking.** Asking again spends the pipeline's
   slot and can return a *different* answer to the same question. That is why `meta` (carrying
   `answer_id`) is the first event the service must send, and why `GET /answers/:id` has to
   serve both reopen and resume. A stream that fails after opening is classified as a drop
   whichever way it fails — a clean close with no terminal event, or a killed socket that makes
   the pending read throw.
3. **A deflection is not an error.** The pipeline ran and declined. Its own card, its own voice,
   `role="status"` with focus moved to it, and **no retry button** anywhere near it.

**Flags** (`.env.example`, all default false): `VITE_FEAT_EVIDENCE` — the surface itself;
`VITE_FEAT_EVIDENCE_SUGGESTIONS` — the `/suggestions` question bank; `VITE_FEAT_EVIDENCE_EXTERNAL_LINKS`
— whether a web citation may be an `<a>` at all. With external links off there is **not one
outbound anchor** in the module (asserted page-wide, not per-component); the source still shows
its domain, trust tier and access date, and a disabled "cached copy" slot stands where the link
would be, for S08 to fill. All three honour the DEV-only `localStorage` override so one
Playwright run can exercise both states.

**i18n**: 83 keys in uk and en (more than the ~40 estimated — the contract enums need their own
labels). The six kind labels follow the EVA-S01 convention exactly: the key suffix **is** the
contract enum value (`kind.evidence`, …), and so do `tier.*`, `authority.*`, `trust.*`,
`answer_status.*`. Other languages fall back to English per the `LANGS` convention.

**Tests**: 44 unit assertions in `src/components/evidence/answer/answer.test.js` — shuffled and
duplicated event streams, the kind table against the generated `SegmentKind` union, the copy
formatter, the SSE parser, request shapes, and a static scan proving every key the screens ask
for exists in **both** uk and en. E2E `evidence-quicksearch.spec.js`, 31 cases, driven against a
**real SSE server** (`e2e/helpers/sseServer.js`) rather than a route mock — `route.fulfill`
delivers a body atomically, which would exercise none of the shimmer, the in-flight lock, the
late-source chip or the mid-stream drop while passing.

**`node --test`, not Vitest.** The spec named Vitest; this repo's unit net is plain `node --test`
and the evidence module's rule since S03 is that decisions live in pure siblings that need no
runner and no JSX transform. Adding a second framework for one sprint would have cost the
consistency that makes the rule work. Rendering is Playwright's job.

**Fixed on the way through** (each found by a test, not by inspection):

- `useAnswerStream` had a `mountedRef` that was only ever *cleared* on unmount — after React 18
  StrictMode's throwaway mount cycle it stayed false forever and every stream event was
  discarded. Symptom: a permanent shimmer.
- The drawer's focus trap filtered candidates with `offsetParent !== null`, which is always null
  inside a `position: fixed` panel — the node list came back empty and Tab walked straight out.
- Sidebar `NavLink` rendered no `href` and no `data-path`, so every *"the nav carries no link to
  X"* assertion in the suite matched nothing and passed for the wrong reason. It now carries
  `data-path`.
- `fetchPlatformHealth` and `useServiceHealth` probed **unconfigured** services: `SERVICES.evidenceChat`
  is deliberately blank in most deployments, and `/readyz` against a blank base resolves to the
  SPA's own origin, answers with index.html, and reads as "not serving" — a permanent phantom
  outage in the owner console. Both now skip blank bases.
- `company-console.spec.js` hard-coded "7 feature flags" and `companyMocks.js` a frozen port
  list; both now derive, so the next service or flag does not fail the console specs.

**Accessibility (AC-S04-F-6)**: axe clean over `.evd-page` on the answered screen, the drawer,
and history in both states. Two contrast fixes were needed and made: the kind labels and the
`[n]` citation markers now use `--accent-text` rather than `--accent` (3.97:1, under AA at those
sizes), and the module's small print uses `--text-3` rather than `--muted` (4.41:1). A missing
dark-theme `--ok` was added to `styles.css` — it had been inheriting the light value and sitting
at 3.5:1 for every "signed / verified / complete" indicator in dark mode.

> **Platform a11y, NOT fixed here** — two shared components fail AA on every screen in the app
> and are excluded from the module's axe scope rather than silently restyled app-wide:
> `.soon-pill` in the top bar's disabled search (2.68:1), and `.btn.accent`, the primary button
> (white on `--accent` is 4.26:1 in light, and far worse in dark where the accent is a bright
> teal). The fix is `background: var(--accent-2)` plus a dark-theme `color: var(--bg)`; it is a
> visible change to every primary button in the product, so it wants its own decision.

### EVA-S03 — retrieval foundation & dev playground (branch `evidence`)

The module's first data-driven screen. See § "The evidence module" above.

- `src/api/evidenceRetrieval.js` — `retrieve()` plus a **pure** `buildRetrieveRequest(form)`.
  Empty filters are omitted rather than sent as null (a body of eight nulls makes the
  devtools' own request log unreadable); `include_superseded` is always sent, because
  "deliberately off" and "forgot it exists" are different states to debug. `snapshot_id` is
  top-level, not a filter — nesting it would 422 on `additionalProperties`.
- `src/components/evidence/` — `EvidenceRoutes` (the boundary), `EvidenceDevtools`, and
  `dev/{RetrievalPlayground,FiltersEditor,PassageResultRow,ConnectorMetaBar,JsonViewer}` over
  three pure view models. `evidence.css`, all `evd-` prefixed, no new tokens.
- `App.jsx` gains exactly one branch. `services.js` gains three evidence URLs and the
  devtools flag; `.env.example` updated.
- Tests: 37 unit assertions across `evidenceRetrieval.test.js`, `dev/devtools.test.js` and
  `noHardcodedServiceUrls.test.js` (the last fails on a literal host/port, a bare `fetch` in a
  component, or any client for the ingest service). E2E
  `evidence-retrieval-playground.spec.js` — 11 cases over happy path, filter round-trip,
  degraded, `retrieval_unavailable` + retry, empty, stale-while-reloading, JSON inspection,
  form validation, and both gates. Its mock **enforces** the request contract (422 on a
  missing query or a nested `snapshot_id`) rather than accepting anything.
- Flag-off invisibility extended to the three `/evidence/*` paths and re-run.

### EVA-S02 — ingestion-sprint groundwork (branch `evidence`)

Again no user surface: corpus administration is the S12 portal, retrieval screens start in S03.
See § "Evidence corpus fixtures" above.

- `e2e/fixtures/corpus/{documents,passages,web-pages}.json` + `README.md` — the canonical mock
  corpus, with `corpusFixtures.test.js` validating it against the generated contracts and
  enforcing the edge-state inventory (the validator's own rejection paths are tested too).
- `scripts/export-corpus-fixtures.mjs` (`npm run fixtures:corpus`) — regeneration from a dev
  corpus; hard-fails rather than writing an empty fixture set. Nightly CI job added.
- **Typegen fix carried in from S01**: the de-dup dropped later declarations of a repeated type
  *name* even when the definition differed, so `DocumentVersion.version` was typed `string` for an
  integer field and `Chunk.char_start` was nullable when it is not. Clashes are now renamed per
  contract (`DocumentVersionVersion`, `EvidencePassageCharStart`, 15 in total) and printed. This
  is why `evidence.d.ts` grew from 156 to 171 types. The fixture that carries `version: 1` is what
  made it visible.
- `src/api/services.js` — the internal-only note for evidence-ingest (:8010). `src/i18n.js` —
  Ukrainian corpus terminology block (**clinical sign-off outstanding**).

### Earlier

All on branch `dev`, build-verified:

1. **Templates page ⭐ favorites** (`components/TemplatesPage.jsx`, `styles.css`): star on grid
   cards + list rows, "Starred only" filter, starred-first sort. Reuses `api/templatePrefs.js`,
   so it stays in sync with the Studio picker.
2. **Settings page** (`pages/SettingsPage.jsx`, `app-extra.css`): added a **sticky scroll-spy
   side menu** (IntersectionObserver) + new sections (Language & region, Dictation, Notifications,
   Data & privacy, Account & security, About). Backend-dependent actions are disabled "Soon".
3. **Profile page** (`pages/ProfilePage.jsx`, route `/profile`, `app-extra.css`): real identity
   (name/email/roles/MFA/last login) + future fields marked **"Coming soon"**. Sidebar "Profile"
   now → `/profile`; `/me` kept as the token inspector ("Identity" crumb).
4. **Dictation Studio**: visible **section labels** in the editor + **active-section indicator**
   (`DictationStatusBar` + `.is-active`), **"Complete dictation"** button → written-report
   **preview** (`ReportPreview.jsx`), **draft PDF with DRAFT/NOT-SIGNED watermark**. Removed the
   redundant toolbar Export/Sign (moved to footer/preview).

---

## 9. Outstanding backend work

Two task specs live on the **Desktop** (the convention for backend hand-offs, referenced from
the code):

- **`~/Desktop/dictat-dictation-report-backend-task.md`** — report **synthesis** (raw
  dictation → clinical prose via `synthesis_prompt`), `finalize` lifecycle with 422 on empty
  required sections, **server-rendered watermarked draft PDF** (`?variant=draft`), localized
  section labels on report content, session→report linkage + `report.completed` audit event.
- **`~/Desktop/dictat-template-favorites-usage-backend-task.md`** — replace the localStorage
  favorites/usage shim with real endpoints (`/templates/favorites`, `/templates/{id}/favorite`,
  `/templates/{id}/use`). See `api/templatePrefs.js` for the target API shape.

When those land: swap `templatePrefs.js` to the real client, and point
`ReportPreview.downloadDraftReport` at the server PDF.

---

## 10. Where to find things / tips

- **Add a route** → new `else if (r === "/x")` branch in `App.jsx` (import the page, set
  `view` + `crumbs`, wrap in `RequireAuth`/`RequireRole` if needed); add a nav entry in
  `components/Sidebar.jsx`.
- **Add an API call** → new function in the matching `src/api/*.js`, consume with `useAsync`.
- **New icon** → `paths` map in `components/UI.jsx`.
- **Localize a string** → inline ternary on `lang` (match the file's style).
- **A11y/RBAC**: hide write controls for non-permitted roles (`usePermission`) — the backend
  also enforces, the UI just shouldn't offer it.
- **LLM features**: default to the latest Claude model (app standard is Opus 4.x); see
  `api/autocomplete.js` / `nlp.js`.
- **Before finishing any task**: `npm run build` (gate), and for core-screen changes consider
  `npm run e2e`.

_Last updated: 2026-08-07 (EVA-S04). Keep this file current when you change architecture,
conventions, or the route/service tables._
