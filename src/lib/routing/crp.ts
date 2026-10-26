import type { UserPreferences, VehicleMode } from "../types";
import type { GraphEdge, WeightMap } from "./types";

export function buildBaseWeights(edges: GraphEdge[]): WeightMap {
  const w = new Map<number, number>();
  for (const e of edges) w.set(e.id, e.baseCost);
  return w;
}

export function customizeMetrics(
  base: WeightMap,
  edges: GraphEdge[],
  preferences: UserPreferences,
  vehicle: VehicleMode,
): WeightMap {
  const weights = new Map(base);

  for (const edge of edges) {
    let cost = weights.get(edge.id) ?? edge.baseCost;
    if (preferences.avoidFreeway && edge.highway) cost *= 2.4;
    if (preferences.avoidTolls && edge.toll) cost *= 2.8;
    if (vehicle === "motorcycle" && edge.highway) cost *= 1.12;
    weights.set(edge.id, cost);
  }

  return weights;
}
