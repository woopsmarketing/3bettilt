/**
 * `/tools/outs` — the outs calculator as TOOL + COMPLETE GUIDE (WP-S3-14). Hero → tool →
 * `OutsGuide` (what an out is, the 47/46 unseen cards, a flush-draw walkthrough, the ×2/×4
 * shortcut against the exact table, overlapping draws, limits) → FAQ → grouped links → next
 * tool. Every probability is `outsOdds()` output read at render.
 */
import type { Metadata } from 'next';
import { pageMetadata } from '../../../../lib/seo/index.js';
import { OutsCalculator } from '../../../../components/OutsCalculator.js';
import { ToolCTA } from '../../../../components/ToolCTA.js';
import { OutsGuide } from '../../../../components/tools/OutsGuide.js';
import { ToolPageFooter } from '../../../../components/tools/ToolPageFooter.js';
import { ToolPageShell } from '../../../../components/tools/ToolPageShell.js';
import { OUTS_FAQ } from '../../../../features/tools/index.js';
import { routeById } from '../../../../lib/routes.js';

const ROUTE = routeById('toolOuts');

const SEO = {
  path: ROUTE.path,
  title: `아웃츠 계산기 — 드로우 완성 확률과 ×2 · ×4 규칙`,
  description:
    '드로우가 완성될 확률을 정확하게 계산합니다. 흔히 쓰는 ×2 / ×4 암산 규칙과 실제 확률의 차이, 47장과 46장의 뜻, 겹치는 드로우 세는 법까지 함께 보여주는 무료 아웃 계산기.',
} as const;

export const metadata: Metadata = pageMetadata({ ...SEO, index: true });

export default function OutsPage() {
  return (
    <ToolPageShell
      routeId="toolOuts"
      app={{ name: SEO.title, description: SEO.description }}
      hero={{
        eyebrow: '무료 도구',
        title: ROUTE.label,
        description:
          '드로우가 완성될 확률을 정확하게 계산합니다. 자주 쓰는 암산 규칙이 실제와 얼마나 다른지도 함께 보여줍니다.',
      }}
      tool={<OutsCalculator />}
    >
      <OutsGuide />
      <ToolPageFooter
        routeId="toolOuts"
        faq={OUTS_FAQ}
        faqDescription="이 계산기가 무엇을 계산하고 무엇을 계산하지 않는지에 대한 질문입니다."
        linksTitle="아웃과 드로우, 더 깊이"
        linksDescription="어떤 카드가 아웃인지 세는 눈은 족보와 드로우를 알아야 생깁니다 — 이 글들이 그 부분을 맡습니다."
      >
        <ToolCTA
          tool="toolPotOdds"
          title="이 확률이면 콜해도 되는 가격일까요?"
          action="팟 오즈 계산기 열기"
        >
          <p>
            확률을 알았다면, 다음은 가격입니다. 팟 오즈 계산기가 이 콜이 본전이 되려면 몇 퍼센트를
            이겨야 하는지 계산해줍니다.
          </p>
        </ToolCTA>
      </ToolPageFooter>
    </ToolPageShell>
  );
}
