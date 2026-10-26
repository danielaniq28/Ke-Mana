import type { NavigationStep } from "../navigation/types";
import type { UserPreferences, VehicleMode } from "../types";

export type RoutingEngine = "ch_crp" | "astar" | "valhalla" | "osrm";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GraphNode {
  id: number;
  lat: number;
  lng: number;
}

export interface GraphEdge {
  id: number;
  from: number;
  to: number;
  baseCost: number;
  highway?: boolean;
  toll?: boolean;
}

export interface RoadGraph {
  name: string;
  bounds: { south: number; west: number; north: number; east: number };
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface RoutePlanRequest {
  from: LatLng;
  to: LatLng;
  via?: LatLng[];
  preferences: UserPreferences;
  vehicle: VehicleMode;
  locale?: "ms" | "en";
}

export interface RoutePlanResult {
  coordinates: [number, number][];
  distanceKm: number;
  durationMin: number;
  engine: RoutingEngine;
  dynamicUpdatesApplied: number;
  steps: NavigationStep[];
}

export type WeightMap = Map<number, number>;

export interface ChIndex {
  rank: number[];
  upAdj: Array<Array<{ to: number; edgeId: number }>>;
  downAdj: Array<Array<{ to: number; edgeId: number }>>;
}
