import { checkPriorityDate } from "@/lib/check";
import { getCutoff, getLatestBulletin, listBulletins } from "@/lib/data";
import {
  isIsoDate,
  parseCategory,
  parseChargeability,
  parseTable,
} from "@/lib/format";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/http";
import type { NextRequest } from "next/server";

export function OPTIONS() {
  return optionsResponse();
}

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const table = parseTable(params.get("table") ?? "A");
  const category = parseCategory(params.get("category"));
  const chargeability = parseChargeability(params.get("chargeability"));
  const pd = params.get("pd")?.trim() ?? "";
  const historyCount = Math.min(
    36,
    Math.max(1, Number(params.get("history") ?? 12) || 12),
  );

  if (!table) {
    return errorResponse("Invalid table. Use A or B.");
  }
  if (!category) {
    return errorResponse("Invalid or missing category. Use EB-1 … EB-5.");
  }
  if (!chargeability) {
    return errorResponse(
      "Invalid or missing chargeability. Use CHINA, INDIA, MEXICO, PHILIPPINES, or ROW.",
    );
  }
  if (!isIsoDate(pd)) {
    return errorResponse("Invalid or missing pd. Use ISO date YYYY-MM-DD.");
  }

  const latest = getLatestBulletin();
  const cutoffA = getCutoff(latest, "A", category, chargeability);
  const cutoffB = getCutoff(latest, "B", category, chargeability);
  const resultA = checkPriorityDate(pd, cutoffA);
  const resultB = checkPriorityDate(pd, cutoffB);
  const primary = table === "A" ? resultA : resultB;

  const history = listBulletins()
    .slice(-historyCount)
    .reverse()
    .map((b) => {
      const a = checkPriorityDate(pd, getCutoff(b, "A", category, chargeability));
      const bResult = checkPriorityDate(
        pd,
        getCutoff(b, "B", category, chargeability),
      );
      return {
        id: b.id,
        title: b.title,
        published: b.published,
        tableA: a,
        tableB: bResult,
      };
    });

  return jsonResponse({
    pd,
    category,
    chargeability,
    table,
    current: primary.current,
    result: primary,
    latest: {
      bulletinId: latest.id,
      title: latest.title,
      published: latest.published,
      tableA: resultA,
      tableB: resultB,
    },
    history,
  });
}
