import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import ConfirmModal from "./ConfirmModal.vue";
import { useConfirm } from "../composables/useConfirm";
import en from "../i18n/locales/en";

const i18n = createI18n({ legacy: false, locale: "en", messages: { en } });

describe("ConfirmModal", () => {
  it("resolves true when confirmed and false when cancelled", async () => {
    const wrapper = mount(ConfirmModal, { global: { plugins: [i18n] } });
    const { confirm } = useConfirm();

    const pending = confirm("Are you sure?");
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("Are you sure?");

    await wrapper.get(".btn-primary").trigger("click");
    expect(await pending).toBe(true);

    await wrapper.vm.$nextTick();
    expect(wrapper.find(".modal").exists()).toBe(false);
  });
});
