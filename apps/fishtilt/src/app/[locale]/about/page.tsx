/**
 * `/about` — the trust page (Stage 3, WP-S3-15). One honest document answering, in order,
 * the questions a careful reader asks before trusting a poker site: what this is, who it is
 * for, what it offers, HOW the numbers on screen are produced, what the range table does and
 * does not claim, why the site exists, how hand stories are made, what happens when
 * something is wrong, and what this site deliberately does not do.
 *
 * Every factual sentence below describes code that exists in this repository — the exact
 * equity enumeration (`packages/learn-core/src/equity/exact.ts`), the single showdown
 * evaluator (`packages/strategy-core/src/analysis/evaluate.ts`), the 169-class strength
 * dataset (`packages/learn-core/src/strength/model.ts`), the range table and its one
 * provenance sentence (`features/range/copy.ts`), the hand-story disclosure
 * (`content/stories/types.ts`), and the theme choice, which is the only thing this site
 * stores in a browser (`components/ThemeToggle.tsx`). Nothing here names a person, a team,
 * a company, a founding date, or a contact address, because the site has none to show and
 * a made-up one would be exactly the kind of claim this page exists to rule out.
 *
 * No affiliate, casino, deposit or bonus surface — nothing on this page links off-site
 * (`page.test.tsx` and `about.spec.ts` both assert every link is internal), and the phrase
 * `제휴하지 않았습니다` appears exactly once, as the e2e spec pins it.
 *
 * Plain static content in the reading column, not registry data (there is no `about`
 * content kind) — the same shape `/learn/[slug]` uses for a lesson, with a table of contents
 * because the page is long enough to want one.
 */
import type { Metadata } from 'next';
import {
  breadcrumbListJsonLd,
  JsonLd,
  pageMetadata,
  routeBreadcrumbs,
} from '../../../lib/seo/index.js';
import { Breadcrumbs } from '../../../components/Breadcrumbs.js';
import { PageHero } from '../../../components/PageHero.js';
import { EditorialVisual } from '../../../components/visual/EditorialVisual.js';
import { PageHeroVisual } from '../../../components/visual/PageHeroVisual.js';
import { PAGE_VISUALS, pageVisual } from '../../../content/visuals.js';
import { TableOfContents, type TocHeading } from '../../../components/TableOfContents.js';
import { HAND_STORY_DISCLOSURE } from '../../../content/stories/types.js';
import { RANGE_LABEL, RANGE_PROVENANCE_SENTENCE } from '../../../features/range/index.js';
import { METHODOLOGY_SENTENCE, STRENGTH_METRIC_LABEL } from '../../../features/strength/index.js';
import { routeById } from '../../../lib/routes.js';

/*
 * WP-7a: THE TITLE AND THE H1 ARE DELIBERATELY DIFFERENT, and both stay as they are.
 *
 * `formatTitle` composes this into `소개 · 3BetTilt`, which is already the brand query WP-1 §2
 * assigns this route (`3BetTilt 소개`) with the site name where the site name belongs — a
 * title of `3BetTilt 소개` would render as `3BetTilt 소개 · 3BetTilt`. The `<h1>` is
 * `3BetTilt는 무엇인가요` because a page that exists to answer "is this site trustworthy" opens
 * by asking the reader's own question; a heading reading `소개` would answer nothing.
 */
export const metadata: Metadata = pageMetadata({
  path: routeById('about').path,
  title: '소개',
  description:
    '3BetTilt가 무엇이고 누구를 위한 것인지, 화면의 숫자가 어떻게 계산되는지, 그리고 이 사이트가 하지 않는 것이 무엇인지 설명합니다.',
  index: true,
});

/** The sections, in order — the TOC and the headings both read this one list. */
export const ABOUT_SECTIONS: readonly TocHeading[] = [
  { id: 'what', text: '3BetTilt란?' },
  { id: 'who', text: '누구를 위한 사이트인가?' },
  { id: 'offers', text: '무엇을 제공하는가?' },
  { id: 'numbers', text: '숫자는 어떻게 계산하는가?' },
  { id: 'accuracy', text: '정확성 원칙' },
  { id: 'range', text: '레인지 표가 말하는 것과 말하지 않는 것' },
  { id: 'purpose', text: '교육 목적' },
  { id: 'stories', text: '핸드 스토리는 어떻게 만드는가?' },
  { id: 'errors', text: '오류를 발견했을 때' },
  { id: 'not', text: '하지 않는 것' },
];

