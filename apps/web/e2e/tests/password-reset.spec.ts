import { expect, test } from "@playwright/test";
import { registerActivateSignIn } from "../support/auth-helpers";
import { latestEmailLink } from "../support/mailpit";

test("a member can reset their password via the emailed link", async ({ page }) => {
  const { email } = await registerActivateSignIn(page);
  const newPassword = "a-brand-new-password";

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/en\/sign-in$/);

  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await page.locator("#forgot-password-email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(
    page.getByText("a password reset link has been sent", { exact: false }),
  ).toBeVisible();

  const link = await latestEmailLink(email);
  await page.goto(link);
  await page.locator("#reset-password-password").fill(newPassword);
  await page.locator("#reset-password-password-confirmation").fill(newPassword);
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByText("Your password has been updated.", { exact: false })).toBeVisible();

  await page.goto("/en/sign-in");
  await page.locator("#sign-in-email").fill(email);
  await page.locator("#sign-in-password").fill(newPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/home$/);
});
