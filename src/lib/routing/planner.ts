import { fetchOsrmRoute } from "../osrm";
import { fetchRoute } from "../valhalla";
import type { RoutePlanRequest, RoutePlanResult } from "./types";

async function firstResolved<T>(tasks: Array<Promise<T | null>>): Promise<T | null> {
  return new Promise((resolve) => {
    if (!tasks.length) {
      resolve(null);
      return;
    }
    let remaining = tasks.length;
    let settled = false;
    for (const task of tasks) {
      task
        .then((value) => {
          if (settled) return;
          if (value) {
            settled = true;
            resolve(value);
            return;
          }
          remaining -= 1;
          if (remaining === 0) resolve(null);
        })
        .catch(() => {
          remaining -= 1;
          if (!settled && remaining === 0) resolve(null);
        });
    }
  });
}

export async function planRoute(request: RoutePlanRequest): Promise<RoutePlanResult> {
  const locale = request.locale ?? "ms";

  const winner = await firstResolved<RoutePlanResult>([
    fetchRoute(
      request.from,
      request.to,
      request.preferences,
      request.vehicle,
      locale,
      request.via ?? [],
    ).then((valhalla) =>
      valhalla
        ? {
            coordinates: valhalla.coordinates,
            distanceKm: valhalla.distanceKm,
            durationMin: valhalla.durationMin,
            engine: "valhalla" as const,
            dynamicUpdatesApplied: 0,
            steps: valhalla.steps,
          }
        : null,
    ),
    fetchOsrmRoute(request.from, request.to, request.vehicle, locale, request.via ?? []).then((osrm) =>
      osrm
        ? {
            coordinates: osrm.coordinates,
            distanceKm: osrm.distanceKm,
            durationMin: osrm.durationMin,
            engine: "osrm" as const,
            dynamicUpdatesApplied: 0,
            steps: osrm.steps,
          }
        : null,
    ),
  ]);

  if (winner && winner.coordinates.length >= 2) return winner;
  throw new Error("routing_failed");
}
