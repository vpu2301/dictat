// chat/data/mockClient.test.js — the demo script's behaviour.
//
// The one acceptance criterion a screenshot can't prove: the SAME question
// returns a different answer with and without patient context. That is the
// demo, and it is worth a test that fails loudly if a fixture edit breaks it.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mockClient, pickAnswer, shapeAnswer, setMockConfig, getMockConfig,
  onMockConfigChange, STAGES, __resetSessions,
} from "./mockClient.js";
import { fallbackAnswer } from "./fixtures.js";

// Keep the suite fast: the latency exists for the UI, not for assertions.
setMockConfig({ latencyMs: 0, chunkMs: 0, stageMs: 0 });

const collect = async (question, opts) => {
  const out = { stages: [], entities: null, text: "", answer: null };
  for await (const part of mockClient.streamAnswer(question, opts)) {
    if (part.stage) out.stages.push(part.stage);
    if (part.entities) out.entities = part.entities;
    if (part.chunk) out.text += part.chunk;
    if (part.done) out.answer = part.answer;
  }
  return out;
};

test("patient context changes the answer to the same question", () => {
  const generic = pickAnswer("What HbA1c target should I aim for?");
  const contextual = pickAnswer("What HbA1c target should I aim for?", "pat_01");
  assert.notEqual(generic.recommendation, contextual.recommendation);
  assert.match(contextual.summary, /7\.8%/, "the contextual answer should use the patient's own labs");
  assert.ok(contextual.citations.length > generic.citations.length);
  assert.ok(contextual.confidence > generic.confidence, "context should raise confidence, not lower it");
});

test("a patient with no scripted variant falls back to the generic answer", () => {
  const generic = pickAnswer("HbA1c target?");
  const forOtherPatient = pickAnswer("HbA1c target?", "pat_02");
  assert.equal(forOtherPatient.recommendation, generic.recommendation);
});

test("an unscripted patient is admitted in the limitations, not papered over", async () => {
  // Real roster patients have no scripted variant. The answer must not keep
  // claiming "no patient context is attached" while a real name sits in the
  // header — it says the context was attached and unused.
  const run = [];
  for await (const part of mockClient.streamAnswer("HbA1c target?", { patientId: "usr-real-123" })) {
    if (part.done) run.push(part.answer);
  }
  assert.match(run[0].limitations, /no scripted variant/i);
  assert.match(run[0].limitations, /used none of their data/i);
  // …and it REPLACES the generic line, which claims the opposite.
  assert.equal(/no patient context is attached/i.test(run[0].limitations), false);

  // A patient the script DOES cover says no such thing.
  const scripted = [];
  for await (const part of mockClient.streamAnswer("HbA1c target?", { patientId: "pat_01" })) {
    if (part.done) scripted.push(part.answer);
  }
  assert.equal(/no scripted variant/i.test(scripted[0].limitations), false);
});

test("each demo patient has at least one contextualised script", () => {
  assert.match(pickAnswer("SGLT2 inhibitor?", "pat_01").recommendation, /eGFR 54/);
  assert.match(pickAnswer("asthma step-up?", "pat_02").summary, /inhaler technique/i);
  assert.match(pickAnswer("anticoagulation dosing?", "pat_03").summary, /INR/);
});

test("an unmatched question abstains instead of inventing advice", () => {
  const answer = pickAnswer("What is the airspeed velocity of an unladen swallow?");
  assert.equal(answer.recommendation, fallbackAnswer.recommendation);
  assert.equal(answer.abstained, true);
  assert.deepEqual(answer.citations, [], "an abstention cites nothing — it has nothing to cite");
});

test("shapeAnswer resolves citations to full evidence records", () => {
  const shaped = shapeAnswer(pickAnswer("HbA1c target?", "pat_01"), { language: "en" });
  assert.equal(shaped.citations.length, 3);
  assert.ok(shaped.citations.every((c) => c.id && c.evidenceLevel && c.source && c.year));
  assert.equal(shaped.citations[0].id, "ev_01", "citation order must match the [n] markers");
});

test("the stream walks every pipeline stage, in order, once", async () => {
  const run = await collect("HbA1c target?", { patientId: "pat_01" });
  assert.deepEqual(run.stages, STAGES);
});

