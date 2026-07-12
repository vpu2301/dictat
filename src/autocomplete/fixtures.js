// Sprint 10 step 01 — REAL-response fixtures for the autocomplete contract.
//
// Provenance: captured 2026-07-08 from the live local backend
// (autocomplete-service `dev` branch on :8007, auth-service on :8000,
// seeded dev clinician). Reproduce with:
//
//   TOK=$(curl -s -X POST http://localhost:8000/auth/login \
//     -H 'Content-Type: application/json' \
//     -d '{"email":"clinician@tenant-a.example","password":"dev-password"}' \
//     | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
//   curl -s -X POST http://localhost:8007/autocomplete/suggest \
//     -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
//     -d '{"prefix":"зад","language":"uk","limit":3}'
//
// The user-source phrase was created first via POST /autocomplete/phrases
// {"phrase":"задишка у спокої відсутня","language":"uk","source":"user"} (201).
//
// These are canonical wire shapes for tests/mocks — the app itself never
// imports them (no mock data in app code). Field names are the wire's
// snake_case, passed through unchanged by src/api/autocomplete.js.

// POST /autocomplete/suggest {"prefix":"зад","language":"uk","limit":3}
// — two phrases, the tenant user's own phrase ranked first.
export const SUGGEST_PHRASES_UK = {
  request_id: "2241f041-7603-401e-954a-701c845253f1",
  suggestions: [
    {
      id: "56c0b63e-04b3-4e4b-b1f8-a58ce288ac9d",
      kind: "phrase",
      text: "задишка у спокої відсутня",
      completion: "ишка у спокої відсутня",
      source: "user",
      confidence: 0.28224894304226,
      cursor_offset: null,
    },
    {
      id: "729aa545-ad90-4066-8196-26de0b876c55",
      kind: "phrase",
      text: "задишка при фізичному навантаженні",
      completion: "ишка при фізичному навантаженні",
      source: "system",
      confidence: 0.24442483504772541,
      cursor_offset: null,
    },
  ],
};

// POST /autocomplete/suggest {"prefix":"біль","language":"uk","limit":3}
// — stem match where `completion` starts mid-word boundary (leading space).
export const SUGGEST_STEM_UK = {
  request_id: "00b2dff7-f83a-4f3d-84e7-0c433617cce3",
  suggestions: [
    {
      id: "9d23b10f-ea6f-4fb4-ab4a-329c551ecc71",
      kind: "phrase",
      text: "біль за грудиною стискаючого характеру",
      completion: " за грудиною стискаючого характеру",
      source: "system",
      confidence: 0.2438257179908415,
      cursor_offset: null,
    },
  ],
};

// POST /autocomplete/suggest {"prefix":"/vitals","language":"uk"}
// — snippet: `completion` === `text` (the whole expansion replaces the
// typed /trigger token) and `cursor_offset` is where the caret lands
// (13 → inside the first "{_}" placeholder).
export const SUGGEST_SNIPPET_UK = {
  request_id: "5448c5cd-afb3-47e3-8592-83ef72e8a61e",
  suggestions: [
    {
      id: "893f423b-15b1-4f80-9958-8a0aca378ff1",
      kind: "snippet",
      text: "Температура {_} °C, АТ {_} мм рт ст, ЧСС {_} за хвилину, ЧДР {_} за хвилину, SpO₂ {_}%.",
      completion:
        "Температура {_} °C, АТ {_} мм рт ст, ЧСС {_} за хвилину, ЧДР {_} за хвилину, SpO₂ {_}%.",
      source: "system",
      confidence: 1.0,
      cursor_offset: 13,
    },
  ],
};

// Empty result is a 200 with [] — never a 404.
export const SUGGEST_EMPTY = {
  request_id: "00000000-0000-4000-8000-000000000000",
  suggestions: [],
};
