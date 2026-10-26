import type { Locale } from "../i18n";
import type { NavigationStep, TurnKind } from "./types";

export function instructionFor(
  locale: Locale,
  kind: TurnKind,
  street?: string,
): string {
  const onto = street
    ? locale === "ms"
      ? ` ke ${street}`
      : ` onto ${street}`
    : "";
  switch (kind) {
    case "left":
      return locale === "ms" ? `Belok kiri${onto}` : `Turn left${onto}`;
    case "right":
      return locale === "ms" ? `Belok kanan${onto}` : `Turn right${onto}`;
    case "slight-left":
      return locale === "ms" ? `Ke kiri sedikit${onto}` : `Keep left${onto}`;
    case "slight-right":
      return locale === "ms" ? `Ke kanan sedikit${onto}` : `Keep right${onto}`;
    case "uturn":
      return locale === "ms" ? "Patah balik" : "Make a U-turn";
    case "exit":
      return locale === "ms" ? `Keluar${onto}` : `Take the exit${onto}`;
    case "arrive":
      return locale === "ms" ? "Anda telah sampai" : "You have arrived";
    default:
      return street
        ? locale === "ms"
          ? `Terus di ${street}`
          : `Continue on ${street}`
        : locale === "ms"
          ? "Terus"
          : "Continue straight";
  }
}

export function kindFromOsrm(type?: string, modifier?: string): TurnKind {
  const t = `${type ?? ""} ${modifier ?? ""}`.toLowerCase();
  if (/arrive|destination/.test(t)) return "arrive";
  if (/uturn|u-turn/.test(t)) return "uturn";
  if (/off ramp|on ramp|fork|exit/.test(t)) {
    if (/left/.test(t)) return "slight-left";
    if (/right/.test(t)) return "slight-right";
    return "exit";
  }
  if (/sharp left|left/.test(t) && /slight/.test(t)) return "slight-left";
  if (/sharp right|right/.test(t) && /slight/.test(t)) return "slight-right";
  if (/slight left|bear left/.test(t)) return "slight-left";
  if (/slight right|bear right/.test(t)) return "slight-right";
  if (/\bleft\b/.test(t)) return "left";
  if (/\bright\b/.test(t)) return "right";
  return "continue";
}

export function kindFromValhalla(type?: number): TurnKind {
  switch (type) {
    case 4:
    case 5:
    case 6:
      return "arrive";
    case 9:
      return "slight-right";
    case 10:
    case 11:
      return "right";
    case 12:
    case 13:
      return "uturn";
    case 14:
    case 15:
      return "left";
    case 16:
      return "slight-left";
    case 18:
    case 20:
    case 23:
      return "exit";
    case 19:
    case 21:
    case 24:
      return "slight-left";
    default:
      return "continue";
  }
}

export function kindFromStep(step: NavigationStep): TurnKind {
  if (step.kind) return step.kind;
  const s = `${step.maneuverType ?? ""} ${step.modifier ?? ""} ${step.instruction}`.toLowerCase();
  return kindFromOsrm(s);
}

export function isStartStep(step: NavigationStep): boolean {
  const s = `${step.maneuverType ?? ""} ${step.instruction}`.toLowerCase();
  return /depart|start|mula/.test(s) && step.distanceM < 20;
}

export function guidanceIndex(steps: NavigationStep[], raw: number): number {
  let i = Math.max(0, raw);
  while (i < steps.length - 1 && isStartStep(steps[i]!)) i += 1;
  return i;
}

export function nextGuidanceStep(
  steps: NavigationStep[],
  index: number,
): NavigationStep | undefined {
  for (let i = index + 1; i < steps.length; i++) {
    const step = steps[i]!;
    if (isStartStep(step)) continue;
    if (kindFromStep(step) === "continue" && !step.street && step.distanceM < 40) continue;
    return step;
  }
  return undefined;
}
