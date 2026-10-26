import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { planRoute } from "@/lib/routing/planner";
import { getSession } from "@/lib/session";
import { getProfile } from "@/lib/user-store";
import type { UserPreferences } from "@/lib/types";

const DEFAULT_PREFS: UserPreferences = {
  avoidFreeway: false,
  avoidTolls: false,
  avoidFerries: false,
};

const querySchema = z.object({
  fromLat: z.coerce.number(),
  fromLng: z.coerce.number(),
  toLat: z.coerce.number(),
  toLng: z.coerce.number(),
  via: z.string().optional(),
  vehicle: z.enum(["car", "motorcycle"]).default("car"),
  locale: z.enum(["ms", "en"]).optional(),
});

function parseVia(raw?: string): { lat: number; lng: number }[] {
  if (!raw) return [];
  return raw
    .split(";")
    .map((pair) => pair.split(",").map(Number))
    .filter((p) => p.length === 2 && p.every((n) => Number.isFinite(n)))
    .map(([lat, lng]) => ({ lat: lat!, lng: lng! }));
}

export async function GET(req: NextRequest) {
  const parsed = querySchema.safeParse({
    fromLat: req.nextUrl.searchParams.get("fromLat"),
    fromLng: req.nextUrl.searchParams.get("fromLng"),
    toLat: req.nextUrl.searchParams.get("toLat"),
    toLng: req.nextUrl.searchParams.get("toLng"),
    via: req.nextUrl.searchParams.get("via") ?? undefined,
    vehicle: req.nextUrl.searchParams.get("vehicle") ?? "car",
    locale: req.nextUrl.searchParams.get("locale") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  let preferences = DEFAULT_PREFS;
  try {
    const session = await Promise.race([
      getSession(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 800)),
    ]);
    if (session?.user?.id) preferences = getProfile(session.user.id).preferences;
  } catch {
    preferences = DEFAULT_PREFS;
  }

  try {
    const route = await planRoute({
      from: { lat: parsed.data.fromLat, lng: parsed.data.fromLng },
      to: { lat: parsed.data.toLat, lng: parsed.data.toLng },
      via: parseVia(parsed.data.via),
      preferences,
      vehicle: parsed.data.vehicle,
      locale: parsed.data.locale,
    });

    return NextResponse.json({
      route: {
        coordinates: route.coordinates,
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
        steps: route.steps,
      },
      vehicle: parsed.data.vehicle,
      preferences,
      engine: route.engine,
      dynamicUpdatesApplied: route.dynamicUpdatesApplied,
    });
  } catch {
    return NextResponse.json({ error: "routing_failed" }, { status: 502 });
  }
}
