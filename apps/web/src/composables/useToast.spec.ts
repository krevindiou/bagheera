import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToast } from './useToast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Module-singleton queue (one toast list for the whole app) — clear
    // whatever a previous test left behind.
    useToast().toasts.splice(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pushes a toast with the given text and variant', () => {
    const { toasts, push } = useToast();
    push('Saved', 'success');
    expect(toasts).toEqual([{ id: expect.any(Number), text: 'Saved', variant: 'success' }]);
  });

  it('defaults to the info variant', () => {
    const { toasts, push } = useToast();
    push('Hello');
    expect(toasts[0].variant).toBe('info');
  });

  it('auto-dismisses a success toast after the default 5s', () => {
    const { toasts, push } = useToast();
    push('Bye', 'success');
    expect(toasts).toHaveLength(1);
    vi.advanceTimersByTime(5000);
    expect(toasts).toHaveLength(0);
  });

  it('auto-dismisses an info toast after the default 5s', () => {
    const { toasts, push } = useToast();
    push('Bye', 'info');
    vi.advanceTimersByTime(5000);
    expect(toasts).toHaveLength(0);
  });

  it('auto-dismisses after a custom duration', () => {
    const { toasts, push } = useToast();
    push('Quick', 'info', 1000);
    vi.advanceTimersByTime(999);
    expect(toasts).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(toasts).toHaveLength(0);
  });

  it('never auto-dismisses an error toast', () => {
    const { toasts, push } = useToast();
    push('Transfer account currency mismatch.', 'error');
    vi.advanceTimersByTime(60_000);
    expect(toasts).toHaveLength(1);
  });

  it('dismiss() removes a toast immediately', () => {
    const { toasts, push, dismiss } = useToast();
    const id = push('Removed');
    dismiss(id);
    expect(toasts).toHaveLength(0);
  });

  it('dismiss() is a no-op for an unknown id', () => {
    const { toasts, push, dismiss } = useToast();
    push('Stays');
    expect(() => dismiss(999_999)).not.toThrow();
    expect(toasts).toHaveLength(1);
  });

  it('caps the visible queue, evicting the oldest as new ones arrive', () => {
    const { toasts, push } = useToast();
    push('First');
    push('Second');
    push('Third');
    push('Fourth');

    expect(toasts).toHaveLength(3);
    expect(toasts.map((t) => t.text)).toEqual(['Second', 'Third', 'Fourth']);
  });

  it('clears an evicted toast timer instead of leaving it dangling', () => {
    const { toasts, push } = useToast();
    push('First');
    push('Second');
    push('Third');
    push('Fourth'); // evicts "First"

    // If "First"'s timer had survived, this would throw trying to splice an
    // index that no longer matches any toast once the queue has moved on.
    expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
    expect(toasts).toHaveLength(0);
  });

  it('pause() stops the countdown and resume() continues it with the remaining time', () => {
    const { toasts, push, pause, resume } = useToast();
    const id = push('Hover me', 'success');

    vi.advanceTimersByTime(4000);
    pause(id);
    vi.advanceTimersByTime(10_000);
    expect(toasts).toHaveLength(1); // paused: the 10s elapsed never counted

    resume(id);
    vi.advanceTimersByTime(999);
    expect(toasts).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(toasts).toHaveLength(0);
  });

  it('pause()/resume() are no-ops for a toast with no running timer (e.g. an error)', () => {
    const { toasts, push, pause, resume } = useToast();
    const id = push('Oops', 'error');

    expect(() => pause(id)).not.toThrow();
    expect(() => resume(id)).not.toThrow();
    vi.advanceTimersByTime(60_000);
    expect(toasts).toHaveLength(1);
  });
});
