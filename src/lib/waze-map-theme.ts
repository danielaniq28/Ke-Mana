import type { Map as MaplibreMap } from "maplibre-gl";

export const WAZE_MAP_COLORS = {
  background: "#1c2836",
  water: "#15202c",
  highway: "#c45c6a",
  highwayCasing: "#8a3d4a",
  freewayLink: "#d98a4a",
  road: "#3d4c5c",
  roadCasing: "#2a3440",
  park: "#1e2e28",
  parkOpacity: 0.55,
  building: "#243140",
};

const PARK_LAYERS = [
  "landcover",
  "park_national_park",
  "park_nature_reserve",
  "landuse",
];

const HIGHWAY_FILL_LAYERS = [
  "road_mot_fill_noramp",
  "road_mot_fill_ramp",
  "road_trunk_fill_noramp",
  "road_trunk_fill_ramp",
  "tunnel_mot_fill",
  "tunnel_trunk_fill",
  "bridge_mot_fill",
  "bridge_trunk_fill",
];

const HIGHWAY_CASE_LAYERS = [
  "road_mot_case_noramp",
  "road_mot_case_ramp",
  "road_trunk_case_noramp",
  "road_trunk_case_ramp",
  "tunnel_mot_case",
  "tunnel_trunk_case",
  "bridge_mot_case",
  "bridge_trunk_case",
];

const PRIMARY_FILL_LAYERS = [
  "road_pri_fill_noramp",
  "road_pri_fill_ramp",
  "road_sec_fill_noramp",
  "tunnel_pri_fill",
  "tunnel_sec_fill",
  "bridge_pri_fill",
  "bridge_sec_fill",
];

const PRIMARY_CASE_LAYERS = [
  "road_pri_case_noramp",
  "road_pri_case_ramp",
  "road_sec_case_noramp",
  "tunnel_pri_case",
  "tunnel_sec_case",
  "bridge_pri_case",
  "bridge_sec_case",
];

function setPaint(map: MaplibreMap, layerId: string, prop: string, value: unknown): void {
  if (!map.getLayer(layerId)) return;
  try {
    map.setPaintProperty(layerId, prop, value);
  } catch {
    /* ignore */
  }
}

export function applyWazeMapTheme(map: MaplibreMap): void {
  const c = WAZE_MAP_COLORS;

  setPaint(map, "background", "background-color", c.background);
  setPaint(map, "water", "fill-color", c.water);
  setPaint(map, "water_shadow", "fill-color", c.water);
  setPaint(map, "waterway", "line-color", c.water);
  setPaint(map, "landuse_residential", "fill-color", c.background);

  for (const id of PARK_LAYERS) {
    setPaint(map, id, "fill-color", c.park);
    setPaint(map, id, "fill-opacity", c.parkOpacity);
  }

  setPaint(map, "building", "fill-color", c.building);
  setPaint(map, "building-top", "fill-color", c.building);

  for (const id of HIGHWAY_CASE_LAYERS) {
    setPaint(map, id, "line-color", c.highwayCasing);
  }

  for (const id of HIGHWAY_FILL_LAYERS) {
    const color = id.includes("ramp") || id.includes("_ramp") ? c.freewayLink : c.highway;
    setPaint(map, id, "line-color", color);
  }

  for (const id of PRIMARY_CASE_LAYERS) {
    setPaint(map, id, "line-color", c.roadCasing);
  }

  for (const id of PRIMARY_FILL_LAYERS) {
    setPaint(map, id, "line-color", c.road);
  }
}
