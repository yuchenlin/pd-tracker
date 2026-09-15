"use client";

import {
  CATEGORIES,
  CHARGEABILITIES,
  CHARGEABILITY_COLORS,
  CHARGEABILITY_LABELS,
  formatIsoDate,
  formatTickDate,
  isIsoDate,
} from "@/lib/format";
import type { Category, Chargeability, SeriesPoint, TableKind } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface SeriesResponse {
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
  year: number;
  month: number;
  /** Bulletin month-end ms — calendar / “y = x” diagonal. */
  natural: number;
  A: number | null;
  B: number | null;
  A_label: string | null;
  B_label: string | null;
};

const TABLE_A_COLOR = "#0f766e";
const TABLE_B_COLOR = "#2563eb";
const PD_COLOR = "#e11d48";

const TABLE_A_NAME = "Table A (Final Action)";
const TABLE_B_NAME = "Table B (Dates for Filing)";
const PD_NAME = "Priority Date";
const NATURAL_NAME = "Natural time";
const NATURAL_COLOR = "#94a3b8";

type RangeKey = "all" | "2y" | "1y" | "6m";

const RANGE_OPTIONS: { key: RangeKey; label: string; months: number | null }[] = [
  { key: "2y", label: "2 years", months: 24 },
  { key: "1y", label: "1 year", months: 12 },
  { key: "6m", label: "6 months", months: 6 },
  { key: "all", label: "All", months: null },
];

