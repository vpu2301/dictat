# FE Sprint 10 · Step 01 — EXPLORE: Stack & Editor Audit, Decisions, Contract

Audited 2026-07-08 on branch `S10`, against the live backend
(`~/Desktop/dictate/medical-dictation-backend`, autocomplete-service on :8007).

## 1. Stack audit — assumptions vs reality

| Assumption `[ASSUMED]` | Reality | Consequence |
|---|---|---|
| React 18 + **TypeScript** + Vite | React 18.3 + **plain JavaScript (JSX)** + Vite 6.3 | Spec's `types.ts`/`tsc --noEmit` translate to JSDoc'd JS modules; the build gate is `npm run build` (full module transform) |
| Vitest + React Testing Library | **No component test runner.** Pure modules unit-test via `node --test` (`npm run test:unit`); everything else is Playwright e2e (`npm run e2e`) | Hook/UI behavior is pinned by hermetic e2e (`e2e/studio-autocomplete.spec.js`), pure logic by node tests |
| Playwright for E2E | Confirmed (`@playwright/test` 1.61) | — |
| TipTap editor | Confirmed: **TipTap 3** (`@tiptap/react` 3.23), section-aware since FE sprint 06 | Ghost-text branch of the rendering decision applies |
| State store | None (no Redux/Zustand/React Query) — hooks + `useAsync` | Suggestion state lives in a hook owned by Studio |

Router: hand-rolled hash router in `src/App.jsx`. CORS: backend defaults
allow `localhost:5173/4173` (Vite dev/preview) — verified working.

## 2. Editor identification (the table from §4.1)

| Question | Answer |
|---|---|
| Report editor component | `src/components/TipTapEditor.jsx`, hosted by `src/components/Studio.jsx` (Dictation Studio, route `#/dictate`) |
| Document model | Section nodes (`src/extensions/SectionExtension.js`) — no bare paragraphs at root; `body` is flat `{ [sectionId]: text }`, converted via `bodyToDoc`/`docToBody` |
| Caret position | ProseMirror selection: `editor.state.selection`; text-before-caret = `$anchor.parent.textBetween(0, $anchor.parentOffset)` — see `reportCaretContext` in `TipTapEditor.jsx` (fires on update/selection, null while IME-composing or on range selection) |
| Insertion at caret today | ProseMirror transactions. Dictation appends via `setBody` → doc sync effect; the autocomplete accept reuses the transaction seam directly: `tr.insertText(...)` + `closeHistory(tr)` = ONE undo step (`acceptSuggestion`, `TipTapEditor.jsx`) |
| Current section source | `Studio.jsx` state `activeId`, updated from `onSelectionUpdate` (walk `$anchor` depth to the enclosing `section` node) — feeds `context.field` in telemetry and `context.section_id` in suggest |
| Report language source | `Studio.jsx` `dictLang` (`uk`/`en`, the mic-card switch) → `language` on the wire. UI language is separate (`useI18n()` / tweaks) |
| F-02 API client | `src/api/client.js` (`apiAt`: bearer header + single-flight refresh on 401, RFC 7807 error shaping); per-service base URLs in `src/api/services.js` |

## 3. Rendering-strategy decision

**Editor is TipTap → ghost text + minimal popup** (the expected branch).

Implemented in step 03 as specified: the ghost is a **ProseMirror widget
decoration at the caret** (`src/extensions/AutocompleteGhost.js`) — an
`aria-hidden` `<span.autocomplete-ghost>` in the text flow (side: 1),
inheriting the document's font metrics. Decorations never enter the
document: no undo pollution, nothing to clean on accept. Any doc/selection
change clears the ghost in the plugin's `apply` (stale completions never
survive a keystroke); the React side re-arms it via a meta transaction once
the suggestion hook settles (`addToHistory: false`, so meta churn never
lands in undo). Screen readers get the popup's `listbox`/`option` semantics
plus `aria-activedescendant` managed on the editor's contenteditable
element. When more than one suggestion exists, the Layer B pills popup
lists up to 3, **anchored under the caret** via `view.coordsAtPos`
(viewport-clamped, flips above near the bottom edge; mousedown-accept so
the editor never blurs; rows are `tabindex=-1` — unreachable by Tab).

**Where suggestion state lives:** one `useSuggestions` hook instance in
`Studio.jsx` (`src/components/AutocompletePanel.jsx`) is the single source
for ghost + pills + right rail; the editor owns only the keyboard protocol
and the insert transaction. Enable/disable, source filtering, backoff and
telemetry all hang off that one hook's state.

## 4. Contract module — spec layout → real layout

