import { describe, expect, it } from 'vitest';
import { COINPOKER_PARSER_PLACEHOLDER } from './index.js';

// Phase 0 wiring check. Delete once this package has real tests.
describe('@gto-self/coinpoker-parser', () => {
  it('is wired into the workspace', () => {
    expect(COINPOKER_PARSER_PLACEHOLDER).toBe('coinpoker-parser');
  });
});
