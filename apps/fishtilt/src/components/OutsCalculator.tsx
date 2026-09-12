'use client';

/**
 * `OutsCalculator` — the interactive island on `/tools/outs`.
 *
 * ## Both answers, always, side by side
 *
 * Beginners are taught "outs × 2, outs × 4". It is a genuinely useful mental tool and it is
 * wrong by a widening margin: at 15 outs the ×4 shortcut claims 60% when the deck says
 * 54.1%. Showing only the shortcut would teach a falsehood; hiding it would leave a reader
 * unable to follow any other poker book, video or forum post, all of which use it. So this
 * page shows the exact hypergeometric probability AND the shortcut AND the signed gap
 * between them, every time, with the direction of the error written out in words rather
 * than implied by a sign or a colour. `outs.ts` already returns all three — nothing here
 * recomputes them.
 *
 * ## Nothing typed is clamped
 *
 * Type 60 outs on the flop and the page says there are only 47 unseen cards; it does not
 * quietly become 47. Switch from the flop to the turn while holding 47 and the same thing
 * happens, because 47 really is impossible with 46 unseen cards. The stepper's +/- buttons
 * stop at the legal bounds — a button that cannot produce a legal value is disabled rather
 * than producing an illegal one — but the text field itself accepts whatever a person
 * types, and `outsOdds` explains why it is not a draw.
 *
 * ## Why the presets are derived, not typed
 *
 * A flush draw has nine outs because a suit holds thirteen cards and four are already
 * visible. `features/tools/draws.ts` computes every preset from `RANKS`/`SUITS` and ships
 * the derivation sentence beside it, so the tool teaches counting instead of replacing it.
 *
 * ## Where the answer sits (WP-4)
 *
 * The two columns were input-left / result-right, which collapses to input-THEN-result on a
 * phone — and this tool's input column is the tall one: a street row, a stepper, and a
 * vertical list of draw presets. Tapping a preset at the bottom of that list changed a number
 * the reader could not see, the same failure `EquityCalculator` and `HandChecker` were rebuilt
 * to fix (`docs/reports/REVIEW_BEGINNER_UX_SEO.md` M8).
 *
 * So 결과 comes FIRST in the DOM — so a screen reader and the tab order read the page a
 * sighted reader sees — and sticks to the top of the viewport below `lg` while the controls
 * scroll underneath it, height-capped with its own scroll and `tabIndex` so the cap is
 * reachable by keyboard too. At `lg` explicit `col-start`/`row-start` restore the original
 * controls-left / result-right layout: DOM order carries the phone, grid placement the laptop.
 */
import { useId, useState } from 'react';
import { outsOdds, type DrawStreet, type OutsOdds } from '@gto-self/learn-core';
import {
  DRAW_PRESETS,
  formatPercent,
  formatSignedPercentagePoints,
  OUTS_INPUT_ERROR_LABEL,
  OUTS_STREETS,
  outsErrorLabel,
  parseOutsInput,
  RIVER_HORIZON_LABEL,
  SHORTCUT_DIRECTION_LABEL,
  shortcutComparisons,
  STREET_LABEL,
  STREET_SHORT_LABEL,
  unseenCardsOn,
  type ShortcutComparison,
} from '../features/tools/index.js';
import { ExplanationCard } from './ExplanationCard.js';
import { Panel } from './Panel.js';
import { SectionHeading } from './SectionHeading.js';
import { ToolAnswer } from './ToolAnswer.js';

/** A flush draw — the draw a beginner meets first and recognises on sight. */
const DEFAULT_OUTS = '9';
const DEFAULT_STREET: DrawStreet = 'FLOP';

const CHOICE_BUTTON_BASE =
  'inline-flex h-11 min-w-11 items-center justify-center rounded-md border px-3 text-sm ' +
  'font-semibold outline-none transition-colors duration-150 focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-brand-500';

function choiceClass(selected: boolean): string {
  return selected
    ? `${CHOICE_BUTTON_BASE} border-brand-500 bg-brand-600 text-ink-on-brand`
    : `${CHOICE_BUTTON_BASE} border-line-500 bg-panel-600 text-text-100 hover:border-brand-500`;
}

const STEPPER_CLASS =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border ' +
  'border-line-500 bg-panel-600 text-lg font-semibold text-text-100 outline-none ' +
  'transition-colors duration-150 hover:border-brand-500 focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-brand-500 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-line-500';

function StatRow({ term, value }: { readonly term: string; readonly value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line-500 py-3 first:border-t-0 first:pt-0">
      <dt className="text-sm text-text-300">{term}</dt>
      <dd className="tabular text-base font-semibold text-text-100">{value}</dd>
    </div>
  );
}

