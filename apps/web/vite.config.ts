/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// API route prefixes, proxied to the API dev server so cookies stay
// same-origin during local (non-Docker) development.
const apiRoutePrefixes = [
  "/accounts",
  "/auth",
  "/banks",
  "/dashboard",
  "/health",
  "/members",
  "/operations",
  "/reports",
  "/schedulers",
];

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: Object.fromEntries(
      apiRoutePrefixes.map((prefix) => [
        prefix,
        { target: "http://localhost:3000", changeOrigin: true },
      ]),
    ),
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
