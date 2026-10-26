import { fetchWithTimeout } from "./http";
import type { MapBounds, OsmFeature, OsmFeatureKind } from "./types";

export const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

function bboxString(b: MapBounds): string {
  return `${b.south},${b.west},${b.north},${b.east}`;
}

export function buildOverpassQuery(bounds: MapBounds): string {
  const bbox = bboxString(bounds);
  return `
[out:json][timeout:22];
(
  node["highway"="speed_camera"](${bbox});
  node["enforcement"="maxspeed"](${bbox});
  node["enforcement"="average_speed"](${bbox});
  node["enforcement"="traffic_signals"](${bbox});
  node["highway"="speed_display"](${bbox});
  node["highway"="traffic_signals"](${bbox});
  node["crossing"="traffic_signals"](${bbox});
  node["barrier"="toll_booth"](${bbox});
  node["highway"="toll_gantry"](${bbox});
  node["amenity"="toll_booth"](${bbox});
  way["barrier"="toll_booth"](${bbox});
  way["highway"="toll_gantry"](${bbox});
  node["traffic_calming"="bump"](${bbox});
  node["traffic_calming"="hump"](${bbox});
  node["traffic_calming"="chicane"](${bbox});
);
out center;
`.trim();
}

function isRedLightCamera(tags: Record<string, string>): boolean {
  const type = `${tags["speed_camera:type"] ?? ""} ${tags["camera:type"] ?? ""} ${tags.enforcement ?? ""}`.toLowerCase();
  return (
    tags.enforcement === "traffic_signals" ||
    tags["enforcement:traffic_signals"] === "yes" ||
    type.includes("red_light") ||
    type.includes("traffic_signals")
  );
}

export function kindFromTags(tags: Record<string, string>): OsmFeatureKind | null {
  if (
    tags.barrier === "toll_booth" ||
    tags.highway === "toll_gantry" ||
    tags.amenity === "toll_booth"
  ) {
    return "toll_booth";
  }
  if (tags.highway === "traffic_signals" || tags.crossing === "traffic_signals") {
    return "traffic_signals";
  }
  if (isRedLightCamera(tags)) return "red_light_camera";
  if (
    tags.highway === "speed_camera" ||
    tags.enforcement === "maxspeed" ||
    tags.enforcement === "average_speed" ||
    tags.enforcement === "check"
  ) {
    return "speed_trap";
  }
  if (tags.highway === "speed_display") return "speed_display";
  if (tags.traffic_calming === "bump") return "bump";
  if (tags.traffic_calming === "hump") return "hump";
  if (tags.traffic_calming === "chicane") return "chicane";
  return null;
}

type OverpassEl = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

export function parseOverpassElements(elements: OverpassEl[]): OsmFeature[] {
  const out: OsmFeature[] = [];
  const seen = new Set<string>();
  for (const el of elements) {
    if (!el.tags) continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const kind = kindFromTags(el.tags);
    if (!kind) continue;
    const id = `osm-${el.type}-${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, kind, lat, lng: lon, tags: el.tags });
  }
  return out;
}

export async function fetchOsmFeatures(bounds: MapBounds): Promise<OsmFeature[]> {
  const query = buildOverpassQuery(bounds);
  const body = `data=${encodeURIComponent(query)}`;
  let lastError: unknown;

  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        },
        18_000,
      );
      if (!res.ok) {
        lastError = new Error(`Overpass error: ${res.status}`);
        continue;
      }
      const json = (await res.json()) as { elements?: OverpassEl[] };
      return parseOverpassElements(json.elements ?? []);
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Overpass failed");
}
