/**
 * `/tools/equity` — the equity calculator as TOOL + COMPLETE GUIDE (WP-S3-14). Hero → tool →
 * `EquityGuide` (every percentage is `exactHeadsUpEquity` output read at render) → FAQ →
 * grouped onward links → next tool. See `ToolPageShell` for the shared top and
 * `ToolPageFooter` for the shared foot.
 *
 * `<title>` carries the search phrase (keyword map: 포커 승률 계산기 / 에퀴티); the `<h1>` and
 * the `WebApplication` name stay the tool's name from `src/lib/routes.ts`.
 */
import type { Metadata } from 'next';
import { pageMetadata } from '../../../../lib/seo/index.js';
import { EquityCalculator } from '../../../../components/EquityCalculator.js';
import { ToolCTA } from '../../../../components/ToolCTA.js';
import { EquityGuide } from '../../../../components/tools/EquityGuide.js';
import { ToolPageFooter } from '../../../../components/tools/ToolPageFooter.js';
import { ToolPageShell } from '../../../../components/tools/ToolPageShell.js';
import { EQUITY_FAQ } from '../../../../features/tools/index.js';
import { routeById } from '../../../../lib/routes.js';

const ROUTE = routeById('toolEquity');

const SEO = {
  path: ROUTE.path,
  title: '홀덤 승률·에퀴티 계산기 | 무료 포커 계산기',
  description:
    '내 핸드와 상대 핸드를 골라보세요. 보드를 더하거나 비워둔 채로, 지금 이 대결의 정확한 승률을 계산하는 무료 승률 계산기. 이김·비김·승률의 차이와 결과 읽는 법까지.',
} as const;

export const metadata: Metadata = pageMetadata({ ...SEO, index: true });

export default function EquityCalculatorPage() {
  return (
    <ToolPageShell
      routeId="toolEquity"
      app={{ name: SEO.title, description: SEO.description }}
      hero={{
        eyebrow: '무료 도구',
        title: ROUTE.label,
        description:
          '내 핸드와 상대 핸드를 골라보세요. 지금 이 대결에서 누가 얼마나 앞서 있는지 바로 알려드립니다.',
      }}
      tool={<EquityCalculator />}
    >
      <EquityGuide />
      <ToolPageFooter
        routeId="toolEquity"
        faq={EQUITY_FAQ}
        faqDescription="이 계산기가 무엇을 계산하고 무엇을 계산하지 않는지에 대한 질문입니다."
        linksTitle="승률, 더 깊이"
        linksDescription="이 계산기가 답하지 않는 것 — 왜 그 다섯 장이 이기는지, 보드가 왜 저 순서로 열리는지 — 은 이 글들이 설명합니다."
      >
        <ToolCTA
          tool="toolPotOdds"
          title="이 승률로 지금 콜해야 할지 궁금하다면"
          action="팟 오즈 계산기 열기"
        >
          <p>
            승률만으로는 콜이 이득인지 알 수 없습니다. 팟 오즈 계산기가 지금 콜에 필요한 최소 승률을
            보여주고, 방금 구한 숫자와 바로 비교할 수 있게 해줍니다.
          </p>
        </ToolCTA>
      </ToolPageFooter>
    </ToolPageShell>
  );
}
