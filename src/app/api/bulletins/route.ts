import { bulletinSummary, getVisaBulletinData, listBulletins } from "@/lib/data";
import { jsonResponse, optionsResponse } from "@/lib/http";
import type { NextRequest } from "next/server";

export function OPTIONS() {
  return optionsResponse();
}

export function GET(request: NextRequest) {
  const full = request.nextUrl.searchParams.get("full") === "1";
  const data = getVisaBulletinData();
  const bulletins = listBulletins();

  return jsonResponse({
    schemaVersion: data.schemaVersion,
    source: data.source,
    count: bulletins.length,
    bulletins: full ? bulletins : bulletins.map(bulletinSummary),
  });
}
