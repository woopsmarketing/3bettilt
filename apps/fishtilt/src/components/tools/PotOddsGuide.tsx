/**
 * `PotOddsGuide` — the complete guide under the pot odds calculator (`/tools/pot-odds`).
 *
 * The formula is stated once, and every number in the worked example is `potOdds()` output
 * read through `features/tools/guide/potOddsGuide.ts`; the "compare with a draw" section pairs
 * that price with `outsOdds()` for a flush draw so the reader sees pot odds and equity side by
 * side — the confusion this page most often has to clear up. Money is milliBB throughout and
 * printed by `formatAmountBB` (CLAUDE.md rule 1).
 */
import {
  formatAmountBB,
  formatMultiplier,
  guidePercent,
  potOddsExamples,
  potOddsVsOuts,
  potOddsWalkthrough,
} from '../../features/tools/index.js';
import { DataTable } from '../DataTable.js';
import { KeyPoint } from '../KeyPoint.js';
import { PotOddsFigure } from '../PotOddsFigure.js';
import { StatStrip } from '../StatStrip.js';
import { TableOfContents, type TocHeading } from '../TableOfContents.js';
import { Term } from '../Term.js';
import { GUIDE_TOC_CLASS, ToolGuideSection } from './ToolGuideSection.js';

export const POT_ODDS_GUIDE_HEADINGS: readonly TocHeading[] = [
  { id: 'what-are-pot-odds', text: '팟 오즈란?' },
  { id: 'formula', text: '공식 한 줄' },
  { id: 'worked-example', text: '예시로 따라가기' },
  { id: 'bet-sizes', text: '베팅 크기별 필요 승률' },
  { id: 'versus-equity', text: '팟 오즈와 승률 나란히 놓기' },
  { id: 'confusions', text: '자주 헷갈리는 것' },
  { id: 'limitations', text: '이 계산기가 하지 않는 것' },
];

