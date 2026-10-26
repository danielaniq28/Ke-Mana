import type { MapReport, ReportType } from "./types";

export const CONFIRMABLE_REPORTS = new Set<ReportType>([
  "hazard",
  "accident",
  "police",
  "roadblock",
]);

export const AGE_TINT_REPORTS = new Set<ReportType>(["police", "roadblock"]);

export const CONFIRM_MAX_KM = 0.35;
export const REPORT_NEW_MS = 10 * 60 * 1000;
export const REPORT_STALE_MS = 40 * 60 * 1000;

export type ReportFreshness = "new" | "aging" | "stale";

export function reportAnchorMs(report: MapReport): number {
  return new Date(report.lastConfirmedAt ?? report.createdAt).getTime();
}

export function reportFreshness(report: MapReport, now = Date.now()): ReportFreshness {
  const age = now - reportAnchorMs(report);
  if (age < REPORT_NEW_MS) return "new";
  if (age < REPORT_STALE_MS) return "aging";
  return "stale";
}
