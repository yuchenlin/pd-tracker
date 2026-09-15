import {
  CATEGORIES,
  CHARGEABILITIES,
  TABLES,
  type Category,
  type Chargeability,
  type Cutoff,
  type TableKind,
} from "./types";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const CATEGORY_LABELS: Record<Category, string> = {
  "EB-1": "EB-1 (Priority workers)",
  "EB-2": "EB-2 (Advanced degree / NIW)",
  "EB-3": "EB-3 (Skilled / professional / other)",
  "EB-4": "EB-4 (Special immigrants)",
  "EB-5": "EB-5 (Investors, unreserved)",
};

export const CHARGEABILITY_LABELS: Record<Chargeability, string> = {
  CHINA: "China (mainland)",
  INDIA: "India",
  MEXICO: "Mexico",
  PHILIPPINES: "Philippines",
  ROW: "ROW (Rest of World)",
};

export const TABLE_LABELS: Record<TableKind, string> = {
  A: "Table A — Final Action Dates",
  B: "Table B — Dates for Filing",
};

export const CHARGEABILITY_COLORS: Record<Chargeability, string> = {
  CHINA: "#dc2626",
  INDIA: "#d97706",
  MEXICO: "#059669",
  PHILIPPINES: "#2563eb",
  ROW: "#7c3aed",
};

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? String(month);
}

export function bulletinLabel(year: number, month: number): string {
  return `${monthName(month)} ${year}`;
}

export function cutoffLabel(cutoff: Cutoff): string {
  if (cutoff === null) return "C";
  if (cutoff === "U") return "U";
  return cutoff;
}

export function cutoffDisplay(cutoff: Cutoff): string {
  if (cutoff === null) return "Current (C)";
  if (cutoff === "U") return "Unavailable (U)";
  return formatIsoDate(cutoff);
}

export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${monthName(m)} ${d}, ${y}`;
}

/** Plot Current as the bulletin month so the line sits at "now". */
export function cutoffToValue(
  cutoff: Cutoff,
  year: number,
  month: number,
): number | null {
  if (cutoff === "U") return null;
  if (cutoff === null) {
    return Date.UTC(year, month - 1, 1);
  }
  const [y, m, d] = cutoff.split("-").map(Number);
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d);
}

export function formatTickDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

const CATEGORY_ALIASES: Record<string, Category> = {
  "EB-1": "EB-1",
  EB1: "EB-1",
  "EB-2": "EB-2",
  EB2: "EB-2",
  "EB-3": "EB-3",
  EB3: "EB-3",
  "EB-4": "EB-4",
  EB4: "EB-4",
  "EB-5": "EB-5",
  EB5: "EB-5",
};

const CHARGEABILITY_ALIASES: Record<string, Chargeability> = {
  CHINA: "CHINA",
  CN: "CHINA",
  "CHINA-MAINLAND": "CHINA",
  "MAINLAND-CHINA": "CHINA",
  INDIA: "INDIA",
  IN: "INDIA",
  MEXICO: "MEXICO",
  MX: "MEXICO",
  PHILIPPINES: "PHILIPPINES",
  PH: "PHILIPPINES",
  ROW: "ROW",
  WORLDWIDE: "ROW",
  ALL: "ROW",
};

export function parseCategory(raw: string | null): Category | null {
  if (!raw) return null;
  const key = raw.trim().toUpperCase().replace(/\s+/g, "");
  return CATEGORY_ALIASES[key] ?? null;
}

export function parseChargeability(raw: string | null): Chargeability | null {
  if (!raw) return null;
  const key = raw.trim().toUpperCase().replace(/\s+/g, "-");
  return CHARGEABILITY_ALIASES[key] ?? null;
}

export function parseTable(raw: string | null): TableKind | null {
  if (!raw) return null;
  const key = raw.trim().toUpperCase();
  if (key === "A" || key === "FINAL" || key === "FAD") return "A";
  if (key === "B" || key === "FILING" || key === "DFF") return "B";
  return TABLES.includes(key as TableKind) ? (key as TableKind) : null;
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export { CATEGORIES, CHARGEABILITIES, TABLES };
