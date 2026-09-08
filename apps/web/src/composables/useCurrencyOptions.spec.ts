import { afterEach, describe, expect, it, vi } from "vitest";
import { getCurrencyOptions, getGuessedCurrency } from "./useCurrencyOptions";

describe("getCurrencyOptions", () => {
  it("resolves a display name for a known code", () => {
    expect(getCurrencyOptions()).toContainEqual({ code: "USD", name: "US Dollar" });
  });

  it("sorts options alphabetically by name", () => {
    const names = getCurrencyOptions().map((o) => o.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe("getGuessedCurrency", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("guesses the primary currency for the browser locale's region", () => {
    vi.stubGlobal("navigator", { language: "en-US" });
    expect(getGuessedCurrency(getCurrencyOptions())).toBe("USD");
  });

  it("returns an empty string when the guess isn't among the offered options", () => {
    vi.stubGlobal("navigator", { language: "en-US" });
    expect(getGuessedCurrency([{ code: "EUR", name: "Euro" }])).toBe("");
  });

  it("returns an empty string when the browser locale can't be parsed", () => {
    vi.stubGlobal("navigator", { language: "" });
    expect(getGuessedCurrency(getCurrencyOptions())).toBe("");
  });
});
