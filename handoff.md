# Dictat — Developer Handoff

Practical context for anyone picking up this repo. Pairs with `README.md` (which
covers the service URLs / `.env` matrix in depth) — this file focuses on **how the
frontend is built, the conventions you must follow, the gotchas, and what was
recently changed**.

> **What it is:** `dictat` (package name `dictator`) is the **React + Vite web
> frontend** for a voice-first medical documentation platform. Clinical content is
> **dictated, not typed** — clinicians record dictations or live consultations, the
> backend transcribes + structures them, and clinicians review, amend, and **e-sign**
> the result (Дія.Підпис / qualified key). The backend is a **separate repo** of
> microservices (`~/Desktop/dictate` / `medical-dictation-backend`).

---

## 1. Run / build / test

```bash
npm install
cp .env.example .env        # point VITE_*_SERVICE_URL at your backends
npm run dev                 # Vite dev server (default :5173)
npm run build               # production build (also the fastest full typecheck-ish gate)
npm run preview             # serve the production build

npm run e2e                 # Playwright end-to-end (npm run e2e:ui for the runner UI)
npm run verify:batch-a      # live auth-contract check against the backend (scripts/integration)
```

**There is no test runner for units** — the safety net is `npm run build` (full module
transform; catches import/syntax errors) + Playwright e2e. After any change, run
`npm run build` before declaring done.

**Tech stack:** React 18, Vite 6, **TipTap 3** (section-aware editor), DOMPurify (paste
sanitization), `qrcode` (Дія signing), `diff-match-patch` (report amendments),
`@floating-ui` (popovers). No CSS framework — hand-rolled CSS with design tokens.

---

## 2. Boot & providers

`index.html → src/main.jsx → src/App.jsx`. Provider stack (`src/main.jsx`):

```
<AuthProvider>          // src/auth/AuthContext.jsx — { state: {claims, dbUser}, setState, clear }
  <RootGate>            // src/auth/RootGate.jsx — gates first paint on auth bootstrap
    <App />             // hash router + the big route switch
```

CSS is imported once, in order, in `main.jsx`:
`styles.css → scribe.css → app-extra.css → sprints-06-10.css → sprints-11-15.css`.
**Later files override earlier ones** — put new rules in the file matching the feature
era, or `app-extra.css` for cross-cutting tweaks.

---

## 3. Architecture

### Backend services (`src/api/services.js`)
The platform is **split into multiple services**, NOT one monolith. Base URLs come from
`.env` (`VITE_*_SERVICE_URL`), defaulting to localhost ports:

| Key | Default | Responsibility |
|---|---|---|
| `auth` | :8000 | login/refresh, `/auth/me`, admin users, audit |
| `asr` | :8001 | batch transcription jobs |
| `dictation` | :8002 | **live dictation WebSocket** (section-aware ASR) |
| `core` | :8003 | patients, encounters, consents, anamnesis, notes, scribe |
| `nlp` | :8005 | NLP/autocomplete helpers |
| `report` | :8006 | reports + templates (create/draft/finalize/pdf) |
| `autocomplete` | :8007 | ghost-text + pill suggestions |
| `signing` | :8008 | Дія / KEP signing, signed PDFs, verify |

In production all point at the **same same-origin gateway**. Endpoints are **flat — no
`/api/v1` prefix** on most services (report-service uses `/v1/...`).

### API client pattern
- `src/api/client.js` — the `fetch` wrapper (auth header, error shaping).
- One file per domain in `src/api/` (`reports.js`, `templates.js`, `signing.js`,
  `patients.js`, …). Each exports plain async functions returning parsed JSON.
- **No global store** (no Redux/Zustand/React Query). Data loading uses the tiny
  `useAsync(fetcher, deps, { enabled })` hook (`src/api/useAsync.js`) → `{ data, loading,
  error, reload }`. Cursor pagination: `useCursorPages.js`.
- **No mock data anywhere.** Every screen must render explicit **loading / empty / error**
  states (`DataStates.jsx`, `ApiErrorView.jsx`, `Empty`). If a backend endpoint isn't
  deployed, show empty/error — never fabricate.

