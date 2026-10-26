export function normalizeHeading(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function isValidHeading(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 360;
}

export function shortestDelta(from: number, to: number): number {
  return ((((to - from + 180) % 360) + 360) % 360) - 180;
}

export function lerpHeading(from: number, to: number, t: number): number {
  return from + shortestDelta(from, to) * t;
}

export function bearingBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return normalizeHeading((Math.atan2(y, x) * 180) / Math.PI);
}

const GPS_HEADING_MIN_SPEED = 1.2;

export function fuseHeading(opts: {
  gpsHeading?: number;
  speedMps?: number;
  deviceHeading?: number;
  lastHeading?: number;
}): number | undefined {
  const { gpsHeading, speedMps = 0, deviceHeading, lastHeading } = opts;

  let next: number | undefined;
  if (isValidHeading(gpsHeading) && speedMps >= GPS_HEADING_MIN_SPEED) {
    next = normalizeHeading(gpsHeading);
  } else if (isValidHeading(deviceHeading)) {
    next = normalizeHeading(deviceHeading);
  } else if (isValidHeading(gpsHeading) && speedMps >= 0.4) {
    next = normalizeHeading(gpsHeading);
  } else if (isValidHeading(lastHeading)) {
    next = normalizeHeading(lastHeading);
  }

  if (next == null) return undefined;
  if (!isValidHeading(lastHeading)) return next;

  const jump = Math.abs(shortestDelta(lastHeading, next));
  if (jump > 80 && speedMps < 2) {
    return normalizeHeading(lerpHeading(lastHeading, next, 0.18));
  }
  return normalizeHeading(lerpHeading(lastHeading, next, 0.42));
}
