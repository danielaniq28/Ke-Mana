import { fetchWithTimeout } from "./http";
import { OVERPASS_URLS } from "./overpass";
import { haversineKm } from "./routing/geo";

export type StopKind = "fuel" | "parking" | "food" | "cafe" | "toilet";

export type NearbyPlace = {
  id: string;
  kind: StopKind;
  name: string;
  lat: number;
  lng: number;
  distanceKm: number;
};

export const STOP_KINDS: StopKind[] = ["fuel", "parking", "food", "cafe", "toilet"];

export const EMPTY_BY_KIND: Record<StopKind, NearbyPlace[]> = {
  fuel: [],
  parking: [],
  food: [],
  cafe: [],
  toilet: [],
};

const MAX_KM = 14;
const CACHE_MS = 8 * 60_000;
const UA = "Ke-Mana/1.0 (community navigation)";

const PHOTON_Q: Record<StopKind, string[]> = {
  fuel: ["petrol", "Petronas", "Shell", "Caltex"],
  parking: ["parking"],
  food: ["restaurant", "mamak"],
  cafe: ["cafe"],
  toilet: ["toilet"],
};

const OSM_TAGS: Record<StopKind, string[]> = {
  fuel: ["amenity:fuel"],
  parking: ["amenity:parking"],
  food: ["amenity:restaurant", "amenity:fast_food"],
  cafe: ["amenity:cafe"],
  toilet: ["amenity:toilets"],
};

const NOMINATIM_Q: Record<StopKind, string[]> = {
  fuel: ["petrol station", "Petronas"],
  parking: ["parking"],
  food: ["restaurant", "fast food"],
  cafe: ["cafe", "Starbucks"],
  toilet: ["toilet"],
};

const OVERPASS_AMENITY: Record<StopKind, string> = {
  fuel: "fuel",
  parking: "parking",
  food: "restaurant",
  cafe: "cafe",
  toilet: "toilets",
};

const DEFAULT_NAME: Record<StopKind, string> = {
  fuel: "Petrol station",
  parking: "Parking",
  food: "Food",
  cafe: "Cafe",
  toilet: "Toilets",
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_type?: string;
    osm_id?: number;
    name?: string;
    street?: string;
  };
};

const cache = new Map<string, { at: number; places: NearbyPlace[] }>();

function cacheKey(origin: { lat: number; lng: number }, kind: StopKind): string {
  return `${kind}:${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}`;
}

function readCache(origin: { lat: number; lng: number }, kind: StopKind): NearbyPlace[] | null {
  const hit = cache.get(cacheKey(origin, kind));
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_MS) {
    cache.delete(cacheKey(origin, kind));
    return null;
  }
  return hit.places;
}

function writeCache(origin: { lat: number; lng: number }, kind: StopKind, places: NearbyPlace[]) {
  cache.set(cacheKey(origin, kind), { at: Date.now(), places });
}