### Auth & permissions
- `useAuth()` → `{ state, setState, clear }`; `state` is `null | { claims, dbUser }`.
  - `claims`: `{ sub, tid, scope, iss, roles: string[], mfa }` (from the verified token)
  - `dbUser`: `{ email, display_name, role, status, mfa_enrolled_at, last_login_at }`
- `useClaims()`, `hasAnyRole(claims, roles)` (`AuthContext.jsx`).
- Route/role guards: `RequireAuth`, `RequireRole` (`src/auth/RequireRole.jsx`).
- Page-level permission checks: `usePermission(action, subject)` (`src/auth/permissions.js`).
- Roles seen: `clinician`, `tenant_admin`, `auditor`, `nurse`. All data is **tenant-scoped**
  (RLS) — a 404 may mean "another tenant's row", never say "forbidden" on a 404.

### Feature flags (`services.js` → `FEATURES`)
Flip via `.env` only once the gating backend is deployed AND CORS-reachable
(`VITE_FEAT_TEMPLATES`, `_REPORTS`, `_PATIENTS`, `_NOTES`, `_ANAMNESIS`, `_MFA_ENROLMENT`).

---

## 4. Routing

**Hash router**, hand-rolled in `src/App.jsx` — a big `if/else` chain on
`const r = route` (from `location.hash`). Navigate with `navigate(path)` which sets
`location.hash`. `navigate` is **not** passed everywhere; many pages use the global hash
or receive `navigate` as a prop. Each branch sets `view` + `crumbs`.

Route map (current):

| Path | Page |
|---|---|
| `/welcome`, `/`, `/features/*`, `/product/*`, `/legal/*` | marketing (`LandingPage`, `ContentPage`) |
| `/login`, `/signup`, `/mfa`, `/verify/*` | auth |
| `/dictate` | **DictationStudio** (the core screen) |
| `/dictate/conversation?patient=&encounter=` | **ConversationRoom** (S14) — two-voice consultation on protocol v2; needs a `recording` consent; finalize → draft → `/dictate/studio?report=` |
| `/dictate/reports`, `/dictate/reports/{id}` | Reports list + detail |
| `/dictate/templates` | TemplatesPage |
| `/scribe`, `/scribe/consult/*`, `/scribe/patients/*`, `/scribe/notes/*`, `/scribe/review/*` | ambient scribe + EHR |
| `/asr`, `/asr/jobs`, `/asr/jobs/{id}`, `/asr/new` | batch ASR |
| `/profile` | **ProfilePage** (user-facing, added this session) |
| `/me` | MePage (token/claims inspector — dev/identity view) |
| `/settings` | SettingsPage |
| `/admin/users`, `/audit/events`, `/audit/verify` | admin/audit (role-gated) |
| `/forbidden` | 403 |

---

## 5. Directory map

```
src/
  App.jsx            # hash router + route switch + app shell
  main.jsx           # providers + CSS imports
  i18n.js            # STRINGS{uk,en} + I18nProvider/useI18n (see §6)
  api/               # one file per backend domain + useAsync/useCursorPages + services.js
  auth/              # AuthContext, RequireRole, permissions, RootGate
  components/        # shared UI + big feature components (Studio, Reports, NoteEditor, SigningFlow…)
    UI.jsx           # Icon set, Sidebar, TopBar, Empty, SaveStatus, Modal, Toast, Logo
    Sidebar.jsx      # left nav + account menu (Profile/Settings/Audit/Sign out)
    Studio.jsx       # Dictation Studio (see §7)
    TipTapEditor.jsx # section-aware rich editor
    ReportPreview.jsx# written-report preview + draft-PDF print (added this session)
  pages/             # route-level pages (Settings, Profile, Me, Admin, Audit, Login…)
    marketing/       # public content pages
  extensions/        # TipTap nodes/marks (SectionExtension, LowConfidenceMark)
  dictation/         # voiceCommands.js (client-side command matching)
  paste/             # sanitizingPaste.js
  *.css              # styles.css (base+tokens), scribe.css, app-extra.css, sprints-06-10.css, sprints-11-15.css
scripts/integration/ # batch-a-verify.mjs (live contract check)
```

