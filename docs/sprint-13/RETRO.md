# FE Sprint 13 — Retro

## What went well

- **Contract-first paid off.** Pinning the backend shapes in
  `fieldContract.js` (step 01) before any UI meant every later step
  composed validated builders; renderer bugs became null no-ops, never
  422s or corrupted drafts. The fixtures self-validate against the same
  module, so fixture drift is impossible.
- **The grammar as unregisterable code, not convention.** free_text
  being *unregisterable* and `pgm-` chrome being tripwire-contained
  caught a real violation (step 06 hardcoding the confirm selector)
  the same day it was written.
- **createElement primitives → SSR tests under node --test.** The
  no-Vitest/no-RTL constraint turned into full markup/a11y coverage
  without adding a test runner.
- **The live E2E earned its keep immediately**: it caught the
  portal-into-ProseMirror corruption (chip labels absorbed into body
  text) that no unit test could see, and the probe-first approach
  surfaced a live backend 500 on finalize before the demo would have.

## What was hard

- **ProseMirror DOM ownership.** Two invisible failure modes: PM
  parsing injected DOM into content, and PM rebuilding a NodeView
  outside any transaction (React left bound to a detached mount). The
  NodeView slot + MutationObserver re-scan is the durable answer;
  "just portal into the editor" is a trap worth remembering.
- **Spec/stack mismatch.** Step specs assumed TS/RTL/`useAutocomplete`
  names; each step needed an explicit as-built mapping (EXPLORE.md §1)
  — cheap once, but only because the audit did it first.
- **Contract limits shaped UX**: one `source` per section makes
  partial multi-choice confirmation unrepresentable — better to
  document honest semantics than fake per-chip state.

## Follow-ups

- When BE 03–07 land: flip the E2E gates (`E2E_EXTRACTOR`,
  `E2E_S13_FINALIZE`, icd10 auto-gate), wire `applyServerOperations`
  to the live WS `final` consumer, and re-run the full matrix.
- Chase the named backend asks (exclusive flag; finalize-500 finding;
  both diagnosis codes emitted).
- Consider running hermetic suites in CI only, or teach them to
  hard-fail fast when the live stack is up (environmental failures are
  confusing locally).
