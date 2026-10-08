import { expect, test } from '../support/fixtures';

// docker/compose.e2e.yml shortens SESSION_IDLE_TTL_SECONDS for this test.
test('an idle session expires server-side and bounces the next navigation to sign-in', async ({
  signedInMember,
}) => {
  const { page, email } = signedInMember;

  await page.goto('/en/home');
  await expect(page.getByText(email, { exact: true })).toBeVisible();

  // A real server-side TTL: nothing to poll.
  await page.waitForTimeout(10_000);

  await page.reload();
  await expect(page).toHaveURL(/\/en\/sign-in$/);
});
