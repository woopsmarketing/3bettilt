/**
 * The landing page. One job: get the user to a configured session.
 */
export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">GTO-SELF</h1>
      <p className="mt-2 text-ink-300">
        6맥스 NLHE 연습 · 리플레이 · 전략 리뷰 도구. 핸드는 직접 입력합니다.
      </p>
      <p className="mt-2 text-sm text-ink-500">
        어떤 포커 클라이언트와도 연결되지 않습니다. 화면 인식, 자동화, 실시간 보조 없음.
      </p>

      {/*
        A plain anchor, not `next/link`. `apps/web/tsconfig.json` resolves modules with
        `nodenext` (see the note there); `next/link` has no `exports` map and its default
        export types as the whole CommonJS namespace under that mode, so it cannot be used
        as a JSX component without a cast. One landing-page link does not need client-side
        navigation, and a cast to buy prefetching would be a lie about the type.
      */}
      <a
        href="/session/new"
        data-testid="new-session-link"
        className="mt-10 inline-block rounded bg-hero-500 px-5 py-2.5 text-sm font-medium text-surface-900"
      >
        새 세션
      </a>

      <p className="mt-4 text-sm text-ink-500">
        NL50 프리셋을 고르고, 플레이어를 앉히고, 내 좌석을 정한 뒤 시작하세요.
      </p>
    </main>
  );
}
