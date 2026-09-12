/**
 * Korean copy for the Starting Hand Explorer (`/tools/starting-hand`). Pure, React-free
 * presentation strings — no poker rule, no arithmetic beyond formatting a number the domain
 * layer already produced — the same discipline `features/range/copy.ts` documents for its
 * own facade, reused here rather than re-argued.
 *
 * ## Why this file matters more than most copy files
 *
 * `docs/reports/FISHTILT_WP_R_STRENGTH_DATASET.md` §7 is explicit: all-in preflop equity is
 * NOT playability, and a beginner who reads this ranking as an opening-range recommendation
 * will misplay every hand it teaches. `METHODOLOGY_SENTENCE` and `STRATEGY_DISTINCTION_SENTENCE`
 * are the two sentences that stand between this page and that misreading, and neither may
 * drift from what the dataset actually measured. Every sentence below that carries a NUMBER
 * (`provenanceSentence`, `topShareCutSentence`, `rankLabel`, `cumulativeShareLabel`,
 * `equityLabel`) takes that number as a parameter and reads it from
 * `@gto-self/learn-core`'s `HAND_STRENGTH` / `HandStrengthEntry` at the call site, rather
 * than freezing it as a string literal — a dataset regeneration must change what this page
 * says, not leave it quietly wrong (CLAUDE.md rule 2/5).
 *
 * The word "GTO" never appears in this file.
 */
import { handClassByKey } from '@gto-self/strategy-core';
import type { HandStrengthEntry, TopHandSelection } from '@gto-self/learn-core';
import { formatPercent } from '../tools/format.js';
import { handClassReading, RANGE_LABEL } from '../range/index.js';
import type { StartingHandView } from './types.js';
import type { TieInfo } from './viewModel.js';

/** The one fixed term this page's metric is labelled with — never varied per mode or
 *  section, so a reader learns to trust exactly this phrase, the same rule `RANGE_LABEL`
 *  follows for the Range Explorer. */
export const STRENGTH_METRIC_LABEL = '프리플랍 기본 강도';

export const STARTING_HAND_VIEW_LABEL: Readonly<Record<StartingHandView, string>> = {
  RANK: '강한 패 순서',
  TOP_SHARE: '상위 X% 보기',
};

/**
 * The single most important sentence on this page (build spec brief for this WP). States
 * the basis in one beginner-readable line: a uniformly random opponent, preflop, all the way
 * to showdown. No mention of a sample, a budget or an estimate, because the shipped dataset
 * is EXACT (`HAND_STRENGTH.method`) and saying "약" or "추정" here would understate it.
 *
 * WHAT THE NUMBER IS, EXACTLY. `HandStrengthEntry.equity` is hero's EXPECTED SHARE OF THE
 * POT with ties split in half (`packages/learn-core/src/strength/model.ts`), not the
 * proportion of the time hero wins outright. The two differ by up to ~2.9 percentage points
 * on a dataset printed to two decimals, so this sentence may not say 이기는 비율 / 이길 확률
 * — it says what the number is and states the tie convention, the same way
 * `content/learn/equity.mdx` already does.
 */
export const METHODOLOGY_SENTENCE =
  '이 순위는 상대가 무작위로 아무 두 장을 들고 있다고 가정하고, 프리플랍에서 올인해 승부를 끝까지 봤을 때 내가 팟에서 가져갈 것으로 기대되는 몫만으로 169개 시작 패의 순서를 매긴 것입니다. 정확히 비기는 경우는 절반만 이긴 것으로 계산에 들어갑니다.';

/**
 * The line that stops a reader from taking this ranking as a strategy recommendation. Given
 * near-verbatim by the WP brief; not softened, because softening it is exactly the failure
 * mode §7 of the methodology report warns about.
 */
export const STRATEGY_DISTINCTION_SENTENCE =
  '이 순위는 포지션별 전략이 아니라 시작 패 자체의 기본 강도를 비교한 것입니다.';

