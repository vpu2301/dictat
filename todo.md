# todo.md

## S11 legal copy review (step 05 — consent gate)

The following UA-facing strings encode legal meaning and need
clinical/legal sign-off before pilot rollout. Owner: tenant DPO +
clinic lead (Volodymyr to route); FE owner: this repo.

- `src/patients/ConsentSheet.jsx` — capture sheet intro ("Запис голосу
  обробляється AI-сервісом…"), method labels (Усно/Письмово/КЕП),
  "Пізніше (залишити без підпису)" semantics.
- `src/components/PatientProfile.jsx` — WithdrawConsentDialog
  consequences ("Нові записи… буде заблоковано; вже створені записи та
  звіти зберігаються; відкликання не скасовує обробку…").
- `src/components/Studio.jsx` — gate banner ("Потрібна згода пацієнта
  на AI-запис").
- **S14 conversation mode** — `src/patients/ConsentSheet.jsx`
  `CONSENT_COPY.recording` ("Записується вся розмова — голос лікаря І
  голос пацієнта…"), `src/components/PatientProfile.jsx`
  StartEncounterSheet mode cards ("Записується вся розмова… Потрібна
  згода пацієнта"), and `src/conversation/ConversationRoom.jsx` intro
  ("Покладіть пристрій між собою та пацієнтом…" + the three facts).
  These state what is recorded and are the clinician-facing half of the
  `recording` consent — same review path as the S11 copy above. The
  approved consent TEXT itself is backend-side
  (infra/seeds/consents/recording-v1.md).
- Approved consent texts themselves live in the BACKEND repo
  (infra/seeds/consents/*.md) — versioning is v1; any wording change
  is a NEW version there, never an edit.

### Step 06 additions (privacy admin)

- `src/pages/ErasureRequestPage.jsx` — the consequences enumeration
  (destroyed classes / retained-by-law list, two-person + grace copy)
  and the «ВИДАЛЕННЯ» confirmation wording.
- `src/pages/PrivacyAdminPage.jsx` — approve dialog consequences,
  reject/cancel-during-grace copy, DSAR expiry/expired copy.
- `src/components/PatientProfile.jsx` — DSAR package-contents
  enumeration (must track the backend's actual export manifest).
- `src/patients/legalBasis.js` — the basis→text map (lockstep with
  backend `erasure/fanout.py BASIS_*`; unit-enforced).
- `src/patients/ExecutionReport.jsx` — destroyed/retained kind labels
  (this document is handed to patients).

## S11 carry-overs

- Backend consent enforcement: dictation-service does not yet reject a
  session for missing consent — the FE gate is the only enforcement
  (stated in the step-05 sign-off). Named backend ask.
- Encounter update endpoint + report encounter_id: see
  ~/Desktop/dictat-s11-encounter-backend-asks.md (step 04).
- Diia (QR) signing for consents: the as-built proxy supports
  provider=diia (202 session); the FE consent dialog ships file_key +
  dev scaffold — QR flow reuse from SigningFlow is a follow-up.

## S14 carry-overs (frontend → backend asks)

Found while wiring the first real client of the dictation WebSocket
(the Studio has always run browser Web Speech, so nothing had driven
`src/dictation/wsClient.js` end to end before this sprint):

- **`session_terminated` carries no report id**, and report-service has
  no by-source-session lookup — so a frontend cannot find the draft
  that dictation-service creates at finalize. Combined with the next
  item, that is why conversation sessions deliberately start WITHOUT a
  `template_id` (the documented "clinician creates the report manually"
  path) and the frontend writes the draft itself. Ask: put
  `report_id` on `session_terminated`, or add
  `GET /v1/reports/by-source-session`.
- **No wire channel for a per-TURN speaker correction.** `finalize`
  takes no body and the only v2 client message is
  `set_speaker_mapping`, so a clinician's per-turn ruling can only
  reach the record through a draft the frontend composes. Ask: accept a
  reviewed-transcript payload at finalize (or a
  `set_segment_speaker` client message), so the PERSISTED transcript —
  not just the draft prose — carries the correction. Sprint-12
  synthesis reads the persisted transcript, so today it would ground
  its attribution in the uncorrected labels.
- **Wire `final` has no segment id.** Segment UUIDs are minted at
  finalize, so the frontend reads them back from
  `GET /dictate/sessions/{id}` to fill `transcript_segment_ids`.
  Putting the id on the `final` frame would remove that round-trip.
- **`recording` consent has no capture UI outside this repo** — the
  frontend now captures it (type `recording`, version `v1`). The
  approved text exists (`infra/seeds/consents/recording-v1.md`); DPO
  sign-off on that text is still open per the backend sprint-14
  sign-off.
