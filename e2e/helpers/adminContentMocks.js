// adminContentMocks.js — mocked nlp/autocomplete/report-service backends for
// the sprint-17 content surfaces (dictionary, autocomplete corpus, synonyms).
//
// Installed AFTER installAdminMocks: Playwright consults handlers newest-first,
// so this one fields the content-service paths and falls back for everything
// else (auth, users, audit stay with the base installer).
//
// Wire fidelity notes:
//   · PUT /nlp/abbreviations answers 204 WITH NO BODY and no id — the page
//     must re-list, which is exactly what the spec asserts.
//   · The PII rejection is served as the EXACT Python-repr string the real
//     problem-details handler emits when a router raises a dict detail.
//   · Synonym writes against a system group answer the deliberate 404.

const DEV_SERVER_PORT = "5173";

export function defaultAbbreviations() {
  return [
    {
      id: "5y5a0000-0000-4000-8000-000000000001", tenant_id: null,
      language: "uk", expanded: "частота дихання", abbreviated: "ЧД",
      direction: "expand", domain: null, case_sensitive: true,
      is_tenant_override: false,
    },
  ];
}

export function defaultPhrases() {
  return [
    {
      id: "ac9a0000-0000-4000-8000-000000000001",
      phrase: "аускультація легень без хрипів", language: "uk",
      specialty: "терапія", section_hint: null, source: "system",
      impression_count: 120, acceptance_count: 40,
      last_accepted_at: "2026-08-01T10:00:00Z", created_at: "2026-05-01T00:00:00Z",
    },
    {
      id: "ac9a0000-0000-4000-8000-000000000002",
      phrase: "тони серця ритмічні", language: "uk",
      specialty: null, section_hint: "exam", source: "tenant",
      impression_count: 30, acceptance_count: 12,
      last_accepted_at: "2026-08-05T10:00:00Z", created_at: "2026-06-01T00:00:00Z",
    },
  ];
}

export function defaultSnippets() {
  return [
    {
      id: "ac9b0000-0000-4000-8000-000000000001",
      trigger: "norm", expansion: "Без патологічних змін.", cursor_position: 24,
      language: "uk", source: "tenant", created_at: "2026-06-01T00:00:00Z",
    },
  ];
}

export function defaultSynonymGroups() {
  return [
    {
      group_id: "5g5a0000-0000-4000-8000-000000000001", source: "system",
      language: "uk", terms: ["інфаркт міокарда", "ГІМ"],
    },
    {
      group_id: "5g5a0000-0000-4000-8000-000000000002", source: "tenant",
      language: "uk", terms: ["набряк", "набряки"],
    },
  ];
}

// The server-side phone detector (scrubber.py): any bare 7–14 digit run.
const PHONE_RE = /(?<!\d)\+?\d{7,14}(?!\d)/;

const piiRepr = (patterns, field) =>
  `{'error': 'pii_detected', 'patterns': [${patterns.map((p) => `'${p}'`).join(", ")}], ` +
  `'field': '${field}', 'message': 'містить дані, схожі на персональні — не збережено'}`;

