// rcm.test.js — the revenue-cycle pages stay specific, sourced and labelled.
//
//   node --test src/pages/marketing/rcm.test.js
//
// Three failure modes are worth a test here, and each one below is one of them:
//
//   1. A country page that drifts into generalities. The entire premise of this
//      route is that "we support Europe" is a lie and "OPS 2026, KVDT, §295(4)
//      SGB V" is not. A row that loses its value has lost the argument.
//   2. An unsourced claim about a national tariff. These facts expire — EBM is
//      revised quarterly, TARDOC replaced TARMED on 2026-01-01 — and a claim
//      nobody can check is one nobody can correct.
//   3. A page that quietly stops saying it is not built yet. Coding and claim
//      generation ship nothing today. The label is the only thing standing
//      between this route and a false statement to a buyer.

import { test } from "node:test";
import assert from "node:assert/strict";

import { LANGS } from "../../i18n.js";
import { RCM_COUNTRIES, RCM_ROWS, RCM_LABELS, rcmCountries } from "./rcm.js";
import { positioning } from "./positioning.js";
import { getContent } from "./content.js";

const CODES = LANGS.map((l) => l.code);

test("every country names its whole coding stack", () => {
  for (const c of RCM_COUNTRIES) {
    for (const row of RCM_ROWS) {
      assert.ok(c[row]?.length > 5, `${c.key}: ${row} is missing or too vague to be useful`);
    }
    // A stack described without naming a single classification is the generic
    // copy this route exists to avoid. Every country's row set must contain a
    // recognisable code system or platform name.
    const named = /ICD|MKN|MKB|BNO|CIM|НК |OPS|OENO|CHOP|CPT|ACHI|JGP|DRG|HBC|DSG|LKF|EBM|TARDOC|KVDT|NPHIES|SIUI|SWIAD/;
    assert.match(RCM_ROWS.map((r) => c[r]).join(" "), named, `${c.key}: nothing here is actually named`);
    // The menu row and the hub card show `short`. It has to fit on one line
    // and still be the country's signature — acronyms only, no sentence.
    assert.match(c.short, named, `${c.key}: the short signature names nothing`);
    assert.ok(c.short.length <= 42, `${c.key}: the short signature is too long for a menu row`);
  }
});

test("every claim about a national system is sourced", () => {
  for (const c of RCM_COUNTRIES) {
    assert.ok(c.sources?.length >= 2, `${c.key}: fewer than two primary sources`);
    for (const s of c.sources) {
      assert.ok(s.label?.length > 3, `${c.key}: a source has no label`);
      assert.match(s.url, /^https:\/\//, `${c.key}: ${s.url} is not an https source`);
    }
  }
});

test("the country reads in its own language, and in every interface language", () => {
  for (const c of RCM_COUNTRIES) {
    for (const code of CODES) {
      assert.ok(c.name[code]?.length > 1, `${c.key}: no country name in ${code}`);
    }
    // The note is the one piece of prose that carries a country-specific
    // argument. It is written in English and in the language spoken there —
    // the two audiences that will actually read it.
    assert.ok(c.note.en?.length > 40, `${c.key}: the English note is missing`);
    assert.ok(c.note[c.native]?.length > 40, `${c.key}: no note in ${c.native}, the local language`);
    assert.notEqual(c.note[c.native], c.note.en, `${c.key}: the ${c.native} note is the English one`);
  }
});

test("every row heading is translated into every interface language", () => {
  for (const row of RCM_ROWS) {
    for (const code of CODES) {
      assert.ok(RCM_LABELS[row]?.[code]?.length > 1, `${row}: no heading in ${code}`);
    }
  }
});

test("the hub and every country page resolve in every language", () => {
  for (const code of CODES) {
    const hub = getContent("rcm", code);
    assert.ok(hub, `${code}: /rcm is missing`);

    // Every card on the hub must lead somewhere real: a country grid with a
    // dead link is worse than no grid, because it reads as coverage.
    const grid = hub.blocks.find((b) => b.type === "grid");
    assert.equal(grid.items.length, RCM_COUNTRIES.length, `${code}: the hub lost a country`);
    for (const it of grid.items) {
      const page = getContent(it.path.replace(/^\//, ""), code);
      assert.ok(page, `${code}: ${it.path} is linked from the hub but has no page`);
    }

    for (const c of rcmCountries(code)) {
      const page = getContent(c.slug, code);
      assert.equal(page.hero.title, c.label, `${code}/${c.key}: the hero is not the country`);
      const spec = page.blocks.find((b) => b.type === "spec");
      assert.ok(spec, `${code}/${c.key}: the coding stack block is gone`);
      assert.equal(spec.rows.length, RCM_ROWS.length, `${code}/${c.key}: the stack lost a row`);
      for (const r of spec.rows) {
        assert.ok(r.label && r.value, `${code}/${c.key}: row ${r.key} is half-rendered`);
      }
      assert.ok(spec.sources?.length, `${code}/${c.key}: the sources were dropped`);
    }
  }
});

test("no page on this route stops saying it is not built yet", () => {
  // The check is on rendered page content, not on the data, because the label
  // is only worth anything where a reader can see it.
  for (const code of CODES) {
    const label = positioning(code).soonLabel;
    const slugs = ["rcm", ...RCM_COUNTRIES.map((c) => `rcm/${c.key}`)];
    for (const slug of slugs) {
      const page = getContent(slug, code);
      const rendered = JSON.stringify(page);
      assert.ok(rendered.includes(label),
        `${code}: /${slug} never says "${label}" — it now reads as a shipped feature`);
    }
  }
});

test("the countries are the ones we researched, and each appears once", () => {
  const keys = RCM_COUNTRIES.map((c) => c.key);
  assert.deepEqual([...new Set(keys)], keys, "a country is listed twice");
  assert.deepEqual(keys, ["de", "at", "ch", "pl", "cz", "hu", "ro", "rs", "ua", "ae", "sa"]);
});
