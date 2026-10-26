import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { EMPTY_BY_KIND, STOP_KINDS, fetchNearbyStops, groupNearby, type StopKind } from "@/lib/nearby-stops";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  kind: z.enum(["fuel", "parking", "food", "cafe", "toilet"]).optional(),
});

export async function GET(req: NextRequest) {
  const parsed = querySchema.safeParse({
    lat: req.nextUrl.searchParams.get("lat"),
    lng: req.nextUrl.searchParams.get("lng"),
    kind: req.nextUrl.searchParams.get("kind") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const kinds: StopKind[] = parsed.data.kind ? [parsed.data.kind] : STOP_KINDS;
  try {
    const places = await fetchNearbyStops(parsed.data, kinds);
    const byKind = { ...EMPTY_BY_KIND, ...groupNearby(places) };
    return NextResponse.json({
      nearestFuel: byKind.fuel[0] ?? null,
      byKind,
    });
  } catch {
    return NextResponse.json({ nearestFuel: null, byKind: EMPTY_BY_KIND });
  }
}
