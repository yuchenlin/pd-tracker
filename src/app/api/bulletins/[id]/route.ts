import { getBulletin } from "@/lib/data";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/http";
import type { NextRequest } from "next/server";

export function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bulletin = getBulletin(id);
  if (!bulletin) {
    return errorResponse(`Bulletin not found: ${id}`, 404);
  }
  return jsonResponse(bulletin);
}
