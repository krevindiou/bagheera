import createClient from "openapi-fetch";
import { describe, expect, it, vi } from "vitest";
import type { paths } from "./schema";

// Smoke test: exercises a generated route/response type end-to-end so a
// build (`vue-tsc`) fails loudly if the schema and client ever drift apart.
describe("apiClient", () => {
  it("calls the generated /health path and parses the typed response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const testClient = createClient<paths>({ baseUrl: "http://localhost:3000" });

    const { data, error } = await testClient.GET("/health");

    expect(fetchMock).toHaveBeenCalled();
    expect(error).toBeUndefined();
    expect(data).toEqual({ status: "ok" });

    vi.unstubAllGlobals();
  });
});
