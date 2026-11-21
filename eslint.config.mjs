import { defineConfig, globalIgnores } from "eslint/config";
import { baseConfig } from "./eslint.base.mjs";

const eslintConfig = defineConfig([
  ...baseConfig(),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Bad examples for the lint rules; only src/lint/boundaries.test.ts reads them.
    "lint-examples/**",
  ]),
]);

export default eslintConfig;