---

## 6. Conventions & gotchas (read before editing)

- **Bilingual everything (uk/en).** The app has `I18nProvider`/`useI18n()` with a `STRINGS`
  table, **but 99% of code uses inline ternaries**: `lang === "uk" ? "…" : "…"`, often via a
  local helper `const T = (uk, en) => (lang === "uk" ? uk : en)`. Follow the surrounding
  file. Template/section names are bilingual objects: `name.{uk,en}` — resolve as
  `name[lang] || name.en`.
- **Client-side prefs live in a `tweaks` store**, not localStorage. `useTweaks(defaults)`
  (`components/TweaksPanel.jsx`); applied to `<html data-theme/data-density>` + `--accent`
  in `App.jsx`. Keys: `theme, lang, density, accent` (+ Settings page adds more, read with
  inline fallbacks). **`TWEAK_DEFAULTS` in `App.jsx` is wrapped in `/*EDITMODE-BEGIN*/…END`
  markers owned by a dev edit-mode tool — don't hand-edit inside them.** `tweaks` is
  in-memory (resets on reload).
- **Per-user template favorites/usage** are interim **localStorage** (`api/templatePrefs.js`,
  keys `mdx.tpl.stars.v1` / `mdx.tpl.usage.v1`) standing in for a future backend. Used by
  both the Studio template picker and TemplatesPage.
- **Design tokens**: colors/spacing are CSS vars in `styles.css` `:root` (light) + a dark
  block. Use `var(--surface|surface-2|line|text-1|text-2|text-3|muted|accent|accent-soft|
  accent-text|rec|warn|warn-soft|ok|dictate|dictate-soft|shadow-1..3|radius*|mono)`. Don't
  hardcode hex. `--rec` is the recording-red; there's no `--danger` (use `--rec` or a fallback).
- **Icons**: inline SVG set in `components/UI.jsx` `<Icon name=… size=… />`. `fill` passes
  through (`fill="currentColor"` for filled states, e.g. the star). Add new glyphs to the
  `paths` map there.
- **TipTap document model**: the editor renders **section nodes** (`extensions/
  SectionExtension.js`) — no bare paragraphs at root. `body` is a flat `{ [sectionId]: text }`
  object; convert with `bodyToDoc(template, body, lang)` / `docToBody(doc)`
  (`TipTapEditor.jsx`). Section titles render from the `data-section-title` attr via CSS
  `::before`.
- **Hooks order / TDZ**: `App.jsx` and `Studio.jsx` are large single functions — define
  `useCallback`s **after** the state/values they list in deps, or you'll hit "cannot access
  before initialization" at render (the dep array is evaluated eagerly).
- **Modals** use `.modal-overlay/.modal` with stop-propagation; the report preview uses its
  own `.report-preview-*` classes.

---

## 7. The Dictation Studio (the core screen)

`src/components/Studio.jsx` — grid layout `left (260) | center (1fr) | right (320)`:
- **left** `SectionNav`: template picker (search + ⭐ starred filter), progress bar, section
  list with `●/◐/○` fill indicators + required `!` + word counts.
- **center**: `EditorToolbar` (patient + save status) → **`DictationStatusBar`** (shows the
  active section + a pulsing red dot while the mic is live) → `TipTapEditor` → `StudioFooter`
  (draft-PDF + **Complete dictation**).
- **right**: `MicCard` (mic state + level meter + uk/en switch), suggestions, voice-command
  reference, autocomplete settings.

**Dictation flow:** Web Speech (`useSpeechRecognition`) → `onFinalCb` checks voice commands
(`dictation/voiceCommands.js`), else appends to `body[activeId]`; low-confidence (<0.55) text
wraps in `[[…]]`. Live section-aware ASR goes over the **dictation WebSocket** when running.
**Autosave**: 1200 ms debounce → `createReport` (first) / `updateReport` draft PUT (optimistic
lock via `expected_version`/`version_number`, tracked in `reportIdRef`/`reportVersionRef`).

