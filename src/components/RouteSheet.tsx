"use client";

import { usePresence } from "@/hooks/usePresence";
import { arrivalClock, displayStreet, formatDistanceM, turnKind, viaFromSteps } from "@/lib/maneuver-ui";
import { guidanceIndex, isStartStep } from "@/lib/navigation/maneuvers";
import { reportLabel, t, type Locale } from "@/lib/i18n";
import type { ActiveRoute } from "@/lib/navigation/types";
import type { MapReport } from "@/lib/types";
import { REPORT_ICONS } from "@/lib/report-meta";
import { TurnIcon } from "./TurnIcon";

type Props = {
  locale: Locale;
  open: boolean;
  paused: boolean;
  route: ActiveRoute | null;
  remainingMin: number;
  remainingKm: number;
  stepIndex: number;
  onClose: () => void;
  onStop: () => void;
  onResume: () => void;
  onAddStop: () => void;
  onRemoveStop: (index: number) => void;
  events?: { report: MapReport; distanceM: number }[];
};

export function RouteSheet({
  locale,
  open,
  paused,
  route,
  remainingMin,
  remainingKm,
  stepIndex,
  onClose,
  onStop,
  onResume,
  onAddStop,
  onRemoveStop,
  events = [],
}: Props) {
  const { present, shown } = usePresence(open);
  if (!present || !route) return null;

  const via = viaFromSteps(route.steps);
  const dest = route.destination.label ?? t(locale, "routeTo");
  const from = guidanceIndex(route.steps, stepIndex);
  const upcoming = route.steps.filter((s, i) => i >= from && !isStartStep(s)).slice(0, 4);

  return (
    <div className={`km-overlay ${shown ? "is-open" : ""}`} role="dialog" aria-modal="true">
      <button type="button" className="km-overlay-backdrop" onClick={onClose} aria-label={t(locale, "close")} />
      <div className="km-sheet km-sheet-route">
        <div className="km-handle" />
        <div className="route-eta-row">
          <button type="button" className="waze-circle-btn ghost" onClick={onClose} aria-label={t(locale, "close")}>
            ✕
          </button>
          <div className="text-center">
            <p className="eta-clock">{arrivalClock(remainingMin)}</p>
            <p className="eta-sub">
              {Math.round(remainingMin)} {t(locale, "minutes")} · {remainingKm.toFixed(1)} {t(locale, "km")}
            </p>
          </div>
          <span className="waze-circle-btn ghost" aria-hidden>
            ⑂
          </span>
        </div>

        <p className="route-dest-kicker">
          {t(locale, "routeTo")} {dest}
        </p>
        {route.stops.length > 0 && (
          <ul className="route-stops">
            {route.stops.map((stop, i) => (
              <li key={`${stop.lat}-${stop.lng}-${i}`} className="route-stop-row">
                <span className="route-stop-num">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{stop.label ?? t(locale, "addStop")}</span>
                <button type="button" className="text-xs text-[#ff8aa8]" onClick={() => onRemoveStop(i)}>
                  {t(locale, "removeStop")}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="add-stop-btn" onClick={onAddStop}>
          + {t(locale, "addStop")}
        </button>
        {via && (
          <p className="route-via">
            {t(locale, "via")} {via}
          </p>
        )}

        <div className="route-progress">
          <span className="route-progress-dot start" />
          <span className="route-progress-line" />
          <span className="route-progress-dot end" />
        </div>
        {events.length === 0 ? (
          <p className="route-events">{t(locale, "noEvents")}</p>
        ) : (
          <ul className="route-events-list">
            <li className="search-section px-0">{t(locale, "liveReports")}</li>
            {events.map(({ report, distanceM }) => (
              <li key={report.id} className="route-event-row">
                <span className="live-flash-dot" />
                <span>{REPORT_ICONS[report.type]}</span>
                <span className="min-w-0 flex-1 truncate">{reportLabel(locale, report.type)}</span>
                <span className="text-xs text-[#9aa3b2]">{formatDistanceM(distanceM, locale)}</span>
              </li>
            ))}
          </ul>
        )}

        <ul className="route-upcoming">
          {upcoming.map((step, i) => (
            <li key={`${step.cumulativeM}-${i}`} className="route-upcoming-row">
              <TurnIcon kind={turnKind(step.instruction, step)} className="route-upcoming-icon" />
              <span className="min-w-0 flex-1 truncate">{displayStreet(step)}</span>
              <span className="text-xs text-[#9aa3b2]">{formatDistanceM(step.distanceM, locale)}</span>
            </li>
          ))}
        </ul>

        <div className="route-actions">
          <button type="button" className="btn-stop" onClick={onStop}>
            {t(locale, "stop")}
          </button>
          <button type="button" className="btn-resume" onClick={onResume}>
            {t(locale, "resume")}
          </button>
        </div>
      </div>
    </div>
  );
}
