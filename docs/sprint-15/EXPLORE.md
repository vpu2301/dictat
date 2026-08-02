# Sprint 15 — EXPLORE (frontend)

## STEP 0 — stack + editor findings (carried from sprints 10/13)

- Stack confirmed: React 18 + Vite 6, TipTap 3 (`@tiptap/react` + `@tiptap/pm`),
  plain JS/JSX (no TypeScript), `node --test` for unit tests, Playwright for E2E.
- **Ghost-text rendering was NOT forced into dropdown mode.** Sprint 10 shipped
  `src/extensions/AutocompleteGhost.js` — a ProseMirror **widget decoration**
  rendered at the caret (`side: 1`), never entering the document. Layer C
  therefore renders as real inline ghost text, not a single-item dropdown.
  Layer C gets its OWN plugin (`src/extensions/GhostCompletion.js`) rather than
  reusing Layer A's: different lifetime rules (accept-only entry, 2 s staleness),
  different visual grammar (italic/generated vs. corpus completion), and a touch
  accept affordance Layer A does not have.
- Sprint 13's hard-won rule still holds: **never portal into the ProseMirror
  DOM**; widget decorations own their slot. The touch chip lives INSIDE the
  decoration span and talks to React through a bubbling custom DOM event, so
  there is no stale-closure or reconciliation hazard.

## Backend contract (read from the as-built code, not a spec)

The sprint-15 backend is implemented (uncommitted) in `~/Desktop/dictate/
medical-dictation-backend`; `docs/signoffs/sprint-15.md` is its sign-off.

### Layer C — `generation-service`, port **8009** (new)

- `POST /v1/completions/inline`, body `extra="forbid"`:
  `{ report_id: uuid, section_key: str(1..64), text_before_cursor: str(1..1000),
     language: "uk"|"en" }`
- `200 → { request_id, completion, model, latency_ms }`
- `204` — no confident completion. **Silence is the normal answer** at every
  gate: feature off, tenant not allow-listed, timeout, backend error, empty, or
  safety-filtered. Never an error state.
- `429` + `Retry-After` — per-user dual-window rate limit.
- Auth: `autocomplete.read` on `phrase` (same permission as suggest).
- `report_id` is a context pointer only (never dereferenced) — but it is
  **required and must be a UUID**, so the FE can only ask once the draft exists
  (Studio's `reportIdRef.current`, set by the first autosave).

### Tenant feature flag surfacing

There is **no bootstrap/config payload**. The flag reaches the FE two ways:

1. `GET /readyz` on generation-service →
   `{"status":"ready","layer_c_enabled":true,"model":"gemma3:1b"}` — unauthenticated
   probe, cheap, cached once per page load.
2. The endpoint's own silent `204` with `outcome=tenant_disabled` when the
   tenant is not in `MDX_LAYER_C_TENANT_ALLOWLIST`.

FE strategy: probe `/readyz` once per page load (shared across editors);
`layer_c_enabled !== true` (or an unreachable service) ⇒ **zero completion
requests ever**.

Deliberately NOT added: a "consecutive 204s ⇒ stop asking" latch. 204 is the
model's *normal* answer when it has nothing confident to say, so a streak
counter would switch a healthy feature off during ordinary use. The allow-list
miss it would have caught is already covered by the deployment-level flag.

### Telemetry — rides the sprint-10 batcher

`POST /autocomplete/telemetry` gained `source: "autocomplete" | "layer_c"`
(default keeps pre-S15 clients byte-compatible). For `layer_c` the backend
**422s any `phrase_id`/`snippet_id`** — completions are not corpus rows.
Events: `shown_only | accepted | rejected | timeout`. `request_id` echoes the
inline-completion response's `request_id`.

### Audio replay — `report-service` (8006)

- `GET /v1/reports/{id}/sections/{key}/audio-clips` →
  `[{ segment_id|null, index, start_ms, end_ms, speaker, speaker_role }]`
  (timings + speakers only, no transcript text). `[]` for batch reports with no
  session. Non-author reads need `?purpose=`.
- `POST /v1/audio-clips` `{ report_id, start_ms, end_ms }` →
  `{ clip_id, clip_url, expires_at_unix }`; `clip_url` is
  `/v1/audio-clips/{id}?t=<token>` (5-min TTL, **still needs the bearer**).
- `GET /v1/audio-clips/{id}?t=…` → `audio/ogg` bytes,
  `Cache-Control: private, no-store`.
- Honest degradation:
  - `410` `{code}` ∈ `no_audio_source | audio_not_retained | audio_erased |
    audio_partially_retained` (+ `clip_expired` on the stream route),
  - `422` span > 60 000 ms ("replay is review, not export"),
  - `429` 30 clips/user/hour (+ `Retry-After`),
  - `403` `clip_link_expired` on a stale token.
- Every created clip writes `report.audio_replayed` to the audit trail.

### Search

- `GET /v1/reports/search` gained `expand: bool = true` and returns
  `expanded_terms: string[]` (empty when nothing expanded or `expand=false`).
- `GET /v1/search/tips?language=uk|en` →
  `{ language, tips: [{ key, title, body }] }` — four tips (no-stemming,
  synonyms, AND-filters, whole-words). **Backend owns the copy**; the FE renders
  it verbatim so it can never drift from search behaviour.

## Audio element strategy

Clips are short (≤ 60 s), single-shot Ogg/Opus blobs fetched with the bearer.
**Native `<audio controls>` is enough** — play/pause + scrub for free, and it
does not autoplay unless told to. No library. The bytes are fetched with an
authenticated `fetch` (the `?t=` token narrows the window, it does not replace
auth) and handed to the element as an object URL, revoked on unmount.

## Reuse inventory

| Need | Reused from |
|---|---|
| debounce + stale-drop + abort | sprint-10 `useSuggestions` idioms (seq counter, budget guard) — Layer C gets its own hook with the same shape |
| telemetry batching | `src/autocomplete/telemetry.js` (`createTelemetrySink`), extended with `source` |
| ghost decoration | `src/extensions/AutocompleteGhost.js` (pattern), new sibling plugin for Layer C |
| keyboard protocol / accept-as-one-transaction | `TipTapEditor.handleAcKeyDown` + `acceptSuggestion` |
| report review screen | sprint-08 `ReportView` in `src/components/Reports.jsx` |
| search screen | `ReportsList` in `src/components/Reports.jsx` |
| blob download with bearer | `downloadReportPdf` in `src/api/reports.js` |
| purpose retry | `getWithPurposeRetry` in `src/api/reports.js` |

## Consequences for the plan

1. Layer A and Layer C must never both render a ghost at the caret. Layer C is
   gated on `acVisible.length === 0` — the corpus knows better than the model
   when it has an answer.
2. Layer C cannot fire before the draft exists (needs a real `report_id`). That
   is a contract fact, not a bug: it is honest to stay silent rather than invent
   a UUID that would poison `layer_c.completion.filtered` audit targets.
3. Replay alignment: 1:1 when the section carries `transcript_segment_ids`
   (conversation drafts, counts match); otherwise a by-timing proportional
   alignment that the UI marks as approximate. Neither case fabricates audio.
