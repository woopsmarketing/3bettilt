'use client';

/**
 * `EquityCalculator` — the interactive island on `/tools/equity`. A beginner picks 2 hero
 * cards and 2 opponent cards, with an optional board (0, 3, 4 or 5 cards), and the tool
 * reports the exact heads-up equity split three ways — hero / tie / opponent — using
 * `@gto-self/learn-core`'s `exactHeadsUpEquity` through `features/tools/equity.ts`.
 *
 * ## No duplicate card, anywhere
 *
 * The three `CardPicker`s cross-reference each OTHER's `value` as their own `usedCards`: a
 * card already on the board or in the other hand is disabled everywhere else, so a
 * duplicate selection is impossible at the UI level — the same guarantee
 * `HandChecker.tsx` gives across two pickers, extended here across three.
 *
 * ## The async seam (WP-F2A ruling 20 / WP-F2B brief / WP-O3)
 *
 * This component never calls `exactHeadsUpEquity` directly: it calls
 * `computeExactEquityAsync` (`features/tools/equity.js`), a module-level function returning
 * `Promise<ExactEquity>`. WP-F2B predicted that the day WP-O3 wanted a worker only that
 * function's BODY would change, and that is what happened — WP-O3 measured the shipped page
 * at 300ms of blocked main thread under 4x CPU throttling, past ruling 2's 250ms gate, and
 * moved the enumeration into a Web Worker. Not one line of this component changed: the
 * effect, the pending state and the stale-result race guard below were already the right
 * shape for an answer that arrives later, and they are what makes `다시 계산 중…` and the
 * card pickers stay live while the worker runs.
 *
 * ## Where the answer sits, and why it is above the pickers
 *
 * The whole value of this tool is watching the number move as a card changes, and at 375px
 * it was impossible: the layout was `grid grid-cols-1` at every width with 결과 BELOW three
 * 52-card pickers — roughly 36 rows of card buttons between the last card tapped and the
 * answer (`docs/reports/REVIEW_BEGINNER_UX_SEO.md` M8). A reader picked two cards and then
 * scrolled past a hundred more buttons to find out what happened.
 *
 * So 결과 comes FIRST — in the DOM, not only visually, so a screen reader and the tab order
 * read the same page a sighted reader sees — and sticks to the top of the viewport on narrow
 * screens while the pickers scroll underneath it. The tool opens on a worked example that is
 * already computed, so "here is the answer, change the cards below" is the honest reading
 * order rather than a rearrangement for layout's sake.
 *
 * The stuck panel has to stay SHORT or it eats the screen it was meant to share, so two
 * things bound it: the result rows put each side's cards inline beside their label rather
 * than stacked under it, and the result body is height-capped with its own scroll below `lg`.
 * The cap is lifted at `lg`, where the page is tall enough not to need it and the panel stops
 * being sticky at all.
 *
 * ## The stale-result race
 *
 * A beginner can change a card while the previous computation is still outstanding. Each
 * effect run captures its own `cancelled` flag; React guarantees the PREVIOUS effect's
 * cleanup (`cancelled = true`) runs before this render's effect body, so a slower, older
 * computation that resolves after a newer one has already started is dropped rather than
 * overwriting the fresher answer — the standard "ignore a stale async response" pattern,
 * verified explicitly in `EquityCalculator.test.tsx`.
 */
import { useEffect, useState } from 'react';
import { makeCard, rankOf, suitOf, type Card } from '@gto-self/shared';
import type { ExactEquity } from '@gto-self/learn-core';
import {
  computeExactEquityAsync,
  equityCountSentence,
  equityMethodLabel,
  equityMethodSentence,
  equityPendingMessages,
  equityPercentages,
  equitySelectionStatus,
  EQUITY_HAND_SIZE,
  EQUITY_HERO_LABEL,
  EQUITY_MAX_BOARD,
  EQUITY_RESET_LABEL,
  EQUITY_SWAP_LABEL,
  EQUITY_TIE_LABEL,
  EQUITY_VILLAIN_LABEL,
  type EquityPending,
} from '../features/tools/equity.js';
import { CardPicker } from './CardPicker.js';
import { ExplanationCard } from './ExplanationCard.js';
import { Panel } from './Panel.js';
import { PokerCard } from './PokerCard.js';
import { SectionHeading } from './SectionHeading.js';
import { ToolAnswer } from './ToolAnswer.js';

/** AA vs KK preflop — the classic worked example, and the same fixture this module's own
 *  unit tests use, so a reader who checks the numbers can find them pinned there too. */
const DEFAULT_HERO: readonly Card[] = [makeCard('A', 's'), makeCard('A', 'h')];
const DEFAULT_VILLAIN: readonly Card[] = [makeCard('K', 's'), makeCard('K', 'h')];
const DEFAULT_BOARD: readonly Card[] = [];

const SECONDARY_BUTTON_CLASS =
  'inline-flex h-11 items-center rounded-md border border-line-500 px-4 text-sm font-medium ' +
  'text-text-100 outline-none transition-colors duration-150 hover:border-brand-500 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

