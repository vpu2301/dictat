// Sprint 17 — the templates admin surface's pure logic:
//   · classifyEditDetailed mirrors the backend classifier WITH reasons (the
//     live banner's data source; the backend computes reasons too but never
//     returns them);
//   · formatEditReason localizes each structured reason;
//   · boundReportsPath / rebindBody build the re-bind wire calls;
//   · rebindErrorMessage maps the rebind route's 409 details onto copy.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  classifyEdit, classifyEditDetailed, formatEditReason,
  boundReportsPath, rebindBody, rebindErrorMessage,
} from "./templates.js";

const section = (over = {}) => ({
  id: "pain", name: "Pain", field_type: "free_text", ...over,
});
const def = (over = {}) => ({
  code: "card_exam", language: "uk", sections: [section()], ...over,
});

// ── classifyEditDetailed ──────────────────────────────────────────────────

test("identical definitions → no_change with no reasons", () => {
  const r = classifyEditDetailed(def(), def());
  assert.equal(r.kind, "no_change");
  assert.deepEqual(r.reasons, []);
});

test("cosmetic edits (name, label, alias, min_chars lowered) carry no reasons", () => {
  const a = def({ sections: [section({ name: "Pain", min_chars: 20 })] });
  const b = def({ sections: [section({ name: "Болі", min_chars: 10 })] });
  const r = classifyEditDetailed(a, b);
  assert.equal(r.kind, "cosmetic");
  assert.deepEqual(r.reasons, []);
  assert.equal(classifyEdit(a, b), "cosmetic");
});

test("code and language changes are structural with their own reasons", () => {
  const r = classifyEditDetailed(def(), def({ code: "card_exam_v2", language: "en" }));
  assert.equal(r.kind, "structural");
  assert.deepEqual(r.reasons.map((x) => x.rule).sort(),
    ["code_changed", "language_changed"]);
});

test("section add/remove, field_type, required, min_chars raised, option loss — each named", () => {
  const a = def({
    sections: [
      section(),
      section({ id: "smoking", name: "Smoking", field_type: "choice",
        options: [{ value: "never", label: "Never" }, { value: "current", label: "Current" }] }),
    ],
  });
  const b = def({
    sections: [
      section({ field_type: "date", required: true, min_chars: 30 }),
      section({ id: "smoking", name: "Smoking", field_type: "choice",
        options: [{ value: "current", label: "Current" }, { value: "former", label: "Former" }] }),
      section({ id: "exam", name: "Exam" }),
    ],
  });
  const r = classifyEditDetailed(a, b);
  assert.equal(r.kind, "structural");
  const rules = r.reasons.map((x) => x.rule);
  assert.ok(rules.includes("sections_added"));
  assert.ok(rules.includes("field_type_changed"));
  assert.ok(rules.includes("required_flipped"));
  assert.ok(rules.includes("min_chars_increased"));
  assert.ok(rules.includes("option_values_removed"));
  const lost = r.reasons.find((x) => x.rule === "option_values_removed");
  assert.deepEqual(lost.values, ["never"]);
});

test("removing a section names it; adding an option stays cosmetic", () => {
  const two = def({ sections: [section(), section({ id: "exam", name: "Exam" })] });
  const one = def({ sections: [section()] });
  const removed = classifyEditDetailed(two, one);
  assert.equal(removed.kind, "structural");
  assert.deepEqual(removed.reasons, [{ rule: "sections_removed", values: ["exam"] }]);

  const withOpts = (opts) => def({
    sections: [section({ id: "smoking", field_type: "choice", options: opts })],
  });
  const grown = classifyEditDetailed(
    withOpts([{ value: "never", label: "Never" }, { value: "current", label: "Current" }]),
    withOpts([{ value: "never", label: "Never" }, { value: "current", label: "Current" },
              { value: "former", label: "Former", voice_aliases: ["кинув"] }]),
  );
  assert.equal(grown.kind, "cosmetic");
});

// ── formatEditReason ──────────────────────────────────────────────────────

test("reasons localize in both languages", () => {
  const r = { rule: "sections_removed", values: ["exam"] };
  assert.match(formatEditReason(r, "uk"), /Вилучено секції: «exam»/);
  assert.match(formatEditReason(r, "en"), /Sections removed: «exam»/);
  assert.match(
    formatEditReason({ rule: "min_chars_increased", section: "pain", from: 0, to: 30 }, "uk"),
    /«pain».*0 → 30/,
  );
  assert.match(
    formatEditReason({ rule: "code_changed", from: "a", to: "b" }, "en"),
    /Code changed: a → b/,
  );
});

// ── wire builders ─────────────────────────────────────────────────────────

test("boundReportsPath encodes the id and clamps limit to 1..200 (default 50)", () => {
  assert.equal(boundReportsPath("abc"), "/templates/abc/bound-reports?limit=50");
  assert.equal(boundReportsPath("a/b"), "/templates/a%2Fb/bound-reports?limit=50");
  assert.equal(boundReportsPath("abc", 999), "/templates/abc/bound-reports?limit=200");
  assert.equal(boundReportsPath("abc", -3), "/templates/abc/bound-reports?limit=1");
});

test("rebindBody carries exactly the two ids (extra='forbid' on the wire)", () => {
  assert.deepEqual(
    rebindBody({ report_id: "r1", to_template_id: "t2", stray: "x" }),
    { report_id: "r1", to_template_id: "t2" },
  );
});

// ── rebindErrorMessage ────────────────────────────────────────────────────

const err = (status, detail) => ({ status, problem: { detail }, message: "boom" });

test("each rebind 409 detail maps to distinct operator copy", () => {
  assert.match(rebindErrorMessage(err(409, "report is not bound to this template"), "uk"),
    /не прив'язаний/);
  assert.match(rebindErrorMessage(
    err(409, "only draft reports can be re-bound; finalized and signed reports keep their template"), "uk"),
    /лише чернетки/i);
  assert.match(rebindErrorMessage(err(409, "report is already bound to this template"), "uk"),
    /уже прив'язаний/);
  assert.match(rebindErrorMessage(err(409, "target template is deprecated"), "uk"),
    /знято з використання/);
  assert.match(rebindErrorMessage(err(409, "target template language differs from the source template"), "uk"),
    /Мова/);
  assert.match(rebindErrorMessage(err(404, "template not found"), "en"),
    /not found/i);
  // Unmatched shapes fall back to the error's own message.
  assert.equal(rebindErrorMessage(err(500, "??"), "uk"), "boom");
});
