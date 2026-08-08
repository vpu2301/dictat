# Corpus fixtures (EVA-S02)

**The** mock corpus. Every later route-mocked evidence suite reads these files
instead of inventing its own passages, so that one corpus — with one set of
metadata shapes, offsets and edge states — sits behind all of them.

| File | Contract | What it is |
|---|---|---|
| `documents.json` | `Document[]` + `DocumentVersion[]` | 12 documents, 13 versions (one document carries two) |
| `passages.json` | `EvidencePassage[]` | 42 passages — the chunk→document projection retrieval returns |
| `web-pages.json` | wrapper around `WebSourceRef` | 6 cached web pages with access dates, for the S04/S08 web-source mocks |

Contracts are the generated ones (`src/types/evidence.d.ts`, EVA-S01).
`corpusFixtures.test.js` validates every row against them field by field and
asserts the edge-state inventory below. It runs in `npm run test:unit`.

## Where the content comes from

The documents mirror the corpus the backend actually ingests:

- **Content and section paths** come from
  `evidence-backend/services/evidence-ingest/tests/fixtures/generate_fixtures.py`
  — the WHO guideline, the NICE page, the МОЗ protocol, the PMC article, the
  MEDLINE abstract, the docx настанова and the transliterated protocol PDF.
- **Canonical ids** are the ones `evidence-backend/eval/seed/judgments.jsonl`
  grades retrieval against (`doi:10.1234/who.2024.001`, `moz:1234`, …), so an
  FE mock and a backend eval run talk about the same corpus rather than two
  invented ones. The shape test pins all seven.
- **Licence classes** follow `evidence-backend/docs/corpus/licenses.md` — NICE
  is `restricted` because its syndication agreement is unsigned, WHO is
  `licensed_internal`, МОЗ normative acts are `public_domain`.
- Five further documents exist to complete the edge inventory (retracted trial,
  tenant protocol, open-licence review, drug label, expired 2018 protocol).

**They were authored, not exported.** `scripts/export-corpus-fixtures.mjs` is
written and works, but it needs a dev backend with an ingested corpus, and the
S02 corpus lives only on a developer's machine. When one exists, run the script
and the shape test will say whether anything was lost. Until then these files
are a faithful hand-built copy of what that export would produce — which is
exactly the kind of claim the shape test exists to keep honest.

## Regenerating

```bash
# bring up a dev corpus (evidence-backend/docs/runbooks/evidence-ingest.md)
EVIDENCE_DB_URL=postgres://…/mdx npm run fixtures:corpus
node --test e2e/fixtures/corpus/corpusFixtures.test.js
```

Two deliberate differences from what `POST /retrieve` returns, both because the
fixtures must carry states retrieval hides:

- **retracted documents are included** — retrieval filters `NOT d.retracted`,
  but a citation resolved months after an answer still has to render as
  withdrawn (S08 retraction alert).
- **superseded versions are included** — retrieval keeps the latest version
  only, and «застаріло/замінено» is a state S04 must be able to show.

`scores` are per-query and therefore not in the database. The export preserves
the ones already committed, matched by chunk id, rather than emitting nulls.

`web-pages.json` is never exported — cached web results are not corpus rows
(there is no table for them in migrations 0067/0068). Edit it by hand.

## The edge-state inventory

Enforced by the shape test. Losing any of these in a regeneration leaves a later
screen with no way to reach a state it must render:

- every `license_class` (all five), `evidence_tier` (all five), `source_authority`
  (all five), `source_kind` (all six) and `trust_tier` (all five) appears
- ≥1 retracted document, with its passages carrying the flag
- ≥1 superseded pair: one document, two versions, passages from both
- ≥1 expired document (`valid_until` in the past)
- ≥4 table-bearing passages, in both Cyrillic and Latin script
- ≥30% of passages in each script
- passage metadata agrees with its document (the projection copies tier,
  authority, licence, publication date and retraction onto every passage)

## Using them in a spec

```js
import passages from "../fixtures/corpus/passages.json" with { type: "json" };

await page.route(/\/retrieve$/, (route) =>
  route.fulfill({ json: { passages: passages.slice(0, 5), degraded: false } }));
```

Fixtures are committed so CI stays hermetic: no spec may reach a live corpus.