**Complete dictation** (`completeDictation`): pauses mic → `saveDraft()` → opens
`ReportPreview` (the written report). From there: back to editing, **Download PDF (draft)**,
or **Sign report** (→ `SigningFlow`). Signing: Дія QR poll **or** local KEP (download unsigned
PDF → sign locally → upload). Report statuses: `draft | final | signed | amended`.

**Draft PDF** is currently **client-side** (`ReportPreview.downloadDraftReport` opens a
print window with a diagonal "DRAFT" watermark + "NOT SIGNED" banner → browser Save as PDF).
The server-rendered watermarked PDF is a backend task (see §9).

---

## 8. Recent changes (this session)

All on branch `dev`, build-verified:

1. **Templates page ⭐ favorites** (`components/TemplatesPage.jsx`, `styles.css`): star on grid
   cards + list rows, "Starred only" filter, starred-first sort. Reuses `api/templatePrefs.js`,
   so it stays in sync with the Studio picker.
2. **Settings page** (`pages/SettingsPage.jsx`, `app-extra.css`): added a **sticky scroll-spy
   side menu** (IntersectionObserver) + new sections (Language & region, Dictation, Notifications,
   Data & privacy, Account & security, About). Backend-dependent actions are disabled "Soon".
3. **Profile page** (`pages/ProfilePage.jsx`, route `/profile`, `app-extra.css`): real identity
   (name/email/roles/MFA/last login) + future fields marked **"Coming soon"**. Sidebar "Profile"
   now → `/profile`; `/me` kept as the token inspector ("Identity" crumb).
4. **Dictation Studio**: visible **section labels** in the editor + **active-section indicator**
   (`DictationStatusBar` + `.is-active`), **"Complete dictation"** button → written-report
   **preview** (`ReportPreview.jsx`), **draft PDF with DRAFT/NOT-SIGNED watermark**. Removed the
   redundant toolbar Export/Sign (moved to footer/preview).

---

## 9. Outstanding backend work

Two task specs live on the **Desktop** (the convention for backend hand-offs, referenced from
the code):

- **`~/Desktop/dictat-dictation-report-backend-task.md`** — report **synthesis** (raw
  dictation → clinical prose via `synthesis_prompt`), `finalize` lifecycle with 422 on empty
  required sections, **server-rendered watermarked draft PDF** (`?variant=draft`), localized
  section labels on report content, session→report linkage + `report.completed` audit event.
- **`~/Desktop/dictat-template-favorites-usage-backend-task.md`** — replace the localStorage
  favorites/usage shim with real endpoints (`/templates/favorites`, `/templates/{id}/favorite`,
  `/templates/{id}/use`). See `api/templatePrefs.js` for the target API shape.

When those land: swap `templatePrefs.js` to the real client, and point
`ReportPreview.downloadDraftReport` at the server PDF.

---

## 10. Where to find things / tips

- **Add a route** → new `else if (r === "/x")` branch in `App.jsx` (import the page, set
  `view` + `crumbs`, wrap in `RequireAuth`/`RequireRole` if needed); add a nav entry in
  `components/Sidebar.jsx`.
- **Add an API call** → new function in the matching `src/api/*.js`, consume with `useAsync`.
- **New icon** → `paths` map in `components/UI.jsx`.
- **Localize a string** → inline ternary on `lang` (match the file's style).
- **A11y/RBAC**: hide write controls for non-permitted roles (`usePermission`) — the backend
  also enforces, the UI just shouldn't offer it.
- **LLM features**: default to the latest Claude model (app standard is Opus 4.x); see
  `api/autocomplete.js` / `nlp.js`.
- **Before finishing any task**: `npm run build` (gate), and for core-screen changes consider
  `npm run e2e`.

_Last updated: 2026-06-28. Keep this file current when you change architecture, conventions,
or the route/service tables._
