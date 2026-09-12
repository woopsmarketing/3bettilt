/**
 * The worked examples under `/tools/pot-odds` (WP-S3-14). Every figure is the output of
 * `@gto-self/learn-core`'s `potOdds` — the function the calculator above runs — over BB
 * amounts that go through `Money.parseBB` first (CLAUDE.md rule 1: no BB arithmetic here,
 * only milliBB inside `Money`/`potOdds`). Nothing is typed as a result.
 *
 * The example amounts differ from the calculator's own default (10 BB pot, 5 BB bet) on
 * purpose: a reader who has just read 25.0% in the readout should meet the formula on
 * different numbers, so they can see the shape rather than match the digits.
 *
 * The comparison with an out count states two probabilities side by side and which is the
 * larger. It does not say whether to call — that is the site's line (`ToolAnswer`'s doc).
 */
import { outsOdds, potOdds, type DrawStreet, type PotOdds } from '@gto-self/learn-core';
import { Money, type MilliBB } from '@gto-self/shared';

export interface PotOddsExampleSpec {
  readonly id: string;
  readonly title: string;
  /** BB amounts as the reader would type them. */
  readonly potBB: string;
  readonly betBB: string;
}

export interface PotOddsExample extends PotOddsExampleSpec {
  readonly odds: PotOdds;
}

function bb(text: string): MilliBB {
  const parsed = Money.parseBB(text);
  if (!parsed.ok) throw new Error(`pot odds guide: "${text}" is not a BB amount (${parsed.error})`);
  return parsed.value;
}

function compute(spec: PotOddsExampleSpec): PotOddsExample {
  const potBeforeCallMbb = bb(spec.potBB);
  const villainBetMbb = bb(spec.betBB);
  // The ordinary case: hero calls the full bet — the shape the published formula describes.
  const outcome = potOdds({ potBeforeCallMbb, villainBetMbb, callAmountMbb: villainBetMbb });
  if (!outcome.ok) {
    throw new Error(
      `pot odds guide: pot ${spec.potBB} / bet ${spec.betBB} is not a legal call (${outcome.error})`,
    );
  }
  return { ...spec, odds: outcome.value };
}

export const POT_ODDS_EXAMPLE_SPECS: readonly PotOddsExampleSpec[] = [
  { id: 'third', title: '팟의 1/3 크기 베팅을 받았을 때', potBB: '30', betBB: '10' },
  { id: 'half', title: '팟의 1/2 크기 베팅을 받았을 때', potBB: '20', betBB: '10' },
  { id: 'full', title: '팟 크기 베팅을 받았을 때', potBB: '10', betBB: '10' },
];

export function potOddsExamples(): readonly PotOddsExample[] {
  return POT_ODDS_EXAMPLE_SPECS.map(compute);
}

/** The example the prose walks through line by line: the first one. */
export function potOddsWalkthrough(): PotOddsExample {
  const [first] = potOddsExamples();
  if (first === undefined) throw new Error('pot odds guide has no examples');
  return first;
}

export interface PotOddsVsOuts {
  readonly outs: number;
  readonly street: DrawStreet;
  readonly requiredEquity: number;
  readonly nextCardProb: number;
  readonly byRiverProb: number;
  /** Which of the two probabilities clears the price — a comparison of numbers, not advice. */
  readonly nextCardClears: boolean;
  readonly byRiverClears: boolean;
}

/**
 * The walkthrough's price set against a flush draw's exact probabilities, so the guide can
 * show the two numbers pot odds is always compared with — and that the answer changes with
 * how many cards you get to see.
 */
export function potOddsVsOuts(outs = 9, street: DrawStreet = 'FLOP'): PotOddsVsOuts {
  const { odds } = potOddsWalkthrough();
  const draw = outsOdds({ outs, street });
  if (!draw.ok)
    throw new Error(`pot odds guide: ${outs} outs on ${street} is not a draw (${draw.error})`);
  return {
    outs,
    street,
    requiredEquity: odds.requiredEquity,
    nextCardProb: draw.value.nextCardProb,
    byRiverProb: draw.value.byRiverProb,
    nextCardClears: draw.value.nextCardProb >= odds.requiredEquity,
    byRiverClears: draw.value.byRiverProb >= odds.requiredEquity,
  };
}
