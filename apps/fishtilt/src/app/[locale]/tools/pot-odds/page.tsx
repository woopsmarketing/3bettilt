/**
 * `/tools/pot-odds` — the pot odds calculator as TOOL + COMPLETE GUIDE (WP-S3-14). Hero →
 * tool → `PotOddsGuide` (formula, a worked example from `potOdds()`, the price beside a
 * draw's exact probability, the usual confusions) → FAQ → grouped links → next tool.
 */
import type { Metadata } from 'next';
import { pageMetadata } from '../../../../lib/seo/index.js';
import { PotOddsCalculator } from '../../../../components/PotOddsCalculator.js';
import { ToolCTA } from '../../../../components/ToolCTA.js';
import { PotOddsGuide } from '../../../../components/tools/PotOddsGuide.js';
import { ToolPageFooter } from '../../../../components/tools/ToolPageFooter.js';
import { ToolPageShell } from '../../../../components/tools/ToolPageShell.js';
import { POT_ODDS_FAQ } from '../../../../features/tools/index.js';
import { routeById } from '../../../../lib/routes.js';

const ROUTE = routeById('toolPotOdds');

const SEO = {
  path: ROUTE.path,
  title: `${ROUTE.label} — 콜에 필요한 승률 바로 계산`,
  description:
    '콜하려면 몇 퍼센트는 이겨야 하는지 바로 계산합니다. 공식, 계산 과정, 베팅 크기별 필요 승률과 자주 헷갈리는 점까지 함께 보여주는 무료 팟 오즈 계산기.',
} as const;

export const metadata: Metadata = pageMetadata({ ...SEO, index: true });

export default function PotOddsPage() {
  return (
    <ToolPageShell
      routeId="toolPotOdds"
      app={{ name: SEO.title, description: SEO.description }}
      hero={{
        eyebrow: '무료 도구',
        title: ROUTE.label,
        description:
          '콜할지 폴드할지 고민될 때, 먼저 가격부터 확인해보세요. 몇 퍼센트를 이겨야 본전인지 알려줍니다.',
      }}
      tool={<PotOddsCalculator />}
    >
      <PotOddsGuide />
      <ToolPageFooter
        routeId="toolPotOdds"
        faq={POT_ODDS_FAQ}
        faqDescription="이 계산기가 무엇을 계산하고 무엇을 계산하지 않는지에 대한 질문입니다."
        linksTitle="팟 오즈, 더 깊이"
        linksDescription="공식 뒤의 생각 — 왜 콜에 가격이 있는지, 팟과 베팅이 무엇인지 — 은 이 글들이 설명합니다."
      >
        <ToolCTA
          tool="toolOuts"
          title="내 드로우가 실제로 얼마나 자주 완성되는지 세어볼까요?"
          action="아웃 계산기 열기"
        >
          <p>
            필요 승률을 알았다면, 다음은 내 패가 그만큼 자주 완성되는지입니다. 아웃 계산기가 정확한
            확률과 ×2 / ×4 암산 규칙을 나란히 보여줍니다.
          </p>
        </ToolCTA>
      </ToolPageFooter>
    </ToolPageShell>
  );
}
