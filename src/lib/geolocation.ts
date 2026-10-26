import { bearingBetween, isValidHeading } from "@/lib/heading";

export type UserGeo = {
  lat: number;
  lng: number;
  heading?: number;
  speedMps?: number;
};

const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5_000,
  timeout: 30_000,
};

const REQUEST_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 25_000,
};

let lastFix: { lat: number; lng: number; at: number } | null = null;

export function isGeolocationSupported(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

export function isSecureForGeolocation(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext;
}

export function mapPosition(position: GeolocationPosition): UserGeo {
  const lat = position.coords.latitude;
  const lng = position.coords.longitude;
  const speedMps =
    position.coords.speed != null && Number.isFinite(position.coords.speed)
      ? Math.max(0, position.coords.speed)
      : undefined;

  let heading: number | undefined;
  const raw = position.coords.heading;
  const moving = speedMps != null && speedMps >= 1.2;
  if (moving && isValidHeading(raw)) {
    heading = raw;
  } else if (lastFix && speedMps != null && speedMps >= 1.5) {
    const dt = position.timestamp - lastFix.at;
    const moved = Math.hypot(lat - lastFix.lat, lng - lastFix.lng) > 0.00003;
    if (dt > 250 && dt < 15_000 && moved) {
      heading = bearingBetween(lastFix, { lat, lng });
    }
  }

  lastFix = { lat, lng, at: position.timestamp };

  return { lat, lng, heading, speedMps };
}

export type GeolocationFailure = "denied" | "unavailable" | "timeout" | "insecure" | "unsupported";

export function failureFromError(error: GeolocationPositionError): GeolocationFailure {
  if (error.code === error.PERMISSION_DENIED) return "denied";
  if (error.code === error.TIMEOUT) return "timeout";
  return "unavailable";
}

export function requestCurrentPosition(): Promise<UserGeo> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject("unsupported" as GeolocationFailure);
      return;
    }
    if (!isSecureForGeolocation()) {
      reject("insecure" as GeolocationFailure);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(mapPosition(pos)),
      (err) => reject(failureFromError(err)),
      REQUEST_OPTIONS,
    );
  });
}

export function startWatching(
  onUpdate: (geo: UserGeo) => void,
  onError?: (reason: GeolocationFailure) => void,
): number {
  return navigator.geolocation.watchPosition(
    (pos) => onUpdate(mapPosition(pos)),
    (err) => onError?.(failureFromError(err)),
    WATCH_OPTIONS,
  );
}
