import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useToast } from "./useToast";

describe("useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Module-singleton queue (one toast list for the whole app) — clear
    // whatever a previous test left behind.
    useToast().toasts.splice(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pushes a toast with the given text and variant", () => {
    const { toasts, push } = useToast();
    push("Saved", "success");
    expect(toasts).toEqual([{ id: expect.any(Number), text: "Saved", variant: "success" }]);
  });

  it("defaults to the info variant", () => {
    const { toasts, push } = useToast();
    push("Hello");
    expect(toasts[0].variant).toBe("info");
  });

  it("auto-dismisses after the default 5s", () => {
    const { toasts, push } = useToast();
    push("Bye");
    expect(toasts).toHaveLength(1);
    vi.advanceTimersByTime(5000);
    expect(toasts).toHaveLength(0);
  });

  it("auto-dismisses after a custom duration", () => {
    const { toasts, push } = useToast();
    push("Quick", "info", 1000);
    vi.advanceTimersByTime(999);
    expect(toasts).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(toasts).toHaveLength(0);
  });

  it("dismiss() removes a toast immediately", () => {
    const { toasts, push, dismiss } = useToast();
    const id = push("Removed");
    dismiss(id);
    expect(toasts).toHaveLength(0);
  });

  it("dismiss() is a no-op for an unknown id", () => {
    const { toasts, push, dismiss } = useToast();
    push("Stays");
    expect(() => dismiss(999_999)).not.toThrow();
    expect(toasts).toHaveLength(1);
  });
});
