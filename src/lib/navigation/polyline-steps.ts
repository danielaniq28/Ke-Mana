import type { NavigationStep, TurnKind } from "./types";

function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function turnFromDelta(delta: number): { kind: TurnKind; ms: string; en: string } {
  const abs = Math.abs(delta);
  if (abs < 25) return { kind: "continue", ms: "Terus", en: "Continue straight" };
  if (delta > 0 && delta < 120) return { kind: "right", ms: "Belok kanan", en: "Turn right" };
  if (delta < 0 && delta > -120) return { kind: "left", ms: "Belok kiri", en: "Turn left" };
  if (delta >= 120) return { kind: "uturn", ms: "Patah balik", en: "Make a U-turn" };
  return { kind: "left", ms: "Belok kiri", en: "Turn left" };
}

export function stepsFromPolyline(
  coordinates: [number, number][],
  locale: "ms" | "en",
): NavigationStep[] {
  if (coordinates.length < 2) return [];

  const steps: NavigationStep[] = [];
  let cumulative = 0;
  steps.push({
    instruction: locale === "ms" ? "Mula navigasi" : "Start navigation",
    kind: "continue",
    maneuverType: "depart",
    distanceM: 0,
    cumulativeM: 0,
  });

  for (let i = 1; i < coordinates.length - 1; i++) {
    const prev = { lat: coordinates[i - 1]![1], lng: coordinates[i - 1]![0] };
    const cur = { lat: coordinates[i]![1], lng: coordinates[i]![0] };
    const next = { lat: coordinates[i + 1]![1], lng: coordinates[i + 1]![0] };
    const segM = haversineM(prev, cur);
    cumulative += segM;

    const b1 = bearing(prev, cur);
    const b2 = bearing(cur, next);
    let delta = b2 - b1;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    if (Math.abs(delta) >= 25) {
      const turn = turnFromDelta(delta);
      const instruction = locale === "ms" ? turn.ms : turn.en;
      steps.push({
        instruction,
        verbalInstruction: instruction,
        kind: turn.kind,
        distanceM: haversineM(cur, next),
        cumulativeM: cumulative,
      });
    }
  }

  const endLabel = locale === "ms" ? "Anda telah sampai" : "You have arrived";
  steps.push({
    instruction: endLabel,
    verbalInstruction: endLabel,
    kind: "arrive",
    maneuverType: "arrive",
    distanceM: 0,
    cumulativeM: cumulative,
  });

  return steps;
}
