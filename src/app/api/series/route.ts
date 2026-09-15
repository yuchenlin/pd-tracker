import { getSeries } from "@/lib/data";
import {
  parseCategory,
  parseChargeability,
  parseTable,
} from "@/lib/format";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/http";
import type { Chargeability } from "@/lib/types";
import type { NextRequest } from "next/server";

export function OPTIONS() {
  return optionsResponse();
}

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const table = parseTable(params.get("table") ?? "A");
  const category = parseCategory(params.get("category"));
  const chargeabilityParam = params.get("chargeability");

  if (!table) {
    return errorResponse("Invalid table. Use A (Final Action) or B (Dates for Filing).");
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

  const unique = [...new Set(chargeabilities)];
  const series = unique.map((chargeability) => ({
    table,
    category,
    chargeability,
    points: getSeries(table, category, chargeability),
  }));

  return jsonResponse({
    table,
    category,
    series,
  });
}
