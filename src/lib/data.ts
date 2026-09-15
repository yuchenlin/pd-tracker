import raw from "@/data/visa-bulletins.json";
import { cutoffLabel, cutoffToValue } from "./format";
import type {
  Bulletin,
  Category,
  Chargeability,
  SeriesPoint,
  TableKind,
  VisaBulletinData,
} from "./types";

const data = raw as VisaBulletinData;

const sorted = [...data.bulletins].sort((a, b) => a.id.localeCompare(b.id));

export function getVisaBulletinData(): VisaBulletinData {
  return data;
}

export function listBulletins(): Bulletin[] {
  return sorted;
}

export function getBulletin(id: string): Bulletin | undefined {
  return sorted.find((b) => b.id === id);
}

export function getLatestBulletin(): Bulletin {
  const last = sorted[sorted.length - 1];
  if (!last) {
    throw new Error("No visa bulletin seed data loaded");
  }
  return last;
}

export function getCutoff(
  bulletin: Bulletin,
  table: TableKind,
  category: Category,
  chargeability: Chargeability,
) {
  return bulletin.tables[table][category][chargeability];
}

export function getSeries(
  table: TableKind,
  category: Category,
  chargeability: Chargeability,
): SeriesPoint[] {
  return sorted.map((b) => {
    const cutoff = getCutoff(b, table, category, chargeability);
    return {
      id: b.id,
      year: b.year,
      month: b.month,
      title: b.title,
      cutoff,
      cutoffLabel: cutoffLabel(cutoff),
      value: cutoffToValue(cutoff, b.year, b.month),
    };
  });
}

export function bulletinSummary(b: Bulletin) {
  return {
    id: b.id,
    year: b.year,
    month: b.month,
    published: b.published,
    title: b.title,
    sourceUrl: b.sourceUrl ?? null,
    uscisAosChart: b.uscisAosChart ?? null,
  };
}
