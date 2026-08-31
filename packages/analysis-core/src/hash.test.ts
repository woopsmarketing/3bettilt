import { describe, expect, it } from 'vitest';
import { inputIdentityHash } from './hash.js';

describe('inputIdentityHash', () => {
  it('is order-independent', () => {
    const a = inputIdentityHash(['h3', 'h1', 'h2']);
    const b = inputIdentityHash(['h1', 'h2', 'h3']);
    const c = inputIdentityHash(['h2', 'h3', 'h1']);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('is 16 lowercase hex characters', () => {
    expect(inputIdentityHash(['h1'])).toMatch(/^[0-9a-f]{16}$/);
    expect(inputIdentityHash([])).toMatch(/^[0-9a-f]{16}$/);
  });

  it('changes when a hand is added, removed or replaced', () => {
    const base = inputIdentityHash(['h1', 'h2']);
    expect(inputIdentityHash(['h1', 'h2', 'h3'])).not.toBe(base);
    expect(inputIdentityHash(['h1'])).not.toBe(base);
    expect(inputIdentityHash(['h1', 'h9'])).not.toBe(base);
  });

  it('distinguishes an empty set from any non-empty one', () => {
    const empty = inputIdentityHash([]);
    expect(empty).not.toBe(inputIdentityHash(['']));
    expect(empty).not.toBe(inputIdentityHash(['h1']));
  });

  it('does not confuse a differently-split concatenation', () => {
    // Without the separator, ['ab','c'] and ['a','bc'] would hash the same.
    expect(inputIdentityHash(['ab', 'c'])).not.toBe(inputIdentityHash(['a', 'bc']));
  });

  it('keeps a duplicated id visible rather than collapsing it', () => {
    expect(inputIdentityHash(['h1', 'h1'])).not.toBe(inputIdentityHash(['h1']));
  });

  it('is stable across calls — it reads no clock and no randomness', () => {
    const ids = ['h5', 'h4', 'h3', 'h2', 'h1'];
    const first = inputIdentityHash(ids);
    for (let i = 0; i < 10; i += 1) expect(inputIdentityHash(ids)).toBe(first);
  });

  it('does not mutate the array it is given', () => {
    const ids = ['h3', 'h1', 'h2'];
    inputIdentityHash(ids);
    expect(ids).toEqual(['h3', 'h1', 'h2']);
  });
});
