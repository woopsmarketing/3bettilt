/**
 * The six tool pages' question-and-answer data — ONE system, not two.
 *
 * ## Why this file exists
 *
 * Every tool page used to render its questions by hand: a `SectionHeading` holding a question
 * and an `ExplanationCard` holding the answer, repeated two to five times per page, twenty-two
 * times across the six tools. Meanwhile WP-3 shipped `FaqSection`, which renders exactly that
 * shape from a typed array so WP-7 can emit `FAQPage` structured data from the SAME array it
 * rendered (FISHTILT_STATE ruling 107 — schema may only describe what the page shows).
 *
 * Two mechanisms doing Q&A is how the two halves drift apart, so there is now one rule:
 *
 *   **A page-level heading shaped like a question is FAQ data and lives here.**
 *   `ExplanationCard` keeps everything that is not a question — the asides INSIDE a
 *   calculator ("어떻게 계산했나요?", "그래서 아웃이 몇 장 필요한가요?"), empty states, and
 *   error explanations. Those are annotations on a live result, not questions a visitor
 *   arrives with, and they change with the reader's own input, which is precisely what may
 *   never enter structured data.
 *
 * So the prose below is not new copy: it is the reviewed copy that was already on those pages,
 * moved into typed strings, plus one genuinely new question per calculator (marked NEW) that
 * WP-1 §5 asked for. Nothing here answers a question the page does not visibly ask.
 *
 * ## Why `answer` is a plain string with no markup
 *
 * `FaqEntry extends FaqItem` (`src/lib/seo/faq.ts`), whose `answer` is the string a `FAQPage`
 * block will publish. A rendered answer containing markup could not be published verbatim, so
 * a follow-on link is carried in `link`, beside the answer and never inside it. Where a card
 * previously held two paragraphs, either the two became two separate questions (which is what
 * they were) or one answer — never a string with a line break pretending to be two.
 *
 * ## The `/about` link
 *
 * Six tools had no route to `/about`, the only page that says where the numbers come from and
 * that this site is affiliated with nobody (WP-1 §6 priority 9). It is attached HERE, on the
 * one question per tool that is actually asking that — provenance on the two range/strength
 * tables, "정확 계산이 무슨 뜻인가요" on the equity calculator, the limits of the number on the
 * pot-odds and outs calculators, and "무엇이 판정하나요" on the hand checker. Six different
 * questions, not one sentence stamped six times, and each one resolves through the route
 * registry so a hypothetical unbuilt `/about` would drop the link rather than 404.
 */
import { COMBO_COUNT, HAND_CLASS_COUNT } from '@gto-self/strategy-core';
import { HAND_STRENGTH } from '@gto-self/learn-core';
import type { FaqEntry } from '../../components/FaqSection.js';
import { routeById } from '../../lib/routes.js';
import {
  describeRangeConditions,
  josaIran,
  RANGE_LABEL,
  RANGE_PROVENANCE_SENTENCE,
  UNSUPPORTED_REASON_LABEL,
} from '../range/index.js';
import { formatMultiplier, formatPercent, formatSignedPercentagePoints } from './format.js';
import { GUIDE_SPOT, GUIDE_STACK_DEPTH, GUIDE_TABLE_SIZE } from './guide/rangeGuide.js';
import { potOddsWalkthrough } from './guide/potOddsGuide.js';
import { overlappingDrawPreset } from './guide/outsGuide.js';
import { suitedVersusOffsuit } from './guide/startingHandGuide.js';
import { guidePercent } from './guide/format.js';
import {
  METHODOLOGY_SENTENCE,
  PLAYABILITY_CAVEAT_SENTENCE,
  provenanceSentence,
  RANGE_DISTINCTION_SENTENCE,
  STRATEGY_DISTINCTION_SENTENCE,
  tiesOverviewSentence,
  topShareCutSentence,
} from '../strength/index.js';
import {
  categoryLabelList,
  CATEGORIES_WITH_KICKER,
  CATEGORIES_WITHOUT_KICKER,
} from './handRank.js';

