import en from "../../src/i18n/locales/en";
import { formatMoney } from "../../src/pages/operations/money";
import { PAYMENT_METHOD_ID } from "../../src/pages/operations/operations.types";
import { alertWithText, expect, test } from "../support/fixtures";

test.describe("operations CRUD", () => {
  test.beforeEach(async ({ accountWithBank }) => {
    const { page, accountId } = accountWithBank;
    await page.goto(`/en/accounts/${accountId}/operations`);
  });

  test("the debit/credit type toggle changes which payment methods are selectable", async ({
    accountWithBank,
  }) => {
    const { page } = accountWithBank;
    await page.getByRole("button", { name: en.operations.addOperation, exact: true }).click();

    const paymentMethodSelect = page.getByLabel(en.operations.paymentMethod, { exact: true });
    // Debit is the form's default type.
    await expect(
      paymentMethodSelect.locator(`option[value="${PAYMENT_METHOD_ID.CREDIT_CARD}"]`),
    ).toHaveCount(1);
    await expect(
      paymentMethodSelect.locator(`option[value="${PAYMENT_METHOD_ID.DEPOSIT}"]`),
    ).toHaveCount(0);

    await page.getByLabel(en.operations.credit, { exact: true }).check();
    await expect(
      paymentMethodSelect.locator(`option[value="${PAYMENT_METHOD_ID.CREDIT_CARD}"]`),
    ).toHaveCount(0);
    await expect(
      paymentMethodSelect.locator(`option[value="${PAYMENT_METHOD_ID.DEPOSIT}"]`),
    ).toHaveCount(1);
  });

  test("create, edit, then batch-delete a manual operation", async ({ accountWithBank }) => {
    const { page, currency } = accountWithBank;

    await page.getByRole("button", { name: en.operations.addOperation, exact: true }).click();
    await page.getByLabel(en.operations.thirdParty, { exact: true }).fill("Grocery Store");
    await page.getByLabel(en.operations.amount, { exact: true }).fill("42.50");
    await page
      .getByLabel(en.operations.paymentMethod, { exact: true })
      .selectOption(PAYMENT_METHOD_ID.CREDIT_CARD);
    await page.getByRole("button", { name: en.operations.submit, exact: true }).click();
    await expect(alertWithText(page, en.operations.saved)).toBeVisible();

    const row = page.getByTestId("operation-row").filter({ hasText: "Grocery Store" });
    await expect(row).toContainText(`-${formatMoney(425_000, currency)}`);

    await row.getByRole("button", { name: en.operations.edit, exact: true }).click();
    await page.getByLabel(en.operations.amount, { exact: true }).fill("55");
    await page.getByRole("button", { name: en.operations.submit, exact: true }).click();
    await expect(alertWithText(page, en.operations.saved)).toBeVisible();
    await expect(row).toContainText(`-${formatMoney(550_000, currency)}`);

    await row.locator('input[type="checkbox"]').check();
    await page.getByTestId("batch-delete").click();
    await page.getByRole("button", { name: en.common.ok, exact: true }).click();
    await expect(alertWithText(page, en.operations.batch.deleted)).toBeVisible();
    await expect(
      page.getByTestId("operation-row").filter({ hasText: "Grocery Store" }),
    ).toHaveCount(0);
  });
});
