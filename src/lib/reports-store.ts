import type { MapReport, ReportType } from "./types";
import { REPORT_TTL_MS } from "./report-meta";
import { CONFIRM_MAX_KM } from "./report-freshness";
import { haversineKm } from "./routing/geo";

const globalStore = globalThis as typeof globalThis & {
  __keManaReports?: MapReport[];
};

function getStore(): MapReport[] {
  if (!globalStore.__keManaReports) {
    globalStore.__keManaReports = [];
  }
  return globalStore.__keManaReports;
}

function prune(reports: MapReport[]): MapReport[] {
  const now = Date.now();
  return reports.filter((r) => new Date(r.expiresAt).getTime() > now);
}

export function listReports(bounds?: {
  south: number;
  west: number;
  north: number;
  east: number;
}): MapReport[] {
  const reports = prune(getStore()).map(normalize);
  globalStore.__keManaReports = reports;
  if (!bounds) return reports;
  return reports.filter(
    (r) =>
      r.lat >= bounds.south &&
      r.lat <= bounds.north &&
      r.lng >= bounds.west &&
      r.lng <= bounds.east,
  );
}

export function createReport(input: {
  type: ReportType;
  lat: number;
  lng: number;
  note?: string;
}): MapReport {
  const now = new Date();
  const report: MapReport = {
    id: `r-${now.getTime()}-${Math.random().toString(36).slice(2, 9)}`,
    type: input.type,
    lat: input.lat,
    lng: input.lng,
    note: input.note?.trim() || undefined,
    createdAt: now.toISOString(),
    lastConfirmedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + REPORT_TTL_MS).toISOString(),
    upvotes: 1,
    downvotes: 0,
  };
  const store = prune(getStore());
  store.push(report);
  globalStore.__keManaReports = store;
  return report;
}

function normalize(report: MapReport): MapReport {
  return {
    ...report,
    lastConfirmedAt: report.lastConfirmedAt ?? report.createdAt,
    downvotes: report.downvotes ?? 0,
  };
}

export function upvoteReport(id: string): MapReport | null {
  const store = prune(getStore());
  const idx = store.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const cur = normalize(store[idx]!);
  store[idx] = { ...cur, upvotes: cur.upvotes + 1 };
  globalStore.__keManaReports = store;
  return store[idx]!;
}

export function sightReport(
  id: string,
  stillThere: boolean,
  from: { lat: number; lng: number },
): { report: MapReport; gone: boolean } | { error: "not_found" | "too_far" } {
  const store = prune(getStore());
  const idx = store.findIndex((r) => r.id === id);
  if (idx === -1) return { error: "not_found" };
  const cur = normalize(store[idx]!);
  if (haversineKm(from, cur) > CONFIRM_MAX_KM) return { error: "too_far" };
  const now = new Date();
  if (stillThere) {
    const next: MapReport = {
      ...cur,
      upvotes: cur.upvotes + 1,
      lastConfirmedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + REPORT_TTL_MS).toISOString(),
    };
    store[idx] = next;
    globalStore.__keManaReports = store;
    return { report: next, gone: false };
  }
  const downvotes = cur.downvotes + 1;
  if (downvotes >= cur.upvotes) {
    store.splice(idx, 1);
    globalStore.__keManaReports = store;
    return { report: { ...cur, downvotes, expiresAt: now.toISOString() }, gone: true };
  }
  const next: MapReport = { ...cur, downvotes };
  store[idx] = next;
  globalStore.__keManaReports = store;
  return { report: next, gone: false };
}
