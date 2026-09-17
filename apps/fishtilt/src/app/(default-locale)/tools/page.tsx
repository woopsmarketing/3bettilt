/**
 * `/tools` — the tools hub (WP-S3-14, D-S3-17 "no card walls").
 *
 * One featured tool and two short lists, not six identical cards. The hub leads with the
 * QUESTION each tool answers (`TOOL_QUESTION`) because that is what a visitor arrives with;
 * the tool's name and its one-line description follow. The featured slot is the flagship
 * (`FEATURED_TOOL_ID`), drawn with a static 13x13 picture of one shipped list — a server
 * component, no client JavaScript — and the rest are grouped as `TOOL_HUB_GROUPS` says.
 *
 * CONTRACTS KEPT (page.test.tsx, tools-hub.spec.ts): every tool the registry knows is listed
 * as a `listitem` inside the region "지금 사용할 수 있는 도구" (or "준비 중인 도구" when the
 * registry says it is not built), each built tool is exactly one link at its registry path,
 * its label and description are visible, and the lessons region pairs each shipped tool with
 * the lesson that explains it — now as a plain list of rows rather than a second card grid.
 */
import type { Metadata } from 'next';
import {
  collectionPageJsonLd,
  itemListJsonLd,
  JsonLd,
  pageMetadata,
  routeBreadcrumbs,
} from '../../../lib/seo/index.js';
import { Breadcrumbs } from '../../../components/Breadcrumbs.js';
import { PageHero } from '../../../components/PageHero.js';
import { PageHeroVisual } from '../../../components/visual/PageHeroVisual.js';
import { Section } from '../../../components/Section.js';
import { SectionHeading } from '../../../components/SectionHeading.js';
import { ToolRangeFigure } from '../../../components/tools/ToolRangeFigure.js';
import { contentById, contentMeta, hrefOfContent } from '../../../content/graph.js';
import {
  FEATURED_TOOL_ID,
  primaryToolLessonId,
  shippedRangeFor,
  TOOL_HUB_GROUPS,
  toolHubEntries,
  type ToolHubEntry,
} from '../../../features/tools/index.js';
import { POSITION_LABEL, RANGE_LABEL } from '../../../features/range/index.js';
import { routeById } from '../../../lib/routes.js';

const SEO = {
  path: routeById('tools').path,
  title: '홀덤 계산기 모음 | 승률·팟오즈·아웃츠·핸드레인지',
  description:
    '승률·팟오즈·아웃츠 계산기와 13×13 핸드레인지 표, 시작 핸드 순위표, 족보 판정기까지 — 설명을 읽기 전에 먼저 눌러보는 무료 홀덤 도구 모음입니다.',
} as const;

export const metadata: Metadata = pageMetadata({ ...SEO, index: true });

const ROW_LINK_CLASS =
  'group flex min-h-11 flex-col gap-1 py-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:items-baseline sm:gap-x-8';

/** The seat whose list the featured picture draws — the widest one the data has. */
const FEATURED_SEAT = 'BTN';

/** The featured tool: question as the headline, name as the link, a static chart beside. */
function FeaturedTool({ entry }: { readonly entry: ToolHubEntry }) {
  const range = shippedRangeFor(FEATURED_SEAT);
  return (
    <li className="grid gap-8 rounded-lg border border-line-500 bg-ground-800 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center">
      <div>
        <p className="text-xs font-semibold tracking-[0.08em] text-brand-500">먼저 열어볼 도구</p>
        <p className="prose-ko mt-3 text-h2 font-semibold text-text-100">{entry.question}</p>
        <p className="prose-ko mt-3 text-prose text-text-300">{entry.description}</p>
        <p className="mt-6">
          <a
            href={entry.route.path}
            className="inline-flex min-h-11 items-center rounded-md bg-brand-600 px-5 text-sm font-semibold text-ink-on-brand outline-none hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            {entry.route.label}
          </a>
        </p>
      </div>
      {range !== null ? (
        <ToolRangeFigure
          rangeA={range}
          labelA={POSITION_LABEL[FEATURED_SEAT]}
          label={`${POSITION_LABEL[FEATURED_SEAT]}의 ${RANGE_LABEL}를 칠한 13×13 표 미리보기`}
        />
      ) : null}
    </li>
  );
}

/** One tool as a row: label, the question it answers, the one-line description. */
function ToolRow({ entry }: { readonly entry: ToolHubEntry }) {
  const content = (
    <>
      <span className="flex flex-col gap-0.5">
        <span className="prose-ko text-base font-semibold text-text-100 underline-offset-4 group-hover:text-brand-500 group-hover:underline">
          {entry.route.label}
        </span>
        <span className="prose-ko text-sm text-text-300">{entry.description}</span>
      </span>
      <span className="prose-ko text-base text-text-100/90">{entry.question}</span>
    </>
  );
  return (
    <li className="border-b border-line-500 last:border-b-0">
      {entry.route.available ? (
        <a href={entry.route.path} className={ROW_LINK_CLASS}>
          {content}
        </a>
      ) : (
        <span className={ROW_LINK_CLASS}>
          {content}
          <span className="w-fit rounded-full border border-line-500 px-1.5 py-0.5 text-[10px] font-medium text-text-300">
            준비 중
          </span>
        </span>
      )}
    </li>
  );
}

