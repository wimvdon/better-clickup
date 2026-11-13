/**
 * Placeholder logic for the home screen: counts clicks.
 *
 * Plain TypeScript with no Electron, DOM or React types, so it is unit tested (counter.test.ts).
 * Keep real app logic in modules like this one, separate from the UI.
 */
export const MAX_COUNT = 9_999;

export interface Counter {
  readonly count: number;
}

export function createCounter(count = 0): Counter {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError('count must be a non-negative whole number');
  }
  return { count };
}

/** Adds one click. Stops at MAX_COUNT instead of growing forever. */
export function increment(counter: Counter): Counter {
  return counter.count >= MAX_COUNT ? counter : { count: counter.count + 1 };
}

export function reset(): Counter {
  return createCounter();
}
