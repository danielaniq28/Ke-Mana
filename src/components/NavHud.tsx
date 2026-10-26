"use client";

import { TurnIcon } from "./TurnIcon";
import { displayStreet, formatDistanceM, turnKind } from "@/lib/maneuver-ui";
import { nextGuidanceStep } from "@/lib/navigation/maneuvers";
import { t, type Locale } from "@/lib/i18n";
import type { NavigationStep } from "@/lib/navigation/types";

type Props = {
  locale: Locale;
  routing: boolean;
  paused?: boolean;
  step?: NavigationStep;
  steps?: NavigationStep[];
  stepIndex: number;
  distanceToNextM: number;
  alert?: string | null;
};

export function NavHud({
  locale,
  routing,
  paused,
  step,
  steps = [],
  stepIndex,
  distanceToNextM,
  alert,
}: Props) {
  const next = step ? nextGuidanceStep(steps, stepIndex) : undefined;
  const street = routing
    ? t(locale, "routing")
    : step
      ? displayStreet(step)
      : t(locale, "routing");
  const kind = step ? turnKind(step.instruction, step) : "continue";
  const dist = routing ? "…" : formatDistanceM(distanceToNextM || step?.distanceM || 0, locale);
  const thenLabel = next ? displayStreet(next) : null;

  return (
    <div className={`nav-hud ${paused ? "is-paused" : ""}`}>
      <div className="nav-hud-main">
        <TurnIcon kind={kind} className="nav-hud-arrow" />
        <div className="min-w-0">
          <p className="nav-hud-dist">{dist}</p>
          <p className="nav-hud-street">{street}</p>
        </div>
      </div>
      {alert && !routing && <div className="nav-hud-alert">{alert}</div>}
      {thenLabel && !routing && (
        <div className="nav-hud-then">
          <span>{t(locale, "andThen")}</span>
          <TurnIcon kind={turnKind(next!.instruction, next)} className="nav-hud-then-icon" />
          <span className="truncate">{thenLabel}</span>
        </div>
      )}
    </div>
  );
}