export async function installContentMocks(page, {
  abbreviations = defaultAbbreviations(),
  phrases = defaultPhrases(),
  snippets = defaultSnippets(),
  synonymGroups = defaultSynonymGroups(),
} = {}) {
  const ctl = {
    abbreviations: abbreviations.map((a) => ({ ...a })),
    phrases: phrases.map((p) => ({ ...p })),
    snippets: snippets.map((s) => ({ ...s })),
    synonymGroups: synonymGroups.map((g) => ({ ...g, terms: [...g.terms] })),
    processCalls: [],
    searchQueries: [],
    seq: 0,
  };
  const nextId = (prefix) => `${prefix}0000-0000-4000-8000-${String(++ctl.seq + 100).padStart(12, "0")}`;

  const isApi = (url) =>
    url.hostname === "localhost" && !!url.port && url.port !== DEV_SERVER_PORT;

  await page.route(isApi, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    const json = (status, body) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    const problem = (status, detail, extras = {}) =>
      json(status, {
        type: "about:blank", title: "Problem", status, detail,
        instance: "urn:uuid:mock", ...extras,
      });
    const noContent = () => route.fulfill({ status: 204, body: "" });

    // ── nlp-service ──────────────────────────────────────────────────
    if (path === "/nlp/abbreviations" && method === "GET") {
      const language = url.searchParams.get("language");
      let rows = ctl.abbreviations;
      if (language) rows = rows.filter((a) => a.language === language);
      // tenant overrides first, like the real ORDER BY tenant_id NULLS LAST
      rows = [...rows].sort((a, b) => Number(b.is_tenant_override) - Number(a.is_tenant_override));
      return json(200, rows);
    }
    if (path === "/nlp/abbreviations" && method === "PUT") {
      const b = req.postDataJSON?.() || {};
      const key = (x) => `${x.language}:${x.expanded}:${x.abbreviated}`;
      const existing = ctl.abbreviations.find(
        (a) => a.is_tenant_override && key(a) === key(b));
      if (existing) Object.assign(existing, b);
      else ctl.abbreviations.push({
        id: nextId("ab1a"), tenant_id: "tid", is_tenant_override: true,
        domain: null, case_sensitive: true, ...b,
      });
      return noContent();
    }
    const abbrevDel = path.match(/^\/nlp\/abbreviations\/([0-9a-z-]+)$/);
    if (abbrevDel && method === "DELETE") {
      const i = ctl.abbreviations.findIndex((a) => a.id === abbrevDel[1] && a.is_tenant_override);
      if (i < 0) return problem(404, "None");
      ctl.abbreviations.splice(i, 1);
      return noContent();
    }
    if (path === "/nlp/process" && method === "POST") {
      const b = req.postDataJSON?.() || {};
      ctl.processCalls.push(b);
      const disabled = new Set(b.stages_disabled || []);
      let text = String(b.text || "");
      const warnings = [];
      if (!disabled.has("abbreviation")) {
        for (const rule of ctl.abbreviations) {
          if (rule.language !== b.language) continue;
          if (rule.direction === "compact") continue;
          const re = new RegExp(rule.abbreviated.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
          text = text.replace(re, rule.expanded);
        }
      } else {
        warnings.push({ code: "stage_disabled", stage: "abbreviation", detail: "disabled by request" });
      }
      return json(200, {
        text, words: [], pipeline_version: "mock-1", metadata: {},
        confidence_spans: [], voice_commands: [], operations: [], warnings,
      });
    }

    // ── autocomplete-service ─────────────────────────────────────────
    if (path === "/autocomplete/phrases" && method === "GET") {
      const q = url.searchParams;
      let rows = ctl.phrases;
      if (q.get("language")) rows = rows.filter((p) => p.language === q.get("language"));
      if (q.get("source")) rows = rows.filter((p) => p.source === q.get("source"));
      if (q.get("specialty")) rows = rows.filter((p) => (p.specialty || "") === q.get("specialty"));
      return json(200, rows.slice(0, Number(q.get("limit") || 50)));
    }
    if (path === "/autocomplete/phrases" && method === "POST") {
      const b = req.postDataJSON?.() || {};
      if (PHONE_RE.test(b.phrase || ""))
        return problem(422, piiRepr(["phone"], "phrase"));
      if (ctl.phrases.some((p) => p.phrase === b.phrase && p.language === b.language))
        return problem(409, "{'error': 'phrase_already_exists'}");
      const row = {
        id: nextId("ac1a"), phrase: b.phrase, language: b.language,
        specialty: b.specialty ?? null, section_hint: b.section_hint ?? null,
        source: b.source || "user", impression_count: 0, acceptance_count: 0,
        last_accepted_at: null, created_at: new Date().toISOString(),
      };
      ctl.phrases.push(row);
      return json(201, {
        id: row.id, phrase: row.phrase, language: row.language,
        specialty: row.specialty, section_hint: row.section_hint,
        source: row.source, impression_count: 0, acceptance_count: 0,
      });
    }
    const phraseDel = path.match(/^\/autocomplete\/phrases\/([0-9a-z-]+)$/);
    if (phraseDel && method === "DELETE") {
      const i = ctl.phrases.findIndex((p) => p.id === phraseDel[1]);
      if (i < 0) return problem(404, "None");
      ctl.phrases.splice(i, 1);
      return noContent();
    }
    if (path === "/autocomplete/snippets" && method === "GET") {
      const q = url.searchParams;
      let rows = ctl.snippets;
      if (q.get("language")) rows = rows.filter((s) => s.language === q.get("language"));
      if (q.get("source")) rows = rows.filter((s) => s.source === q.get("source"));
      return json(200, rows.slice(0, Number(q.get("limit") || 50)));
    }
    if (path === "/autocomplete/snippets" && method === "POST") {
      const b = req.postDataJSON?.() || {};
      for (const [field, value] of [["trigger", b.trigger], ["expansion", b.expansion]]) {
        if (PHONE_RE.test(value || "")) return problem(422, piiRepr(["phone"], field));
      }
      if (ctl.snippets.some((s) => s.trigger === b.trigger && s.language === b.language))
        return problem(409, "{'error': 'snippet_already_exists'}");
      const row = {
        id: nextId("ac2a"), trigger: b.trigger, expansion: b.expansion,
        cursor_position: b.cursor_position, language: b.language,
        source: b.source || "user", created_at: new Date().toISOString(),
      };
      ctl.snippets.push(row);
      return json(201, {
        id: row.id, trigger: row.trigger, expansion: row.expansion,
        cursor_position: row.cursor_position, language: row.language, source: row.source,
      });
    }
    const snippetDel = path.match(/^\/autocomplete\/snippets\/([0-9a-z-]+)$/);
    if (snippetDel && method === "DELETE") {
      const i = ctl.snippets.findIndex((s) => s.id === snippetDel[1]);
      if (i < 0) return problem(404, "None");
      ctl.snippets.splice(i, 1);
      return noContent();
    }

    // ── report-service: synonyms + the search probe ──────────────────
    if (path === "/v1/synonyms" && method === "GET") return json(200, ctl.synonymGroups);
    if (path === "/v1/synonyms" && method === "POST") {
      const b = req.postDataJSON?.() || {};
      const row = {
        group_id: nextId("5g1a"), source: "tenant",
        language: b.language, terms: [...b.terms].sort(),
      };
      ctl.synonymGroups.push(row);
      return json(201, row);
    }
    const synOne = path.match(/^\/v1\/synonyms\/([0-9a-z-]+)$/);
    if (synOne && (method === "PUT" || method === "DELETE")) {
      const g = ctl.synonymGroups.find((x) => x.group_id === synOne[1]);
      // System groups are RLS-invisible to writes: the deliberate 404.
      if (!g || g.source !== "tenant")
        return problem(404, "tenant synonym group not found");
      if (method === "DELETE") {
        ctl.synonymGroups = ctl.synonymGroups.filter((x) => x !== g);
        return noContent();
      }
      const b = req.postDataJSON?.() || {};
      g.terms = [...b.terms].sort();
      if (b.language) g.language = b.language;
      return json(200, g);
    }
    if (path === "/v1/reports/search" && method === "GET") {
      ctl.searchQueries.push(url.search);
      const q = (url.searchParams.get("q") || "").toLowerCase();
      const expandOff = url.searchParams.get("expand") === "false";
      let expanded_terms = [];
      if (q && !expandOff) {
        const hit = ctl.synonymGroups.find((g) =>
          g.terms.some((t) => t.toLowerCase() === q));
        if (hit && hit.terms.length > 1) expanded_terms = [...hit.terms];
      }
      return json(200, {
        hits: [], next_cursor: null, total_estimated: 0, expanded_terms,
      });
    }

    return route.fallback();
  });

  return ctl;
}