/**
 * The second half of the distinction: contrasts this page's metric with `/tools/range`'s
 * `RANGE_LABEL` by name, so a reader who has seen both pages cannot merge them into one
 * concept. Reuses `RANGE_LABEL` rather than restating "학습용 기본 레인지" as a second literal.
 *
 * The page it points at is named `13×13 핸드레인지 표` — the `<h1>` and `<title>` WP-7a
 * converged on in `src/app/tools/range/page.tsx`. This sentence used to open with
 * `핸드레인지 탐색기의`, a name that after that convergence rendered NOWHERE on the site, so a
 * reader sent from here had nothing to match when they arrived. The name is a literal here
 * because that page states it as page metadata and exports no constant; if it is ever
 * renamed again, this line is the one other place that has to move with it.
 */
export const RANGE_DISTINCTION_SENTENCE = `13×13 핸드레인지 표의 ${RANGE_LABEL}와는 다른 기준입니다. 그 표는 포지션별로 ${RANGE_LABEL}에 어떤 패가 들어 있는지를 보여주고, 이 표는 포지션과 관계없이 카드 두 장 자체의 ${STRENGTH_METRIC_LABEL}만 비교합니다.`;

/**
 * 이 순위가 "좋은 플레이" 순서가 아니라는 것을 말하는 한 문단 — §7이 요구하는 "반드시 읽을 것"의
 * UI 버전.
 *
 * TWO THINGS THIS PARAGRAPH MAY NOT DO, both of which it used to do.
 *
 * It may not open with a connector. It renders alone inside its own `이 순위가 "좋은 패"
 * 순서는 아닌가요?` card, two columns away from `STRATEGY_DISTINCTION_SENTENCE`; a leading
 * "그래서" there has no antecedent on screen and the section reads as truncated.
 *
 * And it may not smuggle in the claim it exists to prevent. The previous version asserted
 * WHICH hands are hard to play well and WHICH hands people like — playability rankings this
 * site has no dataset for, inside the very sentence meant to stop the reader from reading
 * one out of the ranking. What is left is only what the dataset's own basis
 * (`HEADS_UP_ALLIN_EQUITY_VS_RANDOM_HAND`) supports: postflop play is not in the measurement
 * at all, so the ranking cannot be read as one. The 뜻은 아닙니다 caveat stays.
 */
export const PLAYABILITY_CAVEAT_SENTENCE =
  '이 순위는 "좋은 패" 순서가 아닙니다. 여기 있는 숫자는 프리플랍에서 올인해 승부를 끝까지 본다고 가정하고 계산한 값이라, 플랍 이후에 그 패를 어떻게 플레이하게 되는지는 아예 계산에 들어 있지 않습니다. 그래서 순위가 높다고 해서 실전에서 다루기 쉬운 패라는 뜻은 아니고, 어떤 패가 실제로 다루기 쉬운지는 이 사이트가 아직 답할 수 있는 범위 밖입니다.';

/** `15` -> `"상위 15%"` — the requested value, always shown next to what was actually
 *  selected (`actualShareSentence`), because the two can differ (`topHandsByShare`'s
 *  combo-weighted cut). */
export function requestedTopPercentLabel(percent: number): string {
  return `상위 ${percent}%`;
}

/**
 * What the slider actually selected, in the reader's own units: how many of the 169 labels,
 * how many of the 1326 dealt hands, and the real percentage — which is always `>=` the
 * requested one, because a class is atomic and the cut cannot split it (`ranking.ts`'s own
 * module doc). This is the sentence that turns "top 15%" from a request into an answer.
 */
export function actualShareSentence(selection: TopHandSelection): string {
  return `실제로는 ${selection.classCount}개 핸드, ${selection.comboCount.toLocaleString('ko-KR')}가지 조합 — 전체의 ${formatPercent(selection.actualShare, 2)}가 포함됩니다.`;
}

/** The weakest class the current cut still includes, named the same way the panel names any
 *  other hand — the reading beside the key — so a reader can see exactly where the line was
 *  drawn without opening the panel. `null` selection (nothing at all) has no such hand. */
export function weakestIncludedLabel(selection: TopHandSelection): string | null {
  const weakest = selection.weakestIncluded;
  if (weakest === undefined) return null;
  const handClass = handClassByKey(weakest.key);
  const reading = handClass !== undefined ? ` (${handClassReading(handClass)})` : '';
  return `여기 포함되는 가장 약한 패는 ${weakest.key}${reading}입니다.`;
}

