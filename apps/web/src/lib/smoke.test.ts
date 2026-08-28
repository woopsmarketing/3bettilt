import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';

describe('web workspace wiring', () => {
  it('resolves workspace packages from the web project', () => {
    expect(Money.formatBB(Money.fromBB(2.5), { unit: true })).toBe('2.5 BB');
  });

  it('has a DOM environment available', () => {
    const el = document.createElement('div');
    el.textContent = 'GTO-SELF';
    expect(el.textContent).toBe('GTO-SELF');
  });
});
