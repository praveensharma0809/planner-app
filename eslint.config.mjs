import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import requireModalInitialFocusRef from "./eslint-rules/require-modal-initial-focus-ref.js";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      local: {
        rules: {
          "require-modal-initial-focus-ref": requireModalInitialFocusRef,
        },
      },
    },
    rules: {
      "local/require-modal-initial-focus-ref": "warn",
    },
  },
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
    files: ["scripts/**/*.{js,mjs,cjs}"],
    rules: {
      "no-console": "off",
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