/**
 * The follow-on link to `/about`, resolved through the route registry rather than written as
 * a path — the same rule `ToolCTA` and `LinkCard` follow. `available: false` would yield
 * `null`, and `FaqSection` renders no link at all for `null` rather than a promise to a page
 * that is not there.
 */
function aboutLink(label: string): NonNullable<FaqEntry['link']> {
  const route = routeById('about');
  return { href: route.available ? route.path : null, label };
}

/** A follow-on link to another tool, resolved the same way — `null` while it is unbuilt. */
function toolLink(routeId: string, label: string): NonNullable<FaqEntry['link']> {
  const route = routeById(routeId);
  return { href: route.available ? route.path : null, label };
}

/** The shipped range's condition line, in the facade's vocabulary (WP-S3-14). */
const SHIPPED_CONDITIONS = describeRangeConditions({
  heroPosition: 'BTN',
  spot: GUIDE_SPOT,
  stackDepth: GUIDE_STACK_DEPTH,
  tableSize: GUIDE_TABLE_SIZE,
});

/** The section heading every tool's FAQ uses, so a reader learns the block once. */
export const TOOL_FAQ_TITLE = '자주 묻는 질문';

/* ------------------------------------------------------------------------------------- */
/* /tools/equity                                                                           */
/* ------------------------------------------------------------------------------------- */

export const EQUITY_FAQ: readonly FaqEntry[] = [
  {
    // WP-S3-19 (review A, top MAJOR): the answer states the definition the lessons use
    // (`learn/equity.mdx`) — the expected share of the pot with ties counted as half a win —
    // never "the probability of taking the pot", which is the calculator's "내가 이김" row.
    question: '승률(Equity)이 뭔가요?',
    answer:
      '지금 이 패가 이대로 끝까지 갔을 때 내가 팟에서 가져갈 것으로 기대되는 몫입니다. 이기는 경우는 팟 전체, 정확히 비기는 경우는 절반만 이긴 것으로 세어 더한 값이라, 이길 확률 그 자체와는 다른 숫자입니다. 이 계산기의 "내가 이김"은 그중 이길 확률만, "비김"은 비길 확률만 따로 보여줍니다.',
  },
  {
    question: '비김(무승부)은 어떻게 되나요?',
    answer:
      '두 핸드가 정확히 같은 다섯 장으로 겨루게 되면 팟을 반씩 나눠 갖습니다. 그래서 결과는 내가 이기는 확률, 비기는 확률, 상대가 이기는 확률 세 가지로 나뉘고, 이 세 숫자를 더하면 항상 100%입니다. 비기는 확률의 절반을 내가 이기는 확률에 더한 값이 내 승률(Equity)입니다.',
  },
  {
    question: '보드는 왜 0장, 3장, 4장, 5장만 되나요?',
    answer:
      '실제 홀덤 보드는 프리플랍(0장), 플랍(3장), 턴(4장), 리버(5장) 중 하나로만 존재합니다. 1장이나 2장짜리 보드는 실제로 있을 수 없는 상태라서, 계산기는 그 상태를 숫자로 얼버무리는 대신 아직 계산할 수 없다고 분명히 알려드립니다.',
  },
  {
    question: '정확 계산이 무슨 뜻인가요?',
    answer:
      '이 계산기는 남은 카드가 나올 수 있는 모든 경우의 수를 하나도 빠짐없이 세어 계산합니다. 일부만 뽑아 추정하는 것이 아니라서, 결과는 표본이 아니라 정확한 값입니다.',
    link: aboutLink('이 사이트가 숫자를 만드는 방식'),
  },
  {
    // WP-S3-14. The next question after reading a number over 50% — and the one place this
    // page has to say that a probability is not a price. No figure, no verdict.
    question: '승률이 50%를 넘으면 콜해도 되나요?',
    answer:
      '승률과 콜의 가격은 다른 숫자입니다. 콜이 본전이 되는 데 필요한 승률은 팟과 베팅 크기로 정해지고, 그 값은 팟 오즈 계산기가 계산합니다. 이 계산기는 승률만 계산하고, 콜이나 폴드를 권하지 않습니다.',
    link: toolLink('toolPotOdds', '팟 오즈 계산기에서 필요 승률 보기'),
  },
  {
    question: '세 명 이상이 맞붙을 때도 계산되나요?',
    answer:
      '지원하지 않습니다. 이 계산기는 내 핸드와 상대 핸드 하나, 즉 두 명이 맞붙는 경우만 정확하게 셉니다. 세 명 이상의 승률은 계산하지 않고, 어림값으로 대신하지도 않습니다.',
  },
  {
    question: '상대 패를 정확히 모를 때는 어떻게 하나요?',
    answer:
      '이 계산기는 상대의 카드 두 장을 정한 경우만 계산합니다. 상대가 가질 수 있는 여러 패를 한꺼번에 상대하는 승률(레인지 대 핸드)은 지원하지 않습니다. 상대가 무작위로 아무 두 장을 들었다고 가정했을 때의 기본 강도는 시작 핸드 탐색기에서 볼 수 있습니다.',
    link: toolLink('toolStartingHand', '시작 핸드 탐색기 열기'),
  },
];

