import { expect, test } from "@playwright/test";
import { registerActivateSignIn } from "../support/auth-helpers";
import { addVirtualAuthenticator } from "../support/webauthn-helpers";

test("register a passkey, then sign in with it instead of a password", async ({ page }) => {
  await addVirtualAuthenticator(page);
  const { email } = await registerActivateSignIn(page);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("link", { name: "Passkeys", exact: true }).click();
  await page.getByRole("button", { name: "Add a passkey" }).click();
  await expect(page.getByText("Passkey added")).toBeVisible();

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/en\/sign-in$/);

  await page.locator("#sign-in-email").fill(email);
  await page.getByRole("button", { name: "Sign in with a passkey", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/home$/);
});
