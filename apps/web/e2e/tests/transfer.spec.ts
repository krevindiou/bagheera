import { randomUUID } from "node:crypto";
import en from "../../src/i18n/locales/en";
import { formatMoney } from "../../src/pages/operations/money";
import { PAYMENT_METHOD_ID } from "../../src/pages/operations/operations.types";
import { alertWithText, expect, fetchCsrfToken, test } from "../support/fixtures";

test("a transfer between two of the member's own accounts moves money on both sides", async ({
  accountWithBank,
}) => {
  const { page, bankId, accountId: sourceId, currency } = accountWithBank;

  const savingsRes = await page.request.post("/accounts", {
    headers: { "x-csrf-token": await fetchCsrfToken(page) },
    data: {
      bankId,
      name: `E2E savings ${randomUUID().slice(0, 8)}`,
      currency,
      initialBalance: 0,
    },
  });
  const { account: savings } = (await savingsRes.json()) as { account: { id: string } };

  await page.goto(`/en/accounts/${sourceId}/operations`);
  await page.getByRole("button", { name: en.operations.addOperation, exact: true }).click();
  await page.getByLabel(en.operations.thirdParty, { exact: true }).fill("Move to savings");
  await page.getByLabel(en.operations.amount, { exact: true }).fill("200");
  await page
    .getByLabel(en.operations.paymentMethod, { exact: true })
    .selectOption(PAYMENT_METHOD_ID.TRANSFER_DEBIT);
  await page.getByLabel(en.operations.transferAccount, { exact: true }).selectOption(savings.id);
  await page.getByRole("button", { name: en.operations.submit, exact: true }).click();
  await expect(alertWithText(page, en.operations.saved)).toBeVisible();

  await expect(page.getByTestId("account-balances")).toContainText(
    formatMoney(800, currency, true),
  );

  await page.goto(`/en/accounts/${savings.id}/operations`);
  await expect(page.getByTestId("account-balances")).toContainText(
    formatMoney(200, currency, true),
  );
  // The transfer's paired counterpart operation — whatever third-party text
  // the backend gives it — shows up as a real row on this side too.
  await expect(page.getByTestId("operation-row").first()).toBeVisible();
});