/** One exact-vs-shortcut card. Two of these on the flop, one on the turn. */
function ShortcutCard({ comparison }: { readonly comparison: ShortcutComparison }) {
  return (
    <div className="rounded-md border border-line-500 bg-ground-800 p-4">
      <p className="text-sm font-semibold text-text-100">{comparison.label}</p>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-text-300">정확한 계산</dt>
          <dd className="tabular font-semibold text-text-100">
            {formatPercent(comparison.exactProb)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-text-300">×{comparison.multiplier} 규칙</dt>
          <dd className="tabular font-semibold text-text-100">
            {formatPercent(comparison.shortcutProb)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-line-500 pt-2">
          <dt className="text-text-300">차이</dt>
          <dd className="tabular font-semibold text-text-100">
            {formatSignedPercentagePoints(comparison.error)}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-text-300">{SHORTCUT_DIRECTION_LABEL[comparison.direction]}</p>
    </div>
  );
}

/**
 * The decomposition, using the domain's own two components — never re-derived here.
 *
 * The MONO face is on the numbers only. `--font-mono` has no Hangul, so a Korean label
 * rendered in it falls back to a monospaced CJK face and every syllable is padded to a full
 * em — "턴에서  바로  맞을  확률" with visible double gaps. The digits are what have to line
 * up in a column; the label does not.
 */
function WorkedBreakdown({ odds }: { readonly odds: OutsOdds }) {
  return (
    <div className="mt-6 rounded-md border border-line-500 bg-ground-800 p-4">
      <p className="text-sm font-semibold text-text-100">계산 과정</p>
      <p className="mt-3 text-sm leading-relaxed text-text-300">
        아직 보지 못한 카드는{' '}
        <span className="tabular font-semibold text-text-100">{odds.unseenCards}장</span>이고, 그중{' '}
        <span className="tabular font-semibold text-text-100">{odds.outs}장</span>이 내 아웃입니다.
      </p>
      {odds.cardsToCome === 2 ? (
        <dl className="mt-3 space-y-1 text-sm leading-relaxed">
          <div className="flex flex-wrap justify-between gap-x-4">
            <dt className="text-text-300">턴에서 바로 맞을 확률</dt>
            <dd className="tabular font-mono text-text-100">{formatPercent(odds.nextCardProb)}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-x-4">
            <dt className="text-text-300">턴에 놓치고 리버에 맞을 확률</dt>
            <dd className="tabular font-mono text-text-100">
              {formatPercent(odds.missThenHitProb)}
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-x-4 border-t border-line-500 pt-1">
            <dt className="text-text-300">둘을 더하면 리버까지</dt>
            <dd className="tabular font-mono text-text-100">{formatPercent(odds.byRiverProb)}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-text-300">
          남은 카드가 리버 한 장뿐이라 &quot;다음 카드&quot;와 &quot;리버까지&quot;는 같은
          사건입니다. 그래서 값도 하나뿐입니다.
        </p>
      )}
    </div>
  );
}

export function OutsCalculator() {
  const fieldId = useId();
  const [street, setStreet] = useState<DrawStreet>(DEFAULT_STREET);
  const [outsText, setOutsText] = useState(DEFAULT_OUTS);

  const unseen = unseenCardsOn(street);
  const parsed = parseOutsInput(outsText);
  const parseError = parsed.ok ? null : OUTS_INPUT_ERROR_LABEL[parsed.error];
  const odds = parsed.ok ? outsOdds({ outs: parsed.value, street }) : null;

  /** The stepper only moves between legal counts; it never manufactures an illegal one. */
  const outsValue = parsed.ok ? parsed.value : null;
  const canDecrease = outsValue !== null && Number.isInteger(outsValue) && outsValue > 0;
  const canIncrease = outsValue !== null && Number.isInteger(outsValue) && outsValue < unseen;

  function step(delta: number) {
    if (outsValue === null) return;
    setOutsText(String(outsValue + delta));
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start">
      <Panel as="section" className="sticky top-0 z-10 lg:static lg:col-start-2 lg:row-start-1">
        <SectionHeading as="h2" title="계산 결과" className="mb-5" />
        <div
          aria-live="polite"
          tabIndex={0}
          className="max-h-[36svh] overflow-y-auto lg:max-h-none lg:overflow-visible"
        >
          {odds === null ? (
            <ExplanationCard title="아직 계산할 수 없습니다">
              <p>아웃 개수를 숫자로 입력하면 바로 결과가 나옵니다.</p>
            </ExplanationCard>
          ) : !odds.ok ? (
            <ExplanationCard title="이 개수는 계산할 수 없습니다">
              <p>{outsErrorLabel(odds.error, street)}</p>
            </ExplanationCard>
          ) : (
            <>
              {/* The headline sits in `ground-800`, the recessed rung — see `ToolAnswer`. The
                  lead and the note say what the probability IS and over which cards; neither
                  says whether the draw is worth chasing. */}
              <ToolAnswer
                lead={`${STREET_SHORT_LABEL[street]}에서 아웃 ${odds.value.outs}장이면, ${RIVER_HORIZON_LABEL[street]}`}
                value={formatPercent(odds.value.byRiverProb)}
                note="확률로 드로우가 완성됩니다."
              />

              <dl className="mt-6">
                <StatRow
                  term="다음 카드 한 장에서 맞을 확률"
                  value={formatPercent(odds.value.nextCardProb)}
                />
                {odds.value.cardsToCome === 2 ? (
                  <StatRow
                    term="다음 카드는 놓치고 마지막에 맞을 확률"
                    value={formatPercent(odds.value.missThenHitProb)}
                  />
                ) : null}
                <StatRow term="아직 보지 못한 카드" value={`${odds.value.unseenCards}장`} />
                <StatRow term="남은 카드" value={`${odds.value.cardsToCome}장`} />
              </dl>

              <WorkedBreakdown odds={odds.value} />

              <div className="mt-6">
                <SectionHeading
                  as="h3"
                  title="×2 / ×4 규칙과 비교하면"
                  description="흔히 쓰는 암산 규칙입니다. 편하지만 정확하지는 않습니다."
                  className="mb-3"
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {shortcutComparisons(odds.value).map((comparison) => (
                    <ShortcutCard key={comparison.id} comparison={comparison} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </Panel>

      <Panel as="section" className="lg:col-start-1 lg:row-start-1">
        <SectionHeading as="h2" title="지금 상황을 골라보세요" />

        <div className="mt-5 space-y-6">
          <div>
            <p className="text-sm font-semibold text-text-100">보드가 어디까지 나왔나요?</p>
            <div role="group" aria-label="스트리트" className="mt-2 flex flex-wrap gap-2">
              {OUTS_STREETS.map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  aria-pressed={street === candidate}
                  onClick={() => setStreet(candidate)}
                  className={choiceClass(street === candidate)}
                >
                  {STREET_LABEL[candidate]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor={`${fieldId}-outs`}
              className="block text-sm font-semibold text-text-100"
            >
              내 아웃은 몇 장인가요?
            </label>
            <p className="mt-1 text-xs text-text-300">
              아웃은 내 패를 이기는 패로 만들어주는 카드입니다. 지금 보지 못한 카드는 {unseen}
              장입니다.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                aria-label="아웃 한 장 줄이기"
                disabled={!canDecrease}
                onClick={() => step(-1)}
                className={STEPPER_CLASS}
              >
                −
              </button>
              <input
                id={`${fieldId}-outs`}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={outsText}
                onChange={(event) => setOutsText(event.target.value)}
                aria-invalid={parseError !== null || (odds !== null && !odds.ok)}
                aria-describedby={
                  parseError !== null || (odds !== null && !odds.ok)
                    ? `${fieldId}-outs-error`
                    : undefined
                }
                className="h-11 w-full min-w-0 rounded-md border border-line-500 bg-panel-600 px-3 text-center text-text-100 tabular outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              />
              <button
                type="button"
                aria-label="아웃 한 장 늘리기"
                disabled={!canIncrease}
                onClick={() => step(1)}
                className={STEPPER_CLASS}
              >
                +
              </button>
            </div>
            {parseError !== null ? (
              <p id={`${fieldId}-outs-error`} role="alert" className="mt-2 text-sm text-brand-500">
                {parseError}
              </p>
            ) : odds !== null && !odds.ok ? (
              <p id={`${fieldId}-outs-error`} role="alert" className="mt-2 text-sm text-brand-500">
                {outsErrorLabel(odds.error, street)}
              </p>
            ) : null}
          </div>

          <div>
            <p className="text-sm font-semibold text-text-100">자주 나오는 드로우</p>
            <p className="mt-1 text-xs text-text-300">
              눌러보면 아웃 개수가 채워지고, 왜 그 숫자인지도 함께 나옵니다.
            </p>
            <div role="group" aria-label="자주 나오는 드로우" className="mt-2 flex flex-col gap-2">
              {DRAW_PRESETS.map((preset) => {
                const selected = outsValue === preset.outs;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setOutsText(String(preset.outs))}
                    className={`${choiceClass(selected)} h-auto min-h-11 flex-col items-start gap-1 py-2 text-left`}
                  >
                    <span className="flex w-full items-baseline justify-between gap-3">
                      <span>{preset.label}</span>
                      <span className="tabular shrink-0">{preset.outs}장</span>
                    </span>
                    {/* On the selected card the fill is `brand-600`, where `text-300` drops to
                        ~1.8:1 and the derivation becomes unreadable — the very sentence the
                        preset exists to teach. This is the one place in the app where an
                        ink-on-fill token is needed on a DESCENDANT of the fill rather than on
                        the filled element itself, so it is easy to miss: `text-100` is the page
                        ink and inverts with the theme, which would put near-black on dark red in
                        the light theme. `ink-on-brand` on `brand-600` is 5.09:1 dark / 8.00:1
                        light. */}
                    <span
                      className={`text-xs font-normal ${selected ? 'text-ink-on-brand' : 'text-text-300'}`}
                    >
                      {preset.derivation}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
