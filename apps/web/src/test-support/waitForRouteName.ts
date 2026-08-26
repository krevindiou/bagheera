import { vi } from "vitest";
import type { Router } from "vue-router";

// A redirect resolves through vue-router's async route-component import,
// which takes real wall-clock time (and varies run to run depending on
// whether that chunk is already warm) — a fixed flushPromises()/tick loop
// isn't reliably enough to observe it, so poll instead.
export async function waitForRouteName(router: Router, name: string): Promise<void> {
  await vi.waitFor(() => {
    if (router.currentRoute.value.name !== name) {
      throw new Error(`still waiting for the "${name}" route`);
    }
  });
}
