/**
 * `/tools/range` — the Range Explorer, 3BetTilt's flagship tool, as TOOL + COMPLETE GUIDE
 * (WP-S3-14, contracts BA/BB). This file stays a plain Server Component — no `searchParams`,
 * no dynamic rendering — so the page keeps the site's static, publicly-cacheable shape. The
 * one interactive island is `RangeExplorer` (`'use client'`); it reads and writes the
 * `?hero=&spot=&stack=` query itself after hydration.
 *
 * PAGE SHAPE (all six tools): breadcrumbs → short hero → the tool → guide bands (reading
 * measure, tables/figures at breakout) → FAQ → grouped onward links → next tool. The guide is
 * `RangeGuide`; every number in it is read from `strategy-core` and the range facade at render
 * time, never typed (CLAUDE.md rules 2 and 5; AGENT_COMMON_RULES §3–4).
 *
 * `<title>` carries the search phrase (Stage 3 keyword map: "핸드레인지 표 · 포지션별 오픈
 * 레인지 · 6-max 100BB") while the `<h1>` stays the tool's NAME the rest of the site uses
 * (`13×13 핸드레인지 표`); the `WebApplication` block is named for the `<title>` (`toolPageJsonLd.test.tsx` pins that pair).
 */
import type { Metadata } from 'next';
import { pageMetadata } from '../../../../lib/seo/index.js';
import { RangeExplorer } from '../../../../components/RangeExplorer.js';
import { ToolCTA } from '../../../../components/ToolCTA.js';
import { RangeGuide } from '../../../../components/tools/RangeGuide.js';
import { ToolPageFooter } from '../../../../components/tools/ToolPageFooter.js';
import { ToolPageShell } from '../../../../components/tools/ToolPageShell.js';
import { RANGE_FAQ } from '../../../../features/tools/index.js';
import { RANGE_LABEL } from '../../../../features/range/index.js';
import { routeById } from '../../../../lib/routes.js';

const H1 = '13×13 핸드레인지 표';

const SEO = {
  path: routeById('range').path,
  title: `${H1} — 포지션별 오픈 레인지 (6-max · 100BB)`,
  description:
    '포지션별로 어떤 시작 패로 레이즈하는지 13×13 표로 직접 눌러보고 두 위치를 비교하세요. 표 읽는 법, 자리별 크기, UTG와 BTN 비교까지 한 페이지에.',
} as const;

export const metadata: Metadata = pageMetadata({ ...SEO, index: true });

export default function RangeExplorerPage() {
  return (
    <ToolPageShell
      routeId="range"
      toolWidth="matrix"
      app={{ name: SEO.title, description: SEO.description }}
      hero={{
        eyebrow: '핸드레인지',
        title: H1,
        description:
          '자리를 고르면 그 자리에서 레이즈하는 시작 패가 표에 칠해집니다. 두 자리를 겹쳐 비교할 수도 있습니다.',
      }}
      tool={<RangeExplorer />}
    >
      <RangeGuide />
      <ToolPageFooter
        routeId="range"
        faq={RANGE_FAQ}
        faqDescription="이 표가 무엇을 보여주고 무엇을 보여주지 않는지에 대한 질문입니다."
        linksTitle="핸드레인지, 더 깊이"
        linksDescription="표 자체를 읽는 법, 자리 이름, 그리고 레인지라는 말의 뜻 — 이 표를 보다 막히는 곳들입니다."
      >
        <ToolCTA
          tool="toolStartingHand"
          title="이 표에 어떤 패가 왜 들어 있는지 궁금하다면"
          action="시작 핸드 탐색기 열기"
        >
          <p>
            {RANGE_LABEL}는 자리마다 다르지만, 시작 패 자체의 강도 순서는 자리와 상관이 없습니다.
            같은 모양의 표에서 시작 패를 강한 순서로 살펴보고, 상위 몇 퍼센트까지 볼지 직접 골라볼
            수 있습니다.
          </p>
        </ToolCTA>
      </ToolPageFooter>
    </ToolPageShell>
  );
}
