import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readLastAttemptedEmail, rememberAttemptedEmail } from "./useLastAttemptedEmail";

describe("useLastAttemptedEmail", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an empty string when nothing was remembered yet", () => {
    expect(readLastAttemptedEmail()).toBe("");
  });

  it("remembers and returns the last submitted email", () => {
    rememberAttemptedEmail("member@example.com");
    expect(readLastAttemptedEmail()).toBe("member@example.com");
  });

  it("overwrites a previously remembered email", () => {
    rememberAttemptedEmail("first@example.com");
    rememberAttemptedEmail("second@example.com");
    expect(readLastAttemptedEmail()).toBe("second@example.com");
  });

  it("returns an empty string when sessionStorage throws on read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => {
      throw new Error("blocked");
    });
    expect(readLastAttemptedEmail()).toBe("");
  });

  it("doesn't throw when sessionStorage throws on write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new Error("quota exceeded");
    });
    expect(() => rememberAttemptedEmail("x@example.com")).not.toThrow();
  });
});
