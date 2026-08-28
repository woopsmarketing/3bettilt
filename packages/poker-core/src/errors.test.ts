import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import { engineErr, engineError } from './errors.js';

describe('the engine error vocabulary', () => {
  it('always carries a context object, even an empty one', () => {
    expect(engineError('NOT_ENOUGH_PLAYERS', 'need two seats')).toEqual({
      code: 'NOT_ENOUGH_PLAYERS',
      message: 'need two seats',
      context: {},
    });
  });

  it('carries the bounds the UI renders straight into the raise control', () => {
    const error = engineError('AMOUNT_BELOW_MINIMUM', 'too small', {
      seat: 3,
      min: Money.mbb(2000),
      max: Money.mbb(100_000),
      actual: Money.mbb(1500),
    });
    expect(error.context.min).toBe(2000);
    expect(JSON.parse(JSON.stringify(error))).toEqual(error);
  });

  it('engineErr is the same value wrapped as an Err result', () => {
    const result = engineErr<number>('CORRUPT_LOG', 'bad log', { seq: 4 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected Err');
    expect(result.error).toEqual(engineError('CORRUPT_LOG', 'bad log', { seq: 4 }));
  });
});
