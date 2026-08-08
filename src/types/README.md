# Evidence contract types (EVA-S01)

`evidence.d.ts` is **generated**. It is compiled from the evidence-backend
contract schemas by `scripts/contracts-typegen.mjs` and committed, so a
checkout builds without the backend present.

```
npm run contracts:types    # regenerate (writes evidence.d.ts + evidence.usage.ts)
npm run contracts:check    # CI: regenerate to a buffer, fail if the committed file differs, then tsc
```

The build the types came from is pinned in `contracts.pin.json`. Changing the
types means bumping that sha and re-running the generator — never editing the
file. `contracts:check` in CI rejects a hand edit the same way it rejects a
stale one, because from the pipeline's side they are the same failure.

## The convention

**Import contract shapes. Never restate them.**

```js
/** @typedef {import("../types/evidence").AnswerEnvelope} AnswerEnvelope */
/** @typedef {import("../types/evidence").Segment} Segment */
```

```ts
import type { AnswerEnvelope, SegmentKind } from "../types/evidence";
```

A local `interface Segment { … }` or `@typedef {{ … }} Segment` is an ESLint
error (`evidence/no-handwritten-contract-types`, `npm run lint:contracts`).
The rule is not about tidiness: a hand-written copy keeps type-checking green
against last sprint's payload while the wire data moves on, and the first
symptom is a field the UI is certain exists arriving `undefined` in a clinic.

The rule reserves the composite shapes (`interface`s) and the closed enums —
`SegmentKind`, `EvidenceTier`, `EvidenceAction`, … — but not the scalar leaf
aliases json-schema-to-typescript also emits (`Text`, `Id`, `Message`, `Url`).
Reserving names that generic across the whole app would be unlivable.

### Permissions are types too

`EvidenceAction` and `EvidenceTargetKind` are generated into the same file from
the `evidence.*` rows of `docs/auth/permissions.csv`. `usePermission` is
string-keyed at runtime, so the union is the only thing that catches a typo
before it ships as a button that is silently always-denied:

```js
/** @type {import("../types/evidence").EvidenceAction} */
const action = "evidence.context.read";
const may = usePermission(action, "evidence");
```

`src/auth/permissionsDrift.test.js` asserts the union equals the `evidence.*`
keys of the MATRIX in `src/auth/roles.js`, which is itself asserted against the
CSV in both directions. Three files, one vocabulary.

## Immutability

Envelope objects are **treated as immutable**. Reducers copy; nothing mutates a
segment, citation or provenance record in place. The generated types describe
what the backend sent — mutating them makes that description a lie for every
other holder of the same object, and the S03+ screens (thread state, citation
resolution, replay) all read from shared envelopes.

## Files

| File | |
|---|---|
| `evidence.d.ts` | generated contract types + the permission unions |
| `evidence.usage.ts` | generated compile fixture — references every exported type so `tsc --noEmit` fails when one stops resolving. Nothing imports it at runtime |
| `../../tsconfig.contracts.json` | the strict config those two are compiled under. Not a build config: the app is plain JSX built by Vite |
