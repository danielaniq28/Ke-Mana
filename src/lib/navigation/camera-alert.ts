import { bearingBetween, shortestDelta } from "../heading";
import { haversineKm } from "../routing/geo";
import type { OsmFeature, OsmFeatureKind } from "../types";

export const CAMERA_ALERT_KINDS = new Set<OsmFeatureKind>([
  "speed_trap",
  "speed_camera",
  "red_light_camera",
]);

export type CameraAhead = {
  feature: OsmFeature;
  distanceM: number;
};

function closestCoordIndex(
  coords: [number, number][],
  point: { lat: number; lng: number },
): number {
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const c = coords[i]!;
    const d = haversineKm(point, { lat: c[1], lng: c[0] });
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  return bestI;
}

export function isCameraAhead(
  from: { lat: number; lng: number },
  camera: { lat: number; lng: number; tags?: Record<string, string> },
  routeCoords?: [number, number][],
  heading?: number,
): boolean {
  // If camera is directional (e.g. Northbound only on dual carriageway), verify driver direction
  if (heading != null && camera.tags?.bearing) {
    const camBearing = parseFloat(camera.tags.bearing);
    if (Number.isFinite(camBearing)) {
      const dir = camera.tags.direction;
      const dirDelta = Math.abs(shortestDelta(heading, camBearing));
      if (dir && dir !== "both" && dirDelta > 95) {
        return false;
      }
    }
  }

  if (routeCoords && routeCoords.length >= 2) {
    const ui = closestCoordIndex(routeCoords, from);
    const ci = closestCoordIndex(routeCoords, camera);
    if (ci > ui + 1) return true;
    if (ci + 1 < ui) return false;
  }
  if (heading == null) return true;
  return Math.abs(shortestDelta(heading, bearingBetween(from, camera))) <= 70;
}

export function nearestCameraAhead(
  from: { lat: number; lng: number },
  features: OsmFeature[],
  opts: {
    routeCoords?: [number, number][];
    heading?: number;
    maxM?: number;
    minM?: number;
  } = {},
): CameraAhead | null {
  const maxM = opts.maxM ?? 420;
  const minM = opts.minM ?? 40;
  let best: CameraAhead | null = null;
  for (const f of features) {
    if (!CAMERA_ALERT_KINDS.has(f.kind)) continue;
    if (!isCameraAhead(from, f, opts.routeCoords, opts.heading)) continue;
    const distanceM = haversineKm(from, f) * 1000;
    if (distanceM < minM || distanceM > maxM) continue;
    if (!best || distanceM < best.distanceM) best = { feature: f, distanceM };
  }
  return best;
}

export function cameraCueBand(distanceM: number): "200" | "400" | null {
  if (distanceM <= 280 && distanceM >= 120) return "200";
  if (distanceM <= 420 && distanceM > 280) return "400";
  return null;
}

export function roundedAlertMeters(distanceM: number): number {
  return Math.max(50, Math.round(distanceM / 50) * 50);
}
