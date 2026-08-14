import { expect, test } from "@playwright/test";
import {
  PASSWORD,
  activateFromEmail,
  register,
  signIn,
  uniqueEmail,
} from "../support/auth-helpers";

test("register, activate via the emailed link, then sign in", async ({ page }) => {
  const email = uniqueEmail();

  await register(page, email);
  await expect(page.getByText("You are now registered.", { exact: false })).toBeVisible();

  await activateFromEmail(page, email);
  await expect(page.getByText("Account activated.", { exact: false })).toBeVisible();

  await signIn(page, email, PASSWORD);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});
