import en from "../../src/i18n/locales/en";
import { PAYMENT_METHOD_ID } from "../../src/pages/operations/operations.types";
import { alertWithText, expect, test } from "../support/fixtures";

test("create, pause, then batch-delete a recurring scheduler", async ({ accountWithBank }) => {
  const { page, accountId } = accountWithBank;

  await page.goto(`/en/accounts/${accountId}/schedulers`);
  await page.getByRole("button", { name: en.schedulers.addScheduler, exact: true }).click();
  await page.getByLabel(en.operations.thirdParty, { exact: true }).fill("Rent");
  await page.getByLabel(en.operations.amount, { exact: true }).fill("800");
  await page
    .getByLabel(en.operations.paymentMethod, { exact: true })
    .selectOption(PAYMENT_METHOD_ID.DIRECT_DEBIT);
  await page.getByRole("button", { name: en.operations.submit, exact: true }).click();
  await expect(alertWithText(page, en.schedulers.created)).toBeVisible();

  const row = page.getByTestId("scheduler-row").filter({ hasText: "Rent" });
  await expect(row.getByTitle(en.schedulers.active)).toBeVisible();

  await row.getByRole("button", { name: en.operations.edit, exact: true }).click();
  await page.getByLabel(en.schedulers.active, { exact: true }).uncheck();
  await page.getByRole("button", { name: en.operations.submit, exact: true }).click();
  await expect(alertWithText(page, en.schedulers.updated)).toBeVisible();
  await expect(row.getByTitle(en.schedulers.paused)).toBeVisible();

  await row.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: en.schedulers.batch.delete, exact: true }).click();
  await page.getByRole("button", { name: en.common.ok, exact: true }).click();
  await expect(alertWithText(page, en.schedulers.batch.deleted)).toBeVisible();
  await expect(page.getByTestId("scheduler-row").filter({ hasText: "Rent" })).toHaveCount(0);
});
