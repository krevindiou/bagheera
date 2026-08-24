import { expect, test } from "@playwright/test";
import { registerActivateSignIn, signIn } from "../support/auth-helpers";

test("a due scheduler generates an operation once the member signs back in", async ({ page }) => {
  const { email, password } = await registerActivateSignIn(page);

  await page.getByRole("link", { name: "Accounts", exact: true }).click();
  await page.getByRole("button", { name: "New account" }).click();
  await page.locator("#account-bank-name").fill("First National");
  await page.locator("#account-name").fill("Checking");
  await page.locator("#account-currency").fill("USD");
  await page.getByRole("button", { name: "Save" }).click();
  const accountRow = page.getByTestId("account-row").filter({ hasText: "Checking" });
  await accountRow.getByRole("link").click();

  await page.getByRole("link", { name: "Scheduled operations" }).click();
  await expect(page).toHaveURL(/\/schedulers$/);

  await page.getByRole("button", { name: "New scheduler" }).click();
  await page.locator("#scheduler-type-debit").check();
  await page.locator("#scheduler-third-party").fill("Rent");
  await page.locator("#scheduler-amount").fill("900");
  await page.locator("#scheduler-payment-method").selectOption({ label: "Direct debit" });
  // Already due as of today — the first pass at save time generates the
  // first occurrence, and this asserts sign-in catch-up finds it too.
  const today = new Date().toISOString().slice(0, 10);
  await page.locator("#scheduler-value-date").fill(today);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("scheduler-row").filter({ hasText: "Rent" })).toBeVisible();

  await page.getByRole("link", { name: "Bagheera" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/en\/sign-in$/);
  await signIn(page, email, password);

  await page.getByRole("link", { name: "Accounts", exact: true }).click();
  await page.getByTestId("account-row").filter({ hasText: "Checking" }).getByRole("link").click();
  await expect(page.getByTestId("operation-row").filter({ hasText: "Rent" })).toBeVisible();
});
