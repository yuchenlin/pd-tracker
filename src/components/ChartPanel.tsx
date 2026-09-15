"use client";

import {
  CATEGORIES,
  CHARGEABILITIES,
  CHARGEABILITY_COLORS,
  CHARGEABILITY_LABELS,
  TABLE_LABELS,
  formatTickDate,
} from "@/lib/format";
import type { Category, Chargeability, SeriesPoint, TableKind } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface SeriesResponse {
  table: TableKind;
  category: Category;
  series: {
    table: TableKind;
    category: Category;
    chargeability: Chargeability;
    points: SeriesPoint[];
  }[];
}

type ChartRow = {
  id: string;
  title: string;
} & Record<string, string | number | null>;

export function ChartPanel() {
  const [table, setTable] = useState<TableKind>("A");
  const [category, setCategory] = useState<Category>("EB-2");
  const [selected, setSelected] = useState<Chargeability[]>(["CHINA"]);
  const [payload, setPayload] = useState<SeriesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const chargeabilityQuery = selected.join(",");

  useEffect(() => {
    if (selected.length === 0) {
      setPayload(null);
      setLoading(false);
      setError(null);
      return;
    }

    const ac = new AbortController();
    setLoading(true);
    const url = `/api/series?table=${table}&category=${encodeURIComponent(category)}&chargeability=${encodeURIComponent(chargeabilityQuery)}`;

    fetch(url, { signal: ac.signal })
      .then(async (res) => {
        const json = (await res.json()) as SeriesResponse & { error?: string };
        if (!res.ok) throw new Error(json.error || "Failed to load series");
        setPayload(json);
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load series");
      })
      .finally(() => setLoading(false));

    return () => ac.abort();
  }, [table, category, chargeabilityQuery, selected.length]);

  const chartData = useMemo(() => {
    if (!payload?.series.length) return [];
    const byId = new Map<string, ChartRow>();
    for (const s of payload.series) {
      for (const p of s.points) {
        const row = byId.get(p.id) ?? { id: p.id, title: p.title };
        row[s.chargeability] = p.value;
        row[`${s.chargeability}_label`] = p.cutoffLabel;
        byId.set(p.id, row);
      }
    }
    return [...byId.values()];
  }, [payload]);

  function toggleChargeability(ch: Chargeability) {
    setSelected((prev) =>
      prev.includes(ch) ? prev.filter((x) => x !== ch) : [...prev, ch],
    );
  }

  return (
    <section id="charts" className="scroll-mt-20">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Historical cut-off dates
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Employment-based Visa Bulletin dates. Current (C) is plotted as the
            bulletin month; Unavailable (U) is a gap.
          </p>
        </div>
        <TableToggle value={table} onChange={setTable} />
      </div>

      <div className="mt-5 flex flex-col gap-4">
        <FilterRow label="Category">
          {CATEGORIES.map((cat) => (
            <Pill
              key={cat}
              active={category === cat}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </Pill>
          ))}
        </FilterRow>
        <FilterRow label="Chargeability">
          {CHARGEABILITIES.map((ch) => (
            <Pill
              key={ch}
              active={selected.includes(ch)}
              onClick={() => toggleChargeability(ch)}
              color={CHARGEABILITY_COLORS[ch]}
            >
              {CHARGEABILITY_LABELS[ch]}
            </Pill>
          ))}
        </FilterRow>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-800">
            {TABLE_LABELS[table]} · {category}
          </p>
          <p className="text-xs text-slate-500">X: bulletin month · Y: cut-off date</p>
        </div>

        {selected.length === 0 ? (
          <EmptyState message="Select at least one chargeability to plot a series." />
        ) : loading && !payload ? (
          <EmptyState message="Loading chart data…" />
        ) : error ? (
          <EmptyState message={error} tone="error" />
        ) : (
          <div className="h-[320px] w-full sm:h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 12, left: 8, bottom: 28 }}
              >
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis
                  dataKey="id"
                  interval={2}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  angle={-35}
                  textAnchor="end"
                  height={52}
                />
                <YAxis
                  type="number"
                  domain={["auto", "auto"]}
                  tickFormatter={(v: number) => formatTickDate(v)}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  width={72}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  formatter={(value) =>
                    CHARGEABILITY_LABELS[value as Chargeability] ?? value
                  }
                />
                {selected.map((ch) => (
                  <Line
                    key={ch}
                    type="monotone"
                    dataKey={ch}
                    name={ch}
                    stroke={CHARGEABILITY_COLORS[ch]}
                    strokeWidth={2.25}
                    dot={false}
                    connectNulls={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}

function TableToggle({
  value,
  onChange,
}: {
  value: TableKind;
  onChange: (t: TableKind) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-sm font-medium">
      {(["A", "B"] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={`rounded-md px-3 py-1.5 transition ${
            value === t
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {t === "A" ? "Table A" : "Table B"}
        </button>
      ))}
    </div>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="w-28 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
  color,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      }`}
      style={
        active && color
          ? { backgroundColor: color, borderColor: color, color: "#fff" }
          : undefined
      }
    >
      {children}
    </button>
  );
}

function EmptyState({
  message,
  tone = "muted",
}: {
  message: string;
  tone?: "muted" | "error";
}) {
  return (
    <div
      className={`flex h-[240px] items-center justify-center rounded-xl text-sm sm:h-[320px] ${
        tone === "error" ? "text-rose-700" : "text-slate-500"
      }`}
    >
      {message}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    color: string;
    payload: Record<string, string | number | null>;
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const title = payload[0]?.payload.title;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-slate-900">{String(title ?? label)}</p>
      <ul className="mt-1 space-y-0.5">
        {payload.map((item) => {
          const key = `${item.name}_label`;
          const raw = item.payload[key];
          const display =
            raw === "C"
              ? "Current (C)"
              : raw === "U"
                ? "Unavailable (U)"
                : String(raw ?? "—");
          return (
            <li key={item.name} className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-slate-600">
                {CHARGEABILITY_LABELS[item.name as Chargeability] ?? item.name}
              </span>
              <span className="font-medium text-slate-900">{display}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
