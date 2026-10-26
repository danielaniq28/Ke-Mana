export type ReportType =
  | "hazard"
  | "police"
  | "roadblock"
  | "accident"
  | "traffic"
  | "flood";

export type OsmFeatureKind =
  | "speed_camera"
  | "speed_trap"
  | "red_light_camera"
  | "toll_booth"
  | "traffic_signals"
  | "bump"
  | "hump"
  | "chicane"
  | "speed_display";

export interface MapReport {
  id: string;
  type: ReportType;
  lat: number;
  lng: number;
  note?: string;
  createdAt: string;
  lastConfirmedAt: string;
  expiresAt: string;
  upvotes: number;
  downvotes: number;
}

export interface OsmFeature {
  id: string;
  kind: OsmFeatureKind;
  lat: number;
  lng: number;
  tags: Record<string, string>;
}

export interface MapBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface SavedPlace {
  label: string;
  lat: number;
  lng: number;
  address?: string;
}

export type VehicleMode = "car" | "motorcycle";

export type SearchDestination = {
  placeId: number;
  label: string;
  address: string;
  lat: number;
  lng: number;
};

export interface UserPreferences {
  avoidFreeway: boolean;
  avoidTolls: boolean;
  avoidFerries: boolean;
}

export interface UserProfile {
  userId: string;
  home?: SavedPlace;
  work?: SavedPlace;
  locale?: "ms" | "en";
  preferences: UserPreferences;
}
