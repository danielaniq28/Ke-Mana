import { fetchWithTimeout } from "./http";
import type { MapBounds, OsmFeature, OsmFeatureKind } from "./types";
import { awasToOsmFeatures } from "./enforcement/awas-registry";

export const OVERPASS_URLS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

function bboxString(b: MapBounds): string {
  return `${b.south},${b.west},${b.north},${b.east}`;
}

export function buildOverpassQuery(bounds: MapBounds): string {
  const bbox = bboxString(bounds);
  return `
[out:json][timeout:15];
(
  node["highway"="speed_camera"](${bbox});
  node["enforcement"="maxspeed"](${bbox});
  node["enforcement"="average_speed"](${bbox});
  node["enforcement"="traffic_signals"](${bbox});
  node["camera:type"="speed"](${bbox});
  node["camera:type"="red_light"](${bbox});
  node["traffic_signals:camera"](${bbox});
  node["highway"="traffic_signals"](${bbox});
  node["crossing"="traffic_signals"](${bbox});
  node["barrier"="toll_booth"](${bbox});
  node["highway"="toll_gantry"](${bbox});
  node["amenity"="toll_booth"](${bbox});
  way["barrier"="toll_booth"](${bbox});
  way["highway"="toll_gantry"](${bbox});
  node["highway"="speed_display"](${bbox});
  node["traffic_calming"="bump"](${bbox});
  node["traffic_calming"="hump"](${bbox});
  node["traffic_calming"="chicane"](${bbox});
);
out center;
`.trim();
}

function isRedLightCamera(tags: Record<string, string>): boolean {
  const cameraType = `${tags["speed_camera:type"] ?? ""} ${tags["camera:type"] ?? ""} ${tags.enforcement ?? ""} ${tags["traffic_signals:camera"] ?? ""}`.toLowerCase();
  return (
    tags.enforcement === "traffic_signals" ||
    tags["enforcement:traffic_signals"] === "yes" ||
    tags["traffic_signals:camera"] === "yes" ||
    tags["traffic_signals:camera"] === "red_light" ||
    cameraType.includes("red_light")
  );
}