export function PotOddsGuide() {
  const walk = potOddsWalkthrough();
  const examples = potOddsExamples();
  const draw = potOddsVsOuts();
  const o = walk.odds;

  return (
    <>
      <ToolGuideSection
        id="what-are-pot-odds"
        title="팟 오즈란?"
        divider="top"
        description="콜에 드는 돈과 그 콜로 얻을 수 있는 돈의 비율 — 그래서 최소한 몇 %는 이겨야 하는지."
      >
        <TableOfContents headings={POT_ODDS_GUIDE_HEADINGS} className={GUIDE_TOC_CLASS} />
        <p>
          상대가 <Term id="term-bet">베팅</Term>하면 나는 <Term id="term-call">콜</Term>에 얼마를
          내고, 이기면 얼마를 가져가는지 두 숫자를 갖게 됩니다. 이 둘의 비율이{' '}
          <Term id="term-pot-odds">팟 오즈</Term>이고, 이를 퍼센트로 바꾼 것이 &ldquo;본전이 되려면
          최소한 이 정도는 이겨야 한다&rdquo;는 필요 승률입니다. 위 계산기는 그 필요 승률을
          구합니다.
        </p>
      </ToolGuideSection>

      <ToolGuideSection id="formula" title="공식 한 줄">
        <KeyPoint title="필요 승률">
          <p>
            콜 금액 ÷ (지금 <Term id="term-pot">팟</Term> + 상대 베팅 + 내 콜 금액). 분모는 콜을
            마친 뒤 내가 가져가려는 팟 전체입니다.
          </p>
        </KeyPoint>
        <p>
          비율로 말하면 &ldquo;(팟 + 상대 베팅) : 콜 금액&rdquo;이고, 퍼센트로 말하면 위 식입니다.
          둘은 같은 사실을 다르게 적은 것이며, 서로 바꾸는 방법은 아래 &ldquo;자주 헷갈리는
          것&rdquo;에 있습니다.
        </p>
      </ToolGuideSection>

      <ToolGuideSection
        id="worked-example"
        title="예시로 따라가기"
        description={`팟 ${formatAmountBB(o.potBeforeCallMbb)}에 상대가 ${formatAmountBB(o.villainBetMbb)}를 베팅했고, 내가 ${formatAmountBB(o.callAmountMbb)}를 콜하는 상황.`}
        wide={<PotOddsFigure pot={walk.potBB} bet={walk.betBB} />}
      >
        <ol>
          <li>
            콜을 마치면 팟은 {formatAmountBB(o.potBeforeCallMbb)} + {formatAmountBB(o.calledBetMbb)}{' '}
            + {formatAmountBB(o.callAmountMbb)} = <strong>{formatAmountBB(o.finalPotMbb)}</strong>가
            됩니다.
          </li>
          <li>
            내가 거는 돈은 {formatAmountBB(o.callAmountMbb)}이므로, 필요 승률은{' '}
            {formatAmountBB(o.callAmountMbb)} ÷ {formatAmountBB(o.finalPotMbb)} ={' '}
            <strong>{guidePercent(o.requiredEquity)}</strong>입니다.
          </li>
          <li>
            같은 말을 횟수로 하면 &ldquo;{formatMultiplier(o.oneInN)}번 중 1번만 이기면 본전&rdquo;,
            비율로 하면 &ldquo;{formatMultiplier(o.oddsAgainst)} 대 1&rdquo;입니다.
          </li>
        </ol>
        <StatStrip
          className="mt-6"
          aria-label="예시의 세 가지 표현"
          variant="rules"
          items={[
            { label: '필요 승률', value: guidePercent(o.requiredEquity) },
            { label: '몇 번 중 한 번', value: `${formatMultiplier(o.oneInN)}번 중 1번` },
            { label: '비율', value: `${formatMultiplier(o.oddsAgainst)} 대 1` },
          ]}
        />
      </ToolGuideSection>

      <ToolGuideSection
        id="bet-sizes"
        title="베팅 크기별 필요 승률"
        description="상대가 팟의 얼마를 베팅했는지에 따라 필요 승률이 어떻게 달라지는지."
        wide={
          <DataTable
            caption="상대 베팅 크기별 필요 승률 — 내가 베팅 전액을 콜할 때"
            rowHeader="상황"
            columns={[
              { key: 'title', label: '상황' },
              { key: 'pot', label: '지금 팟', numeric: true },
              { key: 'bet', label: '상대 베팅', numeric: true },
              { key: 'final', label: '콜 후 팟', numeric: true },
              { key: 'required', label: '필요 승률', numeric: true, highlight: true },
              { key: 'ratio', label: '비율', numeric: true },
            ]}
            rows={examples.map((example) => ({
              key: example.id,
              cells: {
                title: example.title,
                pot: formatAmountBB(example.odds.potBeforeCallMbb),
                bet: formatAmountBB(example.odds.villainBetMbb),
                final: formatAmountBB(example.odds.finalPotMbb),
                required: guidePercent(example.odds.requiredEquity),
                ratio: `${formatMultiplier(example.odds.oddsAgainst)} 대 1`,
              },
            }))}
          />
        }
      >
        <p>
          베팅이 커질수록 콜에 필요한 승률도 올라갑니다. 팟 크기 베팅이면 팟의 세 부분 중 하나를
          내가 내는 셈이라 3분의 1 가까이 이겨야 하고, 팟의 3분의 1 베팅이면 다섯 부분 중 하나라
          20%만 이겨도 됩니다. 정확한 값은 표에서 읽으세요.
        </p>
      </ToolGuideSection>

      <ToolGuideSection
        id="versus-equity"
        title="팟 오즈와 승률 나란히 놓기"
        description="필요 승률은 문턱이고, 내 승률은 그 문턱을 넘는지 확인할 숫자입니다."
      >
        <StatStrip
          aria-label="필요 승률과 플러시 드로우 확률"
          variant="rules"
          items={[
            { label: '예시의 필요 승률', value: guidePercent(draw.requiredEquity) },
            { label: `아웃 ${draw.outs}개 · 다음 한 장`, value: guidePercent(draw.nextCardProb) },
            {
              label: `아웃 ${draw.outs}개 · 리버까지 두 장`,
              value: guidePercent(draw.byRiverProb),
            },
          ]}
        />
        <p>
          위 예시의 필요 승률 {guidePercent(draw.requiredEquity)}를 플랍의 플러시 드로우(아웃{' '}
          {draw.outs}개)와 비교하면, 다음 한 장만 보는 확률 {guidePercent(draw.nextCardProb)}는
          문턱을 {draw.nextCardClears ? '넘고' : '넘지 못하고'}, 리버까지 두 장을 보는 확률{' '}
          {guidePercent(draw.byRiverProb)}는 {draw.byRiverClears ? '넘습니다' : '넘지 못합니다'}.
          어느 쪽 확률을 써야 하는지는 &ldquo;이번 콜로 카드를 몇 장 볼 수 있는가&rdquo;에 달려
          있습니다 — 턴에서 또 베팅이 나올 수 있다면 한 장 확률이 정직한 비교입니다.
        </p>
      </ToolGuideSection>

      <ToolGuideSection id="confusions" title="자주 헷갈리는 것">
        <ul>
          <li>
            <strong>팟 오즈와 승률은 다른 숫자입니다.</strong> 팟 오즈는 돈에서 나오고(얼마를 걸어
            얼마를 얻는가), 승률은 카드에서 나옵니다(이 패가 얼마나 자주 이기는가). 콜은 두 번째가
            첫 번째보다 클 때 본전 이상입니다.
          </li>
          <li>
            <strong>퍼센트와 비율은 같은 말입니다.</strong> &ldquo;{formatMultiplier(o.oddsAgainst)}{' '}
            대 1&rdquo;을 퍼센트로 바꾸려면 1 ÷ ({formatMultiplier(o.oddsAgainst)} + 1) ={' '}
            {guidePercent(o.requiredEquity)}. 반대로 퍼센트에서 비율로 가려면 (100 − 퍼센트) ÷
            퍼센트입니다.
          </li>
          <li>
            <strong>분모에 내 콜 금액이 들어갑니다.</strong> &ldquo;팟이{' '}
            {formatAmountBB(o.potBeforeCallMbb)}이고 베팅이 {formatAmountBB(o.villainBetMbb)}니까{' '}
            {formatAmountBB(o.villainBetMbb)} ÷ {formatAmountBB(o.potBeforeCallMbb)}&rdquo;로
            계산하는 실수가 가장 흔합니다. 내가 넣는 돈도 팟의 일부가 되므로 분모는 콜 후의
            팟입니다.
          </li>
        </ul>
      </ToolGuideSection>

      <ToolGuideSection id="limitations" title="이 계산기가 하지 않는 것" tone="recessed">
        <ul>
          <li>
            <strong>내 승률은 계산하지 않습니다.</strong> 문턱만 구합니다. 승률은 승률 계산기(상대
            패를 알 때)나 아웃 계산기(드로우일 때)에서 가져오세요.
          </li>
          <li>
            <strong>나중에 더 딸 수 있는 돈(임플라이드 오즈)은 지원하지 않음.</strong> 이 계산기는
            지금 팟에 있는 돈만 셉니다.
          </li>
          <li>
            <strong>상대가 더 베팅할 가능성은 계산에 없습니다.</strong> 두 장을 볼 수 있는지 한 장만
            볼 수 있는지는 상황을 보고 스스로 정해야 합니다.
          </li>
        </ul>
      </ToolGuideSection>
    </>
  );
}
