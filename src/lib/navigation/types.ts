import type { VehicleMode } from "../types";

export type TurnKind =
  | "left"
  | "right"
  | "slight-left"
  | "slight-right"
  | "uturn"
  | "arrive"
  | "continue"
  | "exit";

export interface NavigationStep {
  instruction: string;
  verbalInstruction?: string;
  street?: string;
  kind?: TurnKind;
  maneuverType?: string;
  modifier?: string;
  distanceM: number;
  cumulativeM: number;
}

export type RouteStop = { lat: number; lng: number; label?: string };

export interface ActiveRoute {
  coordinates: [number, number][];
  destination: { lat: number; lng: number; label?: string };
  stops: RouteStop[];
  vehicle: VehicleMode;
  distanceKm: number;
  durationMin: number;
  steps: NavigationStep[];
  currentStepIndex: number;
}
