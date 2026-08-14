import { describe, expect, it } from "vitest";
import { router } from "./index";

describe("router", () => {
  it("redirects the root path to the English sign-in page", async () => {
    await router.push("/");
    await router.isReady();
    expect(router.currentRoute.value.fullPath).toBe("/en/sign-in");
  });

  it("redirects unknown paths to the English sign-in page", async () => {
    await router.push("/does/not/exist");
    await router.isReady();
    expect(router.currentRoute.value.fullPath).toBe("/en/sign-in");
  });
});
