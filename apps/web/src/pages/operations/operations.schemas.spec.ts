import { AMOUNT_CEILING } from "@bagheera/money";
import { describe, expect, it } from "vitest";
import { PAYMENT_METHOD_ID } from "./operations.types";
import { operationSchema } from "./operations.schemas";

const base = {
  type: "debit" as const,
  thirdParty: "Landlord",
  amount: 100,
  paymentMethodId: PAYMENT_METHOD_ID.CHECK_DEBIT,
  valueDate: "2026-01-01",
};

describe("operationSchema", () => {
  it("accepts a minimal valid operation", () => {
    expect(operationSchema.safeParse(base).success).toBe(true);
  });

  it("accepts an amount at exactly the sanity ceiling", () => {
    expect(operationSchema.safeParse({ ...base, amount: AMOUNT_CEILING }).success).toBe(true);
  });

  it("rejects an amount over the sanity ceiling", () => {
    expect(operationSchema.safeParse({ ...base, amount: AMOUNT_CEILING + 1 }).success).toBe(false);
  });

  it("rejects a zero or negative amount", () => {
    expect(operationSchema.safeParse({ ...base, amount: 0 }).success).toBe(false);
    expect(operationSchema.safeParse({ ...base, amount: -5 }).success).toBe(false);
  });

  it("treats an empty-string amount as missing rather than NaN", () => {
    expect(operationSchema.safeParse({ ...base, amount: "" }).success).toBe(false);
  });

  it("treats an empty-string categoryId as omitted rather than an invalid uuid", () => {
    const result = operationSchema.safeParse({ ...base, categoryId: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.categoryId).toBeUndefined();
  });

  it("rejects a non-uuid categoryId", () => {
    expect(operationSchema.safeParse({ ...base, categoryId: "not-a-uuid" }).success).toBe(false);
  });

  it("rejects an empty (post-trim) thirdParty", () => {
    expect(operationSchema.safeParse({ ...base, thirdParty: "  " }).success).toBe(false);
  });

  it("rejects a thirdParty over 64 chars", () => {
    expect(operationSchema.safeParse({ ...base, thirdParty: "a".repeat(65) }).success).toBe(false);
  });

  it("rejects an invalid type", () => {
    expect(operationSchema.safeParse({ ...base, type: "invalid" }).success).toBe(false);
  });

  it("rejects notes over 4096 chars", () => {
    expect(operationSchema.safeParse({ ...base, notes: "a".repeat(4097) }).success).toBe(false);
  });
});
