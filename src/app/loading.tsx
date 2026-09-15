export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="h-40 animate-pulse rounded-3xl bg-slate-200/80" />
      <div className="h-72 animate-pulse rounded-2xl bg-slate-200/60" />
      <p className="text-sm text-slate-500">Loading PD Tracker…</p>
    </main>
  );
}
