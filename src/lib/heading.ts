export function normalizeHeading(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function isValidHeading(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
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

function haversineM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Calculates the forward bearing along a route polyline ahead of the user.
 * Looks ahead by `lookaheadM` (default 30m) along the route coordinates
 * to provide a smooth, stabilized driving direction.
 */
export function routeBearingAhead(
  coordinates: [number, number][],
  user: { lat: number; lng: number },
  lookaheadM = 30,
): number | undefined {
  if (!coordinates || coordinates.length < 2) return undefined;

  let bestIdx = 0;
  let bestDist = Infinity;

  // Find the closest segment on the polyline to the user
  for (let i = 0; i < coordinates.length - 1; i++) {
    const a = { lat: coordinates[i]![1], lng: coordinates[i]![0] };
    const b = { lat: coordinates[i + 1]![1], lng: coordinates[i + 1]![0] };
    const dA = haversineM(user, a);
    const dB = haversineM(user, b);
    const d = Math.min(dA, dB);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  const curr = { lat: coordinates[bestIdx]![1], lng: coordinates[bestIdx]![0] };
  let target = {
    lat: coordinates[coordinates.length - 1]![1],
    lng: coordinates[coordinates.length - 1]![0],
  };
  let accumM = 0;

  for (let j = bestIdx + 1; j < coordinates.length; j++) {
    const pt = { lat: coordinates[j]![1], lng: coordinates[j]![0] };
    const prevPt = { lat: coordinates[j - 1]![1], lng: coordinates[j - 1]![0] };
    accumM += haversineM(prevPt, pt);
    if (accumM >= lookaheadM || j === coordinates.length - 1) {
      target = pt;
      break;
    }
  }

  const dist = haversineM(curr, target);
  if (dist < 3) {
    if (bestIdx > 0) {
      const prev = { lat: coordinates[bestIdx - 1]![1], lng: coordinates[bestIdx - 1]![0] };
      return bearingBetween(prev, curr);
    }
    return undefined;
  }

  return bearingBetween(curr, target);
}

