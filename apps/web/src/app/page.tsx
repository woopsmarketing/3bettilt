/**
 * The landing page. One job: get the user to a configured session.
 */
export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">GTO-SELF</h1>
      <p className="mt-2 text-ink-300">
        Independent poker training, replay and strategy review for 6-max NLHE. You enter the hands
        yourself.
      </p>
      <p className="mt-2 text-sm text-ink-500">
        Not connected to any poker client: no screen reading, no automation, no live assistance.
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
        className="mt-10 inline-block rounded bg-hero-500 px-5 py-2.5 text-sm font-medium text-surface-900"
      >
        New session
      </a>

      <p className="mt-4 text-sm text-ink-500">
        Pick the NL50 preset, seat your players, choose Hero, and start.
      </p>
    </main>
  );
}
