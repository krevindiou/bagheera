// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginVue from "eslint-plugin-vue";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    // test-results/ and playwright-report/ are Playwright's own generated
    // output (see docker/Dockerfile.playwright's comment on why they land
    // here, bind-mounted onto the host) — already in .gitignore, but that
    // doesn't stop eslint from also finding them: run `pnpm lint` right
    // after an e2e run (before cleaning up) and it choked on thousands of
    // errors against the html reporter's own generated JS bundle.
    ignores: [
      "dist/**",
      "coverage/**",
      "src/api/schema.d.ts",
      "test-results/**",
      "playwright-report/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...eslintPluginVue.configs["flat/recommended"],
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.browser,
    },
  },
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    // Route pages are conventionally single-word (e.g. pages/operations/batch.vue).
    files: ["src/pages/**/*.vue"],
    rules: {
      "vue/multi-word-component-names": "off",
    },
  },
  eslintConfigPrettier,
);
