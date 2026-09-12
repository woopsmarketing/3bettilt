'use client';

/**
 * `RangeQuiz` — the `/practice/range-quiz` interactive island. Two screens:
 *
 *   1. Setup: pick a position (the only axis this quiz actually varies). `내 위치` and the
 *      conditions statement (상황 · 스택 · 테이블) reuse `RangeFilters` verbatim — the exact
 *      same "one supported situation, named up front; the unsupported ones named as text"
 *      block the Range Explorer uses (WP-S3-19, review B-M3), so this quiz never has to
 *      re-decide which combinations are honest to offer (`features/range/resolve.ts` draws
 *      that line once).
 *   2. Play: the shared `Quiz` engine, handed a real `resolveRange`-derived question bank
 *      (`features/quiz/rangeQuestions.ts`) and a fixed seed.
 *
 * ## The Start button is the one gate, and it reads real data, not a hard-coded list
 *
 * `내 위치` offers all six positions, exactly like the Range Explorer — selecting `BB` is
 * not an error, it is `resolveRange`'s own honest `BB_HAS_NO_RFI_RANGE` explanation
 * (`docs/FISHTILT_STATE.md` settled decision 2). `퀴즈 시작` is disabled whenever
 * `resolveRange(query).kind !== 'RANGE'`, so a reader can never launch a session with zero
 * real questions to ask — never "offer, then apologise".
 *
 * ## Stage 3 (contract BF): the position is always on screen
 *
 * A range-membership question only means something for ONE seat, and the old play screen
 * never showed which. Both screens now carry `PositionDiagram` with the chosen seat filled
 * and the conditions line (`describeRangeConditions`) beside it: on setup it follows the
 * picker live, on play it sits in a side column (sticky from `lg`) next to the question,
 * together with the one way back — "다른 위치 선택". Nothing about the questions, the seed
 * or the gate changed; `rangeQuestions.ts` and its tests are untouched.
 *
 * ## Why the bank is rebuilt with `useMemo`, not read once at mount
 *
 * Unlike `Quiz` itself (which reads its `questions`/`seed`/`limit` props once, per its own
 * module doc), THIS setup screen can change position freely before the reader ever presses
 * start. Every change here recomputes `resolveRange`/`buildRangeQuestions` for the new
 * position; only the `Quiz` instance that mounts once "퀴즈 시작" is pressed gets a fixed
 * bank for its own lifetime — pressing "다른 위치 선택" unmounts it, and starting again
 * mounts a brand new one.
 */
import { useMemo, useState } from 'react';
import type { StrategyPosition } from '@gto-self/strategy-core';
import {
  describeRangeConditions,
  POSITION_GLOSS,
  RANGE_LABEL,
  resolveRange,
  UNSUPPORTED_REASON_LABEL,
  type RangeSpot,
  type RangeStackDepth,
} from '../features/range/index.js';
import {
  buildRangeQuestions,
  RANGE_QUIZ_QUESTION_LIMIT,
  RANGE_QUIZ_SEED,
  RANGE_QUIZ_SPOT,
  RANGE_QUIZ_STACK_DEPTH,
  RANGE_QUIZ_TABLE_SIZE,
} from '../features/quiz/rangeQuestions.js';
import { ExplanationCard } from './ExplanationCard.js';
import { PositionDiagram } from './PositionDiagram.js';
import { Quiz } from './Quiz.js';
import { RangeFilters } from './RangeFilters.js';

const DEFAULT_HERO_POSITION: StrategyPosition = 'BTN';

const START_BUTTON_CLASS =
  'inline-flex min-h-12 w-full items-center justify-center rounded-md bg-brand-600 px-6 py-3 text-base font-semibold ' +
  'text-ink-on-brand outline-none transition-colors duration-150 enabled:hover:bg-brand-hover focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto';

const BACK_BUTTON_CLASS =
  'inline-flex min-h-11 cursor-pointer items-center rounded-md border border-line-500 px-4 text-sm ' +
  'font-semibold text-text-100 outline-none transition-colors duration-150 hover:border-brand-500 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

