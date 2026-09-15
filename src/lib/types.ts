export const CATEGORIES = ["EB-1", "EB-2", "EB-3", "EB-4", "EB-5"] as const;
export const CHARGEABILITIES = [
  "CHINA",
  "INDIA",
  "MEXICO",
  "PHILIPPINES",
  "ROW",
] as const;
export const TABLES = ["A", "B"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Chargeability = (typeof CHARGEABILITIES)[number];
export type TableKind = (typeof TABLES)[number];

/**
 * Cut-off encoding (DOS Visa Bulletin):
 * - null  → "C" (Current)
 * - "U"   → Unavailable
 * - "YYYY-MM-DD" → cut-off date
 */
export type Cutoff = string | null;

export type ChargeabilityMap = Record<Chargeability, Cutoff>;
export type CategoryTable = Record<Category, ChargeabilityMap>;

/** Which DOS chart USCIS says AOS filers should use this month (separate from historical A/B series). */
export type UscisAosChart = "A" | "B" | null;

export interface Bulletin {
  id: string;
  year: number;
  month: number;
  published: string;
  title: string;
  sourceUrl?: string;
  /** Independent of Table A/B history — from USCIS AOS filing-chart guidance. */
  uscisAosChart?: UscisAosChart;
  tables: {
    A: CategoryTable;
    B: CategoryTable;
  };
}

export interface VisaBulletinData {
  schemaVersion: number;
  source: string;
  notes?: Record<string, unknown>;
  updatedAt?: string;
  bulletins: Bulletin[];
}

export interface SeriesPoint {
  id: string;
  year: number;
  month: number;
  title: string;
  cutoff: Cutoff;
  cutoffLabel: string;
  /** Milliseconds since epoch for charting; omitted when Unavailable. */
  value: number | null;
}

export type PdStatus = "current" | "not-current" | "unavailable";

export interface PdCheckResult {
  status: PdStatus;
  current: boolean;
  cutoff: Cutoff;
  cutoffLabel: string;
  reason: string;
}
