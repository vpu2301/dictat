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
- Approved consent texts themselves live in the BACKEND repo
  (infra/seeds/consents/*.md) — versioning is v1; any wording change
  is a NEW version there, never an edit.

## S11 carry-overs

- Backend consent enforcement: dictation-service does not yet reject a
  session for missing consent — the FE gate is the only enforcement
  (stated in the step-05 sign-off). Named backend ask.
- Encounter update endpoint + report encounter_id: see
  ~/Desktop/dictat-s11-encounter-backend-asks.md (step 04).
- Diia (QR) signing for consents: the as-built proxy supports
  provider=diia (202 session); the FE consent dialog ships file_key +
  dev scaffold — QR flow reuse from SigningFlow is a follow-up.
