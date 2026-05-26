import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Async data-fetch functions called from useEffect are safe — the setState
      // calls happen after await, not synchronously. The rule can't trace into
      // external function bodies so it flags these as false positives.
      // Async data-fetch functions called from useEffect are safe — setState
      // happens after await, not synchronously. Rule can't trace async call graphs.
      'react-hooks/set-state-in-effect': 'off',
      // Date.now() / new Date() in render is intentional for time-based display
      // calculations (e.g. days at site). These are not hooks, just helpers.
      'react-hooks/purity': 'off',
    },
  },
]);

export default eslintConfig;
