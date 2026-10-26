import { osmLabel, reportLabel, t, type Locale } from "../i18n";
import type { MapReport, OsmFeatureKind } from "../types";
import type { ManeuverCue } from "./progress";
import { roundedAlertMeters } from "./camera-alert";

export function navStartedPhrase(locale: Locale, label?: string): string {
  if (label) {
    return locale === "ms" ? `Navigasi ke ${label}` : `Navigating to ${label}`;
  }
  return t(locale, "navStarted");
}

export function navArrivedPhrase(locale: Locale): string {
  return t(locale, "navArrived");
}

export function hazardPhrase(locale: Locale, report: MapReport): string {
  const type = reportLabel(locale, report.type);
  return `${t(locale, "hazardAhead")}: ${type}`;
}

export function cameraAheadPhrase(
  locale: Locale,
  kind: OsmFeatureKind,
  distanceM: number,
): string {
  const dist = roundedAlertMeters(distanceM);
  const label =
    kind === "red_light_camera" ? osmLabel(locale, "red_light_camera") : osmLabel(locale, "speed_trap");
  if (locale === "ms") return `${dist} meter di hadapan ada ${label.toLowerCase()}`;
  return `${dist} meters ahead there is a ${label.toLowerCase()}`;
}

export function reportAheadPhrase(locale: Locale, type: MapReport["type"], distanceM: number): string {
  const dist = roundedAlertMeters(distanceM);
  const label = reportLabel(locale, type);
  if (locale === "ms") return `Laporan komuniti: ${label.toLowerCase()} ${dist} meter di hadapan`;
  return `Community report: ${label.toLowerCase()} ${dist} meters ahead`;
}

export function maneuverPhrase(
  locale: Locale,
  instruction: string,
  cue: ManeuverCue,
  distanceM: number,
): string {
  const dist = Math.round(distanceM);
  if (cue === "80") return instruction;
  return `${instruction}. ${t(locale, "inMeters")} ${dist} ${t(locale, "meters")}`;
}
