/**
 * `OutsGuide` — the complete guide under the outs calculator (`/tools/outs`).
 *
 * Every probability is `outsOdds()` output and every "×2/×4" figure is the engine's own
 * `ruleOfTwoAndFour` (with its signed error) read through `features/tools/guide/outsGuide.ts`;
 * the "where the shortcut is off" sentence is written from the table's first and last rows,
 * so it describes the data on the page rather than a remembered rule of thumb.
 */
import {
  formatSignedPercentagePoints,
  guidePercent,
  outsTableRows,
  outsWalkthrough,
  overlappingDrawPreset,
  riverShortcutDirections,
  unseenCardsOn,
} from '../../features/tools/index.js';
import { DataTable } from '../DataTable.js';
import { KeyPoint } from '../KeyPoint.js';
import { OutsFigure } from '../OutsFigure.js';
import { StatStrip } from '../StatStrip.js';
import { TableOfContents, type TocHeading } from '../TableOfContents.js';
import { Term } from '../Term.js';
import { GUIDE_TOC_CLASS, ToolGuideSection } from './ToolGuideSection.js';

export const OUTS_GUIDE_HEADINGS: readonly TocHeading[] = [
  { id: 'what-is-an-out', text: '아웃이란?' },
  { id: 'unseen-cards', text: '47장과 46장' },
  { id: 'walkthrough', text: '플러시 드로우로 따라가기' },
  { id: 'rule-of-two-and-four', text: '×2 · ×4 규칙과 정확한 값' },
  { id: 'overlapping-draws', text: '두 드로우가 겹칠 때' },
  { id: 'limitations', text: '이 계산기가 하지 않는 것' },
];

const DIRECTION_WORD = { OVER: '높게', UNDER: '낮게', SAME: '같게' } as const;