/* ------------------------------------------------------------------------------------- */
/* /tools/pot-odds                                                                         */
/* ------------------------------------------------------------------------------------- */

export const POT_ODDS_FAQ: readonly FaqEntry[] = [
  {
    question: '팟 오즈가 뭔가요?',
    answer:
      '팟 오즈는 "지금 이 콜의 가격"입니다. 내가 내는 돈에 비해 가져갈 수 있는 돈이 얼마나 큰지를 나타내죠. 가져갈 돈이 클수록 이겨야 하는 횟수는 줄어듭니다. 그래서 팟 오즈는 좋은 패인지 나쁜 패인지를 말해주는 것이 아니라, 이 콜이 본전이 되려면 얼마나 자주 이겨야 하는지를 말해줍니다.',
  },
  {
    question: '왜 내가 낸 콜도 팟에 더하나요?',
    answer:
      '콜을 하는 순간 내 돈도 팟으로 들어가고, 이기면 그 돈까지 함께 가져오기 때문입니다. 그래서 나누는 값은 "콜하기 전 팟"이 아니라 "콜한 뒤의 팟"입니다. 이 계산기는 그 과정을 한 줄씩 보여줍니다.',
  },
  {
    question: '올인으로 더 적게 콜하면?',
    answer:
      '내 스택이 상대 베팅보다 적으면, 낼 수 있는 만큼만 냅니다. 상대 베팅 중 아무도 받지 않은 부분은 팟에 들어가지 않고 상대에게 그대로 돌아갑니다. 위 계산기에서 "내 스택이 모자라서 더 적게 콜해요"를 켜면 돌아가는 금액까지 함께 보여줍니다.',
  },
  {
    question: '이 숫자만 보고 콜하면 되나요?',
    answer:
      '아닙니다. 팟 오즈는 "얼마나 자주 이겨야 하는가"만 알려줍니다. 실제로 그만큼 이길 수 있는지는 내 패와 상대의 패에 달려 있습니다. 그래서 팟 오즈는 판단의 끝이 아니라 시작점입니다.',
    link: aboutLink('이 사이트가 하는 것과 하지 않는 것'),
  },
  {
    // WP-S3-14. The three notations are one price; the conversion is shown on the guide's own
    // walkthrough numbers, read from `potOdds` — `faq.test.ts` re-derives the identity.
    question: '퍼센트와 "4 : 1" 같은 비율은 어떻게 바꾸나요?',
    answer: (() => {
      const { odds } = potOddsWalkthrough();
      const ratio = formatMultiplier(odds.oddsAgainst);
      return `둘은 같은 가격을 다르게 쓴 것입니다. "${ratio} : 1"은 가져갈 돈이 내가 내는 돈의 ${ratio}배라는 뜻이고, 이를 승률로 바꾸면 1 ÷ (${ratio} + 1) = ${formatPercent(odds.requiredEquity)}입니다. 계산기는 세 가지 표기를 항상 함께 보여주므로 직접 환산하지 않아도 됩니다.`;
    })(),
  },
  {
    question: '나중에 더 딸 수 있는 돈(임플라이드 오즈)은 계산되나요?',
    answer:
      '지원하지 않습니다. 이 계산기는 지금 이 콜 한 번만 계산합니다. 다음 스트리트에서 더 이길 수 있는 돈이나 더 내야 할 돈은 계산에 들어 있지 않으므로, 여기 나온 필요 승률은 콜 한 번의 가격입니다.',
  },
];

