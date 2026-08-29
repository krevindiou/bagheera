import { expect, test, type Page } from "@playwright/test";
import { registerActivateSignIn } from "../support/auth-helpers";

// Assumes it's called from the accounts page; leaves the test on the
// accounts page afterwards too — saving an account redirects straight
// into its operations page, so navigate back before returning.
async function createAccount(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "New account" }).click();
  const bankField = page.locator("#account-bank-id");
  const banks = await bankField.locator("option").allTextContents();
  if (banks.some((label) => label.includes("First National"))) {
    await bankField.selectOption({ label: "First National" });
  } else {
    await page.locator("#account-bank-name").fill("First National");
  }
  await page.getByRole("button", { name: "Save" }).click();
  await page.locator("#account-name").fill(name);
  await page.locator("#account-currency").selectOption("USD");
  await page.locator("#account-initial-balance").fill("100");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/operations$/);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("link", { name: "Accounts", exact: true }).click();
}

test("a transfer operation mirrors into the target account and unlinks on delete", async ({
  page,
}) => {
  await registerActivateSignIn(page);

  // In-app navigation throughout: the client only knows it's authenticated
  // for the current SPA session, so a hard page.goto would bounce back to
  // sign-in despite the cookie still being valid.
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("link", { name: "Accounts", exact: true }).click();
  await createAccount(page, "Checking");
  await createAccount(page, "Savings");

  await page.getByTestId("account-row").filter({ hasText: "Checking" }).getByRole("link").click();

  await page.getByRole("button", { name: "New operation" }).click();
  await page.locator("#operation-type-debit").check();
  await page.locator("#operation-third-party").fill("Savings transfer");
  await page.locator("#operation-amount").fill("20");
  await page.locator("#operation-payment-method").selectOption({ label: "Transfer" });
  await page.locator("#operation-transfer-account").selectOption({ label: "Savings" });
  // OperationForm also has a "Save & add another" button — exact match
  // avoids resolving to both.
  await page.getByRole("button", { name: "Save", exact: true }).click();

  const sourceRow = page.getByTestId("operation-row").filter({ hasText: "Savings transfer" });
  await expect(sourceRow).toBeVisible();

  // The mirror shows up on the other side too.
  await page.getByRole("link", { name: "Bagheera" }).click();
  await page
    .getByTestId("overview-account")
    .filter({ hasText: "Savings" })
    .getByRole("link")
    .click();
  const mirrorRow = page.getByTestId("operation-row").filter({ hasText: "Savings transfer" });
  await expect(mirrorRow).toBeVisible();

  // Delete the source side; the mirror survives on its own (converted to
  // an unlinked "External" operation) instead of disappearing with it, so
  // the Savings balance still reflects the credit.
  await page.getByRole("link", { name: "Bagheera" }).click();
  await page
    .getByTestId("overview-account")
    .filter({ hasText: "Checking" })
    .getByRole("link")
    .click();
  await sourceRow.locator('input[type="checkbox"]').check();
  await page.getByTestId("batch-delete").click();
  await page.getByRole("button", { name: "Ok" }).click();
  await expect(sourceRow).toHaveCount(0);

  await page.getByRole("link", { name: "Bagheera" }).click();
  await expect(page.getByTestId("overview-account").filter({ hasText: "Savings" })).toContainText(
    "120.00",
  );
  await page
    .getByTestId("overview-account")
    .filter({ hasText: "Savings" })
    .getByRole("link")
    .click();
  await expect(mirrorRow).toBeVisible();
});
