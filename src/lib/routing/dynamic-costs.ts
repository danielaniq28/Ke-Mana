import type { MapReport, ReportType } from "../types";
import type { GraphEdge, GraphNode, LatLng, WeightMap } from "./types";
import { haversineKm } from "./geo";

const PENALTY: Record<ReportType, number> = {
  hazard: 1.35,
  police: 1.15,
  roadblock: 3.5,
  accident: 2.2,
  traffic: 1.6,
  flood: 4.0,
};

const INFLUENCE_KM = 0.35;

function edgeMidpoint(nodes: GraphNode[], edge: GraphEdge): LatLng {
  const a = nodes[edge.from]!;
  const b = nodes[edge.to]!;
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

export function applyLiveReportPenalties(
  base: WeightMap,
  edges: GraphEdge[],
  nodes: GraphNode[],
  reports: MapReport[],
): { weights: WeightMap; updates: number } {
  const weights = new Map(base);
  let updates = 0;

  for (const edge of edges) {
    const mid = edgeMidpoint(nodes, edge);
    let mult = 1;
    for (const r of reports) {
      const d = haversineKm(mid, r);
      if (d > INFLUENCE_KM) continue;
      const proximity = 1 - d / INFLUENCE_KM;
      const reportMult = 1 + (PENALTY[r.type] - 1) * proximity * Math.min(r.upvotes, 5) * 0.35;
      mult = Math.max(mult, reportMult);
    }
    if (mult > 1.001) {
      weights.set(edge.id, (weights.get(edge.id) ?? edge.baseCost) * mult);
      updates += 1;
    }
  }

  return { weights, updates };
}
