import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import App from "./App.vue";
import { router } from "./router";
import { i18n } from "./i18n";

describe("App", () => {
  it("redirects to the sign-in page and renders the brand", async () => {
    await router.push("/");
    await router.isReady();

    const wrapper = mount(App, {
      global: {
        plugins: [createPinia(), router, i18n, VueQueryPlugin],
      },
    });

    expect(router.currentRoute.value.fullPath).toBe("/en/sign-in");
    expect(wrapper.get(".navbar-brand").text()).toBe("Bagheera");
  });
});
