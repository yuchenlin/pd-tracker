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
  // Single-country keys
  A: number | null;
  B: number | null;
  A_label: string | null;
  B_label: string | null;
  // Compare-mode keys
  CHINA_A: number | null;
  CHINA_B: number | null;
  INDIA_A: number | null;
  INDIA_B: number | null;
  CHINA_A_label: string | null;
  CHINA_B_label: string | null;
  INDIA_A_label: string | null;
  INDIA_B_label: string | null;
};

const TABLE_A_COLOR = "#0f766e";
const TABLE_B_COLOR = "#2563eb";
const PD_COLOR = "#e11d48";

const TABLE_A_NAME = "Table A (Final Action)";
const TABLE_B_NAME = "Table B (Dates for Filing)";
const PD_NAME = "Your PD";

const COMPARE_COUNTRIES = ["CHINA", "INDIA"] as const;
type CompareCountry = (typeof COMPARE_COUNTRIES)[number];

type RangeKey = "all" | "2y" | "1y" | "6m";

const RANGE_OPTIONS: { key: RangeKey; label: string; months: number | null }[] = [
  { key: "2y", label: "2 years", months: 24 },
  { key: "1y", label: "1 year", months: 12 },
  { key: "6m", label: "6 months", months: 6 },
  { key: "all", label: "All", months: null },
];

/** Include PD in Y domain automatically when within ~12 months of visible series. */
const PD_NEAR_MS = 12 * 30.4375 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const PAD_RATIO = 0.06;
const PAD_MIN_MS = 30 * DAY_MS;

function emptyRow(p: SeriesPoint): ChartRow {
  return {
    id: p.id,
    title: p.title,
    A: null,
    B: null,
    A_label: null,
    B_label: null,
    CHINA_A: null,
    CHINA_B: null,
    INDIA_A: null,
    INDIA_B: null,
    CHINA_A_label: null,
    CHINA_B_label: null,
    INDIA_A_label: null,
    INDIA_B_label: null,
  };
}

function seriesKey(
  chargeability: Chargeability,
  table: TableKind,
  compare: boolean,
): keyof ChartRow | null {
  if (!compare) {
    return table === "A" ? "A" : "B";
  }
  if (chargeability === "CHINA" || chargeability === "INDIA") {
    return `${chargeability}_${table}` as keyof ChartRow;
  }
  return null;
}

