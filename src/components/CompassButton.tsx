"use client";

import { useEffect, useRef, useState } from "react";
import { lerpHeading, normalizeHeading, shortestDelta } from "@/lib/heading";

type Props = {
  mapBearing: number;
  mode: "follow" | "north";
  onToggle: () => void;
  label: string;
};

export function CompassButton({
  mapBearing,
  mode,
  onToggle,
  label,
}: Props) {
  const isNorthUp = Math.abs(normalizeHeading(mapBearing)) < 2.5;
  const isFreeRotated = !isNorthUp && mode === "north";

  // When locked North-up at 0 bearing, needle sits directly at 0 (top).
  // In follow-direction mode (or when rotated off-north), needle points to true North (-mapBearing).
  const targetNeedle = mode === "north" && isNorthUp ? 0 : normalizeHeading(-mapBearing);

  const shownRef = useRef(targetNeedle);
  const [shown, setShown] = useState(targetNeedle);
  const [snap, setSnap] = useState<"north" | "follow" | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const tick = () => {
      const next = lerpHeading(shownRef.current, targetNeedle, 0.24);
      if (Math.abs(shortestDelta(next, targetNeedle)) < 0.25) {
        shownRef.current = targetNeedle;
        setShown(targetNeedle);
        return;
      }
      shownRef.current = next;
      setShown(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [targetNeedle]);

  const handleClick = () => {
    // If currently in follow mode, toggling will snap to north
    // If in north mode, toggling will activate follow direction
    const nextSnap = mode === "follow" ? "north" : "follow";
    setSnap(nextSnap);
    window.setTimeout(() => setSnap(null), 520);
    onToggle();
  };

  return (
    <button
      type="button"
      className={`waze-circle-btn compass-btn ${
        mode === "follow" ? "compass-btn-follow" : "compass-btn-north"
      } ${isFreeRotated ? "compass-btn-free" : ""} ${
        snap === "north" ? "compass-snap-north" : snap === "follow" ? "compass-snap-follow" : ""
      }`}
      onClick={handleClick}
      aria-label={label}
      title={label}
    >
      <span className="compass-ring" aria-hidden>
        {/* Cardinal tick marks */}
        <span className="pointer-events-none absolute inset-0 rounded-full">
          <span className="absolute left-1/2 top-0.5 h-1 w-0.5 -translate-x-1/2 rounded-full bg-red-500/80" />
          <span className="absolute bottom-0.5 left-1/2 h-1 w-0.5 -translate-x-1/2 rounded-full bg-slate-500/50" />
          <span className="absolute left-0.5 top-1/2 h-0.5 w-1 -translate-y-1/2 rounded-full bg-slate-500/50" />
          <span className="absolute right-0.5 top-1/2 h-0.5 w-1 -translate-y-1/2 rounded-full bg-slate-500/50" />
        </span>

        {/* Smoothly rotating needle */}
        <span className="compass-needle" style={{ transform: `rotate(${shown}deg)` }}>
          <span className="compass-n">N</span>
          <span className="compass-arrow" />
          <span className="compass-pivot" />
        </span>
      </span>

      {/* Mode pill badge showing whether in follow (▲) or locked north (N) */}
      <span
        className={`compass-mode-pill ${
          mode === "follow" ? "compass-mode-pill-follow" : "compass-mode-pill-north"
        }`}
        aria-hidden
      >
        {mode === "follow" ? "▲" : "N"}
      </span>
    </button>
  );
}
