import { describe, expect, it } from "vitest";
import { useToast } from "./useToast";

describe("useToast", () => {
  it("pushes and dismisses toasts", () => {
    const { toasts, push, dismiss } = useToast();
    const startCount = toasts.length;

    const id = push("Saved", "success", 60_000);
    expect(toasts.length).toBe(startCount + 1);
    expect(toasts.at(-1)).toMatchObject({ text: "Saved", variant: "success" });

    dismiss(id);
    expect(toasts.length).toBe(startCount);
  });
});
