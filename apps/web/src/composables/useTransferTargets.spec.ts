import { describe, expect, it } from "vitest";
import type { Account, Bank } from "../pages/accounts/accounts.types";
import { useTransferTargets } from "./useTransferTargets";

const banks: Bank[] = [
  { id: 1, name: "Active Bank", closed: false, deleted: false },
  { id: 2, name: "Closed Bank", closed: true, deleted: false },
];

const accounts: Account[] = [
  { id: 1, bankId: 1, name: "Source", currency: "USD", closed: false, deleted: false },
  { id: 2, bankId: 1, name: "Same currency", currency: "USD", closed: false, deleted: false },
  { id: 3, bankId: 1, name: "Different currency", currency: "EUR", closed: false, deleted: false },
  { id: 4, bankId: 1, name: "Closed account", currency: "USD", closed: true, deleted: false },
  {
    id: 5,
    bankId: 2,
    name: "Closed bank's account",
    currency: "USD",
    closed: false,
    deleted: false,
  },
];

describe("useTransferTargets", () => {
  it("offers the other fully active accounts sharing the source currency", () => {
    const { transferTargets, sourceCurrency } = useTransferTargets(
      () => 1,
      () => accounts,
      () => banks,
      () => undefined,
    );

    expect(sourceCurrency.value).toBe("USD");
    expect(transferTargets.value.map((a) => a.id)).toEqual([2]);
  });

  it("excludes an account whose bank is closed, even if the account itself isn't", () => {
    const { transferTargets } = useTransferTargets(
      () => 1,
      () => accounts,
      () => banks,
      () => undefined,
    );

    expect(transferTargets.value.some((a) => a.id === 5)).toBe(false);
  });

  it("keeps a stored transfer target selectable even after it's gone inactive", () => {
    const { transferTargets } = useTransferTargets(
      () => 1,
      () => accounts,
      () => banks,
      () => 4, // closed account — excluded on its own merits, kept for this reason
    );

    expect(transferTargets.value.some((a) => a.id === 4)).toBe(true);
  });

  it("doesn't duplicate a stored target that's independently still eligible", () => {
    const { transferTargets } = useTransferTargets(
      () => 1,
      () => accounts,
      () => banks,
      () => 2, // already eligible on its own
    );

    expect(transferTargets.value.filter((a) => a.id === 2)).toHaveLength(1);
  });

  it("derives the currency symbol from the source account", () => {
    const { amountCurrencySymbol } = useTransferTargets(
      () => 1,
      () => accounts,
      () => banks,
      () => undefined,
    );

    expect(amountCurrencySymbol.value).toBe("$");
  });
});
