import type { ReportType } from "./types";

export const REPORT_TTL_MS = 2 * 60 * 60 * 1000;

export const REPORT_ICONS: Record<ReportType, string> = {
  hazard: "⚠️",
  police: "👮",
  roadblock: "🚧",
  accident: "💥",
  traffic: "🚗",
  flood: "🌊",
};

export const REPORT_COLORS: Record<ReportType, string> = {
  hazard: "#f59e0b",
  police: "#3b82f6",
  roadblock: "#ef4444",
  accident: "#dc2626",
  traffic: "#ef4444",
  flood: "#06b6d4",
};

export const OSM_COLORS: Record<string, string> = {
  speed_camera: "#a855f7",
  speed_trap: "#a855f7",
  red_light_camera: "#ef4444",
  toll_booth: "#f5b800",
  traffic_signals: "#22c55e",
  bump: "#7c3aed",
  hump: "#7c3aed",
  chicane: "#7c3aed",
  speed_display: "#38bdf8",
};

export const OSM_ICONS: Record<string, string> = {
  speed_camera: "📷",
  speed_trap: "📷",
  red_light_camera: "📸",
  toll_booth: "🎫",
  traffic_signals: "🚥",
  bump: "〰",
  hump: "〰",
  chicane: "〰",
  speed_display: "📟",
};
