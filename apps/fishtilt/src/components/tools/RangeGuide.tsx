/**
 * `RangeGuide` — the complete guide under the Range Explorer (`/tools/range`, WP-S3-14).
 *
 * Every number on this page is READ, not written: the seat rows, the UTG-vs-BTN arithmetic,
 * the walkthrough hand's membership and the unsupported-condition list all come from
 * `features/tools/guide/rangeGuide.ts`, which asks `strategy-core` and the range facade at
 * render time. `rangeGuide.test.ts` pins the facts the prose leans on (the walkthrough hand
 * is in BTN's list and not UTG's; UTG's list is inside BTN's) so a data change cannot leave a
 * sentence describing a chart that no longer exists.
 *
 * Provenance (AGENT_COMMON_RULES §4): the chart is a learning baseline for one condition. It
 * is never called GTO, no source is named, and every condition the filters offer but the data
 * does not cover is listed under "지원하지 않는 조건" as unsupported, in the facade's words.
 */
import { HAND_CLASS_COUNT, COMBO_COUNT } from '@gto-self/strategy-core';
import {
  compareRanges,
  GUIDE_SPOT,
  GUIDE_STACK_DEPTH,
  guideCount,
  guidePercent,
  MATRIX_KIND_ROWS,
  MATRIX_KIND_TOTALS,
  positionRangeRows,
  supportedConditionLabel,
  unsupportedConditions,
  walkthrough,
} from '../../features/tools/index.js';
import {
  buildRangeUrl,
  POSITION_LABEL,
  RANGE_LABEL,
  RANGE_PROVENANCE_SENTENCE,
} from '../../features/range/index.js';
import { localiseHref } from '../../lib/locale.js';
import { DataTable } from '../DataTable.js';
import { KeyPoint } from '../KeyPoint.js';
import { PokerCards } from '../PokerCards.js';
import { PositionDiagram } from '../PositionDiagram.js';
import { StatStrip } from '../StatStrip.js';
import { TableOfContents, type TocHeading } from '../TableOfContents.js';
import { Term } from '../Term.js';
import { GUIDE_TOC_CLASS, ToolGuideSection } from './ToolGuideSection.js';
import { ToolRangeFigure } from './ToolRangeFigure.js';

export const RANGE_GUIDE_HEADINGS: readonly TocHeading[] = [
  { id: 'what-is-a-range', text: '핸드레인지는 무엇을 그린 표인가' },
  { id: 'reading-the-matrix', text: '13×13 표 읽는 법' },
  { id: 'why-position', text: '자리(포지션)가 중요한 이유' },
  { id: 'utg-vs-btn', text: 'UTG와 BTN 비교' },
  { id: 'walkthrough', text: '패 하나로 따라가기' },
  { id: 'supported', text: '이 표가 다루는 조건' },
  { id: 'unsupported', text: '지원하지 않는 조건' },
];

