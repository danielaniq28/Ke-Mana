"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapGL, { Layer, Marker, Source, type MapRef } from "react-map-gl/maplibre";
import type { MapLayerMouseEvent } from "maplibre-gl";
import {
  JAM_ROUTE_CASING_COLOR,
  JAM_ROUTE_COLOR,
  JAM_ROUTE_FLOW_COLOR,
  MAP_PITCH,
  MAP_ZOOM_DRIVING,
  ROUTE_CASING_COLOR,
  ROUTE_COLOR,
  WAZE_MAP_STYLE,
} from "@/lib/map-config";
import { applyWazeMapTheme } from "@/lib/waze-map-theme";
import { fuseHeading } from "@/lib/heading";
import { UserLocationArrow } from "./UserLocationArrow";
import { CompassButton } from "./CompassButton";
import { WazeMenu } from "./WazeMenu";
import { NavHud } from "./NavHud";
import { RouteSheet } from "./RouteSheet";
import type { MapReport, OsmFeature, ReportType } from "@/lib/types";
import { REPORT_ICONS, OSM_COLORS, OSM_ICONS } from "@/lib/report-meta";
import { osmLabel, reportLabel, t } from "@/lib/i18n";
import type { SavedPlace, UserProfile, VehicleMode } from "@/lib/types";
import { useSession } from "next-auth/react";
import { useLocale } from "./LocaleProvider";
import { ReportSheet } from "./ReportSheet";
import { SearchBar } from "./SearchBar";
import { useSpeech } from "@/hooks/useSpeech";
import { useDeviceHeading } from "@/hooks/useDeviceHeading";
import { createActiveRoute } from "@/lib/navigation/session";
import type { ActiveRoute, RouteStop } from "@/lib/navigation/types";
import {
  computeRouteProgress,
  maneuverCueForDistance,
  markCueSpoken,
  type RouteProgress,
} from "@/lib/navigation/progress";
import { arrivalClock, remainingEta } from "@/lib/maneuver-ui";
import { guidanceIndex } from "@/lib/navigation/maneuvers";
import {
  cameraAheadPhrase,
  hazardPhrase,
  maneuverPhrase,
  navArrivedPhrase,
  navStartedPhrase,
  reportAheadPhrase,
} from "@/lib/navigation/voice-cues";
import { nearestReportAhead, reportsAheadOnRoute } from "@/lib/navigation/report-alert";
import { JAM_FLOW_DASHES, jamFlowDashAt, routeTrafficGeoJson } from "@/lib/navigation/jam-segments";
import {
  cameraCueBand,
  nearestCameraAhead,
  roundedAlertMeters,
} from "@/lib/navigation/camera-alert";
import { haversineKm } from "@/lib/routing/geo";
import {
  AGE_TINT_REPORTS,
  CONFIRM_MAX_KM,
  CONFIRMABLE_REPORTS,
  reportFreshness,
} from "@/lib/report-freshness";
import {
  type GeolocationFailure,
  isGeolocationSupported,
  isSecureForGeolocation,
  requestCurrentPosition,
  startWatching,
  type UserGeo,
} from "@/lib/geolocation";

const KL = { lat: 3.139, lng: 101.6869 };

const OSM_CIRCLE_KINDS = new Set(["traffic_signals", "bump", "hump", "chicane"]);
const OSM_PIN_KINDS = new Set([
  "speed_trap",
  "speed_camera",
  "red_light_camera",
  "toll_booth",
  "speed_display",
]);
const OSM_LAYER_IDS = ["osm-lights", "osm-calming"];
const SIGHTED_KEY = "ke-mana-sighted";

