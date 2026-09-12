/**
 * `/tools/starting-hand` — the starting hand explorer as TOOL + COMPLETE GUIDE (WP-S3-14).
 * Hero → tool → `StartingHandGuide` (what the ranking is, the metric, strongest and weakest
 * five from the dataset, suited vs offsuit, combos per cell, limits) → FAQ → grouped links →
 * next tools. Every rank and equity is a `HAND_STRENGTH` entry read at render.
 */
import type { Metadata } from 'next';
import { pageMetadata } from '../../../../lib/seo/index.js';
import { StartingHandExplorer } from '../../../../components/StartingHandExplorer.js';
import { ToolCTA } from '../../../../components/ToolCTA.js';
import { StartingHandGuide } from '../../../../components/tools/StartingHandGuide.js';
import { ToolPageFooter } from '../../../../components/tools/ToolPageFooter.js';
import { ToolPageShell } from '../../../../components/tools/ToolPageShell.js';
import { STARTING_HAND_FAQ } from '../../../../features/tools/index.js';
import { RANGE_LABEL } from '../../../../features/range/index.js';
import { STRENGTH_METRIC_LABEL } from '../../../../features/strength/index.js';
import { routeById } from '../../../../lib/routes.js';

const ROUTE = routeById('toolStartingHand');

const SEO = {
  path: ROUTE.path,
  title: `시작 핸드 순위표 — 169개 패를 승률순으로 (${ROUTE.label})`,
  description:
    '169개 시작 패를 무작위 상대 기준 승률 순서로 살펴보고, 상위 몇 %까지 볼지 직접 슬라이더로 골라보세요. 순위를 매기는 숫자와 수티드·오프수트의 차이까지.',
} as const;

export const metadata: Metadata = pageMetadata({ ...SEO, index: true });

export default function StartingHandExplorerPage() {
  return (
    <ToolPageShell
      routeId="toolStartingHand"
      app={{ name: SEO.title, description: SEO.description }}
      hero={{
        eyebrow: '무료 도구',
        title: '169개 시작 패, 강한 순서로 보기',
        description: `${STRENGTH_METRIC_LABEL} 기준으로 169개 시작 패의 순서를 살펴보고, 슬라이더로 상위 몇 %까지 볼지 골라보세요.`,
      }}
      tool={<StartingHandExplorer />}
    >
      <StartingHandGuide />
      <ToolPageFooter
        routeId="toolStartingHand"
        faq={STARTING_HAND_FAQ}
        faqDescription="이 순위가 무엇을 뜻하고 무엇을 뜻하지 않는지에 대한 질문입니다."
        linksTitle="시작 패, 더 깊이"
        linksDescription="어떤 패가 왜 강한지, 페어·수티드·오프수트가 무엇인지 — 이 표를 읽다 막히는 곳들입니다."
      >
        <ToolCTA
          tool="toolEquity"
          title="특정 두 핸드가 맞붙으면 승률이 어떻게 될지 직접 계산해보세요"
          action="승률 계산기 열기"
        >
          <p>
            여기서는 무작위 상대를 기준으로 순위를 매겼지만, 승률 계산기에서는 원하는 두 핸드를 직접
            골라 정확한 승률을 계산할 수 있습니다.
          </p>
        </ToolCTA>
        <ToolCTA
          tool="range"
          title={`포지션별 ${RANGE_LABEL}에 어떤 패가 들어 있는지 궁금하다면`}
          action="핸드레인지 표 열기"
          className="mt-6"
        >
          <p>
            이 순위는 카드 자체의 기본 강도이고, {RANGE_LABEL}에 어떤 패가 들어 있는지는 포지션마다
            다릅니다.
          </p>
        </ToolCTA>
      </ToolPageFooter>
    </ToolPageShell>
  );
}
