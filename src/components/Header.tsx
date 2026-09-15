import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/95 text-white backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500 text-sm font-bold text-slate-950">
            PD
          </span>
          <span className="text-base font-semibold tracking-tight sm:text-lg">
            PD Tracker
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium text-slate-300 sm:gap-2">
          <Link
            href="/#charts"
            className="rounded-md px-3 py-1.5 hover:bg-white/10 hover:text-white"
          >
            Charts
          </Link>
          <Link
            href="/checker"
            className="rounded-md px-3 py-1.5 hover:bg-white/10 hover:text-white"
          >
            PD Checker
          </Link>
        </nav>
      </div>
    </header>
  );
}
