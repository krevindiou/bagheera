import { describe, expect, it, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { i18n } from "../../i18n";
import { apiClient } from "../../api/client";
import BatchActions from "./batch.vue";
import ConfirmModal from "../../components/ConfirmModal.vue";

vi.mock("../../api/client", () => ({
  apiClient: { POST: vi.fn() },
}));

function jsonResponse<T>(data: T) {
  return Promise.resolve({ data, response: { ok: true } }) as never;
}

describe("SchedulerBatchActions", () => {
  beforeEach(() => {
    vi.mocked(apiClient.POST).mockReset();
  });

  it("disables the delete action when nothing is selected", () => {
    const wrapper = mount(BatchActions, { props: { selectedIds: [] }, global: { plugins: [i18n] } });
    expect(wrapper.get('[data-testid="scheduler-batch-delete"]').attributes("disabled")).toBeDefined();
  });

  it("only calls batch delete once the confirmation modal is accepted", async () => {
    vi.mocked(apiClient.POST).mockReturnValue(jsonResponse({ message: "Schedulers deleted", deletedCount: 1 }));

    const wrapper = mount(
      { components: { BatchActions, ConfirmModal }, template: `<div><BatchActions :selected-ids="[3]" /><ConfirmModal /></div>` },
      { global: { plugins: [i18n] } },
    );

    await wrapper.get('[data-testid="scheduler-batch-delete"]').trigger("click");
    expect(apiClient.POST).not.toHaveBeenCalled();

    await wrapper.vm.$nextTick();
    await wrapper.get(".btn-primary").trigger("click");
    await flushPromises();

    expect(apiClient.POST).toHaveBeenCalledWith("/schedulers/batch/delete", { body: { ids: [3] } });
  });
});
