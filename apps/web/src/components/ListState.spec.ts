import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { withGlobalPlugins } from '../test-support/withGlobalPlugins';
import ListState from './ListState.vue';

function mountState(props: { error?: boolean; loading?: boolean; empty?: boolean }) {
  return mount(ListState, {
    ...withGlobalPlugins(),
    props: {
      error: false,
      loading: false,
      empty: false,
      emptyText: 'Nothing here',
      errorTestid: 'x-error',
      ...props,
    },
    slots: { default: '<table data-testid="content"></table>' },
  });
}

describe('ListState', () => {
  it('renders the content when there is no error and the list is not empty', () => {
    const wrapper = mountState({});

    expect(wrapper.find('[data-testid="content"]').exists()).toBe(true);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.find('p').exists()).toBe(false);
  });

  it('renders the load error as an alert with the given test id', () => {
    const wrapper = mountState({ error: true });

    const alert = wrapper.get('[role="alert"]');
    expect(alert.attributes('data-testid')).toBe('x-error');
    expect(alert.text()).toBe("Couldn't load this. Please try again.");
    expect(wrapper.find('[data-testid="content"]').exists()).toBe(false);
  });

  it('renders the empty text when the list is empty', () => {
    const wrapper = mountState({ empty: true });

    expect(wrapper.get('p.text-muted').text()).toBe('Nothing here');
    expect(wrapper.find('[data-testid="content"]').exists()).toBe(false);
  });

  it('shows the error rather than the empty text when both apply', () => {
    const wrapper = mountState({ error: true, empty: true });

    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(wrapper.find('p').exists()).toBe(false);
  });

  it('renders a loading status instead of the empty text while loading', () => {
    const wrapper = mountState({ loading: true, empty: true });

    const status = wrapper.get('[role="status"]');
    expect(status.text()).toBe('Loading…');
    expect(wrapper.find('[data-testid="content"]').exists()).toBe(false);
  });

  it('shows the error rather than the loading status when both apply', () => {
    const wrapper = mountState({ error: true, loading: true });

    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
  });
});
