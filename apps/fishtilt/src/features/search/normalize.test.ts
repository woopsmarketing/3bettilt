import { describe, expect, it } from 'vitest';
import { compact, normalizeText } from './normalize.js';

describe('normalizeText', () => {
  it('lowercases Latin hand notation so case never matters', () => {
    expect(normalizeText('AKs')).toBe('aks');
    expect(normalizeText('AKS')).toBe('aks');
    expect(normalizeText('aks')).toBe('aks');
  });

  it('trims surrounding whitespace but keeps internal spacing', () => {
    expect(normalizeText('  팟 오즈  ')).toBe('팟 오즈');
  });

  it('is a no-op on Hangul beyond trimming — there is no case to fold', () => {
    expect(normalizeText('레인지')).toBe('레인지');
  });
});

describe('compact', () => {
  it('strips every internal whitespace run, not just leading/trailing', () => {
    expect(compact('팟 오즈')).toBe('팟오즈');
    expect(compact('팟오즈')).toBe('팟오즈');
    expect(compact('팟  오   즈')).toBe('팟오즈');
  });

  it('makes a spaced and unspaced query compare equal', () => {
    expect(compact('팟 오즈')).toBe(compact('팟오즈'));
  });

  it('lowercases too, so hand notation compaction is also case-insensitive', () => {
    expect(compact('A Ks')).toBe(compact('aks'));
  });
});
