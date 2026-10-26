import { KL_MICRO_GRAPH } from "./graph-data";
import type { ChIndex, GraphEdge, RoadGraph, WeightMap } from "./types";

type Adj = Map<number, Array<{ to: number; edgeId: number }>>;

function buildUndirectedAdj(edges: GraphEdge[], nodeCount: number): Adj {
  const adj: Adj = new Map();
  for (let i = 0; i < nodeCount; i++) adj.set(i, []);
  for (const e of edges) {
    adj.get(e.from)!.push({ to: e.to, edgeId: e.id });
    adj.get(e.to)!.push({ to: e.from, edgeId: e.id });
  }
  return adj;
}

function edgeWeight(weights: WeightMap, edges: GraphEdge[], edgeId: number): number {
  const edge = edges.find((e) => e.id === edgeId);
  return weights.get(edgeId) ?? edge?.baseCost ?? Infinity;
}

export function buildContractionHierarchy(graph: RoadGraph): ChIndex {
  const edges = [...graph.edges];
  const n = graph.nodes.length;
  const adj = buildUndirectedAdj(edges, n);

  const degree = (id: number) => adj.get(id)?.length ?? 0;
  const order = [...graph.nodes].sort((a, b) => degree(a.id) - degree(b.id)).map((x) => x.id);
  const rank = new Array<number>(n);
  order.forEach((id, i) => {
    rank[id] = i;
  });

  let nextEdgeId = edges.length;

  for (const v of order) {
    const neighbors = [...(adj.get(v) ?? [])];
    for (let i = 0; i < neighbors.length; i++) {
      for (let j = i + 1; j < neighbors.length; j++) {
        const u = neighbors[i]!.to;
        const w = neighbors[j]!.to;
        if (u === w) continue;
        const viaCost =
          edgeWeight(new Map(), edges, neighbors[i]!.edgeId) +
          edgeWeight(new Map(), edges, neighbors[j]!.edgeId);
        const edgeId = nextEdgeId++;
        const shortcut: GraphEdge = { id: edgeId, from: u, to: w, baseCost: viaCost };
        edges.push(shortcut);
        adj.get(u)!.push({ to: w, edgeId });
        adj.get(w)!.push({ to: u, edgeId });
      }
    }
    adj.set(v, []);
  }

  const upAdj: ChIndex["upAdj"] = Array.from({ length: n }, () => []);
  const downAdj: ChIndex["downAdj"] = Array.from({ length: n }, () => []);

  for (const e of edges) {
    if (rank[e.from] < rank[e.to]) {
      upAdj[e.from].push({ to: e.to, edgeId: e.id });
      downAdj[e.to].push({ to: e.from, edgeId: e.id });
    } else if (rank[e.to] < rank[e.from]) {
      upAdj[e.to].push({ to: e.from, edgeId: e.id });
      downAdj[e.from].push({ to: e.to, edgeId: e.id });
    }
  }

  graph.edges = edges;
  return { rank, upAdj, downAdj };
}

function searchWithParents(
  start: number,
  adj: Array<Array<{ to: number; edgeId: number }>>,
  weights: WeightMap,
  edges: GraphEdge[],
): { dist: Map<number, number>; parent: Map<number, number> } {
  const dist = new Map<number, number>([[start, 0]]);
  const parent = new Map<number, number>();
  const pq = new Set<number>([start]);

  while (pq.size > 0) {
    let u = -1;
    let best = Infinity;
    for (const id of pq) {
      const d = dist.get(id) ?? Infinity;
      if (d < best) {
        best = d;
        u = id;
      }
    }
    pq.delete(u);

    for (const { to, edgeId } of adj[u] ?? []) {
      const w = edgeWeight(weights, edges, edgeId);
      const alt = (dist.get(u) ?? Infinity) + w;
      if (alt < (dist.get(to) ?? Infinity)) {
        dist.set(to, alt);
        parent.set(to, u);
        pq.add(to);
      }
    }
  }
  return { dist, parent };
}

export function queryContractionHierarchy(
  graph: RoadGraph,
  ch: ChIndex,
  weights: WeightMap,
  start: number,
  goal: number,
): number[] | null {
  if (start === goal) return [start];

  const edges = graph.edges;
  const fwd = searchWithParents(start, ch.upAdj, weights, edges);
  const bwd = searchWithParents(goal, ch.downAdj, weights, edges);

  let meet = -1;
  let best = Infinity;
  for (const [node, dF] of fwd.dist) {
    const dB = bwd.dist.get(node);
    if (dB == null) continue;
    const total = dF + dB;
    if (total < best) {
      best = total;
      meet = node;
    }
  }
  if (meet === -1) return null;

  const pathStart: number[] = [];
  let cur: number | undefined = meet;
  while (cur !== undefined) {
    pathStart.unshift(cur);
    if (cur === start) break;
    cur = fwd.parent.get(cur);
  }

  const pathGoal: number[] = [];
  cur = meet;
  while (cur !== undefined) {
    if (cur !== meet) pathGoal.push(cur);
    if (cur === goal) break;
    cur = bwd.parent.get(cur);
  }

  if (pathStart[0] !== start || (pathGoal.length && pathGoal[pathGoal.length - 1] !== goal)) {
    return null;
  }

  return [...pathStart, ...pathGoal];
}

type ChBundle = { ch: ChIndex; graph: RoadGraph };

let cached: ChBundle | null = null;

export function getChBundle(): ChBundle {
  if (cached) return cached;
  const graph = structuredClone(KL_MICRO_GRAPH);
  const ch = buildContractionHierarchy(graph);
  cached = { ch, graph };
  return cached;
}
