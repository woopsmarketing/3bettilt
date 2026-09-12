'use client';

/**
 * `HandChecker` — the interactive island on `/tools/hand-checker`. A beginner picks up to 2
 * hole cards and up to 5 board cards; the moment 5, 6 or 7 cards are on the table, this
 * shows the best five-card hand `strategy-core`'s `bestFiveOf` finds inside them, in
 * beginner Korean (`features/tools/handRank.ts` does all the arithmetic and phrasing — this
 * component only lays it out).
 *
 * ## No duplicate card, anywhere
 *
 * The two `CardPicker`s cross-reference each other's `value` as the other's `usedCards`: a
 * card already on the board is disabled in the hole picker and vice versa, so a duplicate
 * selection is impossible at the UI level, not merely rejected after the fact — the same
 * guarantee `CardPicker`'s own doc comment describes for a single picker, extended across
 * two of them.
 *
 * ## Where the answer sits, and why it is above the pickers
 *
 * The layout was `grid grid-cols-1` at every width with 결과 BELOW two 52-card pickers, so on
 * a phone the reader picked a card and then scrolled past rows of buttons to find out what
 * hand they had (`docs/reports/REVIEW_BEGINNER_UX_SEO.md` M8). 결과 now comes FIRST — in the
 * DOM, so the tab order and a screen reader read the same page a sighted reader sees — and
 * sticks to the top of the viewport below `lg` while the pickers scroll under it. The tool
 * opens on a worked example that is already evaluated, so "here is the answer, change the
 * cards below" is the honest reading order, not a rearrangement for layout's sake.
 *
 * The stuck panel is height-capped with its own scroll (and `tabIndex`, so the cap is
 * reachable by keyboard too) below `lg`, or it would cover the pickers it exists to serve.
 * The headline — 족보 이름, 몇 번째로 강한지 — is what fits inside the cap; the card-by-card
 * breakdown below it scrolls, as it did before.
 *
 * ## Two card displays, two different jobs
 *
 * Once evaluated, this renders BOTH:
 *   - every card the reader actually picked, each marked 사용됨/사용 안 됨 (`PokerCard`
 *     directly, reusing its own `selected`/`disabled` visual states — a highlighted ring for
 *     "used", 40% opacity for "not used", plus the same distinction spelled out in text, so
 *     the difference is never colour/opacity alone);
 *   - the best five cards on their own (`PokerCards`, built from `cardsToString`), so the
 *     answer is visible in isolation from the cards that did not matter.
 * The build spec asks for exactly this: which cards were used has to be as visible as what
 * the hand is.
 */
import { useState } from 'react';
import { cardsToString, makeCard, rankOf, suitOf, type Card } from '@gto-self/shared';
import {
  evaluateHandRank,
  HAND_CHECKER_MAX_BOARD,
  HAND_CHECKER_MAX_HOLE,
  type HandRankResult,
} from '../features/tools/handRank.js';
import { CardPicker } from './CardPicker.js';
import { ExplanationCard } from './ExplanationCard.js';
import { Panel } from './Panel.js';
import { cardAccessibleName, PokerCard } from './PokerCard.js';
import { PokerCards } from './PokerCards.js';
import { SectionHeading } from './SectionHeading.js';
import { ToolAnswer } from './ToolAnswer.js';

/** A realistic two-pair, not a flashy rarity — the tool should open on the hand a beginner
 *  actually meets, the same "already answered" pattern `OutsCalculator`/`PotOddsCalculator`
 *  use. Aces up, kings up, a 9 kicker: five cards, evaluated the instant the page loads. */
const DEFAULT_HOLE: readonly Card[] = [makeCard('A', 'h'), makeCard('K', 'd')];
const DEFAULT_BOARD: readonly Card[] = [makeCard('A', 's'), makeCard('K', 'c'), makeCard('9', 'h')];

function SelectionCard({ card, used }: { readonly card: Card; readonly used: boolean }) {
  const stateLabel = used ? '사용됨' : '사용 안 됨';
  // Korean, not `cardToString` ("Ah"): the wrapper owns the accessible name here, and a
  // Korean site should not spell a suit out to assistive tech as a Latin letter or a glyph
  // (`docs/FISHTILT_STATE.md` ruling 85). The drawn card is unchanged.
  return (
    <div className="flex flex-col items-center gap-1">
      <div role="img" aria-label={`${cardAccessibleName(rankOf(card), suitOf(card))} ${stateLabel}`}>
        <PokerCard
          rank={rankOf(card)}
          suit={suitOf(card)}
          size="md"
          selected={used}
          disabled={!used}
          decorative
        />
      </div>
      <span className={`text-[11px] font-medium ${used ? 'text-text-100' : 'text-text-300'}`}>
        {stateLabel}
      </span>
    </div>
  );
}

