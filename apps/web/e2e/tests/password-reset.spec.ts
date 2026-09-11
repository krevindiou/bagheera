import en from "../../src/i18n/locales/en";
import { alertWithText, expect, registerAndActivate, test } from "../support/fixtures";
import { existingMessageIds, waitForEmailLink } from "../support/mailpit";

test("forgot-password → emailed link → reset → sign in with the new password", async ({ page }) => {
  const { email } = await registerAndActivate(page);
  const newPassword = "A-Brand-New-Passw0rd!";

  await page.goto("/en/forgot-password");
  await page.getByLabel(en.auth.forgotPassword.email, { exact: true }).fill(email);
  // registerAndActivate already left an activation email in this same
  // inbox — waitForEmailLink needs to know to ignore it, or it can return
  // that stale email instead of the one this request is about to queue.
  const seenBefore = await existingMessageIds(email);
  await page.getByRole("button", { name: en.auth.forgotPassword.submit, exact: true }).click();
  await expect(alertWithText(page, en.auth.forgotPassword.requestSent)).toBeVisible();

  const resetLink = await waitForEmailLink(email, { excludeIds: seenBefore });
  await page.goto(resetLink);
  await page.getByLabel(en.auth.resetPassword.password, { exact: true }).fill(newPassword);
  await page
    .getByLabel(en.auth.resetPassword.passwordConfirmation, { exact: true })
    .fill(newPassword);
  await page.getByRole("button", { name: en.auth.resetPassword.submit, exact: true }).click();
  await expect(alertWithText(page, en.auth.resetPassword.success)).toBeVisible();
  await expect(page).toHaveURL(/\/en\/sign-in$/);

  await page.getByLabel(en.auth.signIn.email, { exact: true }).fill(email);
  await page.getByLabel(en.auth.signIn.password, { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: en.auth.signIn.submit, exact: true }).click();
  await expect(page).toHaveURL(/\/en\/home$/);
});

test("a reset link is single-use", async ({ page }) => {
  const { email } = await registerAndActivate(page);

  await page.goto("/en/forgot-password");
  await page.getByLabel(en.auth.forgotPassword.email, { exact: true }).fill(email);
  const seenBefore = await existingMessageIds(email);
  await page.getByRole("button", { name: en.auth.forgotPassword.submit, exact: true }).click();

  const resetLink = await waitForEmailLink(email, { excludeIds: seenBefore });
  await page.goto(resetLink);
  await page.getByLabel(en.auth.resetPassword.password, { exact: true }).fill("First-Reset-1!");
  await page
    .getByLabel(en.auth.resetPassword.passwordConfirmation, { exact: true })
    .fill("First-Reset-1!");
  await page.getByRole("button", { name: en.auth.resetPassword.submit, exact: true }).click();
  await expect(alertWithText(page, en.auth.resetPassword.success)).toBeVisible();

  // Same link again: the app can't tell the visitor why, so it's a silent
  // bounce back to sign-in rather than a visible error (see
  // ResetPasswordPage.vue's own comment on this).
  await page.goto(resetLink);
  await page.getByLabel(en.auth.resetPassword.password, { exact: true }).fill("Second-Reset-1!");
  await page
    .getByLabel(en.auth.resetPassword.passwordConfirmation, { exact: true })
    .fill("Second-Reset-1!");
  await page.getByRole("button", { name: en.auth.resetPassword.submit, exact: true }).click();
  await expect(page).toHaveURL(/\/en\/sign-in$/);
});
