"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { t, type CopyKey, type Locale } from "@/lib/i18n";
import type { SearchDestination, VehicleMode } from "@/lib/types";
import { loadRecents, pushRecent } from "@/lib/recents";
import { usePresence } from "@/hooks/usePresence";
import { EMPTY_BY_KIND, STOP_KINDS, type NearbyPlace, type StopKind } from "@/lib/nearby-stops";

type Result = { place_id: number; display_name: string; lat: string; lon: string };

type Props = {
  locale: Locale;
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
  onPick?: (lat: number, lng: number) => void;
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
  onNavigate,
  onPrimeSpeech,
  onHome,
  onWork,
  hasHome,
  hasWork,
  docked = false,
  navigating = false,
  onAddStop,
  origin = null,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SearchDestination | null>(null);
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
    if (expanded) {
      window.setTimeout(() => inputRef.current?.focus(), 220);
    }
  }, [expanded]);

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
          const got = kind ? (data.byKind?.[kind]?.length ?? 0) : STOP_KINDS.some((k) => (data.byKind?.[k]?.length ?? 0) > 0);
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
    inputRef.current?.blur();
  };

  const pickDest = (dest: SearchDestination) => {
    setSelected(dest);
    setQuery(dest.label);
    onPick?.(dest.lat, dest.lng);
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

  const go = (vehicle: VehicleMode) => {
    if (!selected) return;
    onPrimeSpeech?.();
    onNavigate?.(selected, vehicle);
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
      <button type="button" className="search-dock-btn" onClick={() => onExpandedChange(true)} aria-label={navigating ? t(locale, "addStop") : t(locale, "whereTo")}>
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
        <div className={`km-overlay ${shown ? "is-open" : ""}`}>
          <button type="button" className="km-overlay-backdrop" onClick={close} aria-label={t(locale, "close")} />
          <div className="km-sheet km-sheet-search" role="dialog" aria-modal="true">
            <div className="km-handle" />
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
                        if (!(nearbyByKind?.[kind]?.length)) {
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

            <div className="km-scroll search-body">
              {selected && navigating && onAddStop && (
                <div className="nav-pick">
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
                      className="nav-vehicle-btn mt-2 w-full"
                      onClick={() => go("car")}
                    >
                      {t(locale, "goHereInstead")}
                    </button>
                  )}
                </div>
              )}

              {selected && onNavigate && !navigating && (
                <div className="nav-pick">
                  <p className="search-section">{t(locale, "navigateWith")}</p>
                  <div className="grid grid-cols-2 gap-2 px-1">
                    <button type="button" onClick={() => go("car")} className="nav-vehicle-btn">
                      🚗 {t(locale, "byCar")}
                    </button>
                    <button type="button" onClick={() => go("motorcycle")} className="nav-vehicle-btn">
                      🏍️ {t(locale, "byMotorcycle")}
                    </button>
                  </div>
                </div>
              )}

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
          </div>
        </div>
      )}
    </>
  );
}
