import { describe, expect, it } from 'vitest';
import { highlightSegments } from './highlight.js';

describe('highlightSegments', () => {
  it('returns the text untouched, unhighlighted, when nothing matches', () => {
    expect(highlightSegments('팟 오즈 계산기', ['레인지'])).toEqual([
      { text: '팟 오즈 계산기', hit: false },
    ]);
  });

  it('returns nothing for empty text', () => {
    expect(highlightSegments('', ['x'])).toEqual([]);
  });

  it('marks exactly one segment — the earliest hit', () => {
    const segments = highlightSegments('3벳(3-Bet)은 왜 3벳일까', ['3벳']);
    expect(segments.filter((segment) => segment.hit)).toHaveLength(1);
    expect(segments[0]).toEqual({ text: '3벳', hit: true });
    expect(segments.map((segment) => segment.text).join('')).toBe('3벳(3-Bet)은 왜 3벳일까');
  });

  it('is case-insensitive and tolerates whitespace inside the match', () => {
    expect(highlightSegments('팟 오즈 계산기', ['팟오즈'])).toEqual([
      { text: '팟 오즈', hit: true },
      { text: ' 계산기', hit: false },
    ]);
    expect(highlightSegments('다시 거는 세 번째 레이즈 (3-Bet)', ['3-bet'])).toEqual([
      { text: '다시 거는 세 번째 레이즈 (', hit: false },
      { text: '3-Bet', hit: true },
      { text: ')', hit: false },
    ]);
  });

  it('prefers the longer variant when two start at the same place', () => {
    const segments = highlightSegments('핸드레인지 표', ['레인지', '핸드레인지']);
    expect(segments[0]).toEqual({ text: '핸드레인지', hit: true });
  });

  it('never throws on a variant with regex metacharacters', () => {
    expect(() => highlightSegments('A+K (s)', ['(s)', 'A+K'])).not.toThrow();
    expect(highlightSegments('A+K (s)', ['A+K'])[0]).toEqual({ text: 'A+K', hit: true });
  });

  it('ignores blank variants', () => {
    expect(highlightSegments('레인지', ['', '  '])).toEqual([{ text: '레인지', hit: false }]);
  });
});
