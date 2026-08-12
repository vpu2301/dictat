/* The band's layout is derived, not hand-placed, which means a bad constant
 * silently pushes artefacts off the canvas or piles them on top of each other
 * instead of throwing. These tests pin the invariants that keep it readable.
 *
 * The content is checked too — not for clinical correctness, which a test
 * cannot assert, but for the shape errors that let a placeholder ship: a
 * missing translation, an untagged artefact, a stage with nothing in it. And
 * one honesty check: the unbuilt stage must stay badged.
 *
 * Run: node --test src/pages/marketing/workflowGraph.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

/* `node --test` is plain ESM and cannot parse JSX. src/testing/jsxHook.mjs is
 * the repo's existing answer (see auth/signingGate.test.js, which renders real
 * components through it); registering it here lets this file import the
 * section's data straight from the component rather than keeping a second copy
 * of the pipeline in the test, which would defeat the point. */
register("../../testing/jsxHook.mjs", import.meta.url);
const { __test } = await import("./WorkflowGraph.jsx");
const { DICTATIONS } = await import("./dictations.js");

const { STAGES, buildGraph, VB } = __test;
const { nodes, edges } = buildGraph();

const bothLangs = (pair, where) => {
  assert.equal(pair.length, 2, `${where}: needs uk + en`);
  for (const s of pair) assert.ok(String(s).trim().length > 1, `${where}: empty string`);
};

test("the loop has every step, numbered in order", () => {
  assert.ok(STAGES.length >= 5, "a pipeline this short does not need a diagram");
  STAGES.forEach((s, i) => {
    assert.equal(s.n, String(i + 1).padStart(2, "0"), `${s.key}: number is out of sequence`);
    bothLangs(s.verb, `${s.key}.verb`);
    bothLangs(s.said, `${s.key}.said`);
    assert.ok(s.brand, `${s.key}: no product owns this step`);
    assert.ok(s.artefacts.length >= 3, `${s.key}: a step with <3 artefacts is not a step`);
  });
});

test("the pipeline covers capture through delivery", () => {
  // The claim the band makes is end-to-end. If a step is ever dropped, the
  // animation still runs and the claim quietly stops being true.
  const keys = STAGES.map((s) => s.key);
  for (const required of ["listen", "structure", "verify", "code", "sign", "deliver"]) {
    assert.ok(keys.includes(required), `the loop no longer includes "${required}"`);
  }
});

test("step 01 prints a real dictation, shared with the hero readout", () => {
  // Both readouts must be the same clinic; a divergent copy here is the bug
  // that dictations.js exists to prevent.
  const said = STAGES[0].said;
  const known = Object.values(DICTATIONS);
  assert.ok(known.some((d) => d[0] === said[0] && d[1] === said[1]),
    "the first step's line is not one of the shared dictations");
});

test("every artefact is tagged, named and captioned in both languages", () => {
  const kinds = new Set(["signal", "model", "evidence", "code", "crypto", "transport"]);
  for (const s of STAGES) {
    for (const a of s.artefacts) {
      assert.ok(kinds.has(a.kind), `${s.key}/${a.label[1]}: unknown kind ${a.kind}`);
      bothLangs(a.label, `${s.key}: artefact label`);
      bothLangs(a.meta, `${s.key}/${a.label[1]}: caption`);
    }
  }
});

test("no step lists the same artefact twice", () => {
  for (const s of STAGES) {
    const labels = s.artefacts.map((a) => a.label[1]);
    assert.equal(new Set(labels).size, labels.length, `${s.key}: duplicate artefact`);
  }
});

test("the verify step still carries real, attributed evidence", () => {
  const verify = STAGES.find((s) => s.key === "verify");
  const cited = verify.artefacts.filter((a) => a.kind === "evidence");
  assert.ok(cited.length >= 3, "verify must show more than a token source");
  // A trial has to carry its journal and year — a bare name is unverifiable,
  // and unverifiable citations are the exact failure this product prevents.
  const sprint = cited.find((a) => a.label[1] === "SPRINT");
  assert.ok(sprint, "SPRINT dropped out of the verify step");
  assert.match(sprint.meta[1], /NEJM 2015/);
});

test("the coding step uses real ICD-10 codes", () => {
  const coding = STAGES.find((s) => s.key === "code");
  const codes = coding.artefacts.filter((a) => a.kind === "code");
  assert.ok(codes.length >= 2, "coding step shows no codes");
  for (const c of codes) {
    assert.match(c.label[1], /^ICD-10 [A-Z]\d{2}(\.\d)?$/, `${c.label[1]} is not an ICD-10 code`);
    assert.match(c.label[0], /^МКХ-10 /, `${c.label[0]}: uk label must name МКХ-10`);
  }
});

test("unbuilt work stays marked as unbuilt", () => {
  // positioning.js keeps every Billing claim in `soon` because none of it
  // ships. The animation must not quietly promote it to a shipped step.
  const billing = STAGES.filter((s) => s.brand === "Billing");
  assert.ok(billing.length > 0, "the billing step vanished");
  for (const s of billing) assert.equal(s.soon, true, `${s.key}: unbuilt step is no longer badged`);
});

test("the graph is a closed loop with every artefact hanging off a step", () => {
  const stages = nodes.filter((n) => n.type === "stage");
  const arts = nodes.filter((n) => n.type === "art");
  assert.equal(stages.length, STAGES.length);
  assert.equal(arts.length, STAGES.reduce((n, s) => n + s.artefacts.length, 0));
  for (const a of arts) {
    const spur = edges.filter((e) => e.kind === "spur" && (e.a === a.id || e.b === a.id));
    assert.equal(spur.length, 1, `${a.label[1]} is not attached to exactly one step`);
  }
  // One flow edge per stage means the pipeline closes back on itself.
  const flow = edges.filter((e) => e.kind === "flow");
  assert.equal(flow.length, STAGES.length, "the loop is not closed");
  const fed = new Set(flow.map((e) => e.into));
  assert.equal(fed.size, STAGES.length, "some step is never reached by the pipeline");
});

