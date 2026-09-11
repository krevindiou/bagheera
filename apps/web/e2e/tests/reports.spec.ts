import en from "../../src/i18n/locales/en";
import { alertWithText, expect, test } from "../support/fixtures";

test("create a sum report, view its chart, then batch-delete it", async ({ accountWithBank }) => {
  const { page } = accountWithBank;
  const title = "E2E test report";

  await page.goto("/en/reports");
  await page.getByRole("button", { name: en.reports.newSumReport, exact: true }).click();
  await page.getByLabel(en.reports.reportTitle, { exact: true }).fill(title);
  await page.getByRole("button", { name: en.operations.submit, exact: true }).click();
  await expect(alertWithText(page, en.reports.saved)).toBeVisible();

  const row = page.getByTestId("report-row").filter({ hasText: title });
  await expect(row.getByText(en.reports.sum)).toBeVisible();

  await row.getByRole("button", { name: en.reports.viewChart, exact: true }).click();
  await expect(row.getByRole("button", { name: en.reports.hideChart, exact: true })).toBeVisible();

  await row.getByTestId("report-checkbox").check();
  await page.getByRole("button", { name: en.reports.batch.delete, exact: true }).click();
  await page.getByRole("button", { name: en.common.ok, exact: true }).click();
  await expect(alertWithText(page, en.reports.batch.deleted)).toBeVisible();
  await expect(page.getByTestId("report-row").filter({ hasText: title })).toHaveCount(0);
});
