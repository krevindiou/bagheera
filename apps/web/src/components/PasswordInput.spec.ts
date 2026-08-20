import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import PasswordInput from "./PasswordInput.vue";
import en from "../i18n/locales/en";

const i18n = createI18n({ legacy: false, locale: "en", messages: { en } });

describe("PasswordInput", () => {
  it("masks the value by default and reveals it on toggle click", async () => {
    const wrapper = mount(PasswordInput, {
      props: { id: "pw", modelValue: "secret" },
      global: { plugins: [i18n] },
    });

    const input = wrapper.get("input");
    expect(input.attributes("type")).toBe("password");

    await wrapper.get("button").trigger("click");
    expect(input.attributes("type")).toBe("text");

    await wrapper.get("button").trigger("click");
    expect(input.attributes("type")).toBe("password");
  });

  it("emits update:modelValue on typing and forwards extra attrs to the input", () => {
    const wrapper = mount(PasswordInput, {
      props: { id: "pw", modelValue: "" },
      attrs: { autocomplete: "new-password", class: "is-invalid" },
      global: { plugins: [i18n] },
    });

    const input = wrapper.get("input");
    expect(input.attributes("autocomplete")).toBe("new-password");
    expect(input.classes()).toContain("is-invalid");

    input.setValue("hunter2");
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["hunter2"]);
  });
});