/**
 * The combo-vs-label explanation `topHandsByShare`'s own module doc calls for: there are 169
 * labels but `comboCount` dealt hands, and they are not evenly sized, so "top X%" is answered
 * against the deal, not the label list. Counts are parameters, read at the call site from
 * `strategy-core` (`HAND_CLASS_COUNT`, `COMBO_COUNT`), not frozen here.
 */
export function topShareCutSentence(classCount: number, comboCount: number): string {
  return `"상위 X%"는 ${classCount}개 핸드 이름 중 X%가 아니라, 실제로 받게 되는 ${comboCount.toLocaleString('ko-KR')}가지 조합 중 상위 X%를 뜻합니다. 핸드 하나는 쪼개지지 않고 통째로만 들어가기 때문에, 요청한 비율을 넘어서는 순간의 마지막 핸드가 통째로 포함되면서 실제 비율은 슬라이더 값보다 살짝 높게 나올 수 있습니다. 조합 수가 많은 핸드에서 끊길수록 그 차이가 커집니다.`;
}

/**
 * Reads the dataset's own provenance rather than restating it: `EXACT`, board count,
 * opponent-hand count and total showdowns all come from `HAND_STRENGTH`'s metadata
 * (`packages/learn-core/src/strength/model.ts`'s `HandStrengthDatasetMeta`). If the dataset
 * is ever regenerated at a different scale, this sentence changes with it rather than
 * silently going stale.
 */
export function provenanceSentence(meta: {
  readonly method: 'EXACT';
  readonly trialCount: number;
  readonly enumeration: { readonly boardsPerClass: number; readonly opponentHands: number };
}): string {
  const { boardsPerClass, opponentHands } = meta.enumeration;
  return `추정이 아닙니다. 가능한 보드 ${boardsPerClass.toLocaleString('ko-KR')}가지 전부를 상대 패 ${opponentHands.toLocaleString('ko-KR')}가지 전부와 맞붙여 계산했습니다 — 총 ${meta.trialCount.toLocaleString('ko-KR')}번의 승부입니다.`;
}

/**
 * Whether the dataset currently records any exact tie, read from `HAND_STRENGTH.exactTies`
 * rather than assumed empty — see `viewModel.ts`'s `tieInfoFor` doc for why this must stay
 * data-driven. `count` is the array's length, not a boolean, so the sentence can name how
 * many pairs exist if a future regeneration ever produces one.
 */
export function tiesOverviewSentence(exactTies: readonly string[]): string {
  if (exactTies.length === 0) {
    return '지금 이 데이터에는 승률이 완전히 같은 시작 패 쌍이 하나도 없습니다. 169개 모두 순서가 명확합니다.';
  }
  return `승률이 완전히 같은 시작 패가 ${exactTies.length}쌍 있습니다 (${exactTies.join(', ')}). 이 쌍 안에서는 어느 쪽이 더 강하다고 말할 수 없습니다.`;
}

/** `169`, `8` -> `"169개 중 8위"`. `total` is a parameter, read from `HAND_STRENGTH.entries.length`
 *  at the call site, not frozen as `169` here. */
export function rankLabel(entry: HandStrengthEntry, total: number): string {
  return `${total}개 중 ${entry.rank}위`;
}

/** The share of the 1326-combo deal that ranks at or above this class — "top-percentage it
 *  falls within", read straight off the entry rather than recomputed. */
export function cumulativeShareLabel(entry: HandStrengthEntry): string {
  return `상위 ${formatPercent(entry.cumulativeShare, 2)}`;
}

/** Hero's all-in preflop equity against a uniformly random hand, the number the whole page
 *  is about. */
export function equityLabel(entry: HandStrengthEntry): string {
  return formatPercent(entry.equity, 2);
}

/**
 * `null` when the class is not tied with either neighbour (true for all 169 today — see
 * `viewModel.ts`). When it is, the sentence says so in place of implying the rank is a
 * strict "stronger than the next one down" claim the data does not support.
 */
export function tieNote(tie: TieInfo): string | null {
  if (!tie.tiedWithStronger && !tie.tiedWithWeaker) return null;
  return '이 패는 승률이 완전히 같은 다른 시작 패와 공동 순위입니다. 어느 쪽이 더 강하다고 말할 수 없습니다.';
}
