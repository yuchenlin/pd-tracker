"use client";

import { StatusBadge } from "@/components/StatusBadge";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CHARGEABILITIES,
  CHARGEABILITY_LABELS,
  cutoffDisplay,
} from "@/lib/format";
import type { Category, Chargeability, PdCheckResult } from "@/lib/types";
import { useEffect, useState } from "react";

interface CheckResponse {
  pd: string;
  category: Category;
  chargeability: Chargeability;
  current: boolean;
  latest: {
    bulletinId: string;
    title: string;
    published: string;
    tableA: PdCheckResult;
    tableB: PdCheckResult;
  };
  history: {
    id: string;
    title: string;
    published: string;
    tableA: PdCheckResult;
    tableB: PdCheckResult;
  }[];
  error?: string;
}

const DEFAULT_PD = "2024-07-16";

export function PdChecker({ compact = false }: { compact?: boolean }) {
  const [category, setCategory] = useState<Category>("EB-2");
  const [chargeability, setChargeability] = useState<Chargeability>("CHINA");
  const [pd, setPd] = useState(DEFAULT_PD);
  const [data, setData] = useState<CheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    const url = `/api/check?table=A&category=${encodeURIComponent(category)}&chargeability=${chargeability}&pd=${pd}&history=12`;

    fetch(url, { signal: ac.signal })
      .then(async (res) => {
        const json = (await res.json()) as CheckResponse;
        if (!res.ok) throw new Error(json.error || "Check failed");
        setData(json);
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Check failed");
      })
      .finally(() => setLoading(false));

    return () => ac.abort();
  }, [category, chargeability, pd]);

  return (
    <section id="checker" className="scroll-mt-20">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          PD Checker
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Demo case is pre-filled:{" "}
          <strong>China, priority date {DEFAULT_PD}</strong>. A date is current
          if the cut-off is C, or if your PD is on or before the cut-off.
        </p>
      </div>

      <form
        className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3 sm:p-5"
        onSubmit={(e) => e.preventDefault()}
      >
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-700">Category</span>
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-teal-600/20 focus:ring-4"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-700">Chargeability</span>
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-teal-600/20 focus:ring-4"
            value={chargeability}
            onChange={(e) => setChargeability(e.target.value as Chargeability)}
          >
            {CHARGEABILITIES.map((ch) => (
              <option key={ch} value={ch}>
                {CHARGEABILITY_LABELS[ch]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-700">Priority date</span>
          <input
            type="date"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-teal-600/20 focus:ring-4"
            value={pd}
            onChange={(e) => setPd(e.target.value)}
          />
        </label>
      </form>

      {loading && !data ? (
        <p className="mt-4 text-sm text-slate-500">Checking latest bulletin…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-rose-700">{error}</p>
      ) : data ? (
        <>
          <p className="mt-4 text-sm text-slate-600">
            Latest bulletin:{" "}
            <span className="font-medium text-slate-900">{data.latest.title}</span>
            <span className="text-slate-400">
              {" "}
              · published {data.latest.published} · {data.latest.bulletinId}
            </span>
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <ResultCard
              title="Table A — Final Action Dates"
              hint="When USCIS / DOS may approve / issue the visa"
              result={data.latest.tableA}
            />
            <ResultCard
              title="Table B — Dates for Filing"
              hint="When you may file an adjustment of status (if USCIS accepts Table B)"
              result={data.latest.tableB}
            />
          </div>

          {!compact && (
            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Bulletin</th>
                    <th className="px-4 py-3">Table A</th>
                    <th className="px-4 py-3">Cut-off A</th>
                    <th className="px-4 py-3">Table B</th>
                    <th className="px-4 py-3">Cut-off B</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.history.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-800">
                        {row.id}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={row.tableA.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                        {cutoffDisplay(row.tableA.cutoff)}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={row.tableB.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                        {cutoffDisplay(row.tableB.cutoff)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <p className="mt-4 text-sm text-slate-500">No result yet.</p>
      )}
    </section>
  );
}

function ResultCard({
  title,
  hint,
  result,
}: {
  title: string;
  hint: string;
  result: PdCheckResult;
}) {
  const tone =
    result.status === "current"
      ? "border-emerald-200 bg-emerald-50/60"
      : result.status === "unavailable"
        ? "border-amber-200 bg-amber-50/60"
        : "border-rose-200 bg-rose-50/40";

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
        </div>
        <StatusBadge status={result.status} />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
        {cutoffDisplay(result.cutoff)}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{result.reason}</p>
    </div>
  );
}