test("entities arrive with the classifier, before the prose", async () => {
  const run = await collect("HbA1c target?", { patientId: "pat_01" });
  assert.ok(run.entities.length > 0);
  assert.match(run.entities.join(" "), /eGFR/);
});

test("the streamed prose assembles into the recommendation and summary", async () => {
  const run = await collect("HbA1c target?", { patientId: "pat_01" });
  const shaped = shapeAnswer(pickAnswer("HbA1c target?", "pat_01"), { language: "en" });
  assert.equal(run.text, `${shaped.recommendation}\n\n${shaped.summary}`);
  assert.equal(run.answer.citations.length, 3);
  assert.ok(run.answer.grade, "a shipped answer carries an evidence grade");
});

test("German is a whole answer, not a translated shell", async () => {
  const run = await collect("HbA1c Zielwert?", { patientId: "pat_01", language: "de" });
  assert.match(run.text, /eGFR 54 ml\/min/);
  assert.match(run.text, /Metformin bleibt/);
  assert.match(run.answer.citations[0].title, /Nationale VersorgungsLeitlinie/);
});

test("an aborted signal stops the stream without a done frame", async () => {
  setMockConfig({ chunkMs: 1, stageMs: 1 });
  const controller = new AbortController();
  let done = false;
  let saw = 0;
  for await (const part of mockClient.streamAnswer("HbA1c target?", { signal: controller.signal })) {
    saw += 1;
    if (part.chunk) controller.abort();
    if (part.done) done = true;
  }
  assert.equal(done, false, "a stopped answer must never be marked complete");
  assert.ok(saw >= 1);
  setMockConfig({ chunkMs: 0, stageMs: 0 });
});

test("the failure switch makes every call reject", async () => {
  setMockConfig({ fail: true });
  await assert.rejects(() => mockClient.getPatients(), /unavailable/);
  await assert.rejects(async () => {
    // eslint-disable-next-line no-unused-vars
    for await (const _ of mockClient.streamAnswer("HbA1c?")) { /* should throw before yielding */ }
  }, /unavailable/);
  setMockConfig({ fail: false });
});

test("the empty switch empties collections but never turns a real patient into a 404", async () => {
  setMockConfig({ empty: true });
  assert.deepEqual(await mockClient.getPatients(), []);
  assert.ok((await mockClient.getPatient("pat_01"))?.id === "pat_01");
  setMockConfig({ empty: false });
});

test("patient search matches name, diagnosis label and ICD code", async () => {
  assert.equal((await mockClient.getPatients("weber")).length, 1);
  assert.equal((await mockClient.getPatients("asthma"))[0].id, "pat_02");
  assert.equal((await mockClient.getPatients("I48.0"))[0].id, "pat_03");
  assert.deepEqual(await mockClient.getPatients("nobody"), []);
});

test("saved sessions join the history list, newest first, with the patient's name", async () => {
  __resetSessions();
  mockClient.saveSession({
    id: "ses_new", title: "New thread", patientId: "pat_03",
    updatedAt: "2026-08-01T10:00:00Z", messages: [{ id: "m1", role: "user", text: "hi" }],
  });
  const rows = await mockClient.getSessions();
  assert.equal(rows[0].id, "ses_new");
  assert.equal(rows[0].patientName, "Yusuf Demir");
  assert.equal(rows[0].messageCount, 1);
  __resetSessions();
});

test("a resumed session rebuilds its answer, in the reader's answer language", async () => {
  const en = await mockClient.getSession("ses_01");
  const answer = en.messages.find((m) => m.role === "assistant").answer;
  assert.equal(answer.citations.length, 3, "the seeded thread was held under pat_01");
  assert.match(answer.recommendation, /67-year-old/);

  const de = await mockClient.getSession("ses_01", { language: "de" });
  assert.match(de.messages.find((m) => m.role === "assistant").answer.recommendation, /67-jährigen/);
});

test("config changes notify subscribers so mounted queries refetch", () => {
  let seen = null;
  const unsubscribe = onMockConfigChange((cfg) => { seen = cfg; });
  setMockConfig({ latencyMs: 123 });
  assert.equal(seen?.latencyMs, 123);
  assert.equal(getMockConfig().latencyMs, 123);

  unsubscribe();
  setMockConfig({ latencyMs: 0 });
  assert.equal(seen.latencyMs, 123, "an unsubscribed listener stops hearing about changes");
});
