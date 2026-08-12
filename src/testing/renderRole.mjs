// renderRole.mjs — render a real component as a given role and read back the
// markup, inside `node --test`.
//
// The signing hotfix has to prove a negative: a nurse must not merely be
// unable to click the sign button, the button must not be in what she is
// served. Grepping the source cannot show that (the JSX is in the file either
// way — the question is whether the branch renders), and this repo has no
// jsdom or @testing-library. `renderToStaticMarkup` answers it exactly:
// it runs the component's render path for real, with real props and real
// context, and hands back the markup that would reach the browser.
//
// Effects do NOT run under static rendering. That is a feature here: no fetch
// fires, so a component's data calls stay quiet and the assertion is about the
// role gate alone rather than about a mocked network.

import { register } from "node:module";

register("./jsxHook.mjs", import.meta.url);

// Imported AFTER the hook is registered — these pull in .jsx transitively.
const { createElement } = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const { AuthContext } = await import("../auth/AuthContext.jsx");

/** A claims fixture for one role. `sub` is a stable fake — never a real id. */
export function claimsFor(...roles) {
  return { sub: "00000000-0000-4000-8000-00000000d0c5", roles, tid: "t-test" };
}

export const ROLES = {
  clinician: claimsFor("clinician"),
  nurse: claimsFor("nurse"),
  tenant_admin: claimsFor("tenant_admin"),
  auditor: claimsFor("auditor"),
  // A practising doctor who also administers the clinic carries BOTH — the
  // clinical surfaces admit them on the clinician role (see roles.js).
  clinician_admin: claimsFor("clinician", "tenant_admin"),
};

/**
 * Render `element` with the auth context set to `claims`, and return the
 * markup. Rendering is wrapped so that a component which throws under static
 * rendering (a browser-only dependency, say) fails the test loudly instead of
 * silently producing "" — an empty string would make every absence assertion
 * pass for the wrong reason.
 */
export function renderAs(claims, element) {
  const markup = renderToStaticMarkup(
    createElement(AuthContext.Provider, { value: { state: { claims } } }, element),
  );
  if (typeof markup !== "string") throw new Error("render produced no markup");
  return markup;
}

/** Render without any auth context at all — the logged-out / stale case. */
export function renderAnonymous(element) {
  return renderAs(null, element);
}

export { createElement as h };
