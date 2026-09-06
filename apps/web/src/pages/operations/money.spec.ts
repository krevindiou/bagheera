import { describe, expect, it } from "vitest";
import { currencySymbol, formatDate, formatMoney, toDisplayAmount } from "./money";

describe("toDisplayAmount", () => {
  it("scales down by the shared MONEY_SCALE and rounds to two decimals", () => {
    expect(toDisplayAmount(1234567)).toBe(123.46);
  });

  it("maps zero to zero", () => {
    expect(toDisplayAmount(0)).toBe(0);
  });

  it("is sign-preserving", () => {
    expect(toDisplayAmount(-500000)).toBe(-50);
  });
});

describe("currencySymbol", () => {
  it("returns the currency's symbol", () => {
    expect(currencySymbol("USD")).toBe("$");
  });

  it("falls back to the currency code for an unrecognized value", () => {
    expect(currencySymbol("not-a-currency")).toBe("not-a-currency");
  });
});

describe("formatDate", () => {
  it("localizes a stored YYYY-MM-DD date", () => {
    expect(formatDate("2026-01-15")).toBe("1/15/2026");
  });

  it("returns the input unchanged when unparseable", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });
});

describe("formatMoney", () => {
  it("converts a stored minor-units amount by default", () => {
    expect(formatMoney(1234567, "USD")).toBe("$123.46");
  });

  it("treats the amount as already display-scale when alreadyDisplayAmount is true", () => {
    expect(formatMoney(123.46, "USD", true)).toBe("$123.46");
  });

  it("falls back to a plain decimal for an unknown currency", () => {
    expect(formatMoney(1000000, "not-a-currency")).toBe("100.00 not-a-currency");
  });
});
