import type { ActiveRoute, NavigationStep, RouteStop } from "./types";
import type { VehicleMode } from "../types";

export function createActiveRoute(input: {
  coordinates: [number, number][];
  destination: { lat: number; lng: number; label?: string };
  stops?: RouteStop[];
  vehicle: VehicleMode;
  distanceKm: number;
  durationMin: number;
  steps: NavigationStep[];
}): ActiveRoute {
  return {
    ...input,
    stops: input.stops ?? [],
    currentStepIndex: 0,
  };
}

export function destinationFromRoute(route: ActiveRoute): { lat: number; lng: number } {
  const last = route.coordinates[route.coordinates.length - 1];
  if (last) return { lat: last[1], lng: last[0] };
  return route.destination;
}
