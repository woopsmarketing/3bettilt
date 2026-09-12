'use client';

/**
 * `PotOddsCalculator` — the interactive island on `/tools/pot-odds`.
 *
 * ## Show first, explain after
 *
 * It mounts with a worked example already in the fields (10 BB pot, a 5 BB bet) so the
 * first thing a visitor sees is a finished answer — 25% — rather than three empty boxes and
 * a question. The defaults are the same worked example the site's homepage uses, so a
 * reader arriving from there recognises the number they just read.
 *
 * ## The domain owns every rule
 *
 * This component parses text into `MilliBB` and hands three amounts to `potOdds`. It never
 * decides that a pot cannot be negative, that a zero call is not a call, or that a call
 * cannot exceed a bet — `learn-core` decides all three and returns a typed error, and this
 * file renders the Korean sentence for it. There is exactly one rulebook.
 *
 * ## Nothing typed is silently rewritten
 *
 * There is no clamping anywhere. `48` outs' worth of over-large call is shown as an error,
 * not quietly reduced to a legal one, and a value with four decimals is refused rather than
 * rounded behind the reader's back. The ONE place a number is written into a field is the
 * pot-fraction shortcut, and it writes the exact amount it computed (`Money.mulRatio`, an
 * explicit rounding to the nearest milliBB) into the visible input — so what the reader
 * sees in the box is what the calculator used, with nothing hidden behind it.
 *
 * ## Deep links seed the fields, and only after mount
 *
 * `?pot=9&bet=6` overrides the worked example above, because the site publishes such links:
 * `content/blog/pot-odds-quick.mdx` walks a 9BB/6BB hand and its CTA carries exactly those
 * params. The read happens in a mount-only effect rather than in the `useState` initializer,
 * for the same reason `RangeExplorer`'s module doc gives for its own `?hero=&spot=&stack=`
 * pair: `window.location` does not exist during the server render that produces the initial
 * HTML, and reading it on the first client render would diverge from that markup — a React
 * hydration mismatch, not a shortcut. Parsing goes through `parsePotOddsUrlQuery`, which
 * runs the text through the app's one money parse boundary, so a malformed or over-large
 * parameter falls back to the default and never throws.
 *
 * Unlike the Range Explorer there is no write-back: this calculator's fields are free text a
 * reader edits character by character, and rewriting the URL on every keystroke would fill
 * their history with half-typed amounts.
 *
 * ## The uncalled remainder is shown, not hidden
 *
 * Calling all-in for less than the bet returns the unmatched part to the bettor; it never
 * joins the pot being contested. `potOdds` models that in `uncalledReturnMbb`, and the
 * short-stack toggle here exists so a beginner can see the effect rather than be told the
 * naive formula and left to discover the exception at a table.
 *
 * ## Where the answer sits (WP-4)
 *
 * The two columns were input-left / result-right, which is right on a laptop and collapses to
 * input-THEN-result on a phone: three fields, four pot-fraction buttons and a checkbox stood
 * between the control a reader had just touched and the number it changed. That is the same
 * failure `EquityCalculator` and `HandChecker` were rebuilt to fix
 * (`docs/reports/REVIEW_BEGINNER_UX_SEO.md` M8), measured again here at 375px.
 *
 * So 결과 comes FIRST in the DOM — so a screen reader and the tab order read the page a
 * sighted reader sees — and sticks to the top of the viewport below `lg` while the fields
 * scroll underneath it, with the body height-capped and scrollable (and `tabIndex`, so the cap
 * is reachable by keyboard as well as by touch). At `lg` the explicit `col-start`/`row-start`
 * put the fields back on the left and the result on the right, so the desktop layout is
 * unchanged: DOM order carries the phone, grid placement carries the laptop.
 */
import { useEffect, useId, useState } from 'react';
import { Money, type MilliBB } from '@gto-self/shared';
import { potOdds, type PotOdds } from '@gto-self/learn-core';
import {
  AMOUNT_ERROR_LABEL,
  formatAmountBB,
  formatAmountValue,
  formatMultiplier,
  formatPercent,
  minimumOutsFor,
  parseAmountBB,
  parsePotOddsUrlQuery,
  POT_ODDS_ERROR_LABEL,
} from '../features/tools/index.js';
import { ExplanationCard } from './ExplanationCard.js';
import { Panel } from './Panel.js';
import { SectionHeading } from './SectionHeading.js';
import { ToolAnswer } from './ToolAnswer.js';

