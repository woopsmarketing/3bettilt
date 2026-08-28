import { describe, expect, it } from 'vitest';
import { GTO_CORE_PLACEHOLDER } from './index.js';

// Phase 0 wiring check. Delete once this package has real tests.
describe('@gto-self/gto-core', () => {
  it('is wired into the workspace', () => {
    expect(GTO_CORE_PLACEHOLDER).toBe('gto-core');
  });
});
