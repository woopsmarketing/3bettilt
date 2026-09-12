/**
 * `HandRfiSeats` — which seats' first-in range includes this hand, drawn on the 6-max
 * diagram and stated in a sentence (WP-S3-13a, contract AY "supported range inclusion").
 *
 * What it claims, and only that: under the ONE shipped condition (6-max · 100BB · nobody
 * has entered the pot) the learning baseline range for each highlighted seat contains this
 * class. The range is a learning baseline, never called GTO (rule 4 of the Stage 3 common
 * rules). Any other situation — facing a raise, other stack depths, other table sizes — is
 * not shipped, and this component says so as "지원하지 않음" rather than leaving the reader
 * to assume the diagram covers it.
 *
 * The seat list is `rfiSeatsWith` (the same `resolveRange` call `facts.ts` makes); the
 * sentence uses `<Fact name="RFI_POSITIONS_WITH">` so it reads identically to every other
 * place the fact appears. BB is drawn but never highlighted: nobody opens first-in from the
 * big blind, and the diagram's accessible name lists only the highlighted seats.
 */
import type { HandClass } from '@gto-self/strategy-core';
import { Fact } from '../Fact.js';
import { PositionDiagram } from '../PositionDiagram.js';
import { rfiSeatsWith, SUPPORTED_RANGE_CONDITION } from './handGraph.js';

export interface HandRfiSeatsProps {
  readonly handClass: HandClass;
  readonly className?: string;
}

export function HandRfiSeats({ handClass, className = '' }: HandRfiSeatsProps) {
  const seats = rfiSeatsWith(handClass);
  const { key } = handClass;
  return (
    <div data-rfi-seats={seats.join(' ') || 'none'} className={className}>
      <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
        <div>
          <p className="prose-ko text-prose text-text-100/90">
            {SUPPORTED_RANGE_CONDITION} 기준, 학습용 기본 레인지에서{' '}
            <span className="font-mono font-semibold">{key}</span>
            {seats.length === 0 ? (
              <>
                가 처음 레이즈에 쓰이는 자리는 <Fact name="RFI_POSITIONS_WITH" arg={key} />.
              </>
            ) : (
              <>
                가 처음 레이즈에 쓰이는 자리는 <Fact name="RFI_POSITIONS_WITH" arg={key} />
                입니다 — 이 사이트가 다루는 다섯 자리 중 {seats.length}곳입니다.
              </>
            )}
          </p>
          <dl className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            <dt className="text-text-300">지원하는 상황</dt>
            <dd className="text-text-100">
              6인 테이블 · 100BB · 처음 레이즈(First In)
              <span className="ml-2 inline-block rounded-full border border-line-500 px-1.5 py-0.5 align-middle text-[10px] font-medium text-text-300">
                학습용 기본 레인지
              </span>
            </dd>
            <dt className="text-text-300">지원하지 않음</dt>
            <dd className="text-text-100/90">
              누가 먼저 레이즈한 뒤(콜·3벳), 다른 스택 깊이, 다른 인원. 이 페이지는 그 상황을 말하지
              않습니다.
            </dd>
          </dl>
        </div>
        <PositionDiagram
          className="max-w-figure justify-self-center sm:justify-self-end"
          highlight={seats}
          caption={
            seats.length === 0
              ? `${key}는 어느 자리의 첫 레이즈 범위에도 없습니다.`
              : `칠해진 자리의 첫 레이즈 범위에 ${key}가 들어 있습니다.`
          }
        />
      </div>
    </div>
  );
}
