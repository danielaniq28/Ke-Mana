import type { SearchDestination } from "@/lib/types";

const KEY = "km-recent-places";
const MAX = 8;

export function loadRecents(): SearchDestination[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SearchDestination[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecent(place: SearchDestination): SearchDestination[] {
  const next = [place, ...loadRecents().filter((p) => p.placeId !== place.placeId)].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
