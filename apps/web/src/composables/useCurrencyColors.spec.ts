import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { colorForCurrency, ACCENT_COLOR } from '../components/chartColors';
import { asMockedApiClient, mockApiClient } from '../test-support/mockApiClient';
import { withGlobalPlugins } from '../test-support/withGlobalPlugins';

vi.mock('../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../api/client';
import { useCurrencyColors } from './useCurrencyColors';

const apiClient = asMockedApiClient(realApiClient);

async function colorsFor(currencies: string[], held: string[]) {
  apiClient.GET.mockResolvedValue({
    data: held.map((currency, i) => ({ id: `a${i}`, currency })),
    error: undefined,
    response: new Response(),
  });
  let colorFor!: ReturnType<typeof useCurrencyColors>;
  mount(
    defineComponent({
      setup() {
        colorFor = useCurrencyColors();
        return () => h('div');
      },
    }),
    withGlobalPlugins(),
  );
  await flushPromises();
  return currencies.map((currency) => colorFor(currency));
}

describe('useCurrencyColors', () => {
  beforeEach(() => {
    apiClient.GET.mockReset();
  });

  it('draws a single-currency member entirely in the accent', async () => {
    expect(await colorsFor(['EUR'], ['EUR', 'EUR'])).toEqual([ACCENT_COLOR]);
  });

  it('gives the accent to the currency on the most accounts, the palette to the others', async () => {
    expect(await colorsFor(['EUR', 'USD'], ['USD', 'EUR', 'EUR'])).toEqual([
      ACCENT_COLOR,
      colorForCurrency('USD'),
    ]);
    expect(await colorsFor(['EUR', 'USD'], ['USD', 'USD', 'EUR'])).toEqual([
      colorForCurrency('EUR'),
      ACCENT_COLOR,
    ]);
  });

  it('breaks a tie alphabetically, so the choice is stable', async () => {
    expect(await colorsFor(['EUR', 'USD'], ['USD', 'EUR'])).toEqual([
      ACCENT_COLOR,
      colorForCurrency('USD'),
    ]);
  });

  it('falls back to the palette with no accounts', async () => {
    expect(await colorsFor(['EUR'], [])).toEqual([colorForCurrency('EUR')]);
  });
});
