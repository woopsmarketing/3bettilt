/**
 * The meta description for a content page.
 *
 * A record's `description` is the deck: the sentence the site's own cards, hubs and search
 * show beside the title. For a lesson or an article that sentence is also a good search
 * snippet, and it is used as written. For the two reference kinds it is not — a glossary
 * deck is often twenty-odd characters ("리버 — 마지막 공용 카드"-length), and twenty hand
 * decks share one sentence shape. So those two kinds get a default built from data the
 * page already shows, and any record may override it with `seoDescription`.
 *
 * Nothing here writes a number the page does not print: the hand sentence reads its rank and
 * combo count through `factValue`, the same function the page's `<Fact>` elements render.
 * Title templates live beside the record graph (`content/graph.ts` `seoTitleOf`), because
 * they need nothing but the record; this module needs `facts.ts`, which pulls in the
 * strength dataset, so it is kept off the graph's import path.
 */
import { glossarySeoTerm } from '../../content/graph.js';
import { factValue } from '../../content/facts.js';
import type { AnyContentRecord } from '../../content/types.js';

/** Past this, a combined glossary sentence falls back to the definition alone. Search
 *  results cut Korean snippets well before 160 characters; a longer one only loses its end. */
export const MAX_COMPOSED_DESCRIPTION = 160;

export function seoDescriptionOf(record: AnyContentRecord): string {
  if (record.seoDescription !== undefined) return record.seoDescription;
  switch (record.kind) {
    case 'glossary': {
      // The definition first, under the same search word the title uses (it is the answer to
      // "X 뜻"), then the deck, which says what the page covers. Both sentences are the
      // record's own; only the `X 뜻:` label is composed.
      const term = glossarySeoTerm(record);
      const lead = `${term} 뜻: ${record.shortDefinition}`;
      const composed = `${lead} ${record.description}`;
      return composed.length <= MAX_COMPOSED_DESCRIPTION ? composed : lead;
    }
    case 'hands': {
      const key = record.handKey;
      return (
        `${key} 시작 핸드 가이드. 169가지 시작 패 중 ${factValue('HAND_RANK', key)}위, ` +
        `무늬까지 구별하면 ${factValue('HAND_COMBOS', key)}가지 조합입니다. ` +
        '13×13 표 위치, 무작위 상대와 끝까지 갔을 때 기대되는 팟 몫(비기면 절반), ' +
        '순위가 이웃한 패와의 비교를 계산된 값으로 보여줍니다.'
      );
    }
    case 'learn':
    case 'blog':
      return record.description;
  }
}