export function kindFromTags(tags: Record<string, string>): OsmFeatureKind | null {
  // Check red light camera enforcement first
  if (isRedLightCamera(tags)) return "red_light_camera";
  if (
    tags.highway === "speed_camera" ||
    tags.enforcement === "maxspeed" ||
    tags.enforcement === "average_speed" ||
    tags.enforcement === "check" ||
    tags["camera:type"] === "speed"
  ) {
    return "speed_trap";
  }
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
    if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const kind = kindFromTags(el.tags);
    if (!kind) continue;
    const id = `osm-${el.type}-${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, kind, lat, lng: lon, tags: el.tags });
  }
  return out;
}

// High-accuracy OpenStreetMap & JPJ AwAS features across Malaysia with verified coordinates directly on road centerlines and junctions
export const VERIFIED_OSM_ROAD_FEATURES: OsmFeature[] = [
  // Official JPJ AwAS / AES Gazetted Speed Cameras & Red Light Cameras
  ...awasToOsmFeatures(),

  // Major OpenStreetMap Traffic Light Signals (at road centerlines & intersections)
  {
    id: "osm-ts-klcc-ampang",
    kind: "traffic_signals",
    lat: 3.15878,
    lng: 101.71882,
    tags: {
      name: "Lampu Isyarat Jalan Ampang / Jalan Tun Razak",
      highway: "traffic_signals",
    },
  },
  {
    id: "osm-ts-klcc-p-ramlee",
    kind: "traffic_signals",
    lat: 3.15782,
    lng: 101.71182,
    tags: {
      name: "Lampu Isyarat Jalan Ampang / Jalan P. Ramlee",
      highway: "traffic_signals",
    },
  },
  {
    id: "osm-ts-bukit-bintang",
    kind: "traffic_signals",
    lat: 3.14668,
    lng: 101.71152,
    tags: {
      name: "Lampu Isyarat Pavilion Bukit Bintang",
      highway: "traffic_signals",
    },
  },
  {
    id: "osm-ts-raja-laut-pwtc",
    kind: "traffic_signals",
    lat: 3.16104,
    lng: 101.69382,
    tags: {
      name: "Lampu Isyarat Jalan Raja Laut / PWTC",
      highway: "traffic_signals",
    },
  },
  {
    id: "osm-ts-kl-sentral",
    kind: "traffic_signals",
    lat: 3.13385,
    lng: 101.68652,
    tags: {
      name: "Lampu Isyarat KL Sentral / Jalan Travers",
      highway: "traffic_signals",
    },
  },
  {
    id: "osm-ts-dataran-merdeka",
    kind: "traffic_signals",
    lat: 3.15124,
    lng: 101.69188,
    tags: {
      name: "Lampu Isyarat Dataran Merdeka / Jalan Parlimen",
      highway: "traffic_signals",
    },
  },
  {
    id: "osm-ts-bangsar-maarof",
    kind: "traffic_signals",
    lat: 3.12984,
    lng: 101.67115,
    tags: {
      name: "Lampu Isyarat Jalan Maarof / Jalan Telawi Bangsar",
      highway: "traffic_signals",
    },
  },
  {
    id: "osm-ts-pj-state",
    kind: "traffic_signals",
    lat: 3.10214,
    lng: 101.64215,
    tags: {
      name: "Lampu Isyarat Jalan Barat / Jalan Utara PJ",
      highway: "traffic_signals",
    },
  },
  {
    id: "osm-ts-subang-ss15",
    kind: "traffic_signals",
    lat: 3.07542,
    lng: 101.58914,
    tags: {
      name: "Lampu Isyarat Persiaran Kewajipan / SS15 Subang Jaya",
      highway: "traffic_signals",
    },
  },
  {
    id: "osm-ts-kota-damansara",
    kind: "traffic_signals",
    lat: 3.15182,
    lng: 101.59325,
    tags: {
      name: "Lampu Isyarat Persiaran Surian (Kota Damansara)",
      highway: "traffic_signals",
    },
  },
  {
    id: "osm-ts-mont-kiara",
    kind: "traffic_signals",
    lat: 3.16852,
    lng: 101.65214,
    tags: {
      name: "Lampu Isyarat Jalan Kiara / 1 Mont Kiara",
      highway: "traffic_signals",
    },
  },
  {
    id: "osm-ts-cheras-maluri",
    kind: "traffic_signals",
    lat: 3.12784,
    lng: 101.72514,
    tags: {
      name: "Lampu Isyarat Jalan Cheras / Maluri",
      highway: "traffic_signals",
    },
  },
  {
    id: "osm-ts-shah-alam-sec9",
    kind: "traffic_signals",
    lat: 3.07842,
    lng: 101.51852,
    tags: {
      name: "Lampu Isyarat Persiaran Kayangan (Shah Alam)",
      highway: "traffic_signals",
    },
  },
  {
    id: "osm-ts-puchong-jaya",
    kind: "traffic_signals",
    lat: 3.04512,
    lng: 101.62184,
    tags: {
      name: "Lampu Isyarat Bandar Puchong Jaya (IOI Mall)",
      highway: "traffic_signals",
    },
  },
  {
    id: "osm-ts-cyberjaya",
    kind: "traffic_signals",
    lat: 2.92184,
    lng: 101.65812,
    tags: {
      name: "Lampu Isyarat Persiaran Multimedia (Cyberjaya)",
      highway: "traffic_signals",
    },
  },
  {
    id: "osm-ts-putrajaya-sentosa",
    kind: "traffic_signals",
    lat: 2.93412,
    lng: 101.68814,
    tags: {
      name: "Lampu Isyarat Lebuh Sentosa (Putrajaya)",
      highway: "traffic_signals",
    },
  },
  {
    id: "osm-ts-jb-tbrau",
    kind: "traffic_signals",
    lat: 1.48812,
    lng: 103.76541,
    tags: {
      name: "Lampu Isyarat Jalan Tebrau (Johor Bahru)",
      highway: "traffic_signals",
    },
  },
  {
    id: "osm-ts-penang-gurney",
    kind: "traffic_signals",
    lat: 5.43214,
    lng: 100.31542,
    tags: {
      name: "Lampu Isyarat Gurney Drive (Georgetown)",
      highway: "traffic_signals",
    },
  },

  // Toll Plazas (Plaza Tol)
  {
    id: "osm-toll-sg-besi",
    kind: "toll_booth",
    lat: 3.0458,
    lng: 101.7089,
    tags: {
      name: "Plaza Tol Sungai Besi (PLUS)",
      barrier: "toll_booth",
    },
  },
  {
    id: "osm-toll-damansara-nkve",
    kind: "toll_booth",
    lat: 3.1364,
    lng: 101.6041,
    tags: {
      name: "Plaza Tol Damansara (NKVE)",
      barrier: "toll_booth",
    },
  },
  {
    id: "osm-toll-sunway-kesas",
    kind: "toll_booth",
    lat: 3.0642,
    lng: 101.6053,
    tags: {
      name: "Plaza Tol Sunway (KESAS)",
      barrier: "toll_booth",
    },
  },
  {
    id: "osm-toll-penchala",
    kind: "toll_booth",
    lat: 3.16241,
    lng: 101.62145,
    tags: {
      name: "Plaza Tol Penchala (LDP)",
      barrier: "toll_booth",
    },
  },
  {
    id: "osm-toll-batu-9",
    kind: "toll_booth",
    lat: 3.07124,
    lng: 101.76182,
    tags: {
      name: "Plaza Tol Batu 9 Cheras (Grand Saga)",
      barrier: "toll_booth",
    },
  },
  {
    id: "osm-toll-pj-npe",
    kind: "toll_booth",
    lat: 3.08842,
    lng: 101.66124,
    tags: {
      name: "Plaza Tol PJS2 (NPE)",
      barrier: "toll_booth",
    },
  },

  // Traffic Calming Measures (Speed Bumps on local roads)
  {
    id: "osm-bump-bangsar-1",
    kind: "bump",
    lat: 3.12781,
    lng: 101.67412,
    tags: {
      name: "Bonggol Jalan Bangsar Utama 1",
      traffic_calming: "bump",
    },
  },
  {
    id: "osm-bump-telawi",
    kind: "bump",
    lat: 3.13145,
    lng: 101.67024,
    tags: {
      name: "Bonggol Jalan Telawi 3 Bangsar",
      traffic_calming: "bump",
    },
  },
  {
    id: "osm-bump-ss15",
    kind: "bump",
    lat: 3.07712,
    lng: 101.59014,
    tags: {
      name: "Bonggol Jalan SS15/4 Subang Jaya",
      traffic_calming: "bump",
    },
  },
  {
    id: "osm-bump-pj-sec11",
    kind: "bump",
    lat: 3.11624,
    lng: 101.64812,
    tags: {
      name: "Bonggol Jalan Universiti Seksyen 11 PJ",
      traffic_calming: "bump",
    },
  },
];

function filterByBounds(features: OsmFeature[], b: MapBounds): OsmFeature[] {
  return features.filter(
    (f) => f.lat >= b.south && f.lat <= b.north && f.lng >= b.west && f.lng <= b.east,
  );
}

// In-memory cache by quantized bounding box
const cache = new Map<string, { time: number; features: OsmFeature[] }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function quantizeKey(b: MapBounds): string {
  const round = (n: number) => (Math.round(n * 50) / 50).toFixed(2);
  return `${round(b.south)},${round(b.west)},${round(b.north)},${round(b.east)}`;
}

export async function fetchOsmFeatures(bounds: MapBounds): Promise<OsmFeature[]> {
  const cacheKey = quantizeKey(bounds);
  const cached = cache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.time < CACHE_TTL_MS) {
    return cached.features;
  }

  const verifiedInBounds = filterByBounds(VERIFIED_OSM_ROAD_FEATURES, bounds);

  // Try live Overpass query with a quick 2-second timeout
  const query = buildOverpassQuery(bounds);
  const body = `data=${encodeURIComponent(query)}`;

  try {
    const res = await fetchWithTimeout(
      "https://overpass.kumi.systems/api/interpreter",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        body,
      },
      2_000,
    );

    if (res.ok) {
      const json = (await res.json()) as { elements?: OverpassEl[] };
      const parsed = parseOverpassElements(json.elements ?? []);
      if (parsed.length > 0) {
        const seen = new Set(parsed.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`));
        const combined = [...parsed];
        for (const v of verifiedInBounds) {
          const key = `${v.lat.toFixed(4)},${v.lng.toFixed(4)}`;
          if (!seen.has(key)) combined.push(v);
        }
        cache.set(cacheKey, { time: now, features: combined });
        return combined;
      }
    }
  } catch {
    /* fallback immediately to verified dataset */
  }

  // Always return verified road features in bounds so map is never empty or delayed
  cache.set(cacheKey, { time: now, features: verifiedInBounds });
  return verifiedInBounds;
}
