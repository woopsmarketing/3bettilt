/**
 * `StartingHandGuide` — the complete guide under the starting hand explorer
 * (`/tools/starting-hand`).
 *
 * Every rank and equity is a `HAND_STRENGTH` entry read through
 * `features/tools/guide/startingHandGuide.ts`; combo counts come from `strategy-core`'s
 * class metadata via `MATRIX_KIND_ROWS`. The metric is the dataset's own (`STRENGTH_METRIC_LABEL`)
 * and the caveats are the strength facade's sentences, so the guide cannot describe the
 * number differently from the tool above it.
 */
import { COMBO_COUNT, HAND_CLASS_COUNT } from '@gto-self/strategy-core';
import { STRENGTH_METRIC_LABEL } from '../../features/strength/index.js';
import {
  guideCount,
  guidePercent,
  MATRIX_KIND_ROWS,
  strongestRows,
  suitedVersusOffsuit,
  weakestRows,
} from '../../features/tools/index.js';
import { DataTable } from '../DataTable.js';
import { KeyPoint } from '../KeyPoint.js';
import { StatStrip } from '../StatStrip.js';
import { TableOfContents, type TocHeading } from '../TableOfContents.js';
import { Term } from '../Term.js';
import { GUIDE_TOC_CLASS, ToolGuideSection } from './ToolGuideSection.js';

export const STARTING_HAND_GUIDE_HEADINGS: readonly TocHeading[] = [
  { id: 'what-is-the-ranking', text: '시작 핸드 순위란?' },
  { id: 'the-metric', text: '순위를 매기는 숫자' },
  { id: 'top-and-bottom', text: '가장 강한 다섯, 가장 약한 다섯' },
  { id: 'suited-vs-offsuit', text: '수티드와 오프수트' },
  { id: 'combos', text: '칸 하나가 몇 가지 조합인가' },
  { id: 'limitations', text: '이 순위가 말하지 않는 것' },
];

function strengthTable(caption: string, rows: ReturnType<typeof strongestRows>) {
  return (
    <DataTable
      caption={caption}
      rowHeader="패"
      columns={[
        { key: 'rank', label: '순위', numeric: true },
        { key: 'key', label: '패' },
        { key: 'reading', label: '읽는 법' },
        { key: 'equity', label: STRENGTH_METRIC_LABEL, numeric: true, highlight: true },
      ]}
      rows={rows.map((row) => ({
        key: row.entry.key,
        cells: {
          rank: row.entry.rank,
          key: <span className="font-mono">{row.entry.key}</span>,
          reading: row.reading,
          equity: guidePercent(row.entry.equity),
        },
      }))}
    />
  );
}

