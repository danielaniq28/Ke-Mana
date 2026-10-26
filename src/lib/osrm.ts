import { fetchWithTimeout } from "./http";
import { instructionFor, kindFromOsrm } from "./navigation/maneuvers";
import { stepsFromPolyline } from "./navigation/polyline-steps";
import type { NavigationStep } from "./navigation/types";
import type { VehicleMode } from "./types";

type LatLng = { lat: number; lng: number };

const OSRM_URLS = [
  "https://router.project-osrm.org/route/v1",
  "https://routing.openstreetmap.de/routed-car/route/v1",
];

export interface OsrmRouteResult {
  coordinates: [number, number][];
  distanceKm: number;
  durationMin: number;
  steps: NavigationStep[];
}

export async function fetchOsrmRoute(
  from: LatLng,
  to: LatLng,
  vehicle: VehicleMode = "car",
  locale: "ms" | "en" = "en",
  via: LatLng[] = [],
): Promise<OsrmRouteResult | null> {
  const profile = vehicle === "motorcycle" ? "driving" : "driving";
  const pts = [from, ...via, to].map((p) => `${p.lng},${p.lat}`).join(";");
  const path =
    `/${profile}/` +
    pts +
    `?overview=full&geometries=geojson&steps=true`;

  for (const base of OSRM_URLS) {
    try {
      const res = await fetchWithTimeout(
        `${base}${path}`,
        { method: "GET", headers: { Accept: "application/json", "User-Agent": "KeMana/1.0" } },
        10_000,
      );
      if (!res.ok) continue;

      const json = (await res.json()) as {
        code?: string;
        routes?: Array<{
          distance?: number;
          duration?: number;
          geometry?: { coordinates?: [number, number][] };
          legs?: Array<{
            steps?: Array<{
              name?: string;
              distance?: number;
              maneuver?: { instruction?: string; type?: string; modifier?: string };
            }>;
          }>;
        }>;
      };

      if (json.code !== "Ok" || !json.routes?.[0]) continue;
      const route = json.routes[0];
      const coordinates = route.geometry?.coordinates ?? [];
      if (coordinates.length < 2) continue;

      const fromOsrm = stepsFromOsrm(route.legs ?? [], locale);
      return {
        coordinates,
        distanceKm: (route.distance ?? 0) / 1000,
        durationMin: (route.duration ?? 0) / 60,
        steps: fromOsrm.length > 0 ? fromOsrm : stepsFromPolyline(coordinates, locale),
      };
    } catch {
      continue;
    }
  }

  return null;
}

function stepsFromOsrm(
  legs: Array<{
    steps?: Array<{
      name?: string;
      distance?: number;
      maneuver?: { instruction?: string; type?: string; modifier?: string };
    }>;
  }>,
  locale: "ms" | "en",
): NavigationStep[] {
  let cumulative = 0;
  const steps: NavigationStep[] = [];

  for (const leg of legs) {
    for (const s of leg.steps ?? []) {
      const distanceM = s.distance ?? 0;
      const street = s.name?.trim() || undefined;
      const kind = kindFromOsrm(s.maneuver?.type, s.maneuver?.modifier);
      const instruction =
        s.maneuver?.instruction?.trim() || instructionFor(locale, kind, street);
      steps.push({
        instruction,
        verbalInstruction: instruction,
        street,
        kind,
        maneuverType: s.maneuver?.type,
        modifier: s.maneuver?.modifier,
        distanceM,
        cumulativeM: cumulative,
      });
      cumulative += distanceM;
    }
  }

  return steps;
}
