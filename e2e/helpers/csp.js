// csp.js — collect Content-Security-Policy violations from a page.
//
// A violation is not a console error and does not fail a request in any way
// Playwright notices by default: the browser refuses the resource, fires a
// `securitypolicyviolation` event at the document, and the app carries on
// looking almost right. Which is precisely how a CSP regression reaches
// production — the screen renders, one font is wrong, and nobody looks.
//
// So the suite listens for the event itself. `addInitScript` installs the
// listener before any of the page's own script runs, so violations raised
// during the very first parse (an inline <style>, a third-party stylesheet in
// <head>) are caught too — those are the ones a listener attached after
// `goto` would miss entirely.

export const CSP_COLLECTOR = () => {
  window.__cspViolations = [];
  document.addEventListener("securitypolicyviolation", (e) => {
    window.__cspViolations.push({
      directive: e.effectiveDirective || e.violatedDirective,
      blocked: e.blockedURI,
      sample: e.sample || "",
      source: e.sourceFile || "",
      line: e.lineNumber || 0,
      disposition: e.disposition,
    });
  });
};

/** Install the collector. Call before `page.goto`. */
export async function collectCspViolations(page) {
  await page.addInitScript(CSP_COLLECTOR);
}

/** Everything the page has refused so far. */
export async function cspViolations(page) {
  return page.evaluate(() => window.__cspViolations || []);
}

/**
 * Parse a policy header into { directive: [sources] }.
 * Used to assert what the policy SAYS as well as what it does — a policy can
 * be violation-free simply by being absent.
 */
export function parseCsp(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) out[name] = sources;
  }
  return out;
}
