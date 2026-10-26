"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { reportLabel, t, type CopyKey, type Locale } from "@/lib/i18n";
import type { MapReport, SearchDestination, VehicleMode } from "@/lib/types";
import { loadRecents, pushRecent } from "@/lib/recents";
import { usePresence } from "@/hooks/usePresence";
import { EMPTY_BY_KIND, STOP_KINDS, type NearbyPlace, type StopKind } from "@/lib/nearby-stops";
import { arrivalClock, formatDistanceM } from "@/lib/maneuver-ui";
import { REPORT_ICONS } from "@/lib/report-meta";

type Result = { place_id: number; display_name: string; lat: string; lon: string };

export type RoutePreviewData = {
  distanceKm: number;
  durationMin: number;
  vehicle: VehicleMode;
  loading: boolean;
  events: { report: MapReport; distanceM: number }[];
};

type Props = {
  locale: Locale;
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
  onPick?: (lat: number, lng: number) => void;
  onSelectDestination?: (dest: SearchDestination | null) => void;
  onNavigate?: (dest: SearchDestination, vehicle: VehicleMode) => void;
  onPrimeSpeech?: () => void;
  onHome?: () => void;
  onWork?: () => void;
  hasHome: boolean;
  hasWork: boolean;
  docked?: boolean;
  navigating?: boolean;
  onAddStop?: (dest: SearchDestination) => void;
  origin?: { lat: number; lng: number } | null;
  previewData?: RoutePreviewData | null;
  onVehicleChange?: (vehicle: VehicleMode) => void;
  onCancelPreview?: () => void;
};

const STOP_CAT: Record<StopKind, { icon: string; key: CopyKey }> = {
  fuel: { icon: "⛽", key: "stopCatFuel" },
  parking: { icon: "🅿️", key: "stopCatParking" },
  food: { icon: "🍔", key: "stopCatFood" },
  cafe: { icon: "☕", key: "stopCatCafe" },
  toilet: { icon: "🚻", key: "stopCatToilet" },
};

