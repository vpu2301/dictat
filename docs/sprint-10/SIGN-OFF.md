# FE Sprint 10 — Inline Autocomplete UX · Sign-off

Closed 2026-07-08 on branch `S10`. Scope: inline suggestions in the
Dictation Studio editor — ghost text + caret-anchored popup, keyboard
protocol, snippet expansion, client telemetry, degraded modes, per-user
settings — against the as-built autocomplete-service (:8007).

## Step-01 assumptions → verified resolutions

| Assumption | Resolution |
|---|---|
| React 18 + TypeScript + Vite | React 18.3 + **plain JS** + Vite 6.3 — spec's TS modules translated to JS (`src/api/autocomplete.js`, `src/autocomplete/*`) |
| TipTap editor | Confirmed (TipTap 3, section nodes) → ghost-text rendering branch |
| Vitest + RTL | Neither — pure modules via `node --test`, behavior via Playwright (hermetic + live tiers) |
| Playwright E2E | Confirmed |
| Settings page surface | Studio right rail (`AutocompleteSettings`) — the scoped answer; no new settings page |
| Prefs persistence endpoint | None exists → localStorage `mdx.ac.prefs.v1.<sub>` (repo's `templatePrefs.js` pattern) |

## Decisions of record (details in `EXPLORE.md`)

- **Ghost text** = ProseMirror widget decoration at the caret
  (`extensions/AutocompleteGhost.js`); popup caret-anchored via
  `coordsAtPos`; `aria-activedescendant` on the editor element.
- **Suggestion state** lives in one `useSuggestions` hook (Studio) feeding
  ghost + popup + right rail; the editor owns keyboard + the
  one-transaction insert (single undo step, `cursor_offset` honored).
- **As-built contract wins** over the sprint doc where they differ:
  `/slug` snippet triggers (not `.бп`); `shown_only` carries the top
  suggestion's id (roll-up impression counting); blur is a silent clear,
  not `rejected`; `context` never carries `preceding_text`.
- 130 ms debounce · 300 ms render budget (`timeout` telemetry) · LRU memo
  (64×60 s, original request_id) · micro-backoff 3 fails → 15 s ·
  telemetry sink: 2 s/10-trigger flush, 200-cap queue, 30 s circuit,
  keepalive-fetch page-hide flush.

## Test counts (all green at close)

| Tier | Suite | Count |
|---|---|---|
| Unit (`npm run test:unit`) | prefix extraction + telemetry sink | 20 |
| Contract smoke (`npm run verify:autocomplete-contract`, live stack) | wire shapes, extra="forbid", telemetry 204 | 4 |
| Hermetic E2E (`e2e/studio-autocomplete.spec.js`) | steps 02–05 behaviors | 15 |
| Live E2E (`npm run e2e:live:chaos`) | happy/snippet/reject/chaos/toggle vs real backend + SQL telemetry join | 5 |
| Build | `npm run build` | ✓ |

Flake gate: 3 consecutive `e2e:live:chaos` runs green (outputs in the
closing PR). Failure-mode check: breaking the accept insertion turns
live 1 red while the others stay green.

**Live-E2E find (the reason this tier exists):** the first real telemetry
this suite produced fed the backend's first 03:30 roll-up, whose deployed
`autocomplete_bump_phrase_counters` (stale 0037 body) wrote
`last_accepted_at = '-infinity'` for impressions-without-accepts phrases —
asyncpg reads that as a naive `datetime.min` and `recency_boost` 500s
every suggest touching the phrase. The FE degraded silently as designed;
full analysis + fix hand-off:
`~/Desktop/dictat-autocomplete-rollup-infinity-bug.md`.

## Definition of Done — checked

- [x] Suggestions feel instant; typing never blocked, even with the
      backend down (live chaos case + hermetic micro-backoff tests;
      demo: `screenshots/sprint10-{ghost,accept,degraded}-live.png`).
- [x] Accept/reject telemetry flows, joinable by `request_id`
      (SQL-asserted on the real `autocomplete_telemetry` table,
      including memo-served re-shows deduping to one `shown_only`).
- [x] Snippets expand with `cursor_offset` honored (live `/vitals`,
      caret lands inside the first `{_}` placeholder).
- [x] All VERIFY green with output pasted; diff is code.

## Carry-overs (named owners)

1. **Server-side autocomplete preferences** — replace localStorage
   `mdx.ac.prefs.v1.<sub>` when a preferences endpoint lands.
   Owner: backend (A3 hand-off convention); FE swap point:
   `loadAcPrefs`/save effect in `Studio.jsx`.
2. **CI wiring for the live E2E tier** — booting the backend stack in FE
   CI. Until then `e2e:live` is the documented pre-merge manual gate
   (`e2e/README.md`). Owner: frontend.
3. **Alt+1/2/3 discoverability polish** — shortcuts work and render on
   pills; no onboarding hint beyond the popup itself. Owner: frontend.
4. **Dictation-service CORS in the dev stack** — `:8002/readyz` probe
   logs console errors on every Studio mount (pre-existing, unrelated to
   this sprint; filtered in the live spec). Owner: backend.
5. **Roll-up `-infinity` bug** — new migration re-applying the corrected
   0037 function + data heal + defensive `recency_boost`; task file
   `~/Desktop/dictat-autocomplete-rollup-infinity-bug.md`. Owner: backend.
   Blocks the live-E2E flake gate until the dev DB is healed.

Not a carry-over: right-rail suggestion mirroring (shipped — the rail's
`SuggestionsPanel` reads the same hook state).
