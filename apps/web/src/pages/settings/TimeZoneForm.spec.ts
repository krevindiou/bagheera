import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { queuedToastText } from '../../test-support/queuedToastText';
import { submitAndSettle } from '../../test-support/submitAndSettle';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../../api/client';
import { useToast } from '../../composables/useToast';
import { useSessionStore } from '../../stores/session.store';
import TimeZoneForm from './TimeZoneForm.vue';

const apiClient = asMockedApiClient(realApiClient);

function result(status: number) {
  return { data: undefined, error: undefined, response: new Response(null, { status }) };
}

// The form reads session.member.timeZone once, as its initial value — the
// session is populated on the same pinia instance before mount().
function mountWithTimeZone(timeZone: string) {
  const plugins = withGlobalPlugins();
  useSessionStore().setMember({ email: 'member@example.com', locale: 'en', timeZone });
  return mount(TimeZoneForm, plugins);
}

function select(wrapper: ReturnType<typeof mount>) {
  return wrapper.find<HTMLSelectElement>('#profile-time-zone');
}

describe('TimeZoneForm', () => {
  beforeEach(() => {
    apiClient.POST.mockReset();
    useToast().toasts.splice(0);
  });

  it("preselects the member's stored time zone", () => {
    const wrapper = mountWithTimeZone('Europe/Paris');
    expect(select(wrapper).element.value).toBe('Europe/Paris');
  });

  it('falls back to UTC with no member in the session', () => {
    const wrapper = mount(TimeZoneForm, withGlobalPlugins());
    expect(select(wrapper).element.value).toBe('UTC');
  });

  it("still offers a stored zone this browser doesn't list", () => {
    const wrapper = mountWithTimeZone('Etc/GMT+12');
    expect(select(wrapper).element.value).toBe('Etc/GMT+12');
  });

  it('saves the chosen zone, updates the session and shows a success toast', async () => {
    apiClient.POST.mockResolvedValueOnce(result(200));
    const wrapper = mountWithTimeZone('Europe/Paris');

    await select(wrapper).setValue('America/New_York');
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith('/members/time-zone', {
      body: { timeZone: 'America/New_York' },
    });
    expect(useSessionStore().member?.timeZone).toBe('America/New_York');
    expect(queuedToastText()).toContain('Time zone updated');
  });

  it('keeps the session unchanged and shows an error toast when saving fails', async () => {
    apiClient.POST.mockResolvedValueOnce(result(400));
    const wrapper = mountWithTimeZone('Europe/Paris');

    await select(wrapper).setValue('America/New_York');
    await submitAndSettle(wrapper);

    expect(useSessionStore().member?.timeZone).toBe('Europe/Paris');
    expect(queuedToastText()).toContain('Something went wrong');
  });
});
