import { describe, expect, it } from 'vitest';
import { MAX_COUNT, createCounter, increment, reset } from './counter';

describe('counter', () => {
  it('starts at zero', () => {
    expect(createCounter().count).toBe(0);
  });

  it('increment adds one', () => {
    expect(increment(increment(createCounter())).count).toBe(2);
  });

  it('reset goes back to zero', () => {
    expect(reset().count).toBe(0);
  });

  it('stops at the maximum', () => {
    expect(increment(createCounter(MAX_COUNT)).count).toBe(MAX_COUNT);
  });

  it('rejects negative and fractional counts', () => {
    expect(() => createCounter(-1)).toThrow(RangeError);
    expect(() => createCounter(1.5)).toThrow(RangeError);
  });
});
