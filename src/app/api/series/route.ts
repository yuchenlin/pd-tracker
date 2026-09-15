import { getSeries } from "@/lib/data";
import {
  parseCategory,
  parseChargeability,
  parseTable,
} from "@/lib/format";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/http";
import type { Chargeability, TableKind } from "@/lib/types";
import type { NextRequest } from "next/server";

export function OPTIONS() {
  return optionsResponse();
}

function parseTables(raw: string | null): TableKind[] | null {
  if (!raw || raw.trim() === "" || raw.trim().toLowerCase() === "both") {
    return ["A", "B"];
  }
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return ["A", "B"];
  const tables: TableKind[] = [];
  for (const part of parts) {
    const t = parseTable(part);
    if (!t) return null;
    if (!tables.includes(t)) tables.push(t);
  }
  return tables.length ? tables : null;
}

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tables = parseTables(params.get("table"));
  const category = parseCategory(params.get("category"));
  const chargeabilityParam = params.get("chargeability");

  if (!tables) {
    return errorResponse(
      "Invalid table. Use A, B, A,B, or both (Final Action and/or Dates for Filing).",
    );
  }
  if (!category) {
    return errorResponse("Invalid or missing category. Use EB-1, EB-2, EB-3, EB-4, or EB-5.");
  }

  const chargeabilities: Chargeability[] = (chargeabilityParam ?? "CHINA")
    .split(",")
    .map((part) => parseChargeability(part.trim()))
    .filter((ch): ch is Chargeability => ch !== null);

  if (chargeabilities.length === 0) {
    return errorResponse(
      "Invalid or missing chargeability. Use CHINA, INDIA, MEXICO, PHILIPPINES, or ROW.",
    );
  }

  const uniqueChargeabilities = [...new Set(chargeabilities)];
  const series = tables.flatMap((table) =>
    uniqueChargeabilities.map((chargeability) => ({
      table,
      category,
      chargeability,
      points: getSeries(table, category, chargeability),
    })),
  );

  return jsonResponse({
    tables,
    category,
    series,
  });
}