export function ChartPanel({
  category,
  chargeability,
  pd,
  onCategoryChange,
  onChargeabilityChange,
  onPdChange,
}: {
  category: Category;
  chargeability: Chargeability;
  pd: string;
  onCategoryChange: (c: Category) => void;
  onChargeabilityChange: (c: Chargeability) => void;
  onPdChange: (pd: string) => void;
}) {
  const [payload, setPayload] = useState<SeriesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>("2y");

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    const url = `/api/series?table=A,B&category=${encodeURIComponent(category)}&chargeability=${encodeURIComponent(chargeability)}`;

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
  }, [category, chargeability]);

  const allChartData = useMemo(() => {
    if (!payload?.series.length) return [] as ChartRow[];
    const byId = new Map<string, ChartRow>();
    for (const s of payload.series) {
      for (const p of s.points) {
        const row =
          byId.get(p.id) ??
          ({
            id: p.id,
            title: p.title,
            year: p.year,
            month: p.month,
            natural: Date.UTC(p.year, p.month, 0),
            A: null,
            B: null,
            A_label: null,
            B_label: null,
          } satisfies ChartRow);
        if (s.table === "A") {
          row.A = p.value;
          row.A_label = p.cutoffLabel;
        } else {
          row.B = p.value;
          row.B_label = p.cutoffLabel;
        }
        byId.set(p.id, row);
      }
    }
    return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  }, [payload]);

  const chartData = useMemo(() => {
    const months = RANGE_OPTIONS.find((o) => o.key === range)?.months ?? null;
    if (months == null || allChartData.length <= months) return allChartData;
    return allChartData.slice(-months);
  }, [allChartData, range]);

  const xInterval = useMemo(() => {
    if (chartData.length <= 8) return 0;
    if (chartData.length <= 14) return 1;
    if (chartData.length <= 24) return 2;
    return 3;
  }, [chartData.length]);

  const pdMs = useMemo(() => {
    if (!isIsoDate(pd)) return null;
    const [y, m, d] = pd.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  }, [pd]);

  const yDomain = useMemo(() => {
    const values: number[] = [];
    for (const row of chartData) {
      if (typeof row.A === "number") values.push(row.A);
      if (typeof row.B === "number") values.push(row.B);
      values.push(row.natural);
    }
    if (typeof pdMs === "number") values.push(pdMs);
    if (values.length === 0) return ["auto", "auto"] as const;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max((max - min) * 0.08, 45 * 24 * 60 * 60 * 1000);
    return [min - pad, max + pad] as [number, number];
  }, [chartData, pdMs]);

  return (
    <section id="charts" className="scroll-mt-20">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          Priority date trend
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Table A (Final Action) and Table B (Dates for Filing) on one chart.
          The dashed gray diagonal is natural / calendar time (bulletin month
          end on both axes). Current (C) plots at the bulletin month end;
          Unavailable (U) leaves a gap. Your priority date is the horizontal
          reference line.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        <FilterRow label="Category">
          {CATEGORIES.map((cat) => (
            <Pill
              key={cat}
              active={category === cat}
              onClick={() => onCategoryChange(cat)}
            >
              {cat}
            </Pill>
          ))}
        </FilterRow>
        <FilterRow label="Chargeability">
          {CHARGEABILITIES.map((ch) => (
            <Pill
              key={ch}
              active={chargeability === ch}
              onClick={() => onChargeabilityChange(ch)}
              color={CHARGEABILITY_COLORS[ch]}
            >
              {CHARGEABILITY_LABELS[ch]}
            </Pill>
          ))}
        </FilterRow>
        <FilterRow label="Priority date">
          <input
            type="date"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none ring-teal-600/20 focus:ring-4"
            value={pd}
            onChange={(e) => onPdChange(e.target.value)}
          />
        </FilterRow>
        <FilterRow label="Range">
          {RANGE_OPTIONS.map((opt) => (
            <Pill
              key={opt.key}
              active={range === opt.key}
              onClick={() => setRange(opt.key)}
            >
              {opt.label}
            </Pill>
          ))}
        </FilterRow>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-800">
            {CHARGEABILITY_LABELS[chargeability]} · {category}
            {pdMs != null ? (
              <span className="font-normal text-slate-500">
                {" "}
                · PD {formatIsoDate(pd)}
              </span>
            ) : null}
          </p>
          <p className="text-xs text-slate-500">
            X: bulletin month · Y: cut-off date
          </p>
        </div>

        {loading && !payload ? (
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
                  interval={xInterval}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  angle={-35}
                  textAnchor="end"
                  height={52}
                />
                <YAxis
                  type="number"
                  domain={yDomain}
                  tickFormatter={(v: number) => formatTickDate(v)}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  width={72}
                  allowDataOverflow
                />
                <Tooltip content={<ChartTooltip pd={pd} pdMs={pdMs} />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  content={<ChartLegend />}
                />
                {pdMs != null ? (
                  <ReferenceLine
                    y={pdMs}
                    stroke={PD_COLOR}
                    strokeWidth={1.75}
                    strokeDasharray="6 4"
                    ifOverflow="extendDomain"
                    label={{
                      value: "PD",
                      position: "insideTopRight",
                      fill: PD_COLOR,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  />
                ) : null}
                <Line
                  type="linear"
                  dataKey="natural"
                  name={NATURAL_NAME}
                  stroke={NATURAL_COLOR}
                  strokeWidth={1.75}
                  strokeDasharray="2 4"
                  dot={false}
                  connectNulls
                  legendType="plainline"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="A"
                  name={TABLE_A_NAME}
                  stroke={TABLE_A_COLOR}
                  strokeWidth={2.25}
                  dot={false}
                  connectNulls={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="B"
                  name={TABLE_B_NAME}
                  stroke={TABLE_B_COLOR}
                  strokeWidth={2.25}
                  strokeDasharray="4 2"
                  dot={false}
                  connectNulls={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}

function ChartLegend() {
  const items = [
    { name: TABLE_A_NAME, color: TABLE_A_COLOR, dash: undefined as string | undefined },
    { name: TABLE_B_NAME, color: TABLE_B_COLOR, dash: "4 2" },
    { name: NATURAL_NAME, color: NATURAL_COLOR, dash: "2 4" },
    { name: PD_NAME, color: PD_COLOR, dash: "6 4" },
  ];
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 text-xs text-slate-700">
      {items.map((item) => (
        <li key={item.name} className="inline-flex items-center gap-1.5">
          <svg width="22" height="8" aria-hidden>
            <line
              x1="0"
              y1="4"
              x2="22"
              y2="4"
              stroke={item.color}
              strokeWidth="2.25"
              strokeDasharray={item.dash}
            />
          </svg>
          <span>{item.name}</span>
        </li>
      ))}
    </ul>
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
  pd,
  pdMs,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey?: string | number;
    name?: string;
    color: string;
    payload: ChartRow;
  }>;
  label?: string;
  pd: string;
  pdMs: number | null;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const title = row?.title;

  const items: { key: string; name: string; color: string; display: string }[] =
    [];

  for (const item of payload) {
    const key = String(item.dataKey ?? "");
    if (key !== "A" && key !== "B") continue;
    const raw = key === "A" ? row?.A_label : row?.B_label;
    const display =
      raw === "C"
        ? "Current (C)"
        : raw === "U"
          ? "Unavailable (U)"
          : raw
            ? formatIsoDate(String(raw))
            : "—";
    items.push({
      key,
      name: key === "A" ? TABLE_A_NAME : TABLE_B_NAME,
      color: item.color,
      display,
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-slate-900">{String(title ?? label)}</p>
      <ul className="mt-1 space-y-0.5">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-slate-600">{item.name}</span>
            <span className="font-medium text-slate-900">{item.display}</span>
          </li>
        ))}
        {row?.natural != null ? (
          <li className="flex items-center gap-2 border-t border-slate-100 pt-1 mt-1">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: NATURAL_COLOR }}
            />
            <span className="text-slate-600">{NATURAL_NAME}</span>
            <span className="font-medium text-slate-900">
              {formatTickDate(row.natural)}
            </span>
          </li>
        ) : null}
        {pdMs != null ? (
          <li className="flex items-center gap-2 border-t border-slate-100 pt-1 mt-1">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: PD_COLOR }}
            />
            <span className="text-slate-600">{PD_NAME}</span>
            <span className="font-medium text-slate-900">
              {formatIsoDate(pd)}
            </span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