/* ------------------------------------------------------------------------------------- */
/* /tools/outs                                                                             */
/* ------------------------------------------------------------------------------------- */

export const OUTS_FAQ: readonly FaqEntry[] = [
  {
    question: '아웃이 뭔가요?',
    answer:
      '아웃은 아직 나오지 않은 카드 중에서, 나오면 내 패를 이기는 패로 만들어주는 카드입니다. 같은 무늬 네 장을 들고 있다면 그 무늬 카드가 아웃이고, 스트레이트가 한 장 모자라다면 그 숫자의 카드가 아웃입니다. 아웃을 세는 일이 확률 계산의 전부입니다 — 나머지는 나눗셈일 뿐입니다.',
  },
  {
    question: '왜 상대 카드를 빼지 않나요?',
    answer:
      '내 자리에서는 상대의 카드가 무엇인지 볼 수 없기 때문입니다. 볼 수 없는 카드는 아직 나올 수 있는 카드와 똑같이 취급합니다. 그래서 "남은 카드"는 사람 수와 상관없이, 내가 본 카드를 뺀 나머지 전부입니다. 이건 이 사이트의 선택이 아니라 홀덤에서 일반적으로 쓰이는 세는 방식입니다.',
  },
  {
    /*
     * THE DIRECTION, checked against `outsOdds`' own signed error rather than described from
     * memory. This answer used to say the shortcut over-states as the out count grows; run
     * `ruleOfTwoAndFour` and the opposite is true of x2 (it under-states at every count, on
     * both streets, by a widening margin), while x4 goes both ways. The calculator directly
     * above renders the direction from that same signed error (`outsView.ts`'s `directionOf`),
     * so a one-directional sentence made the page contradict itself.
     * `outs/page.test.tsx` re-derives this from the engine and fails the old wording.
     */
    question: '×2 / ×4 규칙은 써도 되나요?',
    answer:
      '테이블에서 빠르게 어림잡을 때는 좋습니다. 다만 어긋나는 방향이 한쪽으로만 정해져 있지 않아서, 아웃 개수에 따라 규칙이 실제보다 높게 나오기도 하고 낮게 나오기도 합니다. 그래서 위 계산기가 두 숫자와 그 차이를 부호까지 붙여 항상 함께 보여줍니다. 규칙을 버리라는 뜻이 아니라, 규칙이 어디서 어긋나는지 알고 쓰자는 뜻입니다.',
  },
  {
    question: '두 장을 다 볼 수 있다고 가정해도 되나요?',
    answer:
      '플랍에서 "리버까지" 확률은 턴과 리버를 모두 본다는 뜻입니다. 하지만 실제로는 턴에서 또 베팅을 만날 수 있고, 그때 폴드하면 리버는 보지 못합니다. 그래서 한 번의 콜을 계산할 때는 "다음 카드 한 장" 확률이 더 안전한 기준입니다.',
  },
  {
    // NEW (WP-4). The calculator answers "완성될 확률"; a beginner's next question is what it
    // did NOT do for them, and every clause below is a property of this page's own code: the
    // out count is typed by the reader, unseen cards are counted from what the reader has
    // seen, and nothing on this site recommends an action.
    question: '이 계산기가 대신 해주지 않는 것은 무엇인가요?',
    answer:
      '아웃을 세는 일은 직접 해야 합니다. 계산기는 아웃이 몇 장인지 알려주는 것이 아니라, 아웃 개수를 넣으면 그것이 완성될 확률을 계산해줍니다. 상대의 패도 알 수 없으므로 내 드로우가 완성됐을 때 정말 이기는지는 이 확률에 들어 있지 않고, 이 사이트는 콜이나 폴드를 권하지 않습니다.',
    link: aboutLink('이 사이트가 하는 것과 하지 않는 것'),
  },
  {
    // WP-S3-14. The derivation is the preset's own sentence (`draws.ts`), so the count and
    // the subtraction it explains cannot drift apart.
    question: '두 드로우가 겹치면 아웃은 어떻게 세나요?',
    answer: (() => {
      const preset = overlappingDrawPreset();
      return `두 번 센 카드는 한 번만 셉니다. 예를 들어 "${preset.label}"는 ${preset.derivation} 위 계산기의 드로우 버튼을 누르면 이 계산이 함께 나옵니다.`;
    })(),
  },
];

