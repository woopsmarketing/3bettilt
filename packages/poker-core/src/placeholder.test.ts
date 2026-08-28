import { describe, expect, it } from 'vitest';
import { POKER_CORE_PLACEHOLDER } from './index.js';

// Phase 0 wiring check. Delete once this package has real tests.
describe('@gto-self/poker-core', () => {
  it('is wired into the workspace', () => {
    expect(POKER_CORE_PLACEHOLDER).toBe('poker-core');
  });
});
