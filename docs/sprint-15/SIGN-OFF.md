# Sprint 15 sign-off — Frontend

Date: 2026-08-02 · Branch `S15` · Repo `dictat` (backend is the separate
`~/Desktop/dictate` repo, whose sprint-15 work is implemented and signed off at
`medical-dictation-backend/docs/signoffs/sprint-15.md`).

Pipeline: EXPLORE (`docs/sprint-15/EXPLORE.md`) → PLAN → CREATE.

## What shipped

| # | Deliverable | Where |
|---|---|---|
| 1 | Layer C client — silent-by-design generation client + `/readyz` feature flag | `src/api/generation.js`, `src/completion/useLayerCFlag.js` |
| 2 | Ghost completion hook (settle pause, mid-sentence gate, staleness budget, 429 pause) | `src/completion/useGhostCompletion.js`, `src/completion/midSentence.js` |
| 3 | Ghost rendering + accept/dismiss keyboard law + touch accept chip | `src/extensions/GhostCompletion.js`, `src/components/TipTapEditor.jsx` |
| 4 | Layer C wiring, telemetry, one-time coach-mark, user toggle | `src/components/Studio.jsx`, `src/completion/CoachMark.jsx`, `src/components/AutocompletePanel.jsx` |
| 5 | Layer C telemetry on the sprint-10 batcher (`source='layer_c'`) | `src/autocomplete/telemetry.js` |
| 6 | Tap-to-hear replay — sentence↔segment alignment, mini-player, honest degradation | `src/replay/{sentences,degraded}.js`, `src/replay/ReplayStrip.jsx`, `src/api/audioClips.js`, `src/components/Reports.jsx` |
| 7 | Search expansion indicator + exact-search toggle + server-owned tips popover | `src/components/Reports.jsx`, `src/search/SearchTips.jsx`, `src/api/reports.js` |
| 8 | Styles | `src/sprints-11-15.css` (sprint-15 block) |

## Decisions worth recording

1. **Layer C got its OWN ProseMirror plugin**, not a reuse of sprint-10's
   `AutocompleteGhost`. Different lifetime (accept-only entry, 2 s staleness),
   different visual grammar (dim italic + `✦`, because this is *generated*
   prose, not a clinic phrase), and a touch affordance Layer A does not have.
   A decoration cannot be saved, undone, exported or serialised into the report
   body — "ghost text never auto-inserts" is not a rule the code follows, it is
   one the code cannot break.
2. **Layer A wins ties.** Layer C is gated on `acVisible.length === 0`: when the
   clinic's own corpus has an answer, the model does not talk over it, and the
   caret never carries two ghosts.
3. **Layer C stays silent until a draft exists.** `POST /v1/completions/inline`
   requires a real `report_id`; inventing one would poison the target of the
   `layer_c.completion.filtered` audit rows. Studio's first autosave mints it,
   so the wait is seconds, and silence beats a fabricated UUID.
4. **No "consecutive 204s ⇒ give up" latch.** 204 is the model's normal answer;
   a streak counter would switch a healthy feature off during ordinary use.
5. **Bare modifiers do not kill the ghost.** "Any other keystroke dismisses"
   excludes Shift/Ctrl/Alt/Meta — pressing Shift is step one of typing a capital
   letter, and killing on Shift-down would delete the ghost half a keystroke
   before the letter arrived.
6. **Replay alignment is honest about its confidence.** Counts match (sprint-14
   conversation drafts carrying `transcript_segment_ids`) ⇒ exact 1:1. Otherwise
   the listing fell back to the whole session transcript, so sentences are
   aligned *by timing* and the player is labelled «приблизний момент». No
   segments ⇒ no affordance at all.
7. **The tips popover has no fallback copy.** ADR-0021's honesty promise is only
   worth anything if the description comes from the engine that runs the query.
   The endpoint failing renders "could not fetch", never invented tips.
8. **`expand` stays off the wire unless it is `false`.** Expansion is the
   server's default; a stray `expand=true` would break pre-S15 backends for no
   benefit.

## VERIFY — real outputs

### Unit — `npm run test:unit`

```
ℹ tests 570
ℹ pass 570
ℹ fail 0
ℹ duration_ms 2122.2725
```

New files in that run: `src/completion/midSentence.test.js`,
`src/autocomplete/layerCTelemetry.test.js`, `src/replay/sentences.test.js`,
`src/replay/degraded.test.js`, `src/api/generation.test.js`,
`src/api/searchExpand.test.js` (+51 assertions).

Two defects were found and fixed by these tests before any UI existed:
`splitSentences` shattered `«…болить.»` into three pieces, and it dropped a
lone `\n` chunk — which would have silently destroyed the line-per-finding
layout of every replayed report. The offsets-rebuild-verbatim assertion is
what caught it.

### E2E — the sprint-15 suites

