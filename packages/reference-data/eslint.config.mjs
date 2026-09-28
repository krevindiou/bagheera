// @ts-check
import eslint from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["eslint.config.mjs", "dist/**", "coverage/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        // tsconfig.json excludes spec files from the build (see its own
        // comment), and vitest.config.mts sits outside src/ entirely —
        // both still need type info to lint, via the default project
        // rather than the real one.
        projectService: {
          allowDefaultProject: ['src/*.spec.ts', 'vitest.config.mts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
);
