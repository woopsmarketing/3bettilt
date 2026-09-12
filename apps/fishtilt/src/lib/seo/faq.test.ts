/**
 * `extractFaqItems` is the gate between "this page has a FAQ" and "this page gets FAQ
 * markup", so every case below is a FIXTURE STRING this file constructs — never a real
 * article looked up from `content/`.
 *
 * That is `docs/FISHTILT_STATE.md` ruling 26 applied to the obvious trap here: the rule
 * being tested is "a prose section under this heading is not a FAQ", and today several
 * articles happen to be shaped that way. If this file borrowed one of them, the assertion
 * would silently stop testing anything the day an author added `###` questions to it — and
 * the failure would look like a content bug rather than a test that had been vacuous for a
 * month. Constructed strings keep every shape provable forever, including the shapes no
 * page currently has.
 */
import { describe, expect, it } from 'vitest';
import { extractFaqItems, MIN_FAQ_ITEMS } from './faq.js';

const FAQ_HEADING = '## 사람들이 자주 헷갈리는 부분';

/** A minimal, well-formed FAQ section with `count` questions. */
function faqSource(count: number, heading = FAQ_HEADING): string {
  const blocks = Array.from(
    { length: count },
    (_, index) => `### 질문 ${String(index + 1)}인가요?\n\n답변 ${String(index + 1)}입니다.`,
  );
  return [
    '앞부분 본문입니다.',
    '',
    heading,
    '',
    ...blocks,
    '',
    '## 다음 절',
    '',
    '뒷부분입니다.',
  ].join('\n');
}

describe('extractFaqItems', () => {
  it('reads every question and its answer out of a FAQ section', () => {
    const items = extractFaqItems(faqSource(3));
    expect(items).toEqual([
      { question: '질문 1인가요?', answer: '답변 1입니다.' },
      { question: '질문 2인가요?', answer: '답변 2입니다.' },
      { question: '질문 3인가요?', answer: '답변 3입니다.' },
    ]);
  });

  it('accepts each heading wording the content actually uses', () => {
    for (const heading of ['## 자주 헷갈리는 부분', '## 자주 묻는 것', '## 자주 하는 질문']) {
      expect(extractFaqItems(faqSource(2, heading))).toHaveLength(2);
    }
  });

  it('returns nothing for a section under that heading that is prose, not questions', () => {
    const prose = [
      FAQ_HEADING,
      '',
      '표에서는 한 칸이 여러 조합을 대표합니다. 이 부분이 자주 낯설게 느껴집니다.',
      '',
      '두 번째 문단도 그냥 설명입니다.',
    ].join('\n');
    expect(extractFaqItems(prose)).toEqual([]);
  });

  it('returns nothing when the page has no FAQ section at all', () => {
    expect(extractFaqItems('## 어떤 절\n\n본문입니다.\n\n### 소제목\n\n더 많은 본문.')).toEqual([]);
  });

  it(`returns nothing below ${String(MIN_FAQ_ITEMS)} questions — one aside is not a FAQ`, () => {
    expect(extractFaqItems(faqSource(MIN_FAQ_ITEMS - 1))).toEqual([]);
    expect(extractFaqItems(faqSource(MIN_FAQ_ITEMS))).toHaveLength(MIN_FAQ_ITEMS);
  });

  it('drops a pair whose answer embeds a component, because its rendered text differs', () => {
    const source = [
      FAQ_HEADING,
      '',
      '### 계산된 값이 들어간 질문인가요?',
      '',
      '아웃이 아홉 장이면 <Fact name="OUTS_PROB" arg="9|FLOP|RIVER" /> 입니다.',
      '',
      '### 순수한 문장 질문 하나',
      '',
      '순수한 답변 하나입니다.',
      '',
      '### 순수한 문장 질문 둘',
      '',
      '순수한 답변 둘입니다.',
    ].join('\n');
    const items = extractFaqItems(source);
    expect(items.map((item) => item.question)).toEqual([
      '순수한 문장 질문 하나',
      '순수한 문장 질문 둘',
    ]);
    expect(JSON.stringify(items)).not.toContain('Fact');
  });

  it('stops at the next second-level heading', () => {
    const source = [
      FAQ_HEADING,
      '',
      '### 질문 1인가요?',
      '',
      '답변 1입니다.',
      '',
      '### 질문 2인가요?',
      '',
      '답변 2입니다.',
      '',
      '## 직접 확인해볼까요?',
      '',
      '### 이건 질문이 아닙니다',
      '',
      '연습 문제 안내문입니다.',
    ].join('\n');
    expect(extractFaqItems(source).map((item) => item.question)).toEqual([
      '질문 1인가요?',
      '질문 2인가요?',
    ]);
  });

  it('joins a multi-paragraph answer and strips inline markdown', () => {
    const source = [
      FAQ_HEADING,
      '',
      '### **강조된** 질문인가요?',
      '',
      '첫 문단입니다.',
      '',
      '`코드`와 [링크](https://example.invalid)가 들어간 둘째 문단입니다.',
      '',
      '### 두 번째 질문인가요?',
      '',
      '두 번째 답변입니다.',
    ].join('\n');
    const [first] = extractFaqItems(source);
    expect(first?.question).toBe('강조된 질문인가요?');
    expect(first?.answer).toBe('첫 문단입니다.\n\n코드와 링크가 들어간 둘째 문단입니다.');
  });

  it('ignores a fenced code block that would otherwise look like a heading', () => {
    const source = [
      FAQ_HEADING,
      '',
      '### 질문 1인가요?',
      '',
      '```',
      '### 코드 안의 가짜 질문',
      '```',
      '',
      '답변 1입니다.',
      '',
      '### 질문 2인가요?',
      '',
      '답변 2입니다.',
    ].join('\n');
    expect(extractFaqItems(source).map((item) => item.question)).toEqual([
      '질문 1인가요?',
      '질문 2인가요?',
    ]);
  });

  it('ignores a question with no answer under it', () => {
    const source = [FAQ_HEADING, '', '### 답이 없는 질문인가요?', '', '### 두 번째도 없나요?'].join(
      '\n',
    );
    expect(extractFaqItems(source)).toEqual([]);
  });
});
