/**
 * `HandCheckerGuide` — the complete guide under the hand checker (`/tools/hand-checker`).
 *
 * Every verdict is `compareHands` and every "best five" is `bestFiveOf`, read through
 * `features/tools/guide/handCheckerGuide.ts`; the nine-category table is `categoryFrequencyOf`
 * over `FIVE_CARD_HAND_COUNT`. Card strings are rendered by `PokerCards`, which parses them —
 * a typo in an example throws at render, it never draws the wrong card.
 */
import { cardsToString } from '@gto-self/shared';
import {
  bestFiveExample,
  boardPlaysExample,
  categoryFrequencyRows,
  FIVE_CARD_HANDS_TOTAL,
  guideCount,
  guidePercent,
  showdownExamples,
} from '../../features/tools/index.js';
import { DataTable } from '../DataTable.js';
import { KeyPoint } from '../KeyPoint.js';
import { TableOfContents, type TocHeading } from '../TableOfContents.js';
import { Term } from '../Term.js';
import { GuideCards } from './GuideCards.js';
import { GUIDE_TOC_CLASS, ToolGuideSection } from './ToolGuideSection.js';

export const HAND_CHECKER_GUIDE_HEADINGS: readonly TocHeading[] = [
  { id: 'best-five', text: '일곱 장 중 다섯 장' },
  { id: 'categories', text: '9개 족보와 나오는 빈도' },
  { id: 'board-plays', text: '보드가 최고일 때' },
  { id: 'kicker-and-ties', text: '키커와 비기는 경우' },
  { id: 'limitations', text: '이 도구가 하지 않는 것' },
];

const VERDICT_WORD: Readonly<Record<-1 | 0 | 1, string>> = {
  1: 'A가 이깁니다',
  [-1]: 'B가 이깁니다',
  0: '비깁니다 (팟을 나눕니다)',
};