export interface EquityCalculatorProps {
  /**
   * Testing seam only. Production always uses the default — the real async engine call
   * (`computeExactEquityAsync`). Overridable so a test can control exactly when each
   * computation resolves, to prove a stale result can never overwrite a newer one.
   */
  readonly computeEquity?: typeof computeExactEquityAsync;
}

function PendingBody({ pending }: { readonly pending: EquityPending }) {
  const messages = equityPendingMessages(pending);
  return (
    <ExplanationCard title="아직 계산할 수 없습니다">
      {messages.map((message, index) => (
        <p key={message} className={index > 0 ? 'mt-2' : ''}>
          {message}
        </p>
      ))}
    </ExplanationCard>
  );
}

/** One side's line of the answer: who, which cards, what percentage.
 *
 *  The cards sit INLINE beside the label rather than stacked under it. Stacked, each row
 *  cost ~116px and the three of them pushed the answer past the height a panel can hold on
 *  a phone while still leaving room to pick cards — see the module doc. Nothing is dropped:
 *  the same label, the same cards and the same percentage are on screen, on one line. */
function ResultRow({
  label,
  cards,
  percent,
  emphasis,
}: {
  readonly label: string;
  readonly cards: readonly Card[] | null;
  readonly percent: string;
  readonly emphasis: 'lg' | 'sm';
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line-500 pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-text-300">{label}</p>
        {cards !== null ? (
          <span className="flex gap-1" role="group" aria-label={`${label} 카드`}>
            {cards.map((card) => (
              <PokerCard key={card} rank={rankOf(card)} suit={suitOf(card)} size="xs" />
            ))}
          </span>
        ) : null}
      </div>
      <p
        className={`tabular font-semibold text-text-100 ${emphasis === 'lg' ? 'text-3xl' : 'text-xl'}`}
      >
        {percent}
      </p>
    </div>
  );
}

function ResultBody({
  equity,
  pending,
}: {
  readonly equity: ExactEquity;
  readonly pending: boolean;
}) {
  const percentages = equityPercentages(equity);
  return (
    <div>
      <p className="text-sm text-text-300">
        {equityMethodLabel(equity)}
        {pending ? ' · 다시 계산 중…' : ''}
      </p>

      {/* The three rows sit in `ground-800`, the recessed rung — see `ToolAnswer`. They are
          the answer; the method label above and the working below are about the answer. */}
      <ToolAnswer className="mt-3">
        <div className="space-y-3">
          <ResultRow
            label={EQUITY_HERO_LABEL}
            cards={equity.heroCards}
            percent={percentages.heroPercent}
            emphasis="lg"
          />
          <ResultRow
            label={EQUITY_TIE_LABEL}
            cards={null}
            percent={percentages.tiePercent}
            emphasis="sm"
          />
          <ResultRow
            label={EQUITY_VILLAIN_LABEL}
            cards={equity.villainCards}
            percent={percentages.villainPercent}
            emphasis="lg"
          />
        </div>
      </ToolAnswer>

      {/* WHAT THE NUMBER MEANS, in one line — the gap WP-4 found on this tool: three labelled
          percentages with nothing saying what a percentage is OF. It stops at the meaning; it
          does not tell anyone what to do with it. No figure is written here (the sentence has
          no digits at all), so it cannot drift from what the engine computed. */}
      <p className="mt-3 text-sm leading-relaxed text-text-300">
        각 숫자는 지금 상태에서 남은 카드가 나올 수 있는 모든 경우 중, 그쪽이 차지하는 비율입니다.
      </p>

      <ExplanationCard className="mt-6" title="어떻게 계산했나요?">
        <p>{equityMethodSentence(equity)}</p>
        <p className="mt-2">{equityCountSentence(equity)}</p>
      </ExplanationCard>
    </div>
  );
}

