import { nextTick } from "vue";
import { flushPromises, type VueWrapper } from "@vue/test-utils";

/**
 * VeeValidate's zod validation resolves through several chained
 * macrotask/microtask hops, so a single `flushPromises()` call after
 * submitting isn't reliably enough to observe either the validation
 * errors or the submit handler's side effects — loop a few rounds of
 * flush + tick instead.
 */
export async function submitAndSettle(wrapper: VueWrapper): Promise<void> {
  await wrapper.find("form").trigger("submit");
  for (let i = 0; i < 5; i++) {
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
  }
}