export function HandCheckerGuide() {
  const best = bestFiveExample();
  const board = boardPlaysExample();
  const showdowns = showdownExamples();
  const categories = categoryFrequencyRows();

  return (
    <>
      <ToolGuideSection
        id="best-five"
        title="일곱 장 중 다섯 장"
        divider="top"
        description="리버까지 가면 내 손 두 장과 보드 다섯 장, 일곱 장이 있습니다. 족보는 그중 가장 좋은 다섯 장으로만 정합니다."
      >
        <TableOfContents headings={HAND_CHECKER_GUIDE_HEADINGS} className={GUIDE_TOC_CLASS} />
        <div className="space-y-3">
          <GuideCards label="내 손" cards={best.hole} />
          <GuideCards label="보드" cards={best.board} />
        </div>
        <p>
          위 일곱 장에서 도구가 고른 다섯 장은{' '}
          <span className="font-mono">{cardsToString(best.result.bestFive)}</span>이고, 족보는{' '}
          <strong>{best.result.reading}</strong>입니다. 나머지{' '}
          <span className="font-mono">{cardsToString(best.unusedCards)}</span>는 족보에 아무 영향을
          주지 않습니다 — 두 장을 반드시 써야 하는 것도, 보드 세 장을 반드시 써야 하는 것도
          아닙니다. 일곱 장 중 어떤 다섯 장이든 가장 높은 조합이 내 패입니다.
        </p>
        <KeyPoint>
          <p>
            위 도구의 결과 칸에서 밝게 표시된 카드가 &ldquo;쓰인 다섯 장&rdquo;이고, 흐리게 남은
            카드는 세지 않은 카드입니다.
          </p>
        </KeyPoint>
      </ToolGuideSection>

      <ToolGuideSection
        id="categories"
        title="9개 족보와 나오는 빈도"
        description="강한 족보일수록 드뭅니다 — 순서 자체가 확률 순서입니다."
        wide={
          <DataTable
            caption={`다섯 장 조합 ${guideCount(FIVE_CARD_HANDS_TOTAL)}가지 중 각 족보가 되는 조합 수`}
            rowHeader="족보"
            columns={[
              { key: 'rank', label: '순위', numeric: true },
              { key: 'label', label: '족보' },
              { key: 'count', label: '조합 수', numeric: true },
              { key: 'share', label: '비율', numeric: true, highlight: true },
            ]}
            rows={categories.map((row) => ({
              key: row.category,
              cells: {
                rank: row.rankFromTop,
                label: `${row.label} (${row.rankFromTop}위)`,
                count: guideCount(row.count),
                share: guidePercent(row.probability),
              },
            }))}
          />
        }
      >
        <p>
          <Term id="term-hand-ranking">족보</Term>는 아홉 단계입니다. 위 도구의 결과에 &ldquo;9개
          족보 중 몇 번째&rdquo;라고 적히는 숫자가 이 표의 순위입니다. 스트레이트 플러시는 다섯 장
          조합 {guideCount(FIVE_CARD_HANDS_TOTAL)}가지 중 {guideCount(categories[0]?.count ?? 0)}
          가지뿐이고, 절반 가까이는 하이카드로 끝납니다.
        </p>
      </ToolGuideSection>

      <ToolGuideSection
        id="board-plays"
        title="보드가 최고일 때"
        description="가장 좋은 다섯 장이 전부 보드에 있으면, 내 손 두 장은 아무것도 보태지 못합니다."
      >
        <div className="space-y-3">
          <GuideCards label="내 손" cards={board.hole} />
          <GuideCards label="보드" cards={board.board} />
        </div>
        <p>
          이 <Term id="term-board">보드</Term>에서는 누구나 <strong>{board.result.reading}</strong>
          를 가집니다. 도구가 고른 다섯 장{' '}
          <span className="font-mono">{cardsToString(board.result.bestFive)}</span>에 내 손의{' '}
          <span className="font-mono">{cardsToString(board.unusedCards)}</span>는 들어가지 않습니다.
          이런 경우 아직 남아 있는 모든 플레이어가 같은 족보이므로 팟을 나눕니다.
        </p>
      </ToolGuideSection>

      <ToolGuideSection
        id="kicker-and-ties"
        title="키커와 비기는 경우"
        description="같은 족보끼리 붙으면 족보 안의 카드 순서로 가르고, 그래도 같으면 비깁니다. 무늬는 순위에 없습니다."
      >
        <p>
          <Term id="term-kicker">키커</Term>는 족보를 만드는 데 쓰이지 않았지만 다섯 장 안에
          들어가는 카드입니다. 같은 원페어끼리는 키커가 높은 쪽이 이기고, 다섯 장이 완전히 같으면
          무늬와 상관없이 <Term id="term-split-pot">스플릿 팟</Term>입니다. 아래 세 경우는 위 도구와
          같은 판정기가 실제로 비교한 결과입니다.
        </p>
        <div className="mt-6 space-y-8">
          {showdowns.map((example) => (
            <section
              key={example.id}
              aria-label={example.title}
              className="border-t border-line-500 pt-5"
            >
              <h3 className="text-base font-semibold text-text-100">{example.title}</h3>
              <div className="mt-3 space-y-3">
                <GuideCards label="보드" cards={example.board} />
                <GuideCards label="A" cards={example.a.hole} />
                <GuideCards label="B" cards={example.b.hole} />
              </div>
              <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
                <dt className="font-semibold text-text-300">A</dt>
                <dd>
                  {example.a.reading}{' '}
                  <span className="font-mono text-text-300">
                    ({cardsToString(example.a.bestFive)})
                  </span>
                </dd>
                <dt className="font-semibold text-text-300">B</dt>
                <dd>
                  {example.b.reading}{' '}
                  <span className="font-mono text-text-300">
                    ({cardsToString(example.b.bestFive)})
                  </span>
                </dd>
                <dt className="font-semibold text-text-300">판정</dt>
                <dd className="font-semibold text-text-100">{VERDICT_WORD[example.verdict]}</dd>
              </dl>
            </section>
          ))}
        </div>
      </ToolGuideSection>

      <ToolGuideSection id="limitations" title="이 도구가 하지 않는 것" tone="recessed">
        <ul>
          <li>
            <strong>한 사람의 패만 판정합니다.</strong> 두 패를 동시에 넣어 누가 이기는지 묻는 것은
            지원하지 않음 — 위의 예시처럼 각각 확인한 뒤 족보와 카드 순서를 비교하세요. 남은
            카드까지 포함한 승률은 승률 계산기가 구합니다.
          </li>
          <li>
            <strong>이길 확률은 말하지 않습니다.</strong> 지금 일곱 장(또는 그보다 적은 장수)으로
            만든 족보가 무엇인지만 답합니다.
          </li>
          <li>
            <strong>텍사스 홀덤 기준입니다.</strong> 무늬에 순위를 두는 규칙, 로우 족보 등 다른
            변형은 지원하지 않음.
          </li>
        </ul>
      </ToolGuideSection>
    </>
  );
}