/* ------------------------------------------------------------------------------------- */
/* /tools/hand-checker                                                                     */
/* ------------------------------------------------------------------------------------- */

export const HAND_CHECKER_FAQ: readonly FaqEntry[] = [
  {
    question: '족보가 뭔가요?',
    answer:
      '포커의 모든 손패는 아홉 가지 족보 중 하나로 정해집니다. 하이카드부터 스트레이트 플러시까지 강한 순서가 정해져 있고, 이 순서는 어떤 테이블에서도 바뀌지 않습니다.',
  },
  {
    question: '왜 항상 다섯 장만 세나요?',
    answer:
      '홀덤에서는 손에 든 두 장과 보드의 다섯 장을 합쳐 최대 일곱 장을 볼 수 있지만, 실제로 겨루는 패는 그중 가장 강한 다섯 장뿐입니다. 나머지 카드는 몇 장이 남든 승부에 영향을 주지 않습니다.',
  },
  {
    /*
     * SCOPED. This answer used to end "그마저 같다면 남은 카드 중 가장 높은 카드, 즉 키커가
     * 순위를 가립니다" with no qualification, which is false for the four categories in
     * `CATEGORIES_WITHOUT_KICKER`: `compareHands` returns 0 for two straights of the same top
     * rank, two full houses of the same two ranks and two straight flushes of the same top
     * rank — nothing is left over to break the tie and the hands split. Both lists are
     * rendered from `handRank.ts` so they cannot drift from the evaluator.
     */
    question: '숫자가 같으면 누가 이기나요?',
    answer: `같은 족보끼리는 만든 숫자가 높은 쪽이 이깁니다. ${categoryLabelList(
      CATEGORIES_WITH_KICKER,
    )}처럼 족보를 만들고도 카드가 남는 족보라면, 그 남은 카드 중 가장 높은 카드, 즉 키커 (Kicker)가 순위를 가립니다. 다섯 장 전부가 이미 그 족보를 이루는 데 쓰이는 경우도 있습니다 — ${categoryLabelList(
      CATEGORIES_WITHOUT_KICKER,
    )}. 이 족보들에는 키커가 없어서, 만든 숫자까지 같으면 어느 쪽도 이기지 못하고 팟을 나눠 가집니다.`,
  },
  {
    question: '에이스는 항상 가장 높은 카드인가요?',
    answer:
      '스트레이트에서는 아닙니다. A-2-3-4-5로 이어지면 에이스가 가장 낮은 숫자로 쓰이는, 가장 낮은 스트레이트가 됩니다. 반대로 10-J-Q-K-A는 가장 높은 스트레이트인 동시에, 같은 무늬라면 로열 플러시가 됩니다.',
  },
  {
    // NEW (WP-4). "무엇이 이 판정을 내렸는가" is the question a beginner asks the moment the
    // tool disagrees with them, and it is the one this site can answer without hedging: the
    // evaluator compares every five-card combination inside the selected cards and the page
    // shows which five it kept.
    question: '이 족보 판정은 무엇이 하나요?',
    answer:
      '고른 카드 안에서 만들 수 있는 다섯 장 조합을 전부 비교해 가장 강한 하나를 고르는 코드가 판정합니다. 표에서 답을 찾아오는 것이 아니라 그 자리에서 세기 때문에, 어떤 다섯 장이 쓰였고 어떤 카드가 남았는지까지 화면에 그대로 보여줄 수 있습니다.',
    link: aboutLink('숫자는 어디서 나오나요'),
  },
  {
    // WP-S3-14. A rule, and one the evaluator embodies: `handCheckerGuide.ts`'s
    // "무늬만 다른 같은 투페어" example compares to exactly 0 (`handCheckerGuide.test.ts`).
    question: '무늬에도 순위가 있나요?',
    answer:
      '없습니다. 홀덤에서 스페이드·하트·다이아몬드·클럽 사이에는 우열이 없습니다. 숫자 구성이 같고 무늬만 다른 두 패는 정확히 같은 족보이고, 이 판정기도 그런 두 패를 어느 쪽도 이기지 않는 것으로 계산합니다. 아래 안내에 실제 예시가 있습니다.',
  },
  {
    question: '두 사람의 패를 동시에 비교할 수 있나요?',
    answer:
      '이 도구는 한 사람의 패만 판정합니다. 두 패를 비교하려면 각각 판정한 뒤 족보 순서와 만든 숫자, 키커 순으로 비교하면 되고, 아래 안내에 그렇게 비교한 예시가 있습니다. 카드가 다 열리기 전의 두 패는 승률 계산기가 비교합니다.',
    link: toolLink('toolEquity', '승률 계산기 열기'),
  },
];

