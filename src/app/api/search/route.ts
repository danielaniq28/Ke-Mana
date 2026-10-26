import { NextRequest, NextResponse } from "next/server";
import { searchMalaysia } from "@/lib/nominatim";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }
  const results = await searchMalaysia(q);
  return NextResponse.json({ results });
}
