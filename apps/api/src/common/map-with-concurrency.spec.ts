import { mapWithConcurrency } from './map-with-concurrency';

// Calls that settle only when the test says so, tracking how many run at once.
function controlledCalls() {
  let active = 0;
  let maxActive = 0;
  const pending: { item: number; resolve: () => void; reject: (err: Error) => void }[] = [];
  const started: number[] = [];
  const fn = (item: number): Promise<number> => {
    active++;
    maxActive = Math.max(maxActive, active);
    started.push(item);
    return new Promise<number>((resolve, reject) => {
      pending.push({
        item,
        resolve: () => {
          active--;
          resolve(item * 10);
        },
        reject: (err) => {
          active--;
          reject(err);
        },
      });
    });
  };
  return { fn, pending, started, maxActive: () => maxActive };
}

// Lets the workers' awaits run.
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('mapWithConcurrency', () => {
  it('never runs more than `limit` calls at once, and keeps results in input order', async () => {
    const calls = controlledCalls();
    const done = mapWithConcurrency([1, 2, 3, 4, 5], 2, calls.fn);

    await flush();
    expect(calls.started).toEqual([1, 2]);
    // Settle out of order: the second slot frees first.
    while (calls.pending.length > 0) {
      calls.pending.splice(calls.pending.length - 1, 1)[0].resolve();
      await flush();
    }

    await expect(done).resolves.toEqual([10, 20, 30, 40, 50]);
    expect(calls.maxActive()).toBe(2);
    expect([...calls.started].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('starts nothing more once a call rejects', async () => {
    const calls = controlledCalls();
    const done = mapWithConcurrency([1, 2, 3, 4], 2, calls.fn);
    const settled = done.catch((err: unknown) => err);

    await flush();
    calls.pending.shift()!.reject(new Error('boom'));
    await flush();
    calls.pending.shift()!.resolve();
    await flush();

    expect(await settled).toEqual(new Error('boom'));
    expect(calls.started).toEqual([1, 2]);
  });

  it('resolves to an empty array for no items', async () => {
    await expect(mapWithConcurrency([], 2, () => Promise.resolve(1))).resolves.toEqual([]);
  });

  it('rejects a limit below one', async () => {
    await expect(mapWithConcurrency([1], 0, () => Promise.resolve(1))).rejects.toThrow(RangeError);
  });
});
