// docs.js — Content registry for the public developer documentation (/docs).
//
// Every section is real platform behaviour, written down from the deployed
// contracts (flat endpoints, RFC 7807 problems, invite-only accounts). Blocks
// are typed; DocsPage.jsx renders them. Bilingual uk/en like the rest of the
// marketing site; code samples are shared between languages.
//
// Block types:
//   { type: "p",       uk, en }                      — paragraph
//   { type: "h2",      uk, en }                      — sub-heading
//   { type: "bullets", items: [{ uk, en }] }         — checklist
//   { type: "code",    title?, body }                — monospace sample
//   { type: "table",   cols: {uk,en}, rows: [[..]] } — small data table
//   { type: "note",    uk, en }                      — callout

export const DOC_SECTIONS = [
  {
    slug: "getting-started",
    icon: "sparkle",
    title: { uk: "Початок роботи", en: "Getting started" },
    lead: {
      uk: "Що таке платформа Klarnote з погляду розробника і як до неї під'єднатися.",
      en: "What the Klarnote platform looks like from a developer's seat and how to connect.",
    },
    blocks: [
      {
        type: "p",
        uk: "Klarnote — це набір FastAPI-мікросервісів: автентифікація, пакетне розпізнавання мовлення (ASR), живе диктування, NLP-структурування, звіти й шаблони, автодоповнення термінів та цифрове підписання. Кожен сервіс публікує власну OpenAPI-специфікацію та інтерактивний Swagger UI.",
        en: "Klarnote is a set of FastAPI microservices: authentication, batch speech recognition (ASR), live dictation, NLP structuring, reports & templates, term autocomplete and digital signing. Every service publishes its own OpenAPI spec and interactive Swagger UI.",
      },
      {
        type: "p",
        uk: "Ендпоїнти пласкі — без префікса /api/v1 (звіти є винятком і живуть під /v1). У продакшені всі сервіси доступні через один same-origin шлюз; у dev-оточенні кожен слухає власний порт.",
        en: "Endpoints are flat — no /api/v1 prefix (reports are the exception and live under /v1). In production every service sits behind a single same-origin gateway; in a dev environment each listens on its own port.",
      },
      {
        type: "table",
        cols: { uk: ["Сервіс", "Dev-адреса", "Призначення"], en: ["Service", "Dev base URL", "Purpose"] },
        rows: [
          ["auth", "http://localhost:8000", { uk: "Сесії, користувачі, ролі, аудит", en: "Sessions, users, roles, audit" }],
          ["asr", "http://localhost:8001", { uk: "Пакетна транскрипція", en: "Batch transcription" }],
          ["dictation", "http://localhost:8002", { uk: "Живе диктування (WebSocket)", en: "Live dictation (WebSocket)" }],
          ["core", "http://localhost:8003", { uk: "Пацієнти, прийоми, згоди", en: "Patients, encounters, consents" }],
          ["nlp", "http://localhost:8005", { uk: "Структурування нотаток", en: "Note structuring" }],
          ["reports", "http://localhost:8006", { uk: "Звіти та шаблони (/v1)", en: "Reports & templates (/v1)" }],
          ["autocomplete", "http://localhost:8007", { uk: "Підказки термінів", en: "Term suggestions" }],
          ["signing", "http://localhost:8008", { uk: "Підписання та перевірка", en: "Signing & verification" }],
        ],
      },
      {
        type: "note",
        uk: "Платформа працює лише за запрошенням: акаунти створює адміністратор клініки, самостійної реєстрації немає. Доступ до API та ключі — через форму на сторінці «Для розробників».",
        en: "The platform is invite-only: accounts are provisioned by a clinic administrator, there is no self-serve sign-up. API access and keys are requested via the form on the Developers page.",
      },
      {
        type: "h2",
        uk: "Інтерактивна документація",
        en: "Interactive documentation",
      },
      {
        type: "p",
        uk: "Кожен сервіс віддає Swagger UI на {base}/docs і специфікацію на {base}/openapi.json. Усі вісім зібрані в одному переглядачі — розділ «API Docs» у меню та футері.",
        en: "Every service serves Swagger UI at {base}/docs and its spec at {base}/openapi.json. All eight are gathered in one in-site browser — see “API Docs” in the menu and footer.",
      },
    ],
  },
  {
    slug: "authentication",
    icon: "shield",
    title: { uk: "Автентифікація", en: "Authentication" },
    lead: {
      uk: "Bearer JWT у пам'яті + HttpOnly refresh-cookie. Жодних токенів у localStorage.",
      en: "In-memory bearer JWT + an HttpOnly refresh cookie. No tokens in localStorage.",
    },
    blocks: [
      {
        type: "p",
        uk: "Вхід — POST /auth/login (auth-сервіс) із form-encoded полями email і password. У відповіді — короткоживучий access_token (JWT, RS256, audience mdx-api, емітент — Keycloak realm medical-dictation); разом із ним бекенд ставить HttpOnly refresh-cookie mdx_rt із path=/auth.",
        en: "Sign in with POST /auth/login (auth service) using form-encoded email and password fields. The response carries a short-lived access_token (JWT, RS256, audience mdx-api, issued by the Keycloak realm medical-dictation); alongside it the backend sets an HttpOnly refresh cookie mdx_rt scoped to path=/auth.",
      },
      {
        type: "code",
        title: "Login + authorized call",
        body: `curl -s -X POST http://localhost:8000/auth/login \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "email=clinician@clinic.example&password=•••"
# → { "access_token": "eyJ…" }  + Set-Cookie: mdx_rt=…; HttpOnly; Path=/auth

curl -s http://localhost:8001/asr/prompts \\
  -H "Authorization: Bearer $ACCESS_TOKEN"`,
      },
      {
        type: "bullets",
        items: [
          {
            uk: "Тримайте access_token лише в пам'яті процесу; на кожен запит — заголовок Authorization: Bearer.",
            en: "Keep the access_token in process memory only; send Authorization: Bearer on every request.",
          },
          {
            uk: "Коли будь-який виклик повертає 401 — зробіть POST /auth/refresh (cookie поїде автоматично з credentials: \"include\") і повторіть запит один раз.",
            en: "When any call returns 401 — POST /auth/refresh (the cookie rides along with credentials: \"include\") and retry the request once.",
          },
          {
            uk: "Refresh-токени ротуються з детекцією повторного використання: повторений (уже спожитий) токен → 401 із кодом auth_refresh_replay, і вся сесія примусово відкликається. Не повторюйте refresh — виконайте повторний вхід.",
            en: "Refresh tokens rotate with replay detection: a replayed (already consumed) token → 401 with code auth_refresh_replay, and the whole session is force-revoked. Do not retry the refresh — sign in again.",
          },
          {
            uk: "MFA / step-up сигналізується заголовком відповіді WWW-Authenticate (він відкритий для CORS), а не тілом JSON.",
            en: "MFA / step-up is signalled via the WWW-Authenticate response header (CORS-exposed), not the JSON body.",
          },
        ],
      },
      {
        type: "note",
        uk: "Тенантність визначається токеном: tenant виводиться з claims, а не з параметрів запиту. Дані ізольовані на рівні БД (PostgreSQL RLS).",
        en: "Tenancy is token-derived: the tenant comes from the claims, never from request parameters. Data is isolated at the database level (PostgreSQL RLS).",
      },
    ],
  },
  {
    slug: "asr",
    icon: "waveform",
    title: { uk: "Пакетна транскрипція (ASR)", en: "Batch transcription (ASR)" },
    lead: {
      uk: "Завантажте аудіо — отримайте структуровану транскрипцію з таймкодами та впевненістю по словах.",
      en: "Upload audio — get a structured transcript with timestamps and per-word confidence.",
    },
    blocks: [
      {
        type: "p",
        uk: "Життєвий цикл завдання: queued → running → complete | failed | cancelled. Завдання створюється multipart-запитом, обробляється асинхронно воркером (модель large-v3), а клієнт опитує статус.",
        en: "Job lifecycle: queued → running → complete | failed | cancelled. A job is created with a multipart request, processed asynchronously by a worker (large-v3 model), and the client polls for status.",
      },
      {
        type: "table",
        cols: { uk: ["Метод і шлях", "Опис"], en: ["Method & path", "Description"] },
        rows: [
          ["GET /asr/prompts", { uk: "Список промптів: id, language, specialty, is_default", en: "Prompt list: id, language, specialty, is_default" }],
          ["POST /asr/jobs", { uk: "Створити завдання (multipart: audio, prompt_id, language, encounter_id?)", en: "Create a job (multipart: audio, prompt_id, language, encounter_id?)" }],
          ["GET /asr/jobs", { uk: "Список завдань тенанта (?status=&limit=)", en: "Tenant's jobs (?status=&limit=)" }],
          ["GET /asr/jobs/{id}", { uk: "Статус завдання; опитуйте кожні ~2 с, поки активне", en: "Job status; poll every ~2 s while active" }],
          ["GET /asr/jobs/{id}/result", { uk: "Транскрипція завершеного завдання; 409, поки не complete", en: "Transcript of a completed job; 409 until complete" }],
          ["DELETE /asr/jobs/{id}", { uk: "Скасувати активне завдання", en: "Cancel an active job" }],
        ],
      },
      {
        type: "code",
        title: "Submit → poll → fetch result",
        body: `curl -s -X POST http://localhost:8001/asr/jobs \\
  -H "Authorization: Bearer $ACCESS_TOKEN" \\
  -F "audio=@consult.wav" -F "prompt_id=$PROMPT_ID" -F "language=uk"
# → { "id": "…", "status": "queued", … }

curl -s http://localhost:8001/asr/jobs/$JOB_ID \\
  -H "Authorization: Bearer $ACCESS_TOKEN"
# → { "status": "running", … }   поки не complete / until complete

curl -s http://localhost:8001/asr/jobs/$JOB_ID/result \\
  -H "Authorization: Bearer $ACCESS_TOKEN"
# → { "language": "uk", "segments": [ { "start_ms": 0, "end_ms": 4200,
#      "text": "…", "words": [{ "text": "…", "probability": 0.97, … }] } ] }`,
      },
      {
        type: "bullets",
        items: [
          {
            uk: "Аудіо валідується до постановки в чергу (MIME-тип, розмір, квота тенанта); відмова — 422 problem із type urn:mdx:asr:validation:<код>.",
            en: "Audio is validated before queueing (MIME type, size, tenant quota); rejection is a 422 problem with type urn:mdx:asr:validation:<code>.",
          },
          {
            uk: "Запит результату до завершення — 409 problem urn:mdx:asr:result:not-ready з полем job_status; опитуйте статус і повторіть.",
            en: "Fetching the result before completion yields a 409 problem urn:mdx:asr:result:not-ready with a job_status field; poll status and retry.",
          },
          {
            uk: "Невдале завдання несе error_kind + error_detail у поданні статусу.",
            en: "A failed job carries error_kind + error_detail on the status view.",
          },
          {
            uk: "Таймкоди — в мілісекундах (start_ms/end_ms), упевненість — probability ∈ [0,1] по словах.",
            en: "Timestamps are milliseconds (start_ms/end_ms); confidence is a per-word probability ∈ [0,1].",
          },
        ],
      },
    ],
  },
  {
    slug: "dictation",
    icon: "mic",
    title: { uk: "Живе диктування", en: "Live dictation" },
    lead: {
      uk: "Потокове розпізнавання через WebSocket — текст з'являється, поки лікар говорить.",
      en: "Streaming recognition over WebSocket — text appears while the clinician speaks.",
    },
    blocks: [
      {
        type: "p",
        uk: "Dictation-сервіс приймає аудіопотік через WebSocket (та сама адреса, що й HTTP-база, зі схемою ws/wss) і повертає проміжні та фінальні гіпотези в реальному часі. Після завершення сеансу сервер фіналізує запис у чернетку звіту.",
        en: "The dictation service accepts an audio stream over WebSocket (same host as the HTTP base with the ws/wss scheme) and returns interim and final hypotheses in real time. When a session ends, the server finalizes the recording into a report draft.",
      },
      {
        type: "bullets",
        items: [
          {
            uk: "Автентифікація — тим самим bearer-токеном, що й для HTTP.",
            en: "Authenticate with the same bearer token as for HTTP.",
          },
          {
            uk: "Аудіо буферизується та шифрується на сервері; браузер ніколи не працює з шифротекстом.",
            en: "Audio is buffered and encrypted server-side; the browser never handles ciphertext.",
          },
          {
            uk: "Запис у клінічному контексті вимагає обраного пацієнта та зафіксованої згоди — сеанс без них відхиляється.",
            en: "Recording in a clinical context requires a selected patient and captured consent — sessions without them are rejected.",
          },
        ],
      },
      {
        type: "note",
        uk: "Точна схема повідомлень описана в OpenAPI/AsyncAPI dictation-сервісу — див. розділ API Docs.",
        en: "The exact message schema is documented by the dictation service itself — see the API Docs section.",
      },
    ],
  },
  {
    slug: "reports",
    icon: "fileText",
    title: { uk: "Звіти, шаблони, підписання", en: "Reports, templates, signing" },
    lead: {
      uk: "Чернетки з автозбереженням, версії з порівнянням, PDF та цифровий підпис через Дію.",
      en: "Autosaved drafts, versions with diffing, PDF export and digital signing via Дія.",
    },
    blocks: [
      {
        type: "p",
        uk: "Report-сервіс живе під /v1: /v1/reports і /v1/templates. Чернетка редагується через PUT; кожне збереження створює нову версію, які можна переглядати та порівнювати.",
        en: "The report service lives under /v1: /v1/reports and /v1/templates. Drafts are edited via PUT; every save produces a new version, which can be listed and diffed.",
      },
      {
        type: "bullets",
        items: [
          {
            uk: "Ліміт автозбереження: 1 PUT на 5 секунд на чернетку. Перевищення — 429: коалесціюйте зміни та повторіть пізніше, це не помилка користувача.",
            en: "Autosave limit: 1 PUT per 5 seconds per draft. Exceeding it returns 429: coalesce edits and retry later — it is not a user error.",
          },
          {
            uk: "Конфлікт версій (одночасне редагування) — 409: перечитайте звіт і застосуйте зміни поверх актуальної версії.",
            en: "A version conflict (concurrent edit) is a 409: re-fetch the report and re-apply changes on top of the current version.",
          },
          {
            uk: "Читання чужого звіту (не автором) вимагає явної мети: GET /v1/reports/{id}?purpose=… — доступ аудитується.",
            en: "Reading a report you did not author requires an explicit purpose: GET /v1/reports/{id}?purpose=… — the access is audited.",
          },
          {
            uk: "Підписаний звіт незмінний; виправлення — через окрему версію-доповнення (amendment) з видимою історією.",
            en: "A signed report is immutable; corrections happen via a separate amendment version with a visible history.",
          },
        ],
      },
      {
        type: "p",
        uk: "Підписання виконує signing-сервіс (інтеграція з Дією). Кожен підписаний документ має публічне посилання перевірки — сторінка /verify/{id} доступна без входу й показує цілісність та підписанта.",
        en: "Signing is handled by the signing service (Дія integration). Every signed document gets a public verification link — the /verify/{id} page needs no sign-in and shows integrity and signer.",
      },
    ],
  },
  {
    slug: "errors",
    icon: "flag",
    title: { uk: "Помилки та ліміти", en: "Errors & limits" },
    lead: {
      uk: "Одна модель помилок для всіх сервісів — RFC 7807 problem+json.",
      en: "One error model across all services — RFC 7807 problem+json.",
    },
    blocks: [
      {
        type: "p",
        uk: "Кожна помилка — це application/problem+json із полями type (URN), title, status, detail та instance. Поле instance має вигляд urn:uuid:<uuid> — це кореляційний ідентифікатор; додавайте його до звернень у підтримку.",
        en: "Every error is application/problem+json with type (a URN), title, status, detail and instance. The instance field looks like urn:uuid:<uuid> — it is the correlation id; quote it in support requests.",
      },
      {
        type: "code",
        title: "Problem example",
        body: `HTTP/1.1 409 Conflict
Content-Type: application/problem+json

{
  "type": "urn:mdx:asr:result:not-ready",
  "title": "Transcription result is not ready",
  "status": 409,
  "detail": "job 66acd6e9-… is in status 'running', not 'complete'",
  "job_status": "running",
  "instance": "urn:uuid:dd32c39c-1fdd-4ff7-97ee-e9640e4d39ca"
}`,
      },
      {
        type: "bullets",
        items: [
          {
            uk: "Машиночитані типи — URN-и виду urn:mdx:<сервіс>:<категорія>[:<код>]; гілкуйте логіку за type, а не за текстом detail.",
            en: "Machine-readable types are URNs like urn:mdx:<service>:<category>[:<code>]; branch on type, never on the detail text.",
          },
          {
            uk: "401 → спробуйте refresh один раз; 403 — бракує ролі або скоупа; 429 — притримайтеся і повторіть (див. ліміт автозбереження звітів).",
            en: "401 → try one refresh; 403 — a role or scope is missing; 429 — back off and retry (see the report autosave limit).",
          },
          {
            uk: "Виклики MFA/step-up приходять у заголовку WWW-Authenticate, який відкрито для CORS.",
            en: "MFA/step-up challenges arrive in the WWW-Authenticate header, which is CORS-exposed.",
          },
        ],
      },
    ],
  },
  {
    slug: "security",
    icon: "shield",
    title: { uk: "Безпека та приватність", en: "Security & privacy" },
    lead: {
      uk: "Дані не залишають вашого розгортання. Шифрування на рівні застосунку, ізоляція на рівні БД.",
      en: "Data never leaves your deployment. Application-level encryption, database-level isolation.",
    },
    blocks: [
      {
        type: "bullets",
        items: [
          {
            uk: "Мультитенантність: кожен запит виконується під PostgreSQL Row-Level Security, тенант виводиться з JWT-claims.",
            en: "Multi-tenancy: every query runs under PostgreSQL Row-Level Security with the tenant derived from JWT claims.",
          },
          {
            uk: "Аудіо й транскрипції зашифровані в спокої конвертним шифруванням AES-256-GCM; розшифрування відбувається виключно на сервері (ADR-0011) — клієнти ніколи не отримують ані ключів, ані шифротексту.",
            en: "Audio and transcripts are encrypted at rest with AES-256-GCM envelope encryption; decryption happens exclusively server-side (ADR-0011) — clients never receive keys or ciphertext.",
          },
          {
            uk: "Згода пацієнта фіксується до запису та може бути підписана цифровим підписом; відкликання згоди зупиняє обробку.",
            en: "Patient consent is captured before recording and can be digitally signed; withdrawal stops processing.",
          },
          {
            uk: "Права суб'єктів даних: DSAR-експорт та незворотне стирання за принципом двох осіб (запит одного адміністратора підтверджує інший).",
            en: "Data-subject rights: DSAR export and irreversible erasure under a two-person rule (one admin's request is confirmed by another).",
          },
          {
            uk: "Кожна значуща дія потрапляє в аудит-журнал із криптографічною перевіркою цілісності ланцюжка подій.",
            en: "Every significant action lands in an audit log with cryptographic verification of the event chain.",
          },
        ],
      },
      {
        type: "note",
        uk: "Огляд для не-розробників — на сторінці «Безпека». Питання безпеки: розділ «Контакти».",
        en: "The non-developer overview lives on the Security page. Security questions: see Contact.",
      },
    ],
  },
];

export function getDoc(slug) {
  return DOC_SECTIONS.find((s) => s.slug === slug) || null;
}
