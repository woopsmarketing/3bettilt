/**
 * `/tools/hand-checker` — the hand checker as TOOL + COMPLETE GUIDE (WP-S3-14). Hero → tool →
 * `HandCheckerGuide` (best five of seven, the nine categories with their frequencies, the
 * board playing, kicker and tie showdowns judged by `compareHands`) → FAQ → grouped links →
 * next tool.
 */
import type { Metadata } from 'next';
import { pageMetadata } from '../../../../lib/seo/index.js';
import { HandChecker } from '../../../../components/HandChecker.js';
import { ToolCTA } from '../../../../components/ToolCTA.js';
import { HandCheckerGuide } from '../../../../components/tools/HandCheckerGuide.js';
import { ToolPageFooter } from '../../../../components/tools/ToolPageFooter.js';
import { ToolPageShell } from '../../../../components/tools/ToolPageShell.js';
import { HAND_CHECKER_FAQ } from '../../../../features/tools/index.js';
import { routeById } from '../../../../lib/routes.js';

const ROUTE = routeById('toolHandChecker');

const SEO = {
  path: ROUTE.path,
  title: `포커 족보 확인기 (${ROUTE.label}) — 내 패 족보 판정`,
  description:
    '핸드 카드와 보드 카드를 골라보세요. 지금 만들어진 족보가 무엇인지, 어떤 다섯 장으로 만들어졌는지 바로 보여주는 무료 핸드 체커. 키커와 비기는 경우까지 예시로.',
} as const;

export const metadata: Metadata = pageMetadata({ ...SEO, index: true });

export default function HandCheckerPage() {
  return (
    <ToolPageShell
      routeId="toolHandChecker"
      app={{ name: SEO.title, description: SEO.description }}
      hero={{
        eyebrow: '무료 도구',
        title: ROUTE.label,
        description:
          '핸드 카드와 보드 카드를 골라보세요. 지금 만들어진 족보가 무엇인지 바로 알려드립니다.',
      }}
      tool={<HandChecker />}
    >
      <HandCheckerGuide />
      <ToolPageFooter
        routeId="toolHandChecker"
        faq={HAND_CHECKER_FAQ}
        faqDescription="이 도구가 무엇을 판정하고 무엇을 판정하지 않는지에 대한 질문입니다."
        linksTitle="족보, 더 깊이"
        linksDescription="아홉 족보의 순서, 키커, 보드가 그대로 최고 패인 경우 — 이 도구 옆에 두고 읽을 글들입니다."
      >
        <ToolCTA
          tool="toolOuts"
          title="아직 카드가 다 나오지 않았다면, 완성될 확률도 확인해보세요"
          action="아웃 계산기 열기"
        >
          <p>
            지금 패가 마음에 들지 않아도 드로우가 남아 있을 수 있습니다. 아웃 계산기가 그 드로우가
            완성될 정확한 확률을 보여줍니다.
          </p>
        </ToolCTA>
      </ToolPageFooter>
    </ToolPageShell>
  );
}
