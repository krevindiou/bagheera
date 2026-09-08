import { AMOUNT_CEILING } from "@bagheera/money";
import { describe, expect, it } from "vitest";
import { PAYMENT_METHOD_ID } from "../operations/operations.types";
import { schedulerSchema } from "./schedulers.schemas";

// Any well-formed uuid stands in for an account id here — the schema only
// checks shape, not what the id actually refers to.
const ACCOUNT_ID = "00000000-0000-7000-8000-000000000099";

const base = {
  type: "debit" as const,
  thirdParty: "Rent",
  amount: 1000,
  paymentMethodId: PAYMENT_METHOD_ID.CHECK_DEBIT,
  valueDate: "2026-01-01",
  frequencyUnit: "month" as const,
  frequencyValue: 1,
};

describe("schedulerSchema", () => {
  it("accepts a minimal valid scheduler", () => {
    expect(schedulerSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an amount over the sanity ceiling", () => {
    expect(schedulerSchema.safeParse({ ...base, amount: AMOUNT_CEILING + 1 }).success).toBe(false);
  });

  it("rejects a zero or fractional frequencyValue", () => {
    expect(schedulerSchema.safeParse({ ...base, frequencyValue: 0 }).success).toBe(false);
    expect(schedulerSchema.safeParse({ ...base, frequencyValue: 1.5 }).success).toBe(false);
  });

  it("rejects a missing frequencyValue (empty string, undefined, or null)", () => {
    expect(schedulerSchema.safeParse({ ...base, frequencyValue: "" }).success).toBe(false);
    expect(schedulerSchema.safeParse({ ...base, frequencyValue: undefined }).success).toBe(false);
    expect(schedulerSchema.safeParse({ ...base, frequencyValue: null }).success).toBe(false);
  });

  it("rejects an invalid frequencyUnit", () => {
    expect(schedulerSchema.safeParse({ ...base, frequencyUnit: "invalid" }).success).toBe(false);
  });

  it("treats an empty-string limitDate as omitted", () => {
    const result = schedulerSchema.safeParse({ ...base, limitDate: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limitDate).toBeUndefined();
  });

  it("requires a transferAccountId when the payment method is a transfer method", () => {
    const result = schedulerSchema.safeParse({
      ...base,
      paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_DEBIT,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["transferAccountId"]);
  });

  it("accepts a transfer payment method once transferAccountId is provided", () => {
    expect(
      schedulerSchema.safeParse({
        ...base,
        paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_DEBIT,
        transferAccountId: ACCOUNT_ID,
      }).success,
    ).toBe(true);
  });

  it("doesn't require a transferAccountId for a non-transfer payment method", () => {
    expect(schedulerSchema.safeParse(base).success).toBe(true);
  });
});
