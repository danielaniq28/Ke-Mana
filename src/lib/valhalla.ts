import { fetchWithTimeout } from "./http";
import { instructionFor, kindFromValhalla } from "./navigation/maneuvers";
import type { NavigationStep } from "./navigation/types";
import type { UserPreferences, VehicleMode } from "./types";

type LatLng = { lat: number; lng: number };

const VALHALLA_HOSTS = ["https://valhalla1.openstreetmap.de"];
const VALHALLA_TIMEOUT_MS = 12_000;

export interface ValhallaRouteResult {
  coordinates: [number, number][];
  distanceKm: number;
  durationMin: number;
  steps: NavigationStep[];
}

type ValhallaManeuver = {
  type?: number;
  instruction?: string;
  verbal_pre_transition_instruction?: string;
  street_names?: string[];
  begin_street_names?: string[];
  length?: number;
};

function costingFor(vehicle: VehicleMode): string[] {
  return vehicle === "motorcycle" ? ["motor_scooter", "motorcycle", "auto"] : ["auto"];
}

function requestBody(
  points: LatLng[],
  costing: string,
  preferences: UserPreferences,
) {
  return {
    locations: points.map((p) => ({ lat: p.lat, lon: p.lng, type: "break" })),
    costing,
    costing_options: {
      [costing]: {
        use_highways: preferences.avoidFreeway ? 0 : 1,
        use_tolls: preferences.avoidTolls ? 0 : 1,
        use_ferry: preferences.avoidFerries ? 0 : 1,
      },
    },
    units: "kilometers",
    language: "en-US",
  };
}

export async function fetchRoute(
  from: LatLng,
  to: LatLng,
  preferences: UserPreferences,
  vehicle: VehicleMode = "car",
  _language: "ms" | "en" = "en",
  via: LatLng[] = [],
): Promise<ValhallaRouteResult | null> {
  const points = [from, ...via, to];
  for (const costing of costingFor(vehicle)) {
    const body = requestBody(points, costing, preferences);
    const jsonParam = encodeURIComponent(JSON.stringify(body));

    for (const host of VALHALLA_HOSTS) {
      const parsed = await tryValhalla(
        `${host}/route?json=${jsonParam}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
        },
        _language,
      );
      if (parsed) return parsed;

      const posted = await tryValhalla(
        `${host}/route`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(body),
        },
        _language,
      );
      if (posted) return posted;
    }
  }

  return null;
}

async function tryValhalla(
  url: string,
  init: RequestInit,
  locale: "ms" | "en" = "en",
): Promise<ValhallaRouteResult | null> {
  try {
    const res = await fetchWithTimeout(url, init, VALHALLA_TIMEOUT_MS);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      trip?: {
        summary?: { length?: number; time?: number };
        legs?: Array<{
          summary?: { length?: number; time?: number };
          shape?: string;
          maneuvers?: ValhallaManeuver[];
        }>;
      };
    };
    const trip = json.trip;
    const legs = trip?.legs ?? [];
    if (!legs.length) return null;

    const coordinates: [number, number][] = [];
    const steps: NavigationStep[] = [];
    let distanceKm = 0;
    let durationMin = 0;
    let cumulativeM = 0;

    for (const leg of legs) {
      if (leg.shape) {
        const part = decodeShape(leg.shape);
        if (coordinates.length && part.length) part.shift();
        coordinates.push(...part);
      }
      distanceKm += leg.summary?.length ?? 0;
      durationMin += (leg.summary?.time ?? 0) / 60;
      const legSteps = parseManeuvers(leg.maneuvers ?? [], locale);
      for (const s of legSteps) {
        steps.push({ ...s, cumulativeM: cumulativeM + s.cumulativeM });
      }
      const last = legSteps[legSteps.length - 1];
      cumulativeM += (last ? last.cumulativeM + last.distanceM : 0);
    }

    if (coordinates.length < 2) return null;
    const summary = trip?.summary;
    return {
      coordinates,
      distanceKm: summary?.length ?? distanceKm,
      durationMin: summary?.time != null ? summary.time / 60 : durationMin,
      steps: steps.length ? steps : parseManeuvers([], locale),
    };
  } catch {
    return null;
  }
}

function parseManeuvers(maneuvers: ValhallaManeuver[], locale: "ms" | "en"): NavigationStep[] {
  let cumulative = 0;
  const steps: NavigationStep[] = [];

  for (const m of maneuvers) {
    const distanceM = (m.length ?? 0) * 1000;
    const street = (m.street_names ?? m.begin_street_names ?? []).filter(Boolean).join(" / ");
    const kind = kindFromValhalla(m.type);
    const instruction =
      m.instruction?.trim() || instructionFor(locale, kind, street || undefined);
    const verbal = m.verbal_pre_transition_instruction?.trim();
    steps.push({
      instruction,
      verbalInstruction: verbal || instruction,
      street: street || undefined,
      kind,
      maneuverType: String(m.type ?? ""),
      distanceM,
      cumulativeM: cumulative,
    });
    cumulative += distanceM;
  }

  if (!steps.length) {
    steps.push({ instruction: "Continue", distanceM: 0, cumulativeM: 0 });
  }

  return steps;
}

function decodeShape(encoded: string): [number, number][] {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: [number, number][] = [];

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push([lng / 1e6, lat / 1e6]);
  }

  return coordinates;
}