/** 10 BB in the middle, a 5 BB bet: a 25% call, the smallest example that teaches the shape. */
const DEFAULT_POT_BB = '10';
const DEFAULT_BET_BB = '5';

/** The bet sizes a beginner actually meets, as exact fractions of the pot. */
const POT_FRACTIONS: readonly { readonly label: string; readonly n: number; readonly d: number }[] =
  [
    { label: '1/3 팟', n: 1, d: 3 },
    { label: '1/2 팟', n: 1, d: 2 },
    { label: '2/3 팟', n: 2, d: 3 },
    { label: '팟 사이즈', n: 1, d: 1 },
  ];

const FIELD_CLASS =
  'h-11 w-full min-w-0 rounded-md border border-line-500 bg-panel-600 px-3 text-text-100 ' +
  'tabular outline-none focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-brand-500';

const SMALL_BUTTON_CLASS =
  'inline-flex h-11 min-w-11 items-center justify-center rounded-md border border-line-500 ' +
  'bg-panel-600 px-3 text-sm font-semibold text-text-100 outline-none transition-colors ' +
  'duration-150 hover:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60 ' +
  'disabled:hover:border-line-500';

function AmountField({
  id,
  label,
  hint,
  value,
  onChange,
  error,
}: {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly error: string | null;
}) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-text-100">
        {label}
      </label>
      {hint !== undefined ? <p className="mt-1 text-xs text-text-300">{hint}</p> : null}
      <div className="mt-2 flex items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error !== null}
          aria-describedby={error !== null ? errorId : undefined}
          className={FIELD_CLASS}
        />
        <span className="shrink-0 text-sm text-text-300">BB</span>
      </div>
      {error !== null ? (
        <p id={errorId} role="alert" className="mt-2 text-sm text-brand-500">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function StatRow({
  term,
  children,
}: {
  readonly term: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line-500 py-3 first:border-t-0 first:pt-0">
      <dt className="text-sm text-text-300">{term}</dt>
      <dd className="tabular text-base font-semibold text-text-100">{children}</dd>
    </div>
  );
}

/** The formula, written out with this reader's own numbers substituted into it. */
function WorkedFormula({ odds }: { readonly odds: PotOdds }) {
  return (
    <div className="mt-6 rounded-md border border-line-500 bg-ground-800 p-4">
      <p className="text-sm font-semibold text-text-100">계산 과정</p>
      {/* The MONO face is on the numbers only. `--font-mono` has no Hangul, so a Korean
          label inside it falls back to a monospaced CJK face and every syllable is padded to
          a full em — "콜한  뒤의  팟" with visible double gaps. The digits are what need to
          line up; the label does not. */}
      <dl className="mt-3 space-y-2 text-sm leading-relaxed text-text-300">
        <div>
          <dt className="text-text-300">콜한 뒤의 팟</dt>
          <dd className="tabular font-mono text-text-100">
            {formatAmountValue(odds.potBeforeCallMbb)} + {formatAmountValue(odds.calledBetMbb)} +{' '}
            {formatAmountValue(odds.callAmountMbb)} = {formatAmountBB(odds.finalPotMbb)}
          </dd>
        </div>
        <div>
          <dt className="text-text-300">필요 승률</dt>
          <dd className="tabular font-mono text-text-100">
            {formatAmountValue(odds.callAmountMbb)} ÷ {formatAmountValue(odds.finalPotMbb)} ={' '}
            {formatPercent(odds.requiredEquity)}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-text-300">
        내가 콜한 돈도 팟의 일부가 됩니다. 그래서 나누는 값에 내 콜 금액이 함께 들어갑니다.
      </p>
    </div>
  );
}

/** "그래서 아웃이 몇 개 필요한가요?" — the same price, said in cards. */
function RequiredOutsPanel({ requiredEquity }: { readonly requiredEquity: number }) {
  const nextCard = minimumOutsFor(requiredEquity, 'FLOP', 'NEXT_CARD');
  const byRiver = minimumOutsFor(requiredEquity, 'FLOP', 'BY_RIVER');

  return (
    <ExplanationCard className="mt-6" title="그래서 아웃이 몇 장 필요한가요?">
      <ul className="space-y-2">
        <li>
          턴 한 장만 보고 끝난다면 최소{' '}
          <span className="tabular font-semibold text-text-100">
            {nextCard === null ? '계산할 수 없음' : `${nextCard.outs}장`}
          </span>
          {nextCard === null ? null : (
            <> — 그 경우 실제 확률은 {formatPercent(nextCard.probability)}입니다.</>
          )}
        </li>
        <li>
          리버까지 두 장을 다 본다면 최소{' '}
          <span className="tabular font-semibold text-text-100">
            {byRiver === null ? '계산할 수 없음' : `${byRiver.outs}장`}
          </span>
          {byRiver === null ? null : (
            <> — 그 경우 실제 확률은 {formatPercent(byRiver.probability)}입니다.</>
          )}
        </li>
      </ul>
      <p className="mt-3">
        두 번째 줄은{' '}
        <strong className="font-semibold text-text-100">뒤에 추가 베팅이 없다고 가정</strong>한 단순
        비교입니다. 실제로는 턴에서 또 베팅을 만날 수 있어서, 플랍에서 두 장을 다 보는 확률을 그대로
        쓰면 실제보다 후하게 계산됩니다.
      </p>
    </ExplanationCard>
  );
}

export function PotOddsCalculator() {
  const fieldId = useId();
  const [potText, setPotText] = useState(DEFAULT_POT_BB);
  const [betText, setBetText] = useState(DEFAULT_BET_BB);
  const [shortStack, setShortStack] = useState(false);
  const [callText, setCallText] = useState(DEFAULT_BET_BB);

  // Read `?pot=&bet=` exactly once, after mount — see the module doc for why this cannot
  // happen in the `useState` initializers above. `callText` follows the bet, preserving the
  // invariant those initializers already establish (an ordinary call matches the bet); the
  // short-stack amount is not part of the URL contract.
  useEffect(() => {
    const parsed = parsePotOddsUrlQuery(window.location.search);
    if (parsed.potBB !== undefined) setPotText(parsed.potBB);
    if (parsed.betBB !== undefined) {
      setBetText(parsed.betBB);
      setCallText(parsed.betBB);
    }
    // Mount-only: this effect's whole job is the one-time read of the URL the page loaded
    // with, never a reaction to this component's own later state. The `useState` setters it
    // calls are React-guaranteed stable, so an empty dependency array is correct here.
  }, []);

  const potParsed = parseAmountBB(potText);
  const betParsed = parseAmountBB(betText);
  const callParsed = shortStack ? parseAmountBB(callText) : betParsed;

  const potError = potParsed.ok ? null : AMOUNT_ERROR_LABEL[potParsed.error];
  const betError = betParsed.ok ? null : AMOUNT_ERROR_LABEL[betParsed.error];
  const callError = callParsed.ok ? null : AMOUNT_ERROR_LABEL[callParsed.error];

  const odds =
    potParsed.ok && betParsed.ok && callParsed.ok
      ? potOdds({
          potBeforeCallMbb: potParsed.value,
          villainBetMbb: betParsed.value,
          callAmountMbb: callParsed.value,
        })
      : null;

  function applyPotFraction(numerator: number, denominator: number) {
    if (!potParsed.ok) return;
    const bet: MilliBB = Money.mulRatio(potParsed.value, numerator, denominator, 'round');
    setBetText(formatAmountValue(bet));
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
      <Panel as="section" className="sticky top-0 z-10 lg:static lg:col-start-2 lg:row-start-1">
        <SectionHeading as="h2" title="계산 결과" className="mb-5" />
        <div
          aria-live="polite"
          tabIndex={0}
          className="max-h-[36svh] overflow-y-auto lg:max-h-none lg:overflow-visible"
        >
          {odds === null ? (
            <ExplanationCard title="아직 계산할 수 없습니다">
              <p>위 칸을 모두 숫자로 채우면 바로 결과가 나옵니다.</p>
            </ExplanationCard>
          ) : !odds.ok ? (
            <ExplanationCard title="이 상황은 계산할 수 없습니다">
              <p>{POT_ODDS_ERROR_LABEL[odds.error]}</p>
            </ExplanationCard>
          ) : (
            <>
              {/* The headline sits in `ground-800`, the recessed rung — see `ToolAnswer`.
                  The note says what the number IS; it never says whether to call. */}
              <ToolAnswer
                lead="이 콜이 본전이 되려면"
                value={formatPercent(odds.value.requiredEquity)}
                note="이 정도는 이겨야 손해도 이득도 아닙니다."
              />

              <dl className="mt-6">
                <StatRow term="콜한 뒤의 팟">{formatAmountBB(odds.value.finalPotMbb)}</StatRow>
                <StatRow term="몇 번에 한 번 이기면 되나요">
                  {formatMultiplier(odds.value.oneInN)}번 중 1번
                </StatRow>
                <StatRow term="팟 오즈 (오즈 표기)">
                  {formatMultiplier(odds.value.oddsAgainst)} : 1
                </StatRow>
                {odds.value.uncalledReturnMbb > 0 ? (
                  <StatRow term="상대에게 돌아가는 금액">
                    {formatAmountBB(odds.value.uncalledReturnMbb)}
                  </StatRow>
                ) : null}
              </dl>

              {odds.value.uncalledReturnMbb > 0 ? (
                <p className="mt-4 text-sm leading-relaxed text-text-300">
                  내가 맞춘 금액은 {formatAmountBB(odds.value.calledBetMbb)}뿐입니다. 상대 베팅 중
                  나머지 {formatAmountBB(odds.value.uncalledReturnMbb)}는 아무도 받지 않았으므로
                  팟에 들어가지 않고 상대에게 돌아갑니다.
                </p>
              ) : null}

              <WorkedFormula odds={odds.value} />
              <RequiredOutsPanel requiredEquity={odds.value.requiredEquity} />
            </>
          )}
        </div>
      </Panel>

      <Panel as="section" className="lg:col-start-1 lg:row-start-1">
        <SectionHeading as="h2" title="숫자를 넣어보세요" />

        <div className="mt-5 space-y-5">
          <AmountField
            id={`${fieldId}-pot`}
            label="지금 팟에 있는 돈"
            hint="상대의 이번 베팅은 빼고, 그 전까지 쌓인 금액입니다."
            value={potText}
            onChange={setPotText}
            error={potError}
          />

          <div>
            <AmountField
              id={`${fieldId}-bet`}
              label="상대가 베팅한 금액"
              value={betText}
              onChange={setBetText}
              error={betError}
            />
            <div role="group" aria-label="팟 대비 베팅 크기" className="mt-3 flex flex-wrap gap-2">
              {POT_FRACTIONS.map((fraction) => (
                <button
                  key={fraction.label}
                  type="button"
                  disabled={!potParsed.ok}
                  onClick={() => applyPotFraction(fraction.n, fraction.d)}
                  className={SMALL_BUTTON_CLASS}
                >
                  {fraction.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-line-500 pt-5">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-text-100">
              <input
                type="checkbox"
                checked={shortStack}
                onChange={(event) => setShortStack(event.target.checked)}
                className="h-5 w-5 shrink-0 accent-brand-600 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              />
              <span>내 스택이 모자라서 더 적게 콜해요 (올인)</span>
            </label>

            {shortStack ? (
              <div className="mt-4">
                <AmountField
                  id={`${fieldId}-call`}
                  label="내가 실제로 낼 수 있는 금액"
                  hint="상대 베팅 중 내가 맞추지 못한 부분은 상대에게 그대로 돌아갑니다."
                  value={callText}
                  onChange={setCallText}
                  error={callError}
                />
              </div>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-text-300">
                지금은 상대 베팅과 같은 금액을 콜하는 보통 상황으로 계산합니다.
              </p>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
