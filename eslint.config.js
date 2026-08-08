// eslint.config.js — EVA-S01.
//
// This is NOT a general lint setup for the repo. It carries exactly one rule:
// the contracts guard that keeps evidence payload shapes coming from the
// generated types instead of being retyped by hand. Adding style rules here
// would produce thousands of findings across fifteen sprints of existing code
// and drown the one rule that has to stay loud.
//
//   npm run lint:contracts
import noHandwrittenContractTypes from "./eslint-rules/no-handwritten-contract-types.js";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "test-results/**",
      // The generated file declares the contracts — it cannot violate the rule
      // against redeclaring them.
      "src/types/evidence.d.ts",
    ],
  },
  {
    files: ["src/**/*.{js,jsx,mjs}", "e2e/**/*.js", "scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    linterOptions: {
      // Fifteen sprints of code carry `// eslint-disable-next-line
      // react-hooks/exhaustive-deps` comments written for an editor's lint
      // server, not for this config. With no rules enabled they are all
      // "unused", which is true and useless to report.
      reportUnusedDisableDirectives: "off",
    },
    plugins: {
      evidence: { rules: { "no-handwritten-contract-types": noHandwrittenContractTypes } },
      // …and ESLint errors on a directive naming a rule it cannot resolve, so
      // the plugin those comments reference is declared, with no rules turned
      // on. Swap this for eslint-plugin-react-hooks when the repo adopts a
      // real lint config; nothing here depends on it staying a stub.
      "react-hooks": { rules: { "exhaustive-deps": { create: () => ({}) } } },
    },
    rules: {
      "evidence/no-handwritten-contract-types": "error",
    },
  },
];
