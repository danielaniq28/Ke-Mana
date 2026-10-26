import { haversineKm } from "../routing/geo";
import type { MapReport } from "../types";
import { isReportOnRoute } from "./report-alert";

const JAM_ALONG_KM = 0.5;

export const JAM_FLOW_DASHES: number[][] = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0],
  [0, 0.5, 3, 3.5],
  [0, 1, 3, 3],
  [0, 1.5, 3, 2.5],
  [0, 2, 3, 2],
  [0, 2.5, 3, 1.5],
  [0, 3, 3, 1],
  [0, 3.5, 3, 0.5],
];

export function jamFlowDashAt(timeMs: number): number[] {
  const i = Math.floor(timeMs / 55) % JAM_FLOW_DASHES.length;
  return JAM_FLOW_DASHES[i]!;
}

function cumulativeKm(coords: [number, number][]): number[] {
  const acc = [0];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1]!;
    const b = coords[i]!;
    acc.push(
      acc[i - 1]! +
        haversineKm({ lat: a[1], lng: a[0] }, { lat: b[1], lng: b[0] }),
    );
  }
  return acc;
}

function jamVertexFlags(
  coords: [number, number][],
  reports: MapReport[],
): boolean[] {
  const flags = coords.map(() => false);
  const jams = reports.filter((r) => r.type === "traffic" && isReportOnRoute(r, coords));
  if (!jams.length) return flags;
  const cum = cumulativeKm(coords);
  for (const jam of jams) {
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < coords.length; i++) {
      const c = coords[i]!;
      const d = haversineKm(jam, { lat: c[1], lng: c[0] });
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    const s = cum[bestI]!;
    for (let i = 0; i < coords.length; i++) {
      if (Math.abs(cum[i]! - s) <= JAM_ALONG_KM) flags[i] = true;
    }
  }
  return flags;
}

export function routeTrafficGeoJson(
  coords: [number, number][],
  reports: MapReport[],
): GeoJSON.FeatureCollection {
  if (coords.length < 2) {
    return { type: "FeatureCollection", features: [] };
  }
  const flags = jamVertexFlags(coords, reports);
  const segs: { jam: boolean; coordinates: [number, number][] }[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const jam = flags[i]! || flags[i + 1]!;
    const a = coords[i]!;
    const b = coords[i + 1]!;
    const last = segs[segs.length - 1];
    if (last && last.jam === jam) {
      last.coordinates.push(b);
    } else {
      segs.push({ jam, coordinates: [a, b] });
    }
  }
  return {
    type: "FeatureCollection",
    features: segs.map((s) => ({
      type: "Feature" as const,
      properties: { jam: s.jam },
      geometry: { type: "LineString" as const, coordinates: s.coordinates },
    })),
  };
}