function mergePlaces(chunks: NearbyPlace[][]): NearbyPlace[] {
  const seen = new Set<string>();
  const out: NearbyPlace[] = [];
  for (const chunk of chunks) {
    for (const p of chunk) {
      const k = `${p.kind}:${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
      if (seen.has(k) || seen.has(p.id)) continue;
      seen.add(k);
      seen.add(p.id);
      out.push(p);
    }
  }
  out.sort((a, b) => a.distanceKm - b.distanceKm);
  return out.slice(0, 12);
}

async function retry<T>(fn: () => Promise<T>, times = 2): Promise<T> {
  let last: unknown;
  for (let i = 0; i < times; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 280 * (i + 1)));
    }
  }
  throw last instanceof Error ? last : new Error("retry_failed");
}

async function fetchPhotonQuery(
  origin: { lat: number; lng: number },
  kind: StopKind,
  q: string,
): Promise<NearbyPlace[]> {
  const params = new URLSearchParams({
    q,
    lat: String(origin.lat),
    lon: String(origin.lng),
    limit: "15",
    lang: "en",
    location_bias_scale: "0.2",
  });
  for (const tag of OSM_TAGS[kind]) params.append("osm_tag", tag);
  const res = await fetchWithTimeout(
    `https://photon.komoot.io/api/?${params}`,
    { method: "GET", headers: { Accept: "application/json", "User-Agent": UA } },
    6_000,
  );
  if (!res.ok) throw new Error(`photon ${res.status}`);
  const json = (await res.json()) as { features?: PhotonFeature[] };
  const out: NearbyPlace[] = [];
  for (const f of json.features ?? []) {
    const lng = f.geometry?.coordinates?.[0];
    const lat = f.geometry?.coordinates?.[1];
    if (lat == null || lng == null) continue;
    const distanceKm = haversineKm(origin, { lat, lng });
    if (distanceKm > MAX_KM) continue;
    out.push({
      id: `stop-${f.properties?.osm_type ?? "n"}-${f.properties?.osm_id ?? `${lat},${lng}`}`,
      kind,
      name: f.properties?.name?.trim() || f.properties?.street?.trim() || DEFAULT_NAME[kind],
      lat,
      lng,
      distanceKm,
    });
  }
  return out;
}

async function fetchPhotonKind(
  origin: { lat: number; lng: number },
  kind: StopKind,
): Promise<NearbyPlace[]> {
  const q = PHOTON_Q[kind][0];
  if (!q) return [];
  return retry(() => fetchPhotonQuery(origin, kind, q)).catch(() => [] as NearbyPlace[]);
}

let nominatimQueue: Promise<void> = Promise.resolve();

function enqueueNominatim<T>(fn: () => Promise<T>): Promise<T> {
  const run = nominatimQueue.then(fn, fn);
  nominatimQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function fetchNominatimAmenity(
  origin: { lat: number; lng: number },
  kind: StopKind,
  q: string,
): Promise<NearbyPlace[]> {
  const d = 0.1;
  const params = new URLSearchParams({
    format: "json",
    q,
    viewbox: `${origin.lng - d},${origin.lat + d},${origin.lng + d},${origin.lat - d}`,
    bounded: "1",
    limit: "15",
    countrycodes: "my",
  });
  const res = await fetchWithTimeout(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { method: "GET", headers: { Accept: "application/json", "User-Agent": UA } },
    6_000,
  );
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const json = (await res.json()) as Array<{
    place_id?: number;
    display_name?: string;
    lat?: string;
    lon?: string;
  }>;
  const out: NearbyPlace[] = [];
  for (const r of json) {
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const distanceKm = haversineKm(origin, { lat, lng });
    if (distanceKm > MAX_KM) continue;
    const label = r.display_name?.split(",")[0]?.trim() || DEFAULT_NAME[kind];
    out.push({
      id: `nom-${r.place_id ?? `${lat},${lng}`}`,
      kind,
      name: label,
      lat,
      lng,
      distanceKm,
    });
  }
  return out;
}

async function fetchNominatimKind(
  origin: { lat: number; lng: number },
  kind: StopKind,
): Promise<NearbyPlace[]> {
  const q = NOMINATIM_Q[kind][0];
  if (!q) return [];
  try {
    return await retry(() => enqueueNominatim(() => fetchNominatimAmenity(origin, kind, q)));
  } catch {
    return [];
  }
}

async function fetchOverpassKind(
  origin: { lat: number; lng: number },
  kind: StopKind,
): Promise<NearbyPlace[]> {
  const amenity = OVERPASS_AMENITY[kind];
  const query = `
[out:json][timeout:10];
node["amenity"="${amenity}"](around:9000,${origin.lat},${origin.lng});
out 40;
`.trim();
  const body = `data=${encodeURIComponent(query)}`;
  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
          body,
        },
        9_000,
      );
      if (!res.ok) continue;
      const json = (await res.json()) as {
        elements?: Array<{ id: number; lat?: number; lon?: number; tags?: Record<string, string> }>;
      };
      const out: NearbyPlace[] = [];
      for (const el of json.elements ?? []) {
        if (el.lat == null || el.lon == null) continue;
        const distanceKm = haversineKm(origin, { lat: el.lat, lng: el.lon });
        if (distanceKm > MAX_KM) continue;
        out.push({
          id: `osm-n-${el.id}`,
          kind,
          name: el.tags?.name?.trim() || el.tags?.brand?.trim() || DEFAULT_NAME[kind],
          lat: el.lat,
          lng: el.lon,
          distanceKm,
        });
      }
      if (out.length) return mergePlaces([out]);
    } catch {
      continue;
    }
  }
  return [];
}

async function fillKind(
  origin: { lat: number; lng: number },
  kind: StopKind,
  seed: NearbyPlace[],
  thorough: boolean,
): Promise<NearbyPlace[]> {
  if (seed.length && !thorough) {
    writeCache(origin, kind, seed);
    return seed;
  }
  let merged = seed;
  if (!merged.length || (thorough && merged.length < 3)) {
    merged = mergePlaces([merged, await fetchNominatimKind(origin, kind)]);
  }
  if (thorough && !merged.length) {
    merged = mergePlaces([merged, await fetchOverpassKind(origin, kind)]);
  }
  if (merged.length) writeCache(origin, kind, merged);
  return merged;
}

export function groupNearby(places: NearbyPlace[]): Record<StopKind, NearbyPlace[]> {
  const grouped: Record<StopKind, NearbyPlace[]> = {
    fuel: [],
    parking: [],
    food: [],
    cafe: [],
    toilet: [],
  };
  for (const p of places) {
    if (grouped[p.kind].length >= 12) continue;
    grouped[p.kind].push(p);
  }
  return grouped;
}

export async function fetchNearbyStops(
  origin: { lat: number; lng: number },
  kinds: StopKind[] = STOP_KINDS,
): Promise<NearbyPlace[]> {
  const photonOrCache = await Promise.all(
    kinds.map(async (kind) => {
      const cached = readCache(origin, kind);
      if (cached?.length) return cached;
      return fetchPhotonKind(origin, kind).catch(() => [] as NearbyPlace[]);
    }),
  );

  const thorough = kinds.length === 1;
  const filled = await Promise.all(
    kinds.map((kind, i) => fillKind(origin, kind, photonOrCache[i] ?? [], thorough)),
  );

  return mergePlaces(filled);
}