/** One tool's prerequisite lesson, as a row that names the tool it belongs to. */
function ToolLessonRow({ entry }: { readonly entry: ToolHubEntry }) {
  const record = contentById(primaryToolLessonId(entry.route.id));
  const href = hrefOfContent(record);
  const meta = `${entry.route.label} · ${contentMeta(record)}`;
  return (
    <li className="border-b border-line-500 last:border-b-0">
      {href !== null ? (
        <a href={href} className={ROW_LINK_CLASS}>
          <span className="prose-ko text-base font-semibold text-text-100 underline-offset-4 group-hover:text-brand-500 group-hover:underline">
            {record.title}
          </span>
          <span className="prose-ko text-sm text-text-300">{meta}</span>
        </a>
      ) : (
        <span className={ROW_LINK_CLASS}>
          <span className="prose-ko text-base font-semibold text-text-300">{record.title}</span>
          <span className="prose-ko text-sm text-text-300">{meta} · 준비 중</span>
        </span>
      )}
    </li>
  );
}

export default function ToolsHubPage() {
  const entries = toolHubEntries();
  const ready = entries.filter((entry) => entry.route.available);
  const planned = entries.filter((entry) => !entry.route.available);
  const featured = ready.find((entry) => entry.route.id === FEATURED_TOOL_ID);
  const readyById = new Map(ready.map((entry) => [entry.route.id, entry]));
  const groups = TOOL_HUB_GROUPS.map((group) => ({
    title: group.title,
    entries: group.ids.flatMap((id) => {
      const entry = readyById.get(id);
      return entry === undefined || entry.route.id === featured?.route.id ? [] : [entry];
    }),
  })).filter((group) => group.entries.length > 0);
  // A shipped tool the groups do not name still has to be listed — in a last, unnamed list.
  const grouped = new Set(TOOL_HUB_GROUPS.flatMap((group) => group.ids));
  const ungrouped = ready.filter(
    (entry) => !grouped.has(entry.route.id) && entry.route.id !== featured?.route.id,
  );
  // The `ItemList` is declared in the order the page renders its links (featured, then the
  // groups, then anything ungrouped) — `hubCollectionPage.test.tsx` holds the two together.
  const listed = [
    ...(featured === undefined ? [] : [featured]),
    ...groups.flatMap((group) => group.entries),
    ...ungrouped,
  ];

  return (
    <main>
      <Section width="grid" padded="none" as="div" innerClassName="pt-8 pb-4 sm:pt-10">
        <Breadcrumbs className="mb-8" trail={routeBreadcrumbs('tools')} />
        {/*
          `CollectionPage` holds for a hub whose rows are ROUTES rather than content records.
          The items are `ready` — the entries the registry says are built, exactly the ones
          rendered as links, in registry order. The lessons list is deliberately NOT in it.
        */}
        <JsonLd
          blocks={[
            collectionPageJsonLd({
              ...SEO,
              mainEntity: itemListJsonLd(
                listed.map((entry) => ({ name: entry.route.label, path: entry.route.path })),
              ),
            }),
          ]}
        />
        {/* Desktop only: on a phone the first screen belongs to the tools themselves. */}
        <PageHero
          layout="split"
          visual={<PageHeroVisual slot="toolsHub" theme="math" desktopOnly />}
          eyebrow="무료 도구"
          title="무료 포커 도구"
          description="설명을 읽기 전에 먼저 눌러보세요. 화면에 보이는 숫자는 모두 그 자리에서 계산한 값입니다."
        />
      </Section>

      <Section width="grid" padded="compact" aria-label="지금 사용할 수 있는 도구">
        <SectionHeading
          title="지금 사용할 수 있는 도구"
          description={`전체 ${entries.length}개 중 ${ready.length}개를 사용할 수 있습니다.`}
        />
        {featured !== undefined ? (
          <ul className="mt-8">
            <FeaturedTool entry={featured} />
          </ul>
        ) : null}
        <div className="mt-10 grid gap-x-10 gap-y-8 lg:grid-cols-2">
          {groups.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold tracking-[0.06em] text-brand-500">
                {group.title}
              </h3>
              <ul className="mt-2 border-t border-line-500">
                {group.entries.map((entry) => (
                  <ToolRow key={entry.route.id} entry={entry} />
                ))}
              </ul>
            </div>
          ))}
          {ungrouped.length > 0 ? (
            <ul className="border-t border-line-500 lg:col-span-2">
              {ungrouped.map((entry) => (
                <ToolRow key={entry.route.id} entry={entry} />
              ))}
            </ul>
          ) : null}
        </div>
      </Section>

      {planned.length > 0 ? (
        <Section width="grid" padded="compact" tone="recessed" aria-label="준비 중인 도구">
          <SectionHeading
            title="준비 중인 도구"
            description="아직 만드는 중입니다. 완성되면 이 자리에서 바로 열 수 있습니다."
          />
          <ul className="mt-6 border-t border-line-500">
            {planned.map((entry) => (
              <ToolRow key={entry.route.id} entry={entry} />
            ))}
          </ul>
        </Section>
      ) : null}

      <Section
        width="grid"
        padded="compact"
        divider="top"
        aria-label="도구를 이해하는 데 필요한 레슨"
      >
        <SectionHeading
          title="도구를 이해하는 데 필요한 레슨"
          description="계산기는 숫자를 내주지만 뜻까지 알려주지는 않습니다. 도구마다 먼저 읽어두면 화면의 숫자가 무엇인지 알 수 있는 강의를 한 편씩 골랐습니다."
        />
        <ul className="mt-6 border-t border-line-500">
          {ready.map((entry) => (
            <ToolLessonRow key={entry.route.id} entry={entry} />
          ))}
        </ul>
      </Section>
    </main>
  );
}
