// answerStream.js — the answer fixtures for the EVA-S04 suite.
//
// Data only. The transport is `sseServer.js` (a real HTTP server, because a
// stream mock that delivers atomically tests none of what a stream is for).
//
// ONE definition of the answer, used both as the event script and as what
// `GET /answers/:id` returns — which is what makes the reopen-equality
// assertion (AC-S04-F-3) mean something. Two fixtures that happened to agree
// would prove nothing about the two code paths.

export const ANSWER_ID = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
export const QUESTION = "Яка перша лінія терапії артеріальної гіпертензії?";

export const CORPUS_SOURCE = {
  id: "src-corpus-1",
  kind: "corpus",
  title: "Уніфікований клінічний протокол: артеріальна гіпертензія",
  evidence_tier: "guideline",
  source_authority: "national",
  document_version_id: "dv-hypertension-2024",
};

export const WEB_SOURCE = {
  id: "src-web-1",
  kind: "web",
  title: "Hypertension in adults: diagnosis and management",
  evidence_tier: "guideline",
  source_authority: "international",
  web: {
    domain: "nice.org.uk",
    url: "https://www.nice.org.uk/guidance/ng136",
    trust_tier: "guideline_registry",
    accessed_at: "2026-08-01T09:15:00Z",
    snapshot_ref: null,
  },
};

const seg = (id, kind, text, citations) => ({ id, kind, text, ...(citations ? { citations } : {}) });

/** All six kinds — three in the summary, three in the detail (AC-S04-F-1). */
export const SUMMARY_SEGMENTS = [
  seg("s1", "evidence", "Тіазидний діуретик або іАПФ — перша лінія терапії.", [{ source_id: "src-corpus-1" }]),
  seg("s2", "patient_fact", "Дані конкретного пацієнта не використано — режим загальний."),
  seg("s3", "interpretation", "Вибір між класами залежить від супутніх станів."),
];
export const DETAIL_SEGMENTS = [
  seg("d1", "uncertainty", "Дані щодо пацієнтів понад 80 років суперечливі.", [{ source_id: "src-web-1" }]),
  seg("d2", "missing_info", "Функція нирок у запиті не вказана."),
  seg("d3", "next_step", "Оцінити ШКФ та рівень калію перед призначенням."),
];

export const ALL_KINDS = [
  "evidence", "patient_fact", "interpretation", "uncertainty", "missing_info", "next_step",
];

/** What GET /answers/:id returns. */
export function answerEnvelope(overrides = {}) {
  return {
    answer_id: ANSWER_ID,
    provenance_ref: "prov-1",
    contract_version: "1.0",
    status: "ok",
    question: QUESTION,
    summary_segments: SUMMARY_SEGMENTS,
    detail_segments: DETAIL_SEGMENTS,
    sources: [CORPUS_SOURCE, WEB_SOURCE],
    flags: [],
    checks: [],
    followups: [],
    ...overrides,
  };
}

/**
 * The frames that add up to that envelope, as [event, payload] pairs the
 * server writes in order. `meta` first, always: until the answer has an id a
 * drop is genuinely unrecoverable, and the resume path depends on it.
 */
export function happyFrames() {
  return [
    ["meta", { answer_id: ANSWER_ID, provenance_ref: "prov-1", contract_version: "1.0" }],
    ...SUMMARY_SEGMENTS.map((s, i) => ["segment", { area: "summary", index: i, segment: s }]),
    ...DETAIL_SEGMENTS.map((s, i) => ["segment", { area: "detail", index: i, segment: s }]),
    ["source", { index: 0, source: CORPUS_SOURCE }],
    ["source", { index: 1, source: WEB_SOURCE }],
    ["done", { status: "ok" }],
  ];
}

/** Everything except the web source and the terminal frame. */
export function corpusOnlyFrames() {
  return happyFrames().filter(
    ([event, data]) => event !== "done" && !(event === "source" && data.source.kind === "web"),
  );
}

/** Flip the DEV-only flag overrides services.js accepts, before the app boots. */
export function enableEvidenceFlags(page, flags = ["evidence"]) {
  return page.addInitScript((keys) => {
    try {
      for (const k of keys) localStorage.setItem(`mdx.flag.${k}`, "1");
    } catch { /* ignore */ }
  }, flags);
}
