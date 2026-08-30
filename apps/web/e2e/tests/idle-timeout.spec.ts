import { expect, test } from "@playwright/test";
import { registerActivateSignIn } from "../support/auth-helpers";

// `make e2e` runs with a short SESSION_IDLE_TTL_SECONDS (see
// docker/compose.e2e.yml) so this doesn't have to wait out the real
// 30-minute default.
test("an idle session redirects to sign-in on the next request", async ({ page }) => {
  await registerActivateSignIn(page);

  await page.waitForTimeout(9_000);

  // In-app navigation (not a full reload) so the client-side "signed in"
  // flag stays put and this genuinely exercises the server session
  // expiring underneath it — the accounts data fetch 401s, which the API
  // client's response handler turns into a bounce to sign-in.
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("link", { name: "Accounts", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/sign-in$/);
});