```
Running 26 tests using 4 workers
  ✓ layer-c-completion.spec.js:54  mid-sentence pause renders a ghost, Tab inserts exactly the completion
  ✓ layer-c-completion.spec.js:82  typing through the ghost dismisses it AND the keystroke lands — nothing is swallowed
  ✓ layer-c-completion.spec.js:98  Escape dismisses; the completion never enters the document
  ✓ layer-c-completion.spec.js:112 a cursor move and a blur each dismiss the ghost
  ✓ layer-c-completion.spec.js:132 an unclaimed ghost expires on its own — irrelevance is a dismissal
  ✓ layer-c-completion.spec.js:144 after terminal punctuation NO request fires
  ✓ layer-c-completion.spec.js:164 tenant flag off ⇒ not one completion request ever leaves the browser
  ✓ layer-c-completion.spec.js:181 204 renders nothing and is not an error state
  ✓ layer-c-completion.spec.js:196 telemetry: shown/accepted ride the batcher with source=layer_c and no corpus ids
  ✓ layer-c-completion.spec.js:220 dismissals are reported with their reason
  ✓ layer-c-completion.spec.js:235 first ghost ever shows the one-time coach-mark, and only once
  ✓ layer-c-completion.spec.js:255 E2E flow: type mid-sentence → ghost → Tab-accept → finalize
  ✓ layer-c-touch.spec.js:38       the inline ↹ chip accepts on tap and reports it as layer_c
  ✓ report-replay.spec.js:84       a reviewed sentence is one tap from its recording, with the speaker named
  ✓ report-replay.spec.js:116      the player never autoplays
  ✓ report-replay.spec.js:131      a non-conversation section aligns by timing and says so
  ✓ report-replay.spec.js:145      410 audio_not_retained renders the honest note, not an error
  ✓ report-replay.spec.js:169      410 audio_erased says deleted — a different fact, a different sentence
  ✓ report-replay.spec.js:181      429 renders a gentle limit message with the server's own window
  ✓ report-replay.spec.js:200      no segments ⇒ no affordance at all (nothing to fabricate)
  ✓ search-expansion.spec.js:70    «ІМ» finds the інфаркт міокарда report, with the expansion shown
  ✓ search-expansion.spec.js:87    the indicator appears ONLY when expansion actually occurred
  ✓ search-expansion.spec.js:104   the toggle round-trips expand=false and says what it did
  ✓ search-expansion.spec.js:131   the tips popover renders the SERVER's copy, not the SPA's
  ✓ search-expansion.spec.js:152   change the fixture content and the popover follows it
  ✓ search-expansion.spec.js:170   an unreachable tips endpoint says so instead of inventing tips

  26 passed (29.1s)
```

### E2E — whole suite

```
14 failed
  auth.spec.js:107 / :146 / :163 / :210
  studio-autocomplete.spec.js:153 / :194 / :208 / :256 / :315 / :336 / :370 / :408 / :480 / :516
18 skipped
126 passed (2.1m)
```

`npm run build` ✔ (416 modules, no errors).

## The 14 failures are PRE-EXISTING — proven, and root-caused

Reproduced byte-identically with every sprint-15 source change stashed
(`git stash push -- src package.json`, run, `git stash pop`): the same 14 tests
in the same two clusters. Neither cluster is touched by this sprint, and the
root cause of each is now known:

1. **`auth.spec.js` ×4** — `.tenant-badge` is no longer rendered anywhere in the
   chrome. The element the §1.6 assertions target was dropped from the layout in
   an earlier sprint; `TenantBadge.jsx` still exists but nothing mounts it.
2. **`studio-autocomplete.spec.js` ×10** — a **real Layer A regression**, not a
   stale test. Sprint 10 mapped sensitivity to min-prefix with
   `{1: 5, 2: 3, 3: 2}`, so the default (medium) queried after **3** characters.
   The later 10–100 % slider rescale (commit `9e0a41b`) replaced that with
   `round(6 − pct/20)`, and the default 50 % yields `round(3.5)` = **4**. Every
   sprint-10 test types a 3-character prefix, so Layer A now stays silent where
   it used to suggest — for users as well as for the suite.
   One-line fix available (floor instead of round, or map 50 % → 3), deliberately
   NOT taken here: retuning Layer A's sensitivity is a product decision outside
   sprint 15's scope, and doing it silently inside this diff would hide it.

## Known limitations (named, not dropped)

- **React StrictMode double-mints one clip in dev.** `ClipPlayer`'s effect runs
  twice on mount under the dev server, so a tap costs two `POST /v1/audio-clips`
  against the 30/hour cap. Production builds do not double-invoke; the unused
  clip's object URL is correctly revoked either way.
- **Layer C is silent on a brand-new draft** until the first autosave returns a
  `report_id` (see decision 3).
- **Replay fetches segment timings per visible section** on opening a report
  (timings + speakers only, no transcript text). Fine at ~5 sections; would want
  a batch endpoint if templates grow much larger.
- **`docs/sprint-15/EXPLORE.md`** records the backend contract as read from the
  as-built code — the backend's sprint-15 work was still uncommitted in
  `~/Desktop/dictate` at the time of writing.
