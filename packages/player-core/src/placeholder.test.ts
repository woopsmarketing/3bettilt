import { describe, expect, it } from 'vitest';
import { PLAYER_CORE_PLACEHOLDER } from './index.js';

// Phase 0 wiring check. Delete once this package has real tests.
describe('@gto-self/player-core', () => {
  it('is wired into the workspace', () => {
    expect(PLAYER_CORE_PLACEHOLDER).toBe('player-core');
  });
});
