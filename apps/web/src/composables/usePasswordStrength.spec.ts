import { describe, expect, it } from "vitest";
import { getPasswordStrength } from "./usePasswordStrength";

describe("getPasswordStrength", () => {
  it("scores an empty password as weak/0", () => {
    expect(getPasswordStrength("")).toEqual({ score: 0, label: "weak" });
  });

  it("scores a short password below the 8-char floor as weak/0", () => {
    expect(getPasswordStrength("abc123")).toEqual({ score: 0, label: "weak" });
  });

  it("scores a long single-case password as weak/1", () => {
    expect(getPasswordStrength("aaaaaaaaaaaaaaaa")).toEqual({
      score: 1,
      label: "weak",
    });
  });

  it("scores length+2 varieties as fair", () => {
    expect(getPasswordStrength("abcdefgh1")).toEqual({
      score: 2,
      label: "fair",
    });
  });

  it("scores length 12+ with 3 varieties as good", () => {
    expect(getPasswordStrength("Abcdefghijk1")).toEqual({
      score: 3,
      label: "good",
    });
  });

  it("scores length 16+ with all 4 varieties as strong", () => {
    expect(getPasswordStrength("Abcdefghijklmno1!")).toEqual({
      score: 4,
      label: "strong",
    });
  });
});