export function OutsGuide() {
  const rows = outsTableRows('FLOP');
  const walk = outsWalkthrough();
  const overlap = overlappingDrawPreset();
  const { first, last } = riverShortcutDirections('FLOP');
  const flopUnseen = unseenCardsOn('FLOP');
  const turnUnseen = unseenCardsOn('TURN');

  return (
    <>
      <ToolGuideSection
        id="what-is-an-out"
        title="아웃이란?"
        divider="top"
        description="아직 안 나온 카드 중에서, 나오면 내 패가 완성되는 카드의 수."
      >
        <TableOfContents headings={OUTS_GUIDE_HEADINGS} className={GUIDE_TOC_CLASS} />
        <p>
          <Term id="term-outs">아웃</Term>은 <Term id="term-draw">드로우</Term>를 완성시켜 주는
          카드의 개수입니다. 예를 들어 같은 무늬가 네 장이면 <Term id="term-flush">플러시</Term>까지
          한 장이 모자라고, 그 무늬의 남은 카드 13 − 4 = 9장이 아웃입니다. 양쪽이 열린{' '}
          <Term id="term-straight">스트레이트</Term> 드로우는 위아래 각 4장씩 8장입니다. 위 계산기의
          &ldquo;상황 고르기&rdquo;는 이런 흔한 드로우의 아웃 수를 대신 세어 넣어 줍니다.
        </p>
      </ToolGuideSection>

      <ToolGuideSection
        id="unseen-cards"
        title={`${flopUnseen}장과 ${turnUnseen}장`}
        description="확률의 분모는 52장이 아니라 내가 아직 보지 못한 카드 수입니다."
        wide={<OutsFigure outs={walk.preset.outs} street="FLOP" />}
      >
        <p>
          플랍에서는 내 손 2장과 보드 3장, 합쳐 5장을 봤으므로 남은 카드는 {flopUnseen}장입니다.{' '}
          <Term id="term-turn">턴</Term>이 열리면 {turnUnseen}장입니다. 상대의 손에 든 카드도
          &ldquo;못 본 카드&rdquo;에 그대로 포함됩니다 — 어디 있든 내가 모르기는 마찬가지이기
          때문입니다. 아래 그림은 플랍의 {flopUnseen}장 중 아웃 {walk.preset.outs}장을 칠한
          것입니다.
        </p>
      </ToolGuideSection>

      <ToolGuideSection
        id="walkthrough"
        title="플러시 드로우로 따라가기"
        description={`${walk.preset.label} — ${walk.preset.derivation}`}
      >
        <StatStrip
          aria-label="플러시 드로우의 정확한 확률"
          variant="rules"
          items={[
            {
              label: `플랍에서 다음 한 장 (${walk.flop.unseenCards}장 중 ${walk.flop.outs}장)`,
              value: guidePercent(walk.flop.nextCardProb),
            },
            {
              label: '플랍에서 남은 두 장을 모두 볼 때',
              value: guidePercent(walk.flop.byRiverProb),
            },
            {
              label: `턴에서 마지막 한 장 (${walk.turn.unseenCards}장 중 ${walk.turn.outs}장)`,
              value: guidePercent(walk.turn.nextCardProb),
            },
          ]}
        />
        <ol>
          <li>
            다음 한 장이 아웃일 확률은 {walk.flop.outs} ÷ {walk.flop.unseenCards} ={' '}
            {guidePercent(walk.flop.nextCardProb)}입니다.
          </li>
          <li>
            턴과 리버를 모두 볼 수 있다면 &ldquo;턴에서 맞거나, 턴에서 빗나가고 리버에서
            맞거나&rdquo;를 더합니다. 빗나간 뒤 맞을 확률이{' '}
            {guidePercent(walk.flop.missThenHitProb)}이므로 합쳐서{' '}
            {guidePercent(walk.flop.byRiverProb)}입니다.
          </li>
          <li>
            턴이 열리고 나면 남은 카드는 {walk.turn.unseenCards}장, 마지막 한 장이 아웃일 확률은{' '}
            {guidePercent(walk.turn.nextCardProb)}입니다.
          </li>
        </ol>
      </ToolGuideSection>

      <ToolGuideSection
        id="rule-of-two-and-four"
        title="×2 · ×4 규칙과 정확한 값"
        description="암산용 어림은 아웃 수에 2나 4를 곱합니다. 표는 어림이 정확한 값에서 얼마나 벗어나는지 보여줍니다."
        wide={
          <DataTable
            caption={`플랍 기준 — 아웃 수별 정확한 확률과 ×2 · ×4 어림, 그리고 어림의 오차(%p)`}
            rowHeader="아웃"
            columns={[
              { key: 'outs', label: '아웃', numeric: true },
              { key: 'name', label: '흔한 드로우' },
              { key: 'next', label: '다음 한 장 (정확)', numeric: true, highlight: true },
              { key: 'x2', label: '×2 어림', numeric: true },
              { key: 'x2err', label: '오차', numeric: true },
              { key: 'river', label: '리버까지 (정확)', numeric: true, highlight: true },
              { key: 'x4', label: '×4 어림', numeric: true },
              { key: 'x4err', label: '오차', numeric: true },
            ]}
            rows={rows.map((row) => {
              const next = row.comparisons.find((c) => c.id === 'NEXT_CARD');
              const river = row.comparisons.find((c) => c.id === 'BY_RIVER');
              return {
                key: String(row.outs),
                cells: {
                  outs: row.outs,
                  name:
                    row.preset === undefined ? (
                      <span className="text-text-300">—</span>
                    ) : (
                      `${row.preset.label} (${row.preset.outs}장)`
                    ),
                  next: guidePercent(row.odds.nextCardProb),
                  x2: next === undefined ? '—' : guidePercent(next.shortcutProb),
                  x2err: next === undefined ? '—' : formatSignedPercentagePoints(next.error, 2),
                  river: guidePercent(row.odds.byRiverProb),
                  x4: river === undefined ? '—' : guidePercent(river.shortcutProb),
                  x4err: river === undefined ? '—' : formatSignedPercentagePoints(river.error, 2),
                },
              };
            })}
          />
        }
      >
        <KeyPoint title="어림 규칙">
          <p>
            플랍에서 남은 두 장을 모두 본다면 아웃 × 4, 한 장만 본다면(턴에서, 또는 플랍에서 다음 한
            장만) 아웃 × 2. 결과는 퍼센트입니다.
          </p>
        </KeyPoint>
        <p>
          ×4 어림은 아웃 {rows[0]?.outs}개에서 실제보다 {DIRECTION_WORD[first.direction]} (
          {formatSignedPercentagePoints(first.error, 2)}), 아웃 {rows[rows.length - 1]?.outs}
          개에서는 실제보다 {DIRECTION_WORD[last.direction]} (
          {formatSignedPercentagePoints(last.error, 2)}) 잡습니다. 아웃이 많아질수록 &ldquo;두 장 다
          맞는 경우&rdquo;를 두 번 세는 셈이라 어림이 부풀기 때문이며, 위 계산기는 어림과 정확한
          값을 항상 나란히 보여줍니다. ×2와 ×4는 외우기 위한 규칙이고, 결정은 정확한 값으로 하세요.
        </p>
      </ToolGuideSection>

      <ToolGuideSection
        id="overlapping-draws"
        title="두 드로우가 겹칠 때"
        description="플러시 드로우와 스트레이트 드로우를 같이 들고 있으면 아웃을 그냥 더하면 안 됩니다."
      >
        <p>
          <strong>
            {overlap.label} = {overlap.outs}장
          </strong>
          : {overlap.derivation} 두 드로우를 동시에 완성시키는 카드는 한 번만 세야 하므로, 9 + 8 =
          17이 아니라 {overlap.outs}개입니다. 위 계산기의 상황 목록에 이 경우가 그대로 들어
          있습니다.
        </p>
      </ToolGuideSection>

      <ToolGuideSection id="limitations" title="이 계산기가 하지 않는 것" tone="recessed">
        <ul>
          <li>
            <strong>아웃이 &ldquo;깨끗하다&rdquo;고 가정합니다.</strong> 플러시를 완성시키는 카드가
            동시에 상대에게 풀하우스를 만들어 줄 수 있다는 것은 계산에 없습니다. 그런 카드는
            아웃에서 스스로 빼야 합니다.
          </li>
          <li>
            <strong>상대의 패는 모릅니다.</strong> 상대가 내 아웃 중 몇 장을 들고 있는지는 계산에
            넣지 않으며, 못 본 카드 {flopUnseen}장에는 상대의 손패도 포함됩니다.
          </li>
          <li>
            <strong>완성 확률만 구합니다.</strong> 완성해도 질 수 있고, 완성하지 않아도 이길 수
            있습니다. 정확한 승률은 상대 패를 알 때 승률 계산기가 구합니다.
          </li>
          <li>
            <strong>{`아웃은 1개부터 ${flopUnseen}장을 넘지 않는 범위까지`}</strong> — 그 밖의
            개수는 지원하지 않음.
          </li>
        </ul>
      </ToolGuideSection>
    </>
  );
}
