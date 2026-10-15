import { computed, defineComponent, h, nextTick, ref } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { setLocale } from '../i18n';
import { setupDocumentTitle, usePageTitle } from './useDocumentTitle';

// One router, set up once: `setupDocumentTitle` registers watchers that
// would otherwise pile up across tests if created per test.
const stub = { template: '<div />' };
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/reports', name: 'reports', component: stub, meta: { titleKey: 'reports.title' } },
    { path: '/operations', name: 'operations', component: stub },
  ],
});
setupDocumentTitle(router);

function mountOverride(title: () => string | null) {
  return mount(
    defineComponent({
      setup() {
        usePageTitle(computed(title));
        return () => h('div');
      },
    }),
  );
}

afterEach(async () => {
  await setLocale('en');
});

describe('setupDocumentTitle', () => {
  it('sets document.title from the route meta titleKey after navigation', async () => {
    await router.push({ name: 'reports' });

    expect(document.title).toBe('Reports · Bagheera');
  });

  it('falls back to the brand alone when the route has no titleKey', async () => {
    await router.push({ name: 'operations' });

    expect(document.title).toBe('Bagheera');
  });

  it('retitles the current page when the locale changes, without a navigation', async () => {
    await router.push({ name: 'reports' });
    expect(document.title).toBe('Reports · Bagheera');

    await setLocale('fr');

    expect(document.title).toBe('Rapports · Bagheera');
  });

  it('clears a stale override on the next navigation', async () => {
    await router.push({ name: 'operations' });
    const wrapper = mountOverride(() => 'Checking · Operations');
    expect(document.title).toBe('Checking · Operations · Bagheera');

    await router.push({ name: 'reports' });

    expect(document.title).toBe('Reports · Bagheera');
    wrapper.unmount();
  });
});

describe('usePageTitle', () => {
  it('overrides the route title while mounted', async () => {
    await router.push({ name: 'operations' });

    const wrapper = mountOverride(() => 'Checking · Operations');

    expect(document.title).toBe('Checking · Operations · Bagheera');
    wrapper.unmount();
  });

  it('falls back to the route title until the specific title becomes known', async () => {
    await router.push({ name: 'operations' });
    const name = ref<string | null>(null);

    const wrapper = mountOverride(() => name.value);
    expect(document.title).toBe('Bagheera');

    name.value = 'Checking · Operations';
    await wrapper.vm.$nextTick();

    expect(document.title).toBe('Checking · Operations · Bagheera');
    wrapper.unmount();
  });

  it('reverts to the route title once unmounted', async () => {
    await router.push({ name: 'reports' });
    const wrapper = mountOverride(() => 'Checking · Operations');
    expect(document.title).toBe('Checking · Operations · Bagheera');

    wrapper.unmount();
    await nextTick();

    expect(document.title).toBe('Reports · Bagheera');
  });

  it('keeps the next page title when the previous page unmounts afterwards', async () => {
    await router.push({ name: 'operations' });
    const previous = mountOverride(() => 'Checking · Operations');
    expect(document.title).toBe('Checking · Operations · Bagheera');

    // Simulates navigating between two pages that both call usePageTitle: the
    // new page's watcher (immediate) runs during setup, before the old one unmounts.
    const next = mountOverride(() => 'Savings · Operations');
    expect(document.title).toBe('Savings · Operations · Bagheera');

    previous.unmount();
    await nextTick();

    expect(document.title).toBe('Savings · Operations · Bagheera');
    next.unmount();
  });
});
