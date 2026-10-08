import { nextTick } from 'vue';
import { flushPromises, type VueWrapper } from '@vue/test-utils';

/**
 * Submits, then flushes a few rounds: VeeValidate's validation takes several
 * task hops, more than one `flushPromises()`.
 */
export async function submitAndSettle(wrapper: VueWrapper): Promise<void> {
  await wrapper.find('form').trigger('submit');
  for (let i = 0; i < 5; i++) {
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
  }
}