test("the flow runs in pipeline order", () => {
  // Every flow edge goes from step i to step i+1; a mis-ordered ring animates
  // perfectly and tells the wrong story.
  const order = STAGES.map((s) => s.key);
  for (const e of edges.filter((x) => x.kind === "flow")) {
    const i = order.indexOf(e.from);
    assert.equal(e.into, order[(i + 1) % order.length], `${e.from} feeds the wrong step`);
  }
});

test("every node knows the step it lights up with", () => {
  const keys = new Set(STAGES.map((s) => s.key));
  for (const n of nodes) assert.ok(keys.has(n.stage), `a node has no step key`);
});

test("no tile can be pushed off the canvas by the layout or by its drift", () => {
  const widest = Math.max(...STAGES.flatMap((s) => s.artefacts.flatMap(
    (a) => [0, 1].map((i) => Math.max(a.label[i].length * 7.0, a.meta[i].length * 5.1) + 34),
  )));
  const half = widest / 2;
  for (const n of nodes.filter((x) => x.type === "art")) {
    assert.ok(n.x - half > 0, `${n.label[1]} overhangs the left edge`);
    assert.ok(n.x + half < VB.w, `${n.label[1]} overhangs the right edge`);
    assert.ok(n.y - 19 - n.amp > 0, `${n.label[1]} overhangs the top`);
    assert.ok(n.y + 19 + n.amp < VB.h, `${n.label[1]} overhangs the bottom`);
  }
});

test("the steps sit on one ring, evenly spaced — the loop is a circle, not a polygon", () => {
  /* The record travels by ANGLE along the ellipse, while each leg is drawn as
   * an elliptical arc between two points. Those two only describe the same
   * curve while the steps actually sit on the ring at even intervals — drop a
   * step, or nudge one off its seat, and the packet leaves the line it is
   * supposed to be running along.
   *
   * This is also what stops the band reverting to the hexagon it started as:
   * six points joined by straight chords, which is what it looked like before
   * the legs were curved. */
  const ring = nodes.filter((n) => n.type === "stage");
  const CX = VB.w / 2;
  const CY = VB.h / 2;

  for (const s of ring) {
    // On the ellipse: (x/rx)² + (y/ry)² === 1, to within a rounding error.
    const r = Math.hypot((s.x - CX) / 470, (s.y - CY) / 320);
    assert.ok(Math.abs(r - 1) < 0.001, `${s.stage} is not seated on the ring (r=${r.toFixed(3)})`);
    // …and its stored angle must agree with where it actually is, or the
    // packet and the arc disagree about the same leg.
    assert.ok(Math.abs(CX + Math.cos(s.angle) * 470 - s.x) < 0.001, `${s.stage}: angle disagrees with x`);
    assert.ok(Math.abs(CY + Math.sin(s.angle) * 320 - s.y) < 0.001, `${s.stage}: angle disagrees with y`);
  }

  const gap = (2 * Math.PI) / ring.length;
  for (let i = 1; i < ring.length; i++) {
    const d = ring[i].angle - ring[i - 1].angle;
    assert.ok(Math.abs(d - gap) < 1e-9, `steps ${i - 1}→${i} are not evenly spaced`);
  }
});

test("no two artefact tiles overlap, in either language, at any point in their drift", () => {
  /* The layout is derived from a handful of constants, so a change to the ring
   * or the spur silently piles citations on top of each other rather than
   * throwing. This caught SPRINT landing on NICE NG136 the moment the Verify
   * step grew to four artefacts — on a page arguing for traceable citations,
   * two of them overlapping is the worst collision available.
   *
   * Both languages, because the Ukrainian captions are the longer ones and the
   * tile widths follow the text. Drift amplitude is added to every box: a pair
   * that only just clears at rest will touch a second later. */
  const width = (label, meta) =>
    Math.max(84, Math.round(20 + Math.max(label.length * 7.0, meta.length * 5.1) + 14));

  const boxes = nodes.filter((n) => n.type === "art").flatMap((n) => [0, 1].map((i) => {
    const w = width(n.label[i], n.meta[i]);
    return {
      t: n.label[i], lang: i,
      x0: n.x - w / 2 - n.amp, x1: n.x + w / 2 + n.amp,
      y0: n.y - 19 - n.amp, y1: n.y + 19 + n.amp,
    };
  }));

  const hits = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.lang !== b.lang) continue;
      if (a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0) hits.push(`${a.t} × ${b.t}`);
    }
  }
  assert.deepEqual(hits, [], "artefact tiles overlap");
});

test("the centre stays clear for the copy that sits in it", () => {
  // The statement block is ~560×470 in a 1440×900 surface. No node may sit
  // inside it, or the diagram runs through the sentence — the defect that
  // grew the surface from 760 to 900 in the first place.
  const clear = { x0: VB.w / 2 - 300, x1: VB.w / 2 + 300, y0: VB.h / 2 - 240, y1: VB.h / 2 + 240 };
  for (const n of nodes) {
    const inside = n.x > clear.x0 && n.x < clear.x1 && n.y > clear.y0 && n.y < clear.y1;
    assert.ok(!inside, `${n.label?.[1] || n.stage} sits in the copy's clearing`);
  }
});
