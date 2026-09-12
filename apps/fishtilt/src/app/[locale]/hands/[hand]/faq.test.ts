/**
 * @vitest-environment node
 *
 * The hand template's FAQ contract (WP-S3-13a): `FAQPage` JSON-LD is emitted ONLY when the
 * hand's own MDX carries a visible question list — a `## 자주 묻는 것` section with at least
 * two `### 질문` sub-headings whose answers contain no component. The template renders the
 * list through MDX itself; this pins the extraction + JSON-LD path the template calls
 * (`readFaqItems('hands', slug)` -> `faqPageJsonLd`) against fixture strings and against
 * the live files, so a content agent adding a FAQ can see exactly what qualifies.
 */
import { describe, expect, it } from 'vitest';
import { contentOfKind } from '../../../../content/graph.js';
import type { HandRecord } from '../../../../content/types.js';
import { extractFaqItems } from '../../../../lib/seo/faq.js';
import { readFaqItems } from '../../../../lib/seo/faqSource.js';
import { faqPageJsonLd } from '../../../../lib/seo/index.js';

const QUALIFYING = `AKs는 A와 K를 같은 무늬로 받은 시작 패입니다.

## 자주 묻는 것

### AKs와 AKo 중 어느 쪽이 더 자주 오나요?

AKo가 더 자주 옵니다. 무늬가 달라도 되니 조합이 세 배입니다.

### AKs는 페어보다 강한가요?

일부 페어보다는 위, 일부 페어보다는 아래입니다. 위 표의 순위를 보세요.
`;

const ONE_QUESTION = `AKs입니다.

## 자주 묻는 것

### 하나뿐인 질문

답입니다.
`;

const COMPONENT_ANSWER = `AKs입니다.

## 자주 묻는 것

### 조합은 몇 가지인가요?

<Fact name="HAND_COMBOS" arg="AKs" />가지입니다.

### 무늬가 왜 중요한가요?

플러시 가능성이 생기기 때문입니다.
`;

describe('/hands/[hand] FAQ contract', () => {
  it('emits FAQPage for a ## 자주 묻는 것 section with two or more ### questions', () => {
    const items = extractFaqItems(QUALIFYING);
    expect(items).toHaveLength(2);
    expect(items[0]?.question).toBe('AKs와 AKo 중 어느 쪽이 더 자주 오나요?');
    const block = faqPageJsonLd(items);
    expect(block?.['@type']).toBe('FAQPage');
  });

  it('emits nothing for a single question — that is an aside, not a FAQ', () => {
    expect(extractFaqItems(ONE_QUESTION)).toEqual([]);
    expect(faqPageJsonLd([])).toBeNull();
  });

  it('drops a pair whose answer holds a component, so the markup never differs from the page', () => {
    // Two questions, one answer with a <Fact>: one survivor is below MIN_FAQ_ITEMS, so the
    // whole list is withheld and no FAQPage is emitted. Content agents: keep FAQ answers to
    // plain prose (no <Fact>/<Term>), or write a third question so two survive.
    expect(extractFaqItems(COMPONENT_ANSWER)).toEqual([]);
    expect(faqPageJsonLd(extractFaqItems(COMPONENT_ANSWER))).toBeNull();

    const withThird = `${COMPONENT_ANSWER}
### 세 번째 질문인가요?

네, 순수한 문장 답입니다.
`;
    const survivors = extractFaqItems(withThird);
    expect(survivors.map((item) => item.question)).toEqual([
      '무늬가 왜 중요한가요?',
      '세 번째 질문인가요?',
    ]);
    expect(faqPageJsonLd(survivors)?.['@type']).toBe('FAQPage');
  });

  it('the live hand files: FAQPage appears exactly for the files that carry a qualifying list', () => {
    // Not a fixed count — WP-S3-13b is adding FAQs file by file. The invariant is the
    // agreement between what the template would emit and what the file actually contains.
    for (const record of contentOfKind('hands') as readonly HandRecord[]) {
      const items = readFaqItems('hands', record.slug);
      const block = faqPageJsonLd(items);
      if (items.length === 0) expect(block, record.slug).toBeNull();
      else expect(block?.['@type'], record.slug).toBe('FAQPage');
    }
  });
});
