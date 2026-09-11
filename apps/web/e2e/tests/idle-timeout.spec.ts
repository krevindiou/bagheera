import en from "../../src/i18n/locales/en";
import { expect, test } from "../support/fixtures";

// docker/compose.e2e.yml sets SESSION_IDLE_TTL_SECONDS=8 for exactly this
// test (see its comment, which names this file) — short enough to exercise
// a real server-side expiry without waiting out the 30-minute production
// default.
test("an idle session expires server-side and bounces the next navigation to sign-in", async ({
  signedInMember,
}) => {
  const { page, email } = signedInMember;

  await page.goto("/en/home");
  await expect(page.getByText(en.home.signedInAs.replace("{email}", email))).toBeVisible();

  // Genuinely waiting for a real idle TTL to elapse server-side — nothing
  // to poll on instead.
  await page.waitForTimeout(10_000);

  await page.reload();
  await expect(page).toHaveURL(/\/en\/sign-in$/);
});
