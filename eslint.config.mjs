import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    rules: {
      "no-console": "error",
    },
  },
  {
    files: ["lib/ops/telemetry.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["scripts/**/*.{js,mjs,cjs}", "run-complete-workflow.mjs", "run-workflow-direct.js", "proxy.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["run-workflow-direct.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-dev/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".claude/**",
  ]),
]);

export default eslintConfig;
