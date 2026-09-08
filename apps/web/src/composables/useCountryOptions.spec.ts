import { afterEach, describe, expect, it, vi } from "vitest";
import { getCountryOptions, getDefaultCountry } from "./useCountryOptions";

describe("getCountryOptions", () => {
  it("resolves a display name for a known code", () => {
    expect(getCountryOptions()).toContainEqual({ code: "US", name: "United States" });
  });

  it("sorts options alphabetically by name", () => {
    const names = getCountryOptions().map((o) => o.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe("getDefaultCountry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("picks the region from the browser locale when it's in the list", () => {
    vi.stubGlobal("navigator", { language: "fr-FR" });
    expect(getDefaultCountry(getCountryOptions())).toBe("FR");
  });

  it("falls back to US when the browser region isn't among the offered options", () => {
    vi.stubGlobal("navigator", { language: "fr-FR" });
    expect(getDefaultCountry([{ code: "US", name: "United States" }])).toBe("US");
  });

  it("falls back to US when the browser locale can't be parsed", () => {
    vi.stubGlobal("navigator", { language: "" });
    expect(getDefaultCountry(getCountryOptions())).toBe("US");
  });
});
