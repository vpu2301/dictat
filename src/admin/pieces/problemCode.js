// problemCode.js — machine codes out of RFC-9457 problem bodies, whichever of
// the backend's two dialects they arrive in.
//
// The fleet has exactly one properly-machine-readable error: the MFA gate's
// top-level `"code": "mfa_enrolment_required"` extension member. Every other
// coded error lives on autocomplete-service, which raises HTTPException with a
// DICT detail — and the shared problem-details handler stringifies that dict
// with Python's repr, so the wire carries
//
//   "detail": "{'error': 'pii_detected', 'patterns': ['phone'], 'field':
//              'phrase', 'message': 'містить дані, схожі на персональні — не
//              збережено'}"
//
// single quotes and all — NOT JSON. This module owns the tolerance: it reads
// (a) the top-level `code`, (b) a real-JSON detail should the backend upgrade
// (the filed ask is to move these to problem_extras), and (c) the Python-repr
// string of today. UI code branches on the returned code and never regexes
// wire strings itself.
//
// JSX-free on purpose — unit-tested under node --test with the exact repr
// strings from the backend contract.

/** Full parse: { code, patterns, field, message, retry_after } (nulls when absent). */
export function problemInfo(err) {
  const out = { code: null, patterns: [], field: null, message: null, retry_after: null };
  const p = err?.problem;
  if (!p || typeof p !== "object") return out;

  // (a) a first-class extension member (the MFA gate's shape).
  if (typeof p.code === "string" && p.code) out.code = p.code;

  const d = p.detail;

  // (b) a structured detail — today impossible on the wire, but the shape the
  // backend would emit after the filed problem_extras fix.
  if (d && typeof d === "object") return { ...out, ...fromDict(d) };

  if (typeof d === "string" && d.trim().startsWith("{")) {
    // Real JSON first (double quotes), then the Python repr of today.
    try {
      return { ...out, ...fromDict(JSON.parse(d)) };
    } catch {
      const parsed = fromRepr(d);
      if (parsed.code) return { ...out, ...parsed };
    }
  }
  return out;
}

/** Just the machine code (or null): "pii_detected", "mfa_enrolment_required", … */
export function problemCode(err) {
  return problemInfo(err).code;
}

/** The PII pattern names when the error is the PII rejection; else []. */
export function piiPatternsFrom(err) {
  const info = problemInfo(err);
  return info.code === "pii_detected" ? info.patterns : [];
}

function fromDict(d) {
  return {
    code: typeof d.error === "string" ? d.error : typeof d.code === "string" ? d.code : null,
    patterns: Array.isArray(d.patterns) ? d.patterns.map(String) : [],
    field: typeof d.field === "string" ? d.field : null,
    message: typeof d.message === "string" ? d.message : null,
    retry_after: Number.isFinite(d.retry_after) ? d.retry_after : null,
  };
}

// The repr grammar we rely on is narrow: string values are single-quoted and
// the keys we read ('error', 'patterns', 'field', 'message', 'retry_after')
// are ASCII. Values may contain Cyrillic; they may NOT contain an escaped
// single quote — if the backend ever emits one the message merely truncates,
// the code still parses.
function fromRepr(s) {
  const str = (key) => {
    const m = s.match(new RegExp(`'${key}':\\s*'([^']*)'`));
    return m ? m[1] : null;
  };
  const num = (key) => {
    const m = s.match(new RegExp(`'${key}':\\s*(\\d+)`));
    return m ? Number(m[1]) : null;
  };
  const list = (key) => {
    const m = s.match(new RegExp(`'${key}':\\s*\\[([^\\]]*)\\]`));
    if (!m) return [];
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  };
  return {
    code: str("error"),
    patterns: list("patterns"),
    field: str("field"),
    message: str("message"),
    retry_after: num("retry_after"),
  };
}
