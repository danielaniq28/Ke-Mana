import type { Locale } from "./i18n";
import type { NavigationStep, TurnKind } from "./navigation/types";
import { kindFromStep } from "./navigation/maneuvers";

export type { TurnKind };

export function formatDistanceM(meters: number, locale: Locale): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  const value = km >= 10 ? km.toFixed(0) : km.toFixed(1);
  return locale === "ms" ? `${value} km` : `${value} km`;
}

export function streetFromInstruction(instruction: string): string {
  const cleaned = instruction.replace(/\.$/, "").trim();
  const parts = cleaned.split(/\s+(?:onto|on|ke|ke arah|towards|toward|via)\s+/i);
  if (parts.length > 1) return parts[parts.length - 1]!.trim();
  return cleaned;
}

export function turnKind(instruction: string, step?: NavigationStep): TurnKind {
  if (step) return kindFromStep(step);
  const s = instruction.toLowerCase();
  if (/arrive|destination|tiba|sampai/.test(s)) return "arrive";
  if (/u-?turn|pusing balik/.test(s)) return "uturn";
  if (/slight left|bear left|ke kiri sedikit/.test(s)) return "slight-left";
  if (/slight right|bear right|ke kanan sedikit/.test(s)) return "slight-right";
  if (/\bleft\b|kiri/.test(s)) return "left";
  if (/\bright\b|kanan/.test(s)) return "right";
  if (/exit|keluar|ramp/.test(s)) return "exit";
  return "continue";
}

export function displayStreet(step: NavigationStep): string {
  return step.street?.trim() || streetFromInstruction(step.instruction);
}

export function remainingEta(
  totalMin: number,
  totalKm: number,
  remainingM: number,
): { min: number; km: number } {
  const km = Math.max(0, remainingM / 1000);
  const ratio = totalKm > 0.05 ? km / totalKm : 1;
  return { min: Math.max(1, totalMin * ratio), km };
}

export function viaFromSteps(steps: NavigationStep[]): string {
  const names = steps
    .map((s) => s.street?.trim() || streetFromInstruction(s.instruction))
    .filter((n) => n.length > 6 && !/continue|keep|tiba|arrive|destination|start|depart|mula/i.test(n));
  const unique = [...new Set(names)];
  unique.sort((a, b) => b.length - a.length);
  return unique.slice(0, 2).join("; ");
}

export function arrivalClock(durationMin: number): string {
  const d = new Date(Date.now() + durationMin * 60_000);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
