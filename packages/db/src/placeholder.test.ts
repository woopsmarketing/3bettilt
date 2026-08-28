import { describe, expect, it } from 'vitest';
import { DB_PLACEHOLDER } from './index.js';

// Phase 0 wiring check. Delete once this package has real tests.
describe('@gto-self/db', () => {
  it('is wired into the workspace', () => {
    expect(DB_PLACEHOLDER).toBe('db');
  });
});
