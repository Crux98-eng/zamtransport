export function FullPageLoading() {
  return <main className="grid min-h-screen place-items-center bg-ink-950 p-6 text-center text-ink-700" role="status" aria-live="polite"><div><span className="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /><p className="mt-4 text-sm font-semibold">Loading your workspace…</p></div></main>
}
