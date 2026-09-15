import { TrackerHome } from "@/components/TrackerHome";
import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 py-8 sm:px-6 sm:py-10">
      <section className="rounded-3xl bg-slate-950 px-5 py-8 text-white sm:px-10 sm:py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">
          Free · Unofficial · Employment-based
        </p>
        <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Track Visa Bulletin priority dates
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
          Interactive historical charts with Table A (Final Action Dates) and
          Table B (Dates for Filing) on the same trend line, a priority-date
          reference, plus a PD checker. Historical data curated from official
          DOS Visa Bulletins (October 2023 through August 2026), with monthly
          automated updates.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="#charts"
            className="inline-flex items-center rounded-full bg-teal-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-300"
          >
            View charts
          </a>
          <Link
            href="/checker"
            className="inline-flex items-center rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            Open PD checker
          </Link>
        </div>
      </section>

      <TrackerHome />
    </main>
  );
}
