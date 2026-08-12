// jsxHook.mjs — a Node module-resolution hook that compiles .jsx on import.
//
// Why this exists: the unit suite is `node --test` over plain ESM, which
// cannot parse JSX — so until now the only way to assert something about a
// component was to grep its source (src/admin/noAuditExport.test.js). Grep
// proves a token is absent from a FILE. It cannot prove an affordance is
// absent from what a NURSE actually sees, which is the claim the signing
// hotfix has to make.
//
// esbuild is already in the tree (vite depends on it), so this costs no new
// dependency and no second test runner: register the hook, import the real
// component, render it, read the markup.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { transformSync } from "esbuild";

export async function load(url, context, nextLoad) {
  if (!url.endsWith(".jsx")) return nextLoad(url, context);
  const source = await readFile(fileURLToPath(url), "utf8");
  const { code } = transformSync(source, {
    loader: "jsx",
    // The automatic runtime, so a component file needs no React import of its
    // own — matching what @vitejs/plugin-react does for the real build.
    jsx: "automatic",
    format: "esm",
    sourcefile: url,
  });
  return { format: "module", source: code, shortCircuit: true };
}
