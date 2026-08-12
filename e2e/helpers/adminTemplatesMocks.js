// adminTemplatesMocks.js — the mocked report-service the templates-admin spec
// drives (sprint 17, FE-B slice).
//
// Composes with installAdminMocks (auth/users/audit): install THIS after it —
// Playwright matches routes newest-first, so /templates* lands here and
// everything else falls through to the admin mock's catch-all.
//
// The PUT handler mimics the backend classifier's verdict the same way the
// real repository does: a changed section-id set ⇒ STRUCTURAL ⇒ a NEW row
// (parent_template_id = the edited one, schema_version reset, status draft)
// and {id: <new>, kind: "structural"}; otherwise cosmetic in place.

const uuid = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;

export const SYS_TPL_ID = uuid(101);
export const TENANT_TPL_ID = uuid(201);
export const SUCCESSOR_TPL_ID = uuid(202);
export const DRAFT_REPORT_ID = uuid(901);
export const FINALIZED_REPORT_ID = uuid(902);

const SECTIONS = () => ([
  {
    id: "skarhy", name: "Скарги", field_type: "free_text", required: true,
    min_chars: 0, asr_prompt: "", voice_aliases: ["скарги"], order: 0,
  },
  {
    id: "smoking", name: "Паління", field_type: "choice", required: false,
    min_chars: 0, asr_prompt: "", voice_aliases: ["паління"], order: 1,
    options: [
      { value: "never", label: "Ніколи не палив", voice_aliases: ["не палить"] },
      { value: "current", label: "Палить", voice_aliases: ["палить"] },
    ],
  },
]);

const makeTpl = (over = {}) => ({
  id: uuid(999), tenant_id: "t-a", parent_template_id: null,
  code: "tpl", name: "Template", language: "uk", specialty: "cardiology",
  schema_version: 1, is_system: false, status: "draft",
  created_at: "2026-08-01T10:00:00Z", updated_at: "2026-08-05T10:00:00Z",
  schema_jsonb: null,
  ...over,
});

export function defaultTemplates() {
  const def = (code, name) => ({
    code, name, language: "uk", specialty: "cardiology",
    schema_version: 1, sections: SECTIONS(),
  });
  return [
    makeTpl({
      id: SYS_TPL_ID, tenant_id: null, is_system: true, status: "active",
      code: "cardiology_outpatient_uk", name: "Кардіологічний огляд",
      schema_jsonb: def("cardiology_outpatient_uk", "Кардіологічний огляд"),
    }),
    makeTpl({
      id: TENANT_TPL_ID, parent_template_id: SYS_TPL_ID, status: "draft",
      code: "cardio_clinic_uk", name: "Кардіо (клініка)",
      schema_jsonb: def("cardio_clinic_uk", "Кардіо (клініка)"),
    }),
    makeTpl({
      id: SUCCESSOR_TPL_ID, status: "active",
      code: "cardio_clinic_uk_v2", name: "Кардіо наступник",
      schema_jsonb: def("cardio_clinic_uk_v2", "Кардіо наступник"),
    }),
  ];
}

export function defaultBoundReports() {
  return {
    [TENANT_TPL_ID]: [
      { report_id: DRAFT_REPORT_ID, status: "draft",
        created_at: "2026-08-06T09:00:00Z", updated_at: "2026-08-07T09:00:00Z" },
      { report_id: FINALIZED_REPORT_ID, status: "finalized",
        created_at: "2026-07-01T09:00:00Z", updated_at: "2026-07-02T09:00:00Z" },
    ],
  };
}

const DEV_SERVER_PORT = "5173";

