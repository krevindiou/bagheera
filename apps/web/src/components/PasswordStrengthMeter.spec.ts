import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { withGlobalPlugins } from "../test-support/withGlobalPlugins";
import PasswordStrengthMeter from "./PasswordStrengthMeter.vue";

describe("PasswordStrengthMeter", () => {
  it("renders nothing for an empty password", () => {
    const wrapper = mount(PasswordStrengthMeter, {
      ...withGlobalPlugins(),
      props: { password: "" },
    });
    expect(wrapper.find(".progress").exists()).toBe(false);
  });

  it("shows a 20%-wide danger bar labeled Weak for a very weak password", () => {
    const wrapper = mount(PasswordStrengthMeter, {
      ...withGlobalPlugins(),
      props: { password: "a" },
    });
    const bar = wrapper.find(".progress-bar");
    expect(bar.classes()).toContain("bg-danger");
    expect(bar.attributes("style")).toContain("width: 20%");
    expect(wrapper.find("small").text()).toBe("Weak");
  });

  it("shows a mid-width warning bar labeled Fair for a fair password", () => {
    const wrapper = mount(PasswordStrengthMeter, {
      ...withGlobalPlugins(),
      props: { password: "abcdefgH" },
    });
    expect(wrapper.find(".progress-bar").classes()).toContain("bg-warning");
    expect(wrapper.find("small").text()).toBe("Fair");
  });

  it("shows a full-width success bar labeled Strong for a very strong password", () => {
    const wrapper = mount(PasswordStrengthMeter, {
      ...withGlobalPlugins(),
      props: { password: "aA1!aA1!aA1!aA1!" },
    });
    const bar = wrapper.find(".progress-bar");
    expect(bar.classes()).toContain("bg-success");
    expect(bar.attributes("style")).toContain("width: 100%");
    expect(wrapper.find("small").text()).toBe("Strong");
  });
});
