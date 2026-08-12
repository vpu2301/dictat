# Dictat — Medical dictation & ambient scribe (frontend)

Dictat (package name `dictator`) is a voice-first medical documentation platform.
Clinical content is **dictated**, not typed: a clinician records a dictation or a
live consultation, the backend transcribes and structures it, and the clinician
reviews, amends, and e-signs the result.

This repository is the **web frontend** (React + Vite). It talks to a set of
backend microservices over plain `fetch` + a dictation WebSocket. **There is no
mock/demo data layer** — every screen loads from a real API client and renders
explicit loading / empty / error states. Where a backend endpoint is not yet
deployed, the screen shows an empty or error state rather than fabricated data.

---

## Quick start

```bash
npm install
cp .env.example .env      # point the VITE_*_SERVICE_URL vars at your backends
npm run dev               # Vite dev server
npm run build             # production build
npm run preview           # preview the production build (with the production security headers)
npm run verify:bundle     # sprint 16 — assert dist/ ships no dev seam and an enforcing CSP
```

The app boots from `index.html → src/main.jsx → src/App.jsx`.

---

## Architecture

### Backend services

Base URLs are configured in `.env` (see `.env.example`) and resolved in
`src/api/services.js`:

| Service     | Env var                       | Default                  | Responsibility                                              |
|-------------|-------------------------------|--------------------------|------------------------------------------------------------|
| `auth`      | `VITE_AUTH_SERVICE_URL`       | `http://localhost:8000`  | Login, refresh, `/auth/me`, admin users, audit             |
| `asr`       | `VITE_ASR_SERVICE_URL`        | `http://localhost:8001`  | Batch transcription jobs, prompts                          |
| `dictation` | `VITE_DICTATION_SERVICE_URL`  | `http://localhost:8002`  | Live dictation WS, sessions, finalize                     |
| `core`      | `VITE_CORE_SERVICE_URL`       | `http://localhost:8003`  | Clinical/EHR: patients, encounters, consents, anamnesis, notes, reports, templates, signing |
| `nlp`       | `VITE_NLP_SERVICE_URL`        | `http://localhost:8005`  | Text processing, abbreviations                             |
| `autocomplete` | `VITE_AUTOCOMPLETE_SERVICE_URL` | `http://localhost:8007` | Phrase/snippet suggestions, phrase CRUD, usage telemetry |

Keycloak (`VITE_KEYCLOAK_*`) backs the auth realm and the "forgot password"
deep-link only.

### API client layer (`src/api/`)

All network access goes through these modules — components never call `fetch`
directly (except the public `/verify` page).

- `client.js` — `fetch` wrapper. In-memory access token, automatic
  `mdx_rt` refresh cookie, 401 refresh-retry, RFC 7807 `ApiError`. Exposes
  `api()` (auth service) and `apiAt(base, …)` (any service).
- `services.js` — single source of truth for base URLs, the WS base, Keycloak
  config, the build version, and feature flags.
- `useAsync.js` — the hook every screen uses to load data
  (`{ data, loading, error, reload }`), with stale-response guarding.
- Resource clients: `endpoints.js` (auth/admin/audit), `asr.js`, `dictation.js`,
  `nlp.js`, `patients.js`, `encounters.js`, `consents.js`, `anamnesis.js`,
  `notes.js`, `reports.js`, `templates.js`, `scribe.js`, `signing.js`,
  `privacy.js`.

Endpoints are **flat** (no `/api/v1` prefix), matching the backend convention.

`src/components/DataStates.jsx` provides the shared `Loading`, `asList`, and
`LoadGate` helpers used to render loading/empty/error consistently.

### Live dictation pipeline (`src/dictation/`)

- `audioPipeline.js` — mic capture → 16 kHz mono → 20 ms PCM frames + RMS level.
- `opusEncoder.js`, `wireFrame.js`, `frameQueue.js` — Opus encode + binary
  framing for the WS protocol.
- `wsClient.js` — `medical-dictation.v1` WebSocket client (start/pause/resume,
  partial/final messages, token-refresh-on-WS, close-code mapping).
- `voiceCommands.js` — UK/EN voice-command vocabulary (mirrors backend NLP
  intents) + the FE-only `scratch that` fallback and `matchVoiceCommand`.
- `operations.js`, `scratchThat.js` — apply NLP operations / confidence spans.

### Editor (`src/extensions/`, `src/components/TipTapEditor.jsx`)

TipTap section-aware document model with a low-confidence mark, sanitizing paste
(DOMPurify allowlist), floating toolbar, find/replace, ghost-text overlay, and
voice navigation.

---

## Feature map (routes)

Routing is a hash router in `src/App.jsx`.

| Area      | Routes                                                                 | Backed by                                  |
|-----------|-----------------------------------------------------------------------|--------------------------------------------|
| Auth      | `/login`, `/me`, `/mfa`                                                | auth service                               |
| Scribe    | `/scribe`, `/scribe/patients`, `/scribe/patients/:id`, `/scribe/notes`, `/scribe/notes/new`, `/scribe/notes/:id`, `/scribe/consult/:id`, `/scribe/consent/new`, `/scribe/review/:id`, `/scribe/templates` | core service (patients, encounters, consents, notes, scribe sessions) |
| Dictate   | `/dictate`, `/dictate/reports`, `/dictate/reports/:id`, `/dictate/templates` | dictation WS + core (reports, templates)   |
| ASR       | `/asr/jobs`, `/asr/new`, `/asr/jobs/:id`                               | asr service                                |
| Admin     | `/admin/users`                                                         | auth service                               |
| Audit     | `/audit/events`, `/audit/verify`                                       | auth service                               |
| Public    | `/verify/:envelopeId`                                                  | core `/verify` (no auth, no PHI)           |
| Settings  | `/settings`                                                            | local UI prefs                             |

