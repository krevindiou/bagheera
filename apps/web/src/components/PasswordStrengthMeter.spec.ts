import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import PasswordStrengthMeter from "./PasswordStrengthMeter.vue";
import en from "../i18n/locales/en";

const i18n = createI18n({ legacy: false, locale: "en", messages: { en } });

describe("PasswordStrengthMeter", () => {
  it("renders nothing for an empty password", () => {
    const wrapper = mount(PasswordStrengthMeter, {
      props: { password: "" },
      global: { plugins: [i18n] },
    });

    expect(wrapper.find(".progress").exists()).toBe(false);
  });

  it("shows a weak bar for a short password", () => {
    const wrapper = mount(PasswordStrengthMeter, {
      props: { password: "aaaaaaaa" },
      global: { plugins: [i18n] },
    });

    expect(wrapper.text()).toContain("Weak");
    expect(wrapper.find(".progress-bar").classes()).toContain("bg-danger");
  });

  it("shows a strong bar for a long, varied password", () => {
    const wrapper = mount(PasswordStrengthMeter, {
      props: { password: "Abcdefghijklmno1!" },
      global: { plugins: [i18n] },
    });

    expect(wrapper.text()).toContain("Strong");
    expect(wrapper.find(".progress-bar").classes()).toContain("bg-success");
  });
});