function labelKey(
  chargeability: Chargeability,
  table: TableKind,
  compare: boolean,
): keyof ChartRow | null {
  if (!compare) {
    return table === "A" ? "A_label" : "B_label";
  }
  if (chargeability === "CHINA" || chargeability === "INDIA") {
    return `${chargeability}_${table}_label` as keyof ChartRow;
  }
  return null;
}

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
  const [compare, setCompare] = useState(false);
  const [includePdInScale, setIncludePdInScale] = useState(false);

  const fetchChargeability = compare
    ? "CHINA,INDIA"
    : chargeability;

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    const url = `/api/series?table=A,B&category=${encodeURIComponent(category)}&chargeability=${encodeURIComponent(fetchChargeability)}`;

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
  }, [category, fetchChargeability]);

  // Reset force-include when PD or category/chargeability changes enough that nearness may flip.
  useEffect(() => {
    setIncludePdInScale(false);
  }, [pd, category, chargeability, compare, range]);

  const allChartData = useMemo(() => {
    if (!payload?.series.length) return [] as ChartRow[];
    const byId = new Map<string, ChartRow>();
    for (const s of payload.series) {
      for (const p of s.points) {
        const row = byId.get(p.id) ?? emptyRow(p);
        const vk = seriesKey(s.chargeability, s.table, compare);
        const lk = labelKey(s.chargeability, s.table, compare);
        if (vk) (row as Record<string, unknown>)[vk] = p.value;
        if (lk) (row as Record<string, unknown>)[lk] = p.cutoffLabel;
        byId.set(p.id, row);
      }
    }
    return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  }, [payload, compare]);

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

  const seriesValues = useMemo(() => {
    const values: number[] = [];
    for (const row of chartData) {
      if (compare) {
        for (const ch of COMPARE_COUNTRIES) {
          const a = row[`${ch}_A`];
          const b = row[`${ch}_B`];
          if (typeof a === "number") values.push(a);
          if (typeof b === "number") values.push(b);
        }
      } else {
        if (typeof row.A === "number") values.push(row.A);
        if (typeof row.B === "number") values.push(row.B);
      }
    }
    return values;
  }, [chartData, compare]);

  const { yDomain, pdOutside, pdNear } = useMemo(() => {
    if (seriesValues.length === 0) {
      return {
        yDomain: ["auto", "auto"] as ["auto", "auto"] | [number, number],
        pdOutside: null as null | "above" | "below",
        pdNear: false,
      };
    }
    let min = Math.min(...seriesValues);
    let max = Math.max(...seriesValues);
    let pdOutside: null | "above" | "below" = null;
    let pdNear = false;

    if (typeof pdMs === "number") {
      pdNear = pdMs >= min - PD_NEAR_MS && pdMs <= max + PD_NEAR_MS;
      const foldIn = includePdInScale || pdNear;
      if (foldIn) {
        min = Math.min(min, pdMs);
        max = Math.max(max, pdMs);
      } else if (pdMs > max) {
        pdOutside = "above";
      } else if (pdMs < min) {
        pdOutside = "below";
      } else {
        // Inside series span but we somehow didn't fold — treat as in domain.
        pdNear = true;
        min = Math.min(min, pdMs);
        max = Math.max(max, pdMs);
      }
    }

    const pad = Math.max((max - min) * PAD_RATIO, PAD_MIN_MS);
    return {
      yDomain: [min - pad, max + pad] as [number, number],
      pdOutside,
      pdNear,
    };
  }, [seriesValues, pdMs, includePdInScale]);

  const showPdLine =
    pdMs != null && (pdOutside === null || includePdInScale || pdNear);

  function enableCompare() {
    setCompare(true);
  }

  function exitCompare(next: Chargeability) {
    setCompare(false);
    onChargeabilityChange(next);
  }

  function onChargeabilityPill(ch: Chargeability) {
    if (compare) {
      exitCompare(ch);
      return;
    }
    onChargeabilityChange(ch);
  }

  const heading = compare
    ? `China & India · ${category}`
    : `${CHARGEABILITY_LABELS[chargeability]} · ${category}`;

  return (
    <section id="charts" className="scroll-mt-20">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          Priority date trend
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Table A (Final Action) and Table B (Dates for Filing) on one chart.
          Current (C) plots at the bulletin month end; Unavailable (U) leaves a
          gap. Your priority date is the solid crimson reference line. Use{" "}
          <strong className="font-medium text-slate-700">Compare China &amp; India</strong>{" "}
          to overlay both countries (A solid, B dashed in each country’s color).
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
          {CHARGEABILITIES.map((ch) => {
            const lockedCompare =
              compare && (ch === "CHINA" || ch === "INDIA");
            return (
              <Pill
                key={ch}
                active={compare ? lockedCompare : chargeability === ch}
                onClick={() => onChargeabilityPill(ch)}
                color={CHARGEABILITY_COLORS[ch]}
                ring={lockedCompare}
              >
                {CHARGEABILITY_LABELS[ch]}
              </Pill>
            );
          })}
        </FilterRow>
        <FilterRow label="Compare">
          <Pill
            active={compare}
            onClick={() => (compare ? exitCompare(chargeability) : enableCompare())}
          >
            Compare China &amp; India
          </Pill>
          {compare ? (
            <span className="text-xs text-slate-500">
              Click a country pill to exit compare
            </span>
          ) : null}
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
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="text-sm font-medium text-slate-800">
              {heading}
              {pdMs != null ? (
                <span className="font-normal text-slate-500">
                  {" "}
                  · PD {formatIsoDate(pd)}
                </span>
              ) : null}
            </p>
            {pdOutside && !includePdInScale ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="inline-flex w-fit items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-800">
                  Your PD is{" "}
                  {pdOutside === "above"
                    ? "above the visible cutoffs"
                    : "below the visible cutoffs"}{" "}
                  — scale fits series
                  {pdMs != null ? ` (PD ${formatIsoDate(pd)})` : ""}
                </p>
                <button
                  type="button"
                  onClick={() => setIncludePdInScale(true)}
                  className="inline-flex items-center rounded-full border border-rose-300 bg-white px-2.5 py-0.5 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50"
                >
                  Include PD in scale
                </button>
              </div>
            ) : null}
            {includePdInScale && pdMs != null && !pdNear ? (
              <button
                type="button"
                onClick={() => setIncludePdInScale(false)}
                className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                PD forced into scale — click to fit series only
              </button>
            ) : null}
          </div>
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
                <Tooltip
                  content={
                    <ChartTooltip
                      pd={pd}
                      pdMs={pdMs}
                      compare={compare}
                    />
                  }
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  content={<ChartLegend compare={compare} showPd={pdMs != null} />}
                />
                {showPdLine ? (
                  <ReferenceLine
                    y={pdMs!}
                    stroke={PD_COLOR}
                    strokeWidth={2.5}
                    ifOverflow="hidden"
                    label={{
                      value: "Your PD",
                      position: "insideTopRight",
                      fill: PD_COLOR,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  />
                ) : null}
                {compare ? (
                  <>
                    {(COMPARE_COUNTRIES as readonly CompareCountry[]).map(
                      (ch) => (
                        <Line
                          key={`${ch}_A`}
                          type="monotone"
                          dataKey={`${ch}_A`}
                          name={`${CHARGEABILITY_LABELS[ch]} · A`}
                          stroke={CHARGEABILITY_COLORS[ch]}
                          strokeWidth={2.25}
                          dot={false}
                          connectNulls={false}
                          activeDot={{ r: 4 }}
                        />
                      ),
                    )}
                    {(COMPARE_COUNTRIES as readonly CompareCountry[]).map(
                      (ch) => (
                        <Line
                          key={`${ch}_B`}
                          type="monotone"
                          dataKey={`${ch}_B`}
                          name={`${CHARGEABILITY_LABELS[ch]} · B`}
                          stroke={CHARGEABILITY_COLORS[ch]}
                          strokeWidth={2}
                          strokeDasharray="4 2"
                          dot={false}
                          connectNulls={false}
                          activeDot={{ r: 4 }}
                        />
                      ),
                    )}
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}

function ChartLegend({
  compare,
  showPd,
}: {
  compare: boolean;
  showPd: boolean;
}) {
  const items: {
    name: string;
    color: string;
    dash?: string;
    width?: number;
  }[] = [];

  if (compare) {
    for (const ch of COMPARE_COUNTRIES) {
      items.push({
        name: `${CHARGEABILITY_LABELS[ch]} · A (Final Action)`,
        color: CHARGEABILITY_COLORS[ch],
      });
    }
    for (const ch of COMPARE_COUNTRIES) {
      items.push({
        name: `${CHARGEABILITY_LABELS[ch]} · B (Filing)`,
        color: CHARGEABILITY_COLORS[ch],
        dash: "4 2",
      });
    }
  } else {
    items.push(
      { name: TABLE_A_NAME, color: TABLE_A_COLOR },
      { name: TABLE_B_NAME, color: TABLE_B_COLOR, dash: "4 2" },
    );
  }

  if (showPd) {
    items.push({ name: PD_NAME, color: PD_COLOR, width: 2.5 });
  }

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
              strokeWidth={item.width ?? 2.25}
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
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
  color,
  ring,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
  ring?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      } ${ring ? "ring-2 ring-offset-1 ring-slate-400" : ""}`}
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

function formatCutoffLabel(raw: string | null | undefined): string {
  if (raw === "C") return "Current (C)";
  if (raw === "U") return "Unavailable (U)";
  if (raw) return formatIsoDate(String(raw));
  return "—";
}

function ChartTooltip({
  active,
  payload,
  label,
  pd,
  pdMs,
  compare,
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
  compare: boolean;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const title = row?.title;

  const items: { key: string; name: string; color: string; display: string }[] =
    [];

  for (const item of payload) {
    const key = String(item.dataKey ?? "");

    let display = "—";
    let name = String(item.name ?? key);

    if (!compare && (key === "A" || key === "B")) {
      display = formatCutoffLabel(key === "A" ? row?.A_label : row?.B_label);
      name = key === "A" ? TABLE_A_NAME : TABLE_B_NAME;
    } else if (compare) {
      const m = /^(CHINA|INDIA)_(A|B)$/.exec(key);
      if (!m) continue;
      const ch = m[1] as CompareCountry;
      const table = m[2] as TableKind;
      const lk = `${ch}_${table}_label` as keyof ChartRow;
      display = formatCutoffLabel(row?.[lk] as string | null | undefined);
      name = `${CHARGEABILITY_LABELS[ch]} · ${table === "A" ? "A (Final Action)" : "B (Filing)"}`;
    } else {
      continue;
    }

    items.push({
      key,
      name,
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