export function EquityCalculator({
  computeEquity = computeExactEquityAsync,
}: EquityCalculatorProps = {}) {
  const [heroCards, setHeroCards] = useState<readonly Card[]>(DEFAULT_HERO);
  const [villainCards, setVillainCards] = useState<readonly Card[]>(DEFAULT_VILLAIN);
  const [boardCards, setBoardCards] = useState<readonly Card[]>(DEFAULT_BOARD);
  const [equity, setEquity] = useState<ExactEquity | null>(null);
  const [pending, setPending] = useState(false);

  const status = equitySelectionStatus(heroCards, villainCards, boardCards);

  useEffect(() => {
    let cancelled = false;
    const currentStatus = equitySelectionStatus(heroCards, villainCards, boardCards);

    if (currentStatus.status !== 'READY') {
      setEquity(null);
      setPending(false);
      return () => {
        cancelled = true;
      };
    }

    setPending(true);
    computeEquity(currentStatus.hero, currentStatus.villain, currentStatus.board).then((result) => {
      // A newer selection may have started (and cancelled this one) before the engine
      // answered — an older, slower response landing after a newer one is dropped here,
      // never applied on top of the fresher result.
      if (cancelled) return;
      setEquity(result);
      setPending(false);
    });

    return () => {
      cancelled = true;
    };
  }, [heroCards, villainCards, boardCards, computeEquity]);

  function reset() {
    setHeroCards([]);
    setVillainCards([]);
    setBoardCards([]);
  }

  function swap() {
    setHeroCards(villainCards);
    setVillainCards(heroCards);
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      {/*
        결과 first, and stuck to the top of the viewport below `lg` — see the module doc's
        "Where the answer sits". `tabIndex` on the scrolling body is what makes the capped
        region reachable by keyboard as well as by touch; the cap and the stickiness both
        stop at `lg`, where there is room for the panel at its natural size.
      */}
      <Panel as="section" className="sticky top-0 z-10 lg:static">
        <SectionHeading as="h2" title="결과" className="mb-5" />
        <div
          aria-live="polite"
          tabIndex={0}
          className="max-h-[36svh] overflow-y-auto lg:max-h-none lg:overflow-visible"
        >
          {status.status === 'PENDING' ? (
            <PendingBody pending={status} />
          ) : equity === null ? (
            <ExplanationCard title="계산 중입니다" className="equity-js-only">
              <p>잠시만 기다려주세요.</p>
            </ExplanationCard>
          ) : (
            <ResultBody equity={equity} pending={pending} />
          )}
          {/*
           * WITHOUT JAVASCRIPT, "계산 중입니다 / 잠시만 기다려주세요" is a sentence that never
           * comes true. This is the only tool on the site with that problem: the other five
           * compute during render, so their prerendered HTML already holds a real answer, while
           * this one hands the work to a Web Worker that a reader with scripting off never
           * starts. The Stage-2 review found the page stalled on that card forever — the site
           * telling a reader to wait for something nobody is doing, which is CLAUDE.md rule 5's
           * silent stub wearing a spinner.
           *
           * `<noscript>` is parsed as markup only when scripting is off, so the `<style>` inside
           * it hides the waiting card for exactly the readers it is lying to and does nothing
           * for everyone else. That is the whole trick, and it needs no class toggling, no
           * hydration flag and no second render path.
           *
           * The card that replaces it does NOT apologise and does not promise a fallback that
           * does not exist: an exhaustive equity enumeration is not something this page can do
           * server-side for an input the reader has not chosen yet. It says what the tool needs
           * and points at the two tools that work with scripting off, both of which are
           * prerendered with real numbers.
           */}
          <noscript>
            <style>{'.equity-js-only{display:none}'}</style>
            <ExplanationCard title="이 계산기에는 자바스크립트가 필요합니다">
              <p>
                승률은 이 페이지가 브라우저 안에서 직접 세어서 구합니다. 미리 계산해 둔 표를
                읽어오는 것이 아니라, 고른 카드로 만들 수 있는 보드를 그 자리에서 전부 세기 때문에,
                자바스크립트가 꺼져 있으면 결과가 나오지 않습니다.
              </p>
              <p className="mt-2">
                자바스크립트를 켜면 바로 계산됩니다. 켜지 않은 채로도, 팟 오즈 계산기와 아웃
                계산기는 기본 예시의 계산 결과가 화면에 이미 적혀 있어 그대로 읽을 수 있습니다 (값을
                바꾸려면 역시 자바스크립트가 필요합니다).
              </p>
            </ExplanationCard>
          </noscript>
        </div>
      </Panel>

      <Panel as="section">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeading as="h2" title="카드를 선택하세요" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={swap} className={SECONDARY_BUTTON_CLASS}>
              {EQUITY_SWAP_LABEL}
            </button>
            <button type="button" onClick={reset} className={SECONDARY_BUTTON_CLASS}>
              {EQUITY_RESET_LABEL}
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-6">
          <div>
            <p className="text-sm font-semibold text-text-100">
              내 핸드 (카드 {EQUITY_HAND_SIZE}장)
            </p>
            <div className="mt-2">
              <CardPicker
                label="내 핸드 카드 선택"
                value={heroCards}
                onChange={setHeroCards}
                usedCards={[...villainCards, ...boardCards]}
                max={EQUITY_HAND_SIZE}
                size="sm"
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-text-100">
              상대 핸드 (카드 {EQUITY_HAND_SIZE}장)
            </p>
            <div className="mt-2">
              <CardPicker
                label="상대 핸드 카드 선택"
                value={villainCards}
                onChange={setVillainCards}
                usedCards={[...heroCards, ...boardCards]}
                max={EQUITY_HAND_SIZE}
                size="sm"
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-text-100">
              보드 (선택 사항 · 0, 3, 4, 5장 중 하나)
            </p>
            <div className="mt-2">
              <CardPicker
                label="보드 카드 선택"
                value={boardCards}
                onChange={setBoardCards}
                usedCards={[...heroCards, ...villainCards]}
                max={EQUITY_MAX_BOARD}
                size="sm"
              />
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
