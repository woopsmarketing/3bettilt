import { describe, expect, it } from 'vitest';
import { isEquityWorkerResponse } from './equityWorkerProtocol.js';

/**
 * `isEquityWorkerResponse` is the page's only defence against rendering a number it did not
 * compute: `onmessage` fires for messages this app never sent, and `equity.ts` abandons the
 * worker and recomputes on its own thread whenever this guard says no. The rule these tests
 * pin is therefore "a value only passes when it carries the engine's own basis-point
 * invariant", not any particular fixture.
 */
describe('isEquityWorkerResponse', () => {
  const equity = {
    method: 'EXACT',
    heroWinBps: 8000,
    tieBps: 500,
    villainWinBps: 1500,
  };

  it('accepts a success response whose bps fields sum to exactly 10000', () => {
    expect(isEquityWorkerResponse({ id: 1, ok: true, value: equity })).toBe(true);
  });

  it('accepts a failure response carrying the engine error as a string', () => {
    expect(isEquityWorkerResponse({ id: 7, ok: false, error: 'DUPLICATE_CARD' })).toBe(true);
  });

  it('rejects a success response whose bps do not sum to 10000', () => {
    expect(isEquityWorkerResponse({ id: 1, ok: true, value: { ...equity, tieBps: 501 } })).toBe(
      false,
    );
  });

  it('rejects a success response with non-integer bps', () => {
    expect(
      isEquityWorkerResponse({
        id: 1,
        ok: true,
        value: { ...equity, heroWinBps: 8000.5, tieBps: 499.5 },
      }),
    ).toBe(false);
  });

  it('rejects a value whose method is not EXACT — this seam never carries an estimate', () => {
    expect(
      isEquityWorkerResponse({ id: 1, ok: true, value: { ...equity, method: 'SAMPLED' } }),
    ).toBe(false);
  });

  it.each([
    ['null', null],
    ['a string', 'ok'],
    ['a number', 42],
    ['no id', { ok: true, value: equity }],
    ['a non-integer id', { id: 1.5, ok: true, value: equity }],
    ['no ok flag', { id: 1, value: equity }],
    ['a truthy non-boolean ok', { id: 1, ok: 'yes', value: equity }],
    ['a success with no value', { id: 1, ok: true }],
    ['a failure with no error string', { id: 1, ok: false }],
    ['a failure whose error is not a string', { id: 1, ok: false, error: 3 }],
  ])('rejects %s', (_label, value) => {
    expect(isEquityWorkerResponse(value)).toBe(false);
  });
});