export function RangeGuide() {
  const kindRows = MATRIX_KIND_ROWS;
  const seatRows = positionRangeRows();
  const comparison = compareRanges();
  const walk = walkthrough();
  const unsupported = unsupportedConditions();
  const labelA = POSITION_LABEL[comparison.a.position];
  const labelB = POSITION_LABEL[comparison.b.position];
  const openedFromLabels = walk.openedFrom.map((position) => POSITION_LABEL[position]);
  const notOpenedFrom = walk.seats
    .filter((seat) => seat.inRange === false)
    .map((seat) => POSITION_LABEL[seat.position]);
  const walkOpenSeat = walk.openedFrom.includes('BTN') ? 'BTN' : walk.openedFrom[0];

  return (
    <>
      <ToolGuideSection
        id="what-is-a-range"
        title="핸드레인지는 무엇을 그린 표인가"
        divider="top"
        description="표를 눌러보기 전에, 이 표가 무엇을 그린 것인지부터."
      >
        <TableOfContents headings={RANGE_GUIDE_HEADINGS} className={GUIDE_TOC_CLASS} />
        <p>
          <Term id="term-range">핸드레인지</Term>는 &ldquo;이 상황에서 이 자리라면 이런 패들로
          플레이한다&rdquo;는 시작 패의 목록입니다. 한 판에 받은 패 하나가 아니라, 같은 상황에서
          레이즈할 수 있는 패 전부를 한 묶음으로 보는 방식입니다. 위의 표는 그 묶음을 색으로 칠한
          그림입니다 — 칠해진 칸은 그 자리에서 <Term id="term-open-raise">오픈 레이즈</Term>하는 패,
          비어 있는 칸은 접는 패입니다.
        </p>
        <p>
          왜 패 하나가 아니라 목록으로 생각할까요? 상대는 내 카드를 볼 수 없으니, 상대가 실제로
          상대하는 것은 &ldquo;내가 이 자리에서 레이즈할 법한 패 전부&rdquo;이기 때문입니다. 내가
          어떤 패로 레이즈하는지 스스로 정해 두면, 판마다 흔들리지 않고 같은 기준으로 결정할 수
          있습니다.
        </p>
        <KeyPoint>
          <p>
            표 하나에 시작 패 {HAND_CLASS_COUNT}가지가 모두 들어 있습니다. 실제 카드 조합으로는{' '}
            {guideCount(COMBO_COUNT)}가지이고, 이 표에서 말하는 &ldquo;몇 %&rdquo;는 그{' '}
            {guideCount(COMBO_COUNT)}가지 중 칠해진 조합의 비율입니다.
          </p>
        </KeyPoint>
      </ToolGuideSection>

      <ToolGuideSection
        id="reading-the-matrix"
        title="13×13 표 읽는 법"
        description="169칸은 세 종류뿐입니다. 대각선, 그 위, 그 아래."
        wide={
          <DataTable
            caption={`13×13 표의 세 영역 — 칸 수와 실제 카드 조합 수 (합계 ${MATRIX_KIND_TOTALS.classCount}칸 · ${guideCount(MATRIX_KIND_TOTALS.comboTotal)}조합)`}
            rowHeader="종류"
            columns={[
              { key: 'kind', label: '종류' },
              { key: 'position', label: '표에서의 위치' },
              { key: 'classes', label: '칸 수', numeric: true },
              { key: 'perClass', label: '칸 하나당 조합', numeric: true },
              { key: 'total', label: '조합 합계', numeric: true, highlight: true },
              { key: 'example', label: '예' },
            ]}
            rows={kindRows.map((row) => ({
              key: row.kind,
              cells: {
                kind: row.label,
                position: row.position,
                classes: row.classCount,
                perClass: row.combosPerClass,
                total: guideCount(row.comboTotal),
                example: <span className="font-mono">{row.example}</span>,
              },
            }))}
          />
        }
      >
        <p>
          가로줄과 세로줄 모두 A부터 2까지, 강한 카드가 먼저 옵니다. 두 줄이 만나는 칸이 시작 패
          하나입니다. 같은 카드가 만나는 대각선은 <Term id="term-pocket-pair">포켓 페어</Term>(AA,
          KK …)이고, 대각선 위쪽은 두 장의 무늬가 같은 <Term id="term-suited">수티드</Term>(AKs처럼
          s가 붙습니다), 아래쪽은 무늬가 다른 <Term id="term-offsuit">오프수트</Term>(AKo처럼 o가
          붙습니다)입니다.
        </p>
        <p>
          칸마다 실제 카드 조합 수가 다르다는 점이 표를 읽을 때 가장 자주 놓치는 부분입니다. 아래
          표처럼 오프수트 칸 하나는 수티드 칸 하나의 세 배이므로, 오프수트 칸 몇 개를 더 칠하면
          레인지 비율이 눈에 띄게 커집니다.
        </p>
      </ToolGuideSection>

      <ToolGuideSection
        id="why-position"
        title="자리(포지션)가 중요한 이유"
        description="같은 패라도 어느 자리에서 받았는지에 따라 레이즈할지가 달라집니다."
        wide={
          <>
            <DataTable
              caption={`자리별 ${RANGE_LABEL} 크기 — ${supportedConditionLabel()} · 비율은 ${guideCount(COMBO_COUNT)}조합 기준`}
              rowHeader="자리"
              columns={[
                { key: 'seat', label: '자리' },
                { key: 'gloss', label: '뜻' },
                { key: 'classes', label: '칠해진 칸', numeric: true },
                { key: 'combos', label: '조합 수', numeric: true },
                { key: 'share', label: '비율', numeric: true, highlight: true },
              ]}
              rows={seatRows.map((row) => ({
                key: row.position,
                cells:
                  row.comboCount === null
                    ? {
                        seat: row.label,
                        gloss: row.gloss,
                        classes: <span className="text-text-300">지원하지 않음</span>,
                        combos: <span className="text-text-300">—</span>,
                        share: <span className="text-text-300">—</span>,
                      }
                    : {
                        seat: row.label,
                        gloss: row.gloss,
                        classes: row.classCount,
                        combos: guideCount(row.comboCount),
                        share: guidePercent(row.share ?? 0),
                      },
              }))}
            />
            {seatRows
              .filter((row) => row.unsupportedReason !== null)
              .map((row) => (
                <p
                  key={row.position}
                  className="prose-ko mx-auto max-w-reading text-sm text-text-300"
                >
                  <strong className="font-semibold text-text-100">{row.label}</strong> —{' '}
                  {row.unsupportedReason}
                </p>
              ))}
          </>
        }
      >
        <p>
          <Term id="term-position">포지션</Term>은 딜러 버튼을 기준으로 내가 앉은 자리입니다. 6인
          테이블에서 첫 번째로 말하는 UTG는 뒤에 다섯 명이 남아 있고, 마지막에 말하는 BTN은 두
          명(SB, BB)만 남아 있습니다. 뒤에 남은 사람이 많을수록 누군가 강한 패를 들고 있을 가능성이
          커지고, 플랍 이후에도 먼저 행동해야 하므로 앞자리는 좁게, 뒷자리는 넓게 여는 것이
          기본입니다.
        </p>
        <PositionDiagram
          highlight={['UTG', 'BTN']}
          caption="6인 테이블의 여섯 자리. 시계 방향으로 행동하고, BTN이 프리플랍에서 맨 마지막 두 자리 앞에 말합니다."
        />
        <p>
          아래 표는 위 도구가 들고 있는 자리별 목록의 크기를 그대로 센 것입니다. 앞자리에서 뒷자리로
          갈수록 칠해진 칸과 조합 수가 늘어나는 것을 확인해보세요.
        </p>
      </ToolGuideSection>

      <ToolGuideSection
        id="utg-vs-btn"
        title={`${labelA}와 ${labelB} 비교`}
        description="가장 앞자리와 가장 뒷자리를 한 표에 겹쳐 그리면 차이가 한눈에 보입니다."
        wide={
          <ToolRangeFigure
            rangeA={comparison.a.range}
            labelA={labelA}
            rangeB={comparison.b.range}
            labelB={labelB}
            label={`${labelA} 레인지와 ${labelB} 레인지를 겹친 13×13 표. ${labelA}는 ${guideCount(comparison.a.combos)}조합(${guidePercent(comparison.a.share)}), ${labelB}는 ${guideCount(comparison.b.combos)}조합(${guidePercent(comparison.b.share)}). 두 자리에 모두 있는 조합 ${guideCount(comparison.sharedCombos)}, ${labelB}에만 들어 있는 조합 ${guideCount(comparison.onlyBCombos)}, ${labelA}에만 들어 있는 조합 ${guideCount(comparison.onlyACombos)}.`}
          />
        }
      >
        <StatStrip
          aria-label={`${labelA}와 ${labelB} 레인지 크기`}
          variant="rules"
          items={[
            {
              label: `${labelA} 레인지`,
              value: guidePercent(comparison.a.share),
              note: `${guideCount(comparison.a.combos)}조합 · ${comparison.a.classes}칸`,
            },
            {
              label: `${labelB} 레인지`,
              value: guidePercent(comparison.b.share),
              note: `${guideCount(comparison.b.combos)}조합 · ${comparison.b.classes}칸`,
            },
            {
              label: `${labelB}에만 들어 있는 조합`,
              value: guideCount(comparison.onlyBCombos),
              note: `${comparison.onlyBClasses}칸`,
            },
          ]}
        />
        <p>
          {labelB}의 목록은 {labelA}의 목록보다 {guideCount(comparison.onlyBCombos)}조합이 더
          많습니다.{' '}
          {comparison.aIsSubsetOfB
            ? `${labelA}에서 레이즈하는 패는 빠짐없이 ${labelB}에서도 레이즈하므로, ${labelB}에서 새로 더해지는 패만 보면 두 자리의 차이를 전부 본 것입니다.`
            : `${labelA}에만 들어 있는 조합도 ${guideCount(comparison.onlyACombos)}조합 있습니다.`}{' '}
          더해지는 패의 대부분은 대각선에서 먼 칸 — 작은 수티드 커넥터, 약한 에이스, 킹이나 퀸이
          붙은 오프수트 — 이고, 이런 패는 뒤에 남은 사람이 적을 때 훨씬 편하게 플레이할 수 있습니다.
        </p>
        <p>
          위 도구에서 &ldquo;비교&rdquo;를 켜면 어떤 두 자리든 같은 방식으로 겹쳐 볼 수 있고, 한쪽
          목록에만 들어 있는 조합 수도 같이 세어 줍니다.
        </p>
      </ToolGuideSection>

      <ToolGuideSection
        id="walkthrough"
        title="패 하나로 따라가기"
        description={`${walk.key} 한 패를 여섯 자리에 놓아 보면 표를 읽는 순서가 몸에 남습니다.`}
        wide={
          <ToolRangeFigure
            rangeA={comparison.b.range}
            labelA={labelB}
            markKey={walk.key}
            label={`${labelB} 레인지 위에 ${walk.key} 칸을 표시한 13×13 표. ${walk.key}는 ${labelB} 목록에 ${walk.seats.find((seat) => seat.position === 'BTN')?.inRange === true ? '들어 있습니다' : '들어 있지 않습니다'}.`}
          />
        }
      >
        <PokerCards hand={walk.key} showReading />
        <ol>
          <li>
            <strong>칸 찾기.</strong> {walk.description} 두 장의 무늬가 다르므로 대각선 아래, A줄과
            9줄이 만나는 칸입니다. 이 칸 하나는 실제 조합 {walk.comboCount}가지(전체의{' '}
            {guidePercent(walk.universeShare)})를 뜻합니다.
          </li>
          <li>
            <strong>자리 고르기.</strong> 위 도구의 &ldquo;내 위치&rdquo;를 바꿔 가며 이 칸의 색이
            바뀌는지 봅니다. 지금 표의 목록에서는{' '}
            {openedFromLabels.length > 0 ? openedFromLabels.join(', ') : '어느 자리'}에서 칠해져
            있고, {notOpenedFrom.length > 0 ? notOpenedFrom.join(', ') : '나머지 자리'}에서는 비어
            있습니다.
          </li>
          <li>
            <strong>이유 읽기.</strong> 같은 패인데 자리마다 답이 다른 것은 패가 달라서가 아니라
            뒤에 남은 사람 수와 플랍 이후의 순서가 달라서입니다. 이것이 표를 통째로 외우기보다
            &ldquo;앞자리는 좁게, 뒷자리는 넓게&rdquo;를 먼저 익히라고 하는 이유입니다.
          </li>
        </ol>
        {walkOpenSeat !== undefined ? (
          <p>
            <a
              className="inline-flex min-h-11 items-center font-medium text-brand-500 underline underline-offset-4"
              href={localiseHref(
                buildRangeUrl({
                  heroPosition: walkOpenSeat,
                  spot: GUIDE_SPOT,
                  stackDepth: GUIDE_STACK_DEPTH,
                }),
              )}
            >
              {POSITION_LABEL[walkOpenSeat]} 표에서 {walk.key} 칸 직접 눌러보기
            </a>
          </p>
        ) : null}
      </ToolGuideSection>

      <ToolGuideSection
        id="supported"
        title="이 표가 다루는 조건"
        tone="recessed"
        description={supportedConditionLabel()}
      >
        <p>{RANGE_PROVENANCE_SENTENCE}</p>
        <ul>
          <li>
            <strong>{RANGE_LABEL}</strong>라는 이름 그대로, 처음 배우는 사람이 기준선으로 삼을 수
            있게 만든 목록입니다. 특정 상대나 특정 테이블에 맞춘 답이 아닙니다.
          </li>
          <li>
            <strong>First In</strong>은 내 앞에서 아무도 팟에 참여하지 않은 상황입니다. 앞 사람이
            레이즈한 뒤의 선택(콜, 3벳)은 이 표가 답하지 않습니다.
          </li>
          <li>
            표의 비율은 항상 {guideCount(COMBO_COUNT)}조합 기준입니다. 이미 보인 카드나 상대의 패는
            계산에 넣지 않습니다.
          </li>
        </ul>
      </ToolGuideSection>

      <ToolGuideSection
        id="unsupported"
        title="지원하지 않는 조건"
        tone="recessed"
        description="필터에 보이지만 데이터가 없는 조건은 표 대신 아래 이유를 보여줍니다."
      >
        <ul>
          {unsupported.map((condition) => (
            <li key={condition.label}>
              <strong>{condition.label}</strong> — {condition.reason}
            </li>
          ))}
        </ul>
        <p>
          지원하지 않는 조건을 고르면 위 도구는 빈 표를 보여주지 않고 &ldquo;지원하지 않음&rdquo;을
          그대로 말합니다. 가장 가까운 지원 조건으로 돌아가는 버튼이 같이 뜹니다.
        </p>
      </ToolGuideSection>
    </>
  );
}
