import type { GraphNode, LatLng } from "./types";

const R = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function snapToNearestNode(nodes: GraphNode[], point: LatLng): GraphNode {
  let best = nodes[0]!;
  let bestD = Infinity;
  for (const n of nodes) {
    const d = haversineKm(point, n);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

export function inBounds(
  point: LatLng,
  bounds: { south: number; west: number; north: number; east: number },
): boolean {
  return (
    point.lat >= bounds.south &&
    point.lat <= bounds.north &&
    point.lng >= bounds.west &&
    point.lng <= bounds.east
  );
}

export function pathToCoordinates(
  nodeIds: number[],
  nodes: GraphNode[],
): [number, number][] {
  return nodeIds.map((id) => {
    const n = nodes[id]!;
    return [n.lng, n.lat];
  });
}
