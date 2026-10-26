import { haversineKm } from "../routing/geo";
import { isStartStep } from "./maneuvers";
import type { ActiveRoute } from "./types";

export interface RouteProgress {
  distanceAlongM: number;
  distanceRemainingM: number;
  distanceToDestinationM: number;
  stepIndex: number;
  distanceToNextManeuverM: number;
}

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  return haversineKm(a, b) * 1000;
}

function distanceAlongPolyline(
  point: { lat: number; lng: number },
  coordinates: [number, number][],
): number {
  let alongM = 0;
  let bestAlong = 0;
  let bestDist = Infinity;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const a = { lat: coordinates[i]![1], lng: coordinates[i]![0] };
    const b = { lat: coordinates[i + 1]![1], lng: coordinates[i + 1]![0] };
    const segM = haversineM(a, b);
    const dA = haversineM(point, a);
    const dB = haversineM(point, b);
    const d = Math.min(dA, dB);
    if (d < bestDist) {
      bestDist = d;
      bestAlong = alongM + (dA <= dB ? 0 : segM);
    }
    alongM += segM;
  }
  return bestAlong;
}

export function computeRouteProgress(
  route: ActiveRoute,
  user: { lat: number; lng: number },
): RouteProgress {
  const totalM = route.distanceKm * 1000;
  const distanceAlongM = distanceAlongPolyline(user, route.coordinates);
  const distanceToDestinationM = haversineM(user, route.destination);

  let stepIndex = 0;
  for (let i = 0; i < route.steps.length; i++) {
    if (distanceAlongM >= route.steps[i]!.cumulativeM) stepIndex = i;
  }
  while (stepIndex < route.steps.length - 1 && isStartStep(route.steps[stepIndex]!)) {
    stepIndex += 1;
  }

  const step = route.steps[stepIndex];
  const stepEnd = step ? step.cumulativeM + step.distanceM : totalM;
  const distanceToNextManeuverM = Math.max(0, stepEnd - distanceAlongM);

  return {
    distanceAlongM,
    distanceRemainingM: Math.max(0, totalM - distanceAlongM),
    distanceToDestinationM,
    stepIndex,
    distanceToNextManeuverM,
  };
}

export type ManeuverCue = "800" | "300" | "80";

const CUE_THRESHOLDS: Record<ManeuverCue, number> = {
  "800": 800,
  "300": 300,
  "80": 80,
};

export function maneuverCueForDistance(
  distanceM: number,
  spoken: Set<string>,
  stepKey: string,
): ManeuverCue | null {
  for (const cue of ["800", "300", "80"] as ManeuverCue[]) {
    const key = `${stepKey}:${cue}`;
    if (spoken.has(key)) continue;
    if (distanceM <= CUE_THRESHOLDS[cue]) return cue;
  }
  return null;
}

export function markCueSpoken(spoken: Set<string>, stepKey: string, cue: ManeuverCue): void {
  spoken.add(`${stepKey}:${cue}`);
}
