import type { RoadGraph, WeightMap } from "./types";

function buildAdj(graph: RoadGraph): Map<number, Array<{ to: number; edgeId: number }>> {
  const adj = new Map<number, Array<{ to: number; edgeId: number }>>();
  for (const n of graph.nodes) adj.set(n.id, []);
  for (const e of graph.edges) {
    adj.get(e.from)!.push({ to: e.to, edgeId: e.id });
    adj.get(e.to)!.push({ to: e.from, edgeId: e.id });
  }
  return adj;
}

export function astarPath(
  graph: RoadGraph,
  weights: WeightMap,
  start: number,
  goal: number,
): number[] | null {
  const adj = buildAdj(graph);
  const nodes = graph.nodes;
  const goalNode = nodes[goal]!;

  const h = (id: number) => {
    const n = nodes[id]!;
    const dx = (n.lat - goalNode.lat) * 111;
    const dy = (n.lng - goalNode.lng) * 111 * Math.cos((n.lat * Math.PI) / 180);
    return Math.sqrt(dx * dx + dy * dy);
  };

  const open = new Set<number>([start]);
  const cameFrom = new Map<number, number>();
  const g = new Map<number, number>([[start, 0]]);
  const f = new Map<number, number>([[start, h(start)]]);

  while (open.size > 0) {
    let current = -1;
    let bestF = Infinity;
    for (const id of open) {
      const score = f.get(id) ?? Infinity;
      if (score < bestF) {
        bestF = score;
        current = id;
      }
    }
    if (current === goal) {
      const path = [current];
      while (cameFrom.has(path[0]!)) path.unshift(cameFrom.get(path[0]!)!);
      return path;
    }
    open.delete(current);

    for (const { to, edgeId } of adj.get(current) ?? []) {
      const w = weights.get(edgeId);
      if (w == null) continue;
      const tentative = (g.get(current) ?? Infinity) + w;
      if (tentative < (g.get(to) ?? Infinity)) {
        cameFrom.set(to, current);
        g.set(to, tentative);
        f.set(to, tentative + h(to));
        open.add(to);
      }
    }
  }
  return null;
}
