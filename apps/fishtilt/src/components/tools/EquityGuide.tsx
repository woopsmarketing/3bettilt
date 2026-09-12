/**
 * `EquityGuide` — the complete guide under the equity calculator (`/tools/equity`).
 *
 * Every percentage here is `exactHeadsUpEquity` output read through
 * `features/tools/guide/equityGuide.ts` at render time; the guide prints `winProb`,
 * `tieProb` and `equity` at two decimals (the `Fact` convention) so the calculator's own
 * one-decimal display above stays the only "result" on the page. The semantics are the
 * engine's: equity = win + tie / 2, the expected share of the pot — never restated as anything
 * else (WP-S3-14 brief: "do not change expected-pot-share semantics").
 */
import {
  equityBoardExamples,
  equityMatchupExamples,
  equityTieExample,
  guideCount,
  guidePercent,
} from '../../features/tools/index.js';
import {
  EQUITY_HERO_LABEL,
  EQUITY_TIE_LABEL,
  EQUITY_VILLAIN_LABEL,
} from '../../features/tools/equity.js';
import { DataTable } from '../DataTable.js';
import { KeyPoint } from '../KeyPoint.js';
import { StatStrip } from '../StatStrip.js';
import { TableOfContents, type TocHeading } from '../TableOfContents.js';
import { Term } from '../Term.js';
import { GuideCards } from './GuideCards.js';
import { GUIDE_TOC_CLASS, ToolGuideSection } from './ToolGuideSection.js';

export const EQUITY_GUIDE_HEADINGS: readonly TocHeading[] = [
  { id: 'what-is-equity', text: '승률(Equity)이란?' },
  { id: 'win-tie-equity', text: '이김 · 비김 · 승률의 차이' },
  { id: 'reading-the-result', text: '결과 읽는 법' },
  { id: 'matchups', text: '대결 예시 네 가지' },
  { id: 'board-changes', text: '보드를 넣으면 달라지는 것' },
  { id: 'limitations', text: '이 계산기가 하지 않는 것' },
];