export function RangeQuiz() {
  const [heroPosition, setHeroPosition] = useState<StrategyPosition>(DEFAULT_HERO_POSITION);
  const [spot, setSpot] = useState<RangeSpot>(RANGE_QUIZ_SPOT);
  const [stackDepth, setStackDepth] = useState<RangeStackDepth>(RANGE_QUIZ_STACK_DEPTH);
  const [started, setStarted] = useState(false);

  const query = useMemo(
    () => ({ heroPosition, spot, stackDepth, tableSize: RANGE_QUIZ_TABLE_SIZE }),
    [heroPosition, spot, stackDepth],
  );
  const resolution = useMemo(() => resolveRange(query), [query]);
  const questions = useMemo(() => buildRangeQuestions(query), [query]);
  const seatLine = `${POSITION_GLOSS[heroPosition]}(${heroPosition}) 자리 · ${describeRangeConditions(query)}`;

  if (started) {
    return (
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-12" data-range-quiz="play">
        <div className="min-w-0 lg:col-span-7">
          <Quiz
            key={`${query.heroPosition}-${query.spot}-${query.stackDepth}-${query.tableSize}`}
            questions={questions}
            seed={RANGE_QUIZ_SEED}
            limit={RANGE_QUIZ_QUESTION_LIMIT}
            title="레인지 퀴즈"
          />
        </div>
        <aside
          aria-label="지금 풀고 있는 자리"
          className="min-w-0 rounded-xl bg-ground-800 p-5 lg:sticky lg:top-6 lg:col-span-5 lg:self-start"
        >
          <p className="text-xs font-semibold tracking-[0.06em] text-text-300">
            지금 풀고 있는 자리
          </p>
          <p className="prose-ko mt-1 text-base font-semibold text-text-100">{seatLine}</p>
          <PositionDiagram highlight={heroPosition} className="mt-4" />
          <p className="prose-ko mt-3 text-sm text-text-300">
            {`이 자리에서 아무도 참여하지 않았을 때 첫 번째로 오픈하는 ${RANGE_LABEL}에 각 시작 패가 들어 있는지 묻습니다.`}
          </p>
          <button
            type="button"
            onClick={() => setStarted(false)}
            className={`${BACK_BUTTON_CLASS} mt-5`}
          >
            다른 위치 선택
          </button>
        </aside>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-12" data-range-quiz="setup">
      <div className="min-w-0 lg:col-span-7">
        <p className="prose-ko text-base text-text-300">
          포지션을 고르면, 그 자리의 학습용 기본 레인지에 각 시작 패가 포함되는지 직접 맞혀볼 수
          있습니다. 지금은 아무도 참여하지 않았을 때(First In) · 100BB · 6인 조건만 지원합니다.
        </p>

        <RangeFilters
          className="mt-6"
          groups="POSITION"
          heroPosition={heroPosition}
          onHeroPositionChange={setHeroPosition}
          spot={spot}
          onSpotChange={setSpot}
          stackDepth={stackDepth}
          onStackDepthChange={setStackDepth}
        />

        {resolution.kind === 'UNSUPPORTED' ? (
          <ExplanationCard className="mt-6" title="아직 준비되지 않았습니다">
            <ul className="list-disc space-y-1 pl-4">
              {resolution.reasons.map((reason) => (
                <li key={reason}>{UNSUPPORTED_REASON_LABEL[reason]}</li>
              ))}
            </ul>
          </ExplanationCard>
        ) : null}

        <div className="mt-8">
          <button
            type="button"
            disabled={resolution.kind !== 'RANGE'}
            onClick={() => setStarted(true)}
            className={START_BUTTON_CLASS}
          >
            퀴즈 시작
          </button>
          <p className="mt-2 text-xs text-text-300">{`${RANGE_QUIZ_QUESTION_LIMIT}문제 · 한 문제씩 바로 채점`}</p>
        </div>
      </div>

      <aside
        aria-label="고른 자리와 조건"
        className="min-w-0 rounded-xl bg-ground-800 p-5 lg:col-span-5"
      >
        <p className="text-xs font-semibold tracking-[0.06em] text-text-300">고른 자리</p>
        <p className="prose-ko mt-1 text-base font-semibold text-text-100">{seatLine}</p>
        <PositionDiagram highlight={heroPosition} className="mt-4" />

        <div className="mt-6 border-t border-line-500 pt-5">
          <p className="text-sm font-semibold text-text-100">이 퀴즈가 쓰는 조건</p>
          <p className="prose-ko mt-1 text-sm text-text-300">
            상황과 스택은 지금 하나씩만 준비되어 있어서 바꿀 수 없습니다.
          </p>
          <RangeFilters
            className="mt-4"
            groups="CONDITIONS"
            heroPosition={heroPosition}
            onHeroPositionChange={setHeroPosition}
            spot={spot}
            onSpotChange={setSpot}
            stackDepth={stackDepth}
            onStackDepthChange={setStackDepth}
          />
        </div>
      </aside>
    </div>
  );
}
