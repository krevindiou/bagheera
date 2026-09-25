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
  ...tseslint.configs.recommendedTypeChecked,
  ...eslintPluginVue.configs["flat/recommended"],
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: [".vue"],
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
  {
    // Not part of the app's tsconfig projects.
    files: ["e2e/**/*.ts", "*.mjs"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    // ESLint can't see through .vue imports or Vite's env typing (vue-tsc
    // does, and `pnpm build` runs it), so these resolve to `any`/error
    // types and would flag correct code.
    rules: {
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off",
    },
  },
  {
    // Test doubles are async by convention, without awaiting.
    files: ["**/*.spec.ts"],
    rules: {
      "@typescript-eslint/require-await": "off",
    },
  },
  eslintConfigPrettier,
);
