import { haversineKm } from "../routing/geo";
import type { MapReport } from "../types";
import { cameraCueBand, isCameraAhead } from "./camera-alert";

export type ReportAhead = {
  report: MapReport;
  distanceM: number;
};

const ON_ROUTE_KM = 0.12;

function distToRouteKm(coords: [number, number][], point: { lat: number; lng: number }): number {
  let best = Infinity;
  for (const c of coords) {
    const d = haversineKm(point, { lat: c[1], lng: c[0] });
    if (d < best) best = d;
  }
  return best;
}

export function isReportOnRoute(
  report: MapReport,
  routeCoords: [number, number][],
): boolean {
  if (routeCoords.length < 2) return true;
  return distToRouteKm(routeCoords, report) <= ON_ROUTE_KM;
}

export function reportsAheadOnRoute(
  from: { lat: number; lng: number },
  reports: MapReport[],
  opts: {
    routeCoords?: [number, number][];
    heading?: number;
    maxM?: number;
  } = {},
): ReportAhead[] {
  const maxM = opts.maxM ?? 4000;
  const out: ReportAhead[] = [];
  for (const report of reports) {
    if (opts.routeCoords && !isReportOnRoute(report, opts.routeCoords)) continue;
    if (!isCameraAhead(from, report, opts.routeCoords, opts.heading)) continue;
    const distanceM = haversineKm(from, report) * 1000;
    if (distanceM > maxM) continue;
    out.push({ report, distanceM });
  }
  out.sort((a, b) => a.distanceM - b.distanceM);
  return out;
}

export function nearestReportAhead(
  from: { lat: number; lng: number },
  reports: MapReport[],
  opts: {
    routeCoords?: [number, number][];
    heading?: number;
    maxM?: number;
    minM?: number;
  } = {},
): ReportAhead | null {
  const minM = opts.minM ?? 40;
  const list = reportsAheadOnRoute(from, reports, opts);
  return list.find((x) => x.distanceM >= minM) ?? list[0] ?? null;
}

export { cameraCueBand };