/* ------------------------------------------------------------------------------------- */
/* /tools/range                                                                            */
/* ------------------------------------------------------------------------------------- */

export const RANGE_FAQ: readonly FaqEntry[] = [
  {
    question: '표는 어떻게 읽나요?',
    answer: `두 장을 받는 방법은 ${COMBO_COUNT.toLocaleString(
      'ko-KR',
    )}가지지만, 무늬를 빼고 같은 종류끼리 묶으면 ${HAND_CLASS_COUNT}칸으로 줄어듭니다. 대각선은 같은 숫자 두 장(페어), 대각선 위쪽은 같은 무늬(수티드), 대각선 아래쪽은 다른 무늬(오프수트) 입니다. 칸 하나를 누르면 그 핸드의 자세한 정보를 볼 수 있어요.`,
  },
  {
    // NEW (WP-4). The first thing a visitor does is look at the colours; the tool already
    // spells the membership out in words under the table (`IN_RANGE_LABEL` /
    // `OUT_OF_RANGE_LABEL`), and this says so rather than leaving colour to carry it alone.
    question: '색이 칠해진 칸은 무슨 뜻인가요?',
    answer: `칠해진 칸은 지금 고른 조건에서 ${RANGE_LABEL}에 들어 있는 시작 패이고, 칠해지지 않은 칸은 들어 있지 않은 패입니다. 칸을 누르면 그 패가 지금 보고 있는 레인지에 포함되는지 아닌지가 표 옆에 글로도 함께 나오기 때문에, 색만으로 판단하지 않아도 됩니다.`,
  },
  {
    // NEW (WP-4). The one empty state this tool has on purpose. A reader who selects BB and
    // sees no fill needs to know it is not a missing feature; the sentence is the same one the
    // tool itself renders, read from `UNSUPPORTED_REASON_LABEL` rather than restated.
    question: 'BB를 고르면 왜 표에 아무것도 없나요?',
    answer: UNSUPPORTED_REASON_LABEL.BB_HAS_NO_RFI_RANGE,
  },
  {
    /* `이란` was hard-coded and rendered `학습용 기본 레인지이란`. 레인지 ends in a bare vowel,
       so the particle is 란 — and it is computed from the label, so a reworded `RANGE_LABEL`
       cannot silently reintroduce the error. Provenance comes from the one shared constant;
       `여러 무료 포커 교육 자료를 참고해 정리한` overstated the sourcing. */
    question: `${RANGE_LABEL}${josaIran(RANGE_LABEL)} 무엇인가요?`,
    answer: RANGE_PROVENANCE_SENTENCE,
    link: aboutLink('이 표의 출처와 이 사이트의 원칙'),
  },
  {
    // WP-S3-14. The question a reader asks once they have found their hand in the table. The
    // answer restates the provenance policy in the reader's terms and the site's line — it
    // explains what the table says, it does not tell anyone what to do.
    question: '이 표대로만 플레이하면 되나요?',
    answer: `아닙니다. ${RANGE_LABEL}는 ${SHIPPED_CONDITIONS} 상황을 익히기 위한 기준선입니다. 모든 상황의 정답이 아니며, 게임 조건과 상대에 따라 실제 선택은 달라질 수 있습니다. 이 사이트는 콜·폴드·레이즈를 권하지 않고, 표를 읽는 법과 표가 무엇을 말하는지만 설명합니다.`,
  },
  {
    question: '앞 사람이 레이즈했을 때나 3벳을 받았을 때의 레인지는 없나요?',
    answer: `${UNSUPPORTED_REASON_LABEL.SPOT_NOT_SHIPPED} 그래서 그 상황 버튼은 "준비 중"으로 표시되고 눌리지 않습니다. 없는 데이터를 비슷한 표로 대신 채워 넣지 않습니다.`,
  },
  {
    // The notation the summary prints. `faq.test.ts` parses the three examples through
    // `strategy-core`'s own parser and checks the reading against the resulting sets.
    question: '33+, A2s+ 같은 표기는 어떻게 읽나요?',
    answer:
      '표 아래 한 줄로 적힌 표기입니다. 뒤에 붙은 +는 "이 패부터 같은 모양의 더 높은 패까지 전부"라는 뜻이어서, 33+는 33부터 AA까지의 모든 페어, A2s+는 A2s부터 AKs까지 같은 무늬 에이스 전부를 뜻합니다. A5s-A2s처럼 하이픈으로 이으면 그 사이의 패만 뜻합니다. 칸을 눌러 확인하는 것과 같은 내용을 글자로 적은 것일 뿐입니다.',
  },
];