function fmtKm(km: number): string {
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

function nearbyToDest(place: NearbyPlace): SearchDestination {
  let h = 0;
  for (let i = 0; i < place.id.length; i++) h = (h * 31 + place.id.charCodeAt(i)) | 0;
  return {
    placeId: Math.abs(h) || 1,
    label: place.name,
    address: fmtKm(place.distanceKm),
    lat: place.lat,
    lng: place.lng,
  };
}

function primaryName(displayName: string): string {
  return displayName.split(",")[0]?.trim() || displayName;
}

export type { SearchDestination };

export function SearchBar({
  locale,
  expanded,
  onExpandedChange,
  onPick,
  onSelectDestination,
  onNavigate,
  onPrimeSpeech,
  onHome,
  onWork,
  docked = false,
  navigating = false,
  onAddStop,
  origin = null,
  previewData = null,
  onVehicleChange,
  onCancelPreview,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SearchDestination | null>(null);
  const [vehicle, setVehicle] = useState<VehicleMode>("car");
  const [recents, setRecents] = useState<SearchDestination[]>([]);
  const [stopKind, setStopKind] = useState<StopKind>("fuel");
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyFuel, setNearbyFuel] = useState<NearbyPlace | null>(null);
  const [nearbyByKind, setNearbyByKind] = useState<Record<StopKind, NearbyPlace[]>>(EMPTY_BY_KIND);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { present, shown } = usePresence(expanded);

  useEffect(() => {
    setRecents(loadRecents());
  }, [expanded]);

  useEffect(() => {
    if (previewData?.vehicle) {
      setVehicle(previewData.vehicle);
    }
  }, [previewData?.vehicle]);

  const runSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { results: Result[] };
      setResults(data.results);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  useEffect(() => {
    if (expanded && !selected) {
      window.setTimeout(() => inputRef.current?.focus(), 220);
    }
  }, [expanded, selected]);

  const applyNearby = useCallback(
    (data: { nearestFuel?: NearbyPlace | null; byKind?: Record<StopKind, NearbyPlace[]> | null }) => {
      setNearbyByKind((prev) => {
        const next = { ...EMPTY_BY_KIND, ...(prev ?? {}) };
        for (const k of STOP_KINDS) {
          if (data.byKind?.[k]?.length) next[k] = data.byKind[k];
        }
        return next;
      });
      if (data.nearestFuel) setNearbyFuel(data.nearestFuel);
    },
    [],
  );

  const loadNearby = useCallback(
    async (kind?: StopKind) => {
      if (!origin) return;
      const params = new URLSearchParams({
        lat: String(origin.lat),
        lng: String(origin.lng),
      });
      if (kind) params.set("kind", kind);
      for (let i = 0; i < 3; i++) {
        try {
          const res = await fetch(`/api/nearby?${params}`);
          if (!res.ok) throw new Error("nearby");
          const data = (await res.json()) as {
            nearestFuel?: NearbyPlace | null;
            byKind?: Record<StopKind, NearbyPlace[]>;
          };
          applyNearby(data);
          const got = kind
            ? (data.byKind?.[kind]?.length ?? 0)
            : STOP_KINDS.some((k) => (data.byKind?.[k]?.length ?? 0) > 0);
          if (got) return;
        } catch {
          await new Promise((r) => setTimeout(r, 450 * (i + 1)));
        }
      }
    },
    [applyNearby, origin],
  );

  useEffect(() => {
    if (!expanded || !navigating || !origin) return;
    let cancelled = false;
    setNearbyLoading(true);
    void loadNearby().finally(() => {
      if (!cancelled) setNearbyLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [expanded, navigating, origin, loadNearby]);

  const close = () => {
    onExpandedChange(false);
    setSelected(null);
    setResults([]);
    onSelectDestination?.(null);
    onCancelPreview?.();
    inputRef.current?.blur();
  };

  const pickDest = (dest: SearchDestination) => {
    setSelected(dest);
    setQuery(dest.label);
    setResults([]); // Remove search results immediately
    onPick?.(dest.lat, dest.lng);
    onSelectDestination?.(dest);
    setRecents(pushRecent(dest));
  };

  const pickResult = (r: Result) => {
    pickDest({
      placeId: r.place_id,
      label: primaryName(r.display_name),
      address: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
    });
  };

  const clearSelected = () => {
    setSelected(null);
    setQuery("");
    setResults([]);
    onSelectDestination?.(null);
    onCancelPreview?.();
    window.setTimeout(() => inputRef.current?.focus(), 150);
  };

  const selectVehicle = (v: VehicleMode) => {
    setVehicle(v);
    onVehicleChange?.(v);
  };

  const go = (targetVehicle: VehicleMode) => {
    if (!selected) return;
    onPrimeSpeech?.();
    onNavigate?.(selected, targetVehicle);
    close();
  };

  const addNearby = (place: NearbyPlace) => {
    const dest = nearbyToDest(place);
    if (navigating && onAddStop) {
      onAddStop(dest);
      close();
      return;
    }
    pickDest(dest);
  };

  const field = (
    <div className="search-field">
      <span className="search-ico" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" />
        </svg>
      </span>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
          onSelectDestination?.(null);
          onExpandedChange(true);
        }}
        onFocus={() => onExpandedChange(true)}
        placeholder={navigating ? t(locale, "addStopPlaceholder") : t(locale, "whereTo")}
        autoComplete="off"
      />
      {query ? (
        <button
          type="button"
          className="search-clear"
          onClick={() => {
            setQuery("");
            setSelected(null);
            setResults([]);
            onSelectDestination?.(null);
            onCancelPreview?.();
          }}
        >
          ✕
        </button>
      ) : (
        <span className="search-mic" aria-hidden>
          ⌖
        </span>
      )}
    </div>
  );

  if (docked && !present) {
    return (
      <button
        type="button"
        className="search-dock-btn"
        onClick={() => onExpandedChange(true)}
        aria-label={navigating ? t(locale, "addStop") : t(locale, "whereTo")}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" />
        </svg>
      </button>
    );
  }

  return (
    <>
      {!present && field}
      {present && (
        <div className={`km-overlay ${shown ? "is-open" : ""} ${selected ? "km-overlay-preview" : ""}`}>
          <button
            type="button"
            className="km-overlay-backdrop"
            onClick={close}
            aria-label={t(locale, "close")}
          />
          <div
            className={`km-sheet km-sheet-search ${selected ? "km-sheet-preview" : ""}`}
            role="dialog"
            aria-modal="true"
          >
            <div className="km-handle" />

            {/* When NO place is selected yet: show search input and category chips */}
            {!selected && (
              <>
                {field}
                {navigating ? (
                  <div className="search-chips">
                    {STOP_KINDS.map((kind) => {
                      const cat = STOP_CAT[kind];
                      const nearest = nearbyByKind?.[kind]?.[0];
                      return (
                        <button
                          key={kind}
                          type="button"
                          className={`search-chip stop-cat${stopKind === kind ? " is-on" : ""}`}
                          onClick={() => {
                            setStopKind(kind);
                            setSelected(null);
                            setQuery("");
                            if (!nearbyByKind?.[kind]?.length) {
                              setNearbyLoading(true);
                              void loadNearby(kind).finally(() => setNearbyLoading(false));
                            }
                          }}
                        >
                          <span>
                            {cat.icon} {t(locale, cat.key)}
                          </span>
                          <span className="stop-cat-km">{nearest ? fmtKm(nearest.distanceKm) : "—"}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="search-chips">
                    {onHome ? (
                      <button type="button" className="search-chip" onClick={onHome}>
                        🏠 {t(locale, "home")}
                      </button>
                    ) : (
                      <a href="/login" className="search-chip">
                        🏠 {t(locale, "home")}
                      </a>
                    )}
                    {onWork ? (
                      <button type="button" className="search-chip" onClick={onWork}>
                        💼 {t(locale, "work")}
                      </button>
                    ) : (
                      <a href="/login" className="search-chip">
                        💼 {t(locale, "work")}
                      </a>
                    )}
                    <a href="/account" className="search-chip">
                      + {t(locale, "newPlace")}
                    </a>
                  </div>
                )}
              </>
            )}

            {/* When a destination is selected: REMOVE ALL SEARCH RESULTS and show clean route preview */}
            {selected && (
              <div className="flex flex-col text-left">
                {/* Destination info bar */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-lg text-sky-400">
                      📍
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-100">{selected.label}</p>
                      <p className="truncate text-xs text-slate-400">{selected.address}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearSelected}
                    className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-white/10"
                  >
                    {t(locale, "changeDestination")}
                  </button>
                </div>

                {/* Adding stop during active navigation */}
                {navigating && onAddStop && (
                  <div className="mt-4 flex flex-col gap-2">
                    <button
                      type="button"
                      className="btn-resume w-full"
                      onClick={() => {
                        onAddStop(selected);
                        close();
                      }}
                    >
                      + {t(locale, "addStopHere")}
                    </button>
                    {onNavigate && (
                      <button
                        type="button"
                        className="nav-vehicle-btn w-full"
                        onClick={() => go(vehicle)}
                      >
                        {t(locale, "goHereInstead")}
                      </button>
                    )}
                  </div>
                )}

                {/* Pre-drive route preview (ETA, vehicle mode, and events on route) */}
                {!navigating && (
                  <div className="mt-3 flex flex-col">
                    {/* ETA, Duration and Distance Card */}
                    {previewData?.loading ? (
                      <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-[#16212d] py-4 text-sm font-semibold text-sky-300">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                        <span>{t(locale, "routing")}</span>
                      </div>
                    ) : previewData ? (
                      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#16212d] p-3.5 shadow-inner">
                        <div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-emerald-400 tabular-nums">
                              {Math.round(previewData.durationMin)}
                            </span>
                            <span className="text-sm font-bold text-emerald-300">
                              {t(locale, "minutes")}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs font-medium text-slate-400">
                            {previewData.distanceKm.toFixed(1)} {t(locale, "km")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            {locale === "ms" ? "Waktu Tiba" : "Arrive At"}
                          </p>
                          <p className="text-lg font-bold text-slate-100 tabular-nums">
                            {arrivalClock(previewData.durationMin)}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {/* Vehicle Mode Selector: Car / Motorcycle */}
                    <div className="mt-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {t(locale, "navigateWith")}
                      </p>
                      <div className="mt-1.5 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => selectVehicle("car")}
                          className={`nav-vehicle-btn ${vehicle === "car" ? "is-active" : ""}`}
                        >
                          🚗 {t(locale, "byCar")}
                        </button>
                        <button
                          type="button"
                          onClick={() => selectVehicle("motorcycle")}
                          className={`nav-vehicle-btn ${vehicle === "motorcycle" ? "is-active" : ""}`}
                        >
                          🏍️ {t(locale, "byMotorcycle")}
                        </button>
                      </div>
                    </div>

                    {/* Events Along Route (Accident, Police, Roadblocks, Hazards, Traffic, Floods) */}
                    {previewData && (
                      <div className="mt-3">
                        {previewData.events.length > 0 ? (
                          <div className="rounded-2xl border border-amber-500/25 bg-[#182330] p-3">
                            <div className="flex items-center justify-between border-b border-white/10 pb-2">
                              <p className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                                <span>⚠️</span>
                                <span>
                                  {t(locale, "eventsOnRoute")} ({previewData.events.length})
                                </span>
                              </p>
                              <span className="text-[10px] text-slate-400">
                                {locale === "ms" ? "Komuniti Ke Mana" : "Community Reports"}
                              </span>
                            </div>
                            <div className="mt-2 flex max-h-32 flex-col gap-1.5 overflow-y-auto pr-1">
                              {previewData.events.map((ev) => (
                                <div
                                  key={ev.report.id}
                                  className="flex items-center justify-between rounded-xl border border-white/5 bg-[#0e1620] px-3 py-1.5 text-xs"
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span className="text-sm">{REPORT_ICONS[ev.report.type]}</span>
                                    <span className="truncate font-semibold text-slate-200">
                                      {reportLabel(locale, ev.report.type)}
                                      {ev.report.note && (
                                        <span className="ml-1.5 font-normal text-slate-400">
                                          ({ev.report.note})
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <span className="shrink-0 text-[11px] font-medium tabular-nums text-sky-400">
                                    {formatDistanceM(ev.distanceM, locale)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-950/20 px-3.5 py-2.5 text-xs text-emerald-300">
                            <span>✓</span>
                            <span className="font-medium">{t(locale, "noEventsOnRoute")}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Primary Start Navigation Button */}
                    <button
                      type="button"
                      disabled={previewData?.loading}
                      onClick={() => go(vehicle)}
                      className="btn-start-nav mt-3.5 disabled:opacity-50"
                    >
                      <span>{vehicle === "car" ? "🚗" : "🏍️"}</span>
                      <span>{t(locale, "startNavigation")}</span>
                    </button>

                    <button
                      type="button"
                      onClick={close}
                      className="mt-2 w-full py-1.5 text-center text-xs font-semibold text-slate-400 hover:text-slate-200"
                    >
                      {t(locale, "cancel")}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* When NO place is selected: show search results and recents */}
            {!selected && (
              <div className="km-scroll search-body">
                {navigating && query.length < 2 && (
                  <>
                    {nearbyLoading && <p className="search-muted">{t(locale, "searching")}</p>}
                    {!nearbyLoading && nearbyFuel && (
                      <>
                        <p className="search-section">{t(locale, "nearestGas")}</p>
                        <button type="button" className="nearest-gas" onClick={() => addNearby(nearbyFuel)}>
                          <span className="nearest-gas-ico" aria-hidden>
                            ⛽
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{nearbyFuel.name}</span>
                            <span className="block truncate text-xs text-[#9aa3b2]">{t(locale, "stopCatFuel")}</span>
                          </span>
                          <span className="nearest-gas-km">{fmtKm(nearbyFuel.distanceKm)}</span>
                        </button>
                      </>
                    )}
                    {!nearbyLoading && !nearbyFuel && <p className="search-muted">{t(locale, "noNearbyFuel")}</p>}
                    <p className="search-section">{t(locale, STOP_CAT[stopKind].key)}</p>
                    {!nearbyLoading &&
                      (stopKind === "fuel"
                        ? (nearbyByKind.fuel ?? []).filter((p) => p.id !== nearbyFuel?.id)
                        : (nearbyByKind[stopKind] ?? [])
                      ).length === 0 &&
                      !(stopKind === "fuel" && nearbyFuel) && (
                        <p className="search-muted">{t(locale, "noNearbyPlaces")}</p>
                      )}
                    {(stopKind === "fuel"
                      ? (nearbyByKind.fuel ?? []).filter((p) => p.id !== nearbyFuel?.id)
                      : (nearbyByKind[stopKind] ?? [])
                    ).map((place) => (
                      <button
                        key={place.id}
                        type="button"
                        className="search-result-row"
                        onClick={() => addNearby(place)}
                      >
                        <span className="recent-ico">{STOP_CAT[place.kind].icon}</span>
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block truncate font-semibold">{place.name}</span>
                          <span className="block truncate text-xs text-[#9aa3b2]">{t(locale, STOP_CAT[place.kind].key)}</span>
                        </span>
                        <span className="nearest-gas-km">{fmtKm(place.distanceKm)}</span>
                      </button>
                    ))}
                  </>
                )}

                {loading && <p className="search-muted">{t(locale, "searching")}</p>}
                {!loading && query.length >= 2 && results.length === 0 && (
                  <p className="search-muted">{t(locale, "searchNoResults")}</p>
                )}
                {!loading &&
                  results.map((r) => (
                    <button key={r.place_id} type="button" className="search-result-row" onClick={() => pickResult(r)}>
                      <span className="recent-ico">🕒</span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block truncate font-semibold">{primaryName(r.display_name)}</span>
                        <span className="block truncate text-xs text-[#9aa3b2]">{r.display_name}</span>
                      </span>
                    </button>
                  ))}

                {!navigating && query.length < 2 && recents.length > 0 && (
                  <>
                    <p className="search-section">{t(locale, "recent")}</p>
                    {recents.map((r) => (
                      <button key={r.placeId} type="button" className="search-result-row" onClick={() => pickDest(r)}>
                        <span className="recent-ico">🕒</span>
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block truncate font-semibold">{r.label}</span>
                          <span className="block truncate text-xs text-[#9aa3b2]">{r.address}</span>
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
