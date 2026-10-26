import { NextRequest, NextResponse } from "next/server";
import { fetchOsmFeatures } from "@/lib/overpass";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const south = Number(searchParams.get("south"));
  const west = Number(searchParams.get("west"));
  const north = Number(searchParams.get("north"));
  const east = Number(searchParams.get("east"));

  if ([south, west, north, east].some((n) => Number.isNaN(n))) {
    return NextResponse.json({ error: "Missing bounds" }, { status: 400 });
  }

  if (north - south > 2 || east - west > 2) {
    return NextResponse.json({ error: "Bounds too large; zoom in" }, { status: 400 });
  }

  try {
    const features = await fetchOsmFeatures({ south, west, north, east });
    return NextResponse.json({ features });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Overpass failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
