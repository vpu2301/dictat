/**
 * evidence/no-handwritten-contract-types (EVA-S01)
 *
 * The evidence contracts have exactly one source: the backend schemas, compiled
 * into `src/types/evidence.d.ts` by `npm run contracts:types`. A hand-written
 * copy of a contract shape is worse than no type at all — it type-checks green
 * against yesterday's payload while the runtime data has moved on, and nobody
 * notices until a field the UI insists exists arrives undefined in a clinic.
 *
 * So: any local declaration that reuses a contract's *name* is an error.
 * Import it instead.
 *
 *     ✗  \@typedef {{ id: string, kind: string }} Segment
 *     ✗  interface AnswerEnvelope { … }
 *     ✓  \@typedef {import("../types/evidence").Segment} Segment  ← alias, not a copy
 *     ✓  import type { Segment } from "../types/evidence"
 *
 * WHICH NAMES COUNT. Only the composite shapes (`interface` declarations) and
 * the closed enums (unions of string literals: SegmentKind, EvidenceTier,
 * EvidenceAction, …). json-schema-to-typescript also emits scalar leaf aliases
 * — `Text`, `Id`, `Code`, `Message`, `Url` — and reserving names that generic
 * across the whole app would be a rule nobody could live with.
 *
 * Written as a standard ESLint rule module: `create` visits TS declaration
 * nodes (live when a TypeScript parser is configured) and JSDoc `@typedef`
 * comments (the shape a hand-written contract actually takes in this JSX repo,
 * which has no TS sources of its own).
 */

import fs from "node:fs";
import path from "node:path";

const DEFAULT_CONTRACTS = "src/types/evidence.d.ts";

/**
 * Contract names worth reserving, read out of the generated d.ts.
 * Exported for the rule's test and for any tooling that needs the same list.
 */
export function contractNames(contractsFile) {
  const src = fs.readFileSync(contractsFile, "utf8");
  const names = new Set();
  for (const m of src.matchAll(/^export interface (\w+)/gm)) names.add(m[1]);
  // Closed enums only: `export type X = "a" | "b";` — never `= string`.
  for (const m of src.matchAll(/^export type (\w+) =([^;]+);/gm)) {
    if (/^\s*"[^"]*"(\s*\|\s*"[^"]*")*\s*$/.test(m[2])) names.add(m[1]);
  }
  if (names.size === 0) {
    throw new Error(
      `${contractsFile} declares no contract types — run \`npm run contracts:types\` before linting.`,
    );
  }
  return names;
}

// One read per lint run, not per file.
const cache = new Map();
function namesFor(file) {
  if (!cache.has(file)) cache.set(file, contractNames(file));
  return cache.get(file);
}

/** `@typedef {…} Name` and `@typedef Name` — but not the import-alias form. */
function* typedefsIn(comment) {
  // The type is lazily matched so `{{ id: string }}` (an object literal type,
  // the common JSDoc shape) closes on its OUTER brace rather than its inner one.
  const re = /@typedef\s*(?:\{([\s\S]*?)\}[ \t]*)?([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(comment.value))) {
    const [, type, name] = m;
    // `@typedef {import("…/types/evidence").Segment} Segment` re-exports the
    // generated type under a local name. That is the sanctioned alias, not a
    // second copy of the shape, so it passes.
    if (type && /import\(\s*["'][^"']*types\/evidence["']\s*\)/.test(type)) continue;
    yield { name, index: m.index };
  }
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "evidence contract shapes must be imported from src/types/evidence, never redeclared locally",
      recommended: true,
    },
    schema: [
      {
        type: "object",
        properties: {
          contractsFile: { type: "string" },
          allow: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      handwritten:
        '"{{name}}" is an evidence contract type. Import it from "{{module}}" instead of declaring it here — a hand-written copy type-checks green against a payload the backend has already changed.',
    },
  },

  create(context) {
    const options = context.options[0] ?? {};
    const contractsFile = path.resolve(context.cwd ?? process.cwd(), options.contractsFile ?? DEFAULT_CONTRACTS);
    const allow = new Set(options.allow ?? []);
    let names;
    try {
      names = namesFor(contractsFile);
    } catch (err) {
      // A missing generated file is a typegen failure, not a lint failure for
      // every source file in the repo. Report it once, on the first file.
      return {
        Program(node) {
          context.report({ node, message: err.message });
        },
      };
    }

    const reserved = (name) => names.has(name) && !allow.has(name);
    const report = (node, name) =>
      context.report({
        node,
        messageId: "handwritten",
        data: { name, module: "src/types/evidence" },
      });

    return {
      // Live under a TypeScript parser; inert under espree.
      TSInterfaceDeclaration(node) {
        if (node.id && reserved(node.id.name)) report(node.id, node.id.name);
      },
      TSTypeAliasDeclaration(node) {
        if (node.id && reserved(node.id.name)) report(node.id, node.id.name);
      },
      // The shape a hand-written contract takes in a JSDoc-typed JS codebase.
      "Program:exit"(program) {
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        for (const comment of sourceCode.getAllComments()) {
          if (comment.type !== "Block") continue;
          for (const { name } of typedefsIn(comment)) {
            if (reserved(name)) report(comment, name);
          }
        }
        void program;
      },
    };
  },
};

export default rule;
