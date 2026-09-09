import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      // Branches only — same convention as apps/web's vite.config.ts and
      // apps/api's jest coverageThreshold. Currently 100% (this package's
      // two functions have zero conditionals), so this is a pure
      // regression tripwire for whenever real branching logic lands here,
      // not a target being chased.
      thresholds: { branches: 90 },
    },
  },
});
