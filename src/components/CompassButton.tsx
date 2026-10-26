"use client";

import { useEffect, useRef, useState } from "react";
import { lerpHeading, normalizeHeading, shortestDelta } from "@/lib/heading";

type Props = {
  mapBearing: number;
  trackingGps?: boolean;
  onNorthUp: () => void;
  label: string;
};

export function CompassButton({
  mapBearing,
  trackingGps = false,
  onNorthUp,
  label,
}: Props) {
  const northNeedle = normalizeHeading(-mapBearing);
  const isNorthUp = Math.abs(normalizeHeading(mapBearing)) < 2.5;

  const shownRef = useRef(northNeedle);
  const [shown, setShown] = useState(northNeedle);
  const [snap, setSnap] = useState(false);
  const rafRef = useRef(0);

  useEffect(() => {
    const tick = () => {
      const next = lerpHeading(shownRef.current, northNeedle, 0.22);
      if (Math.abs(shortestDelta(next, northNeedle)) < 0.2) {
        shownRef.current = northNeedle;
        setShown(northNeedle);
        return;
      }
      shownRef.current = next;
      setShown(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [northNeedle]);

  return (
    <button
      type="button"
      className={`waze-circle-btn compass-btn ${isNorthUp && !trackingGps ? "compass-btn-north" : ""} ${trackingGps ? "compass-btn-gps" : ""} ${snap ? "compass-snap" : ""}`}
      onClick={() => {
        setSnap(true);
        window.setTimeout(() => setSnap(false), 520);
        onNorthUp();
      }}
      aria-label={label}
      title={label}
    >
      <span className="compass-ring" aria-hidden>
        <span className="compass-needle" style={{ transform: `rotate(${shown}deg)` }}>
          <span className="compass-n">N</span>
          <span className="compass-arrow" />
        </span>
      </span>
    </button>
  );
}