const SECTION = 'scroll-mt-24 mt-14 first:mt-12';
const H2 = 'prose-ko text-h2 font-semibold text-text-100';
const BODY = 'prose-ko mt-4 space-y-4 text-prose text-text-100/90';
const LIST = 'prose-ko mt-4 space-y-2 text-prose text-text-100/90';
const LINK =
  'font-medium text-text-100 underline decoration-line-500 underline-offset-4 outline-none hover:text-brand-500 hover:decoration-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

function Heading({ id }: { readonly id: string }) {
  const entry = ABOUT_SECTIONS.find((section) => section.id === id);
  if (entry === undefined) throw new Error(`about: unknown section "${id}"`);
  return (
    <h2 id={id} className={H2}>
      {entry.text}
    </h2>
  );
}

function RouteLink({ id, children }: { readonly id: string; readonly children: React.ReactNode }) {
  const route = routeById(id);
  if (!route.available) return <span className="text-text-300">{children} (준비 중)</span>;
  return (
    <a href={route.path} className={LINK}>
      {children}
    </a>
  );
}

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-reading px-6 py-16">
      <Breadcrumbs className="mb-8" trail={routeBreadcrumbs('about')} />
      {/* No `Article`: this page is plain static content, not a registry record with an
          author/date the site can substantiate (see module doc). `BreadcrumbList` is the
          honest amount, same as a glossary or hand page. */}
      <JsonLd blocks={[breadcrumbListJsonLd(routeBreadcrumbs('about'))]} />
      <PageHero
        visual={
          <PageHeroVisual
            slot="aboutHero"
            theme="basics"
            aspect="16/9"
            sizes="(min-width: 768px) 720px, 100vw"
          />
        }
        eyebrow="소개"
        title="3BetTilt는 무엇인가요"
        description="텍사스 홀덤을 처음 배우는 사람을 위한 무료 학습 사이트입니다. 읽고, 보고, 직접 눌러보고, 계산까지 해보는 순서로 만들어졌습니다. 이 페이지는 이 사이트가 무엇을 근거로 무엇을 말하는지, 그리고 무엇을 하지 않는지를 적어둔 곳입니다."
      />

      <TableOfContents headings={ABOUT_SECTIONS} />

      <section className={SECTION} aria-labelledby="what">
        <Heading id="what" />
        <div className={BODY}>
          <p>
            3BetTilt는 텍사스 홀덤의 규칙, 족보, 포지션, 레인지, 팟 오즈, 아웃 같은 기본 개념을
            한국어로 차근차근 배우는 사이트입니다. 설명을 읽는 페이지, 개념을 직접 계산해보는 도구,
            배운 것을 확인하는 퀴즈, 용어를 찾아보는 사전, 그리고 상황을 풀어 쓴 글과 핸드 이야기로
            이루어져 있습니다.
          </p>
          <p>
            이름의 3벳(3-Bet)은 상대의 레이즈에 다시 레이즈하는 행동이고, 틸트(Tilt)는 감정에 흔들려
            판단이 무너지는 상태를 부르는 말입니다. 둘 다 처음 배우는 사람이 가장 먼저 부딪히는
            단어라서 이름으로 삼았습니다.
          </p>
        </div>
      </section>

      <section className={SECTION} aria-labelledby="who">
        <Heading id="who" />
        <div className={BODY}>
          <p>
            홀덤을 이제 막 시작했거나, 규칙은 알지만 &ldquo;왜 이 패로는 참여하지 말라고
            하는지&rdquo; 같은 이유를 아직 모르는 사람을 위해 만들었습니다. 이미 오래 플레이한
            사람에게 새로운 전략을 알려주는 곳은 아닙니다. 모든 설명은 쉬운 한국어 표현을 먼저 쓰고,
            영어 용어를 괄호 안에 함께 적는 순서를 따릅니다.
          </p>
        </div>
      </section>

      <section className={SECTION} aria-labelledby="offers">
        <Heading id="offers" />
        <ul className={LIST}>
          <li>
            <RouteLink id="learn">배우기</RouteLink> — 규칙과 기본 개념을 순서대로 읽는 레슨.
          </li>
          <li>
            <RouteLink id="range">핸드레인지 표</RouteLink> — 포지션별로 어떤 시작 패가{' '}
            {RANGE_LABEL}에 들어 있는지 눌러보며 확인하는 표.
          </li>
          <li>
            <RouteLink id="tools">무료 도구</RouteLink> — 승률, 팟 오즈, 아웃, 족보, 시작 패 강도를
            직접 계산해보는 계산기.
          </li>
          <li>
            <RouteLink id="practice">퀴즈</RouteLink> — 레인지, 족보, 시작 패 강도를 문제로 확인하는
            연습.
          </li>
          <li>
            <RouteLink id="glossary">포커 용어</RouteLink> — 모르는 단어를 한국어 설명으로 찾아보는
            사전.
          </li>
          <li>
            <RouteLink id="blog">블로그</RouteLink>와 <RouteLink id="hands">핸드 목록</RouteLink> —
            자주 막히는 상황을 풀어 쓴 글과, 시작 패 하나하나를 따로 설명한 페이지.
          </li>
        </ul>
      </section>

      {/* A pause before the methodology: a brand picture, decorative, no caption — the
          section heading below says what comes next. */}
      <div data-page-visual="aboutTable" className="mt-14">
        <EditorialVisual
          visual={pageVisual(PAGE_VISUALS.aboutTable, 'betting')}
          aspect="21/9"
          scrim="hero"
          sizes="(min-width: 768px) 720px, 100vw"
        />
      </div>

      <section className={SECTION} aria-labelledby="numbers">
        <Heading id="numbers" />
        <div className={BODY}>
          <p>
            화면에 나오는 숫자는 어디선가 옮겨 적은 값이 아니라, 이 사이트의 코드가 계산한 값입니다.
            계산 방식은 종류마다 다르고, 각각 다음과 같습니다.
          </p>
        </div>
        <dl className="mt-4 divide-y divide-line-500">
          <div className="grid gap-1 py-4 sm:grid-cols-12 sm:gap-6">
            <dt className="text-sm font-semibold text-text-100 sm:col-span-4">승률 계산기</dt>
            <dd className="prose-ko text-prose text-text-100/90 sm:col-span-8">
              두 핸드와 보드가 정해지면, 남은 카드로 나올 수 있는 모든 결과를 하나도 빠짐없이 세어
              이기는 경우, 비기는 경우, 지는 경우를 그대로 셉니다. 표본을 뽑아 어림하는 방식이
              아니라 전부 세는 방식이라, 같은 입력에는 언제나 같은 값이 나옵니다.
            </dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-12 sm:gap-6">
            <dt className="text-sm font-semibold text-text-100 sm:col-span-4">족보 판정</dt>
            <dd className="prose-ko text-prose text-text-100/90 sm:col-span-8">
              핸드 체커, 족보 퀴즈, 승률 계산기는 모두 같은 하나의 족보 평가기를 씁니다. 다섯 장에서
              일곱 장까지의 카드에서 표준 쇼다운 규칙으로 가장 좋은 다섯 장을 고르고, 두 핸드를
              비교해 승패와 무승부를 판정합니다.
            </dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-12 sm:gap-6">
            <dt className="text-sm font-semibold text-text-100 sm:col-span-4">
              {STRENGTH_METRIC_LABEL}
            </dt>
            <dd className="prose-ko text-prose text-text-100/90 sm:col-span-8">
              {METHODOLOGY_SENTENCE} 169개 시작 패 전부에 대해 같은 방식으로 정확히 계산한 값이며,
              시작 핸드 탐색기와 시작 핸드 퀴즈가 같은 데이터를 씁니다.
            </dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-12 sm:gap-6">
            <dt className="text-sm font-semibold text-text-100 sm:col-span-4">팟 오즈 · 아웃</dt>
            <dd className="prose-ko text-prose text-text-100/90 sm:col-span-8">
              입력한 팟 크기와 콜 금액, 고른 카드에서 그 자리에서 나눗셈과 조합 수 세기로 구합니다.
              어림 규칙이 아니라 실제 남은 카드 수를 기준으로 계산하고, 어림 규칙과 얼마나 다른지는
              해당 도구가 함께 보여줍니다.
            </dd>
          </div>
        </dl>
      </section>

      <section className={SECTION} aria-labelledby="accuracy">
        <Heading id="accuracy" />
        <ul className={LIST}>
          <li>
            계산할 근거가 없는 값은 꾸며서 보여주지 않고, &ldquo;준비 중&rdquo;이라고 그대로
            말합니다.
          </li>
          <li>
            같은 개념의 숫자는 사이트 어디서나 같은 코드에서 나옵니다. 계산기, 퀴즈, 레슨 속 표가
            서로 다른 값을 보여주는 일이 없도록 하나의 출처만 둡니다.
          </li>
          <li>
            숫자를 만드는 코드는 자동 테스트로 검증합니다. 족보 퀴즈의 정답은 문제를 만들 때 족보
            평가기로 확인한 값이고, 사람이 손으로 적어 넣은 정답은 없습니다.
          </li>
          <li>
            확실하지 않은 규칙은 그럴듯하게 지어내지 않습니다. 설명이 다루지 않는 상황은 &ldquo;이
            사이트가 답할 수 있는 범위 밖&rdquo;이라고 적습니다.
          </li>
        </ul>
      </section>

      <section className={SECTION} aria-labelledby="range">
        <Heading id="range" />
        <div className={BODY}>
          <p>{RANGE_PROVENANCE_SENTENCE}</p>
          <p>
            이 표는 처음 배우는 사람이 &ldquo;대략 이 정도 패로 먼저 레이즈하는구나&rdquo;를 익히기
            위한 학습용 기준선입니다. 솔버가 계산한 균형 전략이 아니고, 그렇게 부르지도 않습니다.
            어떤 자료에서 왔는지 특정 이름을 대지 않으며, 다른 테이블 인원, 다른 스택 깊이, 앞에
            참여자가 있는 상황의 표는 아직 준비되지 않았습니다. 준비되지 않은 조건을 고르면 그
            사실을 그대로 보여줍니다.
          </p>
        </div>
      </section>

      <section className={SECTION} aria-labelledby="purpose">
        <Heading id="purpose" />
        <div className={BODY}>
          <p>
            이 사이트는 배우기 위한 곳입니다. 게임을 하는 곳도, 게임을 하는 곳으로 보내는 곳도
            아닙니다. 어떤 페이지도 돈을 걸라고 권하지 않고, 어떤 패로 얼마를 벌 수 있다고 말하지
            않습니다. 승률과 팟 오즈는 판단을 설명하는 도구이지, 결과를 약속하는 숫자가 아닙니다.
          </p>
        </div>
      </section>

      <section className={SECTION} aria-labelledby="stories">
        <Heading id="stories" />
        <div className={BODY}>
          <p>
            핸드 목록과 일부 글에 나오는 핸드 이야기는 특정 사람의 실제 경기를 옮긴 기록이 아닙니다.
            배우려는 개념이 잘 드러나도록 상황을 재구성한 시나리오이며, 모든 이야기에는 같은 문장이
            붙어 있습니다: &ldquo;{HAND_STORY_DISCLOSURE}&rdquo; 이야기 속 카드와 판의 크기로
            계산되는 숫자는 다른 페이지와 같은 코드가 계산합니다.
          </p>
        </div>
      </section>

      <section className={SECTION} aria-labelledby="errors">
        <Heading id="errors" />
        <div className={BODY}>
          <p>
            틀린 설명이나 잘못된 숫자가 발견되면 그 페이지만 고치는 것이 아니라, 그 값을 만든 코드와
            그 코드를 검사하는 테스트를 함께 고칩니다. 같은 오류가 다른 페이지에 남아 있지 않도록
            하기 위해서입니다. 잘못된 내용을 덮어 두거나, 고친 뒤에 원래 그랬던 것처럼 꾸미지
            않습니다.
          </p>
        </div>
      </section>

      <section className={SECTION} aria-labelledby="not">
        <Heading id="not" />
        <ul className={LIST}>
          <li>
            <strong className="font-semibold text-text-100">실시간 플레이를 돕지 않습니다.</strong>{' '}
            포커 프로그램의 화면을 읽거나, 그 위에 무언가를 띄우거나, 진행 중인 판에 대해 답을
            알려주는 기능은 없고 만들 계획도 없습니다. 카드와 상황은 언제나 배우는 사람이 직접
            입력합니다.
          </li>
          <li>
            <strong className="font-semibold text-text-100">
              어떤 포커 사이트와도 제휴하지 않았습니다.
            </strong>{' '}
            돈을 걸 수 있는 곳으로 보내는 링크, 그런 곳의 광고, 가입이나 입금을 유도하는 안내는
            어디에도 없습니다.
          </li>
          <li>
            <strong className="font-semibold text-text-100">
              계정이 없고, 개인 정보를 모으지 않습니다.
            </strong>{' '}
            로그인, 회원 가입, 방문 기록 수집이 없습니다. 브라우저에 저장하는 것은 밝은 테마와
            어두운 테마 중 무엇을 골랐는지 하나뿐이고, 퀴즈 결과도 어디에도 보내지 않습니다.
          </li>
          <li>
            <strong className="font-semibold text-text-100">없는 숫자를 만들지 않습니다.</strong>{' '}
            아직 계산하지 못하는 값에는 그럴듯한 값을 대신 넣지 않습니다.
          </li>
        </ul>
      </section>
    </main>
  );
}