export async function installTemplateMocks(page, {
  templates = defaultTemplates(),
  boundReports = defaultBoundReports(),
} = {}) {
  const tctl = {
    templates: templates.map((t) => ({ ...t, schema_jsonb: t.schema_jsonb ? JSON.parse(JSON.stringify(t.schema_jsonb)) : null })),
    bound: JSON.parse(JSON.stringify(boundReports)),
    nextId: 300,
    calls: { puts: [], posts: [], clones: [], rebinds: [], deletes: [] },
    // Armed ⇒ the next PUT/POST answers this 422 (backend-only validation,
    // e.g. an option-collision the client mirror cannot see).
    put422: null,
  };

  const isApi = (url) =>
    url.hostname === "localhost" && !!url.port && url.port !== DEV_SERVER_PORT;

  const summaryOf = (t) => {
    const { schema_jsonb, ...rest } = t;
    return rest;
  };
  const byId = (id) => tctl.templates.find((t) => t.id === id) || null;

  await page.route(isApi, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();

    if (!path.startsWith("/templates")) return route.fallback();

    const json = (status, body) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    const problem = (status, detail, extras = {}) =>
      json(status, { type: "about:blank", title: "Problem", status, detail, instance: "urn:uuid:mock", ...extras });

    // ── list ───────────────────────────────────────────────────────────
    if (path === "/templates" && method === "GET") {
      const q = url.searchParams;
      let rows = tctl.templates;
      if (q.get("language")) rows = rows.filter((t) => t.language === q.get("language"));
      if (q.get("specialty")) rows = rows.filter((t) => t.specialty === q.get("specialty"));
      if (q.get("tenant_only") === "true") rows = rows.filter((t) => t.tenant_id != null);
      if (q.get("include_deprecated") !== "true") rows = rows.filter((t) => t.status !== "deprecated");
      const limit = Number(q.get("limit") || 50);
      return json(200, rows.slice(0, limit).map(summaryOf));
    }

    // ── create / clone ─────────────────────────────────────────────────
    if (path === "/templates" && method === "POST") {
      if (tctl.put422) { const b = tctl.put422; tctl.put422 = null; return json(422, b); }
      const body = req.postDataJSON?.() || {};
      tctl.calls.posts.push(body);
      const id = uuid(tctl.nextId++);
      tctl.templates.push(makeTpl({
        id, code: body.code, name: body.name, language: body.language,
        specialty: body.specialty || "", schema_jsonb: body, status: "draft",
      }));
      return json(201, { id });
    }
    if (path === "/templates/clone" && method === "POST") {
      const body = req.postDataJSON?.() || {};
      tctl.calls.clones.push(body);
      const src = byId(body.system_template_id);
      if (!src) return problem(404, "template not found");
      const id = uuid(tctl.nextId++);
      const code = body.new_code || `${src.code}_custom`;
      const name = body.new_name || src.name;
      tctl.templates.push(makeTpl({
        id, parent_template_id: src.id, code, name,
        language: src.language, specialty: src.specialty, status: "draft",
        schema_jsonb: { ...JSON.parse(JSON.stringify(src.schema_jsonb)), code, name },
      }));
      return json(201, { id });
    }

    // ── bound-reports / rebind ─────────────────────────────────────────
    let m = path.match(/^\/templates\/([0-9a-f-]+)\/bound-reports$/);
    if (m && method === "GET") {
      if (!byId(m[1])) return problem(404, "template not found");
      return json(200, tctl.bound[m[1]] || []);
    }
    m = path.match(/^\/templates\/([0-9a-f-]+)\/rebind$/);
    if (m && method === "POST") {
      const src = byId(m[1]);
      if (!src) return problem(404, "template not found");
      const body = req.postDataJSON?.() || {};
      tctl.calls.rebinds.push({ template_id: m[1], ...body });
      const rows = tctl.bound[m[1]] || [];
      const row = rows.find((r) => r.report_id === body.report_id);
      if (!row) return problem(409, "report is not bound to this template");
      if (row.status !== "draft")
        return problem(409, "only draft reports can be re-bound; finalized and signed reports keep their template");
      if (body.to_template_id === m[1])
        return problem(409, "report is already bound to this template");
      const target = byId(body.to_template_id);
      if (!target) return problem(404, "target template not visible");
      if (target.status === "deprecated") return problem(409, "target template is deprecated");
      if (target.language !== src.language)
        return problem(409, "target template language differs from the source template");
      tctl.bound[m[1]] = rows.filter((r) => r.report_id !== body.report_id);
      (tctl.bound[body.to_template_id] ||= []).push({ ...row, updated_at: "2026-08-08T12:00:00Z" });
      return json(200, {
        report_id: body.report_id, from_template_id: m[1], to_template_id: body.to_template_id,
      });
    }

    // ── section prompt peek ────────────────────────────────────────────
    m = path.match(/^\/templates\/([0-9a-f-]+)\/sections\/([a-z0-9_]+)\/prompt$/);
    if (m && method === "GET") {
      const t = byId(m[1]);
      const s = t?.schema_jsonb?.sections?.find((x) => x.id === m[2]);
      if (!t || !s) return problem(404, "not found");
      return json(200, { prompt: s.asr_prompt || "", language: t.language, section_name: s.name });
    }

    // ── detail / update / deprecate ────────────────────────────────────
    m = path.match(/^\/templates\/([0-9a-f-]+)$/);
    if (m && method === "GET") {
      const t = byId(m[1]);
      return t ? json(200, t) : problem(404, "template not found");
    }
    if (m && method === "PUT") {
      const t = byId(m[1]);
      if (!t) return problem(404, "template not found");
      if (t.tenant_id == null) return problem(409, "system templates are read-only; clone first");
      if (tctl.put422) { const b = tctl.put422; tctl.put422 = null; return json(422, b); }
      const body = req.postDataJSON?.() || {};
      tctl.calls.puts.push({ id: m[1], body });
      const oldIds = (t.schema_jsonb?.sections || []).map((s) => s.id).sort().join(",");
      const newIds = (body.sections || []).map((s) => s.id).sort().join(",");
      const structural =
        oldIds !== newIds ||
        t.schema_jsonb?.code !== body.code ||
        t.schema_jsonb?.language !== body.language;
      if (structural) {
        const id = uuid(tctl.nextId++);
        tctl.templates.push(makeTpl({
          id, parent_template_id: t.id, code: body.code, name: body.name,
          language: body.language, specialty: body.specialty || t.specialty,
          schema_version: 1, status: "draft", schema_jsonb: body,
          updated_at: "2026-08-08T12:00:00Z",
        }));
        return json(200, { id, kind: "structural" });
      }
      const changed = JSON.stringify(t.schema_jsonb) !== JSON.stringify(body);
      if (changed) {
        t.schema_jsonb = body;
        t.name = body.name;
        t.schema_version += 1;
        t.updated_at = "2026-08-08T12:00:00Z";
        return json(200, { id: t.id, kind: "cosmetic" });
      }
      return json(200, { id: t.id, kind: "no_change" });
    }
    if (m && method === "DELETE") {
      const t = byId(m[1]);
      if (!t) return problem(404, "template not found");
      tctl.calls.deletes.push(m[1]);
      const drafts = (tctl.bound[m[1]] || []).filter((r) => r.status === "draft");
      if (drafts.length)
        return problem(409, "templates referenced by draft reports cannot be deprecated; re-bind the drafts to a successor template first");
      t.status = "deprecated";
      t.updated_at = "2026-08-08T12:00:00Z";
      return json(200, { status: "deprecated" });
    }

    return route.fallback();
  });

  return tctl;
}

// A backend-only 422 in the REAL wire shape (RequestValidationError):
// `errors[]` carries loc/msg/type, `detail` is the fixed sentence.
export function optionCollision422(sectionIdx = 1) {
  return {
    type: "https://datatracker.ietf.org/doc/html/rfc9457#section-3",
    title: "Unprocessable Content",
    status: 422,
    detail: "Request validation failed.",
    instance: "urn:uuid:mock",
    errors: [{
      loc: ["body", "sections", sectionIdx, "options"],
      msg: "Value error, section 'smoking': option voice_alias 'не палить' duplicated across options",
      type: "value_error",
    }],
  };
}