interface ResultBodyProps {
  readonly result: HandRankResult;
  /** Every card the reader picked, hole first then board, in selection order — kept
   *  separate from `result` because the view model does not need to restate the raw
   *  selection, only which of it was used. */
  readonly selectedCards: readonly Card[];
}

function ResultBody({ result, selectedCards }: ResultBodyProps) {
  if (result.status === 'INCOMPLETE') {
    return (
      <ExplanationCard title="아직 계산할 수 없습니다">
        <p>
          카드를 더 선택하면 족보를 확인할 수 있어요. 최소 5장이 필요하고, 지금은{' '}
          {result.totalSelected}장을 골랐습니다. {result.moreNeeded}장 더 선택해주세요.
        </p>
      </ExplanationCard>
    );
  }

  return (
    <div>
      {/* The named hand sits in `ground-800`, the recessed rung — see `ToolAnswer`. `size`
          is `name` because this answer is Korean prose, not a percentage: the same slot the
          other three calculators fill with a number. The note says where the hand stands in
          the fixed order of nine; it does not say whether the hand is worth playing. */}
      <ToolAnswer
        lead={result.categoryLabel}
        value={result.reading}
        size="name"
        note={`9개 족보 중 ${result.rankFromTop}번째로 강한 족보입니다.`}
      />
      <p className="mt-4 text-sm leading-relaxed text-text-100">{result.explanation}</p>

      {result.note !== null ? (
        <ExplanationCard className="mt-4" title="참고하세요">
          <p>{result.note}</p>
        </ExplanationCard>
      ) : null}

      <div className="mt-6">
        <SectionHeading
          as="h3"
          title="당신이 고른 카드"
          description="족보에 실제로 쓰인 카드는 테두리로, 쓰이지 않은 카드는 흐리게 표시됩니다."
          className="mb-3"
        />
        <div className="flex flex-wrap gap-3">
          {selectedCards.map((card) => (
            <SelectionCard key={card} card={card} used={result.usedCards.has(card)} />
          ))}
        </div>
      </div>

      <div className="mt-6">
        <SectionHeading as="h3" title="최고의 다섯 장" className="mb-3" />
        <PokerCards cards={cardsToString(result.bestFive)} showReading={false} size="md" />
      </div>
    </div>
  );
}

export function HandChecker() {
  const [holeCards, setHoleCards] = useState<readonly Card[]>(DEFAULT_HOLE);
  const [boardCards, setBoardCards] = useState<readonly Card[]>(DEFAULT_BOARD);

  const result = evaluateHandRank(holeCards, boardCards);

  function reset() {
    setHoleCards([]);
    setBoardCards([]);
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <Panel as="section" className="sticky top-0 z-10 lg:static">
        <SectionHeading as="h2" title="결과" className="mb-5" />
        <div
          aria-live="polite"
          tabIndex={0}
          className="max-h-[36svh] overflow-y-auto lg:max-h-none lg:overflow-visible"
        >
          <ResultBody result={result} selectedCards={[...holeCards, ...boardCards]} />
        </div>
      </Panel>

      <Panel as="section">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeading as="h2" title="카드를 선택하세요" />
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center rounded-md border border-line-500 px-4 text-sm font-medium text-text-100 outline-none transition-colors duration-150 hover:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            카드 초기화
          </button>
        </div>

        <div className="mt-5 space-y-6">
          <div>
            <p className="text-sm font-semibold text-text-100">
              핸드 카드 (최대 {HAND_CHECKER_MAX_HOLE}장)
            </p>
            <div className="mt-2">
              <CardPicker
                label="핸드 카드 선택"
                value={holeCards}
                onChange={setHoleCards}
                usedCards={boardCards}
                max={HAND_CHECKER_MAX_HOLE}
                size="sm"
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-text-100">
              보드 카드 (최대 {HAND_CHECKER_MAX_BOARD}장)
            </p>
            <div className="mt-2">
              <CardPicker
                label="보드 카드 선택"
                value={boardCards}
                onChange={setBoardCards}
                usedCards={holeCards}
                max={HAND_CHECKER_MAX_BOARD}
                size="sm"
              />
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
