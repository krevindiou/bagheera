import { vi } from 'vitest';
import type { Router } from 'vue-router';

// Polls: a redirect waits on an async route-component import, which takes
// variable real time.
export async function waitForRouteName(router: Router, name: string): Promise<void> {
  await vi.waitFor(() => {
    if (router.currentRoute.value.name !== name) {
      throw new Error(`still waiting for the "${name}" route`);
    }
  });
}
