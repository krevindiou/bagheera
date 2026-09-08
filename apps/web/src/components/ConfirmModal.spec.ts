import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { useConfirm } from "../composables/useConfirm";
import { withGlobalPlugins } from "../test-support/withGlobalPlugins";
import ConfirmModal from "./ConfirmModal.vue";

describe("ConfirmModal", () => {
  // Module-singleton state (one dialog for the whole app) — drain any
  // pending confirmation left over from a previous test before each one.
  beforeEach(() => {
    const { state, settle } = useConfirm();
    settle(false);
    state.visible = false;
  });

  it("renders nothing when no confirmation is pending", () => {
    const wrapper = mount(ConfirmModal, withGlobalPlugins());
    expect(wrapper.find(".modal").exists()).toBe(false);
  });

  it("shows the dialog's title/body/actions once a confirmation starts", async () => {
    const wrapper = mount(ConfirmModal, withGlobalPlugins());
    useConfirm().confirm();
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".modal-title").text()).toBe("Confirmation");
    expect(wrapper.find(".modal-body").text()).toBe("Do you confirm?");
    expect(wrapper.findAll("button").map((b) => b.text())).toEqual(["Ok", "Cancel"]);
  });

  it("resolves true and hides once Ok is clicked", async () => {
    const wrapper = mount(ConfirmModal, withGlobalPlugins());
    const pending = useConfirm().confirm();
    await wrapper.vm.$nextTick();

    await wrapper.find("button.btn-primary").trigger("click");

    await expect(pending).resolves.toBe(true);
    expect(wrapper.find(".modal").exists()).toBe(false);
  });

  it("resolves false once Cancel is clicked", async () => {
    const wrapper = mount(ConfirmModal, withGlobalPlugins());
    const pending = useConfirm().confirm();
    await wrapper.vm.$nextTick();

    await wrapper.find("button.btn-secondary").trigger("click");

    await expect(pending).resolves.toBe(false);
  });
});