/* ------------------------------------------------------------------------------------- */
/* /tools/starting-hand                                                                    */
/* ------------------------------------------------------------------------------------- */

export const STARTING_HAND_FAQ: readonly FaqEntry[] = [
  {
    question: '이 순위는 어떻게 계산했나요?',
    answer: METHODOLOGY_SENTENCE,
  },
  {
    question: '이 순위는 추정값인가요?',
    answer: provenanceSentence(HAND_STRENGTH),
    link: aboutLink('숫자는 어디서 나오나요'),
  },
  {
    question: '이 순위가 포지션별 전략인가요?',
    answer: STRATEGY_DISTINCTION_SENTENCE,
  },
  {
    question: '핸드레인지 표와는 뭐가 다른가요?',
    answer: RANGE_DISTINCTION_SENTENCE,
  },
  {
    question: '이 순위가 "좋은 패" 순서는 아닌가요?',
    answer: PLAYABILITY_CAVEAT_SENTENCE,
  },
  {
    question: '"상위 X%"는 정확히 무슨 뜻인가요?',
    answer: `${topShareCutSentence(HAND_CLASS_COUNT, COMBO_COUNT)} ${tiesOverviewSentence(
      HAND_STRENGTH.exactTies,
    )}`,
  },
  {
    // WP-S3-14. Both ranks and both equities are read from the dataset; the gap is their
    // difference. The reason given is the one the enumeration itself contains — a suited
    // pair of ranks has flush runouts an offsuit pair does not — not a playing claim.
    question: 'AKs와 AKo는 왜 순위가 다른가요?',
    answer: (() => {
      const pair = suitedVersusOffsuit('AKs', 'AKo');
      return `같은 두 숫자라도 같은 무늬면 플러시가 완성되는 보드가 더해지기 때문에, 모든 보드를 세면 값이 조금 더 높게 나옵니다. 이 데이터에서 ${pair.suited.entry.key}는 ${pair.suited.entry.rank}위(${guidePercent(pair.suited.entry.equity)}), ${pair.offsuit.entry.key}는 ${pair.offsuit.entry.rank}위(${guidePercent(pair.offsuit.entry.equity)})로, 차이는 ${formatSignedPercentagePoints(pair.equityGap, 2)}입니다.`;
    })(),
  },
];
