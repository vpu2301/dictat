// Units for the public templates marketplace catalogue (/templates).
//
// The catalogue is hand-authored content spread over three files, so these
// tests guard the things a typo would silently break: the shape every entry
// must have, the icon/category vocabularies TemplatesMarketPage.jsx renders
// from, and the no-patient-data rule that applies to all public copy.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  TEMPLATES, TEMPLATE_CATEGORIES, getTemplate, categoryLabel,
  searchTemplates, relatedTemplates,
} from "./templates.js";

// Icon names rendered by <Icon>; must exist in the map in components/UI.jsx.
const ICONS = new Set([
  "fileText", "folder", "clock", "waveform", "sparkle", "heart", "scalpel",
  "bone", "scan", "layers", "book", "users", "user", "shield", "star", "tag",
  "grid", "calendar", "archive", "sign", "edit", "diff", "eye", "history",
]);

const bilingual = (v, where) => {
  assert.equal(typeof v?.uk, "string", `${where}: missing uk`);
  assert.equal(typeof v?.en, "string", `${where}: missing en`);
  assert.ok(v.uk.trim() && v.en.trim(), `${where}: blank`);
};

test("catalogue is non-empty and slugs are unique", () => {
  assert.ok(TEMPLATES.length >= 20, `only ${TEMPLATES.length} templates`);
  const slugs = TEMPLATES.map((t) => t.slug);
  assert.equal(new Set(slugs).size, slugs.length, "duplicate slug");
  for (const s of slugs) assert.match(s, /^[a-z0-9-]+$/, `bad slug: ${s}`);
});

test("every entry has the shape TemplatesMarketPage renders", () => {
  for (const t of TEMPLATES) {
    bilingual(t.name, `${t.slug}.name`);
    bilingual(t.tag, `${t.slug}.tag`);
    bilingual(t.about, `${t.slug}.about`);
    assert.ok(Number.isInteger(t.mins) && t.mins > 0, `${t.slug}: bad mins`);
    assert.ok(Number.isInteger(t.fields) && t.fields > 0, `${t.slug}: bad fields`);
    assert.ok(Array.isArray(t.bestFor?.uk) && Array.isArray(t.bestFor?.en), `${t.slug}: bestFor`);
    assert.equal(t.bestFor.uk.length, t.bestFor.en.length, `${t.slug}: bestFor lengths differ`);
    assert.ok(t.sections.length >= 4, `${t.slug}: too few sections`);
    t.sections.forEach((s, i) => {
      bilingual(s.name, `${t.slug}.sections[${i}].name`);
      bilingual(s.sample, `${t.slug}.sections[${i}].sample`);
    });
  }
});

test("icons and categories come from the rendered vocabularies", () => {
  const cats = new Set(TEMPLATE_CATEGORIES.map((c) => c.key));
  for (const t of TEMPLATES) {
    assert.ok(ICONS.has(t.icon), `${t.slug}: unknown icon "${t.icon}"`);
    assert.ok(cats.has(t.cat), `${t.slug}: unknown category "${t.cat}"`);
  }
  for (const c of TEMPLATE_CATEGORIES) {
    assert.ok(ICONS.has(c.icon), `category ${c.key}: unknown icon "${c.icon}"`);
    // An empty chip would render a dead filter.
    assert.ok(TEMPLATES.some((t) => t.cat === c.key), `category ${c.key} has no templates`);
  }
});

test("public copy carries no patient-identifying data", () => {
  const all = JSON.stringify(TEMPLATES);
  assert.doesNotMatch(all, /\b\d{10}\b/, "10-digit number (ІПН-shaped)");
  assert.doesNotMatch(all, /\b\d{2}[./]\d{2}[./]\d{4}\b/, "date of birth");
  assert.doesNotMatch(all, /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/i, "email address");
});

test("getTemplate resolves known slugs and rejects unknown ones", () => {
  const first = TEMPLATES[0];
  assert.equal(getTemplate(first.slug), first);
  assert.equal(getTemplate("no-such-template"), null);
  assert.equal(getTemplate(""), null);
});

test("categoryLabel falls back to English, then to the raw key", () => {
  const c = TEMPLATE_CATEGORIES[0];
  assert.equal(categoryLabel(c.key, "uk"), c.label.uk);
  assert.equal(categoryLabel(c.key, "hu"), c.label.en, "untranslated language falls back to en");
  assert.equal(categoryLabel("unknown-cat", "en"), "unknown-cat");
});

test("searchTemplates matches name, category and section headings", () => {
  assert.equal(searchTemplates(TEMPLATES, "   ", "en").length, TEMPLATES.length, "blank query is a no-op");

  const t = TEMPLATES[0];
  const byName = searchTemplates(TEMPLATES, t.name.en, "en");
  assert.ok(byName.includes(t), "name should match");

  const byNameUk = searchTemplates(TEMPLATES, t.name.uk.toUpperCase(), "en");
  assert.ok(byNameUk.includes(t), "search is case-insensitive and language-agnostic");

  const bySection = searchTemplates(TEMPLATES, t.sections[0].name.en, "en");
  assert.ok(bySection.includes(t), "section headings are searchable");

  const byCat = searchTemplates(TEMPLATES, categoryLabel(t.cat, "en"), "en");
  assert.ok(byCat.includes(t), "category label is searchable");

  assert.deepEqual(searchTemplates(TEMPLATES, "zzzzqqqq", "en"), []);
});

test("search matches word starts, not mid-word substrings", () => {
  // "incidental findings" must not answer a search for "dental".
  const dental = searchTemplates(TEMPLATES, "dental", "en");
  assert.ok(dental.length > 0, "dental should match the dentistry templates");
  assert.ok(dental.every((t) => t.cat === "dentistry"), "matched a non-dentistry template: " +
    dental.filter((t) => t.cat !== "dentistry").map((t) => t.slug).join(", "));

  // Cyrillic: "КТ" must not match inside "структура"/"фактор".
  const kt = searchTemplates(TEMPLATES, "КТ", "en");
  assert.ok(kt.length > 0 && kt.length < 6, `"КТ" matched ${kt.length} templates — too broad`);

  // A prefix still matches the whole word.
  assert.ok(searchTemplates(TEMPLATES, "cardio", "en").some((t) => t.cat === "cardiology"));

  // Every term must match, so a second word narrows rather than widens.
  const one = searchTemplates(TEMPLATES, "note", "en").length;
  const two = searchTemplates(TEMPLATES, "note zzzq", "en").length;
  assert.ok(two < one, "additional terms should narrow the result set");
});

test("relatedTemplates prefers the same category and never self-references", () => {
  for (const t of TEMPLATES) {
    const rel = relatedTemplates(t);
    assert.ok(rel.length > 0, `${t.slug}: no related templates`);
    assert.ok(!rel.some((r) => r.slug === t.slug), `${t.slug}: suggested itself`);
    const sameCatTotal = TEMPLATES.filter((x) => x.cat === t.cat && x.slug !== t.slug).length;
    const leading = rel.slice(0, Math.min(sameCatTotal, rel.length));
    assert.ok(leading.every((r) => r.cat === t.cat), `${t.slug}: same-category entries not listed first`);
  }
  assert.deepEqual(relatedTemplates(null), []);
});