export function StartingHandGuide() {
  const strongest = strongestRows(5);
  const weakest = weakestRows(5);
  const pair = suitedVersusOffsuit();
  const kinds = MATRIX_KIND_ROWS;

  return (
    <>
      <ToolGuideSection
        id="what-is-the-ranking"
        title="시작 핸드 순위란?"
        divider="top"
        description={`${HAND_CLASS_COUNT}가지 시작 패를 하나의 숫자로 줄 세운 것.`}
      >
        <TableOfContents headings={STARTING_HAND_GUIDE_HEADINGS} className={GUIDE_TOC_CLASS} />
        <p>
          홀덤의 시작 패는 실제 카드로는 {guideCount(COMBO_COUNT)}가지이지만, 무늬의 이름을 지우고
          &ldquo;페어 · 수티드 · 오프수트&rdquo;만 남기면 {HAND_CLASS_COUNT}가지로 줄어듭니다. 위
          도구는 그 {HAND_CLASS_COUNT}가지를 강한 순서로 늘어놓고, 상위 몇 %까지 볼지 고르면 13×13
          표에 그 패들만 칠해 줍니다.
        </p>
      </ToolGuideSection>

      <ToolGuideSection
        id="the-metric"
        title="순위를 매기는 숫자"
        description={STRENGTH_METRIC_LABEL}
      >
        <p>
          상대가 아무 두 장이나 들고 있다고 가정하고, 프리플랍에서 올인해 남은 다섯 장을 전부 열었을
          때 내가 팟에서 가져갈 것으로 기대되는 몫 — 이 숫자 하나로 {HAND_CLASS_COUNT}개 패를 줄
          세웁니다. 어림값이 아니라 가능한 모든 상대 패와 보드를 센 정확한 값이므로, 순위에 오차
          범위가 없습니다.
        </p>
        <KeyPoint>
          <p>
            &ldquo;무작위 한 패를 상대로, 남은 다섯 장을 전부 열었을 때의 팟 몫&rdquo; — 이것이
            여기서 말하는 <Term id="term-equity">승률</Term>입니다. 상대가 아무 패나 들고 끝까지
            간다는 가정이므로, 실제 테이블의 승률과는 다릅니다.
          </p>
        </KeyPoint>
        <p>
          이 숫자는 &ldquo;어떻게 플레이하라&rdquo;가 아니라 &ldquo;카드 자체가 얼마나
          강한가&rdquo;입니다. 자리별로 학습용 기본 레인지가 어떤 패를 칠하는지는 다른 질문이고, 그
          답은 핸드레인지 표에 있습니다.
        </p>
      </ToolGuideSection>

      <ToolGuideSection
        id="top-and-bottom"
        title="가장 강한 다섯, 가장 약한 다섯"
        description="큰 페어가 맨 위, 서로 멀고 무늬도 다른 작은 카드가 맨 아래입니다."
        wide={
          <div className="grid gap-6 lg:grid-cols-2">
            {strengthTable('가장 강한 다섯 패', strongest)}
            {strengthTable('가장 약한 다섯 패', weakest)}
          </div>
        }
      >
        <p>
          맨 위는 <Term id="term-pocket-pair">포켓 페어</Term>가 차지합니다 — 이미 원페어로 시작하는
          데다 셋을 만들 수도 있기 때문입니다. 맨 아래는 낮고, 붙어 있지 않고, 무늬도 다른 두 장:
          페어도 스트레이트도 플러시도 만들기 어렵습니다. 그 사이의 순서를 위 도구에서 상위 비율을
          바꿔 가며 확인해보세요.
        </p>
      </ToolGuideSection>

      <ToolGuideSection
        id="suited-vs-offsuit"
        title="수티드와 오프수트"
        description="같은 두 숫자라도 무늬가 같으면 순위가 올라갑니다. 얼마나 올라가는지 재 봅니다."
      >
        <StatStrip
          aria-label={`${pair.suited.entry.key}와 ${pair.offsuit.entry.key} 비교`}
          variant="rules"
          items={[
            {
              label: `${pair.suited.entry.key} (${pair.suited.reading})`,
              value: guidePercent(pair.suited.entry.equity),
              note: `${HAND_CLASS_COUNT}개 중 ${pair.suited.entry.rank}위`,
            },
            {
              label: `${pair.offsuit.entry.key} (${pair.offsuit.reading})`,
              value: guidePercent(pair.offsuit.entry.equity),
              note: `${HAND_CLASS_COUNT}개 중 ${pair.offsuit.entry.rank}위`,
            },
            {
              label: '차이',
              value: `${(pair.equityGap * 100).toFixed(2)}%p`,
              note: '플러시 가능성만큼',
            },
          ]}
        />
        <p>
          <Term id="term-suited">수티드</Term>가 <Term id="term-offsuit">오프수트</Term>보다 앞서는
          이유는 플러시 하나뿐이고, 그래서 차이도 몇 %p에 그칩니다. 무늬가 같다고 약한 패가 강한
          패로 바뀌지는 않습니다 — 순위가 몇 계단 오르는 정도입니다.
        </p>
      </ToolGuideSection>

      <ToolGuideSection
        id="combos"
        title="칸 하나가 몇 가지 조합인가"
        description="상위 몇 %를 고를 때, 표의 칸 수와 실제 조합 수가 다르게 늘어나는 이유."
        wide={
          <DataTable
            caption={`13×13 표의 세 영역 — 칸 수와 실제 조합 수 (합계 ${HAND_CLASS_COUNT}칸 · ${guideCount(COMBO_COUNT)}조합)`}
            rowHeader="종류"
            columns={[
              { key: 'kind', label: '종류' },
              { key: 'position', label: '표에서의 위치' },
              { key: 'classes', label: '칸 수', numeric: true },
              { key: 'perClass', label: '칸 하나당 조합', numeric: true },
              { key: 'total', label: '조합 합계', numeric: true, highlight: true },
            ]}
            rows={kinds.map((row) => ({
              key: row.kind,
              cells: {
                kind: row.label,
                position: row.position,
                classes: row.classCount,
                perClass: row.combosPerClass,
                total: guideCount(row.comboTotal),
              },
            }))}
          />
        }
      >
        <p>
          위 도구의 &ldquo;상위 n%&rdquo;는 {guideCount(COMBO_COUNT)}가지{' '}
          <Term id="term-combo">조합</Term> 기준입니다. 오프수트 칸 하나는 수티드 칸 하나의 세
          배이므로, 오프수트 칸이 몇 개만 들어와도 비율이 눈에 띄게 뜁니다. 칸 수와 조합 수를 따로
          보여주는 이유입니다.
        </p>
      </ToolGuideSection>

      <ToolGuideSection id="limitations" title="이 순위가 말하지 않는 것" tone="recessed">
        <ul>
          <li>
            <strong>실전에서 다루기 쉬운 순서가 아닙니다.</strong> 올인해서 끝까지 본다는 가정이라,
            플랍 이후에 그 패로 무엇을 하게 되는지는 계산에 없습니다. 순위가 높다고 플레이하기 쉬운
            패라는 뜻은 아닙니다.
          </li>
          <li>
            <strong>레인지가 아닙니다.</strong> 상위 몇 %를 칠한 표는 &ldquo;강한 순서로
            이만큼&rdquo;일 뿐, 어느 자리에서 어떤 패를 여는지 정한 목록이 아닙니다.
          </li>
          <li>
            <strong>자리와 상대는 계산에 없습니다.</strong> 같은 패라도 어느 자리에서, 몇 명을
            상대로 플레이하는지에 따라 값어치가 달라집니다 — 그 부분은{' '}
            <Term id="term-hand-matrix">핸드 매트릭스</Term> 위에 자리별 목록을 칠한 핸드레인지 표가
            답합니다.
          </li>
        </ul>
      </ToolGuideSection>
    </>
  );
}
