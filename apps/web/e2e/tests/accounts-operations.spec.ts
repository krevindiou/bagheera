import { expect, test } from "@playwright/test";
import { registerActivateSignIn } from "../support/auth-helpers";

test("create a bank, an account, then an operation, and see the balance update", async ({
  page,
}) => {
  await registerActivateSignIn(page);

  // In-app navigation throughout (never a full page.goto once signed in):
  // the client only knows it's authenticated for the current SPA session,
  // so a hard navigation would bounce back to sign-in despite the cookie
  // still being valid.
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("link", { name: "Accounts", exact: true }).click();
  await page.getByRole("button", { name: "New account" }).click();
  await page.locator("#account-bank-name").fill("First National");
  await page.getByRole("button", { name: "Save" }).click();
  await page.locator("#account-name").fill("Checking");
  await page.locator("#account-currency").selectOption("USD");
  await page.locator("#account-initial-balance").fill("100");
  await page.getByRole("button", { name: "Save" }).click();

  // Saving an account redirects straight into its operations page — no
  // accounts-list row to click through first.
  await expect(page).toHaveURL(/\/operations$/);

  await page.getByRole("button", { name: "New operation" }).click();
  await page.locator("#operation-type-debit").check();
  await page.locator("#operation-third-party").fill("Grocery Store");
  await page.locator("#operation-amount").fill("25");
  await page.locator("#operation-payment-method").selectOption({ label: "Credit card" });
  // OperationForm also has a "Save & add another" button — exact match
  // avoids resolving to both.
  await page.getByRole("button", { name: "Save", exact: true }).click();

  const operationRow = page.getByTestId("operation-row").filter({ hasText: "Grocery Store" });
  await expect(operationRow).toBeVisible();

  await page.getByRole("link", { name: "Bagheera" }).click();
  await expect(page).toHaveURL(/\/en\/home$/);
  const overviewAccount = page.getByTestId("overview-account").filter({ hasText: "Checking" });
  await expect(overviewAccount).toContainText("75.00");
});