| Spec path | As-built path |
|---|---|
| `src/features/autocomplete/api/types.ts` + `client.ts` | `src/api/autocomplete.js` — repo convention is one JS client file per domain on `apiAt` (`suggest`, `createPhrase`, `deletePhrase`, `sendTelemetry`) |
| camelCase + `toWire/fromWire` converters | **Not adopted.** The whole repo passes wire snake_case through (`reports.js`, `patients.js`, …); introducing a converter pair for one domain would break the codebase idiom. Whitelisting still holds: `suggest()` builds its body from named fields only (never spreads), and the telemetry sink's `sanitize()` whitelists outbound keys — unit tripwire in `src/autocomplete/telemetry.test.js` |
| `__fixtures__/suggest.ts` | `src/autocomplete/fixtures.js` — real captured responses, curl provenance in the header |
| `__tests__/contract.int.test.ts` | `src/autocomplete/contract.int.test.js` — gated on `RUN_BACKEND_INTEGRATION=1`; run via `npm run verify:autocomplete-contract` |
| `.env.example` `VITE_AUTOCOMPLETE_URL` | Already present as `VITE_AUTOCOMPLETE_SERVICE_URL` (matches the existing `VITE_*_SERVICE_URL` convention), consumed by `src/api/services.js` |
| `suggest(req, signal)` AbortSignal | **Not adopted.** Staleness is handled by a sequence counter (responses for typed-past prefixes are dropped) plus the 300 ms render budget (`SUGGEST_TIMEOUT_MS`); requests are tiny and backend p95 ≤ 80 ms on cache hit — aborting the socket buys nothing the seq guard doesn't |

Two deliberate divergences from this step's §6, recorded here:

- **`context` never carries `preceding_text`.** Step 04's privacy budget
  (as implemented and unit-tested) forbids document text on the wire:
  suggest sends `context: { section_id, template_id }`, telemetry sends
  `context: { field, index? }`. The backend treats `context` as a free
  object, so this is strictly narrower than §6's sketch — kept narrower on
  purpose (medical text).
- **Snippet triggers are `/slug`, not `.бп`.** As-built dispatcher:
  `prefix.startswith("/")` (`suggest.py`), triggers stored slash-less,
  latin slugs. Seeded uk triggers: `/cv`, `/vitals`, `/ecg`, `/plan`
  (`infra/seeds/autocomplete/snippets_uk.json`).
- **`shown_only` CARRIES the top suggestion's id** (step 04's table says
  "none"). Settled from backend source: the roll-up counts impressions as
  `COUNT(*) FILTER (WHERE event_type IN ('shown_only','accepted',
  'rejected'))` grouped by id (`repository.py`), and the wire validator's
  own comment says shown_only carries the top suggestion's id for exactly
  that. Without it, `bayesian_acceptance(impressions, accepts)` never sees
  impressions and ranking cannot learn. `rejected` stays id-less — its
  impression was already logged by the shown_only, an id would
  double-count.
- **Blur is a silent clear, not a `rejected`.** Step 04's table lists
  blur as a reject moment, but its own dedup rule ("silent divergence
  emits nothing beyond its shown_only") describes the intent better:
  `rejected` feeds both ranking and the 3-dismissals backoff, and losing
  focus (toolbar click, window switch) is not a judgment on the
  suggestion. Only Esc / the popup's ✕ emit `rejected`.
- **Step 05's `ac.help.tab_note` copy adapted for truth.** The spec's
  string says "інакше Tab переходить між розділами", but this editor has
  NO section-Tab binding (documented since step 03). Shipped copy:
  "Коли видно підказку, Tab приймає її, Esc — ховає. Без підказки Tab
  працює як зазвичай." Rendered in the voice-command reference
  (`VoiceCommandRef`, Studio right rail).
- **Named follow-up — server-side autocomplete preferences.** Per-user
  prefs (master `enabled`, ghost/pills layers, per-source visibility,
  sensitivity) persist in localStorage `mdx.ac.prefs.v1.<sub>` (the
  repo's interim pattern, same as `api/templatePrefs.js`). When a
  preferences endpoint lands, swap `loadAcPrefs`/the save effect in
  `Studio.jsx` for the real client. Micro-backoff constants:
  `SUGGEST_FAIL_THRESHOLD = 3`, `SUGGEST_FAIL_BACKOFF_MS = 15 s`
  (`AutocompletePanel.jsx`) — judgment-call values, tuned so a dead
  backend costs at most one request per keystroke-burst until the
  third failure, then one per 15 s.

## 5. Backend ground truth (read from source, `~/Desktop/dictate/…`)

- `services/autocomplete-service/src/autocomplete_service/routers/suggest.py`
  — `SuggestionDTO { id, kind, text, completion, source, confidence,
  cursor_offset }`, `extra="forbid"` both ways, `request_id` in the body,
  latency metric paths `hit|miss|degraded|snippet`.
- `routers/telemetry.py` — `event: Literal["shown_only","accepted",
  "rejected","timeout"]`, one event per POST, 204.
- Auth scope for both endpoints: `requires("report.read", "report")` — any
  seeded clinician works (`clinician@tenant-a.example` / `dev-password`).
- Run: `make dev-up && make migrate-up && make seed &&
  make run-auth-service & make run-autocomplete-service` (Makefile targets
  confirmed; corpus seeded by migration `0026_seed_autocomplete_system_corpus.sql`).

## 6. Contract smoke (§4.4) — VERIFY

`npm run verify:autocomplete-contract` against the live dev stack: logs in
as the seeded clinician, asserts the pinned DTO key set on `зад` (≥1
suggestion, `prefix + completion === text`), the `/vitals` snippet
(`cursor_offset` integer), `extra="forbid"` (unknown field → 422), and a
telemetry `shown_only` 204 round-trip. Output pasted in the sprint log;
4/4 pass on 2026-07-08.
