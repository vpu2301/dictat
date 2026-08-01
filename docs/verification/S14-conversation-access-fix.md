# S14 fix task — a finished conversation must be reachable

Found 2026-07-26 by driving conversation mode end-to-end against the
deployed docker stack (backend repo, `medical-dictation-backend`).

## What the clinician saw

1. The visit runs, the "Recording" indicator is on, audio is stored —
   but **no dialogue text appears while the visit is running**.
2. Afterwards **the recording cannot be opened** from the patient card.
3. **No note is produced** after the visit.

## Root cause (backend — fixed, not a FE bug)

`dictation-service` passed the windower's `asr_models.WordTiming`
objects straight into the wire model's `words: list[TokenTiming]` field.
The two classes are field-identical but distinct, and pydantic v2 does
not coerce one `BaseModel` instance into another, so building the
`Partial` raised `ValidationError`. That exception escaped `_emit_tick`
into `_window_loop`, which ran as a bare `create_task` with no error
path — so the window loop **died on the first partial of every session,
in both protocol versions**, and nothing was logged.

The session kept accepting audio, kept looking healthy, stored its
audio, and finalized an **empty transcript**. That single defect
produced all three symptoms above.

Fixed in the backend repo (`_wire_words()` + a guarded window loop that
fails the session loudly instead of transcribing nothing). Verified
live: same fixture consultation now yields 15 partials / 12 finals with
S1/S2 speaker turns, and 11 persisted segments.

**Nothing in this repo caused symptom 1.** Once the backend is
redeployed, the live transcript renders — `useConversationSession` +
`turns.js` were already correct and match the v2 wire.

## What IS wrong in this repo

### FE-1 — `src/api/scribe.js` calls endpoints that do not exist

```js
const a = (p, init) => apiAt(SERVICES.core, p, init);
getSession(id)       -> GET  {core}/scribe/sessions/{id}
getReviewSession(id) -> GET  {core}/scribe/sessions/{id}/review
saveReview(id, body) -> PUT  {core}/scribe/sessions/{id}/review
```

core-service serves no `/scribe/*` route at all (verified against its
live OpenAPI). So every path that opens a consultation 404s:

- Patient card → **Conversations** tab → `/scribe/consult/{id}`
- Scribe → **Notes** list row → `/scribe/consult/{id}`
- `/scribe/review/{id}` (`NoteReviewPage`)

The transcript really lives on **dictation-service**:
`GET {dictation}/dictate/sessions/{id}` → `{ id, status, language,
transcript[], total_audio_ms, started_at, finalized_at, … }`, where each
conversation segment is
`{ id, text, start_ms, end_ms, avg_confidence, words[], speaker,
speaker_confidence, speaker_role }`.

**Fix:** repoint `getSession` at dictation-service and normalize its
segments into the turn shape `ConsultView` renders.

### FE-2 — `ConsultView` labels every unattributed turn "Лікар"

```jsx
{turn.speaker === "patient" ? "Пацієнт" : "Лікар"}
```

Diarization emits `S1`/`S2`/`UNKNOWN` and the doctor↔patient mapping
**abstains** when the vocabulary signal is weak (by design — see the
backend's mapping-inference honesty rules). Rendering every non-patient
turn as "Лікар" turns an abstention into a false attribution in a
clinical record. Must render three states: doctor, patient, and an
anonymous/unattributed voice.

### FE-3 — the "note" promise is unbacked

`ScribeConsult` shows "Нотатку ще не згенеровано" and a **Review note**
button to `/scribe/review/{id}`, which needs
`session.generatedNote.sections` — i.e. sprint-12 note synthesis, which
**does not exist in the backend repo**. There is no endpoint behind it
and no work item that will fill it this sprint.

What actually produces a document today is `ConversationRoom`'s own
review → **Створити чернетку** → `POST /v1/reports` → the Studio draft.

**Fix:** say that plainly on the consult screen and route the clinician
to the path that works, instead of a button into a 404.

### FE-4 — conversation rows lose their patient + mislabel status

`PatientProfile` navigates to `/scribe/consult/{conv.id}` with no
patient, so the consult header has no context on a deep link; and a
`finalized` session renders the "чернетка" chip.

## Acceptance

- Conversations tab lists finished conversations and opening one shows
  the real transcript with speaker turns (backend now emits
  `kind='scribe'` timeline rows carrying `segments` + `duration_s`).
- A conversation that recorded nothing says so, and does not render as
  a note that failed to generate.
- No screen in the app calls `{core}/scribe/*`.
- Unattributed turns are never labelled "Лікар".