function loadSighted(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SIGHTED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function persistSighted(ids: Set<string>) {
  sessionStorage.setItem(SIGHTED_KEY, JSON.stringify([...ids]));
}

function locationFailureMessage(locale: "ms" | "en", reason: GeolocationFailure): string {
  switch (reason) {
    case "insecure":
      return t(locale, "locationInsecure");
    case "timeout":
      return t(locale, "locationTimeout");
    case "unsupported":
      return t(locale, "voiceUnavailable");
    case "denied":
      return `${t(locale, "locationDenied")}. ${t(locale, "locationIosHelp")}`;
    default:
      return t(locale, "locationDenied");
  }
}

function driveView(
  map: MapRef,
  center: { lng: number; lat: number },
  heading?: number,
) {
  map.easeTo({
    center: [center.lng, center.lat],
    zoom: MAP_ZOOM_DRIVING,
    pitch: MAP_PITCH,
    bearing: heading ?? map.getBearing(),
    duration: 420,
  });
}

function boundsFromMap(map: MapRef) {
  const b = map.getBounds();
  return {
    south: b.getSouth(),
    west: b.getWest(),
    north: b.getNorth(),
    east: b.getEast(),
  };
}

export function KeManaMap() {
  const mapRef = useRef<MapRef>(null);
  const lastCameraFollowRef = useRef(0);
  const { locale } = useLocale();
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [routeInfo, setRouteInfo] = useState<{
    km: number;
    min: number;
    vehicle: VehicleMode;
    label?: string;
  } | null>(null);
  const [routing, setRouting] = useState(false);
  const navStartedAtRef = useRef(0);
  const [reports, setReports] = useState<MapReport[]>([]);
  const [osmFeatures, setOsmFeatures] = useState<OsmFeature[]>([]);
  const [showOsm, setShowOsm] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [locatingReport, setLocatingReport] = useState(false);
  const [selectedType, setSelectedType] = useState<ReportType>("hazard");
  const [pendingLatLng, setPendingLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<MapReport | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [sightedIds, setSightedIds] = useState<Set<string>>(() => new Set());
  const [selectedOsm, setSelectedOsm] = useState<OsmFeature | null>(null);
  const [userLocation, setUserLocation] = useState<UserGeo | null>(null);
  const [followUser, setFollowUser] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [routeSheetOpen, setRouteSheetOpen] = useState(false);
  const [navPaused, setNavPaused] = useState(false);
  const [navProgress, setNavProgress] = useState<RouteProgress | null>(null);
  const [mapBearing, setMapBearing] = useState(0);
  const [activeRoute, setActiveRoute] = useState<ActiveRoute | null>(null);
  const spokenCuesRef = useRef<Set<string>>(new Set());
  const hazardSpokenRef = useRef(new Map<string, number>());
  const cameraSpokenRef = useRef(new Map<string, number>());
  const lastNavTickRef = useRef(0);
  const activeRouteRef = useRef<ActiveRoute | null>(null);
  const stopHitRef = useRef<string | null>(null);
  const lastHeadingRef = useRef<number | undefined>(undefined);
  const userLocationRef = useRef<UserGeo | null>(null);
  const knownReportIdsRef = useRef<Set<string>>(new Set());
  const reportsReadyRef = useRef(false);
  const [liveFlash, setLiveFlash] = useState<{ report: MapReport; distanceM: number } | null>(null);
  const { supported: speechSupported, muted: voiceMuted, prime, speak, cancel, toggleMute } =
    useSpeech(locale);
  const { heading: deviceHeading, requestPermission: requestCompassPermission } =
    useDeviceHeading();
  const watchIdRef = useRef<number | null>(null);
  const [locationFailure, setLocationFailure] = useState<GeolocationFailure | null>(null);
  const [locatingUser, setLocatingUser] = useState(false);

  const applyGeo = useCallback((geo: UserGeo) => {
    userLocationRef.current = geo;
    setUserLocation(geo);
    setLocationFailure(null);
  }, []);

  const fusedHeading = useMemo(
    () =>
      fuseHeading({
        gpsHeading: userLocation?.heading,
        speedMps: userLocation?.speedMps,
        deviceHeading,
        lastHeading: lastHeadingRef.current,
      }),
    [userLocation?.heading, userLocation?.speedMps, deviceHeading],
  );

  useEffect(() => {
    if (fusedHeading != null) lastHeadingRef.current = fusedHeading;
  }, [fusedHeading]);

  const beginWatching = useCallback(() => {
    if (!isGeolocationSupported() || watchIdRef.current != null) return;
    watchIdRef.current = startWatching(applyGeo, (reason) => {
      if (reason === "denied") setLocationFailure("denied");
    });
  }, [applyGeo]);

  const requestLocation = useCallback(async (): Promise<UserGeo | null> => {
    if (!isGeolocationSupported()) {
      setLocationFailure("unsupported");
      setToast(t(locale, "locationDenied"));
      return null;
    }
    if (!isSecureForGeolocation()) {
      setLocationFailure("insecure");
      setToast(t(locale, "locationInsecure"));
      return null;
    }
    setLocatingUser(true);
    try {
      const geo = await requestCurrentPosition();
      applyGeo(geo);
      beginWatching();
      return geo;
    } catch (reason) {
      const failure = reason as GeolocationFailure;
      setLocationFailure(failure);
      setToast(locationFailureMessage(locale, failure));
      return null;
    } finally {
      setLocatingUser(false);
    }
  }, [applyGeo, beginWatching, locale]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setSightedIds(loadSighted());
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!selectedReport) return;
    const next = reports.find((r) => r.id === selectedReport.id);
    if (!next) {
      setSelectedReport(null);
      return;
    }
    if (
      next.upvotes !== selectedReport.upvotes ||
      next.downvotes !== selectedReport.downvotes ||
      next.lastConfirmedAt !== selectedReport.lastConfirmedAt
    ) {
      setSelectedReport(next);
    }
  }, [reports, selectedReport]);

  const refreshReports = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const b = boundsFromMap(map);
    const params = new URLSearchParams({
      south: String(b.south),
      west: String(b.west),
      north: String(b.north),
      east: String(b.east),
    });
    const res = await fetch(`/api/reports?${params}`);
    const data = (await res.json()) as { reports: MapReport[] };
    const incoming = data.reports;
    const known = knownReportIdsRef.current;
    if (!reportsReadyRef.current) {
      knownReportIdsRef.current = new Set(incoming.map((r) => r.id));
      reportsReadyRef.current = true;
      setReports(incoming);
      return;
    }
    const fresh = incoming.filter((r) => !known.has(r.id));
    for (const r of incoming) known.add(r.id);
    setReports(incoming);

    const loc = userLocationRef.current;
    const route = activeRouteRef.current;
    if (!fresh.length || !route) return;
    const ahead = loc
      ? reportsAheadOnRoute(loc, fresh, {
          routeCoords: route.coordinates,
          heading: lastHeadingRef.current,
          maxM: 8000,
        })
      : [];
    const hit =
      ahead[0] ??
      (loc
        ? { report: fresh[0]!, distanceM: haversineKm(loc, fresh[0]!) * 1000 }
        : { report: fresh[0]!, distanceM: 0 });
    setLiveFlash(hit);
    speak(reportAheadPhrase(locale, hit.report.type, hit.distanceM));
  }, [locale, speak]);

  const submitSighting = useCallback(
    async (report: MapReport, stillThere: boolean) => {
      const loc =
        userLocation ??
        (await requestCurrentPosition().catch(() => null));
      if (!loc) {
        setToast(t(locale, "tooFarToConfirm"));
        return;
      }
      const res = await fetch(`/api/reports/${report.id}/sighting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stillThere, lat: loc.lat, lng: loc.lng }),
      });
      if (res.status === 403) {
        setToast(t(locale, "tooFarToConfirm"));
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { report: MapReport; gone: boolean };
      const next = new Set(sightedIds);
      next.add(report.id);
      setSightedIds(next);
      persistSighted(next);
      if (data.gone) {
        setSelectedReport(null);
        setToast(t(locale, "thanksGone"));
      } else {
        setSelectedReport(data.report);
        setToast(t(locale, "thanksConfirm"));
      }
      void refreshReports();
    },
    [locale, refreshReports, sightedIds, userLocation],
  );

  const refreshOsm = useCallback(async () => {
    if (!showOsm && !activeRouteRef.current) return;
    const map = mapRef.current;
    if (!map) return;
    const b = boundsFromMap(map);
    const params = new URLSearchParams({
      south: String(b.south),
      west: String(b.west),
      north: String(b.north),
      east: String(b.east),
    });
    try {
      const res = await fetch(`/api/osm?${params}`);
      if (!res.ok) return;
      const data = (await res.json()) as { features: OsmFeature[] };
      setOsmFeatures(data.features);
    } catch {
      /* ignore */
    }
  }, [showOsm]);

  const onMoveEnd = useCallback(() => {
    refreshReports();
    refreshOsm();
  }, [refreshReports, refreshOsm]);

  const navigating = !!activeRoute;
  useEffect(() => {
    const ms = navigating ? 8_000 : 40_000;
    void refreshReports();
    const id = setInterval(() => void refreshReports(), ms);
    return () => clearInterval(id);
  }, [refreshReports, navigating]);

  useEffect(() => {
    if (!followUser || navPaused || !userLocation || !mapRef.current) return;
    const now = Date.now();
    if (now - lastCameraFollowRef.current < 380) return;
    lastCameraFollowRef.current = now;
    driveView(mapRef.current, userLocation, fusedHeading);
  }, [userLocation, followUser, fusedHeading, navPaused]);

  const speedKmh = Math.max(0, Math.round((userLocation?.speedMps ?? 0) * 3.6));
  const liveEta = remainingEta(
    routeInfo?.min ?? activeRoute?.durationMin ?? 0,
    routeInfo?.km ?? activeRoute?.distanceKm ?? 0,
    navProgress?.distanceRemainingM ?? (routeInfo ? routeInfo.km * 1000 : 0),
  );
  const hudStepIndex = guidanceIndex(
    activeRoute?.steps ?? [],
    navProgress?.stepIndex ?? activeRoute?.currentStepIndex ?? 0,
  );
  const cameraAhead =
    userLocation && activeRoute
      ? nearestCameraAhead(userLocation, osmFeatures, {
          routeCoords: activeRoute.coordinates,
          heading: fusedHeading,
          maxM: 450,
          minM: 40,
        })
      : null;
  const routeEvents =
    userLocation && activeRoute
      ? reportsAheadOnRoute(userLocation, reports, {
          routeCoords: activeRoute.coordinates,
          heading: fusedHeading,
          maxM: 8000,
        }).slice(0, 6)
      : [];
  const reportAhead =
    userLocation && activeRoute
      ? nearestReportAhead(userLocation, reports, {
          routeCoords: activeRoute.coordinates,
          heading: fusedHeading,
          maxM: 800,
          minM: 40,
        })
      : null;
  const nearbyAlert =
    userLocation && activeRoute && !reportAhead
      ? reports
          .map((r) => ({ r, d: haversineKm(userLocation, r) }))
          .filter((x) => x.d < 0.35)
          .sort((a, b) => a.d - b.d)[0]
      : undefined;
  const nearbyAlertText = cameraAhead
    ? `${OSM_ICONS[cameraAhead.feature.kind] ?? "📷"} ${roundedAlertMeters(cameraAhead.distanceM)} m · ${
        cameraAhead.feature.kind === "red_light_camera"
          ? t(locale, "redLightCamera")
          : t(locale, "speedTrap")
      }`
    : reportAhead
      ? `${REPORT_ICONS[reportAhead.report.type]} ${roundedAlertMeters(reportAhead.distanceM)} m · ${reportLabel(locale, reportAhead.report.type)}`
      : nearbyAlert
        ? `${t(locale, "hazardAhead")}: ${reportLabel(locale, nearbyAlert.r.type)} · ${Math.round(nearbyAlert.d * 1000)} m`
        : null;
  const routeLine = useMemo(
    () =>
      activeRoute && activeRoute.coordinates.length >= 2
        ? routeTrafficGeoJson(activeRoute.coordinates, reports)
        : null,
    [activeRoute, reports],
  );
  const hasJam = !!routeLine?.features.some((f) => f.properties?.jam);

  useEffect(() => {
    if (!hasJam) return;
    let raf = 0;
    let step = -1;
    const tick = (timeMs: number) => {
      const map = mapRef.current?.getMap();
      if (map?.getLayer("route-line-jam-flow")) {
        const i = Math.floor(timeMs / 55) % JAM_FLOW_DASHES.length;
        if (i !== step) {
          step = i;
          map.setPaintProperty("route-line-jam-flow", "line-dasharray", jamFlowDashAt(timeMs));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hasJam]);

  useEffect(() => {
    if (status !== "authenticated") {
      setProfile(null);
      return;
    }
    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { profile?: UserProfile } | null) => {
        if (data?.profile) setProfile(data.profile);
      })
      .catch(() => undefined);
  }, [status]);

  const endNavigation = useCallback(() => {
    activeRouteRef.current = null;
    stopHitRef.current = null;
    setActiveRoute(null);
    setRouteInfo(null);
    setRouting(false);
    setRouteSheetOpen(false);
    setNavPaused(false);
    setNavProgress(null);
    spokenCuesRef.current.clear();
    cameraSpokenRef.current.clear();
    cancel();
  }, [cancel]);

  const fitRouteOverview = useCallback((coordinates: [number, number][]) => {
    const map = mapRef.current;
    if (!map || coordinates.length < 2) return;
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    for (const [lng, lat] of coordinates) {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }
    const padLng = Math.max((maxLng - minLng) * 0.12, 0.004);
    const padLat = Math.max((maxLat - minLat) * 0.12, 0.004);
    try {
      map.fitBounds(
        [
          [minLng - padLng, minLat - padLat],
          [maxLng + padLng, maxLat + padLat],
        ],
        {
          padding: { top: 88, bottom: 240, left: 56, right: 56 },
          pitch: 0,
          bearing: 0,
          duration: 900,
          maxZoom: 16,
        },
      );
    } catch {
      map.easeTo({
        center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
        zoom: 13,
        pitch: 0,
        bearing: 0,
        duration: 700,
      });
    }
  }, []);

  const planAndFollow = useCallback(
    async (opts: {
      to: { lat: number; lng: number; label?: string };
      vehicle: VehicleMode;
      stops?: RouteStop[];
      speechPrimed?: boolean;
      announceStart?: boolean;
      overview?: boolean;
    }) => {
      const stops = opts.stops ?? [];
      if (opts.speechPrimed) prime();
      void requestCompassPermission();
      spokenCuesRef.current.clear();
      hazardSpokenRef.current.clear();
      cameraSpokenRef.current.clear();
      stopHitRef.current = null;
      lastNavTickRef.current = Date.now();
      navStartedAtRef.current = Date.now();

      let from = userLocation;
      if (!from && mapRef.current) {
        const c = mapRef.current.getCenter();
        from = { lat: c.lat, lng: c.lng, speedMps: 0 };
      }
      if (!from) from = await requestLocation();
      if (!from) {
        setToast(t(locale, "locationDenied"));
        return;
      }
      if (!userLocation) void requestLocation();

      setRouting(true);
      setNavPaused(false);
      setSearchOpen(false);
      setMenuOpen(false);
      setRouteSheetOpen(false);
      if (opts.overview !== false) setFollowUser(false);

      const ctrl = new AbortController();
      const timeoutId = window.setTimeout(() => ctrl.abort(), 22_000);

      try {
        const params = new URLSearchParams({
          fromLat: String(from.lat),
          fromLng: String(from.lng),
          toLat: String(opts.to.lat),
          toLng: String(opts.to.lng),
          vehicle: opts.vehicle,
          locale,
        });
        if (stops.length > 0) {
          params.set("via", stops.map((s) => `${s.lat},${s.lng}`).join(";"));
        }
        const res = await fetch(`/api/directions?${params}`, {
          signal: ctrl.signal,
          cache: "no-store",
        });
        if (!res.ok) {
          setToast(t(locale, "routeFailed"));
          return;
        }
        const data = (await res.json()) as {
          route: {
            coordinates: [number, number][];
            distanceKm: number;
            durationMin: number;
            steps: ActiveRoute["steps"];
          };
          vehicle: VehicleMode;
        };

        const coords = data.route.coordinates ?? [];
        if (coords.length < 2) {
          setToast(t(locale, "routeFailed"));
          return;
        }

        const route = createActiveRoute({
          coordinates: coords,
          destination: opts.to,
          stops,
          vehicle: data.vehicle,
          distanceKm: data.route.distanceKm,
          durationMin: data.route.durationMin,
          steps: data.route.steps ?? [],
        });

        activeRouteRef.current = route;
        setActiveRoute(route);
        setRouteInfo({
          km: data.route.distanceKm,
          min: data.route.durationMin,
          vehicle: data.vehicle,
          label: opts.to.label,
        });
        setNavProgress(computeRouteProgress(route, from));
        void refreshOsm();

        if (opts.overview !== false) {
          fitRouteOverview(coords);
          window.setTimeout(() => {
            setFollowUser(true);
            if (mapRef.current && userLocation) {
              driveView(mapRef.current, userLocation);
            }
          }, 1400);
        }
        if (opts.announceStart !== false) {
          speak(navStartedPhrase(locale, opts.to.label));
        }
      } catch {
        setToast(t(locale, "routeFailed"));
      } finally {
        window.clearTimeout(timeoutId);
        setRouting(false);
      }
    },
    [
      userLocation,
      locale,
      prime,
      speak,
      requestLocation,
      requestCompassPermission,
      fitRouteOverview,
      refreshOsm,
    ],
  );

  const startNavigation = useCallback(
    (
      to: { lat: number; lng: number; label?: string },
      vehicle: VehicleMode = "car",
      speechPrimed = false,
    ) => {
      void planAndFollow({
        to,
        vehicle,
        stops: [],
        speechPrimed,
        announceStart: true,
        overview: true,
      });
    },
    [planAndFollow],
  );

  const addStop = useCallback(
    (place: RouteStop) => {
      const current = activeRouteRef.current;
      if (!current) {
        startNavigation(place, "car", true);
        return;
      }
      if (current.stops.length >= 3) return;
      void planAndFollow({
        to: current.destination,
        vehicle: current.vehicle,
        stops: [...current.stops, place],
        speechPrimed: true,
        announceStart: false,
        overview: true,
      });
    },
    [planAndFollow, startNavigation],
  );

  const removeStop = useCallback(
    (index: number) => {
      const current = activeRouteRef.current;
      if (!current) return;
      const stops = current.stops.filter((_, i) => i !== index);
      void planAndFollow({
        to: current.destination,
        vehicle: current.vehicle,
        stops,
        announceStart: false,
        overview: false,
      });
    },
    [planAndFollow],
  );

  const navigateToPlace = useCallback(
    (place: SavedPlace, vehicle: VehicleMode = "car") => {
      startNavigation(
        { lat: place.lat, lng: place.lng, label: place.label },
        vehicle,
        true,
      );
    },
    [startNavigation],
  );

  useEffect(() => {
    if (!activeRoute || !userLocation) return;
    const now = Date.now();
    if (now - lastNavTickRef.current < 400) return;
    lastNavTickRef.current = now;

    const progress = computeRouteProgress(activeRoute, userLocation);
    setNavProgress(progress);
    setActiveRoute((r) =>
      r && r.currentStepIndex !== progress.stepIndex ? { ...r, currentStepIndex: progress.stepIndex } : r,
    );
    const navAgeMs = now - navStartedAtRef.current;
    const nextStop = activeRoute.stops[0];
    if (nextStop && navAgeMs > 8_000) {
      const toStopM = haversineKm(userLocation, nextStop) * 1000;
      const stopKey = `${nextStop.lat.toFixed(5)},${nextStop.lng.toFixed(5)}`;
      if (toStopM < 45 && stopHitRef.current !== stopKey) {
        stopHitRef.current = stopKey;
        speak(
          nextStop.label
            ? `${t(locale, "stopReached")}: ${nextStop.label}`
            : t(locale, "stopReached"),
        );
        void planAndFollow({
          to: activeRoute.destination,
          vehicle: activeRoute.vehicle,
          stops: activeRoute.stops.slice(1),
          announceStart: false,
          overview: false,
        });
        return;
      }
    }

    const canArrive =
      activeRoute.stops.length === 0 &&
      navAgeMs > 12_000 &&
      progress.distanceToDestinationM < 40 &&
      progress.distanceAlongM > 80;

    if (canArrive) {
      speak(navArrivedPhrase(locale));
      endNavigation();
      return;
    }

    const step = activeRoute.steps[progress.stepIndex];
    if (step) {
      const stepKey = `step-${progress.stepIndex}`;
      const cue = maneuverCueForDistance(
        progress.distanceToNextManeuverM,
        spokenCuesRef.current,
        stepKey,
      );
      if (cue && !navPaused) {
        const text = maneuverPhrase(
          locale,
          step.verbalInstruction ?? step.instruction,
          cue,
          progress.distanceToNextManeuverM,
        );
        speak(text);
        markCueSpoken(spokenCuesRef.current, stepKey, cue);
      }
    }

    const reportCue = nearestReportAhead(userLocation, reports, {
      routeCoords: activeRoute.coordinates,
      heading: fusedHeading,
      maxM: 420,
      minM: 80,
    });
    if (reportCue && !navPaused) {
      const band = cameraCueBand(reportCue.distanceM);
      if (band) {
        const key = `${reportCue.report.id}-${band}`;
        const last = hazardSpokenRef.current.get(key) ?? 0;
        if (now - last > 90_000) {
          hazardSpokenRef.current.set(key, now);
          speak(reportAheadPhrase(locale, reportCue.report.type, reportCue.distanceM));
        }
      }
    } else {
      const hazardRadiusKm = 0.4;
      const cooldownMs = 120_000;
      for (const report of reports) {
        const d = haversineKm(userLocation, report);
        if (d > hazardRadiusKm) continue;
        const last = hazardSpokenRef.current.get(report.id) ?? 0;
        if (now - last < cooldownMs) continue;
        hazardSpokenRef.current.set(report.id, now);
        speak(hazardPhrase(locale, report));
      }
    }

    const camera = nearestCameraAhead(userLocation, osmFeatures, {
      routeCoords: activeRoute.coordinates,
      heading: fusedHeading,
      maxM: 420,
      minM: 80,
    });
    if (camera && !navPaused) {
      const band = cameraCueBand(camera.distanceM);
      if (band) {
        const key = `${camera.feature.id}-${band}`;
        const spoken200 = cameraSpokenRef.current.get(`${camera.feature.id}-200`) ?? 0;
        const last = cameraSpokenRef.current.get(key) ?? 0;
        const skip400 = band === "400" && spoken200 > 0;
        if (!skip400 && now - last > 90_000) {
          cameraSpokenRef.current.set(key, now);
          if (band === "200") cameraSpokenRef.current.set(`${camera.feature.id}-200`, now);
          speak(cameraAheadPhrase(locale, camera.feature.kind, camera.distanceM));
        }
      }
    }
  }, [
    activeRoute,
    userLocation,
    reports,
    osmFeatures,
    fusedHeading,
    locale,
    speak,
    endNavigation,
    navPaused,
    planAndFollow,
  ]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!liveFlash) return;
    const id = setTimeout(() => setLiveFlash(null), 7000);
    return () => clearTimeout(id);
  }, [liveFlash]);

  const onMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const osmHit = e.features?.find((f) => OSM_LAYER_IDS.includes(f.layer.id));
      if (osmHit?.properties?.id) {
        const hit = osmFeatures.find((f) => f.id === osmHit.properties?.id);
        if (hit) {
          setSelectedOsm(hit);
          setSelectedReport(null);
          return;
        }
      }

      setSelectedReport(null);
      setSelectedOsm(null);
    },
    [osmFeatures],
  );

  const openReportSheet = useCallback(async () => {
    setSheetOpen(true);
    setLocatingReport(true);
    setSelectedReport(null);
    setSelectedOsm(null);

    if (userLocation) {
      setPendingLatLng(userLocation);
    }

    const geo = userLocation ?? (await requestLocation());
    setLocatingReport(false);
    if (!geo) {
      setPendingLatLng(null);
      return;
    }
    setPendingLatLng(geo);
    if (mapRef.current) {
      driveView(
        mapRef.current,
        geo,
        fuseHeading({
          gpsHeading: geo.heading,
          speedMps: geo.speedMps,
          deviceHeading,
          lastHeading: lastHeadingRef.current,
        }),
      );
    }
  }, [userLocation, requestLocation, deviceHeading]);

  const submitReport = useCallback(async () => {
    if (!pendingLatLng) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          lat: pendingLatLng.lat,
          lng: pendingLatLng.lng,
          note: note || undefined,
        }),
      });
      if (res.ok) {
        setToast(t(locale, "thanks"));
        setSheetOpen(false);
        setPendingLatLng(null);
        setNote("");
        await refreshReports();
      }
    } finally {
      setSubmitting(false);
    }
  }, [pendingLatLng, selectedType, note, locale, refreshReports]);

  const goToMyLocation = useCallback(async () => {
    void requestCompassPermission();
    const geo = userLocation ?? (await requestLocation());
    if (!geo) return;
    setFollowUser(true);
    const heading = fuseHeading({
      gpsHeading: geo.heading,
      speedMps: geo.speedMps,
      deviceHeading,
      lastHeading: lastHeadingRef.current,
    });
    if (mapRef.current) driveView(mapRef.current, geo, heading);
  }, [userLocation, requestLocation, requestCompassPermission, deviceHeading]);

  const snapNorthUp = useCallback(() => {
    setFollowUser(false);
    mapRef.current?.easeTo({ bearing: 0, duration: 700 });
    setMapBearing(0);
  }, []);

  const osmGeoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: osmFeatures
        .filter((f) => OSM_CIRCLE_KINDS.has(f.kind))
        .map((f) => ({
          type: "Feature" as const,
          properties: { id: f.id, kind: f.kind },
          geometry: { type: "Point" as const, coordinates: [f.lng, f.lat] },
        })),
    }),
    [osmFeatures],
  );

  const osmPins = useMemo(
    () => osmFeatures.filter((f) => OSM_PIN_KINDS.has(f.kind)),
    [osmFeatures],
  );

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      <MapGL
        ref={mapRef}
        initialViewState={{
          longitude: KL.lng,
          latitude: KL.lat,
          zoom: 12,
          pitch: MAP_PITCH,
          bearing: 0,
        }}
        maxPitch={65}
        mapStyle={WAZE_MAP_STYLE}
        style={{ width: "100%", height: "100%" }}
        onClick={onMapClick}
        onDragStart={() => setFollowUser(false)}
        onRotateStart={() => setFollowUser(false)}
        interactiveLayerIds={showOsm ? OSM_LAYER_IDS : undefined}
        onLoad={(e) => {
          applyWazeMapTheme(e.target);
          setMapBearing(e.target.getBearing());
          refreshReports();
          refreshOsm();
        }}
        onMove={(e) => setMapBearing(e.viewState.bearing)}
        onMoveEnd={onMoveEnd}
        attributionControl={{ compact: true }}
      >
        {userLocation && (
          <Marker longitude={userLocation.lng} latitude={userLocation.lat} anchor="center">
            <UserLocationArrow heading={fusedHeading} mapBearing={mapBearing} />
          </Marker>
        )}

        {showOsm && osmGeoJson.features.length > 0 && (
          <Source id="osm-features" type="geojson" data={osmGeoJson}>
            <Layer
              id="osm-lights"
              type="circle"
              minzoom={14}
              filter={["==", ["get", "kind"], "traffic_signals"]}
              paint={{
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 4, 17, 7],
                "circle-color": OSM_COLORS.traffic_signals,
                "circle-stroke-width": 1.5,
                "circle-stroke-color": "#fff",
              }}
            />
            <Layer
              id="osm-calming"
              type="circle"
              minzoom={15}
              filter={["in", ["get", "kind"], ["literal", ["bump", "hump", "chicane"]]]}
              paint={{
                "circle-radius": 5,
                "circle-color": OSM_COLORS.bump,
                "circle-stroke-width": 1.5,
                "circle-stroke-color": "#fff",
              }}
            />
          </Source>
        )}

        {showOsm &&
          osmPins.map((f) => (
            <Marker
              key={f.id}
              longitude={f.lng}
              latitude={f.lat}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelectedOsm(f);
                setSelectedReport(null);
              }}
            >
              <button type="button" className={`osm-pin osm-pin-${f.kind}`} aria-label={osmLabel(locale, f.kind)}>
                {OSM_ICONS[f.kind]}
              </button>
            </Marker>
          ))}

        {routeLine && (
          <Source id="active-route" type="geojson" data={routeLine}>
            <Layer
              id="route-line-casing"
              type="line"
              filter={["!=", ["get", "jam"], true]}
              paint={{
                "line-color": ROUTE_CASING_COLOR,
                "line-width": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  8,
                  6,
                  12,
                  10,
                  16,
                  14,
                ],
                "line-opacity": 0.7,
              }}
              layout={{ "line-cap": "round", "line-join": "round" }}
            />
            <Layer
              id="route-line"
              type="line"
              filter={["!=", ["get", "jam"], true]}
              paint={{
                "line-color": ROUTE_COLOR,
                "line-width": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  8,
                  3,
                  12,
                  6,
                  16,
                  9,
                ],
                "line-opacity": 1,
              }}
              layout={{ "line-cap": "round", "line-join": "round" }}
            />
            <Layer
              id="route-line-jam-casing"
              type="line"
              filter={["==", ["get", "jam"], true]}
              paint={{
                "line-color": JAM_ROUTE_CASING_COLOR,
                "line-width": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  8,
                  7,
                  12,
                  11,
                  16,
                  16,
                ],
                "line-opacity": 0.85,
              }}
              layout={{ "line-cap": "round", "line-join": "round" }}
            />
            <Layer
              id="route-line-jam"
              type="line"
              filter={["==", ["get", "jam"], true]}
              paint={{
                "line-color": JAM_ROUTE_COLOR,
                "line-width": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  8,
                  4,
                  12,
                  7,
                  16,
                  11,
                ],
                "line-opacity": 1,
              }}
              layout={{ "line-cap": "round", "line-join": "round" }}
            />
            <Layer
              id="route-line-jam-flow"
              type="line"
              filter={["==", ["get", "jam"], true]}
              paint={{
                "line-color": JAM_ROUTE_FLOW_COLOR,
                "line-width": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  8,
                  2,
                  12,
                  3.5,
                  16,
                  5.5,
                ],
                "line-opacity": 0.9,
              }}
              layout={{ "line-cap": "round", "line-join": "round" }}
            />
          </Source>
        )}

        {activeRoute && (
          <Marker
            longitude={activeRoute.destination.lng}
            latitude={activeRoute.destination.lat}
            anchor="bottom"
          >
            <div className="flex flex-col items-center">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-white bg-[#ef4444] shadow" />
            </div>
          </Marker>
        )}

        {activeRoute?.stops.map((stop, i) => (
          <Marker
            key={`${stop.lat}-${stop.lng}-${i}`}
            longitude={stop.lng}
            latitude={stop.lat}
            anchor="center"
          >
            <span className="nav-stop-pin">{i + 1}</span>
          </Marker>
        ))}

        {reports.map((r) => (
          <Marker
            key={r.id}
            longitude={r.lng}
            latitude={r.lat}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelectedReport(r);
              setSelectedOsm(null);
            }}
          >
            <div
              className={`waze-report-pin cursor-pointer${
                AGE_TINT_REPORTS.has(r.type) ? ` is-age-${reportFreshness(r, nowTick)}` : ""
              }`}
            >
              <span>{REPORT_ICONS[r.type]}</span>
              {r.upvotes > 1 && (
                <span className="ml-1 rounded-full bg-[#1c2430] px-1.5 text-[10px] font-bold text-white">
                  {r.upvotes}
                </span>
              )}
            </div>
          </Marker>
        ))}

      </MapGL>

      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col ${menuOpen || searchOpen || routeSheetOpen ? "invisible" : ""}`}
      >
        {(routing || activeRoute) && (
          <NavHud
            locale={locale}
            routing={routing && !routeInfo}
            paused={navPaused}
            step={activeRoute?.steps[hudStepIndex]}
            steps={activeRoute?.steps}
            stepIndex={hudStepIndex}
            distanceToNextM={navProgress?.distanceToNextManeuverM ?? activeRoute?.steps[hudStepIndex]?.distanceM ?? 0}
            alert={nearbyAlertText}
          />
        )}
        {liveFlash && activeRoute && (
          <button
            type="button"
            className="live-flash pointer-events-auto mx-3 mt-2"
            onClick={() => {
              setSelectedReport(liveFlash.report);
              setLiveFlash(null);
            }}
          >
            <span className="live-flash-dot" />
            <span className="live-flash-ico">{REPORT_ICONS[liveFlash.report.type]}</span>
            <span className="min-w-0 flex-1 truncate text-left">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-[#ff8aa8]">
                {t(locale, "liveReports")}
              </span>
              <span className="block truncate font-bold">
                {reportLabel(locale, liveFlash.report.type)} · {roundedAlertMeters(liveFlash.distanceM)} m
              </span>
            </span>
          </button>
        )}
        <div
          className={`flex justify-between px-3 pb-1 ${routing || activeRoute ? "pt-2.5" : "pt-[max(0.75rem,env(safe-area-inset-top))]"}`}
        >
          <div className="pointer-events-auto flex flex-col gap-2.5">
            {!activeRoute && (
              <button
                type="button"
                className="waze-circle-btn waze-menu-btn relative text-base font-bold"
                onClick={() => setMenuOpen(true)}
                aria-label={t(locale, "menu")}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
                {reports.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#ef4444] ring-2 ring-white" />
                )}
              </button>
            )}
            <CompassButton
              mapBearing={mapBearing}
              trackingGps={followUser && fusedHeading != null}
              onNorthUp={() => {
                void requestCompassPermission();
                snapNorthUp();
              }}
              label={t(locale, "northUp")}
            />
          </div>
          <div className="pointer-events-auto flex flex-col gap-2.5">
            {reports.length > 0 && activeRoute && (
              <button
                type="button"
                className="waze-circle-btn relative"
                onClick={() => setSelectedReport(reports[0] ?? null)}
                aria-label={t(locale, "reports")}
              >
                ⚠
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ef4444] px-1 text-[9px] font-bold">
                  {reports.length}
                </span>
              </button>
            )}
            <button
              type="button"
              className={`waze-circle-btn text-base ${voiceMuted ? "opacity-45" : ""}`}
              aria-label={voiceMuted ? t(locale, "voiceMuted") : t(locale, "voiceOn")}
              onClick={() => {
                const muted = toggleMute();
                setToast(muted ? t(locale, "voiceMuted") : t(locale, "voiceOn"));
                if (!muted && !speechSupported) setToast(t(locale, "voiceUnavailable"));
              }}
            >
              {voiceMuted ? "🔇" : "🔊"}
            </button>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {selectedReport && (
          <div className="pointer-events-auto waze-card w-full max-w-lg p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold">
                  {REPORT_ICONS[selectedReport.type]} {reportLabel(locale, selectedReport.type)}
                </p>
                {selectedReport.note && (
                  <p className="mt-1 text-sm text-[#9aa3b2]">{selectedReport.note}</p>
                )}
                <p className="mt-1 text-xs text-[#9aa3b2]">
                  {t(locale, "community")} · {selectedReport.upvotes} {t(locale, "upvote")}
                  {AGE_TINT_REPORTS.has(selectedReport.type) && (
                    <>
                      {" · "}
                      {t(
                        locale,
                        reportFreshness(selectedReport, nowTick) === "new"
                          ? "freshNew"
                          : reportFreshness(selectedReport, nowTick) === "aging"
                            ? "freshAging"
                            : "freshStale",
                      )}
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                className="text-sm text-[#8a94a3]"
                onClick={() => setSelectedReport(null)}
              >
                ✕
              </button>
            </div>
            {CONFIRMABLE_REPORTS.has(selectedReport.type) ? (
              sightedIds.has(selectedReport.id) ? (
                <p className="mt-3 text-center text-sm text-[#9aa3b2]">{t(locale, "thanksConfirm")}</p>
              ) : (
                <>
                  <p className="mt-3 text-center text-xs font-semibold text-[#9aa3b2]">
                    {t(locale, "stillThereQ")}
                  </p>
                  {userLocation &&
                  haversineKm(userLocation, selectedReport) > CONFIRM_MAX_KM ? (
                    <p className="mt-1 text-center text-[11px] text-[#8a94a3]">
                      {t(locale, "tooFarToConfirm")}
                    </p>
                  ) : null}
                  <div className="report-confirm-row">
                    <button
                      type="button"
                      className="report-confirm-yes"
                      onClick={() => void submitSighting(selectedReport, true)}
                    >
                      {t(locale, "stillThere")}
                    </button>
                    <button
                      type="button"
                      className="report-confirm-no"
                      onClick={() => void submitSighting(selectedReport, false)}
                    >
                      {t(locale, "notThere")}
                    </button>
                  </div>
                </>
              )
            ) : (
              <button
                type="button"
                className="mt-3 w-full rounded-xl bg-[#30a2ff]/12 py-2.5 text-sm font-semibold text-[#1a6fb8]"
                onClick={async () => {
                  const res = await fetch(`/api/reports/${selectedReport.id}/upvote`, {
                    method: "POST",
                  });
                  if (res.ok) {
                    const data = (await res.json()) as { report: MapReport };
                    setSelectedReport(data.report);
                    refreshReports();
                  }
                }}
              >
                👍 {t(locale, "upvote")}
              </button>
            )}
          </div>
        )}

        {selectedOsm && (
          <div className="pointer-events-auto waze-card w-full max-w-lg p-4">
            <div className="flex justify-between gap-2">
              <div>
                <p className="font-bold">
                  {OSM_ICONS[selectedOsm.kind]} {osmLabel(locale, selectedOsm.kind)}
                </p>
                <p className="text-xs text-[#9aa3b2]">{t(locale, "mapData")}</p>
                {selectedOsm.tags.maxspeed && (
                  <p className="mt-1 text-sm font-medium">
                    {t(locale, "maxSpeed")}: {selectedOsm.tags.maxspeed}
                  </p>
                )}
              </div>
              <button type="button" className="text-[#8a94a3]" onClick={() => setSelectedOsm(null)}>
                ✕
              </button>
            </div>
          </div>
        )}

        <div className={`pointer-events-none relative flex w-full max-w-lg items-end justify-between ${routeSheetOpen ? "invisible" : ""}`}>
          <button
            type="button"
            onClick={() => goToMyLocation()}
            className="pointer-events-auto waze-speedo"
            aria-label={t(locale, "myLocation")}
          >
            <span className="speed-val">{speedKmh}</span>
            <span className="speed-unit">km/h</span>
          </button>
          <button
            type="button"
            onClick={openReportSheet}
            className="pointer-events-auto waze-fab"
            aria-label={t(locale, "report")}
          >
            <span className="waze-fab-inner">⚠</span>
          </button>
        </div>

        {(routing || routeInfo) && !routeSheetOpen && (
          <div className="pointer-events-auto eta-dock w-full max-w-lg">
            <SearchBar
              docked
              navigating={!!activeRoute}
              origin={userLocation ?? KL}
              locale={locale}
              expanded={searchOpen}
              onExpandedChange={setSearchOpen}
              hasHome={!!profile?.home}
              hasWork={!!profile?.work}
              onHome={
                profile?.home
                  ? () => {
                      setSearchOpen(false);
                      if (activeRoute) addStop(profile.home!);
                      else {
                        prime();
                        navigateToPlace(profile.home!);
                      }
                    }
                  : undefined
              }
              onWork={
                profile?.work
                  ? () => {
                      setSearchOpen(false);
                      if (activeRoute) addStop(profile.work!);
                      else {
                        prime();
                        navigateToPlace(profile.work!);
                      }
                    }
                  : undefined
              }
              onPick={(lat, lng) => {
                setFollowUser(false);
                mapRef.current?.flyTo({
                  center: [lng, lat],
                  zoom: 16,
                  pitch: MAP_PITCH,
                  duration: 900,
                });
              }}
              onPrimeSpeech={prime}
              onNavigate={(dest, vehicle) => {
                startNavigation(
                  { lat: dest.lat, lng: dest.lng, label: dest.label },
                  vehicle,
                  true,
                );
              }}
              onAddStop={(dest) => addStop({ lat: dest.lat, lng: dest.lng, label: dest.label })}
            />
            <button
              type="button"
              className="eta-dock-main"
              onClick={() => {
                if (!routeInfo) return;
                setRouteSheetOpen(true);
                setNavPaused(true);
                setFollowUser(false);
              }}
            >
              {routing && !routeInfo ? (
                <p className="text-sm font-semibold text-[#9aa3b2]">{t(locale, "routing")}</p>
              ) : (
                <>
                  <p className="eta-clock">{arrivalClock(liveEta.min)}</p>
                  <p className="eta-sub">
                    {Math.round(liveEta.min)} {t(locale, "minutes")} · {liveEta.km.toFixed(1)} {t(locale, "km")}
                  </p>
                </>
              )}
            </button>
            <span className="waze-circle-btn ghost" aria-hidden>
              ⑂
            </span>
          </div>
        )}

        {(!userLocation || locationFailure === "denied") && !activeRoute && !routing && (
          <button
            type="button"
            onClick={() => {
              void requestCompassPermission();
              void requestLocation();
            }}
            disabled={locatingUser}
            className="pointer-events-auto waze-card w-full max-w-lg px-4 py-3 text-left text-sm"
          >
            <p className="font-bold">{t(locale, "enableLocation")}</p>
            <p className="mt-1 text-xs text-[#9aa3b2]">
              {locationFailure
                ? locationFailureMessage(locale, locationFailure)
                : t(locale, "enableLocationHint")}
            </p>
          </button>
        )}

        {reports.length > 0 && !selectedReport && !activeRoute && !searchOpen && (
          <button
            type="button"
            className="pointer-events-auto waze-pill flex w-full max-w-lg items-center gap-2 px-4 py-3 text-left text-sm"
            onClick={() => setSelectedReport(reports[0] ?? null)}
          >
            <span className="text-lg">🌊</span>
            <span>
              <strong>{reports.length}</strong> {t(locale, "reportsAround")}
            </span>
          </button>
        )}

        {!activeRoute && !routing && (
          <div className="pointer-events-auto w-full max-w-lg pb-1">
            <SearchBar
              locale={locale}
              expanded={searchOpen}
              onExpandedChange={setSearchOpen}
              hasHome={!!profile?.home}
              hasWork={!!profile?.work}
              onHome={
                profile?.home
                  ? () => {
                      setSearchOpen(false);
                      prime();
                      navigateToPlace(profile.home!);
                    }
                  : undefined
              }
              onWork={
                profile?.work
                  ? () => {
                      setSearchOpen(false);
                      prime();
                      navigateToPlace(profile.work!);
                    }
                  : undefined
              }
              onPick={(lat, lng) => {
                setFollowUser(false);
                mapRef.current?.flyTo({
                  center: [lng, lat],
                  zoom: 16,
                  pitch: MAP_PITCH,
                  duration: 900,
                });
              }}
              onPrimeSpeech={prime}
              onNavigate={(dest, vehicle) => {
                startNavigation(
                  { lat: dest.lat, lng: dest.lng, label: dest.label },
                  vehicle,
                  true,
                );
              }}
            />
          </div>
        )}
      </div>

      <WazeMenu
        locale={locale}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        showOsm={showOsm}
        onToggleOsm={(v) => {
          setShowOsm(v);
          if (v) refreshOsm();
        }}
        signedIn={!!session?.user}
        userName={session?.user?.name}
        userImage={session?.user?.image}
        onPlanDrive={() => {
          setMenuOpen(false);
          window.setTimeout(() => setSearchOpen(true), 220);
        }}
        onInbox={() => {
          setMenuOpen(false);
          window.setTimeout(() => {
            if (reports[0]) setSelectedReport(reports[0]);
            else setToast(t(locale, "noReports"));
          }, 220);
        }}
        sleepOn={voiceMuted}
        onToggleSleep={() => {
          const muted = toggleMute();
          setToast(muted ? t(locale, "sleepMode") : t(locale, "voiceOn"));
        }}
      />

      <RouteSheet
        locale={locale}
        open={routeSheetOpen}
        paused={navPaused}
        route={activeRoute}
        remainingMin={liveEta.min}
        remainingKm={liveEta.km}
        stepIndex={hudStepIndex}
        events={routeEvents}
        onClose={() => {
          setRouteSheetOpen(false);
          setNavPaused(false);
          void goToMyLocation();
        }}
        onStop={endNavigation}
        onResume={() => {
          setRouteSheetOpen(false);
          setNavPaused(false);
          void goToMyLocation();
        }}
        onAddStop={() => {
          setRouteSheetOpen(false);
          setNavPaused(false);
          setSearchOpen(true);
        }}
        onRemoveStop={removeStop}
      />

      <ReportSheet
        locale={locale}
        open={sheetOpen}
        pendingLatLng={pendingLatLng}
        selectedType={selectedType}
        note={note}
        submitting={submitting}
        locating={locatingReport}
        onClose={() => {
          setSheetOpen(false);
          setPendingLatLng(null);
          setLocatingReport(false);
        }}
        onSelectType={setSelectedType}
        onNoteChange={setNote}
        onSubmit={submitReport}
      />

      {toast && (
        <div className="pointer-events-none absolute left-1/2 top-24 z-50 -translate-x-1/2 rounded-full bg-[#1a2332] px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
