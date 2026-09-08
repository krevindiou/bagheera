import { describe, expect, it } from "vitest";
import { errorMessage } from "./errorMessage";

describe("errorMessage", () => {
  it("returns the message for a single-string error", () => {
    expect(errorMessage({ message: "Bank name already used" })).toBe("Bank name already used");
  });

  it("returns the first message for an array of messages", () => {
    expect(errorMessage({ message: ["First problem", "Second problem"] })).toBe("First problem");
  });

  it("returns undefined for an error with no message property", () => {
    expect(errorMessage({ status: 500 })).toBeUndefined();
  });

  it("returns undefined for a non-object error", () => {
    expect(errorMessage("plain string error")).toBeUndefined();
    expect(errorMessage(42)).toBeUndefined();
  });

  it("returns undefined for null or undefined", () => {
    expect(errorMessage(null)).toBeUndefined();
    expect(errorMessage(undefined)).toBeUndefined();
  });
});
