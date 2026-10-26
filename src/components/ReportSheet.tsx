"use client";

import type { ReportType } from "@/lib/types";
import { REPORT_ICONS } from "@/lib/report-meta";
import { reportLabel, t, type Locale } from "@/lib/i18n";
import { usePresence } from "@/hooks/usePresence";

const GRID: { type: ReportType; icon: string; key: ReportType }[] = [
  { type: "traffic", icon: REPORT_ICONS.traffic, key: "traffic" },
  { type: "police", icon: REPORT_ICONS.police, key: "police" },
  { type: "accident", icon: REPORT_ICONS.accident, key: "accident" },
  { type: "hazard", icon: REPORT_ICONS.hazard, key: "hazard" },
  { type: "roadblock", icon: REPORT_ICONS.roadblock, key: "roadblock" },
  { type: "flood", icon: REPORT_ICONS.flood, key: "flood" },
];

type Props = {
  locale: Locale;
  open: boolean;
  pendingLatLng: { lat: number; lng: number } | null;
  selectedType: ReportType;
  note: string;
  submitting: boolean;
  locating: boolean;
  onClose: () => void;
  onSelectType: (type: ReportType) => void;
  onNoteChange: (note: string) => void;
  onSubmit: () => void;
};

export function ReportSheet({
  locale,
  open,
  pendingLatLng,
  selectedType,
  note,
  submitting,
  locating,
  onClose,
  onSelectType,
  onNoteChange,
  onSubmit,
}: Props) {
  const { present, shown } = usePresence(open);
  if (!present) return null;

  return (
    <div className={`km-overlay ${shown ? "is-open" : ""}`}>
      <button type="button" className="km-overlay-backdrop" onClick={onClose} aria-label={t(locale, "close")} />
      <div className="km-sheet km-sheet-report" role="dialog" aria-modal="true">
        <div className="km-handle" />
        <div className="mb-4 flex items-center justify-between px-1">
          <h2 className="text-[1.45rem] font-bold text-white">{t(locale, "whatDoYouSee")}</h2>
          <button type="button" className="waze-circle-btn ghost" onClick={onClose} aria-label={t(locale, "close")}>
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm text-[#9aa3b2]">
          {locating
            ? t(locale, "acquiringLocation")
            : pendingLatLng
              ? t(locale, "reportAtLocation")
              : t(locale, "locationDenied")}
        </p>

        <div className="report-grid">
          {GRID.map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={() => onSelectType(item.type)}
              className={`report-cell ${selectedType === item.type ? "is-on" : ""}`}
            >
              <span className="report-cell-icon">{item.icon}</span>
              <span>{reportLabel(locale, item.key)}</span>
            </button>
          ))}
        </div>

        <input
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          maxLength={200}
          className="report-note"
          placeholder={t(locale, "noteOptional")}
        />

        <button
          type="button"
          disabled={!pendingLatLng || submitting || locating}
          onClick={onSubmit}
          className="btn-resume mt-3 w-full"
        >
          {submitting ? t(locale, "loading") : t(locale, "addReport")}
        </button>
      </div>
    </div>
  );
}