export function EquityGuide() {
  const matchups = equityMatchupExamples();
  const boards = equityBoardExamples();
  const tie = equityTieExample();
  const preflop = boards[0];
  const last = boards[boards.length - 1];

  return (
    <>
      <ToolGuideSection
        id="what-is-equity"
        title="승률(Equity)이란?"
        divider="top"
        description="지금 두 패가 남은 카드를 전부 열어 본다면, 내가 팟에서 가져갈 몫."
      >
        <TableOfContents headings={EQUITY_GUIDE_HEADINGS} className={GUIDE_TOC_CLASS} />
        <p>
          <Term id="term-equity">에퀴티</Term>는 두 패가 <Term id="term-showdown">쇼다운</Term>까지
          갔을 때 내가 팟에서 기대할 수 있는 몫입니다. 남은 카드가 열리는 모든 경우를 하나씩 세어,
          내가 이기는 경우의 비율에 비기는 경우의 절반을 더한 값입니다. 이 사이트는 이 값을
          &ldquo;승률&rdquo;이라고 부릅니다 — 정확히 말하면 &ldquo;이길 확률&rdquo;이 아니라
          &ldquo;팟에서 가져갈 기대 몫&rdquo;이지만, 비김이 드문 대결에서는 둘이 거의 같습니다.
        </p>
        <KeyPoint>
          <p>
            승률 = 이길 확률 + 비길 확률 ÷ 2. 비기면 팟을 반씩 나누므로, 비기는 경우는 절반만 내
            몫으로 칩니다.
          </p>
        </KeyPoint>
      </ToolGuideSection>

      <ToolGuideSection
        id="win-tie-equity"
        title="이김 · 비김 · 승률의 차이"
        description="세 숫자가 다른 것을 말한다는 점을 가장 잘 보여주는 대결은 같은 패끼리의 대결입니다."
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <GuideCards label="내 패" cards={tie.hero} />
          <span className="text-sm font-semibold text-text-300">vs</span>
          <GuideCards label="상대 패" cards={tie.villain} />
        </div>
        <StatStrip
          className="mt-6"
          aria-label={`${tie.hero} 대 ${tie.villain} 결과`}
          variant="rules"
          items={[
            { label: '내가 이김', value: guidePercent(tie.result.winProb) },
            { label: '비김', value: guidePercent(tie.result.tieProb) },
            { label: '승률 (팟에서의 몫)', value: guidePercent(tie.result.equity) },
          ]}
        />
        <p>
          같은 AK끼리는 대부분 <Term id="term-split-pot">스플릿 팟</Term>으로 끝납니다. 한쪽만
          플러시를 만드는 드문 경우에만 승부가 갈리고, 그 확률은 양쪽이 똑같습니다. 그래서 이길
          확률은 {guidePercent(tie.result.winProb)}에 불과하지만, 비김의 절반을 더한 승률은 정확히{' '}
          {guidePercent(tie.result.equity)}가 됩니다. &ldquo;승률 50%&rdquo;와 &ldquo;이길 확률
          50%&rdquo;가 같은 말이 아니라는 것을 이 한 줄이 보여줍니다.
        </p>
      </ToolGuideSection>

      <ToolGuideSection
        id="reading-the-result"
        title="결과 읽는 법"
        description="위 결과 칸의 세 숫자와 한 줄 설명은 각각 이렇게 읽습니다."
      >
        <ul>
          <li>
            <strong>
              {EQUITY_HERO_LABEL} · {EQUITY_TIE_LABEL} · {EQUITY_VILLAIN_LABEL}.
            </strong> 셋을 더하면 항상 100%입니다. 가운데
            &ldquo;비김&rdquo;은 두 패가 같은 다섯 장을 만드는 경우이며, 왼쪽과 오른쪽 숫자에는 이미
            비김의 절반씩이 들어 있지 않습니다 — 절반씩 나눠 더한 값이 &ldquo;승률&rdquo;입니다.
          </li>
          <li>
            <strong>&ldquo;몇 가지 카드 조합을 모두 계산했습니다&rdquo;.</strong> 이 계산기는 남은
            카드가 열리는 경우를 하나도 빠짐없이 셉니다. 무작위로 몇 번 돌려 본 추정치가 아니라서,
            같은 입력이면 언제 눌러도 같은 숫자가 나옵니다.
          </li>
          <li>
            <strong>보드가 비어 있으면 프리플랍</strong>입니다. 플랍 세 장, 턴 한 장, 리버 한 장을
            더할수록 남은 경우의 수가 줄고 숫자가 한쪽으로 쏠립니다 — 아래 &ldquo;보드를 넣으면
            달라지는 것&rdquo;에서 같은 대결로 확인해보세요.
          </li>
        </ul>
      </ToolGuideSection>

      <ToolGuideSection
        id="matchups"
        title="대결 예시 네 가지"
        description="결과를 읽는 감을 잡기 위한 대결입니다. 어떻게 플레이하라는 뜻은 없습니다."
        wide={
          <DataTable
            caption="프리플랍 대결 네 가지 — 남은 48장이 열리는 모든 경우를 센 값"
            rowHeader="대결"
            columns={[
              { key: 'matchup', label: '대결' },
              { key: 'lesson', label: '무엇을 보여주나' },
              { key: 'win', label: '내가 이김', numeric: true },
              { key: 'tie', label: '비김', numeric: true },
              { key: 'equity', label: '승률', numeric: true, highlight: true },
              { key: 'runouts', label: '센 경우의 수', numeric: true },
            ]}
            rows={matchups.map((example) => ({
              key: example.id,
              cells: {
                matchup: (
                  <span className="font-mono">
                    {example.hero} vs {example.villain}
                  </span>
                ),
                lesson: example.title,
                win: guidePercent(example.result.winProb),
                tie: guidePercent(example.result.tieProb),
                equity: guidePercent(example.result.equity),
                runouts: guideCount(example.result.runouts),
              },
            }))}
          />
        }
      >
        <p>
          큰 페어끼리(AA vs KK)는 한쪽이 크게 앞서고, 페어 대 두 오버카드(22 vs JTs)는 거의
          반반이며, 가장 약한 패(72o) 상대로도 AK는 30% 가까이 집니다 — 프리플랍에서는 어떤 패도
          &ldquo;확정&rdquo;이 아니라는 뜻입니다. 정확한 숫자는 아래 표에서 읽으세요.
        </p>
      </ToolGuideSection>

      <ToolGuideSection
        id="board-changes"
        title="보드를 넣으면 달라지는 것"
        description="같은 두 패를 놓고 보드만 한 장씩 더해 봅니다."
        wide={
          <DataTable
            caption={`${preflop?.hero ?? ''} vs ${preflop?.villain ?? ''} — 보드에 따른 승률 변화`}
            rowHeader="단계"
            columns={[
              { key: 'street', label: '단계' },
              { key: 'board', label: '보드' },
              { key: 'equity', label: '내 승률', numeric: true, highlight: true },
              { key: 'villain', label: '상대 승률', numeric: true },
              { key: 'runouts', label: '남은 경우의 수', numeric: true },
            ]}
            rows={boards.map((example) => ({
              key: example.id,
              cells: {
                street: example.title,
                board:
                  example.board === '' ? (
                    <span className="text-text-300">(없음)</span>
                  ) : (
                    <span className="font-mono">{example.board}</span>
                  ),
                equity: guidePercent(example.result.equity),
                villain: guidePercent(1 - example.result.equity),
                runouts: guideCount(example.result.runouts),
              },
            }))}
          />
        }
      >
        <p>
          <Term id="term-board">보드</Term>는 두 사람이 함께 쓰는 공용 카드입니다. 보드를 한 장 더할
          때마다 남은 경우의 수가 크게 줄고, 이미 열린 카드가 누구 편인지에 따라 승률이 한쪽으로
          쏠립니다. 표의 첫 줄은 프리플랍(경우의 수 {guideCount(preflop?.result.runouts ?? 0)}가지),
          마지막 줄은 턴까지 열린 뒤(남은 경우 {guideCount(last?.result.runouts ?? 0)}가지)입니다.
        </p>
        <p>
          위 계산기에서 보드 칸을 채우면 같은 방식으로 다시 계산됩니다. 보드가 한 장이나 두 장이면
          실제 게임에 없는 상황이므로 계산기가 그 이유를 적고 기다립니다.
        </p>
      </ToolGuideSection>

      <ToolGuideSection
        id="limitations"
        title="이 계산기가 하지 않는 것"
        tone="recessed"
        description="숫자를 믿어도 되는 범위를 분명히 해 두는 편이 낫습니다."
      >
        <ul>
          <li>
            <strong>두 사람만 계산합니다.</strong> 세 명 이상이 남아 있는 팟은 지원하지 않음 — 상대
            하나만 골라 계산한 값은 다인 팟의 승률이 아닙니다.
          </li>
          <li>
            <strong>상대의 정확한 두 장을 알아야 합니다.</strong> &ldquo;상대가 이 정도 패를 들었을
            것 같다&rdquo;는 레인지 전체를 상대로 한 계산은 지원하지 않음. 그 경우는 시작 핸드
            탐색기의 &ldquo;무작위 패 상대 승률&rdquo;이 대신 답합니다.
          </li>
          <li>
            <strong>콜할지 말지는 말하지 않습니다.</strong> 승률은 재료이고, 콜에 필요한 승률은 팟
            오즈가 정합니다. 두 숫자를 나란히 놓는 것이 다음 단계입니다.
          </li>
        </ul>
      </ToolGuideSection>
    </>
  );
}
