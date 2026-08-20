import { afterEach, describe, expect, it, vi } from "vitest";
import { getCurrencyOptions, getGuessedCurrency } from "./useCurrencyOptions";

function mockLanguage(language: string) {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue(language);
}

describe("getCurrencyOptions", () => {
  it("sorts options alphabetically by name", () => {
    const options = getCurrencyOptions();

    const names = options.map((option) => option.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe("getGuessedCurrency", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("guesses EUR for a French locale", () => {
    mockLanguage("fr-FR");
    expect(getGuessedCurrency(getCurrencyOptions())).toBe("EUR");
  });

  it("guesses JPY for a Japanese locale", () => {
    mockLanguage("ja-JP");
    expect(getGuessedCurrency(getCurrencyOptions())).toBe("JPY");
  });

  it("falls back to an empty string for an unmappable locale", () => {
    mockLanguage("xx");
    expect(getGuessedCurrency(getCurrencyOptions())).toBe("");
  });
});
