import { useId } from "react";
import { normalizeHeading } from "@/lib/heading";

type Props = {
  heading?: number;
  mapBearing?: number;
};

export function UserLocationArrow({ heading, mapBearing = 0 }: Props) {
  const gradId = useId().replace(/:/g, "");
  const relative = heading == null ? 0 : normalizeHeading(heading - mapBearing);

  return (
    <div className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center">
      <div className="user-loc-halo" />
      <div
        className="relative z-10 drop-shadow-[0_3px_8px_rgba(0,80,160,0.35)] transition-transform duration-200 ease-out"
        style={{ transform: `rotate(${relative}deg)` }}
      >
        <svg width="40" height="48" viewBox="0 0 40 48" fill="none" aria-hidden>
          <path
            d="M20 3L35 42H5L20 3Z"
            fill={`url(#${gradId})`}
            stroke="#ffffff"
            strokeWidth="2.25"
            strokeLinejoin="round"
          />
          <circle cx="20" cy="28" r="4" fill="#ffffff" fillOpacity="0.9" />
          <defs>
            <linearGradient id={gradId} x1="20" y1="3" x2="20" y2="42" gradientUnits="userSpaceOnUse">
              <stop stopColor="#5EC8FF" />
              <stop offset="1" stopColor="#1E90FF" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}
