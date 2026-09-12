import { describe, expect, it } from 'vitest';
import {
  compareHeadwords,
  GLOSSARY_INITIALS,
  INITIAL_ANCHOR,
  initialOf,
  initialRank,
} from './initials.js';

describe('initialOf — Korean dictionary tabs', () => {
  it.each([
    ['포지션', 'ㅍ'],
    ['가로', 'ㄱ'],
    ['넛', 'ㄴ'],
    ['드로우', 'ㄷ'],
    ['레인지', 'ㄹ'],
    ['버튼', 'ㅂ'],
    ['스택', 'ㅅ'],
    ['아웃츠', 'ㅇ'],
    ['족보', 'ㅈ'],
    ['체크', 'ㅊ'],
    ['키커', 'ㅋ'],
    ['턴', 'ㅌ'],
    ['하이잭', 'ㅎ'],
    ['맞추기', 'ㅁ'],
  ])('%s → %s', (headword, initial) => {
    expect(initialOf(headword)).toBe(initial);
  });

  it('folds doubled consonants into their base tab, the way a printed dictionary files them', () => {
    expect(initialOf('쓰리벳')).toBe('ㅅ');
    expect(initialOf('까기')).toBe('ㄱ');
    expect(initialOf('따기')).toBe('ㄷ');
    expect(initialOf('빵')).toBe('ㅂ');
    expect(initialOf('짜기')).toBe('ㅈ');
  });

  it('files Latin, digit-first and empty strings under A–Z', () => {
    expect(initialOf('VPIP')).toBe('A–Z');
    expect(initialOf('pfr')).toBe('A–Z');
    expect(initialOf('3벳')).toBe('A–Z');
    expect(initialOf('')).toBe('A–Z');
  });

  it('ranks the tabs in ㄱ … ㅎ, A–Z order with A–Z last, and gives each a distinct anchor', () => {
    expect(GLOSSARY_INITIALS).toHaveLength(15);
    expect(GLOSSARY_INITIALS.at(-1)).toBe('A–Z');
    expect(initialRank('ㄱ')).toBe(0);
    expect(initialRank('ㅎ')).toBe(13);
    expect(initialRank('A–Z')).toBe(14);
    const anchors = GLOSSARY_INITIALS.map((initial) => INITIAL_ANCHOR[initial]);
    expect(new Set(anchors).size).toBe(anchors.length);
    for (const anchor of anchors) expect(anchor).toMatch(/^[a-z]+$/u);
  });

  it('compares headwords by Korean collation', () => {
    expect(['포지션', '버튼', '스택'].sort(compareHeadwords)).toEqual(['버튼', '스택', '포지션']);
  });
});