Feature flags in `.env` (`VITE_FEAT_*`) gate sprint features as their backends
ship; defaults are `false`.

---

## Backend endpoints the frontend expects

These are the contracts the API clients call. Implement them backend-side to
light up each screen (shapes are described in the client modules):

- **Patients** — `GET/POST /patients`, `GET /patients/{id}`,
  `GET /patients/{id}/timeline`
- **Schedule / encounters** — `GET /schedule`, `GET/POST /patients/{id}/encounters`
- **Consents** — `GET/POST /patients/{id}/consents`,
  `POST /patients/{id}/consents/{cid}/withdraw`
- **Anamnesis** — `GET/PUT /patients/{id}/anamnesis`
- **Notes** — `GET/POST /notes`, `GET/PATCH /notes/{id}`,
  `POST /notes/{id}/sign`, `GET /note-structures`
- **Reports** — `GET/POST /reports`, `GET/PATCH /reports/{id}`,
  `GET /reports/{id}/versions`, `GET /reports/{id}/versions/{v}`,
  `POST /reports/{id}/amend`, `GET /reports/{id}/pdf`
- **Templates** — `GET/POST /templates`, `GET/PUT/DELETE /templates/{id}`
  (built-in templates flagged with `builtin: true`)
- **Scribe sessions** — `GET /scribe/sessions/{id}`,
  `GET/PUT /scribe/sessions/{id}/review`
- **Signing** — `POST /reports/{id}/signing`, `GET/DELETE /signing/{id}`,
  `POST /signing/{id}/upload`, `GET /signing/certificates`, `GET /verify/{envelopeId}`
- **NLP** — `POST /nlp/process`, `POST /nlp/suggest`,
  `GET/PUT/DELETE /nlp/abbreviations`
- **ASR** — `GET /asr/prompts`, `GET/POST/DELETE /asr/jobs`,
  `GET /asr/jobs/{id}`, `GET /asr/jobs/{id}/result`

A screen whose endpoint is missing renders an empty/error state — it never
falls back to sample data.

---

## What changed (mock removal)

The previous prototype shipped with an in-repo sample/demo data layer and a
standalone Babel-in-browser page. These were removed in favour of real API
wiring:

- Deleted mock data: `src/data.js`, `src/scribe-data.js`, `src/scribe-data-ext.js`.
- Deleted the legacy root prototype: `Dictator.html`, `app.jsx`, `data.js`,
  `scribe.jsx`, `studio.jsx`, `reports.jsx`, `scribe-data.js`, `ui.jsx`,
  `tweaks-panel.jsx`, `i18n.js`, `scribe.css`, `styles.css`.
- Removed scripted/hardcoded behaviour: the Studio "scripted demo" partials and
  forced mic-state tweak, the consult auto-advancing transcript, the fake Дія QR
  + scripted polling, `MOCK_CERTS`, `MOCK_SNIPPETS`, `FALLBACK_PROMPTS`, the
  simulated report audio playhead, the hardcoded `2026-05-14` "now", and
  hardcoded patient/signer identities.
- Autocomplete (ghost text + pills, sprint 10) calls the autocomplete-service
  (`POST /autocomplete/suggest` on :8007) with the token being typed
  (`src/autocomplete/prefix.js`) — the wire model is `extra="forbid"` with an
  80-char prefix cap. Accepts insert the returned `completion` (phrases) or
  replace the typed `/trigger` with the expansion at `cursor_offset`
  (snippets) as ONE undo step inside the TipTap editor. Voice commands
  resolve against `src/dictation/voiceCommands.js`; signing and verification
  call the real signing service.

  Rendering (step 03): ghost text is a ProseMirror widget decoration at
  the caret (`src/extensions/AutocompleteGhost.js`) — in the text flow,
  document font metrics, `aria-hidden`, cleared by any doc/selection
  change; nothing ever enters the document until accept. The pills popup
  is anchored under the caret (`view.coordsAtPos`, viewport-clamped,
  flips near the bottom edge) and `aria-activedescendant` on the editor
  element tracks the active option.

  Editor keyboard protocol (suggestions visible → key consumed, otherwise
  the editor default wins — Tab has no other binding in the editor):
  `Tab` accept active · `Alt+1/2/3` accept by index · `Esc` dismiss ·
  `ArrowDown` cycle + arm explicit selection · `Enter` accepts ONLY after
  ArrowDown armed it (plain Enter stays a newline). Suggestions are off
  while dictation is listening; the transcript stream owns insertion.

  Latency budget: recently answered prefixes are served from an LRU memo
  (synchronous, original `request_id` kept so telemetry stays joinable);
  a response slower than 300 ms is never rendered — it lands in the memo
  and is reported as a `timeout` telemetry event. Failures are silent
  (no toast, no ghost, typing untouched) and 3 consecutive failures open
  a 15 s query backoff so a dead service is never hammered per keystroke.
  The right-rail settings are live and persist per user
  (localStorage `mdx.ac.prefs.v1.<sub>`): a master "Підказки під час
  набору" switch (OFF ⇒ no queries, no rendering, no telemetry, no Tab
  interception), ghost/pills toggles, per-source visibility (system /
  clinic / my phrases), and a sensitivity slider (min typed chars before
  a phrase query: 5 / 3 / 2).
# dictat
