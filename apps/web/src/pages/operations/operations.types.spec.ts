import { describe, expect, it } from "vitest";
import {
  categoryLabel,
  groupCategories,
  PAYMENT_METHOD_ID,
  paymentMethodIcon,
  paymentMethodName,
} from "./operations.types";
import type { Category, PaymentMethod } from "./operations.types";

const category = (id: string, name: string, parentId: string | null = null): Category => ({
  id,
  name,
  parentId,
  type: "debit",
});

describe("categoryLabel", () => {
  it("returns the plain name for a top-level category", () => {
    const groceries = category("1", "Groceries");
    expect(categoryLabel(groceries, [groceries])).toBe("Groceries");
  });

  it("prefixes a child category with its parent's name", () => {
    const parent = category("1", "Food");
    const child = category("2", "Groceries", "1");
    expect(categoryLabel(child, [parent, child])).toBe("Food > Groceries");
  });
});

describe("groupCategories", () => {
  it("groups a parent with children into one optgroup, the parent included as its own option", () => {
    const parent = category("1", "Food");
    const child = category("2", "Groceries", "1");
    expect(groupCategories([parent, child])).toEqual([
      { label: "Food", categories: [parent, child] },
    ]);
  });

  it("collects childless top-level categories under one null-label group, listed first", () => {
    const solo = category("1", "Rent");
    const parent = category("2", "Food");
    const child = category("3", "Groceries", "2");
    expect(groupCategories([solo, parent, child])).toEqual([
      { label: null, categories: [solo] },
      { label: "Food", categories: [parent, child] },
    ]);
  });

  it("returns an empty array for no categories", () => {
    expect(groupCategories([])).toEqual([]);
  });
});

describe("paymentMethodName", () => {
  const methods: PaymentMethod[] = [{ id: "1", name: "Cash", type: "debit" }];

  it("looks up the name by id", () => {
    expect(paymentMethodName("1", methods)).toBe("Cash");
  });

  it("falls back to the raw id when not found", () => {
    expect(paymentMethodName("missing", methods)).toBe("missing");
  });
});

describe("paymentMethodIcon", () => {
  it("maps each known payment-method id to its icon", () => {
    expect(paymentMethodIcon(PAYMENT_METHOD_ID.CREDIT_CARD)).toBe("💳");
    expect(paymentMethodIcon(PAYMENT_METHOD_ID.TRANSFER_DEBIT)).toBe("🔁");
    expect(paymentMethodIcon(PAYMENT_METHOD_ID.TRANSFER_CREDIT)).toBe("🔁");
    expect(paymentMethodIcon(PAYMENT_METHOD_ID.INITIAL_BALANCE)).toBe("🎚️");
  });

  it("returns an empty string for an unknown id", () => {
    expect(paymentMethodIcon("unknown")).toBe("");
  });
});
