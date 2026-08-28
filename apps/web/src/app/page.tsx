const PHASES = [
  { id: 0, name: 'Repository bootstrap', state: 'done' },
  { id: 1, name: 'Poker core domain', state: 'pending' },
  { id: 2, name: 'Poker core edge cases', state: 'pending' },
  { id: 3, name: 'Database and player domain', state: 'pending' },
  { id: 4, name: 'Session setup UX', state: 'pending' },
  { id: 5, name: 'Main table UI', state: 'pending' },
  { id: 6, name: 'Fast action UX', state: 'pending' },
  { id: 7, name: 'Card palette', state: 'pending' },
  { id: 8, name: 'Observe / dirty stack flow', state: 'pending' },
  { id: 9, name: 'GTO provider interface', state: 'pending' },
  { id: 10, name: 'Strategy UI + safe policy', state: 'pending' },
  { id: 11, name: 'CoinPoker hand-history parser', state: 'pending' },
  { id: 12, name: 'QA / MVP hardening', state: 'pending' },
] as const;

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">GTO-SELF</h1>
      <p className="mt-2 text-ink-300">
        Independent poker training, replay and strategy review. Not connected to any poker client.
      </p>
      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-widest text-ink-500">Build status</h2>
        <ul className="mt-4 divide-y divide-surface-700 rounded-lg border border-surface-700">
          {PHASES.map((phase) => (
            <li key={phase.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="tabular w-8 text-ink-500">{phase.id}</span>
              <span className="flex-1">{phase.name}</span>
              <span className={phase.state === 'done' ? 'text-good-500' : 'text-ink-700'}>
                {phase.state}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
